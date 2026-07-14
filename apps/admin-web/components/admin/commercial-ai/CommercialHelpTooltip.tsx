'use client';

import { useEffect, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useCommercialAiOptional } from '@/context/CommercialAiContext';
import type { CommercialGlossaryEntry } from '@/lib/commercial-ai/types';

/**
 * Commercial help: ? → Tooltip → Example → Learn more → Ask AI
 * Tooltips never call Bedrock.
 */
export function CommercialHelpTooltip({
  glossaryId,
  label,
  className = '',
}: {
  glossaryId: string;
  label?: string;
  className?: string;
}) {
  const commercialAi = useCommercialAiOptional();
  const [entry, setEntry] = useState<CommercialGlossaryEntry | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiClient.get<{ entries: CommercialGlossaryEntry[] }>(
          '/admin/commercial-ai-copilot/glossary'
        );
        const found = (res.entries ?? []).find((e) => e.id === glossaryId);
        setEntry(found ?? null);
      } catch {
        setEntry(null);
      }
    })();
  }, [glossaryId]);

  const term = entry?.term ?? label ?? glossaryId;

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        aria-label={`Help: ${term}`}
        className="rounded-full p-0.5 text-slate-400 hover:text-orange-600"
        onClick={() => setOpen((v) => !v)}
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-slate-200 bg-white p-3 text-left text-xs shadow-lg">
          <p className="font-semibold text-slate-900">{term}</p>
          <p className="mt-1 text-slate-600">{entry?.short ?? 'Commercial glossary entry loading…'}</p>
          {entry?.example ? (
            <p className="mt-2 text-slate-500">
              <span className="font-medium">Example:</span> {entry.example}
            </p>
          ) : null}
          {entry?.learnMore ? (
            <p className="mt-2 text-slate-500">
              <span className="font-medium">Learn more:</span> {entry.learnMore}
            </p>
          ) : null}
          {commercialAi ? (
            <button
              type="button"
              className="mt-3 text-orange-600 hover:underline"
              onClick={() => {
                setOpen(false);
                commercialAi.openCopilotWith(`Explain ${term}`);
              }}
            >
              Ask AI
            </button>
          ) : null}
        </div>
      ) : null}
    </span>
  );
}
