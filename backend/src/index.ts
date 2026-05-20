import express from 'express';
import cors from 'cors';
import { runMigrations } from './db/migrationRunner.js';
import { ModelPoolManager } from './modules/modelPoolManager.js';
import { apiRouter } from './routes/api.js';

const app = express();
app.use(cors());
app.use(express.json());

// Mount the API routes
app.use('/api/v1', apiRouter);
// Fallback mounting for non-prefixed paths if needed
app.use('/', apiRouter);

const PORT = process.env.PORT || 3001;

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
  });
}

startServer();
