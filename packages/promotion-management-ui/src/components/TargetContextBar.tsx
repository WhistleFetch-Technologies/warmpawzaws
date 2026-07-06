'use client';

import type { SmartTargetFlowId, SmartTargetSurface, VendorInventoryType } from '../types';
import { INVENTORY_TYPE_LABELS, SMART_FLOW_LABELS } from '../smart-target';

export function TargetContextBar({
  surface,
  flow,
  partnerLabel,
  inventoryType,
  stepHint,
}: {
  surface: SmartTargetSurface;
  flow: SmartTargetFlowId;
  partnerLabel?: string;
  inventoryType?: VendorInventoryType;
  stepHint?: string;
}) {
  const labels = SMART_FLOW_LABELS[flow];
  const flowLabel = surface === 'ecommerce' ? labels.ecommerce : labels.marketing;

  const crumbs: string[] = [flowLabel];
  if (flow === 'vendor_inventory' && partnerLabel) {
    crumbs.push(partnerLabel);
    if (surface === 'marketing' && inventoryType) {
      crumbs.push(INVENTORY_TYPE_LABELS[inventoryType]);
    }
    if (surface === 'ecommerce') {
      crumbs.push('Products');
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Context</p>
      <p className="text-sm font-medium text-slate-800 mt-0.5">{crumbs.join(' → ')}</p>
      {stepHint ? <p className="text-xs text-slate-500 mt-1">{stepHint}</p> : null}
    </div>
  );
}

export function TargetSelectionSummary({
  summary,
  onClear,
}: {
  summary: string;
  onClear?: () => void;
}) {
  if (!summary) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-orange-200 bg-orange-50/60 px-3 py-2">
      <p className="text-xs text-orange-900">
        <span className="font-semibold">Selected: </span>
        {summary}
      </p>
      {onClear ? (
        <button type="button" onClick={onClear} className="text-xs font-medium text-orange-700 hover:underline">
          Clear all
        </button>
      ) : null}
    </div>
  );
}

export function TargetListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2 rounded-xl border border-slate-100 p-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}

export function TargetEmptyState({
  message,
  hint,
  onRetry,
}: {
  message: string;
  hint?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center space-y-2">
      <p className="text-sm text-slate-600">{message}</p>
      {hint ? <p className="text-xs text-slate-400">{hint}</p> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="text-xs font-medium text-orange-600 hover:underline"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
