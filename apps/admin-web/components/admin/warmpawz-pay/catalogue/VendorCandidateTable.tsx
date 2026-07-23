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
import type { VendorCandidateDTO } from '@/lib/warmpawz-pay-catalogue-admin';
import { shortVendorId } from '@/lib/warmpawz-pay-catalogue-admin';
import { EligibilityBadge } from './EligibilityBadge';
import { EmptyState } from './EmptyState';

export interface VendorCandidateTableProps {
  readonly items: readonly VendorCandidateDTO[];
  readonly selectedVendorId?: string | null;
  readonly disabled?: boolean;
  readonly onSelect: (vendorId: string) => void;
}

export function VendorCandidateTable({
  items,
  selectedVendorId = null,
  disabled = false,
  onSelect,
}: VendorCandidateTableProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No vendor candidates found"
        description="Try a different search term or vendor status filter."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead>Vendor</TableHead>
            <TableHead>Business Name</TableHead>
            <TableHead>City</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Pay Bill</TableHead>
            <TableHead>Bank Verified</TableHead>
            <TableHead className="text-right">Select</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const selected = selectedVendorId === item.vendorId;
            const customerVisible =
              item.status === 'active' && item.payBillEnabled && item.bankVerified;

            return (
              <TableRow
                key={item.vendorId}
                className={selected ? 'bg-orange-50' : undefined}
              >
                <TableCell className="font-mono text-xs text-gray-600">
                  {shortVendorId(item.vendorId)}
                </TableCell>
                <TableCell className="font-medium">{item.businessName}</TableCell>
                <TableCell>{item.city ?? '—'}</TableCell>
                <TableCell className="capitalize">{item.status}</TableCell>
                <TableCell>{item.payBillEnabled ? 'Yes' : 'No'}</TableCell>
                <TableCell>{item.bankVerified ? 'Yes' : 'No'}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <EligibilityBadge customerVisible={customerVisible} />
                    <Button
                      type="button"
                      size="sm"
                      variant={selected ? 'default' : 'outline'}
                      disabled={disabled}
                      onClick={() => onSelect(item.vendorId)}
                    >
                      {selected ? 'Selected' : 'Select'}
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
