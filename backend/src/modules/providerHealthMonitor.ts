import { ModelPoolManager } from './modelPoolManager.js';
import { TelemetryEngine } from './telemetryEngine.js';

// In-memory snapshot of model IDs from last check
let lastKnownModelIds: Set<string> = new Set();
let monitorInterval: ReturnType<typeof setInterval> | null = null;
let changeListeners: Array<(event: { modelId: string; status: 'removed' | 'restored' }) => void> = [];

export const ProviderHealthMonitor = {
  onModelChange(listener: (event: { modelId: string; status: 'removed' | 'restored' }) => void) {
    changeListeners.push(listener);
  },

  start(intervalMs: number = 10 * 60 * 1000) {
    if (monitorInterval) return;

    // Seed initial snapshot
    const initial = ModelPoolManager.getFreeModels();
    lastKnownModelIds = new Set(initial.map(m => m.modelId));

    monitorInterval = setInterval(async () => {
      try {
        // Re-fetch models via ModelPoolManager refresh
        await ModelPoolManager.refresh();
        const current = ModelPoolManager.getFreeModels();
        const currentIds = new Set(current.map(m => m.modelId));

        // Detect removed models
        for (const id of lastKnownModelIds) {
          if (!currentIds.has(id)) {
            console.log(`[ProviderHealthMonitor] Model removed from free pool: ${id}`);
            TelemetryEngine.record({
              session_id: 'system',
              event_type: 'model_availability_changed',
              synthesis_rationale: JSON.stringify({ modelId: id, status: 'removed' }),
              ts: Date.now()
            });
            for (const listener of changeListeners) {
              listener({ modelId: id, status: 'removed' });
            }
          }
        }

        // Detect restored models
        for (const id of currentIds) {
          if (!lastKnownModelIds.has(id)) {
            console.log(`[ProviderHealthMonitor] Model restored to free pool: ${id}`);
            TelemetryEngine.record({
              session_id: 'system',
              event_type: 'model_availability_changed',
              synthesis_rationale: JSON.stringify({ modelId: id, status: 'restored' }),
              ts: Date.now()
            });
            for (const listener of changeListeners) {
              listener({ modelId: id, status: 'restored' });
            }
          }
        }

        lastKnownModelIds = currentIds;
      } catch (err) {
        console.error('[ProviderHealthMonitor] Poll failed:', err);
      }
    }, intervalMs);

    console.log(`[ProviderHealthMonitor] Started (interval: ${intervalMs}ms)`);
  },

  stop() {
    if (monitorInterval) {
      clearInterval(monitorInterval);
      monitorInterval = null;
      console.log('[ProviderHealthMonitor] Stopped.');
    }
  },

  getLastKnownModelIds(): string[] {
    return Array.from(lastKnownModelIds);
  }
};
