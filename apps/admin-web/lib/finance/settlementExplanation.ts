import type { BookingEarningsLine } from './settlement-audit-types';
import { formatInr } from './settlement-audit-types';

export type SettlementExplanationStep = {
  label: string;
  amount?: string;
  detail?: string;
};

export function buildSettlementExplanationSteps(line: BookingEarningsLine): SettlementExplanationStep[] {
  const b = line.settlementBreakdown;
  if (!b.available) {
    return [
      { label: 'Legacy booking', detail: 'Settlement snapshot unavailable.' },
      { label: 'Customer paid (waterfall)', amount: formatInr(line.customerPaidTotal) },
      { label: 'Vendor net (ledger)', amount: formatInr(line.vendorNet) },
    ];
  }

  const steps: SettlementExplanationStep[] = [
    { label: 'Vendor listed service', amount: formatInr(b.vendorBasePrice) },
  ];

  const vendorDisc = b.vendorPromotion + b.vendorCoupon + b.sharedVendorPaid;
  if (vendorDisc > 0) {
    steps.push({
      label: b.vendorCoupon > 0 ? 'Vendor coupon' : 'Vendor promotion',
      amount: `-${formatInr(vendorDisc)}`,
    });
  }

  steps.push({
    label: 'Commission calculated on',
    amount: formatInr(b.commissionBase),
  });

  if (b.commissionRate > 0) {
    steps.push({
      label: `${b.commissionRate}% Commission`,
      amount: formatInr(b.commissionAmount),
    });
  } else {
    steps.push({ label: 'Commission', amount: formatInr(b.commissionAmount) });
  }

  steps.push({ label: 'Vendor settlement', amount: formatInr(b.vendorSettlement) });

  const platformDisc = b.platformPromotion + b.platformCoupon + b.sharedPlatformPaid;
  if (platformDisc > 0) {
    steps.push({
      label: b.platformCoupon > 0 ? 'Platform coupon' : 'Platform promotion',
      amount: formatInr(platformDisc),
      detail: b.fundingType === 'PLATFORM' ? 'Platform funded' : undefined,
    });
  }

  if (b.campaignPaid > 0) {
    steps.push({ label: 'Campaign funding', amount: formatInr(b.campaignPaid), detail: 'Future-ready' });
  }

  steps.push({ label: 'Customer paid', amount: formatInr(line.customerPaidTotal) });

  return steps;
}

export function winningOfferLabel(line: BookingEarningsLine): string {
  const b = line.settlementBreakdown;
  if (b.winningOfferName) return b.winningOfferName;
  if (b.winningOfferType) return b.winningOfferType.replace(/_/g, ' ');
  return '—';
}
