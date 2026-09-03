'use client';

import React, { Fragment, useEffect, useState } from 'react';
import {
  Button,
  Checkbox,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@warmpawz/ui';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import type { CatalogueListItem } from '@/lib/warmpawz-appointments-catalogue-admin';
import {
  formatAppointmentFee,
  formatCatalogueDate,
  isValidAppointmentFee,
  shortVendorId,
} from '@/lib/warmpawz-appointments-catalogue-admin';
import { MerchantCategoryCell } from './MerchantCategoryCell';
import { EligibilityBadge } from './EligibilityBadge';
import { EmptyState } from './EmptyState';
import { PlatformStatusBadge } from './PlatformStatusBadge';
import { ReadinessDetailPanel } from './ReadinessDetailPanel';
import { ReadinessIndicator } from './ReadinessIndicator';
import { StatusBadge } from './StatusBadge';
import { WarmpawzAppointmentsStatusBadge } from './WarmpawzAppointmentsStatusBadge';

export interface CatalogueTableProps {
  readonly items: readonly CatalogueListItem[];
  readonly selectedCatalogueIds: ReadonlySet<string>;
  readonly onSelectionChange: (catalogueIds: ReadonlySet<string>) => void;
  readonly rowBusyVendorId?: string | null;
  readonly disabled?: boolean;
  readonly onSaveFee: (item: CatalogueListItem, appointmentFee: number) => Promise<void>;
  readonly onPublish: (item: CatalogueListItem, appointmentFee: number) => Promise<void>;
  readonly onUnpublish: (item: CatalogueListItem) => void;
  readonly onDelete: (item: CatalogueListItem) => void;
}

function initialFeeValue(item: CatalogueListItem): string {
  if (item.appointmentFee !== null && item.appointmentFee !== undefined) {
    return String(item.appointmentFee);
  }
  return '';
}

export function CatalogueTable({
  items,
  selectedCatalogueIds,
  onSelectionChange,
  rowBusyVendorId = null,
  disabled = false,
  onSaveFee,
  onPublish,
  onUnpublish,
  onDelete,
}: CatalogueTableProps) {
  const [expandedVendorId, setExpandedVendorId] = useState<string | null>(null);
  const [feeByVendor, setFeeByVendor] = useState<Record<string, string>>({});

  useEffect(() => {
    setFeeByVendor((current) => {
      const next = { ...current };
      for (const item of items) {
        if (next[item.vendorId] === undefined) {
          next[item.vendorId] = initialFeeValue(item);
        }
      }
      return next;
    });
  }, [items]);

  const selectableItems = items.filter((item): item is CatalogueListItem & { catalogueId: string } =>
    Boolean(item.catalogueId),
  );
  const allSelected =
    selectableItems.length > 0 &&
    selectableItems.every((item) => selectedCatalogueIds.has(item.catalogueId));
  const someSelected = selectableItems.some((item) => selectedCatalogueIds.has(item.catalogueId));

  if (items.length === 0) {
    return (
      <EmptyState
        title="No approved vendors found"
        description="Adjust filters or wait for vendors to complete onboarding."
      />
    );
  }

  const updateFee = (vendorId: string, value: string) => {
    setFeeByVendor((current) => ({ ...current, [vendorId]: value }));
  };

  const toggleRowSelection = (catalogueId: string, checked: boolean) => {
    const next = new Set(selectedCatalogueIds);
    if (checked) {
      next.add(catalogueId);
    } else {
      next.delete(catalogueId);
    }
    onSelectionChange(next);
  };

  const toggleSelectAll = (checked: boolean) => {
    if (!checked) {
      onSelectionChange(new Set());
      return;
    }
    onSelectionChange(new Set(selectableItems.map((item) => item.catalogueId)));
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                disabled={disabled || selectableItems.length === 0}
                aria-label="Select all catalogue entries on this page"
                onCheckedChange={(checked: boolean) => toggleSelectAll(checked === true)}
              />
            </TableHead>
            <TableHead className="w-10" />
            <TableHead>Vendor</TableHead>
            <TableHead>Business Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Appointment Fee</TableHead>
            <TableHead>Publish Status</TableHead>
            <TableHead>Appointments Status</TableHead>
            <TableHead>Readiness</TableHead>
            <TableHead>Customer Visible</TableHead>
            <TableHead>Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const rowBusy = rowBusyVendorId === item.vendorId;
            const rowDisabled = disabled || (rowBusyVendorId !== null && !rowBusy);
            const expanded = expandedVendorId === item.vendorId;
            const feeValue = feeByVendor[item.vendorId] ?? '';
            const feeValid = isValidAppointmentFee(feeValue);
            const canUnpublish = item.publishStatus === 'published' && item.catalogueId;
            const canDelete = item.inCatalogue && item.catalogueId;
            const isSelected = item.catalogueId ? selectedCatalogueIds.has(item.catalogueId) : false;

            return (
              <Fragment key={item.vendorId}>
                <TableRow>
                  <TableCell>
                    {item.catalogueId ? (
                      <Checkbox
                        checked={isSelected}
                        disabled={rowDisabled}
                        aria-label={`Select ${item.businessName}`}
                        onCheckedChange={(checked: boolean) =>
                          toggleRowSelection(item.catalogueId!, checked === true)
                        }
                      />
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setExpandedVendorId(expanded ? null : item.vendorId)
                      }
                      aria-expanded={expanded}
                      aria-label={`${expanded ? 'Collapse' : 'Expand'} ${item.businessName}`}
                      disabled={rowDisabled}
                    >
                      {expanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-gray-600">
                    {shortVendorId(item.vendorId)}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-gray-900">{item.businessName}</div>
                    {item.ownerName ? (
                      <div className="text-xs text-gray-500">{item.ownerName}</div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <MerchantCategoryCell
                      serviceCategory={item.serviceCategory}
                      roleLabel={item.roleLabel}
                      category={item.category}
                    />
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium text-gray-900">
                      {formatAppointmentFee(item.appointmentFee)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={item.publishStatus} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <WarmpawzAppointmentsStatusBadge status={item.warmpawzAppointmentsStatus} />
                      <PlatformStatusBadge status={item.platformStatus} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <ReadinessIndicator readiness={item.readiness} />
                  </TableCell>
                  <TableCell>
                    <EligibilityBadge customerVisible={item.customerVisible} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-gray-600">
                    {formatCatalogueDate(item.updatedAt)}
                  </TableCell>
                </TableRow>
                {expanded ? (
                  <TableRow>
                    <TableCell colSpan={11} className="bg-gray-50 p-4">
                      <div className="space-y-4">
                        <ReadinessDetailPanel readiness={item.readiness} />
                        <div className="flex flex-col gap-4 border-t border-gray-200 pt-4 lg:flex-row lg:items-end lg:justify-between">
                          <div className="max-w-xs space-y-2">
                            <div className="flex items-center gap-1.5">
                              <Label htmlFor={`fee-${item.vendorId}`}>Appointment Fee (₹)</Label>
                              <Info className="h-3.5 w-3.5 text-gray-400" aria-hidden />
                            </div>
                            <div className="relative">
                              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                                ₹
                              </span>
                              <Input
                                id={`fee-${item.vendorId}`}
                                type="number"
                                min={0}
                                step={0.01}
                                value={feeValue}
                                disabled={rowDisabled}
                                placeholder="499"
                                className="bg-white pl-8"
                                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                                  updateFee(item.vendorId, event.target.value)
                                }
                              />
                            </div>
                            <p className="text-xs text-gray-500">
                              Enter a non-negative fee with up to 2 decimal places
                            </p>
                          </div>
                          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                            <div className="space-y-1">
                              <Button
                                type="button"
                                variant="outline"
                                disabled={rowDisabled || !feeValid}
                                onClick={() => void onSaveFee(item, Number(feeValue))}
                              >
                                {rowBusy ? 'Saving…' : 'Save fee'}
                              </Button>
                              <p className="text-xs text-gray-500">
                                Creates catalogue draft if needed.
                              </p>
                            </div>
                            <div className="space-y-1">
                              <Button
                                type="button"
                                disabled={rowDisabled || !feeValid}
                                onClick={() => void onPublish(item, Number(feeValue))}
                              >
                                {rowBusy ? 'Publishing…' : 'Publish'}
                              </Button>
                              <p className="text-xs text-gray-500">
                                Saves fee and publishes for customer appointments.
                              </p>
                            </div>
                            {canUnpublish ? (
                              <Button
                                type="button"
                                variant="outline"
                                disabled={rowDisabled}
                                onClick={() => onUnpublish(item)}
                              >
                                Save as draft
                              </Button>
                            ) : null}
                            {canDelete ? (
                              <Button
                                type="button"
                                variant="outline"
                                disabled={rowDisabled}
                                className="text-red-600 hover:text-red-700"
                                onClick={() => onDelete(item)}
                              >
                                Delete catalogue
                              </Button>
                            ) : null}
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
