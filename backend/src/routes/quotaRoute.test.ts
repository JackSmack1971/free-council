import { after, before, describe, test } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import { Server } from 'http';
import { apiRouter } from './api.js';
import { runMigrations } from '../db/migrationRunner.js';

describe('quota route', () => {
  let server: Server;
  let port: number;

  before(async () => {
    runMigrations();

    const app = express();
    app.use(apiRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        if (address && typeof address === 'object') {
          port = address.port;
        }
        resolve();
      });
    });
  });

  after(() => {
    delete process.env.DAILY_API_QUOTA;
    server.close();
  });

  test('GET /quota returns the configured daily limit', async () => {
    process.env.DAILY_API_QUOTA = '50';

    const response = await fetch(`http://localhost:${port}/quota`, {
      headers: { 'Authorization': 'Bearer test-key' }
    });
    assert.strictEqual(response.status, 200);

    const body = await response.json() as { dailyLimit: number; isEstimated: boolean };
    assert.strictEqual(body.dailyLimit, 50);
    assert.strictEqual(body.isEstimated, true);
  });
});
