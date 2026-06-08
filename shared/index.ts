export interface NormalizedModelCapabilities {
  modelId:              string;
  contextLength:        number;
  pdf_input:            boolean;
  image_input:          boolean;
  tool_calling:         boolean;
  structured_output:    boolean;
  long_context:         boolean;
  coding:               boolean;
  reasoning:            boolean;
  vision:               boolean;
  is_free:              boolean;
  is_provider_logged:   boolean;
  supports_zdr:         boolean;
  supported_parameters: string[];
}

export interface ModelCardSummary {
  modelId:              string;
  domain:               string[];       // e.g. ["coding", "reasoning", "vision"]
  taskSpecialization:   string[];       // e.g. ["code generation", "long-form analysis"]
  contextLength:        number;
  capabilityFlags:      string[];       // active flags from NormalizedModelCapabilities
}

export interface UIControlSpec {
  paramName:    string;    // e.g. "temperature", "top_p", "max_tokens"
  controlType:  'slider' | 'number' | 'toggle' | 'select';
  label:        string;
  min?:         number;
  max?:         number;
  default?:     number | boolean | string;
  options?:     string[];  // for select controls
}

export interface SessionEvent {
  id?:                 number;
  session_id:           string;
  event_type:           string;
  agent_count?:          number;
  api_calls?:            number;
  edge_matrix_json?:     string;
  layer_count?:          number;
  proposer_models_json?: string;
  aggregation_calls?:    number;
  synthesis_rationale?:  string;
  synthesis_quality?:    number;
  ts:                   number;
}

export interface AgentAssignment {
  role: string;
  modelId: string;
}

export interface AgentPlan {
  agents: AgentAssignment[];
  totalApiCalls: number;
  samplingRationale: string;
  executionMode: 'goa_lite' | 'moa_lite' | 'goa_moa_hybrid' | 'solo';
  moaConfig?: {
    layers: number;
    proposersPerLayer: number;
    aggregatorModelId: string;
  };
  reasoningEffort?: 'Fast' | 'Balanced' | 'Deep' | 'Adaptive';
}

export interface AgentResult {
  role: string;
  modelId: string;
  response: string;
  latency?: number;
  error?: string;
  isPrimary?: boolean;
  sScore?: number;
  status?: 'generating' | 'evaluating' | 'completed' | 'failed';
  usedFallback?: boolean;
  fallbackReason?: string;
  fromCache?: boolean;
}

export interface PreflightContext {
  modelId:                       string;
  isProviderLogged:              boolean;
  isFreeModel:                   boolean;
  apiKeyPresent:                 boolean;
  freeLockEnabled:               boolean;
  activeAgentCount:              number;
  requestedApiCalls:             number;
  promptClass:                   'simple' | 'non_trivial';
  privacyDisclosureAcknowledged: boolean;
  zdrRequired:                   boolean;
  modelSupportsZdr:              boolean;
  containsUpload:                boolean;
  uploadDisclosureAcknowledged:  boolean;
  sessionId:                     string;
  budgetEscalated?:              boolean;
  aggregatorModelId?:            string;
  proposerModelIds?:             string[];
  structuredOutputRequested?:    boolean;
  modelSupportsStructuredOutput?: boolean;
}

export type PolicyViolation =
  | 'FREE_LOCK_VIOLATION'
  | 'AGENT_CAP_VIOLATION'
  | 'API_KEY_MISSING'
  | 'BUDGET_VIOLATION'
  | 'PRIVACY_DISCLOSURE_PENDING'
  | 'ZDR_REQUIRED_UNAVAILABLE'
  | 'UPLOAD_DISCLOSURE_PENDING'
  | 'AGGREGATOR_ROLE_CONFLICT'
  | 'STRUCTURED_OUTPUT_UNAVAILABLE';

export interface GateResult {
  allowed: boolean;
  violation?: PolicyViolation;
  reassignedModelId?: string;
}
