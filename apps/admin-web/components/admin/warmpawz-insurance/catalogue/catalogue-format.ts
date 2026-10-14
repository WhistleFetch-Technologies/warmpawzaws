import { formatInr } from '@/components/admin/warmpawz-insurance/shared/insurance-ui';
import {
  COMMISSION_BASIS_SHORT_LABELS,
  PAYOUT_FREQUENCY_SHORT_LABELS,
  type CommissionTerms,
  type PayoutSchedule,
  type VendorLink,
} from '@/lib/warmpawz-insurance-admin';

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0][0] ?? '';
  const second = words.length > 1 ? words[words.length - 1][0] : words[0][1] ?? '';
  return `${first}${second}`.toUpperCase();
}

export function linkFrequencyLabel(link: VendorLink, platformDefault: PayoutSchedule | undefined): string {
  if (link.scheduleOverride) return PAYOUT_FREQUENCY_SHORT_LABELS[link.scheduleOverride.frequency];
  return platformDefault ? PAYOUT_FREQUENCY_SHORT_LABELS[platformDefault.frequency] : 'Platform default';
}

export function commissionTypeLabel(terms: CommissionTerms | null): string {
  return terms ? COMMISSION_BASIS_SHORT_LABELS[terms.basis] : '-';
}

export function commissionValueLabel(terms: CommissionTerms | null): string {
  if (!terms) return '-';
  return terms.basis === 'fixed_per_policy' ? formatInr(terms.rate, 2) : `${terms.rate}%`;
}
