import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { FileProcessor, UploadedFile } from '../modules/fileProcessor.js';
import { db } from '../db/connection.js';
import { FtsSearchService } from '../db/ftsSearchService.js';
import { recordException } from '../db/policyExceptionsRepo.js';

export const uploadRouter = Router();

const ALLOWED_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'application/json',
  'text/csv',
  'application/pdf'
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function parseMultipart(body: Buffer, boundary: string): Map<string, { headers: Record<string, string>; data: Buffer }> {
  const sep = Buffer.from(`--${boundary}`);
  const parts = new Map<string, { headers: Record<string, string>; data: Buffer }>();

  let offset = 0;
  while (offset < body.length) {
    const boundaryIdx = body.indexOf(sep, offset);
    if (boundaryIdx === -1) break;
    offset = boundaryIdx + sep.length;

    // Skip \r\n or check for --\r\n (end boundary)
    if (body[offset] === 45 && body[offset + 1] === 45) break; // '--'
    if (body[offset] === 13) offset += 2; // '\r\n'

    // Parse headers
    const headers: Record<string, string> = {};
    while (offset < body.length) {
      const lineEnd = body.indexOf('\r\n', offset);
      if (lineEnd === -1 || lineEnd === offset) {
        if (lineEnd === offset) offset += 2;
        break;
      }
      const line = body.slice(offset, lineEnd).toString('utf8');
      offset = lineEnd + 2;
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim().toLowerCase();
      const val = line.slice(colonIdx + 1).trim();
      headers[key] = val;
    }

    // Find next boundary
    const nextBoundary = body.indexOf(sep, offset);
    if (nextBoundary === -1) break;

    // Data ends before \r\n--boundary
    let dataEnd = nextBoundary - 2; // strip trailing \r\n
    if (dataEnd < offset) dataEnd = offset;

    const data = body.slice(offset, dataEnd);
    offset = nextBoundary;

    const disposition = headers['content-disposition'] || '';
    const nameMatch = disposition.match(/name="([^"]+)"/);
    if (nameMatch) {
      parts.set(nameMatch[1], { headers, data });
    }
  }
  return parts;
}

// POST /upload — multipart/form-data
uploadRouter.post('/', async (req: Request, res: Response) => {
  // Check upload disclosure acknowledgment
  const sessionId = req.query.sessionId as string || '';
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required as a query parameter' });
  }

  // Check if disclosure is acknowledged via policy_exceptions
  const disclosureRow = db.prepare(
    "SELECT id FROM policy_exceptions WHERE session_id = ? AND violation_type = 'UPLOAD_DISCLOSURE_PENDING' AND user_action = 'acknowledged' LIMIT 1"
  ).get(sessionId);

  if (!disclosureRow) {
    return res.status(403).json({ error: 'Upload disclosure not acknowledged for this session', code: 'UPLOAD_DISCLOSURE_PENDING' });
  }

  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
  if (!boundaryMatch) {
    return res.status(400).json({ error: 'Content-Type must be multipart/form-data with boundary' });
  }
  const boundary = boundaryMatch[1];

  // Collect raw body
  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  await new Promise<void>((resolve, reject) => {
    req.on('end', resolve);
    req.on('error', reject);
  });
  const rawBody = Buffer.concat(chunks);

  const parts = parseMultipart(rawBody, boundary);
  const filePart = parts.get('file');

  if (!filePart) {
    return res.status(400).json({ error: 'No file field found in upload' });
  }

  // Extract filename from Content-Disposition
  const disposition = filePart.headers['content-disposition'] || '';
  const filenameMatch = disposition.match(/filename="([^"]+)"/);
  const filename = filenameMatch ? filenameMatch[1] : 'upload';

  // Determine MIME type
  const declaredMime = (filePart.headers['content-type'] || 'application/octet-stream').split(';')[0].trim();
  const extMime: Record<string, string> = {
    '.pdf': 'application/pdf', '.txt': 'text/plain', '.md': 'text/markdown',
    '.json': 'application/json', '.csv': 'text/csv'
  };
  const ext = '.' + filename.split('.').pop()?.toLowerCase();
  const mimeType = ALLOWED_MIME_TYPES.has(declaredMime) ? declaredMime : (extMime[ext] || declaredMime);

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return res.status(400).json({ error: `Unsupported MIME type: ${mimeType}. Allowed: ${[...ALLOWED_MIME_TYPES].join(', ')}` });
  }

  if (filePart.data.length > MAX_FILE_SIZE) {
    return res.status(400).json({ error: `File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB` });
  }

  const uploadedFile: UploadedFile = {
    originalname: filename,
    mimetype: mimeType,
    buffer: filePart.data,
    size: filePart.data.length
  };

  let fileId: string | null = null;

  try {
    // Process and extract text
    const processed = await FileProcessor.ingest(uploadedFile);
    fileId = crypto.randomUUID();

    // INSERT into uploaded_files (raw binary is discarded — only metadata + text stored)
    db.prepare(`
      INSERT INTO uploaded_files (id, session_id, filename, mime_type, size_bytes, fts_indexed, ts)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(fileId, sessionId, filename, mimeType, filePart.data.length, Date.now());

    // Index text chunks into FTS5 (also marks fts_indexed=1 internally)
    FtsSearchService.indexChunks(fileId, processed.chunks);

    // Record policy event
    recordException({
      ts: Date.now(),
      violation_type: 'UPLOAD_DISCLOSURE_PENDING',
      model_id: null,
      user_action: 'file_uploaded',
      session_id: sessionId,
      details_json: JSON.stringify({ fileId, filename, mimeType })
    });

    return res.status(201).json({
      fileId,
      filename,
      mimeType,
      sizeBytes: filePart.data.length,
      ftsIndexed: true
    });
  } catch (err: any) {
    if (fileId) {
      db.prepare('DELETE FROM uploaded_files WHERE id = ?').run(fileId);
    }
    console.error('[upload] Processing failed:', err);
    return res.status(500).json({ error: 'File processing failed: ' + err.message });
  }
});
