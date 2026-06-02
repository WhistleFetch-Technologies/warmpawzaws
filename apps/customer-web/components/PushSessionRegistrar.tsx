'use client';

import { useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  bootstrapPushNotifications,
  ensureCapacitorPushRegistrationPipeline,
} from '@/lib/push-bootstrap';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';

function resolveCustomerSessionUserId(): string | null {
  if (typeof window === 'undefined') return null;
  if (!localStorage.getItem('authToken')) return null;
  return getResolvedCustomerId();
}

const RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 20_000];

/**
 * Runs FCM + device registration at session start (mount, resume, tab visible).
 * Retries when customerId or FCM token are not ready yet (common on cold start).
 */
export function PushSessionRegistrar() {
  useEffect(() => {
    let cancelled = false;
    let customerIdPollTimer: ReturnType<typeof setInterval> | undefined;

    const registerSession = async (attempt = 0): Promise<void> => {
      if (cancelled) return;

      const userId = resolveCustomerSessionUserId();
      if (!userId) {
        if (attempt === 0 && localStorage.getItem('authToken')) {
          console.log('[push-bootstrap] waiting for customerId before push registration');
        }
        return;
      }

      const pushOpts = {
        userId,
        userType: 'customer' as const,
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        apiClient,
      };

      await ensureCapacitorPushRegistrationPipeline(pushOpts);
      const result = await bootstrapPushNotifications(pushOpts);

      if (cancelled) return;

      const registeredAt = localStorage.getItem('warmpawz_cust_push_registered_at');
      if (!result.ok && !registeredAt && attempt < RETRY_DELAYS_MS.length) {
        window.setTimeout(() => {
          void registerSession(attempt + 1);
        }, RETRY_DELAYS_MS[attempt]);
      }
    };

    void registerSession();

    customerIdPollTimer = window.setInterval(() => {
      if (cancelled) return;
      if (!localStorage.getItem('authToken')) return;
      if (localStorage.getItem('warmpawz_cust_push_registered_at')) return;
      void registerSession();
    }, 3_000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void registerSession();
    };
    document.addEventListener('visibilitychange', onVisible);

    let appListener: { remove: () => Promise<void> } | undefined;
    void (async () => {
      try {
        const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } })
          .Capacitor;
        if (!cap?.isNativePlatform?.()) return;
        const { App } = await import(/* webpackIgnore: true */ '@capacitor/app');
        appListener = await App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) void registerSession();
        });
      } catch {
        /* non-Capacitor */
      }
    })();

    return () => {
      cancelled = true;
      if (customerIdPollTimer) clearInterval(customerIdPollTimer);
      document.removeEventListener('visibilitychange', onVisible);
      appListener?.remove().catch(() => undefined);
    };
  }, []);

  return null;
}
