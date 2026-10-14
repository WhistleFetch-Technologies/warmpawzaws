'use client';

import { ChevronLeft, ChevronRight, FileText, MoreVertical, PawPrint, RotateCcw } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@warmpawz/ui';
import { SearchBar } from '@/components/admin/warmpawz-pay/catalogue/SearchBar';
import { initials } from '@/components/admin/warmpawz-insurance/catalogue/catalogue-format';
import { FilterSelect, type Option } from '@/components/admin/warmpawz-insurance/catalogue/CatalogueFilters';
import { CompanyLogo } from '@/components/admin/warmpawz-insurance/shared/CompanyLogo';
import {
  formatDate,
  formatDateTime,
  formatInr,
  secondaryButtonClass,
} from '@/components/admin/warmpawz-insurance/shared/insurance-ui';
import type { ReconciliationPolicy } from '@/lib/warmpawz-insurance-admin';
import { speciesLabel, STATUS_STYLES } from './reconciliation-format';

export const PAGE_SIZES = [10, 25, 50] as const;

export interface PolicyTableFilters {
  search: string;
  companyId: string;
  vendorId: string;
}

function pageNumbers(page: number, pages: number): number[] {
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  return Array.from({ length: Math.min(5, pages) }, (_, i) => start + i);
}

function CommissionCell({ row }: { row: ReconciliationPolicy }) {
  if (row.unpriced) {
    return <span className="text-xs font-medium text-amber-700" title="No commission terms cover this policy">No terms</span>;
  }
  return (
    <div>
      <div className="text-gray-900">
        {formatInr(row.commission, 2)}
        {row.isEstimate ? (
          <span className="ml-1 text-[10px] font-medium uppercase text-amber-700" title="Based on the vendor's expected commission rate">
            est.
          </span>
        ) : null}
      </div>
      {row.gst ? <div className="text-xs text-gray-500">+ {formatInr(row.gst, 2)} GST</div> : null}
    </div>
  );
}

export function CompletedPoliciesTable({
  rows,
  total,
  page,
  pageSize,
  loading,
  error,
  filters,
  companies,
  vendors,
  onFiltersChange,
  onReset,
  onPageChange,
  onPageSizeChange,
  onView,
}: {
  rows: ReconciliationPolicy[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: string | null;
  filters: PolicyTableFilters;
  companies: readonly Option[];
  vendors: readonly Option[];
  onFiltersChange: (next: PolicyTableFilters) => void;
  onReset: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onView: (row: ReconciliationPolicy) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);

  return (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-[#FF8C42]">
            <FileText className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Completed Policies</h2>
            <p className="text-sm text-gray-500">
              Policies confirmed in the selected period. Premiums are as reported by the vendor.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SearchBar
            value={filters.search}
            onChange={(search) => onFiltersChange({ ...filters, search })}
            placeholder="Search customer, vendor, policy no…"
            className="w-full sm:w-72"
          />
          <FilterSelect
            value={filters.companyId}
            allLabel="All companies"
            options={companies}
            onChange={(companyId) => onFiltersChange({ ...filters, companyId })}
          />
          <FilterSelect
            value={filters.vendorId}
            allLabel="All vendors"
            options={vendors}
            onChange={(vendorId) => onFiltersChange({ ...filters, vendorId })}
          />
          <button type="button" className={secondaryButtonClass} onClick={onReset}>
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-10">#</TableHead>
              <TableHead>Policy Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Pet</TableHead>
              <TableHead>Insurance Company</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Policy No.</TableHead>
              <TableHead className="text-right">Premium (₹)</TableHead>
              <TableHead className="text-right">Platform Commission (₹)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Added On</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="py-8 text-center text-sm text-gray-500">
                  {loading ? 'Loading policies…' : 'No completed policies match these filters.'}
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((row, i) => {
              const status = STATUS_STYLES[row.status];
              return (
                <TableRow key={row.applicationId} className={loading ? 'opacity-60' : undefined}>
                  <TableCell className="text-gray-500">{first + i}</TableCell>
                  <TableCell className="whitespace-nowrap text-gray-700">{formatDate(row.policyDate)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[11px] font-semibold text-orange-700">
                        {initials(row.customer.name ?? '?')}
                      </span>
                      <div>
                        <div className="font-medium text-gray-900">{row.customer.name ?? '-'}</div>
                        {row.customer.phone ? <div className="text-xs text-gray-500">{row.customer.phone}</div> : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {row.pet ? (
                      <div className="flex items-center gap-2">
                        <PawPrint className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="text-gray-900">{row.pet.name ?? '-'}</div>
                          <div className="text-xs text-gray-500">{speciesLabel(row.pet.species)}</div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <CompanyLogo name={row.company.name} logoUrl={row.company.logoUrl} size="sm" />
                      <span className="text-gray-900">{row.company.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-900">{row.vendor.name}</TableCell>
                  <TableCell className="font-mono text-xs text-gray-700">{row.policyNumber}</TableCell>
                  <TableCell className="text-right text-gray-900">{formatInr(row.premium, 2)}</TableCell>
                  <TableCell className="text-right">
                    <CommissionCell row={row} />
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.className}`}
                      title={row.period ? `Payout period ${formatDate(row.period.start)} – ${formatDate(row.period.end)}, due ${formatDate(row.period.dueDate)}` : undefined}
                    >
                      {status.label}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-gray-600">{formatDateTime(row.addedAt)}</TableCell>
                  <TableCell>
                    <button
                      type="button"
                      className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                      aria-label={`View policy ${row.policyNumber}`}
                      title="View policy document and status history"
                      onClick={() => onView(row)}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
        <span>
          Showing {first}–{last} of {total} {total === 1 ? 'policy' : 'policies'}
        </span>
        <div className="flex items-center gap-2">
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger className="w-32 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} per page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            className={secondaryButtonClass}
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {pageNumbers(page, pages).map((n) => (
            <button
              key={n}
              type="button"
              aria-current={n === page ? 'page' : undefined}
              className={
                n === page
                  ? 'h-9 min-w-9 rounded-md bg-[#FF8C42] px-3 text-sm font-medium text-white'
                  : 'h-9 min-w-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50'
              }
              onClick={() => onPageChange(n)}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            className={secondaryButtonClass}
            aria-label="Next page"
            disabled={page >= pages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
