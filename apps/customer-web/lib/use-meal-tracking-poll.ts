"use client";

import { useCallback, useEffect, useRef } from 'react';
import {
  isTerminalDeliveryState,
  resolveEffectiveMealDeliveryState,
} from '@warmpawz/shared-types';
import { MEAL_TRACKING_POLL_MS } from '@/lib/meal-tracking-utils';

type PollPayload = {
  orderStatus?: string | null;
  logisticsStatus?: string | null;
};

export function isMealTrackingTerminal(payload: PollPayload | null | undefined): boolean {
  if (!payload) return false;
  const effective = resolveEffectiveMealDeliveryState(
    payload.orderStatus ?? null,
    payload.logisticsStatus ?? null,
  );
  if (effective === 'delivered' || effective === 'cancelled' || effective === 'failed') {
    return true;
  }
  return isTerminalDeliveryState(payload.logisticsStatus);
}

/**
 * Polls meal tracking on an interval; stops automatically when delivery reaches a terminal state.
 */
export function useMealTrackingPoll(
  load: (silent?: boolean) => void | Promise<void>,
  getTerminalPayload: () => PollPayload | null,
  deps: unknown[] = [],
) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const terminalRef = useRef(false);

  const stopPolling = useCallback(() => {
    terminalRef.current = true;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    terminalRef.current = false;

    const tick = (silent = false) => {
      if (terminalRef.current) return;
      void Promise.resolve(load(silent)).then(() => {
        const payload = getTerminalPayload();
        if (isMealTrackingTerminal(payload)) {
          stopPolling();
        }
      });
    };

    tick(false);
    intervalRef.current = setInterval(() => tick(true), MEAL_TRACKING_POLL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls extra deps
  }, deps);

  return { stopPolling };
}
