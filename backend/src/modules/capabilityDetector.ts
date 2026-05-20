import { NormalizedModelCapabilities } from 'shared';

export interface OpenRouterModelMetadata {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
    tokenizer?: string;
    instruct_type?: string | null;
  };
  pricing?: {
    prompt?: string | number;
    completion?: string | number;
    image?: string | number;
    request?: string | number;
    [key: string]: any;
  };
  supported_parameters?: string[];
}

export const LONG_CONTEXT_THRESHOLD = 32768; // 32k context

export const CapabilityDetector = {
  normalizeModel(raw: OpenRouterModelMetadata): NormalizedModelCapabilities {
    const modelId = raw.id || '';
    const name = raw.name || '';
    const description = raw.description || '';
    const contextLength = raw.context_length || 0;
    const inputModalities = raw.architecture?.input_modalities || [];
    const supportedParams = raw.supported_parameters || [];

    // pricing is free if both prompt and completion costs are 0
    const promptPrice = parseFloat(String(raw.pricing?.prompt || '0'));
    const completionPrice = parseFloat(String(raw.pricing?.completion || '0'));
    const is_free = promptPrice === 0 && completionPrice === 0;

    // is_provider_logged checks if the model is openrouter/owl-alpha
    // or if the description specifically flags provider logging
    const is_provider_logged = 
      modelId.toLowerCase() === 'openrouter/owl-alpha' || 
      description.toLowerCase().includes('prompts and completions may be logged');

    // supports_zdr is true if the model is not provider logged
    const supports_zdr = !is_provider_logged;

    // input capabilities
    const pdf_input = 
      inputModalities.includes('file') || 
      description.toLowerCase().includes('pdf') || 
      description.toLowerCase().includes('document input') ||
      description.toLowerCase().includes('document parsing') ||
      modelId.toLowerCase().includes('owl-alpha');

    const image_input = 
      inputModalities.includes('image') ||
      modelId.toLowerCase().includes('-vl') ||
      modelId.toLowerCase().includes('vision') ||
      modelId.toLowerCase().includes('multimodal') ||
      name.toLowerCase().includes('vision') ||
      name.toLowerCase().includes('multimodal') ||
      description.toLowerCase().includes('multimodal') ||
      description.toLowerCase().includes('vision');
    
    // features
    const tool_calling = supportedParams.includes('tools');
    const structured_output = 
      supportedParams.includes('structured_outputs') || 
      supportedParams.includes('response_format');

    const long_context = contextLength >= LONG_CONTEXT_THRESHOLD;

    // domain categorizations
    const vision = image_input || 
      inputModalities.includes('video') ||
      description.toLowerCase().includes('vision') ||
      description.toLowerCase().includes('multimodal');

    const coding = 
      modelId.toLowerCase().includes('code') ||
      modelId.toLowerCase().includes('coder') ||
      modelId.toLowerCase().includes('coding') ||
      modelId.toLowerCase().includes('cobuddy') ||
      name.toLowerCase().includes('code') ||
      name.toLowerCase().includes('coder') ||
      name.toLowerCase().includes('coding') ||
      description.toLowerCase().includes('programming') ||
      description.toLowerCase().includes('code generation') ||
      description.toLowerCase().includes('coding') ||
      description.toLowerCase().includes('coder') ||
      description.toLowerCase().includes('developer');

    const reasoning = 
      modelId.toLowerCase().includes('reasoning') ||
      modelId.toLowerCase().includes('r1') ||
      modelId.toLowerCase().includes('-o1') ||
      modelId.toLowerCase().includes('o1-') ||
      modelId.toLowerCase().includes('o3') ||
      supportedParams.includes('reasoning') ||
      description.toLowerCase().includes('reasoning') ||
      description.toLowerCase().includes('deep reasoning') ||
      description.toLowerCase().includes('thinking');

    return {
      modelId,
      contextLength,
      pdf_input,
      image_input,
      tool_calling,
      structured_output,
      long_context,
      coding,
      reasoning,
      vision,
      is_free,
      is_provider_logged,
      supports_zdr,
      supported_parameters: supportedParams
    };
  }
};
