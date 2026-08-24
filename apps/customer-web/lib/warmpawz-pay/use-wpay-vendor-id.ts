'use client';

import { useParams, useSearchParams } from 'next/navigation';

const PLACEHOLDER_IDS = new Set(['_', 'placeholder']);

function normalizeVendorId(value?: string | null): string {
  const id = String(value ?? '').trim();
  if (!id || PLACEHOLDER_IDS.has(id)) return '';
  return id;
}

function vendorIdFromPathname(): string {
  if (typeof window === 'undefined') return '';
  const match = window.location.pathname.match(/\/warmpawz-pay\/vendors\/([^/?#]+)/);
  return normalizeVendorId(match?.[1] ? decodeURIComponent(match[1]) : '');
}

/** Reactive vendor id for /warmpawz-pay/vendors/placeholder?vendorId=… on static export. */
export function useWpayVendorId(propId?: string): string {
  const params = useParams();
  const searchParams = useSearchParams();
  const fromQuery = normalizeVendorId(
    searchParams.get('vendorId') || searchParams.get('vendor_id'),
  );
  if (fromQuery) return fromQuery;

  const fromProp = normalizeVendorId(propId);
  if (fromProp) return fromProp;

  const raw = params?.vendorId;
  const fromParams = normalizeVendorId(Array.isArray(raw) ? raw[0] : raw);
  if (fromParams) return fromParams;

  return vendorIdFromPathname();
}
