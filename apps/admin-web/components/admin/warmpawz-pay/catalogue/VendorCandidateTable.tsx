'use client';

import { Fragment, useState } from 'react';
import {
  Button,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@warmpawz/ui';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import type { VendorCandidateDTO } from '@/lib/warmpawz-pay-catalogue-admin';
import { EmptyState } from './EmptyState';
import { PlatformStatusBadge } from './PlatformStatusBadge';

export interface VendorCandidateTableProps {
  readonly items: readonly VendorCandidateDTO[];
  readonly disabled?: boolean;
  readonly busyVendorId?: string | null;
  readonly onSaveDraft: (vendorId: string, discountValue: number) => Promise<void>;
  readonly onPublish: (vendorId: string, discountValue: number) => Promise<void>;
}

function isValidDiscount(value: string): boolean {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 100;
}

export function VendorCandidateTable({
  items,
  disabled = false,
  busyVendorId = null,
  onSaveDraft,
  onPublish,
}: VendorCandidateTableProps) {
  const [expandedVendorId, setExpandedVendorId] = useState<string | null>(null);
  const [discountByVendor, setDiscountByVendor] = useState<Record<string, string>>({});

  if (items.length === 0) {
    return (
      <EmptyState
        title="No vendor candidates found"
        description="Adjust filters or try a different search term."
      />
    );
  }

  const toggleExpand = (vendorId: string) => {
    setExpandedVendorId((current) => (current === vendorId ? null : vendorId));
  };

  const updateDiscount = (vendorId: string, value: string) => {
    setDiscountByVendor((current) => ({ ...current, [vendorId]: value }));
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead>Business Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const expanded = expandedVendorId === item.vendorId;
            const discountValue = discountByVendor[item.vendorId] ?? '';
            const discountValid = isValidDiscount(discountValue);
            const rowBusy = busyVendorId === item.vendorId;
            const rowDisabled = disabled || (busyVendorId !== null && !rowBusy);

            return (
              <Fragment key={item.vendorId}>
                <TableRow>
                  <TableCell className="font-medium">{item.businessName}</TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>
                    <PlatformStatusBadge status={item.platformStatus} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={rowDisabled}
                      aria-expanded={expanded}
                      aria-label={expanded ? 'Collapse row' : 'Expand row'}
                      onClick={() => toggleExpand(item.vendorId)}
                    >
                      {expanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
                {expanded ? (
                  <TableRow className="bg-gray-50/80">
                    <TableCell colSpan={4} className="p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-xs space-y-2">
                          <div className="flex items-center gap-1.5">
                            <Label htmlFor={`discount-${item.vendorId}`}>
                              Discount Percentage
                            </Label>
                            <Info className="h-3.5 w-3.5 text-gray-400" aria-hidden />
                          </div>
                          <div className="relative">
                            <Input
                              id={`discount-${item.vendorId}`}
                              type="number"
                              min={1}
                              max={100}
                              step={1}
                              value={discountValue}
                              disabled={rowDisabled}
                              placeholder="15"
                              className="bg-white pr-8"
                              onChange={(event) =>
                                updateDiscount(item.vendorId, event.target.value)
                              }
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                              %
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            Enter discount percentage between 1% and 100%
                          </p>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                          <div className="space-y-1">
                            <Button
                              type="button"
                              variant="outline"
                              disabled={rowDisabled || !discountValid}
                              onClick={() => void onSaveDraft(item.vendorId, Number(discountValue))}
                            >
                              {rowBusy ? 'Saving…' : 'Save as Draft'}
                            </Button>
                            <p className="text-xs text-gray-500">
                              This will create a draft entry.
                            </p>
                          </div>
                          <div className="space-y-1">
                            <Button
                              type="button"
                              disabled={rowDisabled || !discountValid}
                              onClick={() => void onPublish(item.vendorId, Number(discountValue))}
                            >
                              {rowBusy ? 'Publishing…' : 'Publish'}
                            </Button>
                            <p className="text-xs text-gray-500">
                              This will publish and make it live.
                            </p>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
