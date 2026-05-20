"use client";

import { useState, useEffect, useRef } from 'react';
import { localDB } from '../utils/db';
import { apiClient, ModelInfo, QuotaInfo } from '../utils/api';
import CouncilTrace from '../components/CouncilTrace';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  
  // Storage States
  const [apiKey, setApiKey] = useState<string>('');
  const [apiKeyStatus, setApiKeyStatus] = useState<'none' | 'validating' | 'valid' | 'invalid'>('none');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKey, setTempKey] = useState('');

  // Model & Session States
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [unavailableModels, setUnavailableModels] = useState<string[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [freeLockEnabled, setFreeLockEnabled] = useState<boolean>(true);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [sessionsList, setSessionsList] = useState<{ id: string; ts: number }[]>([]);
  
  // Settings Panel States
  const [showSettings, setShowSettings] = useState(false);
  const [modelSettings, setModelSettings] = useState<Record<string, number | boolean | string>>({});

  // Chat States
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string; trace?: any }[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWaitingFirstToken, setIsWaitingFirstToken] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [activeProgress, setActiveProgress] = useState<{ role: string; status: 'generating' | 'evaluating' | 'completed' }[]>([]);
  const [activeTrace, setActiveTrace] = useState<any>(null);
  const [acknowledgedModels, setAcknowledgedModels] = useState<string[]>([]);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [pendingPrivacyModel, setPendingPrivacyModel] = useState<string>('');
  const [chatError, setChatError] = useState<string | null>(null);

  // Routing Mode & Rollback States
  const [routingMode, setRoutingMode] = useState<'solo' | 'council'>('council');
  const [showRollbackBanner, setShowRollbackBanner] = useState(false);

  // Quota States
  const [quota, setQuota] = useState<QuotaInfo | null>(null);

  // Preview Telemetry State
  const previewLoggedSessionRef = useRef<string | null>(null);
  const lastUnsentMessagesRef = useRef<{ role: 'user' | 'assistant'; content: string; trace?: any }[]>([]);

  // Auto-scroll ref
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize and mount
  useEffect(() => {
    setMounted(true);
    initializeData();
  }, []);

  // Poll quota every 5 seconds
  useEffect(() => {
    if (!mounted) return;
    const interval = setInterval(fetchQuota, 5000);
    return () => clearInterval(interval);
  }, [mounted]);

  // Poll config every 10 seconds
  useEffect(() => {
    if (!mounted) return;
    const interval = setInterval(fetchConfig, 10000);
    return () => clearInterval(interval);
  }, [mounted, routingMode, activeSessionId]);

  // Load model-specific settings when model changes
  useEffect(() => {
    if (!selectedModelId) return;
    loadModelSettings(selectedModelId);
  }, [selectedModelId]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, isWaitingFirstToken]);

  // Telemetry log for preview when session or model changes
  useEffect(() => {
    if (activeSessionId && activeSessionId !== previewLoggedSessionRef.current) {
      apiClient.recordEvent(activeSessionId, 'quota_budget_previewed', 1);
      previewLoggedSessionRef.current = activeSessionId;
    }
  }, [activeSessionId]);

  const initializeData = async () => {
    // Load API Key
    const savedKey = await localDB.get<string>('api_key');
    if (savedKey) {
      setApiKey(savedKey);
      setTempKey(savedKey);
      validateAndLoad(savedKey);
    } else {
      setShowKeyModal(true);
    }

    // Load Free Lock State
    const savedLock = await localDB.get<boolean>('free_lock_enabled');
    setFreeLockEnabled(savedLock !== null ? savedLock : true);

    // Fetch Config
    await fetchConfig();

    // Fetch Quota
    fetchQuota();

    // Fetch Sessions List
    fetchSessions();
  };

  const fetchQuota = async () => {
    try {
      const quotaData = await apiClient.getQuota();
      setQuota(quotaData);
    } catch (e) {
      console.warn('Failed to load quota:', e);
    }
  };

  const fetchSessions = async () => {
    try {
      const list = await apiClient.getSessions();
      setSessionsList(list);
    } catch (e) {
      console.warn('Failed to load sessions list:', e);
    }
  };

  const validateAndLoad = async (key: string) => {
    setApiKeyStatus('validating');
    try {
      const data = await apiClient.getModels(key);
      setModels(data.models);
      setUnavailableModels(data.unavailableModels);
      setApiKeyStatus('valid');
      setShowKeyModal(false);

      // Restore active model
      const savedModel = await localDB.get<string>('selected_model_id');
      if (savedModel && data.models.some(m => m.modelId === savedModel)) {
        setSelectedModelId(savedModel);
      } else if (data.models.length > 0) {
        setSelectedModelId(data.models[0].modelId);
      }
    } catch (e) {
      setApiKeyStatus('invalid');
      setShowKeyModal(true);
    }
  };

  const saveApiKey = async () => {
    if (!tempKey.trim()) return;
    await localDB.set('api_key', tempKey.trim());
    setApiKey(tempKey.trim());
    validateAndLoad(tempKey.trim());
  };

  const handleFreeLockToggle = async (val: boolean) => {
    setFreeLockEnabled(val);
    await localDB.set('free_lock_enabled', val);
  };

  const handleModelChange = async (modelId: string) => {
    setSelectedModelId(modelId);
    await localDB.set('selected_model_id', modelId);
  };

  const loadModelSettings = async (modelId: string) => {
    const spec = models.find(m => m.modelId === modelId);
    if (!spec) return;

    const savedSettings = await localDB.get<Record<string, any>>(`settings_${modelId}`) || {};
    const initialized: Record<string, any> = {};

    spec.controls.forEach(ctrl => {
      initialized[ctrl.paramName] = savedSettings[ctrl.paramName] !== undefined
        ? savedSettings[ctrl.paramName]
        : ctrl.defaultValue;
    });

    setModelSettings(initialized);
  };

  const saveSetting = async (paramName: string, value: any) => {
    const updated = { ...modelSettings, [paramName]: value };
    setModelSettings(updated);
    if (selectedModelId) {
      await localDB.set(`settings_${selectedModelId}`, updated);
    }
  };

  const startNewChat = async () => {
    if (isStreaming) return;
    setMessages([]);
    setStreamingText('');
    setChatError(null);
    setActiveSessionId('');
    previewLoggedSessionRef.current = null;
  };

  const loadSession = async (sessionId: string) => {
    if (isStreaming) return;
    try {
      setActiveSessionId(sessionId);
      setChatError(null);
      setStreamingText('');
      const chatHistory = await apiClient.getSessionMessages(sessionId);
      setMessages(chatHistory);
    } catch (e: any) {
      setChatError(`Failed to load conversation: ${e.message}`);
    }
  };

  const fetchConfig = async () => {
    try {
      const configData = await apiClient.getConfig();
      const defaultMode = configData.default_mode || 'council';
      const demoted = configData.demoted_by_retention === 'true';
      
      setShowRollbackBanner(demoted);
      
      if (!activeSessionId) {
        setRoutingMode(defaultMode as 'solo' | 'council');
      } else if (demoted && routingMode === 'council') {
        setRoutingMode('solo');
      }
    } catch (e) {
      console.warn('Failed to load config:', e);
    }
  };

  const reEnableCouncilMode = async () => {
    try {
      const now = Date.now();
      await apiClient.updateConfig({
        default_mode: 'council',
        demoted_by_retention: false,
        council_reevaluated_after_ts: now
      });
      setShowRollbackBanner(false);
      setRoutingMode('council');
      if (activeSessionId) {
        startNewChat();
      }
    } catch (e) {
      console.error('Failed to re-enable Council Mode:', e);
    }
  };

  const submitPrompt = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputPrompt.trim() || isStreaming) return;

    setChatError(null);
    const userMsg = { role: 'user' as const, content: inputPrompt };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputPrompt('');
    lastUnsentMessagesRef.current = updatedMessages;

    setIsStreaming(true);
    setIsWaitingFirstToken(true);
    setStreamingText('');

    let currentSessionId = activeSessionId;

    let localTrace: any = null;

    try {
      // Create session on-demand if not already active
      if (!currentSessionId) {
        currentSessionId = await apiClient.createSession(selectedModelId, routingMode);
        setActiveSessionId(currentSessionId);
      }

      // Merge run settings + freeLockEnabled
      const settingsPayload = {
        ...modelSettings,
        freeLockEnabled,
        privacyDisclosureAcknowledged: acknowledgedModels.includes(selectedModelId) || acknowledgedModels.includes('council_acknowledged')
      };

      await apiClient.dispatchStream(
        currentSessionId,
        updatedMessages,
        settingsPayload,
        apiKey,
        (token) => {
          setIsWaitingFirstToken(false);
          setStreamingText(prev => prev + token);
        },
        (event) => {
          if (event.type === 'agent_progress') {
            setActiveProgress(prev => {
              const existing = prev.findIndex(p => p.role === event.role);
              if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = { role: event.role, status: event.status };
                return updated;
              } else {
                return [...prev, { role: event.role, status: event.status }];
              }
            });
          } else if (event.type === 'trace') {
            localTrace = event.trace;
            setActiveTrace(event.trace);
          }
        }
      );

      // Finished stream
      setMessages(prev => [...prev, { role: 'assistant', content: streamingText, trace: localTrace }]);
      setStreamingText('');
      setActiveProgress([]);
      setActiveTrace(null);
      setIsStreaming(false);

      // Update sessions list & quota metrics
      fetchSessions();
      fetchQuota();
    } catch (err: any) {
      console.error(err);
      if (err.message && err.message.includes('PRIVACY_DISCLOSURE_PENDING')) {
        setPendingPrivacyModel(selectedModelId || 'council_acknowledged');
        setShowPrivacyModal(true);
        setIsStreaming(false);
        setIsWaitingFirstToken(false);
        return;
      }
      setChatError(err.message || 'An error occurred during completion dispatch.');
      setIsStreaming(false);
      setIsWaitingFirstToken(false);
      setActiveProgress([]);
      setActiveTrace(null);
      fetchQuota();
    }
  };

  const dismissPrivacyModal = async () => {
    let currentSessionId = activeSessionId;
    if (!currentSessionId) return;

    try {
      // Record 'privacy_disclosure_pending' resolved to 'acknowledged'
      await apiClient.recordEvent(currentSessionId, 'privacy_disclosure_pending', 0, 'acknowledged');

      // Update list of acknowledged models
      const updatedAck = [...acknowledgedModels, pendingPrivacyModel];
      setAcknowledgedModels(updatedAck);
      setShowPrivacyModal(false);

      // Auto-retry dispatch
      setIsStreaming(true);
      setIsWaitingFirstToken(true);
      setStreamingText('');

      const settingsPayload = {
        ...modelSettings,
        freeLockEnabled,
        privacyDisclosureAcknowledged: true // Force true since we just acknowledged
      };

      let localTrace: any = null;

      await apiClient.dispatchStream(
        currentSessionId,
        lastUnsentMessagesRef.current,
        settingsPayload,
        apiKey,
        (token) => {
          setIsWaitingFirstToken(false);
          setStreamingText(prev => prev + token);
        },
        (event) => {
          if (event.type === 'agent_progress') {
            setActiveProgress(prev => {
              const existing = prev.findIndex(p => p.role === event.role);
              if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = { role: event.role, status: event.status };
                return updated;
              } else {
                return [...prev, { role: event.role, status: event.status }];
              }
            });
          } else if (event.type === 'trace') {
            localTrace = event.trace;
            setActiveTrace(event.trace);
          }
        }
      );

      // Finished stream
      setMessages(prev => [...prev, { role: 'assistant', content: streamingText, trace: localTrace }]);
      setStreamingText('');
      setActiveProgress([]);
      setActiveTrace(null);
      setIsStreaming(false);

      fetchSessions();
      fetchQuota();
    } catch (err: any) {
      console.error(err);
      setChatError(err.message || 'An error occurred during completion dispatch.');
      setIsStreaming(false);
      setIsWaitingFirstToken(false);
      setActiveProgress([]);
      setActiveTrace(null);
      fetchQuota();
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-neutral-400">Loading FreeCouncil...</span>
        </div>
      </div>
    );
  }

  const activeModel = models.find(m => m.modelId === selectedModelId);
  const isModelUnavailable = unavailableModels.includes(selectedModelId);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex font-sans overflow-hidden">
      
      {/* 1. Left Sidebar */}
      <aside className="w-64 border-r border-neutral-800 bg-neutral-900/50 flex flex-col justify-between shrink-0">
        <div className="flex flex-col flex-1 min-h-0">
          
          {/* Logo / Brand */}
          <div className="p-4 border-b border-neutral-800 flex items-center gap-2">
            <svg className="w-6 h-6 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span className="font-bold tracking-tight text-lg">FreeCouncil</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 font-medium">v1.0</span>
          </div>

          {/* New Chat Button */}
          <div className="p-4">
            <button
              onClick={startNewChat}
              disabled={isStreaming}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              New Chat
            </button>
          </div>

          {/* Conversation History List */}
          <div className="flex-1 overflow-y-auto px-2 space-y-1">
            <div className="px-3 py-1.5 text-xs font-semibold text-neutral-500 uppercase tracking-wider">History</div>
            {sessionsList.length === 0 ? (
              <div className="text-xs text-neutral-600 px-3 py-4">No recent sessions</div>
            ) : (
              sessionsList.map(s => (
                <button
                  key={s.id}
                  onClick={() => loadSession(s.id)}
                  disabled={isStreaming}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center gap-2 group ${
                    activeSessionId === s.id
                      ? 'bg-violet-500/10 text-violet-300 font-medium'
                      : 'hover:bg-neutral-800/60 text-neutral-400'
                  }`}
                >
                  <svg className="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="truncate flex-1">Chat - {new Date(s.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Sidebar Footer Controls */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-900/80 space-y-4">
          
          {/* Quota Meter */}
          {quota && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-neutral-400">Daily Quota</span>
                <span className={quota.usedToday >= quota.dailyLimit ? 'text-red-400 font-bold' : 'text-neutral-300'}>
                  {quota.usedToday} / {quota.dailyLimit} {quota.isEstimated && '(estimated)'}
                </span>
              </div>
              <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    quota.usedToday >= quota.dailyLimit
                      ? 'bg-red-500'
                      : quota.usedToday > quota.dailyLimit * 0.8
                      ? 'bg-amber-500'
                      : 'bg-violet-500'
                  }`}
                  style={{ width: `${Math.min(100, (quota.usedToday / quota.dailyLimit) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Free Lock Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-medium">Free-only Lock</span>
            <button
              onClick={() => handleFreeLockToggle(!freeLockEnabled)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                freeLockEnabled ? 'bg-violet-500' : 'bg-neutral-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  freeLockEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* API Key Configure Button */}
          <div className="pt-2">
            <button
              onClick={() => {
                setTempKey(apiKey);
                setShowKeyModal(true);
              }}
              className="w-full text-center py-1.5 rounded-lg border border-neutral-700 text-xs font-semibold text-neutral-300 hover:bg-neutral-800 transition-colors flex items-center justify-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              {apiKeyStatus === 'valid' ? 'API Key Saved' : 'Configure API Key'}
            </button>
          </div>

        </div>
      </aside>

      {/* 2. Main Content Window */}
      <main className="flex-1 flex flex-col bg-neutral-950 relative min-w-0">
        
        {/* Persistent Warning Banner when Free-only Lock is disabled */}
        {!freeLockEnabled && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-400 font-semibold flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Free-only lock is OFF — paid models may incur charges</span>
          </div>
        )}
        {/* Low-retention Rollback Banner */}
        {showRollbackBanner && (
          <div id="low-retention-banner" className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 text-xs text-amber-400 font-semibold flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0 animate-pulse text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Council routing has low retention — Solo Mode is now default.</span>
            </div>
            <button
              id="re-enable-council-btn"
              type="button"
              onClick={reEnableCouncilMode}
              className="px-3 py-1 rounded bg-amber-500 text-neutral-950 font-bold hover:bg-amber-400 active:scale-95 transition-all"
            >
              Re-enable Council Mode
            </button>
          </div>
        )}

        {/* Top Navigation Bar */}
        <header className="h-14 border-b border-neutral-800 flex items-center justify-between px-6 bg-neutral-900/20 backdrop-blur-md">
          
          {/* Model Selector and badges */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-500 font-medium uppercase tracking-wider">Model:</span>
            <div className="relative">
              <select
                value={selectedModelId}
                onChange={(e) => handleModelChange(e.target.value)}
                className="bg-neutral-800 hover:bg-neutral-700 text-neutral-100 text-sm font-semibold rounded-lg px-3 py-1.5 pr-8 border border-neutral-700 focus:outline-none appearance-none cursor-pointer"
              >
                {models.map(m => (
                  <option key={m.modelId} value={m.modelId}>
                    {m.modelId.split('/').pop()}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Mode Selection Segmented Control */}
            <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800 ml-2">
              <button
                type="button"
                id="mode-solo-btn"
                onClick={() => {
                  if (isStreaming) return;
                  setRoutingMode('solo');
                  if (activeSessionId) startNewChat();
                }}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  routingMode === 'solo'
                    ? 'bg-violet-600 text-white shadow'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Solo Mode
              </button>
              <button
                type="button"
                id="mode-council-btn"
                onClick={() => {
                  if (isStreaming) return;
                  setRoutingMode('council');
                  if (activeSessionId) startNewChat();
                }}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  routingMode === 'council'
                    ? 'bg-violet-600 text-white shadow'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Council Mode
              </button>
            </div>

            {/* Model capability badges */}
            {activeModel && (
              <div className="flex gap-1">
                {activeModel.capabilityFlags.map(cap => (
                  <span
                    key={cap}
                    className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                      cap === 'coding'
                        ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                        : cap === 'reasoning'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : cap === 'vision'
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        : 'bg-neutral-800 text-neutral-400'
                    }`}
                  >
                    {cap}
                  </span>
                ))}
                {activeModel.is_provider_logged && (
                  <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    provider-logged
                  </span>
                )}
                {activeModel.supports_zdr && (
                  <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    ZDR
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Toggle Settings Sidebar */}
          <div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors border ${
                showSettings
                  ? 'bg-neutral-800 border-neutral-700 text-neutral-100'
                  : 'hover:bg-neutral-800 border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>

        </header>

        {/* Model Unavailability Banner */}
        {isModelUnavailable && activeModel && (
          <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-6 py-2.5 text-xs text-yellow-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Previously selected model <strong>{activeModel.modelId.split('/').pop()}</strong> is no longer available in the active snapshot.</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-yellow-500/20 font-bold tracking-tight">Warning</span>
          </div>
        )}

        {/* Message Thread Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center text-violet-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-neutral-200">Start a local discussion</h2>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Choose a free coding or reasoning model from the pool at the top, configure your local parameters, and enjoy zero-cost local-first completions.
              </p>
            </div>
          ) : (
            messages.map((m, idx) => (
              <div key={idx} className={`flex gap-4 max-w-3xl ${m.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-semibold select-none ${
                  m.role === 'user' ? 'bg-violet-600 text-white' : 'bg-neutral-800 text-neutral-300'
                }`}>
                  {m.role === 'user' ? 'U' : 'A'}
                </div>
                <div className={`p-4 rounded-xl text-sm leading-relaxed max-w-full overflow-hidden ${
                  m.role === 'user' ? 'bg-violet-500/10 text-neutral-200' : 'bg-neutral-900/40 text-neutral-300 border border-neutral-800'
                }`}>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {m.role === 'assistant' && m.trace && (
                    <CouncilTrace trace={m.trace} />
                  )}
                </div>
              </div>
            ))
          )}

          {/* Streaming display */}
          {isStreaming && (
            <div className="flex gap-4 max-w-3xl">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-semibold bg-neutral-800 text-neutral-300 select-none">
                A
              </div>
              <div className="flex flex-col gap-2 w-full">
                <div className="p-4 rounded-xl text-sm leading-relaxed bg-neutral-900/40 text-neutral-300 border border-neutral-800 min-w-[80px]">
                  {isWaitingFirstToken ? (
                    <div className="flex items-center gap-1.5 py-1">
                      <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{streamingText}</p>
                  )}
                </div>

                {/* Render active progress if available */}
                {activeProgress.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {activeProgress.map((p, pIdx) => (
                      <span
                        key={pIdx}
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1.5 border ${
                          p.status === 'generating'
                            ? 'bg-blue-950/20 text-blue-400 border-blue-900/30'
                            : p.status === 'evaluating'
                            ? 'bg-amber-950/20 text-amber-400 border-amber-900/30'
                            : 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          p.status === 'generating'
                            ? 'bg-blue-400 animate-pulse'
                            : p.status === 'evaluating'
                            ? 'bg-amber-400 animate-spin border border-t-transparent'
                            : 'bg-emerald-400'
                        }`} />
                        {p.role}: {p.status}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Error Notification */}
        {chatError && (
          <div className="mx-6 mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 flex items-start gap-2.5">
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="space-y-1">
              <span className="font-bold">Dispatch Error:</span>
              <p>{chatError}</p>
              {chatError.includes('API key') && (
                <button
                  onClick={() => setShowKeyModal(true)}
                  className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors font-medium"
                >
                  Configure API Key
                </button>
              )}
            </div>
          </div>
        )}

        {/* Prompt Input Area */}
        <div className="p-6 border-t border-neutral-800 bg-neutral-900/10 backdrop-blur-md">
          <form onSubmit={submitPrompt} className="max-w-3xl mx-auto space-y-2">
            
            {/* Input fields and send button */}
            <div className="relative rounded-xl border border-neutral-850 bg-neutral-900/60 shadow-lg focus-within:border-violet-500/50 transition-colors overflow-hidden">
              <textarea
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submitPrompt();
                  }
                }}
                disabled={isStreaming}
                placeholder="Ask council..."
                rows={2}
                className="w-full bg-transparent border-0 text-sm placeholder-neutral-500 text-neutral-100 p-4 focus:ring-0 focus:outline-none resize-none disabled:opacity-50"
              />
              <div className="flex justify-between items-center px-4 py-3 bg-neutral-900/40 border-t border-neutral-850">
                
                {/* Budget Preview */}
                <div className="text-[11px] text-neutral-500 font-medium flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>This request will use 1 free API call(s)</span>
                </div>

                <button
                  type="submit"
                  disabled={isStreaming || !inputPrompt.trim()}
                  className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-colors disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <span>Send</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            </div>
          </form>
        </div>

      </main>

      {/* 3. Run Settings Panel (Right Drawer) */}
      {showSettings && (
        <aside className="w-80 border-l border-neutral-800 bg-neutral-900/40 backdrop-blur-md flex flex-col shrink-0">
          
          <div className="p-4 border-b border-neutral-800 flex justify-between items-center">
            <span className="font-bold tracking-tight text-sm text-neutral-200">Run Settings</span>
            <button
              onClick={() => setShowSettings(false)}
              className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            
            {activeModel ? (
              <div className="space-y-6">
                <div>
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">Model ID</span>
                  <span className="text-xs text-neutral-300 font-mono break-all bg-neutral-950 p-2 rounded border border-neutral-850 block">{activeModel.modelId}</span>
                </div>

                <div className="border-t border-neutral-800 pt-4 space-y-4">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block">Parameters</span>
                  
                  {activeModel.controls.length === 0 ? (
                    <span className="text-xs text-neutral-600 italic block">No configurable parameters for this model.</span>
                  ) : (
                    activeModel.controls.map(ctrl => {
                      const val = modelSettings[ctrl.paramName] !== undefined
                        ? modelSettings[ctrl.paramName]
                        : ctrl.defaultValue;

                      return (
                        <div key={ctrl.paramName} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-semibold text-neutral-300">{ctrl.label}</span>
                            <span className="text-xs font-mono text-violet-400 bg-violet-500/5 px-2 py-0.5 rounded border border-violet-500/10">
                              {typeof val === 'boolean' ? (val ? 'true' : 'false') : val}
                            </span>
                          </div>
                          
                          {ctrl.controlType === 'slider' && (
                            <div className="space-y-1">
                              <input
                                type="range"
                                min={ctrl.min ?? 0}
                                max={ctrl.max ?? 1}
                                step={ctrl.step ?? 0.1}
                                value={val as number}
                                onChange={(e) => saveSetting(ctrl.paramName, parseFloat(e.target.value))}
                                className="w-full accent-violet-500 cursor-pointer bg-neutral-800 rounded-lg appearance-none h-1"
                              />
                              <div className="flex justify-between text-[10px] text-neutral-600 font-mono">
                                <span>{ctrl.min}</span>
                                <span>{ctrl.max}</span>
                              </div>
                            </div>
                          )}

                          {ctrl.controlType === 'number' && (
                            <input
                              type="number"
                              min={ctrl.min}
                              max={ctrl.max}
                              step={ctrl.step}
                              value={val as number}
                              onChange={(e) => saveSetting(ctrl.paramName, parseInt(e.target.value, 10))}
                              className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-violet-500/50"
                            />
                          )}

                          {ctrl.controlType === 'toggle' && (
                            <button
                              onClick={() => saveSetting(ctrl.paramName, !val)}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                val ? 'bg-violet-500' : 'bg-neutral-800'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  val ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          )}

                          {ctrl.controlType === 'select' && (
                            <select
                              value={val as string}
                              onChange={(e) => saveSetting(ctrl.paramName, e.target.value)}
                              className="w-full bg-neutral-955 border border-neutral-800 rounded px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-violet-500/50"
                            >
                              {ctrl.options?.map((opt: any) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          )}

                          {ctrl.description && (
                            <p className="text-[10px] text-neutral-500 leading-normal">{ctrl.description}</p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <span className="text-xs text-neutral-500 italic block">No active model configuration details.</span>
            )}

          </div>

        </aside>
      )}

      {/* 4. API Key Configuration Modal Overlay */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-6">
            
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
                <svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                OpenRouter Integration
              </h2>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Paste your OpenRouter API Key to validate and load the latest catalog of free reasoning and coding models.
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block">API Key</label>
                <input
                  type="password"
                  value={tempKey}
                  onChange={(e) => setTempKey(e.target.value)}
                  placeholder="sk-or-v1-..."
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-violet-500/50 rounded-xl px-4 py-2.5 text-sm text-neutral-200 focus:outline-none"
                />
              </div>

              {apiKeyStatus === 'validating' && (
                <div className="text-xs text-violet-400 flex items-center gap-1.5 font-medium">
                  <div className="w-3.5 h-3.5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                  Validating credential key...
                </div>
              )}

              {apiKeyStatus === 'invalid' && (
                <div className="text-xs text-red-400 flex items-center gap-1 font-semibold">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Authentication check failed. Please verify key credentials.
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-2">
              {apiKey && (
                <button
                  type="button"
                  onClick={() => setShowKeyModal(false)}
                  className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-neutral-300 transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={saveApiKey}
                disabled={!tempKey.trim() || apiKeyStatus === 'validating'}
                className="px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-xs font-bold text-white transition-colors"
              >
                Validate & Save
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 5. Privacy & Logging Disclosure Modal */}
      {showPrivacyModal && (
        <div id="privacy-disclosure-modal" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-neutral-900 border border-amber-500/20 rounded-2xl max-w-md w-full p-6 shadow-[0_0_50px_rgba(245,158,11,0.1)] space-y-5 transform scale-100 transition-transform">
            
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500 shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="space-y-1">
                <h2 className="text-md font-bold text-neutral-100 uppercase tracking-wide">
                  Privacy Disclosure
                </h2>
                <p className="text-sm text-neutral-300 leading-relaxed font-medium">
                  This model may log prompts and completions per provider policy.
                </p>
              </div>
            </div>

            <div className="text-xs text-neutral-500 leading-relaxed bg-neutral-950/50 p-3 rounded-lg border border-neutral-800/50">
              By proceeding, you acknowledge that your inputs and outputs are processed subject to the model provider's standard policy terms. This warning is displayed once per session.
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-xs font-bold text-neutral-300 transition-colors"
              >
                Cancel
              </button>
              <button
                id="privacy-dismiss-btn"
                type="button"
                onClick={dismissPrivacyModal}
                className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition-all shadow-[0_2px_10px_rgba(245,158,11,0.2)] hover:shadow-[0_4px_15px_rgba(245,158,11,0.3)] active:scale-95"
              >
                Acknowledge & Proceed
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
