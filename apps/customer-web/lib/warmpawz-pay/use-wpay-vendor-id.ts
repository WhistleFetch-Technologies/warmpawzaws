'use client';

import { useParams } from 'next/navigation';
import { useMemo } from 'react';

const PLACEHOLDER_IDS = new Set(['_', 'placeholder']);

function vendorIdFromPathname(): string {
  if (typeof window === 'undefined') return '';
  const match = window.location.pathname.match(/\/warmpawz-pay\/vendors\/([^/?#]+)/);
  const id = match?.[1] ? decodeURIComponent(match[1]).trim() : '';
  if (!id || PLACEHOLDER_IDS.has(id)) return '';
  return id;
}

/** Reactive vendor id for /warmpawz-pay/vendors/[vendorId] on static export. */
export function useWpayVendorId(propId?: string): string {
  const params = useParams();
  return useMemo(() => {
    const fromProp = String(propId ?? '').trim();
    if (fromProp && !PLACEHOLDER_IDS.has(fromProp)) return fromProp;
    const raw = params?.vendorId;
    const fromParams = (Array.isArray(raw) ? raw[0] : raw) ?? '';
    const normalized = String(fromParams).trim();
    if (normalized && !PLACEHOLDER_IDS.has(normalized)) return normalized;
    return vendorIdFromPathname();
  }, [params, propId]);
}
