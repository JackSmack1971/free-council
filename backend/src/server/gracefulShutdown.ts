import { Server } from 'http';

interface ShutdownDeps {
  server: Pick<Server, 'close'>;
  retentionMonitor: { stop: () => void };
  checkpointDatabase: () => void;
  closeDatabase: () => void;
  processRef?: Pick<NodeJS.Process, 'on' | 'off'>;
  exit?: (code: number) => void;
  logger?: Pick<Console, 'log' | 'error'>;
  hardExitDelayMs?: number;
}

export function installGracefulShutdown({
  server,
  retentionMonitor,
  checkpointDatabase,
  closeDatabase,
  processRef = process,
  exit = process.exit,
  logger = console,
  hardExitDelayMs = 30000
}: ShutdownDeps): () => void {
  let shuttingDown = false;

  const shutdown = (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    logger.log(`[Shutdown] Received ${signal}. Starting graceful shutdown.`);
    retentionMonitor.stop();

    try {
      checkpointDatabase();
    } catch (err) {
      logger.error('[Shutdown] WAL checkpoint failed:', err);
    }

    const hardExitTimer = setTimeout(() => {
      logger.error(`[Shutdown] Graceful shutdown timed out after ${hardExitDelayMs}ms.`);
      exit(1);
    }, hardExitDelayMs);
    hardExitTimer.unref?.();

    server.close((err?: Error) => {
      clearTimeout(hardExitTimer);

      try {
        closeDatabase();
      } catch (closeErr) {
        logger.error('[Shutdown] Failed to close database:', closeErr);
      }

      if (err) {
        logger.error('[Shutdown] HTTP server close failed:', err);
        exit(1);
        return;
      }

      logger.log('[Shutdown] Graceful shutdown complete.');
      exit(0);
    });
  };

  const handleSigterm = () => shutdown('SIGTERM');
  const handleSigint = () => shutdown('SIGINT');

  processRef.on('SIGTERM', handleSigterm);
  processRef.on('SIGINT', handleSigint);

  return () => {
    processRef.off('SIGTERM', handleSigterm);
    processRef.off('SIGINT', handleSigint);
  };
}
