'use client';

import { X } from 'lucide-react';
import { Button } from '@warmpawz/ui';
import type { BookingEarningsLine } from '@/lib/finance/settlement-audit-types';
import { dataSourceLabel, formatInr } from '@/lib/finance/settlement-audit-types';
import { winningOfferLabel } from '@/lib/finance/settlementExplanation';
import { SettlementExplanation } from './SettlementExplanation';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 border-b border-gray-100 pb-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="max-w-[55%] text-right font-medium text-gray-900">{value}</span>
    </div>
  );
}

function moneyOrDash(n: number, show = true) {
  if (!show) return '—';
  return formatInr(n);
}

export function SettlementBreakdownDrawer({
  open,
  line,
  onClose,
}: {
  open: boolean;
  line: BookingEarningsLine | null;
  onClose: () => void;
}) {
  if (!open || !line) return null;

  const b = line.settlementBreakdown;
  const legacy = !b.available;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30"
        aria-hidden
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col border-l border-gray-200 bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settlement-breakdown-title"
      >
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 id="settlement-breakdown-title" className="text-lg font-semibold text-gray-900">
              Settlement breakdown
            </h2>
            <p className="mt-1 text-xs text-gray-500 font-mono">{line.bookingId}</p>
            <p className="text-sm text-gray-600">
              {line.serviceName || 'Service'} · {line.customerName || 'Customer'}
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {legacy && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Legacy booking. Settlement snapshot unavailable. Customer waterfall and ledger amounts are shown below.
            </div>
          )}

          <Section title="Customer journey">
            <Row label="Vendor base price" value={moneyOrDash(b.vendorBasePrice, !legacy)} />
            <Row label="Vendor promotion" value={moneyOrDash(b.vendorPromotion, !legacy)} />
            <Row label="Platform promotion" value={moneyOrDash(b.platformPromotion, !legacy)} />
            <Row label="Vendor coupon" value={moneyOrDash(b.vendorCoupon, !legacy)} />
            <Row label="Platform coupon" value={moneyOrDash(b.platformCoupon, !legacy)} />
            <Row label="Winning offer" value={legacy ? '—' : winningOfferLabel(line)} />
            <Row label="GST" value={formatInr(line.gstTotal)} />
            <Row label="Customer paid" value={formatInr(line.customerPaidTotal)} />
          </Section>

          <Section title="Settlement">
            <Row label="Commission base" value={moneyOrDash(b.commissionBase, !legacy)} />
            <Row
              label="Commission %"
              value={legacy ? (line.commissionRate != null ? `${line.commissionRate}%` : '—') : `${b.commissionRate}%`}
            />
            <Row
              label="Commission amount"
              value={legacy ? formatInr(line.commissionAmount) : formatInr(b.commissionAmount)}
            />
            <Row
              label="Vendor settlement"
              value={legacy ? formatInr(line.vendorNet) : formatInr(b.vendorSettlement)}
            />
            <Row label="Platform revenue" value={moneyOrDash(b.platformRevenue, !legacy)} />
          </Section>

          {!legacy && (
            <Section title="Funding">
              <Row label="Vendor paid" value={formatInr(b.vendorPaid)} />
              <Row label="Platform paid" value={formatInr(b.platformPaid)} />
              <Row
                label="Shared funding"
                value={
                  b.sharedVendorPaid + b.sharedPlatformPaid > 0
                    ? `${formatInr(b.sharedVendorPaid)} vendor / ${formatInr(b.sharedPlatformPaid)} platform`
                    : '—'
                }
              />
              <Row label="Campaign funding" value={b.campaignPaid > 0 ? formatInr(b.campaignPaid) : '—'} />
            </Section>
          )}

          {!legacy && (
            <Section title="Policy">
              <Row label="Applied policy" value={b.appliedPolicy || b.policyVersion || '—'} />
              <Row label="Priority rule" value={b.priorityRule || '—'} />
              <Row label="Stack rule" value={b.stackRule || '—'} />
              <Row label="Funding rule" value={b.fundingRule || b.fundingType || '—'} />
              <Row label="Tier" value={b.tierName || '—'} />
              <Row label="Subscription" value={b.subscriptionActive ? 'Active' : 'None'} />
              <Row
                label="Policy fingerprint"
                value={
                  b.policyFingerprint ? (
                    <span className="font-mono text-xs break-all">{b.policyFingerprint}</span>
                  ) : (
                    '—'
                  )
                }
              />
            </Section>
          )}

          <Section title="Settlement status">
            <Row label="Settlement ID" value={b.settlementId || '—'} />
            <Row label="Settlement status" value={b.settlementStatus || '—'} />
            <Row label="Payout ID" value={b.payoutId || '—'} />
            <Row label="Payout status" value={b.payoutStatus || '—'} />
            <Row label="Realized date" value={line.realizedAt || '—'} />
            <Row label="Data source" value={dataSourceLabel(b.dataSource)} />
          </Section>

          <SettlementExplanation line={line} />
        </div>
      </aside>
    </>
  );
}
