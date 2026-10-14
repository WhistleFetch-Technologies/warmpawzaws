'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { WarmpawzInsuranceShell } from '@/components/admin/warmpawz-insurance/shared/WarmpawzInsuranceShell';
import { errorMessage, primaryButtonClass, todayIso } from '@/components/admin/warmpawz-insurance/shared/insurance-ui';
import { CompanyDialog } from '@/components/admin/warmpawz-insurance/companies/CompanyDialog';
import { ManageVendorLinkDialog } from '@/components/admin/warmpawz-insurance/companies/ManageVendorLinkDialog';
import { VendorLinkDialog } from '@/components/admin/warmpawz-insurance/companies/VendorLinkDialog';
import { ConfirmDialog } from '@/components/admin/warmpawz-pay/catalogue/ConfirmDialog';
import {
  useDefaultPayoutSchedule,
  useInsuranceCompanies,
  useUpdateVendorLink,
  useVendorLinks,
} from '@/hooks/warmpawz-insurance/useInsuranceAdmin';
import { canManageInsuranceCompanies, canManageInsurancePayouts } from '@/lib/admin-permissions';
import type { InsuranceCompany, VendorLink } from '@/lib/warmpawz-insurance-admin';
import { CatalogueFilters, EMPTY_CATALOGUE_FILTERS, type CatalogueFilterState } from './CatalogueFilters';
import { CompanyCard } from './CompanyCard';

interface CompanyRow {
  company: InsuranceCompany;
  links: VendorLink[];
}

function filterRows(companies: InsuranceCompany[], links: VendorLink[], f: CatalogueFilterState): CompanyRow[] {
  const q = f.search.trim().toLowerCase();
  const rows: CompanyRow[] = [];
  for (const company of companies) {
    if (f.companyId !== 'all' && company.id !== f.companyId) continue;
    if (f.status !== 'all' && company.status !== f.status) continue;
    let companyLinks = links.filter((l) => l.companyId === company.id);
    if (f.vendorId !== 'all') {
      companyLinks = companyLinks.filter((l) => l.vendorId === f.vendorId);
      if (companyLinks.length === 0) continue;
    }
    if (q) {
      const companyMatch = `${company.name} ${company.description ?? ''}`.toLowerCase().includes(q);
      if (!companyMatch) {
        companyLinks = companyLinks.filter((l) => `${l.vendorName} ${l.vendorPhone ?? ''}`.toLowerCase().includes(q));
        if (companyLinks.length === 0) continue;
      }
    }
    rows.push({ company, links: companyLinks });
  }
  return rows;
}

export function CompanyCatalogue() {
  const companies = useInsuranceCompanies();
  const links = useVendorLinks();
  const platformDefault = useDefaultPayoutSchedule();
  const endLink = useUpdateVendorLink();
  const [canWrite, setCanWrite] = useState(false);
  const [canConfigure, setCanConfigure] = useState(false);
  const [filters, setFilters] = useState<CatalogueFilterState>(EMPTY_CATALOGUE_FILTERS);
  const [toggled, setToggled] = useState<Set<string> | null>(null);
  const [editing, setEditing] = useState<InsuranceCompany | null>(null);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [assignCompanyId, setAssignCompanyId] = useState<string | undefined>();
  const [assignOpen, setAssignOpen] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [ending, setEnding] = useState<VendorLink | null>(null);

  useEffect(() => {
    const companiesWrite = canManageInsuranceCompanies();
    setCanWrite(companiesWrite);
    setCanConfigure(companiesWrite && canManageInsurancePayouts());
  }, []);

  const allCompanies = useMemo(() => companies.data ?? [], [companies.data]);
  const liveLinks = useMemo(() => (links.data ?? []).filter((l) => l.status !== 'ended'), [links.data]);

  useEffect(() => {
    if (toggled === null && allCompanies.length > 0) setToggled(new Set([allCompanies[0].id]));
  }, [allCompanies, toggled]);

  const rows = useMemo(() => filterRows(allCompanies, liveLinks, filters), [allCompanies, liveLinks, filters]);
  const companyOptions = useMemo(() => allCompanies.map((c) => ({ value: c.id, label: c.name })), [allCompanies]);
  const vendorOptions = useMemo(() => {
    const byId = new Map(liveLinks.map((l) => [l.vendorId, l.vendorName]));
    return [...byId].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [liveLinks]);

  const autoExpand = filters.search.trim() !== '' || filters.vendorId !== 'all';
  const isExpanded = (id: string) => autoExpand !== Boolean(toggled?.has(id));
  const toggle = (id: string) =>
    setToggled((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const historyLink = useMemo(
    () => (links.data ?? []).find((link) => link.id === historyId) ?? null,
    [links.data, historyId],
  );

  const confirmEnd = async () => {
    if (!ending) return;
    const today = todayIso();
    try {
      await endLink.mutateAsync({
        id: ending.id,
        input: { status: 'ended', effectiveTo: ending.effectiveFrom > today ? ending.effectiveFrom : today },
      });
      toast.success(`${ending.vendorName} removed from ${ending.companyName}`);
      setEnding(null);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const loading = companies.isLoading || links.isLoading;
  const error = companies.error ?? links.error;

  return (
    <WarmpawzInsuranceShell
      title="Catalogue"
      subtitle="Insurance companies and the vendors assigned to sell them"
      actions={
        canWrite ? (
          <button
            type="button"
            className={primaryButtonClass}
            onClick={() => {
              setEditing(null);
              setCompanyOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add Insurance Company
          </button>
        ) : null
      }
    >
      <div className="space-y-4">
        <CatalogueFilters value={filters} companies={companyOptions} vendors={vendorOptions} onChange={setFilters} />
        {loading ? <p className="text-sm text-gray-500">Loading companies…</p> : null}
        {error ? <p className="text-sm text-red-600">{errorMessage(error)}</p> : null}
        {!loading && !error && rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
            {allCompanies.length === 0 ? 'No insurance companies yet.' : 'No companies match these filters.'}
          </p>
        ) : null}
        {rows.map(({ company, links: companyLinks }) => (
          <CompanyCard
            key={company.id}
            company={company}
            links={companyLinks}
            platformDefault={platformDefault.data}
            canWrite={canWrite}
            canConfigure={canConfigure}
            expanded={isExpanded(company.id)}
            onToggle={() => toggle(company.id)}
            onManage={() => {
              setEditing(company);
              setCompanyOpen(true);
            }}
            onAssign={() => {
              setAssignCompanyId(company.id);
              setAssignOpen(true);
            }}
            onEndLink={setEnding}
            onShowHistory={setHistoryId}
          />
        ))}
      </div>
      <CompanyDialog open={companyOpen} company={editing} onClose={() => setCompanyOpen(false)} />
      <VendorLinkDialog
        open={assignOpen}
        companies={allCompanies}
        defaultCompanyId={assignCompanyId}
        onClose={() => setAssignOpen(false)}
      />
      <ManageVendorLinkDialog link={historyLink} onClose={() => setHistoryId(null)} />
      <ConfirmDialog
        open={ending !== null}
        title="Remove vendor from company?"
        description={
          ending
            ? `${ending.vendorName} will stop selling ${ending.companyName} policies. Policies already issued keep their commission terms, and you can assign the vendor again later.`
            : ''
        }
        confirmLabel="Remove vendor"
        destructive
        loading={endLink.isPending}
        onConfirm={confirmEnd}
        onOpenChange={(open) => !open && setEnding(null)}
      />
    </WarmpawzInsuranceShell>
  );
}
