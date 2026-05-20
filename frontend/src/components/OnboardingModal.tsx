"use client";

import { useState } from 'react';

interface OnboardingModalProps {
  onComplete: () => void;
}

const STEPS = [
  {
    id: 'logging',
    title: 'Data Logging Notice',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'blue',
    content: (
      <div className="space-y-3 text-sm text-neutral-300 leading-relaxed">
        <p>FreeCouncil routes your prompts through <strong className="text-white">OpenRouter</strong>. By using this app, you acknowledge the following logging policies:</p>
        <ol className="list-decimal list-inside space-y-2 text-neutral-400 pl-2">
          <li><strong className="text-neutral-200">OpenRouter metadata logging:</strong> OpenRouter logs request metadata (model, token count, timestamp) by default for all requests.</li>
          <li><strong className="text-neutral-200">Prompt/completion logging:</strong> Some models optionally log prompt and completion text. You will be notified per model before first use.</li>
          <li><strong className="text-neutral-200">Provider-side logging:</strong> Some model providers (e.g., Owl Alpha) log prompts for model improvement. This is disclosed per model when relevant.</li>
        </ol>
      </div>
    )
  },
  {
    id: 'gdpr',
    title: 'Third-Party Processing (GDPR Advisory)',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    color: 'violet',
    content: (
      <div className="space-y-3 text-sm text-neutral-300 leading-relaxed">
        <p>In accordance with GDPR Articles 13/14 (advisory disclosure):</p>
        <div className="bg-neutral-950/60 p-4 rounded-lg border border-neutral-800 text-neutral-400 space-y-2">
          <p>Your prompts and any uploaded content are processed by <strong className="text-neutral-200">OpenRouter</strong> and the <strong className="text-neutral-200">model providers you select</strong>.</p>
          <p>FreeCouncil does <strong className="text-neutral-200">not</strong> transmit this data to any other endpoint. All session data is stored locally on your device.</p>
        </div>
        <p className="text-xs text-neutral-500">You can review these disclosures again via the "Privacy & Data" link in the app footer.</p>
      </div>
    )
  }
];

export default function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(0);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setStep(s => s + 1);
    }
  };

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20'
  };
  const btnMap: Record<string, string> = {
    blue: 'bg-blue-600 hover:bg-blue-500',
    violet: 'bg-violet-600 hover:bg-violet-500'
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6">

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`h-1.5 flex-1 rounded-full transition-all ${i <= step ? 'bg-violet-500' : 'bg-neutral-800'}`}
            />
          ))}
        </div>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl border ${colorMap[current.color]}`}>
            {current.icon}
          </div>
          <div>
            <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest">Step {step + 1} of {STEPS.length}</p>
            <h2 className="text-base font-bold text-neutral-100">{current.title}</h2>
          </div>
        </div>

        {/* Content */}
        <div className="min-h-[140px]">
          {current.content}
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-2 border-t border-neutral-800">
          <span className="text-[10px] text-neutral-600">
            Welcome to FreeCouncil — your local AI council
          </span>
          <button
            onClick={handleNext}
            className={`px-5 py-2 rounded-lg text-white text-sm font-bold transition-colors ${btnMap[current.color]}`}
          >
            {isLast ? 'I understand, continue' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
