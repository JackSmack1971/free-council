"use client";

interface AgentCard {
  agentId: string;
  role: string;
  modelId?: string;
  status: 'pending' | 'generating' | 'done' | 'failed';
  responseExcerpt?: string;
  sScore?: number;
  isPruned?: boolean;
  isSelected?: boolean;
}

interface AgentProgressPanelProps {
  agents: AgentCard[];
}

export default function AgentProgressPanel({ agents }: AgentProgressPanelProps) {
  if (agents.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Council — Live Progress</p>
      <div className="flex flex-wrap gap-2">
        {agents.map(agent => {
          const baseClass = 'flex flex-col gap-1 px-3 py-2 rounded-xl border text-xs transition-all min-w-[150px] max-w-[220px]';
          let variantClass = 'bg-neutral-900/60 border-neutral-800 text-neutral-400';

          if (agent.isSelected) {
            variantClass = 'bg-violet-950/30 border-violet-500/40 text-violet-300 ring-1 ring-violet-500/30';
          } else if (agent.isPruned) {
            variantClass = 'bg-neutral-900/40 border-neutral-800/50 text-neutral-600 opacity-50';
          } else if (agent.status === 'generating') {
            variantClass = 'bg-blue-950/20 border-blue-900/40 text-blue-300';
          } else if (agent.status === 'done') {
            variantClass = 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300';
          } else if (agent.status === 'failed') {
            variantClass = 'bg-red-950/20 border-red-900/40 text-red-300';
          }

          return (
            <div key={agent.agentId} className={`${baseClass} ${variantClass}`}>
              <div className="flex items-center gap-1.5 font-bold">
                {agent.status === 'generating' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
                )}
                {agent.status === 'done' && !agent.isPruned && !agent.isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                )}
                {agent.isSelected && (
                  <svg className="w-3 h-3 text-violet-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {agent.isPruned && (
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-600 shrink-0" />
                )}
                <span className="truncate">{agent.role}</span>
              </div>

              {agent.sScore !== undefined && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-neutral-500">S-score:</span>
                  <span className={`text-[10px] font-mono font-bold ${agent.isPruned ? 'text-neutral-600' : 'text-neutral-300'}`}>
                    {agent.sScore.toFixed(3)}
                  </span>
                </div>
              )}

              {agent.responseExcerpt && !agent.isPruned && (
                <p className="text-[10px] text-neutral-500 line-clamp-2 leading-normal">
                  {agent.responseExcerpt}
                </p>
              )}

              {agent.isPruned && (
                <span className="text-[10px] text-neutral-600 italic">pruned (low score)</span>
              )}
              {agent.isSelected && (
                <span className="text-[10px] text-violet-400 font-semibold">selected winner</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
