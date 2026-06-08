import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import { Server } from 'http';
import { uploadRouter } from './upload.js';
import { runMigrations } from '../db/migrationRunner.js';
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

describe('uploadRouter', () => {
  let server: Server;
  let port: number;
  let originalIngest: typeof FileProcessor.ingest;
  let originalIndexChunks: typeof FtsSearchService.indexChunks;

  before(async () => {
    runMigrations();
    originalIngest = FileProcessor.ingest;
    originalIndexChunks = FtsSearchService.indexChunks;

    const app = express();
    app.use('/upload', uploadRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          port = addr.port;
        }
        resolve();
      });
    });
  });

  beforeEach(() => {
    SessionRegistry.clearForTests();
    db.exec('DELETE FROM sessions');
    db.exec('DELETE FROM uploaded_file_chunks_fts');
    db.exec('DELETE FROM uploaded_file_chunks');
    db.exec('DELETE FROM uploaded_files');
    db.exec('DELETE FROM policy_exceptions');
    FileProcessor.ingest = originalIngest;
    FtsSearchService.indexChunks = originalIndexChunks;
  });

  after(() => {
    FileProcessor.ingest = originalIngest;
    FtsSearchService.indexChunks = originalIndexChunks;
    server.close();
  });

  test('removes uploaded_files metadata when FTS indexing fails', async () => {
    const sessionId = 'session-upload-failure';
    const apiKey = 'test-owner-key';
    const hash = hashApiKey(apiKey);
    SessionStore.createSession(sessionId, 'openrouter/free', 'council', hash);
    SessionRegistry.createSession(sessionId, 'openrouter/free', 'council', apiKey);

    db.prepare(`
      INSERT INTO policy_exceptions
      (ts, violation_type, model_id, user_action, session_id, details_json, previous_hash, hash)
      VALUES (?, 'UPLOAD_DISCLOSURE_PENDING', NULL, 'acknowledged', ?, NULL, NULL, ?)
    `).run(Date.now(), sessionId, 'test-hash');

    FileProcessor.ingest = async () => ({
      name: 'notes.txt',
      mimeType: 'text/plain',
      size: 12,
      extractedText: 'hello world',
      chunks: [{ index: 0, text: 'hello world', startChar: 0, endChar: 11 }]
    });

    FtsSearchService.indexChunks = () => {
      throw new Error('Simulated indexing failure');
    };

    const boundary = '----free-council-upload-test';
    const response = await fetch(`http://localhost:${port}/upload?sessionId=${sessionId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: buildMultipartBody(boundary, 'notes.txt', 'text/plain', 'hello world')
    });

    assert.strictEqual(response.status, 500);
    const body = await response.json() as { error: string };
    assert.match(body.error, /File processing failed/);

    const storedFiles = db.prepare('SELECT id FROM uploaded_files WHERE session_id = ?').all(sessionId) as Array<{ id: string }>;
    assert.strictEqual(storedFiles.length, 0);
  });
});
