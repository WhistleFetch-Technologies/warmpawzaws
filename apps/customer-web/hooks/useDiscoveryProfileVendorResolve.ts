'use client';

import { useEffect, useState } from 'react';
import { fetchDiscoveryProfileVendorRow } from '@/lib/discovery-profile-vendor-bootstrap';

/**
 * Deep-link profile: keep loading until vendor is in providers (feed page or bootstrap).
 */
export function useDiscoveryProfileVendorResolve<T extends { providerId: string; vendorId?: string }>(opts: {
  vendorId?: string;
  feedEnabled: boolean;
  feedLoading: boolean;
  providers: T[];
  mapRow: (row: Record<string, unknown>) => T;
  setProviders: (value: T[] | ((prev: T[]) => T[])) => void;
}) {
  const { vendorId, feedEnabled, feedLoading, providers, mapRow, setProviders } = opts;
  const [profileResolving, setProfileResolving] = useState(false);
  const [profileResolveFailed, setProfileResolveFailed] = useState(false);

  const wantId = vendorId ? String(vendorId).trim() : '';
  const hasProfileVendor =
    !wantId ||
    providers.some((p) => p.providerId === wantId || p.vendorId === wantId);

  useEffect(() => {
    if (!wantId || !feedEnabled || feedLoading || hasProfileVendor) return;

    let cancelled = false;
    setProfileResolving(true);
    setProfileResolveFailed(false);
    void (async () => {
      const row = await fetchDiscoveryProfileVendorRow(wantId);
      if (cancelled) return;
      if (row) {
        setProviders([mapRow(row)]);
      } else {
        setProfileResolveFailed(true);
      }
    })().finally(() => {
      if (!cancelled) setProfileResolving(false);
    });

    return () => {
      cancelled = true;
    };
  }, [wantId, feedEnabled, feedLoading, hasProfileVendor, mapRow, setProviders]);

  /** Keep loading until bootstrap finishes — avoids a flash of empty / "no providers" between feed done and resolve start. */
  const showProfileLoading = Boolean(
    wantId && !hasProfileVendor && !profileResolveFailed
  );

  return { profileResolving, profileResolveFailed, showProfileLoading };
}
