import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { ModelPoolManager } from '../modules/modelPoolManager.js';
import { SettingsDeriver } from '../modules/settingsDeriver.js';
import { PreflightGate } from '../modules/preflightGate.js';
import { ConversationStore } from '../modules/conversationStore.js';
import { TelemetryEngine } from '../modules/telemetryEngine.js';
import { clearSessionCache } from '../agents/AgentOrchestrator.js';
import { dispatchSoloChat } from '../dispatch/soloDispatch.js';
import { dispatchCouncilChat } from '../dispatch/councilDispatch.js';
import { db } from '../db/connection.js';
import { getDailyApiQuotaLimit } from '../config/dailyQuota.js';
import { SessionStore } from '../modules/sessionStore.js';

// Lightweight JSON schema validation (subset — validates type, required, properties)
function validateJsonSchema(data: any, schema: any): Array<{ path: string; message: string }> {
  const errors: Array<{ path: string; message: string }> = [];

  function validate(value: any, schemaNode: any, path: string) {
    if (!schemaNode || typeof schemaNode !== 'object') return;

    if (schemaNode.type) {
      const typeMap: Record<string, string> = {
        string: 'string', number: 'number', integer: 'number',
        boolean: 'boolean', array: 'object', object: 'object', null: 'object'
      };
      const expectedJs = typeMap[schemaNode.type] || schemaNode.type;
      const actualType = Array.isArray(value) ? 'array' : typeof value;

      if (schemaNode.type === 'array' && !Array.isArray(value)) {
        errors.push({ path, message: `Expected array, got ${actualType}` });
      } else if (schemaNode.type !== 'array' && schemaNode.type !== 'null' && typeof value !== expectedJs) {
        errors.push({ path, message: `Expected ${schemaNode.type}, got ${typeof value}` });
      }
    }

    if (schemaNode.required && Array.isArray(schemaNode.required) && typeof value === 'object' && value !== null) {
      for (const key of schemaNode.required) {
        if (!(key in value)) {
          errors.push({ path: `${path}.${key}`, message: `Required property '${key}' is missing` });
        }
      }
    }

    if (schemaNode.properties && typeof value === 'object' && value !== null && !Array.isArray(value)) {
      for (const [key, propSchema] of Object.entries(schemaNode.properties)) {
        if (key in value) {
          validate(value[key], propSchema, `${path}.${key}`);
        }
      }
    }

    if (schemaNode.items && Array.isArray(value)) {
      value.forEach((item: any, i: number) => validate(item, schemaNode.items, `${path}[${i}]`));
    }
  }

  validate(data, schema, '$');
  return errors;
}

export const apiRouter = Router();
const createSessionRateLimiter = createRateLimitMiddleware({
  scope: 'api-session',
  windowMs: 60 * 60 * 1000,
  maxRequests: 20
});
const dispatchRateLimiter = createRateLimitMiddleware({
  scope: 'api-dispatch',
  windowMs: 60 * 1000,
  maxRequests: 10
});

const DEFAULT_MODELS = [
  'inclusionai/ring-2.6-1t:free',
  'openrouter/free',
  'openrouter/owl-alpha',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'qwen/qwen3-coder:free',
  'poolside/laguna-m.1:free',
  'openai/gpt-oss-120b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'arcee-ai/trinity-large-thinking:free',
  'liquid/lfm-2.5-1.2b-instruct:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'nvidia/nemotron-nano-12b-v2-vl:free'
];

function finalizeDispatchSession(sessionId: string): void {
  clearSessionCache(sessionId);
  TelemetryEngine.clearSessionState(sessionId);
}

function writeSseErrorFrame(res: Response, message: string, partial: boolean): void {
  if (res.writableEnded || res.destroyed) {
    return;
  }
  res.write(`data: ${JSON.stringify({ type: 'error', message, partial })}\n\n`);
}

// Middleware to check API key present
const requireApiKey = (req: Request, res: Response, next: () => void) => {
  if (!extractBearerToken(req.headers.authorization)) {
    return res.status(401).json({ error: 'API key is missing' });
  }
  next();
};

function requireOwnedSession(req: Request, res: Response, sessionId: string): SessionState | null {
  const apiKey = extractBearerToken(req.headers.authorization);
  if (!apiKey) {
    res.status(401).json({ error: 'API key is missing' });
    return null;
  }

  const session = SessionRegistry.getSession(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return null;
  }

  if (!SessionRegistry.isOwnedBy(sessionId, apiKey)) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }

  return session;
}

// POST /session
apiRouter.post('/session', requireApiKey, (req: Request, res: Response) => {
  const { modelId, mode } = req.body;
  if (!mode || (mode !== 'solo' && mode !== 'council')) {
    return res.status(400).json({ error: 'Invalid mode. Supported modes: solo, council.' });
  }

  let activeModelId = modelId;
  if (mode === 'solo') {
    if (!modelId) {
      return res.status(400).json({ error: 'modelId is required for solo mode.' });
    }
    // Validate modelId exists in current catalog snapshot
    const freeModels = ModelPoolManager.getFreeModels();
    const exists = freeModels.some(m => m.modelId === modelId);
    if (!exists) {
      return res.status(400).json({ error: `Unknown or unavailable model: ${modelId}` });
    }
  } else {
    // Council Mode
    if (!activeModelId) {
      activeModelId = 'openrouter/free'; // Default meta-LLM
    } else {
      const freeModels = ModelPoolManager.getFreeModels();
      const exists = freeModels.some(m => m.modelId === activeModelId);
      if (!exists) {
        return res.status(400).json({ error: `Unknown or unavailable model: ${activeModelId}` });
      }
    }
  }

  const sessionId = crypto.randomUUID();
  SessionStore.createSession(sessionId, activeModelId, mode);

  res.status(201).json({
    sessionId,
    modelId: activeModelId,
    mode
  });
});

// GET /models
apiRouter.get('/models', requireApiKey, (req: Request, res: Response) => {
  const freeModels = ModelPoolManager.getFreeModels();
  const snapshotTs = ModelPoolManager.getLastSnapshotTs() || Date.now();

  // Enriched models list
  const enrichedModels = freeModels.map(model => {
    return {
      modelId: model.modelId,
      is_free: model.is_free,
      is_provider_logged: model.is_provider_logged,
      supports_zdr: model.supports_zdr,
      contextLength: model.contextLength,
      capabilityFlags: [
        ...(model.coding ? ['coding'] : []),
        ...(model.reasoning ? ['reasoning'] : []),
        ...(model.vision ? ['vision'] : []),
        ...(model.pdf_input ? ['pdf_input'] : []),
        ...(model.image_input ? ['image_input'] : []),
        ...(model.structured_output ? ['structured_output'] : [])
      ],
      controls: SettingsDeriver.deriveControls(model)
    };
  });

  // Calculate unavailable default models
  const activeIds = new Set(freeModels.map(m => m.modelId));
  const unavailableModels = DEFAULT_MODELS.filter(id => !activeIds.has(id));

  res.json({
    models: enrichedModels,
    snapshotTs,
    unavailableModels
  });
});

// POST /dispatch
apiRouter.post('/dispatch', dispatchRateLimiter, async (req: Request, res: Response) => {
  const { sessionId, messages, settings = {} } = req.body;

  if (!sessionId || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Missing sessionId or messages' });
  }

  const session = SessionStore.getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  SessionStore.touchSession(sessionId);

  const apiKey = extractBearerToken(req.headers.authorization) ?? '';

  // Detect routing/system mode from request body
  const routingMode = (settings.routingMode || 'adaptive').toLowerCase();
  const systemMode = (settings.systemMode || session.mode || 'council').toLowerCase();

  // Council mode: when session is council AND not manual routing AND not overridden to solo
  const useCouncil = systemMode === 'council' && routingMode !== 'manual';
  const disconnectController = new AbortController();
  let streamClosed = false;
  let sessionFinalized = false;

  const finalizeSessionOnce = () => {
    if (sessionFinalized) {
      return;
    }
    sessionFinalized = true;
    finalizeDispatchSession(sessionId);
  };

  const markClosed = () => {
    streamClosed = true;
    disconnectController.abort();
    finalizeSessionOnce();
  };

  req.on('aborted', markClosed);
  res.on('close', markClosed);

  if (useCouncil) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let assistantResponse = '';
    let traceMetadata: any = null;
    let hasStreamOutput = false;

    await dispatchCouncilChat({
      sessionId,
      messages,
      runSettings: { ...settings, routingMode, manualModelId: session.modelId },
      apiKey,
      onChunk: (chunk) => {
        if (streamClosed || res.writableEnded || res.destroyed) {
          return;
        }
        hasStreamOutput = true;
        res.write(chunk);
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.type === 'trace') {
                traceMetadata = parsed.trace;
              } else {
                const content = parsed.choices?.[0]?.delta?.content || '';
                assistantResponse += content;
              }
            } catch (e) {
              // Ignore
            }
          }
        }
      },
      onError: (err) => {
        if (streamClosed) {
          return;
        }
        finalizeSessionOnce();
        writeSseErrorFrame(res, err.message, hasStreamOutput);
        if (!res.writableEnded && !res.destroyed) {
          res.end();
        }
      },
      onComplete: () => {
        if (streamClosed) {
          return;
        }
        finalizeSessionOnce();
        const updatedMessages = [
          ...messages,
          {
            role: 'assistant',
            content: assistantResponse,
            ...(traceMetadata ? { trace: traceMetadata } : {})
          }
        ];
        ConversationStore.saveConversation(sessionId, updatedMessages);
        if (!res.writableEnded && !res.destroyed) {
          res.end();
        }
      },
      abortSignal: disconnectController.signal
    });
    return;
  }

  // Get current model metadata
  const freeModels = ModelPoolManager.getFreeModels();
  const modelMetadata = freeModels.find(m => m.modelId === session.modelId);

  const isFreeModel = modelMetadata ? modelMetadata.is_free : false;
  const isProviderLogged = modelMetadata ? modelMetadata.is_provider_logged : false;
  const modelSupportsZdr = modelMetadata ? modelMetadata.supports_zdr : false;

  const preflightCtx = {
    modelId: session.modelId,
    isProviderLogged,
    isFreeModel,
    apiKeyPresent: apiKey.length > 0,
    freeLockEnabled: settings.freeLockEnabled !== false,
    activeAgentCount: 1,
    requestedApiCalls: 1,
    promptClass: 'simple' as const,
    privacyDisclosureAcknowledged: !!settings.privacyDisclosureAcknowledged,
    zdrRequired: !!settings.zdrRequired,
    modelSupportsZdr,
    containsUpload: !!settings.containsUpload,
    uploadDisclosureAcknowledged: !!settings.uploadDisclosureAcknowledged,
    sessionId
  };

  const gateResult = PreflightGate.check(preflightCtx);
  let activeModelId = session.modelId;

  if (!gateResult.allowed) {
    if (gateResult.violation === 'FREE_LOCK_VIOLATION' && gateResult.reassignedModelId) {
      activeModelId = gateResult.reassignedModelId;
    } else if (gateResult.violation === 'API_KEY_MISSING') {
      return res.status(401).json({ error: 'API key is missing', violationType: 'API_KEY_MISSING' });
    } else {
      return res.status(400).json({ error: `Preflight check failed: ${gateResult.violation}`, violationType: gateResult.violation });
    }
  }

  // Pre-dispatch preview header
  res.setHeader('X-Planned-Api-Calls', '1');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let assistantResponse = '';
  let hasStreamOutput = false;

  await dispatchSoloChat({
    sessionId,
    modelId: activeModelId,
    messages,
    runSettings: settings,
    apiKey,
    freeLockEnabled: settings.freeLockEnabled !== false,
    privacyDisclosureAcknowledged: !!settings.privacyDisclosureAcknowledged,
    zdrRequired: !!settings.zdrRequired,
    uploadDisclosureAcknowledged: !!settings.uploadDisclosureAcknowledged,
    containsUpload: !!settings.containsUpload,
    onChunk: (chunk) => {
      if (streamClosed || res.writableEnded || res.destroyed) {
        return;
      }
      hasStreamOutput = hasStreamOutput || chunk.length > 0;
      res.write(chunk);
      // Parse token from chunk to accumulate response
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim();
          if (dataStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(dataStr);
            const content = parsed.choices?.[0]?.delta?.content || '';
            assistantResponse += content;
          } catch (e) {
            // Ignored parsing errors
          }
        }
      }
    },
    onError: (err) => {
      if (streamClosed) {
        return;
      }
      finalizeSessionOnce();
      writeSseErrorFrame(res, err.message, hasStreamOutput);
      if (!res.writableEnded && !res.destroyed) {
        res.end();
      }
    },
    onComplete: () => {
      if (streamClosed) {
        return;
      }
      finalizeSessionOnce();
      // Save transcript
      const updatedMessages = [
        ...messages,
        { role: 'assistant', content: assistantResponse }
      ];
      ConversationStore.saveConversation(sessionId, updatedMessages);
      if (!res.writableEnded && !res.destroyed) {
        res.end();
      }
    },
    abortSignal: disconnectController.signal
  });
});

// GET /quota
apiRouter.get('/quota', (req: Request, res: Response) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const tsLimit = startOfDay.getTime();

    // Query SUM(api_calls)
    const quotaStmt = db.prepare('SELECT SUM(api_calls) as total FROM session_events WHERE ts >= ?');
    const quotaRow = quotaStmt.get(tsLimit) as { total: number | null };
    const usedToday = quotaRow?.total || 0;

    // Query max timestamp
    const timeStmt = db.prepare('SELECT MAX(ts) as maxTs FROM session_events');
    const timeRow = timeStmt.get() as { maxTs: number | null };
    const updatedAt = timeRow?.maxTs || Date.now();

    res.json({
      usedToday,
      dailyLimit: getDailyApiQuotaLimit(),
      isEstimated: true,
      updatedAt
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to query quota usage' });
  }
});

// GET /session/:id/messages
apiRouter.get('/session/:id/messages', (req: Request, res: Response) => {
  if (!requireOwnedSession(req, res, req.params.id)) return;

  const messages = ConversationStore.getConversation(req.params.id);
  if (!messages) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json({ messages });
});

// GET /sessions
apiRouter.get('/sessions', requireApiKey, (req: Request, res: Response) => {
  try {
    const apiKey = extractBearerToken(req.headers.authorization);
    if (!apiKey) {
      return res.status(401).json({ error: 'API key is missing' });
    }

    const ownedSessionIds = new Set(SessionRegistry.listOwnedSessionIds(apiKey));
    const stmt = db.prepare('SELECT id, ts FROM conversations ORDER BY ts DESC');
    const rows = stmt.all() as { id: string; ts: number }[];
    res.json({
      sessions: rows.filter((row) => ownedSessionIds.has(row.id))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to query sessions list' });
  }
});

// PATCH /session/:id/revert — abort council session and record reverted_to_solo
apiRouter.patch('/session/:id/revert', (req: Request, res: Response) => {
  const sessionId = req.params.id;
  if (!sessionId) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const session = SessionStore.getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    TelemetryEngine.record({
      session_id: sessionId,
      event_type: 'reverted_to_solo',
      api_calls: 0,
      ts: Date.now()
    });
    SessionStore.updateSessionMode(sessionId, 'solo');
    return res.json({ success: true, sessionId });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to record revert event' });
  }
});

// POST /session/:id/event
apiRouter.post('/session/:id/event', (req: Request, res: Response) => {
  const { eventType, apiCalls, synthesisRationale } = req.body;
  const sessionId = req.params.id;
  if (!SessionStore.getSession(sessionId)) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    TelemetryEngine.record({
      session_id: sessionId,
      event_type: eventType,
      api_calls: apiCalls,
      synthesis_rationale: synthesisRationale,
      ts: Date.now()
    });
    SessionStore.touchSession(sessionId);
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record event' });
  }
});

// GET /config
apiRouter.get('/config', (req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT key, value FROM app_config').all() as { key: string; value: string }[];
    const configObj: Record<string, string> = {};
    for (const row of rows) {
      configObj[row.key] = row.value;
    }
    res.json(configObj);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve configuration: ' + err.message });
  }
});

// POST /validate-schema — JSON schema validation service (#59)
apiRouter.post('/validate-schema', (req: Request, res: Response) => {
  const { responseText, schema } = req.body;

  if (!responseText) {
    return res.status(400).json({ errors: [{ path: '$', message: 'responseText is required' }] });
  }

  let parsedData: any;
  try {
    parsedData = JSON.parse(responseText);
  } catch (parseErr) {
    return res.json({ errors: [{ path: '$', message: 'Response is not valid JSON' }], valid: false });
  }

  if (!schema || typeof schema !== 'object') {
    // No schema provided — just verify it's valid JSON
    return res.json({ errors: [], valid: true, parsed: parsedData });
  }

  const errors = validateJsonSchema(parsedData, schema);
  res.json({ errors, valid: errors.length === 0, parsed: errors.length === 0 ? parsedData : undefined });
});

// GET /model-performance — S score history for cross-session comparison (#85)
apiRouter.get('/model-performance', (req: Request, res: Response) => {
  const limit = parseInt(String(req.query.limit || '50'), 10);
  const results = TelemetryEngine.queryModelPerformance(limit);
  res.json(results);
});

// GET /retention-rate — council retention rate diagnostic
apiRouter.get('/retention-rate', (req: Request, res: Response) => {
  const windowSeconds = parseInt(String(req.query.window || '7200'), 10);
  const rate = TelemetryEngine.queryCouncilRetentionRate(windowSeconds);
  res.json({ councilRetentionRate: rate, windowSeconds });
});

// POST /config
apiRouter.post('/config', (req: Request, res: Response) => {
  const { default_mode, council_reevaluated_after_ts, demoted_by_retention } = req.body;
  try {
    if (default_mode !== undefined) {
      db.prepare("INSERT OR REPLACE INTO app_config (key, value) VALUES ('default_mode', ?)").run(default_mode);
    }
    if (council_reevaluated_after_ts !== undefined) {
      db.prepare("INSERT OR REPLACE INTO app_config (key, value) VALUES ('council_reevaluated_after_ts', ?)").run(String(council_reevaluated_after_ts));
    }
    if (demoted_by_retention !== undefined) {
      db.prepare("INSERT OR REPLACE INTO app_config (key, value) VALUES ('demoted_by_retention', ?)").run(String(demoted_by_retention));
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update configuration: ' + err.message });
  }
});


