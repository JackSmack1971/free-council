import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { ModelPoolManager } from '../modules/modelPoolManager.js';
import { SettingsDeriver } from '../modules/settingsDeriver.js';
import { PreflightGate } from '../modules/preflightGate.js';
import { ConversationStore } from '../modules/conversationStore.js';
import { TelemetryEngine } from '../modules/telemetryEngine.js';
import { dispatchSoloChat } from '../dispatch/soloDispatch.js';
import { dispatchCouncilChat } from '../dispatch/councilDispatch.js';
import { db } from '../db/connection.js';

export const apiRouter = Router();

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

interface SessionState {
  sessionId: string;
  modelId: string;
  mode: string;
}

const sessions = new Map<string, SessionState>();

// Middleware to check API key present
const requireApiKey = (req: Request, res: Response, next: () => void) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ') || auth.slice(7).trim().length === 0) {
    return res.status(401).json({ error: 'API key is missing' });
  }
  next();
};

// POST /session
apiRouter.post('/session', (req: Request, res: Response) => {
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
  const session: SessionState = { sessionId, modelId: activeModelId, mode };
  sessions.set(sessionId, session);

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
        ...(model.vision ? ['vision'] : [])
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
apiRouter.post('/dispatch', async (req: Request, res: Response) => {
  const { sessionId, messages, settings = {} } = req.body;

  if (!sessionId || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Missing sessionId or messages' });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const authHeader = req.headers.authorization || '';
  const apiKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (session.mode === 'council') {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let assistantResponse = '';

    await dispatchCouncilChat({
      sessionId,
      messages,
      runSettings: settings,
      apiKey,
      onChunk: (chunk) => {
        res.write(chunk);
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
              // Ignore
            }
          }
        }
      },
      onError: (err) => {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      },
      onComplete: () => {
        const updatedMessages = [
          ...messages,
          { role: 'assistant', content: assistantResponse }
        ];
        ConversationStore.saveConversation(sessionId, updatedMessages);
        res.end();
      }
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
      res.write(`data: {"error": ${JSON.stringify(err.message)}}\n\n`);
      res.end();
    },
    onComplete: () => {
      // Save transcript
      const updatedMessages = [
        ...messages,
        { role: 'assistant', content: assistantResponse }
      ];
      ConversationStore.saveConversation(sessionId, updatedMessages);
      res.end();
    }
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
      dailyLimit: 200,
      isEstimated: true,
      updatedAt
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to query quota usage' });
  }
});

// GET /session/:id/messages
apiRouter.get('/session/:id/messages', (req: Request, res: Response) => {
  const messages = ConversationStore.getConversation(req.params.id);
  if (!messages) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json({ messages });
});

// GET /sessions
apiRouter.get('/sessions', (req: Request, res: Response) => {
  try {
    const stmt = db.prepare('SELECT id, ts FROM conversations ORDER BY ts DESC');
    const rows = stmt.all() as { id: string; ts: number }[];
    res.json({ sessions: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to query sessions list' });
  }
});

// POST /session/:id/event
apiRouter.post('/session/:id/event', (req: Request, res: Response) => {
  const { eventType, apiCalls } = req.body;
  const sessionId = req.params.id;
  try {
    TelemetryEngine.record({
      session_id: sessionId,
      event_type: eventType,
      api_calls: apiCalls,
      ts: Date.now()
    });
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


