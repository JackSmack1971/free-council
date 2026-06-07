import express from 'express';
import cors from 'cors';
import { buildCorsOptions } from './config/corsOptions.js';
import { runMigrations } from './db/migrationRunner.js';
import { ModelPoolManager } from './modules/modelPoolManager.js';
import { apiRouter } from './routes/api.js';
import { uploadRouter } from './routes/upload.js';
import { RetentionMonitor } from './modules/retentionMonitor.js';
import { SessionCleanupMonitor } from './modules/sessionCleanupMonitor.js';
import { resolvePort } from './config/port.js';
import { configureConsoleLogging } from './config/logger.js';

configureConsoleLogging();

const app = express();
app.use(cors(buildCorsOptions()));
app.use(express.json());

// Mount the API routes
app.use('/api/v1', apiRouter);
app.use('/api/v1/upload', uploadRouter);
// Fallback mounting for non-prefixed paths if needed
app.use('/', apiRouter);
app.use('/upload', uploadRouter);

const PORT = (() => {
  try {
    return resolvePort();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Startup] Invalid PORT configuration: ${message}`);
    process.exit(1);
  }
})();

async function startServer() {
  console.log('[Startup] Running migrations...');
  runMigrations();

  try {
    console.log('[Startup] Loading model pool catalog...');
    await ModelPoolManager.refresh();
  } catch (err) {
    console.error('[Startup] Failed to load/refresh model catalog on startup:', err);
  }

  app.listen(PORT, () => {
    console.log(`[Startup] Server successfully started on port ${PORT}`);
    // Start retention monitoring (every 60 seconds)
    RetentionMonitor.start();
    SessionCleanupMonitor.start();
  });
}

startServer();
