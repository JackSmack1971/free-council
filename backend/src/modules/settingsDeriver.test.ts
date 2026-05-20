import { test, describe } from 'node:test';
import assert from 'node:assert';
import { SettingsDeriver } from './settingsDeriver.js';
import { NormalizedModelCapabilities } from 'shared';

describe('SettingsDeriver Tests', () => {
  test('should return empty array when supported_parameters is empty', () => {
    const model: NormalizedModelCapabilities = {
      modelId: 'test-model',
      contextLength: 4096,
      pdf_input: false,
      image_input: false,
      tool_calling: false,
      structured_output: false,
      long_context: false,
      coding: false,
      reasoning: false,
      vision: false,
      is_free: true,
      is_provider_logged: false,
      supports_zdr: true,
      supported_parameters: []
    };

    const controls = SettingsDeriver.deriveControls(model);
    assert.strictEqual(controls.length, 0);
  });

  test('should only return controls for supported parameters', () => {
    const model: NormalizedModelCapabilities = {
      modelId: 'test-model',
      contextLength: 4096,
      pdf_input: false,
      image_input: false,
      tool_calling: false,
      structured_output: false,
      long_context: false,
      coding: false,
      reasoning: false,
      vision: false,
      is_free: true,
      is_provider_logged: false,
      supports_zdr: true,
      supported_parameters: ['temperature', 'max_tokens', 'unsupported_param']
    };

    const controls = SettingsDeriver.deriveControls(model);
    assert.strictEqual(controls.length, 2);
    assert.strictEqual(controls[0].paramName, 'temperature');
    assert.strictEqual(controls[0].controlType, 'slider');
    assert.strictEqual(controls[1].paramName, 'max_tokens');
    assert.strictEqual(controls[1].controlType, 'number');
  });
});
