import { db } from './connection.js';

export interface UploadedFileRecord {
  id: string;
  session_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  fts_indexed: number;
  ts: number;
}

export class UploadedFilesRepo {
  static insert(record: {
    id: string;
    session_id: string;
    filename: string;
    mime_type: string;
    size_bytes: number;
    fts_indexed?: number;
  }): void {
    const stmt = db.prepare(`
      INSERT INTO uploaded_files (id, session_id, filename, mime_type, size_bytes, fts_indexed, ts)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      record.id,
      record.session_id,
      record.filename,
      record.mime_type,
      record.size_bytes,
      record.fts_indexed ?? 0,
      Date.now()
    );
  }

  static get(id: string): UploadedFileRecord | null {
    const stmt = db.prepare('SELECT * FROM uploaded_files WHERE id = ?');
    return (stmt.get(id) as unknown as UploadedFileRecord) || null;
  }

  static getBySession(sessionId: string): UploadedFileRecord[] {
    const stmt = db.prepare('SELECT * FROM uploaded_files WHERE session_id = ? ORDER BY ts ASC');
    return (stmt.all(sessionId) as unknown as UploadedFileRecord[]) || [];
  }

  static markAsFtsIndexed(id: string): void {
    const stmt = db.prepare('UPDATE uploaded_files SET fts_indexed = 1 WHERE id = ?');
    stmt.run(id);
  }
}
