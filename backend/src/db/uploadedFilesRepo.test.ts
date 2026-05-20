import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { runMigrations } from './migrationRunner.js';
import { db } from './connection.js';
import { UploadedFilesRepo, UploadedFileRecord } from './uploadedFilesRepo.js';

describe('uploadedFilesRepo tests', () => {
  before(() => {
    // Run migrations to ensure uploaded_files table is created
    runMigrations();
    // Clear out table for clean test state
    db.exec('DELETE FROM uploaded_files');
  });

  after(() => {
    // Clean up
    db.exec('DELETE FROM uploaded_files');
  });

  test('should insert and retrieve uploaded file records', () => {
    const fileId = 'file-abc-123';
    const sessionId = 'session-xyz-789';

    // Insert
    UploadedFilesRepo.insert({
      id: fileId,
      session_id: sessionId,
      filename: 'report.pdf',
      mime_type: 'application/pdf',
      size_bytes: 1024,
      fts_indexed: 0
    });

    // Get by ID
    const record = UploadedFilesRepo.get(fileId);
    assert.ok(record);
    assert.strictEqual(record.id, fileId);
    assert.strictEqual(record.session_id, sessionId);
    assert.strictEqual(record.filename, 'report.pdf');
    assert.strictEqual(record.mime_type, 'application/pdf');
    assert.strictEqual(record.size_bytes, 1024);
    assert.strictEqual(record.fts_indexed, 0);
    assert.ok(record.ts);

    // Get by Session ID
    const records = UploadedFilesRepo.getBySession(sessionId);
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].id, fileId);

    // Mark as FTS indexed
    UploadedFilesRepo.markAsFtsIndexed(fileId);
    const updatedRecord = UploadedFilesRepo.get(fileId);
    assert.ok(updatedRecord);
    assert.strictEqual(updatedRecord.fts_indexed, 1);
  });
});
