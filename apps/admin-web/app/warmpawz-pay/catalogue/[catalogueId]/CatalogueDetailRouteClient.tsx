'use client';

import { useParams, usePathname } from 'next/navigation';
import { CatalogueDetailPage } from '@/components/admin/warmpawz-pay/catalogue/CatalogueDetailPage';

/** `generateStaticParams` uses this for `output: 'export'` — never treat as a real catalogue id. */
const STATIC_EXPORT_PLACEHOLDER = 'placeholder';

function catalogueIdFromPathname(pathname: string): string {
  const match = /^\/warmpawz-pay\/catalogue\/([^/]+)/.exec(pathname || '');
  return match?.[1] ? decodeURIComponent(match[1]).trim() : '';
}

function catalogueIdFromParams(params: ReturnType<typeof useParams>): string {
  const raw = params?.catalogueId;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (Array.isArray(raw) && raw[0] && String(raw[0]).trim()) return String(raw[0]).trim();
  return '';
}

function resolveCatalogueId(pathname: string, params: ReturnType<typeof useParams>, serverProp: string): string {
  const fromPath = catalogueIdFromPathname(pathname);
  const fromParams = catalogueIdFromParams(params);
  const fromProp = String(serverProp || '').trim();

  if (fromPath && fromPath !== STATIC_EXPORT_PLACEHOLDER) return fromPath;
  if (fromParams && fromParams !== STATIC_EXPORT_PLACEHOLDER) return fromParams;
  if (fromProp && fromProp !== STATIC_EXPORT_PLACEHOLDER) return fromProp;
  return fromPath || fromParams || fromProp;
}

export interface CatalogueDetailRouteClientProps {
  readonly catalogueId: string;
}

export function CatalogueDetailRouteClient({ catalogueId }: CatalogueDetailRouteClientProps) {
  const pathname = usePathname();
  const params = useParams();
  const resolvedId = resolveCatalogueId(pathname, params, catalogueId);

  return <CatalogueDetailPage catalogueId={resolvedId} />;
}
