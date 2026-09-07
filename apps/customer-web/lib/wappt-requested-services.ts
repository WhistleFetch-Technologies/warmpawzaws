import {
  partitionVendorServiceRowsByPackage,
  type VendorServiceLike,
} from '@/lib/vendor-package-purchase-nav';

export type WapptRequestedService = {
  id: string;
  serviceId: string;
  name: string;
};

export function wapptServiceSelectionKey(
  row: { id?: string | null; serviceId?: string | null } | null | undefined,
): string {
  return String(row?.id || row?.serviceId || '').trim();
}

export function partitionWapptListedServices<T extends VendorServiceLike>(
  rows: T[] | null | undefined,
): { oneOff: T[]; packages: T[] } {
  const { packages, services } = partitionVendorServiceRowsByPackage(rows ?? []);
  return { oneOff: services, packages };
}

export function canSelectWapptSlot(opts: {
  selectableCount: number;
  selectedCount: number;
}): boolean {
  if (opts.selectableCount <= 0) return true;
  return opts.selectedCount > 0;
}

export function toWapptRequestedServices(
  rows: Array<{
    id?: string | null;
    serviceId?: string | null;
    name?: string | null;
    serviceName?: string | null;
  } | null | undefined>,
): WapptRequestedService[] {
  const seen = new Set<string>();
  const out: WapptRequestedService[] = [];
  for (const row of rows) {
    if (!row) continue;
    const id = String(row.id || row.serviceId || '').trim();
    const serviceId = String(row.serviceId || row.id || '').trim();
    const name = String(row.name || row.serviceName || '').trim();
    const key = id || serviceId;
    if (!key || !name || seen.has(key)) continue;
    seen.add(key);
    out.push({ id: id || serviceId, serviceId: serviceId || id, name });
  }
  return out;
}

export function formatWapptRequestedServiceNames(
  rows: Array<{ name?: string | null; serviceName?: string | null } | null | undefined>,
): string {
  return rows
    .map((row) => String(row?.name || row?.serviceName || '').trim())
    .filter(Boolean)
    .join(', ');
}

export function toggleWapptOneOffSelection(
  current: ReadonlySet<string>,
  toggledId: string,
  oneOffRows: VendorServiceLike[],
): Set<string> {
  const tid = String(toggledId || '').trim();
  if (!tid) return new Set(current);
  const allowed = new Set(
    oneOffRows.map((row) => wapptServiceSelectionKey(row as { id?: string; serviceId?: string })),
  );
  if (!allowed.has(tid)) return new Set(current);
  const next = new Set(current);
  if (next.has(tid)) next.delete(tid);
  else next.add(tid);
  return next;
}
