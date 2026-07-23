'use client';

import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@warmpawz/ui';
import { Eye, Pencil, Power, PowerOff, Trash2 } from 'lucide-react';
import type { PricingListItem } from '@/lib/warmpawz-pay-pricing-admin';
import {
  formatDiscountValue,
  formatPricingDate,
  shortVendorId,
} from '@/lib/warmpawz-pay-pricing-admin';
import { EmptyState } from '@/components/admin/warmpawz-pay/catalogue/EmptyState';
import { PricingStatusBadge } from './PricingStatusBadge';

export interface PricingTableProps {
  readonly items: readonly PricingListItem[];
  readonly rowBusyId?: string | null;
  readonly disabled?: boolean;
  readonly onView: (item: PricingListItem) => void;
  readonly onEdit: (item: PricingListItem) => void;
  readonly onEnable: (item: PricingListItem) => void;
  readonly onDisable: (item: PricingListItem) => void;
  readonly onDelete: (item: PricingListItem) => void;
}

export function PricingTable({
  items,
  rowBusyId = null,
  disabled = false,
  onView,
  onEdit,
  onEnable,
  onDisable,
  onDelete,
}: PricingTableProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No pricing configurations found"
        description="Create pricing for a catalogue merchant to get started."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead>Merchant</TableHead>
            <TableHead>Business Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Discount Type</TableHead>
            <TableHead>Discount Value</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Effective From</TableHead>
            <TableHead>Effective Until</TableHead>
            <TableHead>Last Updated</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const rowBusy = rowBusyId === item.vendorId;
            const rowDisabled = disabled || rowBusy;

            return (
              <TableRow key={item.pricingId}>
                <TableCell>
                  <div className="font-medium text-gray-900">{item.merchantName}</div>
                  <div className="font-mono text-xs text-gray-500">{shortVendorId(item.vendorId)}</div>
                </TableCell>
                <TableCell>{item.businessName}</TableCell>
                <TableCell>{item.category}</TableCell>
                <TableCell className="capitalize">{item.discountType}</TableCell>
                <TableCell>
                  {formatDiscountValue(item.discountType, item.discountValue)}
                </TableCell>
                <TableCell>
                  <PricingStatusBadge status={item.status} />
                </TableCell>
                <TableCell>{formatPricingDate(item.effectiveFrom)}</TableCell>
                <TableCell>{formatPricingDate(item.effectiveUntil)}</TableCell>
                <TableCell>{formatPricingDate(item.updatedAt)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={rowDisabled}
                      aria-label={`View ${item.businessName}`}
                      onClick={() => onView(item)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={rowDisabled}
                      aria-label={`Edit ${item.businessName}`}
                      onClick={() => onEdit(item)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {item.status === 'active' ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={rowDisabled}
                        aria-label={`Disable ${item.businessName}`}
                        onClick={() => onDisable(item)}
                      >
                        <PowerOff className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={rowDisabled}
                        aria-label={`Enable ${item.businessName}`}
                        onClick={() => onEnable(item)}
                      >
                        <Power className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={rowDisabled}
                      aria-label={`Delete ${item.businessName}`}
                      onClick={() => onDelete(item)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
