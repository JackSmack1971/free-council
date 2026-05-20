import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { runMigrations } from './migrationRunner.js';
import { db } from './connection.js';
import { UploadedFilesRepo } from './uploadedFilesRepo.js';
import { FtsSearchService } from './ftsSearchService.js';

describe('FtsSearchService tests', () => {
  before(() => {
    // Run migrations to ensure all tables are created
    runMigrations();
    // Clear out tables for clean test state
    db.exec('DELETE FROM uploaded_file_chunks_fts');
    db.exec('DELETE FROM uploaded_file_chunks');
    db.exec('DELETE FROM uploaded_files');
  });

  after(() => {
    // Clean up
    db.exec('DELETE FROM uploaded_file_chunks_fts');
    db.exec('DELETE FROM uploaded_file_chunks');
    db.exec('DELETE FROM uploaded_files');
  });

  test('should index file chunks and retrieve them via FTS5 search by session', () => {
    const sessionId1 = 'session-111';
    const sessionId2 = 'session-222';

    // Register two files, one in each session
    UploadedFilesRepo.insert({
      id: 'file-1',
      session_id: sessionId1,
      filename: 'quantum_physics.txt',
      mime_type: 'text/plain',
      size_bytes: 500
    });

    UploadedFilesRepo.insert({
      id: 'file-2',
      session_id: sessionId2,
      filename: 'cooking_recipes.txt',
      mime_type: 'text/plain',
      size_bytes: 500
    });

    // Chunks for file 1
    const chunks1 = [
      { index: 0, text: 'Quantum mechanics is a fundamental theory in physics that provides a description of the physical properties of nature at the scale of atoms.', startChar: 0, endChar: 145 },
      { index: 1, text: 'Black holes are regions of spacetime where gravity is so strong that nothing, not even light, can escape from them.', startChar: 146, endChar: 260 }
    ];

    // Chunks for file 2
    const chunks2 = [
      { index: 0, text: 'Chocolate chip cookies require butter, sugar, flour, and chocolate chips baked at 350 degrees.', startChar: 0, endChar: 94 }
    ];

    // Index them
    FtsSearchService.indexChunks('file-1', chunks1);
    FtsSearchService.indexChunks('file-2', chunks2);

    // Verify index status changed in uploaded_files
    const f1 = UploadedFilesRepo.get('file-1');
    assert.strictEqual(f1?.fts_indexed, 1);

    // Search in session 1 for "quantum"
    const results1 = FtsSearchService.searchFileContent(sessionId1, 'quantum');
    assert.strictEqual(results1.length, 1);
    assert.strictEqual(results1[0].fileId, 'file-1');
    assert.strictEqual(results1[0].filename, 'quantum_physics.txt');
    assert.match(results1[0].content, /Quantum mechanics/);

    // Search in session 1 for "cookies" (should return nothing, because cookies is in session 2)
    const results2 = FtsSearchService.searchFileContent(sessionId1, 'cookies');
    assert.strictEqual(results2.length, 0);

    // Search in session 2 for "chocolate cookies" (should return file 2 chunk)
    const results3 = FtsSearchService.searchFileContent(sessionId2, 'chocolate cookies');
    assert.strictEqual(results3.length, 1);
    assert.strictEqual(results3[0].fileId, 'file-2');
    assert.strictEqual(results3[0].filename, 'cooking_recipes.txt');
    assert.match(results3[0].content, /Chocolate chip cookies/);
  });
});
