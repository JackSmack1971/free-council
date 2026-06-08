import assert from 'node:assert';
import { describe, test } from 'node:test';
import { installGracefulShutdown } from './gracefulShutdown.js';

describe('gracefulShutdown', () => {
  test('stops background work, checkpoints/closes DB, and exits cleanly on SIGTERM', async () => {
    const signals = new Map<string, () => void>();
    const calls: string[] = [];
    const exitCodes: number[] = [];

    const cleanup = installGracefulShutdown({
      server: {
        close(callback) {
          calls.push('server.close');
          callback?.();
          return this as any;
        }
      },
      retentionMonitor: {
        stop() {
          calls.push('retention.stop');
        }
      },
      providerHealthMonitor: {
        stop() {
          calls.push('providerHealth.stop');
        }
      },
      checkpointDatabase() {
        calls.push('db.checkpoint');
      },
      closeDatabase() {
        calls.push('db.close');
      },
      processRef: {
        on(event: string, handler: () => void) {
          signals.set(event, handler as () => void);
          return this as any;
        },
        off(event: string) {
          signals.delete(event);
          return this as any;
        }
      } as any,
      exit(code) {
        exitCodes.push(code);
      },
      logger: {
        log() {},
        error() {}
      },
      hardExitDelayMs: 50
    });

    const sigterm = signals.get('SIGTERM');
    assert.ok(sigterm);

    sigterm?.();

    assert.deepStrictEqual(calls, [
      'retention.stop',
      'providerHealth.stop',
      'db.checkpoint',
      'server.close',
      'db.close'
    ]);
    assert.deepStrictEqual(exitCodes, [0]);

    cleanup();
    assert.strictEqual(signals.has('SIGTERM'), false);
    assert.strictEqual(signals.has('SIGINT'), false);
  });
});
