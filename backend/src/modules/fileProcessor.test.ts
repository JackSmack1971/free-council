import { test, describe, mock } from 'node:test';
import assert from 'node:assert';
import { FileProcessor, UploadedFile } from './fileProcessor.js';
import { PDFParse } from 'pdf-parse';

describe('FileProcessor Tests', () => {
  test('should chunk text correctly with default parameters', () => {
    const text = 'abcdefghijklmnopqrstuvwxyz'; // 26 chars
    const chunks = FileProcessor.chunkText(text, 10, 2);
    // Chunk size 10, overlap 2.
    // Chunk 0: indices 0 to 10 ("abcdefghij")
    // Chunk 1: indices 8 to 18 ("ijklmnopqr")
    // Chunk 2: indices 16 to 26 ("qrstuvwxyz")
    assert.strictEqual(chunks.length, 3);
    assert.strictEqual(chunks[0].text, 'abcdefghij');
    assert.strictEqual(chunks[0].startChar, 0);
    assert.strictEqual(chunks[0].endChar, 10);

    assert.strictEqual(chunks[1].text, 'ijklmnopqr');
    assert.strictEqual(chunks[1].startChar, 8);
    assert.strictEqual(chunks[1].endChar, 18);

    assert.strictEqual(chunks[2].text, 'qrstuvwxyz');
    assert.strictEqual(chunks[2].startChar, 16);
    assert.strictEqual(chunks[2].endChar, 26);
  });

  test('should ingest text file correctly', async () => {
    const file: UploadedFile = {
      originalname: 'test.txt',
      mimetype: 'text/plain',
      buffer: Buffer.from('Hello world from Free Council text file ingestion!'),
      size: 51
    };

    const processed = await FileProcessor.ingest(file);
    assert.strictEqual(processed.name, 'test.txt');
    assert.strictEqual(processed.mimeType, 'text/plain');
    assert.strictEqual(processed.size, 51);
    assert.strictEqual(processed.extractedText, 'Hello world from Free Council text file ingestion!');
    assert.strictEqual(processed.chunks.length, 1);
  });

  test('should ingest PDF file and parse text via PDFParse', async () => {
    const dummyText = 'Stubbed PDF content parsed successfully!';
    
    // Stub PDFParse prototype getText method
    const originalGetText = PDFParse.prototype.getText;
    mock.method(PDFParse.prototype, 'getText', async function() {
      return { text: dummyText };
    });

    const file: UploadedFile = {
      originalname: 'document.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('fake pdf data'),
      size: 13
    };

    try {
      const processed = await FileProcessor.ingest(file);
      assert.strictEqual(processed.name, 'document.pdf');
      assert.strictEqual(processed.mimeType, 'application/pdf');
      assert.strictEqual(processed.extractedText, dummyText);
      assert.strictEqual(processed.chunks[0].text, dummyText);
    } finally {
      // Restore
      PDFParse.prototype.getText = originalGetText;
    }
  });
});
