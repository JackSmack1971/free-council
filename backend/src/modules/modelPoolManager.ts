import { NormalizedModelCapabilities, ModelCardSummary } from 'shared';
import { CapabilityDetector, OpenRouterModelMetadata } from './capabilityDetector.js';
import { ModelCardSummarizer } from './modelCardSummarizer.js';
import { db } from '../db/connection.js';

export const MODEL_SNAPSHOT_TTL_MS = 60 * 60 * 1000;

let currentFreeModels: NormalizedModelCapabilities[] = [];
let currentCardSummaries: ModelCardSummary[] = [];
let lastSnapshotTs: number | null = null;

export const ModelPoolManager = {
  async refresh(): Promise<void> {
    console.log('[ModelPoolManager] Refreshing model pool...');
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models');
      if (!response.ok) {
        throw new Error(`Failed to fetch models: HTTP ${response.status}`);
      }
      const data = (await response.json()) as { data?: OpenRouterModelMetadata[] };
      const rawModels: OpenRouterModelMetadata[] = data.data || [];

      const normalized: NormalizedModelCapabilities[] = [];
      const summaries: ModelCardSummary[] = [];

      for (const raw of rawModels) {
        const norm = CapabilityDetector.normalizeModel(raw);
        if (norm.is_free) {
          normalized.push(norm);
          summaries.push(ModelCardSummarizer.summarize(norm));
        }
      }

      const snapshotTs = Date.now();
      const insertStmt = db.prepare('INSERT INTO model_snapshots (snapshot_ts, models_json, card_summaries_json) VALUES (?, ?, ?)');
      insertStmt.run(
        snapshotTs,
        JSON.stringify(normalized),
        JSON.stringify(summaries)
      );

      currentFreeModels = normalized;
      currentCardSummaries = summaries;
      lastSnapshotTs = snapshotTs;
      console.log(`[ModelPoolManager] Refreshed successfully. Found ${normalized.length} free models. Saved snapshot at ${snapshotTs}.`);
    } catch (err) {
      console.warn('[ModelPoolManager] Network refresh failed. Falling back to SQLite snapshot cache...', err);
      
      // Load from database
      const selectStmt = db.prepare('SELECT snapshot_ts, models_json, card_summaries_json FROM model_snapshots ORDER BY snapshot_ts DESC LIMIT 1');
      const row = selectStmt.get() as { snapshot_ts: number; models_json: string; card_summaries_json: string } | undefined;

      if (row) {
        const snapshotAgeMs = Date.now() - row.snapshot_ts;
        if (snapshotAgeMs > MODEL_SNAPSHOT_TTL_MS) {
          console.warn(
            `[ModelPoolManager] Cached snapshot is stale (${snapshotAgeMs}ms old, ttl ${MODEL_SNAPSHOT_TTL_MS}ms). Keeping existing in-memory model pool.`
          );
          return;
        }

        lastSnapshotTs = row.snapshot_ts;
        currentFreeModels = JSON.parse(row.models_json);
        currentCardSummaries = JSON.parse(row.card_summaries_json);
        console.log(`[ModelPoolManager] Loaded ${currentFreeModels.length} models from cache snapshot.`);
      } else {
        console.error('[ModelPoolManager] No database snapshots found. Keeping existing in-memory model pool.');
      }
    }
  },

  getFreeModels(): NormalizedModelCapabilities[] {
    return currentFreeModels;
  },

  getCardSummaries(): ModelCardSummary[] {
    return currentCardSummaries;
  },

  getLastSnapshotTs(): number | null {
    return lastSnapshotTs;
  },

  getModelById(id: string): NormalizedModelCapabilities | null {
    return currentFreeModels.find(m => m.modelId === id) || null;
  },

  isModelAvailable(id: string): boolean {
    return currentFreeModels.some(m => m.modelId === id);
  }
};
