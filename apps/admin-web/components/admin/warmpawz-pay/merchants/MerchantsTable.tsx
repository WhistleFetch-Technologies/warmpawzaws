'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@warmpawz/ui';
import { ChevronDown, ChevronRight, Eye } from 'lucide-react';
import type { MerchantListItem } from '@/lib/warmpawz-pay-merchants-admin';
import { shortVendorId } from '@/lib/warmpawz-pay-catalogue-admin';
import { EligibilityBadge } from '@/components/admin/warmpawz-pay/catalogue/EligibilityBadge';
import { EmptyState } from '@/components/admin/warmpawz-pay/catalogue/EmptyState';
import { PlatformStatusBadge } from './PlatformStatusBadge';
import { ReadinessDetailPanel } from './ReadinessDetailPanel';
import { ReadinessIndicator } from './ReadinessIndicator';
import { WarmpawzPayStatusBadge } from './WarmpawzPayStatusBadge';

export interface MerchantsTableProps {
  readonly items: readonly MerchantListItem[];
}

export function MerchantsTable({ items }: MerchantsTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <EmptyState
        title="No merchants found"
        description="Adjust filters or publish vendors in the catalogue to get started."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="w-10" />
            <TableHead>Vendor Name</TableHead>
            <TableHead>Business Name</TableHead>
            <TableHead>City</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Business Type</TableHead>
            <TableHead>Platform Status</TableHead>
            <TableHead>Warmpawz Pay Status</TableHead>
            <TableHead>Readiness</TableHead>
            <TableHead>Customer Visible</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const expanded = expandedId === item.catalogueId;

            return (
              <Fragment key={item.catalogueId}>
                <TableRow>
                  <TableCell>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setExpandedId(expanded ? null : item.catalogueId)
                      }
                      aria-expanded={expanded}
                      aria-label={`${expanded ? 'Collapse' : 'Expand'} readiness for ${item.businessName}`}
                    >
                      {expanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-gray-900">{item.vendorName}</div>
                    <div className="font-mono text-xs text-gray-500">
                      {shortVendorId(item.vendorId)}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-900">{item.businessName}</TableCell>
                  <TableCell className="text-gray-600">{item.city ?? '—'}</TableCell>
                  <TableCell className="text-gray-600">{item.category}</TableCell>
                  <TableCell className="text-gray-600">{item.businessType}</TableCell>
                  <TableCell>
                    <PlatformStatusBadge status={item.platformStatus} />
                  </TableCell>
                  <TableCell>
                    <WarmpawzPayStatusBadge status={item.warmpawzPayStatus} />
                  </TableCell>
                  <TableCell>
                    <ReadinessIndicator readiness={item.readiness} />
                  </TableCell>
                  <TableCell>
                    <EligibilityBadge customerVisible={item.customerVisible} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button type="button" size="sm" variant="ghost" asChild>
                        <Link href={`/warmpawz-pay/catalogue/${item.catalogueId}`}>
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">View catalogue entry</span>
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {expanded ? (
                  <TableRow>
                    <TableCell colSpan={11} className="bg-gray-50">
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
