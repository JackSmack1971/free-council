import { PDFParse } from 'pdf-parse';

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface FileChunk {
  index: number;
  text: string;
  startChar: number;
  endChar: number;
}

export interface ProcessedFile {
  name: string;
  mimeType: string;
  size: number;
  extractedText: string;
  chunks: FileChunk[];
}

export class FileProcessor {
  /**
   * Parses the file buffer based on mimetype and/or file extension,
   * extracts the raw text content, and splits it into chunks.
   */
  static async ingest(file: UploadedFile): Promise<ProcessedFile> {
    let extractedText = '';
    const mimeType = file.mimetype || 'text/plain';
    const name = file.originalname || 'unknown';

    if (mimeType === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) {
      let parser: PDFParse | null = null;
      try {
        parser = new PDFParse({ data: file.buffer });
        const parsed = await parser.getText();
        extractedText = parsed.text || '';
      } catch (err) {
        console.error('PDF parsing failed:', err);
        throw new Error('Failed to parse PDF document');
      } finally {
        if (parser) {
          try {
            await parser.destroy();
          } catch (e) {
            // ignore destroy error
          }
        }
      }
    } else {
      // Fallback for txt, md, json, csv, etc.
      extractedText = file.buffer.toString('utf8');
    }

    const chunks = FileProcessor.chunkText(extractedText);

    return {
      name,
      mimeType,
      size: file.size,
      extractedText,
      chunks
    };
  }

  /**
   * Splits a long text into chunks of 1000 characters with 100 characters overlap.
   */
  static chunkText(text: string, chunkSize = 1000, overlap = 100): FileChunk[] {
    const chunks: FileChunk[] = [];
    if (!text) return chunks;

    let index = 0;
    let start = 0;
    while (start < text.length) {
      let end = start + chunkSize;
      if (end > text.length) {
        end = text.length;
      }

      const chunkText = text.substring(start, end);
      chunks.push({
        index,
        text: chunkText,
        startChar: start,
        endChar: end
      });

      if (end === text.length) {
        break;
      }

      index++;
      start = end - overlap;
      if (start >= end) {
        start = end; // Prevent infinite loop if overlap >= chunkSize
      }
    }

    return chunks;
  }
}
