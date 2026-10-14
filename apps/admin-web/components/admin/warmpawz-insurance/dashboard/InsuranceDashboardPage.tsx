'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, Wallet } from 'lucide-react';
import { WarmpawzInsuranceShell } from '@/components/admin/warmpawz-insurance/shared/WarmpawzInsuranceShell';
import { errorMessage } from '@/components/admin/warmpawz-insurance/shared/insurance-ui';
import { InsurancePayoutPage } from '@/components/admin/warmpawz-insurance/payouts/InsurancePayoutPage';
import {
  useInsuranceCompanies,
  useReconciliation,
  useVendorLinks,
} from '@/hooks/warmpawz-insurance/useInsuranceAdmin';
import {
  exportReconciliation,
  type ReconciliationFilters,
  type ReconciliationPolicy,
} from '@/lib/warmpawz-insurance-admin';
import { CompletedPoliciesTable, type PolicyTableFilters } from './CompletedPoliciesTable';
import { PolicyDetailDialog } from './PolicyDetailDialog';
import { ReconciliationSummary } from './ReconciliationSummary';
import { monthToDate, type DateRange } from './reconciliation-format';

const EMPTY_FILTERS: PolicyTableFilters = { search: '', companyId: 'all', vendorId: 'all' };

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function VendorPaymentsSection() {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-[#FF8C42]">
            <Wallet className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-base font-semibold text-gray-900">Vendor payment periods</span>
            <span className="text-sm text-gray-500">Record commission received from vendors and send reminders</span>
          </span>
        </span>
        {open ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
      </button>
      {open ? (
        <div className="border-t border-gray-100 px-5 py-4">
          <InsurancePayoutPage embedded />
        </div>
      ) : null}
    </section>
  );
}

export function InsuranceDashboardPage() {
  const [range, setRange] = useState<DateRange>(monthToDate);
  const [filters, setFilters] = useState<PolicyTableFilters>(EMPTY_FILTERS);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [viewing, setViewing] = useState<ReconciliationPolicy | null>(null);
  const [exporting, setExporting] = useState(false);
  const companies = useInsuranceCompanies();
  const links = useVendorLinks();

  useEffect(() => {
    const t = setTimeout(() => setSearch(filters.search.trim()), 300);
    return () => clearTimeout(t);
  }, [filters.search]);

  const query: ReconciliationFilters = useMemo(
    () => ({
      from: range.from,
      to: range.to,
      companyId: filters.companyId === 'all' ? undefined : filters.companyId,
      vendorId: filters.vendorId === 'all' ? undefined : filters.vendorId,
      search: search || undefined,
    }),
    [range, filters.companyId, filters.vendorId, search],
  );

  useEffect(() => setPage(1), [query, pageSize]);

  const reconciliation = useReconciliation(query, page, pageSize);

  const companyOptions = useMemo(
    () => (companies.data ?? []).map((c) => ({ value: c.id, label: c.name })),
    [companies.data],
  );
  const vendorOptions = useMemo(() => {
    const byId = new Map((links.data ?? []).map((l) => [l.vendorId, l.vendorName]));
    return [...byId].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [links.data]);

  const runExport = async () => {
    setExporting(true);
    try {
      const file = await exportReconciliation(query);
      if (file.rowCount === 0) {
        toast.info('No policies to export for these filters');
        return;
      }
      downloadText(file.filename, file.csv);
      toast.success(`Exported ${file.rowCount} ${file.rowCount === 1 ? 'policy' : 'policies'}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <WarmpawzInsuranceShell
      title="Dashboard"
      subtitle="Completed policies, Warmpawz commission and vendor payments for the selected period"
    >
      <div className="space-y-5">
        <ReconciliationSummary
          range={range}
          summary={reconciliation.data?.summary}
          exporting={exporting}
          onRangeChange={setRange}
          onExport={runExport}
        />
        <CompletedPoliciesTable
          rows={reconciliation.data?.items ?? []}
          total={reconciliation.data?.total ?? 0}
          page={page}
          pageSize={pageSize}
          loading={reconciliation.isFetching}
          error={reconciliation.error ? errorMessage(reconciliation.error) : null}
          filters={filters}
          companies={companyOptions}
          vendors={vendorOptions}
          onFiltersChange={setFilters}
          onReset={() => setFilters(EMPTY_FILTERS)}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          onView={setViewing}
        />
        <VendorPaymentsSection />
      </div>
      <PolicyDetailDialog policy={viewing} onClose={() => setViewing(null)} />
    </WarmpawzInsuranceShell>
  );
}
