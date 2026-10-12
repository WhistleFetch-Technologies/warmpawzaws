'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link2, Pencil, Plus } from 'lucide-react';
import { WarmpawzInsuranceShell } from '@/components/admin/warmpawz-insurance/shared/WarmpawzInsuranceShell';
import {
  formatDate,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '@/components/admin/warmpawz-insurance/shared/insurance-ui';
import { useInsuranceCompanies, useVendorLinks } from '@/hooks/warmpawz-insurance/useInsuranceAdmin';
import { canManageInsuranceCompanies, canManageInsurancePayouts } from '@/lib/admin-permissions';
import type { InsuranceCompany, VendorLink } from '@/lib/warmpawz-insurance-admin';
import { CompanyDialog } from './CompanyDialog';
import { ManageVendorLinkDialog } from './ManageVendorLinkDialog';
import { VendorLinkDialog } from './VendorLinkDialog';

const INTEGRATION_LABEL: Record<InsuranceCompany['integrationMode'], string> = {
  manual: 'Manual',
  link: 'Payment / proposal link',
  api: 'Insurer API',
};

const LINK_STATUS_CLASS: Record<VendorLink['status'], string> = {
  active: 'bg-green-50 text-green-700 border-green-200',
  suspended: 'bg-amber-50 text-amber-800 border-amber-200',
  ended: 'bg-gray-100 text-gray-600 border-gray-200',
};

export function InsuranceCompaniesPage() {
  const { data: companies, isLoading: companiesLoading, error: companiesError } = useInsuranceCompanies();
  const { data: links, isLoading: linksLoading } = useVendorLinks();
  const [editingCompany, setEditingCompany] = useState<InsuranceCompany | null>(null);
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkCompanyId, setLinkCompanyId] = useState<string | undefined>();
  const [managingId, setManagingId] = useState<string | null>(null);
  const [companyFilter, setCompanyFilter] = useState('');
  const [canWrite, setCanWrite] = useState(false);
  const [canManageLinks, setCanManageLinks] = useState(false);

  useEffect(() => {
    setCanWrite(canManageInsuranceCompanies());
    setCanManageLinks(canManageInsuranceCompanies() || canManageInsurancePayouts());
  }, []);

  const visibleLinks = useMemo(
    () => (links ?? []).filter((l) => !companyFilter || l.companyId === companyFilter),
    [links, companyFilter],
  );
  const managing = (links ?? []).find((l) => l.id === managingId) ?? null;

  const openCompany = (company: InsuranceCompany | null) => {
    setEditingCompany(company);
    setCompanyDialogOpen(true);
  };

  const openLink = (companyId?: string) => {
    setLinkCompanyId(companyId);
    setLinkDialogOpen(true);
  };

  return (
    <WarmpawzInsuranceShell
      title="Companies & vendors"
      subtitle="Insurance companies Warmpawz offers, and which vendors may sell each one"
      actions={
        canWrite ? (
          <>
            <button type="button" className={secondaryButtonClass} onClick={() => openLink()}>
              <Link2 className="h-4 w-4" /> Link vendor
            </button>
            <button type="button" className={primaryButtonClass} onClick={() => openCompany(null)}>
              <Plus className="h-4 w-4" /> Add company
            </button>
          </>
        ) : null
      }
    >
      <section className="mb-8 bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Insurance companies</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Products</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Buying flow</th>
                <th className="px-4 py-3 font-medium">Vendors</th>
                <th className="px-4 py-3 font-medium">Policies issued</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {companiesLoading ? (
                <EmptyRow colSpan={8}>Loading…</EmptyRow>
              ) : companiesError ? (
                <EmptyRow colSpan={8}>
                  <span className="text-red-600">
                    {companiesError instanceof Error ? companiesError.message : 'Failed to load'}
                  </span>
                </EmptyRow>
              ) : companies?.length ? (
                companies.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {c.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.logoUrl} alt="" className="h-7 w-7 rounded object-contain" />
                        ) : null}
                        <div>
                          <div className="font-medium text-gray-900">{c.name}</div>
                          <div className="text-xs text-gray-500">
                            {[c.legalName, c.providerCode].filter(Boolean).join(' · ') || '—'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{c.products.join(', ') || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">
                      <div>{c.contactName || '—'}</div>
                      <div className="text-xs text-gray-500">
                        {[c.contactEmail, c.contactPhone].filter(Boolean).join(' · ')}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{INTEGRATION_LABEL[c.integrationMode]}</td>
                    <td className="px-4 py-3 text-gray-900">{c.activeVendorCount}</td>
                    <td className="px-4 py-3 text-gray-900">{c.issuedPolicyCount}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                          c.status === 'active'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-gray-100 text-gray-600 border-gray-200'
                        }`}
                      >
                        {c.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {canWrite ? (
                        <>
                          <button
                            type="button"
                            className="mr-3 text-sm text-[#FF8C42] hover:underline disabled:text-gray-300"
                            disabled={c.status !== 'active'}
                            onClick={() => openLink(c.id)}
                          >
                            Link vendor
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                            onClick={() => openCompany(c)}
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))
              ) : (
                <EmptyRow colSpan={8}>No insurance companies yet. Add the first company to start linking vendors.</EmptyRow>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex flex-col gap-2 px-4 py-3 border-b border-gray-200 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Vendor links</h2>
          <select
            className={`${inputClass} sm:w-64`}
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
          >
            <option value="">All companies</option>
            {(companies ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Authorisation</th>
                <th className="px-4 py-3 font-medium">Effective</th>
                <th className="px-4 py-3 font-medium">Warmpawz commission</th>
                <th className="px-4 py-3 font-medium">Payout schedule</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {linksLoading ? (
                <EmptyRow colSpan={8}>Loading…</EmptyRow>
              ) : visibleLinks.length ? (
                visibleLinks.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{l.vendorName}</div>
                      <div className="text-xs text-gray-500">{l.vendorPhone || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-900">{l.companyName}</td>
                    <td className="px-4 py-3 text-gray-700">
                      <div>{l.authorisationRef || '—'}</div>
                      {l.agencyCode ? <div className="text-xs text-gray-500">Agency {l.agencyCode}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {formatDate(l.effectiveFrom)} – {l.effectiveTo ? formatDate(l.effectiveTo) : 'ongoing'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{l.currentTerms?.description ?? 'No terms'}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {l.scheduleOverride ? l.scheduleOverride.frequencyLabel : 'Default'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${LINK_STATUS_CLASS[l.status]}`}
                      >
                        {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canManageLinks ? (
                        <button
                          type="button"
                          className="text-sm text-[#FF8C42] hover:underline"
                          onClick={() => setManagingId(l.id)}
                        >
                          Manage
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              ) : (
                <EmptyRow colSpan={8}>No vendors linked yet.</EmptyRow>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <CompanyDialog
        open={companyDialogOpen}
        company={editingCompany}
        onClose={() => setCompanyDialogOpen(false)}
      />
      <VendorLinkDialog
        open={linkDialogOpen}
        companies={companies ?? []}
        defaultCompanyId={linkCompanyId}
        onClose={() => setLinkDialogOpen(false)}
      />
      <ManageVendorLinkDialog link={managing} onClose={() => setManagingId(null)} />
    </WarmpawzInsuranceShell>
  );
}

function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-gray-500">
        {children}
      </td>
    </tr>
  );
}
