'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Settings2 } from 'lucide-react';
import { primaryButtonClass, secondaryButtonClass } from '@/components/admin/warmpawz-insurance/shared/insurance-ui';
import type { InsuranceCompany, PayoutSchedule, VendorLink } from '@/lib/warmpawz-insurance-admin';
import { CompanyLogo } from '@/components/admin/warmpawz-insurance/shared/CompanyLogo';
import { AssignedVendorsTable } from './AssignedVendorsTable';

export function CompanyCard({
  company,
  links,
  platformDefault,
  canWrite,
  canConfigure,
  expanded,
  onToggle,
  onManage,
  onAssign,
  onEndLink,
  onShowHistory,
}: {
  company: InsuranceCompany;
  links: VendorLink[];
  platformDefault: PayoutSchedule | undefined;
  canWrite: boolean;
  canConfigure: boolean;
  expanded: boolean;
  onToggle: () => void;
  onManage: () => void;
  onAssign: () => void;
  onEndLink: (link: VendorLink) => void;
  onShowHistory: (linkId: string) => void;
}) {
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const active = company.status === 'active';

  return (
    <article className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-4 px-5 py-4">
        <CompanyLogo name={company.name} logoUrl={company.logoUrl} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-gray-900">{company.name}</h2>
          {company.description ? <p className="truncate text-sm text-gray-500">{company.description}</p> : null}
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
            active ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 bg-gray-100 text-gray-600'
          }`}
        >
          {active ? 'Active' : 'Inactive'}
        </span>
        <span className="text-sm text-gray-600">
          {links.length} assigned vendor{links.length === 1 ? '' : 's'}
        </span>
        {canWrite ? (
          <button type="button" className={secondaryButtonClass} onClick={onManage}>
            <Settings2 className="h-4 w-4" /> Manage Company
          </button>
        ) : null}
        <button
          type="button"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${company.name}`}
          onClick={onToggle}
        >
          {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>
      </div>
      {expanded ? (
        <div className="space-y-3 border-t border-gray-100 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900">Assigned Vendors</h3>
            {canWrite && active ? (
              <button type="button" className={primaryButtonClass} onClick={onAssign}>
                <Plus className="h-4 w-4" /> Assign Vendor
              </button>
            ) : null}
          </div>
          <AssignedVendorsTable
            links={links}
            companyName={company.name}
            platformDefault={platformDefault}
            canRemove={canWrite}
            canConfigure={canConfigure}
            expandedLinkId={editingLinkId}
            onToggle={setEditingLinkId}
            onEnd={onEndLink}
            onShowHistory={onShowHistory}
          />
        </div>
      ) : null}
    </article>
  );
}
