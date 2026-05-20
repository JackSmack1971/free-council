import { useState } from 'react';

interface TraceAgent {
  role: string;
  modelId: string;
  sScore: number;
  isPrimary: boolean;
  usedFallback?: boolean;
  fallbackReason?: string;
}

interface TraceInfo {
  agents: TraceAgent[];
  samplingRationale: string;
  totalApiCalls: number;
  edgeMatrix?: Record<string, Record<string, number>>;
  executionMode?: string;
  moaConfig?: { aggregatorModelId?: string; layers?: number; proposersPerLayer?: number };
  synthesisRationale?: string;
}

interface CouncilTraceProps {
  trace: TraceInfo;
  onSwitchMode?: (mode: 'solo' | 'council') => void;
}

export default function CouncilTrace({ trace, onSwitchMode }: CouncilTraceProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const isMoA = trace.executionMode === 'goa_moa_hybrid';

  const getCapabilities = (modelId: string): string[] => {
    const lower = modelId.toLowerCase();
    const caps: string[] = [];
    if (lower.includes('llama') || lower.includes('qwen') || lower.includes('mistral')) {
      caps.push('reasoning');
    }
    if (lower.includes('coder') || lower.includes('code') || lower.includes('deepseek')) {
      caps.push('coding');
    }
    if (caps.length === 0) caps.push('general');
    return caps;
  };

  return (
    <div className="mt-3 border border-neutral-800 rounded-xl bg-neutral-900/30 overflow-hidden transition-all duration-300">

      {/* Header / Collapse Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/30 transition-all select-none"
      >
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span>Council Mode Execution Trace</span>
          {isMoA ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20">
              MoA Hybrid
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 font-medium border border-violet-500/20">
              {trace.agents?.length || 0} Agents
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-neutral-500 font-mono">{trace.totalApiCalls} API Calls</span>
          <svg
            className={`w-4 h-4 text-neutral-500 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Collapsible Content */}
      {isOpen && (
        <div className="border-t border-neutral-850 p-4 space-y-4 bg-neutral-950/40 text-xs">

          {/* MoA-specific section */}
          {isMoA && (
            <div className="space-y-3">
              {/* MoA refinement header */}
              <div className="flex items-center gap-2 bg-emerald-950/10 border border-emerald-900/30 rounded-lg px-3 py-2">
                <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="text-emerald-400 font-semibold">
                  MoA refinement ({trace.totalApiCalls} calls)
                </span>
              </div>

              {/* Proposer agents */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Proposer Agents</span>
                <div className="grid gap-2 sm:grid-cols-1 md:grid-cols-2">
                  {trace.agents?.filter(a => a.role !== 'Aggregator').map((agent, i) => (
                    <div key={i} className="p-2.5 rounded-lg border border-neutral-800 bg-neutral-900/30 flex items-start justify-between gap-2">
                      <div>
                        <span className="font-semibold text-neutral-200 block">{agent.role}</span>
                        <span className="text-[10px] text-neutral-500 font-mono">{agent.modelId.split('/').pop()}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {getCapabilities(agent.modelId).map(cap => (
                          <span key={cap} className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-bold uppercase">
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Aggregator model */}
              {trace.moaConfig?.aggregatorModelId && (
                <div className="flex items-center gap-2 bg-violet-950/10 border border-violet-900/30 rounded-lg px-3 py-2">
                  <svg className="w-3.5 h-3.5 text-violet-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  <div>
                    <span className="text-neutral-500 text-[10px] uppercase tracking-wider">Aggregator</span>
                    <span className="text-violet-300 font-mono text-[10px] ml-2">{trace.moaConfig.aggregatorModelId.split('/').pop()}</span>
                  </div>
                </div>
              )}

              {/* Synthesis rationale */}
              <div className="space-y-1 bg-neutral-900/50 p-3 rounded-lg border border-neutral-850">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Synthesis Rationale</span>
                <p className="text-neutral-300 leading-relaxed italic">
                  "{trace.synthesisRationale || '—'}"
                </p>
              </div>

              {/* Mode switch suggestion */}
              {onSwitchMode && (
                <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                  <span>Switch for next session:</span>
                  <button
                    onClick={() => onSwitchMode('solo')}
                    className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition-colors font-semibold"
                  >
                    Solo
                  </button>
                  <button
                    onClick={() => onSwitchMode('council')}
                    className="px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 transition-colors font-semibold"
                  >
                    GoA-lite
                  </button>
                </div>
              )}

              {/* Expandable details section */}
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-[10px] text-neutral-500 hover:text-neutral-300 flex items-center gap-1 transition-colors"
              >
                <svg className={`w-3 h-3 transform transition-transform ${showDetails ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
                {showDetails ? 'Hide' : 'Show'} diagnostic details
              </button>

              {showDetails && (
                <div className="bg-neutral-900/50 p-3 rounded-lg border border-neutral-850 space-y-2 font-mono text-[10px] text-neutral-400">
                  <div className="flex justify-between">
                    <span>layer_count</span>
                    <span className="text-neutral-200">{trace.moaConfig?.layers ?? 1}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>proposersPerLayer</span>
                    <span className="text-neutral-200">{trace.moaConfig?.proposersPerLayer ?? trace.agents?.length ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>executionMode</span>
                    <span className="text-violet-300">{trace.executionMode}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span>proposer_models_json</span>
                    <span className="text-neutral-200 break-all">
                      {JSON.stringify(trace.agents?.map(a => a.modelId))}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GoA-lite section (non-MoA) */}
          {!isMoA && (
            <>
              {/* Sampling Rationale */}
              <div className="space-y-1 bg-neutral-900/50 p-3 rounded-lg border border-neutral-850">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Sampling Rationale</span>
                <p className="text-neutral-300 leading-relaxed italic">"{trace.samplingRationale}"</p>
              </div>

              {/* Active Agents Grid */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Agent Participation & S-Scores</span>

                <div className="grid gap-2 sm:grid-cols-1 md:grid-cols-2">
                  {trace.agents?.map((agent, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-xl border flex flex-col justify-between gap-2.5 transition-all ${
                        agent.isPrimary
                          ? 'bg-violet-950/10 border-violet-500/40 shadow-sm shadow-violet-500/5'
                          : 'bg-neutral-900/30 border-neutral-800'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-neutral-200">{agent.role}</span>
                            {agent.isPrimary && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-violet-600/20 text-violet-300 border border-violet-500/30 font-bold tracking-tight uppercase">
                                Primary
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-neutral-500 font-mono block truncate max-w-[200px]" title={agent.modelId}>
                            {agent.modelId.split('/').pop()}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-neutral-500 block font-medium">S-Score</span>
                          <span className={`font-mono font-bold text-sm ${agent.isPrimary ? 'text-violet-400' : 'text-neutral-300'}`}>
                            {agent.sScore !== undefined ? agent.sScore.toFixed(2) : '0.00'}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {getCapabilities(agent.modelId).map(cap => (
                          <span
                            key={cap}
                            className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                              cap === 'coding'
                                ? 'bg-blue-950/20 text-blue-400 border border-blue-900/30'
                                : cap === 'reasoning'
                                ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/30'
                                : 'bg-neutral-800 text-neutral-400'
                            }`}
                          >
                            {cap}
                          </span>
                        ))}
                        {agent.usedFallback && (
                          <span
                            title={agent.fallbackReason || 'Primary call failed; retried successfully'}
                            className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-amber-950/20 text-amber-400 border border-amber-900/30"
                          >
                            ⚠ Retried
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Optional Edge Matrix visualization */}
              {trace.edgeMatrix && Object.keys(trace.edgeMatrix).length > 0 && (
                <div className="space-y-2 border-t border-neutral-850 pt-3">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Meta-Reasoning Edge Influence Matrix</span>
                  <div className="overflow-x-auto bg-neutral-900/30 rounded-lg border border-neutral-850 p-2.5">
                    <table className="w-full text-left font-mono text-[10px]">
                      <thead>
                        <tr className="border-b border-neutral-800">
                          <th className="pb-1.5 font-bold text-neutral-500">From / To</th>
                          {Object.keys(trace.edgeMatrix).map(node => (
                            <th key={node} className="pb-1.5 font-bold text-neutral-400 truncate max-w-[60px] text-right" title={node}>
                              {node}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(trace.edgeMatrix).map(([fromNode, targets]) => (
                          <tr key={fromNode} className="border-b border-neutral-850/50 last:border-0 hover:bg-neutral-850/20 transition-all">
                            <td className="py-1.5 font-bold text-neutral-300 truncate max-w-[80px]" title={fromNode}>
                              {fromNode}
                            </td>
                            {Object.keys(trace.edgeMatrix || {}).map(toNode => {
                              const val = targets[toNode] || 0;
                              return (
                                <td
                                  key={toNode}
                                  className={`py-1.5 text-right font-medium ${val > 0.05 ? 'text-violet-400 font-bold' : 'text-neutral-600'}`}
                                >
                                  {val.toFixed(2)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      )}
    </div>
  );
}
