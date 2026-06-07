import assert from 'node:assert/strict';
import express from 'express';
import { Server } from 'http';
import { after, before, beforeEach, describe, test } from 'node:test';

import { db } from '../db/connection.js';
import { runMigrations } from '../db/migrationRunner.js';
import { FtsSearchService } from '../db/ftsSearchService.js';
import { FileProcessor } from '../modules/fileProcessor.js';
import { SessionRegistry } from '../modules/sessionRegistry.js';
import { uploadRouter } from './upload.js';

function buildMultipartBody(boundary: string, filename: string, mimeType: string, content: string): Buffer {
  return Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--\r\n`,
    'utf8'
  );
}

describe('upload authorization', () => {
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
        const address = server.address();
        if (!address || typeof address !== 'object') {
          throw new Error('Expected test server to bind to a port.');
        }

        port = address.port;
        resolve();
      });
    });
  });

  beforeEach(() => {
    SessionRegistry.clearForTests();
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

  test('POST /upload rejects non-owner API keys', async () => {
    const sessionId = 'session-upload-authz';
    SessionRegistry.createSession(sessionId, 'openrouter/free', 'council', 'owner-key');
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

    FtsSearchService.indexChunks = () => {};

    const boundary = '----free-council-upload-authz-test';
    const response = await fetch(`http://localhost:${port}/upload?sessionId=${sessionId}`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer foreign-key',
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: buildMultipartBody(boundary, 'notes.txt', 'text/plain', 'hello world')
    });

    assert.equal(response.status, 403);
  });
});
