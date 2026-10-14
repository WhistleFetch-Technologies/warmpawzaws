'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@warmpawz/ui';
import { SearchBar } from '@/components/admin/warmpawz-pay/catalogue/SearchBar';

export type CompanyStatusFilter = 'all' | 'active' | 'inactive';

export interface CatalogueFilterState {
  search: string;
  companyId: string;
  vendorId: string;
  status: CompanyStatusFilter;
}

export const EMPTY_CATALOGUE_FILTERS: CatalogueFilterState = { search: '', companyId: 'all', vendorId: 'all', status: 'all' };

export interface Option {
  readonly value: string;
  readonly label: string;
}

export function FilterSelect({
  value,
  allLabel,
  options,
  onChange,
}: {
  value: string;
  allLabel: string;
  options: readonly Option[];
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-48 bg-white">
        <SelectValue placeholder={allLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function CatalogueFilters({
  value,
  companies,
  vendors,
  onChange,
}: {
  value: CatalogueFilterState;
  companies: readonly Option[];
  vendors: readonly Option[];
  onChange: (next: CatalogueFilterState) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 lg:flex-row lg:flex-wrap lg:items-center">
      <SearchBar
        value={value.search}
        onChange={(search) => onChange({ ...value, search })}
        placeholder="Search company or vendor"
        className="w-full lg:w-80"
      />
      <FilterSelect
        value={value.companyId}
        allLabel="All companies"
        options={companies}
        onChange={(companyId) => onChange({ ...value, companyId })}
      />
      <FilterSelect
        value={value.vendorId}
        allLabel="All vendors"
        options={vendors}
        onChange={(vendorId) => onChange({ ...value, vendorId })}
      />
      <FilterSelect
        value={value.status}
        allLabel="All status"
        options={[
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
        ]}
        onChange={(status) => onChange({ ...value, status: status as CompanyStatusFilter })}
      />
    </div>
  );
}
