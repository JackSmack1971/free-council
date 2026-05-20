import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { CapabilityDetector, OpenRouterModelMetadata } from './capabilityDetector.js';
import { ModelCardSummarizer } from './modelCardSummarizer.js';
import { ModelPoolManager } from './modelPoolManager.js';
import { runMigrations } from '../db/migrationRunner.js';
import { db } from '../db/connection.js';

describe('Model Capabilities & Management Tests', () => {
  before(() => {
    // Ensure tables exist
    runMigrations();
  });

  describe('CapabilityDetector.normalizeModel', () => {
    test('should normalize a free coding/reasoning model', () => {
      const rawModel: OpenRouterModelMetadata = {
        id: 'baidu/cobuddy:free',
        name: 'Baidu CoBuddy (free)',
        description: 'CoBuddy is optimized for coding tasks and agent workflows.',
        context_length: 131072,
        architecture: {
          modality: 'text->text',
          input_modalities: ['text'],
          output_modalities: ['text']
        },
        pricing: {
          prompt: '0',
          completion: '0'
        },
        supported_parameters: ['max_tokens', 'tools', 'stop']
      };

      const result = CapabilityDetector.normalizeModel(rawModel);

      assert.strictEqual(result.modelId, 'baidu/cobuddy:free');
      assert.strictEqual(result.is_free, true);
      assert.strictEqual(result.coding, true);
      assert.strictEqual(result.reasoning, false);
      assert.strictEqual(result.vision, false);
      assert.strictEqual(result.tool_calling, true);
      assert.strictEqual(result.structured_output, false);
      assert.strictEqual(result.long_context, true);
      assert.strictEqual(result.is_provider_logged, false);
      assert.strictEqual(result.supports_zdr, true);
    });

    test('should normalize a provider-logged model (Owl Alpha)', () => {
      const rawModel: OpenRouterModelMetadata = {
        id: 'openrouter/owl-alpha',
        name: 'Owl Alpha',
        description: 'Owl Alpha is designed for agentic workloads.',
        context_length: 1048756,
        architecture: {
          modality: 'text->text',
          input_modalities: ['text'],
          output_modalities: ['text']
        },
        pricing: {
          prompt: '0',
          completion: '0'
        },
        supported_parameters: ['tools', 'structured_outputs']
      };

      const result = CapabilityDetector.normalizeModel(rawModel);

      assert.strictEqual(result.modelId, 'openrouter/owl-alpha');
      assert.strictEqual(result.is_provider_logged, true);
      assert.strictEqual(result.supports_zdr, false);
      assert.strictEqual(result.tool_calling, true);
      assert.strictEqual(result.structured_output, true);
      assert.strictEqual(result.long_context, true);
    });

    test('should normalize a paid multimodal vision and reasoning model', () => {
      const rawModel: OpenRouterModelMetadata = {
        id: 'google/gemini-2.5-pro',
        name: 'Google: Gemini 2.5 Pro',
        description: 'Google multimodal foundation model with deep reasoning.',
        context_length: 2097152,
        architecture: {
          modality: 'text+image+file->text',
          input_modalities: ['text', 'image', 'file'],
          output_modalities: ['text']
        },
        pricing: {
          prompt: '0.00000125',
          completion: '0.000005'
        },
        supported_parameters: ['tools', 'response_format', 'reasoning']
      };

      const result = CapabilityDetector.normalizeModel(rawModel);

      assert.strictEqual(result.modelId, 'google/gemini-2.5-pro');
      assert.strictEqual(result.is_free, false);
      assert.strictEqual(result.vision, true);
      assert.strictEqual(result.pdf_input, true);
      assert.strictEqual(result.image_input, true);
      assert.strictEqual(result.reasoning, true);
      assert.strictEqual(result.coding, false);
      assert.strictEqual(result.structured_output, true);
    });

    test('should normalize owl-alpha model with pdf capability', () => {
      const rawModel: OpenRouterModelMetadata = {
        id: 'openrouter/owl-alpha',
        name: 'Owl Alpha',
        description: 'Owl Alpha is a long-context model designed for analysis.',
        context_length: 1048576,
        architecture: {
          modality: 'text->text',
          input_modalities: ['text'],
          output_modalities: ['text']
        },
        pricing: {
          prompt: '0',
          completion: '0'
        },
        supported_parameters: []
      };

      const result = CapabilityDetector.normalizeModel(rawModel);
      assert.strictEqual(result.pdf_input, true);
    });

    test('should normalize nemotron-nano vision-language model with image/vision capabilities', () => {
      const rawModel: OpenRouterModelMetadata = {
        id: 'nvidia/nemotron-nano-12b-v2-vl:free',
        name: 'NVIDIA: Nemotron Nano 12B VL (free)',
        description: 'A vision-language model for multimodal reasoning.',
        context_length: 8192,
        architecture: {
          modality: 'text+image->text',
          input_modalities: ['text', 'image'],
          output_modalities: ['text']
        },
        pricing: {
          prompt: '0',
          completion: '0'
        },
        supported_parameters: []
      };

      const result = CapabilityDetector.normalizeModel(rawModel);
      assert.strictEqual(result.image_input, true);
      assert.strictEqual(result.vision, true);
    });
  });

  describe('ModelCardSummarizer.summarize', () => {
    test('should generate a correct summary from normalized capabilities', () => {
      const normalized = CapabilityDetector.normalizeModel({
        id: 'google/gemini-3.5-flash',
        name: 'Google: Gemini 3.5 Flash',
        description: 'Multimodal model optimized for coding proficiency and parallel agentic execution.',
        context_length: 1048576,
        architecture: {
          modality: 'text+image+file->text',
          input_modalities: ['text', 'image', 'file'],
          output_modalities: ['text']
        },
        pricing: {
          prompt: '0',
          completion: '0'
        },
        supported_parameters: ['tools', 'structured_outputs']
      });

      const summary = ModelCardSummarizer.summarize(normalized);

      assert.strictEqual(summary.modelId, 'google/gemini-3.5-flash');
      assert.ok(summary.domain.includes('coding'));
      assert.ok(summary.domain.includes('vision'));
      assert.ok(summary.taskSpecialization.includes('code generation'));
      assert.ok(summary.taskSpecialization.includes('visual understanding'));
      assert.strictEqual(summary.contextLength, 1048576);
      assert.ok(summary.capabilityFlags.includes('tool_calling'));
      assert.ok(summary.capabilityFlags.includes('pdf_input'));
    });
  });

  describe('ModelPoolManager', () => {
    let originalFetch: typeof globalThis.fetch;

    before(() => {
      originalFetch = globalThis.fetch;
    });

    after(() => {
      globalThis.fetch = originalFetch;
    });

    test('should fallback to SQLite snapshot cache on fetch failure', async () => {
      // Seed db with a snapshot first
      const seedModels = [{ modelId: 'cached/free-model', is_free: true, coding: true, supported_parameters: [] }];
      const seedSummaries = [{ modelId: 'cached/free-model', domain: ['coding'], taskSpecialization: [], capabilityFlags: [] }];
      
      const insertStmt = db.prepare(`
        INSERT INTO model_snapshots (snapshot_ts, models_json, card_summaries_json)
        VALUES (?, ?, ?)
      `);
      insertStmt.run(Date.now(), JSON.stringify(seedModels), JSON.stringify(seedSummaries));

      // Mock fetch failure
      globalThis.fetch = async () => {
        return {
          ok: false,
          status: 500,
          json: async () => ({})
        } as any;
      };

      await ModelPoolManager.refresh();

      const freeModels = ModelPoolManager.getFreeModels();
      assert.ok(freeModels.length > 0);
      assert.strictEqual(freeModels[0].modelId, 'cached/free-model');
      assert.strictEqual(ModelPoolManager.isModelAvailable('cached/free-model'), true);
      assert.strictEqual(ModelPoolManager.isModelAvailable('nonexistent'), false);
    });
  });
});
