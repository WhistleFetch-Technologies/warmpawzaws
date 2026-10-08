import type {
  PromoCustomerCopy,
  PromoEngineBenefit,
  PromoEngineDraft,
  PromoRangeDraft,
  PromoRangeLimits,
  PromoVcfDraft,
} from './types';
import { validateCustomerCopyDraft } from './draft';

export const MAX_RANGES = 20;
const DEFAULT_RANGE_WIDTH = 500;

let keySeq = 0;
export function newRangeKey(): string {
  keySeq += 1;
  return `range-${Date.now().toString(36)}-${keySeq}`;
}

export function discountOf(list: PromoEngineBenefit[]): PromoEngineBenefit {
  return list.find((b) => b.type === 'DISCOUNT') || { type: 'DISCOUNT', mode: 'FIXED', value: 0 };
}

export function cashbackOf(list: PromoEngineBenefit[]): PromoEngineBenefit | null {
  return list.find((b) => b.type === 'CASHBACK') || null;
}

/** Keeps a zero-value cashback while its toggle is on; zero entries are dropped on save. */
export function buildBenefits(
  discount: PromoEngineBenefit,
  cashback: PromoEngineBenefit | null,
): PromoEngineBenefit[] {
  return cashback ? [discount, cashback] : [discount];
}

export function nonZeroBenefits(list: PromoEngineBenefit[]): PromoEngineBenefit[] {
  return list.filter((b) => Number(b.value) > 0);
}

export function benefitModeOf(list: PromoEngineBenefit[]): PromoVcfDraft['benefitMode'] | null {
  const d = Number(discountOf(list).value) > 0;
  const c = Number(cashbackOf(list)?.value) > 0;
  if (d && c) return 'both';
  if (d) return 'discount';
  if (c) return 'cashback';
  return null;
}

function rupees(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/** e.g. "₹100 – ₹500", "Above ₹2,000", "Any amount". */
export function rangeBoundsLabel(r: Pick<PromoRangeDraft, 'minAmount' | 'maxAmount'>): string {
  const min = r.minAmount;
  const max = r.maxAmount;
  if (min == null && max == null) return 'Any amount';
  if (max == null) return `${rupees(min ?? 0)} and above`;
  return `${rupees(min ?? 0)} – ${rupees(max)}`;
}

export function rangeTitle(r: PromoRangeDraft, index: number): string {
  return r.label.trim() ? `Range ${index + 1} · ${r.label.trim()}` : `Range ${index + 1}`;
}

/** Plain-language summary of a range's benefits, e.g. "₹55 off · 10% cashback (max ₹100)". */
export function describeRangeBenefits(list: PromoEngineBenefit[]): string {
  const parts: string[] = [];
  const d = discountOf(list);
  if (Number(d.value) > 0) {
    const v = d.mode === 'PERCENT' ? `${d.value}% off` : `${rupees(Number(d.value))} off`;
    parts.push(d.maxAmount != null && d.mode === 'PERCENT' ? `${v} (max ${rupees(d.maxAmount)})` : v);
  }
  const c = cashbackOf(list);
  if (c && Number(c.value) > 0) {
    const v = c.mode === 'PERCENT' ? `${c.value}% cashback` : `${rupees(Number(c.value))} cashback`;
    parts.push(c.maxAmount != null && c.mode === 'PERCENT' ? `${v} (max ${rupees(c.maxAmount)})` : v);
  }
  return parts.join(' · ') || 'No benefit';
}

/** First range when an admin starts using ranges: today's single benefit, covering every bill. */
export function rangeFromSingle(benefits: PromoEngineBenefit[]): PromoRangeDraft {
  return {
    key: newRangeKey(),
    label: '',
    minAmount: null,
    maxAmount: null,
    active: true,
    benefitJson: benefits.map((b) => ({ ...b })),
    limits: {},
  };
}

/**
 * Next range starts where the previous one ends. An open-ended previous range gets a ceiling
 * first so the two never overlap. Benefits are copied so the admin only edits what changes.
 */
export function appendRange(ranges: PromoRangeDraft[]): PromoRangeDraft[] {
  if (!ranges.length) return [rangeFromSingle([])];
  const last = ranges[ranges.length - 1];
  const ceiling = last.maxAmount ?? (last.minAmount ?? 0) + DEFAULT_RANGE_WIDTH;
  const closed = ranges.map((r, i) => (i === ranges.length - 1 ? { ...r, maxAmount: ceiling } : r));
  return [
    ...closed,
    {
      key: newRangeKey(),
      label: '',
      minAmount: ceiling,
      maxAmount: null,
      active: true,
      benefitJson: last.benefitJson.map((b) => ({ ...b })),
      limits: {},
    },
  ];
}

export function updateRange(
  ranges: PromoRangeDraft[],
  key: string,
  patch: Partial<PromoRangeDraft>,
): PromoRangeDraft[] {
  return ranges.map((r) => (r.key === key ? { ...r, ...patch } : r));
}

/** Removing the only range returns the promotion to a single offer for every bill. */
export function removeRange(draft: PromoEngineDraft, key: string): PromoEngineDraft {
  const ranges = draft.ranges || [];
  const removed = ranges.find((r) => r.key === key);
  const rest = ranges.filter((r) => r.key !== key);
  if (rest.length || !removed) return { ...draft, ranges: rest };
  const benefitJson = nonZeroBenefits(removed.benefitJson);
  const mode = benefitModeOf(benefitJson);
  return {
    ...draft,
    ranges: [],
    benefitJson,
    vcf:
      draft.vcf && mode
        ? {
            ...draft.vcf,
            benefitMode: mode,
            maxDiscount: discountOf(benefitJson).maxAmount ?? draft.vcf.maxDiscount,
          }
        : draft.vcf,
  };
}

/** Helper line under the floor/ceiling inputs; a floor equal to the previous ceiling is exclusive. */
export function rangeAppliesText(r: PromoRangeDraft, prev: PromoRangeDraft | undefined): string {
  const min = r.minAmount ?? 0;
  const sharesBoundary = prev?.maxAmount != null && prev.maxAmount === r.minAmount;
  const lower = sharesBoundary ? `above ${rupees(min)}` : `of ${rupees(min)} or more`;
  if (r.maxAmount == null) return `Applies to bills ${lower}`;
  return `Applies to bills ${lower} and up to ${rupees(r.maxAmount)}`;
}

/** Sorted by floor, the order the engine matches in. */
export function sortedRanges(ranges: PromoRangeDraft[] | undefined): PromoRangeDraft[] {
  return [...(ranges || [])].sort((a, b) => (a.minAmount ?? 0) - (b.minAmount ?? 0));
}

export function hasRanges(draft: Pick<PromoEngineDraft, 'ranges'>): boolean {
  return (draft.ranges?.length ?? 0) > 0;
}

/** Blocking errors (save refuses) — mirrors the API checks. */
export function validateRangesDraft(ranges: PromoRangeDraft[] | undefined): string[] {
  if (!ranges?.length) return [];
  const errors: string[] = [];
  if (ranges.length > MAX_RANGES) errors.push(`At most ${MAX_RANGES} ranges per promotion`);
  const sorted = sortedRanges(ranges);
  sorted.forEach((r, i) => {
    const name = `Range ${i + 1}`;
    const min = r.minAmount;
    const max = r.maxAmount;
    if (min != null && min < 0) errors.push(`${name}: minimum must be 0 or more`);
    if (max != null && max <= (min ?? 0)) errors.push(`${name}: maximum must be above the minimum`);
    if (max == null && i < sorted.length - 1) {
      errors.push(`${name}: only the last range can have no maximum`);
    }
    const prev = sorted[i - 1];
    if (prev && prev.maxAmount != null && (min ?? 0) < prev.maxAmount) {
      errors.push(`${name} overlaps Range ${i}`);
    }
    if (r.active && !benefitModeOf(r.benefitJson)) {
      errors.push(`${name}: add a discount or cashback (or switch the range off)`);
    }
    for (const b of r.benefitJson) {
      if (b.mode === 'PERCENT' && Number(b.value) > 100) {
        errors.push(`${name}: ${b.type.toLowerCase()} % cannot exceed 100`);
      }
      if (b.type === 'CASHBACK' && Number(b.value) > 0 && !(Number(b.expiryDays) > 0)) {
        errors.push(`${name}: cashback needs expiry days`);
      }
    }
    errors.push(...validateRangeLimits(r.limits).map((e) => `${name}: ${e}`));
    errors.push(...validateCustomerCopyDraft(r.customerCopy).map((e) => `${name}: ${e}`));
  });
  return errors;
}

export function validateRangeLimits(limits: PromoRangeLimits): string[] {
  const errors: string[] = [];
  const counts: Array<[keyof PromoRangeLimits, string]> = [
    ['perUser', 'per-customer limit'],
    ['dailyLimit', 'daily limit'],
    ['campaignLimit', 'total uses'],
  ];
  for (const [key, label] of counts) {
    const v = limits[key];
    if (v != null && (!Number.isInteger(v) || v < 0)) errors.push(`${label} must be a whole number (0 or more)`);
  }
  if (limits.budgetLimit != null && (!Number.isFinite(limits.budgetLimit) || limits.budgetLimit < 0)) {
    errors.push('budget must be 0 or more');
  }
  return errors;
}

/** Non-blocking warnings shown under the range list. */
export function rangeWarnings(
  ranges: PromoRangeDraft[] | undefined,
  promoBudget: number | null | undefined,
): string[] {
  if (!ranges?.length) return [];
  const warnings: string[] = [];
  const sorted = [...ranges].sort((a, b) => (a.minAmount ?? 0) - (b.minAmount ?? 0));
  const first = sorted[0];
  if ((first.minAmount ?? 0) > 0) {
    warnings.push(`Bills below ${rupees(first.minAmount ?? 0)} get no offer from this promotion`);
  }
  for (let i = 1; i < sorted.length; i++) {
    const prevMax = sorted[i - 1].maxAmount;
    const min = sorted[i].minAmount ?? 0;
    if (prevMax != null && min > prevMax) {
      warnings.push(`Bills between ${rupees(prevMax)} and ${rupees(min)} get no offer from this promotion`);
    }
  }
  const last = sorted[sorted.length - 1];
  if (last.maxAmount != null) {
    warnings.push(`Bills above ${rupees(last.maxAmount)} get no offer from this promotion`);
  }
  sorted.forEach((r) => {
    const d = discountOf(r.benefitJson);
    const floor = r.minAmount ?? 0;
    if (r.active && d.mode === 'FIXED' && Number(d.value) > 0 && floor > 0 && Number(d.value) >= floor) {
      warnings.push(
        `${rangeBoundsLabel(r)}: ₹${d.value} off covers the whole bill at ${rupees(floor)}`,
      );
    }
  });
  const rangeBudgets = ranges.map((r) => r.limits.budgetLimit).filter((v): v is number => v != null);
  if (promoBudget != null && rangeBudgets.some((v) => v > promoBudget)) {
    warnings.push('A range budget is above the promotion budget; the promotion budget still caps total spend');
  }
  return warnings;
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function cleanCopy(copy: PromoCustomerCopy | undefined): PromoCustomerCopy | null {
  if (!copy) return null;
  const out: PromoCustomerCopy = {};
  for (const [k, v] of Object.entries(copy)) {
    const s = typeof v === 'string' ? v.trim() : '';
    if (s) out[k as keyof PromoCustomerCopy] = s;
  }
  return Object.keys(out).length ? out : null;
}

export function rangesToApi(ranges: PromoRangeDraft[] | undefined): Array<Record<string, unknown>> {
  return sortedRanges(ranges).map((r) => ({
    id: r.id,
    label: r.label.trim() || null,
    minAmount: r.minAmount,
    maxAmount: r.maxAmount,
    active: r.active,
    benefitJson: nonZeroBenefits(r.benefitJson),
    customerCopy: cleanCopy(r.customerCopy),
    limits: {
      perUser: r.limits.perUser ?? null,
      dailyLimit: r.limits.dailyLimit ?? null,
      campaignLimit: r.limits.campaignLimit ?? null,
      budgetLimit: r.limits.budgetLimit ?? null,
    },
  }));
}

export function rangesFromApi(raw: unknown): PromoRangeDraft[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const r = (item || {}) as Record<string, unknown>;
    const limits = (r.limits || {}) as Record<string, unknown>;
    const usage = (r.usage || {}) as Record<string, unknown>;
    const id = r.id ? String(r.id) : undefined;
    return {
      key: id || newRangeKey(),
      id,
      label: typeof r.label === 'string' ? r.label : '',
      minAmount: numOrNull(r.minAmount),
      maxAmount: numOrNull(r.maxAmount),
      active: r.active !== false,
      benefitJson: Array.isArray(r.benefitJson) ? (r.benefitJson as PromoEngineBenefit[]) : [],
      customerCopy:
        r.customerCopy && typeof r.customerCopy === 'object'
          ? (r.customerCopy as PromoCustomerCopy)
          : undefined,
      limits: {
        perUser: numOrNull(limits.perUser),
        dailyLimit: numOrNull(limits.dailyLimit),
        campaignLimit: numOrNull(limits.campaignLimit),
        budgetLimit: numOrNull(limits.budgetLimit),
      },
      budgetConsumed: numOrNull(r.budgetConsumed) ?? 0,
      usage: {
        uses: Number(usage.uses ?? 0),
        discount: Number(usage.discount ?? 0),
        cashback: Number(usage.cashback ?? 0),
      },
    };
  });
}

/**
 * Keep promo-level fields coherent while ranges drive benefits: `benefitJson` mirrors the first
 * range (older readers), and vcf.benefitMode / expiryDays reflect what the ranges give.
 */
export function syncPromoFromRanges(draft: PromoEngineDraft): PromoEngineDraft {
  const ranges = draft.ranges || [];
  if (!ranges.length) return draft;
  const modes = new Set(ranges.map((r) => benefitModeOf(r.benefitJson)).filter(Boolean));
  const anyDiscount = modes.has('discount') || modes.has('both');
  const anyCashback = modes.has('cashback') || modes.has('both');
  const benefitMode: PromoVcfDraft['benefitMode'] =
    anyDiscount && anyCashback ? 'both' : anyCashback ? 'cashback' : 'discount';
  const firstCashback = ranges.map((r) => cashbackOf(r.benefitJson)).find((c) => c && Number(c.value) > 0);
  return {
    ...draft,
    benefitJson: nonZeroBenefits(sortedRanges(ranges)[0].benefitJson),
    vcf: draft.vcf
      ? {
          ...draft.vcf,
          benefitMode,
          expiryDays: firstCashback?.expiryDays ?? draft.vcf.expiryDays,
        }
      : draft.vcf,
  };
}
