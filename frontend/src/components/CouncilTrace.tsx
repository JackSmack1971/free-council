import { useState } from 'react';

interface TraceAgent {
  role: string;
  modelId: string;
  sScore: number;
  isPrimary: boolean;
}

interface TraceInfo {
  agents: TraceAgent[];
  samplingRationale: string;
  totalApiCalls: number;
  edgeMatrix?: Record<string, Record<string, number>>;
}

interface CouncilTraceProps {
  trace: TraceInfo;
}

export default function CouncilTrace({ trace }: CouncilTraceProps) {
  const [isOpen, setIsOpen] = useState(false);

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
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 font-medium border border-violet-500/20">
            {trace.agents?.length || 0} Agents
          </span>
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

                  <div className="flex gap-1">
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

        </div>
      )}
    </div>
  );
}
