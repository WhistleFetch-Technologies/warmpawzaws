'use client';

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

export function PaymentsTable({
  items,
  page,
  pageSize,
  total,
  onPageChange,
}: PaymentsTableProps) {
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
              <TableHead>Customer</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead className="text-right">Amount Quoted</TableHead>
              <TableHead className="text-right">Discount (%)</TableHead>
              <TableHead className="text-right">Discounted Amount Paid</TableHead>
              <TableHead className="text-right">Paid At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.paymentId}>
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
                </TableCell>
                <TableCell className="text-right">{formatWpayInr(item.originalAmount)}</TableCell>
                <TableCell className="text-right">
                  <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                    {item.discountPercent}%
                  </span>
                </TableCell>
                <TableCell className="text-right font-semibold text-green-700">
                  {formatWpayInr(item.payableAmount)}
                </TableCell>
                <TableCell className="text-right text-sm text-gray-600">
                  {formatWpayPaidAt(item.paidAt)}
                </TableCell>
              </TableRow>
            ))}
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
          disabled={false}
        />
      </div>
    </div>
  );
}
