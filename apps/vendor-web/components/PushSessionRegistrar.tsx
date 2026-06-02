'use client';

import { useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  attachCapacitorPushTokenRefreshListener,
  bootstrapPushNotifications,
} from '@/lib/push-bootstrap';

function resolveVendorSessionUserId(): string | null {
  if (typeof window === 'undefined') return null;
  if (!localStorage.getItem('authToken')) return null;
  const id = localStorage.getItem('vendorId') || '';
  return id.trim() || null;
}

export function PushSessionRegistrar() {
  useEffect(() => {
    let detachTokenRefresh: (() => void) | undefined;
    let cancelled = false;

    const registerSession = async () => {
      const userId = resolveVendorSessionUserId();
      if (!userId || cancelled) return;

      await bootstrapPushNotifications({
        userId,
        userType: 'vendor',
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        apiClient,
      });

      if (!detachTokenRefresh) {
        const detach = await attachCapacitorPushTokenRefreshListener({
          userId,
          userType: 'vendor',
          apiClient,
        });
        if (!cancelled) detachTokenRefresh = detach;
      }
    };

    void registerSession();

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
      document.removeEventListener('visibilitychange', onVisible);
      appListener?.remove().catch(() => undefined);
      detachTokenRefresh?.();
    };
  }, []);

  return null;
}
