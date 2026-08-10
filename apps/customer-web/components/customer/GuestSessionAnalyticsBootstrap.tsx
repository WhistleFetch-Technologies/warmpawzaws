'use client';

import { useEffect, useRef } from 'react';
import { getOrCreateAnonymousId } from '@/lib/anonymous-id';
import { enqueueAllyticasEvent } from '@/lib/allyticas-ingest';
import { Capacitor } from '@capacitor/core';

/**
 * Phase 1 analytics foundation: ensure anonymous_id exists and emit
 * app_opened + session_started once per tab session.
 */
export function GuestSessionAnalyticsBootstrap() {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    const anonymousId = getOrCreateAnonymousId();
    let sessionId = '';
    try {
      sessionId =
        sessionStorage.getItem('warmpawz_session_id') ||
        `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      sessionStorage.setItem('warmpawz_session_id', sessionId);
    } catch {
      sessionId = `session_${Date.now()}`;
    }

    const platform = Capacitor.isNativePlatform()
      ? Capacitor.getPlatform()
      : 'web';

    enqueueAllyticasEvent({
      event_type: 'custom',
      event_name: 'app_opened',
      properties: {
        anonymous_id: anonymousId,
        session_id: sessionId,
        platform,
        source: 'customer_web',
      },
    });

    enqueueAllyticasEvent({
      event_type: 'custom',
      event_name: 'session_started',
      properties: {
        anonymous_id: anonymousId,
        session_id: sessionId,
        platform,
      },
    });
  }, []);

  return null;
}
