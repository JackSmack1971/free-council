import { NormalizedModelCapabilities, UIControlSpec } from 'shared';

const PARAM_SPECS: Record<string, Omit<UIControlSpec, 'paramName'>> = {
  temperature: {
    controlType: 'slider',
    label: 'Temperature',
    min: 0,
    max: 2,
    default: 1.0
  },
  top_p: {
    controlType: 'slider',
    label: 'Top P',
    min: 0,
    max: 1,
    default: 1.0
  },
  top_k: {
    controlType: 'number',
    label: 'Top K',
    min: 0,
    max: 100,
    default: 50
  },
  max_tokens: {
    controlType: 'number',
    label: 'Max Tokens',
    min: 1,
    max: 131072,
    default: 4096
  },
  frequency_penalty: {
    controlType: 'slider',
    label: 'Frequency Penalty',
    min: -2,
    max: 2,
    default: 0.0
  },
  presence_penalty: {
    controlType: 'slider',
    label: 'Presence Penalty',
    min: -2,
    max: 2,
    default: 0.0
  },
  repetition_penalty: {
    controlType: 'slider',
    label: 'Repetition Penalty',
    min: 0,
    max: 2,
    default: 1.0
  },
  seed: {
    controlType: 'number',
    label: 'Seed',
    min: 0,
    default: 42
  },
  reasoning: {
    controlType: 'toggle',
    label: 'Reasoning (Thinking)',
    default: true
  },
  include_reasoning: {
    controlType: 'toggle',
    label: 'Include Reasoning',
    default: true
  }
};

export const SettingsDeriver = {
  deriveControls(model: NormalizedModelCapabilities): UIControlSpec[] {
    const specs: UIControlSpec[] = [];
    const supported = model.supported_parameters || [];

    for (const param of supported) {
      const spec = PARAM_SPECS[param];
      if (spec) {
        specs.push({
          paramName: param,
          ...spec
        });
      }
    }

    return specs;
  }
};
