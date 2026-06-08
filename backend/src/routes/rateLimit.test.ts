import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import { Server } from 'http';
import { apiRouter } from './api.js';
import { uploadRouter } from './upload.js';
import { runMigrations } from '../db/migrationRunner.js';
import { ModelPoolManager } from '../modules/modelPoolManager.js';
import { resetRateLimitersForTest } from '../middleware/rateLimit.js';
import { db } from '../db/connection.js';
import { FileProcessor } from '../modules/fileProcessor.js';
import { FtsSearchService } from '../db/ftsSearchService.js';
import { SessionRegistry, hashApiKey } from '../modules/sessionRegistry.js';
import { SessionStore } from '../modules/sessionStore.js';

function buildMultipartBody(boundary: string, filename: string, mimeType: string, content: string): ArrayBuffer {
  const body = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--\r\n`,
    'utf8'
  );
  return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
}

describe('rate limit integration', () => {
  let apiServer: Server;
  let apiPort: number;
  let uploadServer: Server;
  let uploadPort: number;
  let originalGetFreeModels: typeof ModelPoolManager.getFreeModels;
  let originalGetLastSnapshotTs: typeof ModelPoolManager.getLastSnapshotTs;
  let originalIngest: typeof FileProcessor.ingest;
  let originalIndexChunks: typeof FtsSearchService.indexChunks;

  before(async () => {
    runMigrations();

    originalGetFreeModels = ModelPoolManager.getFreeModels;
    originalGetLastSnapshotTs = ModelPoolManager.getLastSnapshotTs;
    originalIngest = FileProcessor.ingest;
    originalIndexChunks = FtsSearchService.indexChunks;

    ModelPoolManager.getFreeModels = () => ([
      {
        modelId: 'openai/gpt-oss-120b:free',
        is_free: true,
        is_provider_logged: false,
        supports_zdr: false,
        contextLength: 128000,
        coding: false,
        reasoning: true,
        vision: false,
        pdf_input: false,
        image_input: false,
        tool_calling: false,
        structured_output: false,
        long_context: true,
        supported_parameters: []
      }
    ] as any);
    ModelPoolManager.getLastSnapshotTs = () => Date.now();

    const apiApp = express();
    apiApp.use(express.json());
    apiApp.use(apiRouter);
    await new Promise<void>((resolve) => {
      apiServer = apiApp.listen(0, () => {
        const addr = apiServer.address();
        if (addr && typeof addr === 'object') {
          apiPort = addr.port;
        }
        resolve();
      });
    });

    const uploadApp = express();
    uploadApp.use('/upload', uploadRouter);
    await new Promise<void>((resolve) => {
      uploadServer = uploadApp.listen(0, () => {
        const addr = uploadServer.address();
        if (addr && typeof addr === 'object') {
          uploadPort = addr.port;
        }
        resolve();
      });
    });
  });

  beforeEach(() => {
    resetRateLimitersForTest();
    SessionRegistry.clearForTests();
    db.exec('DELETE FROM sessions');
    db.exec('DELETE FROM policy_exceptions');
    db.exec('DELETE FROM uploaded_file_chunks_fts');
    db.exec('DELETE FROM uploaded_file_chunks');
    db.exec('DELETE FROM uploaded_files');
    FileProcessor.ingest = async () => ({
      name: 'notes.txt',
      mimeType: 'text/plain',
      size: 11,
      extractedText: 'hello world',
      chunks: [{ index: 0, text: 'hello world', startChar: 0, endChar: 11 }]
    });
    FtsSearchService.indexChunks = originalIndexChunks;
  });

  after(() => {
    ModelPoolManager.getFreeModels = originalGetFreeModels;
    ModelPoolManager.getLastSnapshotTs = originalGetLastSnapshotTs;
    FileProcessor.ingest = originalIngest;
    FtsSearchService.indexChunks = originalIndexChunks;
    apiServer.close();
    uploadServer.close();
  });

  test('POST /session returns 429 with Retry-After after 20 requests in an hour', async () => {
    for (let i = 0; i < 20; i++) {
      const response = await fetch(`http://localhost:${apiPort}/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer rate-limit-test-key'
        },
        body: JSON.stringify({ modelId: 'openai/gpt-oss-120b:free', mode: 'solo' })
      });
      assert.strictEqual(response.status, 201);
    }

    const limited = await fetch(`http://localhost:${apiPort}/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer rate-limit-test-key'
      },
      body: JSON.stringify({ modelId: 'openai/gpt-oss-120b:free', mode: 'solo' })
    });

    assert.strictEqual(limited.status, 429);
    assert.ok(limited.headers.get('Retry-After'));
  });

  test('POST /dispatch returns 429 with Retry-After after 10 requests per API key per minute', async () => {
    const sessionRes = await fetch(`http://localhost:${apiPort}/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dispatch-test-key'
      },
      body: JSON.stringify({ modelId: 'openai/gpt-oss-120b:free', mode: 'solo' })
    });
    const sessionBody = await sessionRes.json() as { sessionId: string };

    for (let i = 0; i < 10; i++) {
      const response = await fetch(`http://localhost:${apiPort}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer dispatch-test-key' },
        body: JSON.stringify({ sessionId: sessionBody.sessionId })
      });
      assert.strictEqual(response.status, 400);
    }

    const limited = await fetch(`http://localhost:${apiPort}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer dispatch-test-key' },
      body: JSON.stringify({ sessionId: sessionBody.sessionId })
    });

    assert.strictEqual(limited.status, 429);
    assert.ok(limited.headers.get('Retry-After'));
  });

  test('POST /upload returns 429 with Retry-After after 5 requests per API key per minute', async () => {
    const sessionId = 'upload-rate-limit-session';
    const apiKey = 'upload-test-key';
    const hash = hashApiKey(apiKey);
    SessionStore.createSession(sessionId, 'openai/gpt-oss-120b:free', 'solo', hash);
    SessionRegistry.createSession(sessionId, 'openai/gpt-oss-120b:free', 'solo', apiKey);

    db.prepare(`
      INSERT INTO policy_exceptions
      (ts, violation_type, model_id, user_action, session_id, details_json, previous_hash, hash)
      VALUES (?, 'UPLOAD_DISCLOSURE_PENDING', NULL, 'acknowledged', ?, NULL, NULL, ?)
    `).run(Date.now(), sessionId, 'upload-rate-limit-hash');

    const boundary = '----free-council-rate-limit-test';
    FtsSearchService.indexChunks = () => {};

    for (let i = 0; i < 5; i++) {
      const response = await fetch(`http://localhost:${uploadPort}/upload?sessionId=${sessionId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`
        },
        body: buildMultipartBody(boundary, `notes-${i}.txt`, 'text/plain', 'hello world')
      });
      assert.strictEqual(response.status, 201);
    }

    const limited = await fetch(`http://localhost:${uploadPort}/upload?sessionId=${sessionId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: buildMultipartBody(boundary, 'notes-6.txt', 'text/plain', 'hello world')
    });

    assert.strictEqual(limited.status, 429);
    assert.ok(limited.headers.get('Retry-After'));
  });
});
