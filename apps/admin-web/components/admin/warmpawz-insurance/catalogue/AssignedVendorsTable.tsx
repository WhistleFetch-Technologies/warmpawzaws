'use client';

import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@warmpawz/ui';
import { formatDate } from '@/components/admin/warmpawz-insurance/shared/insurance-ui';
import type { PayoutSchedule, VendorLink } from '@/lib/warmpawz-insurance-admin';
import {
  commissionTypeLabel,
  commissionValueLabel,
  initials,
  linkFrequencyLabel,
} from './catalogue-format';
import { VendorConfigEditor } from './VendorConfigEditor';

function Chip({ children, tone = 'gray' }: { children: ReactNode; tone?: 'gray' | 'orange' | 'green' }) {
  const tones = {
    gray: 'border-gray-200 bg-gray-50 text-gray-700',
    orange: 'border-orange-200 bg-orange-50 text-orange-700',
    green: 'border-green-200 bg-green-50 text-green-700',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function AssignedVendorsTable({
  links,
  companyName,
  platformDefault,
  canRemove,
  canConfigure,
  expandedLinkId,
  onToggle,
  onEnd,
  onShowHistory,
}: {
  links: VendorLink[];
  companyName: string;
  platformDefault: PayoutSchedule | undefined;
  canRemove: boolean;
  canConfigure: boolean;
  expandedLinkId: string | null;
  onToggle: (linkId: string | null) => void;
  onEnd: (link: VendorLink) => void;
  onShowHistory: (linkId: string) => void;
}) {
  if (links.length === 0) {
    return <p className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500">No vendors assigned yet.</p>;
  }

  const expandedLink = links.find((link) => link.id === expandedLinkId) ?? null;

  return (
    <div className="space-y-3">
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="w-10" />
            <TableHead className="w-10">#</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Frequency</TableHead>
            <TableHead>Commission Type</TableHead>
            <TableHead>Commission Value</TableHead>
            <TableHead>Assigned On</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {links.map((link, index) => {
            const expanded = expandedLinkId === link.id;
            return (
                <TableRow key={link.id} className={expanded ? 'bg-orange-50/30' : undefined}>
                  <TableCell>
                    <button
                      type="button"
                      className="rounded p-1 text-gray-500 hover:bg-gray-100"
                      aria-expanded={expanded}
                      aria-label={`${expanded ? 'Collapse' : 'Expand'} ${link.vendorName}`}
                      onClick={() => onToggle(expanded ? null : link.id)}
                    >
                      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </TableCell>
                  <TableCell className="text-gray-500">{index + 1}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-semibold text-orange-700">
                        {initials(link.vendorName)}
                      </span>
                      <div>
                        <div className="font-medium text-gray-900">
                          {link.vendorName}
                          {link.status === 'suspended' ? <span className="ml-2 text-xs text-amber-700">(suspended)</span> : null}
                        </div>
                        {link.vendorPhone ? <div className="text-xs text-gray-500">{link.vendorPhone}</div> : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span title={link.scheduleOverride ? 'Set for this vendor' : 'Platform default'}>
                      <Chip tone="orange">{linkFrequencyLabel(link, platformDefault)}</Chip>
                    </span>
                  </TableCell>
                  <TableCell>
                    <Chip>{commissionTypeLabel(link.currentTerms)}</Chip>
                  </TableCell>
                  <TableCell>
                    <Chip tone="green">{commissionValueLabel(link.currentTerms)}</Chip>
                    {link.currentTerms ? (
                      <div className="mt-1 text-xs text-gray-500">+ {link.currentTerms.gstRate}% GST</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-gray-700">{formatDate(link.effectiveFrom)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                        aria-label={`Edit ${link.vendorName}`}
                        title={canConfigure ? 'Edit configuration' : 'View configuration'}
                        onClick={() => onToggle(link.id)}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {canRemove ? (
                        <button
                          type="button"
                          className="rounded p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700"
                          aria-label={`Remove ${link.vendorName}`}
                          title="Remove vendor from this company"
                          onClick={() => onEnd(link)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
    {expandedLink ? (
      <VendorConfigEditor
        link={expandedLink}
        companyName={companyName}
        platformDefault={platformDefault}
        canWrite={canConfigure}
        onClose={() => onToggle(null)}
        onShowHistory={() => onShowHistory(expandedLink.id)}
      />
    ) : null}
    </div>
  );
}
