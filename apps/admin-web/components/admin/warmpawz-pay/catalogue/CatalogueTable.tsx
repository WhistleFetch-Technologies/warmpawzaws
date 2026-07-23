'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import {
  Button,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@warmpawz/ui';
import { ChevronDown, ChevronRight, Eye, Percent, Trash2, Upload, Download } from 'lucide-react';
import type { CatalogueListItem } from '@/lib/warmpawz-pay-catalogue-admin';
import {
  formatCatalogueCategory,
  formatCatalogueDate,
  formatCatalogueDiscount,
  shortVendorId,
} from '@/lib/warmpawz-pay-catalogue-admin';
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
  readonly selectedIds: ReadonlySet<string>;
  readonly rowBusyId?: string | null;
  readonly disabled?: boolean;
  readonly onToggleAll: (checked: boolean) => void;
  readonly onToggleOne: (catalogueId: string, checked: boolean) => void;
  readonly onPublish: (catalogueId: string) => void;
  readonly onUnpublish: (catalogueId: string) => void;
  readonly onDelete: (catalogueId: string) => void;
  readonly onEditPricing: (item: CatalogueListItem) => void;
}

export function CatalogueTable({
  items,
  selectedIds,
  rowBusyId = null,
  disabled = false,
  onToggleAll,
  onToggleOne,
  onPublish,
  onUnpublish,
  onDelete,
  onEditPricing,
}: CatalogueTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const allSelected = items.length > 0 && items.every((item) => selectedIds.has(item.catalogueId));
  const someSelected = items.some((item) => selectedIds.has(item.catalogueId));

  if (items.length === 0) {
    return (
      <EmptyState
        title="No catalogue entries found"
        description="Adjust filters or add a vendor to get started."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                onCheckedChange={(checked) => onToggleAll(checked === true)}
                disabled={disabled}
                aria-label="Select all rows"
              />
            </TableHead>
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
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const rowBusy = rowBusyId === item.catalogueId;
            const rowDisabled = disabled || rowBusy;
            const expanded = expandedId === item.catalogueId;

            return (
              <Fragment key={item.catalogueId}>
                <TableRow>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(item.catalogueId)}
                      onCheckedChange={(checked) =>
                        onToggleOne(item.catalogueId, checked === true)
                      }
                      disabled={rowDisabled}
                      aria-label={`Select ${item.businessName}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setExpandedId(expanded ? null : item.catalogueId)}
                      aria-expanded={expanded}
                      aria-label={`${expanded ? 'Collapse' : 'Expand'} readiness for ${item.businessName}`}
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
                  <TableCell className="text-gray-600">{formatCatalogueCategory(item)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-gray-900">
                        {formatCatalogueDiscount(item)}
                      </span>
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
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={rowDisabled}
                        onClick={() => onEditPricing(item)}
                        aria-label={`Edit pricing for ${item.businessName}`}
                      >
                        <Percent className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="sm" variant="ghost" asChild disabled={rowDisabled}>
                        <Link href={`/warmpawz-pay/catalogue/${item.catalogueId}`}>
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">View</span>
                        </Link>
                      </Button>
                      {item.publishStatus === 'draft' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={rowDisabled}
                          onClick={() => onPublish(item.catalogueId)}
                          aria-label={`Publish ${item.businessName}`}
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={rowDisabled}
                          onClick={() => onUnpublish(item.catalogueId)}
                          aria-label={`Save draft for ${item.businessName}`}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={rowDisabled}
                        onClick={() => onDelete(item.catalogueId)}
                        aria-label={`Delete ${item.businessName}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {expanded ? (
                  <TableRow>
                    <TableCell colSpan={12} className="bg-gray-50">
                      <ReadinessDetailPanel readiness={item.readiness} />
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
