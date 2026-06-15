"use client";

import { useCallback, useEffect, useRef } from 'react';

export interface UseSupportTicketThreadOptions {
  ticketId: string | null;
  enabled: boolean;
  fetchDetail: (ticketId: string, options?: { silent?: boolean }) => Promise<void>;
  /** Default 4000ms — tuned for AI ack appearing shortly after create */
  pollIntervalMs?: number;
}

/**
 * Polls ticket thread while the detail view is open.
 * Replace the interval with a WebSocket/SSE subscriber without changing call sites.
 */
export function useSupportTicketThread({
  ticketId,
  enabled,
  fetchDetail,
  pollIntervalMs = 4000,
}: UseSupportTicketThreadOptions) {
  const fetchRef = useRef(fetchDetail);
  fetchRef.current = fetchDetail;

  const refresh = useCallback(() => {
    if (!ticketId) return;
    void fetchRef.current(ticketId);
  }, [ticketId]);

  useEffect(() => {
    if (!enabled || !ticketId) return;

    const intervalId = window.setInterval(() => {
      void fetchRef.current(ticketId, { silent: true });
    }, pollIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [enabled, ticketId, pollIntervalMs]);

  return { refresh };
}
