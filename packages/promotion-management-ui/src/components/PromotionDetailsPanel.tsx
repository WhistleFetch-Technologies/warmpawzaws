'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Copy, Check, Tag, Target, Users, X, Percent, Ticket } from 'lucide-react';
import type { NormalizedCouponItem, NormalizedPromotionItem } from '../types';
import { lifecycleFromPromotion, lifecycleFromCoupon } from '../lifecycle';
import { PromotionStatusBadge } from './PromotionStatusBadge';
import { PromotionTimeline } from './PromotionTimeline';
import { ComingSoonSection } from './ComingSoonSection';

function formatPromotionType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function audienceLabel(audience?: string): string {
  const map: Record<string, string> = {
    all: 'All customers',
    new_users: 'First-time customers',
    returning_users: 'Returning customers',
    vip: 'VIP customers',
    segments: 'Custom segments',
  };
  return audience ? (map[audience] ?? audience) : 'All customers';
}

function formatDateRange(start: string, end: string): string {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  return `${fmt(start)} – ${fmt(end)}`;
}

function DetailSection({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Tag;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-orange-500" aria-hidden />
        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</h4>
      </div>
      {children}
    </section>
  );
}

export function PromotionDetailsPanel({
  item,
  coupon,
  onClose,
  onEdit,
}: {
  item?: NormalizedPromotionItem | null;
  coupon?: NormalizedCouponItem | null;
  onClose: () => void;
  onEdit?: () => void;
}) {
  const record = item ?? coupon;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!record) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [record, onClose]);

  if (!record) return null;
  if (typeof document === 'undefined') return null;

  const lifecycle = item
    ? lifecycleFromPromotion(item)
    : coupon
      ? lifecycleFromCoupon(coupon)
      : 'draft';

  const start = item?.startDate ?? coupon!.startDate;
  const end = item?.endDate ?? coupon!.endDate;
  const isCoupon = Boolean(coupon);
  const discountType = item?.discountType ?? coupon?.discountType;
  const discountValue = item?.discountValue ?? coupon?.discountValue ?? 0;
  const discountLabel =
    discountType === 'percentage' ? `${discountValue}% off` : `₹${discountValue} off`;
  const usageCount = item?.usageCount ?? coupon?.usageCount ?? 0;
  const usageLimit = item?.usageLimit ?? coupon?.usageLimit;
  const targetSummary = item?.targetSummary ?? coupon?.targetSummary;
  const usagePercent =
    usageLimit != null && usageLimit > 0
      ? Math.min(100, Math.round((usageCount / usageLimit) * 100))
      : null;

  const copyCode = async () => {
    if (!coupon?.code) return;
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-[1px]"
        style={{ zIndex: 10050 }}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="fixed inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-slate-200 bg-slate-50 shadow-2xl sm:max-w-lg"
        style={{ zIndex: 10051 }}
        role="dialog"
        aria-modal="true"
        aria-label={isCoupon ? 'Coupon details' : 'Promotion details'}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <PromotionStatusBadge status={lifecycle} />
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                {isCoupon ? (
                  <>
                    <Ticket className="h-3 w-3" /> Coupon
                  </>
                ) : (
                  <>
                    <Tag className="h-3 w-3" /> Promotion
                  </>
                )}
              </span>
            </div>
            <h2 className="truncate text-lg font-bold text-slate-900">
              {isCoupon ? coupon!.code : item!.name}
            </h2>
            {item?.description ? (
              <p className="mt-1 line-clamp-2 text-sm text-slate-500">{item.description}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onEdit ? (
              <button
                type="button"
                onClick={onEdit}
                className="rounded-lg px-2 py-1 text-sm font-medium text-orange-600 hover:bg-orange-50"
              >
                Edit
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Close details"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-5">
          <div className="rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 p-5 text-white shadow-md">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-100">Discount</p>
            <p className="mt-1 text-3xl font-bold">{discountLabel}</p>
            {item?.maxDiscount ? (
              <p className="mt-1 text-sm text-orange-100">Max ₹{item.maxDiscount}</p>
            ) : null}
            {item?.minAmount ?? coupon?.minAmount ? (
              <p className="mt-1 text-sm text-orange-100">
                Min order ₹{item?.minAmount ?? coupon?.minAmount}
              </p>
            ) : null}
          </div>

          {isCoupon && coupon ? (
            <DetailSection icon={Ticket} label="Coupon code">
              <div className="flex items-center gap-2">
                <p className="font-mono text-xl font-bold text-slate-900">{coupon.code}</p>
                <button
                  type="button"
                  onClick={copyCode}
                  className="rounded-lg border border-amber-200 bg-amber-50 p-2 hover:bg-amber-100"
                  title="Copy code"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4 text-amber-700" />
                  )}
                </button>
              </div>
            </DetailSection>
          ) : null}

          {!isCoupon && item?.promotionType ? (
            <DetailSection icon={Percent} label="Offer type">
              <p className="text-sm font-medium text-slate-800">
                {formatPromotionType(item.promotionType)}
              </p>
            </DetailSection>
          ) : null}

          {targetSummary ? (
            <DetailSection icon={Target} label="Targets">
              <p className="text-sm leading-relaxed text-slate-800">{targetSummary}</p>
            </DetailSection>
          ) : null}

          {item?.audience ? (
            <DetailSection icon={Users} label="Audience">
              <p className="text-sm text-slate-800">{audienceLabel(item.audience)}</p>
            </DetailSection>
          ) : null}

          <DetailSection icon={Calendar} label="Schedule">
            <p className="text-sm font-medium text-slate-800">{formatDateRange(start, end)}</p>
            <p className="mt-1 text-xs text-slate-500">Asia/Kolkata</p>
          </DetailSection>

          <DetailSection icon={Tag} label="Usage">
            <p className="text-sm font-semibold text-slate-900">
              {usageCount}
              {usageLimit != null ? ` / ${usageLimit} total` : ' redemptions'}
            </p>
            {usagePercent != null ? (
              <div className="mt-3">
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-orange-500 transition-all"
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {Math.max(0, usageLimit! - usageCount)} remaining
                </p>
              </div>
            ) : null}
            {item?.usageLimitPerUser ? (
              <p className="mt-1 text-xs text-slate-500">
                Max {item.usageLimitPerUser} per customer
              </p>
            ) : null}
          </DetailSection>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
              Lifecycle
            </h4>
            <PromotionTimeline current={lifecycle} startDate={start} endDate={end} />
          </section>

          <section className="rounded-xl border border-dashed border-slate-200 bg-white/80 p-4">
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
              Vendor funding
            </h4>
            <p className="text-sm text-slate-500">Funding breakdown — coming in a future sprint</p>
          </section>

          <ComingSoonSection />
        </div>
      </aside>
    </>,
    document.body
  );
}
