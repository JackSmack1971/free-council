import { NormalizedModelCapabilities, ModelCardSummary } from 'shared';

export const ModelCardSummarizer = {
  summarize(model: NormalizedModelCapabilities): ModelCardSummary {
    const domain: string[] = [];
    const taskSpecialization: string[] = [];
    const capabilityFlags: string[] = [];

    if (model.coding) {
      domain.push('coding');
      taskSpecialization.push('code generation');
      taskSpecialization.push('code completion');
    }
    if (model.reasoning) {
      domain.push('reasoning');
      taskSpecialization.push('multi-step reasoning');
      taskSpecialization.push('logical analysis');
    }
    if (model.vision) {
      domain.push('vision');
      taskSpecialization.push('image parsing');
      taskSpecialization.push('visual understanding');
    }

    if (model.long_context) {
      taskSpecialization.push('long-form synthesis');
    }
    if (model.tool_calling) {
      taskSpecialization.push('structured tool execution');
      capabilityFlags.push('tool_calling');
    }
    if (model.pdf_input) {
      capabilityFlags.push('pdf_input');
    }
    if (model.image_input) {
      capabilityFlags.push('image_input');
    }
    if (model.structured_output) {
      capabilityFlags.push('structured_output');
    }
    if (model.long_context) {
      capabilityFlags.push('long_context');
    }
    if (model.supports_zdr) {
      capabilityFlags.push('supports_zdr');
    }

    // Default domain if none matched
    if (domain.length === 0) {
      domain.push('general');
      taskSpecialization.push('general conversation');
    }

    return {
      modelId: model.modelId,
      domain,
      taskSpecialization,
      contextLength: model.contextLength,
      capabilityFlags
    };
  }
};
