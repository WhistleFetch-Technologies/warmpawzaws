'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { CommercialAiContextPacket, CommercialAiEntityContext } from '@/lib/commercial-ai/types';

type CommercialAiContextValue = {
  entity: CommercialAiEntityContext | null;
  setEntity: (entity: CommercialAiEntityContext | null) => void;
  prefillMessage: string | null;
  openCopilotWith: (message: string, entity?: CommercialAiEntityContext | null) => void;
  consumePrefill: () => string | null;
  pendingOpen: boolean;
  clearPendingOpen: () => void;
};

const CommercialAiContext = createContext<CommercialAiContextValue | null>(null);

export function CommercialAiProvider({ children }: { children: React.ReactNode }) {
  const [entity, setEntity] = useState<CommercialAiEntityContext | null>(null);
  const [prefillMessage, setPrefillMessage] = useState<string | null>(null);
  const [pendingOpen, setPendingOpen] = useState(false);

  const openCopilotWith = useCallback((message: string, nextEntity?: CommercialAiEntityContext | null) => {
    setPrefillMessage(message);
    if (nextEntity !== undefined) setEntity(nextEntity);
    setPendingOpen(true);
  }, []);

  const consumePrefill = useCallback(() => {
    const m = prefillMessage;
    setPrefillMessage(null);
    return m;
  }, [prefillMessage]);

  const clearPendingOpen = useCallback(() => setPendingOpen(false), []);

  const value = useMemo(
    () => ({
      entity,
      setEntity,
      prefillMessage,
      openCopilotWith,
      consumePrefill,
      pendingOpen,
      clearPendingOpen,
    }),
    [entity, prefillMessage, openCopilotWith, consumePrefill, pendingOpen, clearPendingOpen]
  );

  return <CommercialAiContext.Provider value={value}>{children}</CommercialAiContext.Provider>;
}

export function useCommercialAi() {
  const ctx = useContext(CommercialAiContext);
  if (!ctx) {
    throw new Error('useCommercialAi must be used within CommercialAiProvider');
  }
  return ctx;
}

export function useCommercialAiOptional() {
  return useContext(CommercialAiContext);
}

export function mergeCommercialContext(
  base: CommercialAiContextPacket,
  entity: CommercialAiEntityContext | null
): CommercialAiContextPacket {
  return entity ? { ...base, entity } : base;
}
