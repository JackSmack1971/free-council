import { db } from './connection.js';

export interface SearchResult {
  chunkId: string;
  fileId: string;
  filename: string;
  content: string;
}

export function buildFtsQuery(queryText: string): string | null {
  if (!queryText || !queryText.trim()) {
    return null;
  }

  const words = queryText
    .split(/\s+/)
    .map((word) => word.replace(/"/g, '""').replace(/[^a-zA-Z0-9]/g, '').trim())
    .filter((word) => word.length > 0);

  if (words.length === 0) {
    return null;
  }

  return words.map((word) => `"${word}"`).join(' OR ');
}

export class FtsSearchService {
  /**
   * Indexes text chunks of an uploaded file into both the metadata chunks table
   * and the FTS5 virtual table, then updates the file's index status.
   */
  static indexChunks(
    fileId: string,
    chunks: { index: number; text: string; startChar: number; endChar: number }[]
  ): void {
    const insertChunk = db.prepare(`
      INSERT OR REPLACE INTO uploaded_file_chunks (id, file_id, chunk_index, start_char, end_char, content)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertFts = db.prepare(`
      INSERT OR REPLACE INTO uploaded_file_chunks_fts (chunk_id, file_id, content)
      VALUES (?, ?, ?)
    `);

    const updateFile = db.prepare(`
      UPDATE uploaded_files
      SET fts_indexed = 1
      WHERE id = ?
    `);

    // Perform inside an transaction for performance/safety
    db.exec('BEGIN TRANSACTION;');
    try {
      for (const chunk of chunks) {
        const chunkId = `${fileId}_${chunk.index}`;
        insertChunk.run(
          chunkId,
          fileId,
          chunk.index,
          chunk.startChar,
          chunk.endChar,
          chunk.text
        );

        insertFts.run(chunkId, fileId, chunk.text);
      }
      updateFile.run(fileId);
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      console.error('[FtsSearchService] Indexing transaction failed:', err);
      throw err;
    }
  }

  /**
   * Queries the FTS5 table for matching chunks in a given session using BM25 ranking.
   */
  static searchFileContent(sessionId: string, queryText: string, limit = 5): SearchResult[] {
    const ftsQuery = buildFtsQuery(queryText);
    if (!ftsQuery) {
      return [];
    }

    try {
      const stmt = db.prepare(`
        SELECT 
          fts.chunk_id AS chunkId,
          fts.file_id AS fileId,
          fts.content AS content,
          files.filename AS filename
        FROM uploaded_file_chunks_fts fts
        JOIN uploaded_files files ON fts.file_id = files.id
        WHERE files.session_id = ? AND fts.content MATCH ?
        ORDER BY bm25(uploaded_file_chunks_fts) ASC
        LIMIT ?
      `);

      return (stmt.all(sessionId, ftsQuery, limit) as unknown as SearchResult[]) || [];
    } catch (err) {
      console.error('[FtsSearchService] Search failed:', err);
      return [];
    }
  }
}
