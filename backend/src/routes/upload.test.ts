import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import { Server } from 'http';
import { uploadRouter } from './upload.js';
import { runMigrations } from '../db/migrationRunner.js';
import { db } from '../db/connection.js';
import { FileProcessor } from '../modules/fileProcessor.js';

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

describe('uploadRouter', () => {
  let server: Server;
  let port: number;
  let originalIngest: typeof FileProcessor.ingest;

  before(async () => {
    runMigrations();
    originalIngest = FileProcessor.ingest;

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
    db.exec('DELETE FROM policy_exceptions');
    FileProcessor.ingest = originalIngest;
  });

  after(() => {
    FileProcessor.ingest = originalIngest;
    server.close();
  });

  test('POST /upload hides internal exception details in 500 responses', async () => {
    const sessionId = 'session-upload-error';
    db.prepare(`
      INSERT INTO policy_exceptions
      (ts, violation_type, model_id, user_action, session_id, details_json, previous_hash, hash)
      VALUES (?, 'UPLOAD_DISCLOSURE_PENDING', NULL, 'acknowledged', ?, NULL, NULL, ?)
    `).run(Date.now(), sessionId, 'test-hash');

    FileProcessor.ingest = async () => {
      throw new Error('Simulated indexing failure');
    };

    const boundary = '----free-council-upload-test';
    const response = await fetch(`http://localhost:${port}/upload?sessionId=${sessionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: buildMultipartBody(boundary, 'notes.txt', 'text/plain', 'hello world')
    });

    assert.strictEqual(response.status, 500);
    const body = await response.json() as { error: string };
    assert.strictEqual(body.error, 'File processing failed.');
    assert.ok(!body.error.includes('Simulated indexing failure'));
  });
});
