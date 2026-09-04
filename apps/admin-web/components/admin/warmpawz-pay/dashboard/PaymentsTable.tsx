'use client';

import { Fragment, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@warmpawz/ui';
import {
  customerInitials,
  formatWpayInr,
  formatWpayPaidAt,
  formatWpayPercent,
  formatWpayPhone,
  type WpayAdminPaymentItem,
} from '@/lib/warmpawz-pay-payments-admin';
import { Pagination } from '@/components/admin/warmpawz-pay/catalogue/Pagination';

export interface PaymentsTableProps {
  readonly items: readonly WpayAdminPaymentItem[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly onPageChange: (page: number) => void;
}

function PaymentDetailDrawer({ item }: { item: WpayAdminPaymentItem }) {
  if (item.commercialModel === 'tier_commission') {
    const burnOn = item.burnMode === true;
    return (
      <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <span className="text-gray-500">Tier commission</span>
          <p className="font-medium">
            {burnOn ? 'N/A' : formatWpayPercent(item.commissionPercent ?? 0)}
          </p>
        </div>
        <div><span className="text-gray-500">Vendor payable</span><p className="font-medium">{formatWpayInr(item.vendorPayableAmount ?? item.vendorSettlementAmount)}</p></div>
        <div>
          <span className="text-gray-500">Platform revenue</span>
          <p className="font-medium">{burnOn ? 'N/A' : formatWpayInr(item.wpayRevenueAmount ?? 0)}</p>
        </div>
        <div>
          <span className="text-gray-500">Platform GST (inclusive)</span>
          <p className="font-medium">{burnOn ? 'N/A' : formatWpayInr(item.platformGstAmount ?? 0)}</p>
        </div>
        <div><span className="text-gray-500">Burn / Test</span><p className="font-medium">{burnOn ? 'On' : 'Off'}</p></div>
        <div>
          <span className="text-gray-500">Burn amount</span>
          <p className="font-medium">{formatWpayInr(item.burnAmount ?? 0)}</p>
        </div>
        <div><span className="text-gray-500">Platform fee</span><p className="font-medium">{formatWpayInr(item.platformFee ?? 0)}</p></div>
        <div><span className="text-gray-500">Platform fee GST</span><p className="font-medium">{formatWpayInr(item.platformFeeGstAmount ?? 0)}</p></div>
        <div><span className="text-gray-500">Convenience fee</span><p className="font-medium">{formatWpayInr(item.convenienceFee ?? 0)}</p></div>
        <div><span className="text-gray-500">Convenience GST</span><p className="font-medium">{formatWpayInr(item.convenienceGstAmount ?? 0)}</p></div>
        <div><span className="text-gray-500">Final GST</span><p className="font-semibold text-orange-700">{formatWpayInr(item.finalGstAmount ?? 0)}</p></div>
      </div>
    );
  }

  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
      <div><span className="text-gray-500">Platform withhold</span><p className="font-medium">{formatWpayPercent(item.platformWithholdPercent ?? 0)}</p></div>
      <div><span className="text-gray-500">Withhold amount</span><p className="font-medium">{formatWpayInr(item.platformWithholdAmount ?? 0)}</p></div>
      <div><span className="text-gray-500">Vendor settlement</span><p className="font-medium">{formatWpayInr(item.vendorSettlementAmount)}</p></div>
      <div><span className="text-gray-500">Model</span><p className="font-medium">Historical withhold</p></div>
    </div>
  );
}

export function PaymentsTable({
  items,
  page,
  pageSize,
  total,
  onPageChange,
}: PaymentsTableProps) {
  const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
        No Warmpawz Pay orders yet.
      </p>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Customer</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead className="text-right">Amount Quoted</TableHead>
              <TableHead className="text-right">Tier / Discount</TableHead>
              <TableHead className="text-right">Customer Paid</TableHead>
              <TableHead className="text-right">Platform Revenue</TableHead>
              <TableHead className="text-right">Final GST</TableHead>
              <TableHead className="text-right">Vendor Payable</TableHead>
              <TableHead className="text-right">Paid At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const expanded = expandedPaymentId === item.paymentId;
              const isTier = item.commercialModel === 'tier_commission';
              const burnOn = isTier && item.burnMode === true;
              return (
                <Fragment key={item.paymentId}>
                  <TableRow>
                    <TableCell>
                      <button
                        type="button"
                        className="text-xs text-gray-500 hover:text-gray-900"
                        onClick={() => setExpandedPaymentId(expanded ? null : item.paymentId)}
                      >
                        {expanded ? '−' : '+'}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-50 text-xs font-semibold text-orange-700">
                          {customerInitials(item.customer.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-900">{item.customer.name}</p>
                          <p className="truncate text-xs text-gray-500">
                            {formatWpayPhone(item.customer.phone)}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-gray-900">{item.vendor.name}</p>
                      <p className="text-xs text-gray-500">{item.vendor.category}</p>
                      {burnOn ? (
                        <span className="mt-1 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          N/A
                        </span>
                      ) : item.vendor.tierName ? (
                        <span className="mt-1 inline-flex rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-700">
                          {item.vendor.tierName}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">{formatWpayInr(item.originalAmount)}</TableCell>
                    <TableCell className="text-right">
                      {isTier ? (
                        <div className="space-y-1">
                          <span className="block text-xs text-gray-500">
                            C {burnOn ? 'N/A' : formatWpayPercent(item.commissionPercent ?? 0)}
                          </span>
                          <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                            D {item.discountPercent}%
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                          {item.discountPercent}%
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-green-700">
                      {formatWpayInr(item.payableAmount)}
                    </TableCell>
                    <TableCell className="text-right text-gray-800">
                      {isTier
                        ? burnOn
                          ? 'N/A'
                          : formatWpayInr(item.wpayRevenueAmount ?? 0)
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium text-orange-700">
                      {isTier ? formatWpayInr(item.finalGstAmount ?? 0) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-blue-700">
                      {formatWpayInr(
                        isTier
                          ? item.vendorPayableAmount ?? item.vendorSettlementAmount
                          : item.vendorSettlementAmount,
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm text-gray-600">
                      {formatWpayPaidAt(item.paidAt)}
                    </TableCell>
                  </TableRow>
                  {expanded ? (
                    <TableRow>
                      <TableCell colSpan={10} className="bg-gray-50 px-6 py-4">
                        <PaymentDetailDrawer item={item} />
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500">
          Showing {from}–{to} of {total} orders
        </p>
        <Pagination
          pagination={{ page, totalPages, total, pageSize }}
          onPageChange={onPageChange}
        />
      </div>
    </div>
  );
}
