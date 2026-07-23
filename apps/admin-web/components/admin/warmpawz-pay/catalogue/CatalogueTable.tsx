'use client';

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
import { Eye, Trash2, Upload, Download } from 'lucide-react';
import type { CatalogueListItem } from '@/lib/warmpawz-pay-catalogue-admin';
import { formatCatalogueDate, formatCatalogueCategory, shortVendorId } from '@/lib/warmpawz-pay-catalogue-admin';
import { EligibilityBadge } from './EligibilityBadge';
import { EmptyState } from './EmptyState';
import { StatusBadge } from './StatusBadge';

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
}: CatalogueTableProps) {
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
            <TableHead>Vendor</TableHead>
            <TableHead>Business Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Customer Visible</TableHead>
            <TableHead>Updated At</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const rowBusy = rowBusyId === item.catalogueId;
            const rowDisabled = disabled || rowBusy;

            return (
              <TableRow key={item.catalogueId}>
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
                <TableCell className="font-mono text-xs text-gray-600">
                  {shortVendorId(item.vendorId)}
                </TableCell>
                <TableCell>
                  <div className="font-medium text-gray-900">{item.businessName}</div>
                  {item.ownerName ? (
                    <div className="text-xs text-gray-500">{item.ownerName}</div>
                  ) : null}
                </TableCell>
                <TableCell className="text-gray-500">{formatCatalogueCategory(item)}</TableCell>
                <TableCell>
                  <StatusBadge status={item.publishStatus} />
                </TableCell>
                <TableCell>
                  <EligibilityBadge customerVisible={item.eligibility.customerVisible} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-gray-600">
                  {formatCatalogueDate(item.updatedAt)}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
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
                      >
                        <Upload className="h-4 w-4" />
                        <span className="sr-only">Publish</span>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={rowDisabled}
                        onClick={() => onUnpublish(item.catalogueId)}
                      >
                        <Download className="h-4 w-4" />
                        <span className="sr-only">Unpublish</span>
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={rowDisabled}
                      onClick={() => onDelete(item.catalogueId)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                      <span className="sr-only">Delete</span>
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
