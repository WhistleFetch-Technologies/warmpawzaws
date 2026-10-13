import { canTransitionInsuranceStatus, normalizeInsuranceStatus, type InsuranceApplicationStatus } from '@warmpawz/shared-types';
import { estimateCommission, type CommissionTerms } from '../admin/domain/commission';

const POLICY_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const MAX_POLICY_BYTES = 10 * 1024 * 1024;

export function paymentLinkIssues(input: {
  url: string;
  domains: readonly string[];
  expiresAt: string;
  now: Date;
}): string[] {
  let host = '';
  try {
    const parsed = new URL(input.url);
    if (parsed.protocol !== 'https:') return ['Payment link must use https'];
    host = parsed.hostname.toLowerCase();
  } catch {
    return ['Payment link is not a valid URL'];
  }
  const allowed = input.domains.some((domain) => {
    const normalized = domain.trim().toLowerCase().replace(/^\*\./, '');
    return normalized !== '' && (host === normalized || host.endsWith(`.${normalized}`));
  });
  if (!allowed) return ['Payment link host is not on the company allowlist'];
  const expiry = new Date(input.expiresAt);
  if (Number.isNaN(expiry.getTime()) || expiry.getTime() <= input.now.getTime()) {
    return ['Payment link expiry must be in the future'];
  }
  return [];
}

export function policyDocumentIssues(input: {
  policyNumber: string;
  issuedPremium: number;
  startDate: string;
  endDate: string;
  documents: readonly { name: string; mime: string; size: number }[];
}): string[] {
  const issues: string[] = [];
  if (!input.policyNumber.trim()) issues.push('Policy number is required');
  if (!Number.isFinite(input.issuedPremium) || input.issuedPremium < 0) issues.push('Issued premium is required');
  if (!input.startDate || !input.endDate || input.endDate < input.startDate) issues.push('Policy dates are required');
  if (input.documents.length < 1) issues.push('At least one document is required');
  for (const doc of input.documents) {
    if (!POLICY_MIME.has(doc.mime)) issues.push(`${doc.name || 'Document'} must be a PDF or image`);
    if (doc.size > MAX_POLICY_BYTES) issues.push(`${doc.name || 'Document'} is over 10 MB`);
  }
  return issues;
}

export interface CommissionSnapshot {
  readonly basis: CommissionTerms['basis'];
  readonly rate: number;
  readonly vendorCommissionRate: number | null;
  readonly baseAmount: number;
  readonly commissionAmount: number;
  readonly gstRate: number;
  readonly gstAmount: number;
  readonly totalAmount: number;
  readonly termsId: string | null;
}

export function buildCommissionSnapshot(input: {
  terms: (CommissionTerms & { id?: string }) | null;
  premium: number;
  vendorCommissionAmount: number | null;
}): CommissionSnapshot | { error: string } {
  if (!input.terms || !Number.isFinite(input.terms.gstRate)) {
    return { error: 'GST rate is required before a policy can be confirmed' };
  }
  const priced = estimateCommission(input.terms, {
    premium: input.premium,
    vendorCommissionAmount: input.vendorCommissionAmount,
  });
  if (priced.missingBase) return { error: 'Commission terms cannot price this policy' };
  return {
    basis: input.terms.basis,
    rate: input.terms.rate,
    vendorCommissionRate: input.terms.vendorCommissionRate,
    baseAmount: priced.base,
    commissionAmount: priced.commission,
    gstRate: input.terms.gstRate,
    gstAmount: priced.gst,
    totalAmount: priced.total,
    termsId: input.terms.id ?? null,
  };
}

export function clawbackSnapshot(snapshot: CommissionSnapshot): CommissionSnapshot {
  return {
    ...snapshot,
    baseAmount: -snapshot.baseAmount,
    commissionAmount: -snapshot.commissionAmount,
    gstAmount: -snapshot.gstAmount,
    totalAmount: -snapshot.totalAmount,
  };
}

export function transitionBlockReason(
  fromRaw: string,
  to: InsuranceApplicationStatus,
  guards: { ok: boolean; reason: string }[] = [],
): string | null {
  const from = normalizeInsuranceStatus(fromRaw);
  if (!from) return `Unknown status ${fromRaw}`;
  if (!canTransitionInsuranceStatus(from, to)) return `Cannot move from ${from} to ${to}`;
  const failed = guards.find((guard) => !guard.ok);
  return failed ? failed.reason : null;
}

export function shouldAutoConfirm(uploadedAt: string, days: number, now: Date, alreadyConfirmed: boolean): boolean {
  if (alreadyConfirmed) return false;
  const uploaded = new Date(uploadedAt);
  if (Number.isNaN(uploaded.getTime())) return false;
  return now.getTime() - uploaded.getTime() >= days * 24 * 60 * 60 * 1000;
}

export function shouldExpirePaymentLink(expiresAt: string | null, now: Date, alreadyExpired: boolean): boolean {
  if (alreadyExpired || !expiresAt) return false;
  const expiry = new Date(expiresAt);
  return !Number.isNaN(expiry.getTime()) && expiry.getTime() <= now.getTime();
}

export function reportVariance(expected: number, reported: number): number {
  return Math.round((reported - expected) * 100) / 100;
}

export function canRegenerateReport(status: string): boolean {
  return status === 'draft';
}

export function receiptCoversExpected(amount: number, tds: number, expected: number): boolean {
  return amount + tds + 0.009 >= expected;
}

/** Close the open window the day before a frequency change so receipts stay attached. */
export function closeWindowOnFrequencyChange(periodEnd: string, changeDate: string): string {
  if (changeDate <= periodEnd) {
    const day = new Date(`${changeDate}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() - 1);
    return day.toISOString().slice(0, 10);
  }
  return periodEnd;
}
