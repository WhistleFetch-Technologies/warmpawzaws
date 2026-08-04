'use client';

import { Fragment, useEffect, useState } from 'react';
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
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import type { CatalogueListItem } from '@/lib/warmpawz-pay-catalogue-admin';
import type { WarmpawzPayPricingFormValues } from '@/lib/warmpawz-pay-pricing-admin';
import {
  formatCatalogueDate,
  formatCatalogueDiscount,
  shortVendorId,
} from '@/lib/warmpawz-pay-catalogue-admin';
import { MerchantCategoryCell } from './MerchantCategoryCell';
import { EligibilityBadge } from './EligibilityBadge';
import { EmptyState } from './EmptyState';
import { PlatformStatusBadge } from './PlatformStatusBadge';
import { PricingStatusBadge } from './PricingStatusBadge';
import { ReadinessDetailPanel } from './ReadinessDetailPanel';
import { ReadinessIndicator } from './ReadinessIndicator';
import { StatusBadge } from './StatusBadge';
import { WarmpawzPayStatusBadge } from './WarmpawzPayStatusBadge';

export interface CatalogueTableProps {
  readonly items: readonly CatalogueListItem[];
  readonly rowBusyVendorId?: string | null;
  readonly disabled?: boolean;
  readonly onSaveDiscount: (
    item: CatalogueListItem,
    values: WarmpawzPayPricingFormValues,
  ) => Promise<void>;
  readonly onPublish: (
    item: CatalogueListItem,
    values: WarmpawzPayPricingFormValues,
  ) => Promise<void>;
  readonly onUnpublish: (item: CatalogueListItem) => void;
  readonly onDelete: (item: CatalogueListItem) => void;
}

function isValidPercentValue(value: string, min: number, max: number): boolean {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max;
}

function initialDiscountValue(item: CatalogueListItem): string {
  if (item.pricing.configured && item.pricing.discountValue !== undefined) {
    return String(item.pricing.discountValue);
  }
  return '';
}

function initialWithholdValue(item: CatalogueListItem): string {
  if (item.pricing.configured && item.pricing.platformWithholdPercent !== undefined) {
    return String(item.pricing.platformWithholdPercent);
  }
  return '0';
}

function buildPricingFormValues(
  discountValue: string,
  withholdValue: string,
): WarmpawzPayPricingFormValues | null {
  if (!isValidPercentValue(discountValue, 1, 100)) {
    return null;
  }
  if (!isValidPercentValue(withholdValue, 0, 100)) {
    return null;
  }
  return {
    discountValue: Number(discountValue),
    platformWithholdPercent: Number(withholdValue),
  };
}

export function CatalogueTable({
  items,
  rowBusyVendorId = null,
  disabled = false,
  onSaveDiscount,
  onPublish,
  onUnpublish,
  onDelete,
}: CatalogueTableProps) {
  const [expandedVendorId, setExpandedVendorId] = useState<string | null>(null);
  const [discountByVendor, setDiscountByVendor] = useState<Record<string, string>>({});
  const [withholdByVendor, setWithholdByVendor] = useState<Record<string, string>>({});

  useEffect(() => {
    setDiscountByVendor((current) => {
      const next = { ...current };
      for (const item of items) {
        if (next[item.vendorId] === undefined) {
          next[item.vendorId] = initialDiscountValue(item);
        }
      }
      return next;
    });
    setWithholdByVendor((current) => {
      const next = { ...current };
      for (const item of items) {
        if (next[item.vendorId] === undefined) {
          next[item.vendorId] = initialWithholdValue(item);
        }
      }
      return next;
    });
  }, [items]);

  if (items.length === 0) {
    return (
      <EmptyState
        title="No approved vendors found"
        description="Adjust filters or wait for vendors to complete onboarding."
      />
    );
  }

  const updateDiscount = (vendorId: string, value: string) => {
    setDiscountByVendor((current) => ({ ...current, [vendorId]: value }));
  };

  const updateWithhold = (vendorId: string, value: string) => {
    setWithholdByVendor((current) => ({ ...current, [vendorId]: value }));
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="w-10" />
            <TableHead>Vendor</TableHead>
            <TableHead>Business Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Discount</TableHead>
            <TableHead>Publish Status</TableHead>
            <TableHead>Pay Status</TableHead>
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
            const discountValue = discountByVendor[item.vendorId] ?? '';
            const withholdValue = withholdByVendor[item.vendorId] ?? '0';
            const pricingValues = buildPricingFormValues(discountValue, withholdValue);
            const pricingValid = pricingValues !== null;
            const canUnpublish = item.publishStatus === 'published' && item.catalogueId;
            const canDelete = item.inCatalogue && item.catalogueId;

            return (
              <Fragment key={item.vendorId}>
                <TableRow>
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
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-gray-900">
                        {formatCatalogueDiscount(item)}
                      </span>
                      {item.pricing.platformWithholdPercent !== undefined ? (
                        <span className="text-xs text-gray-600">
                          Withhold {item.pricing.platformWithholdPercent}%
                        </span>
                      ) : null}
                      {item.pricing.status ? (
                        <PricingStatusBadge status={item.pricing.status} />
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={item.publishStatus} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <WarmpawzPayStatusBadge status={item.warmpawzPayStatus} />
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
                    <TableCell colSpan={10} className="bg-gray-50 p-4">
                      <div className="space-y-4">
                        <ReadinessDetailPanel readiness={item.readiness} />
                        <div className="flex flex-col gap-4 border-t border-gray-200 pt-4 lg:flex-row lg:items-end lg:justify-between">
                          <div className="flex flex-col gap-4 sm:flex-row">
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
                                Customer discount (1–100%). Platform-funded.
                              </p>
                            </div>
                            <div className="max-w-xs space-y-2">
                              <div className="flex items-center gap-1.5">
                                <Label htmlFor={`withhold-${item.vendorId}`}>
                                  Platform Withhold
                                </Label>
                                <Info className="h-3.5 w-3.5 text-gray-400" aria-hidden />
                              </div>
                              <div className="relative">
                                <Input
                                  id={`withhold-${item.vendorId}`}
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={0.5}
                                  value={withholdValue}
                                  disabled={rowDisabled}
                                  placeholder="5"
                                  className="bg-white pr-8"
                                  onChange={(event) =>
                                    updateWithhold(item.vendorId, event.target.value)
                                  }
                                />
                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                                  %
                                </span>
                              </div>
                              <p className="text-xs text-gray-500">
                                Platform share of customer paid amount (0–100%).
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                            <div className="space-y-1">
                              <Button
                                type="button"
                                variant="outline"
                                disabled={rowDisabled || !pricingValid}
                                onClick={() => {
                                  if (pricingValues) {
                                    void onSaveDiscount(item, pricingValues);
                                  }
                                }}
                              >
                                {rowBusy ? 'Saving…' : 'Save pricing'}
                              </Button>
                              <p className="text-xs text-gray-500">
                                Creates catalogue draft if needed.
                              </p>
                            </div>
                            <div className="space-y-1">
                              <Button
                                type="button"
                                disabled={rowDisabled || !pricingValid}
                                onClick={() => {
                                  if (pricingValues) {
                                    void onPublish(item, pricingValues);
                                  }
                                }}
                              >
                                {rowBusy ? 'Publishing…' : 'Publish'}
                              </Button>
                              <p className="text-xs text-gray-500">
                                Saves pricing and publishes to Pay Bill.
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
