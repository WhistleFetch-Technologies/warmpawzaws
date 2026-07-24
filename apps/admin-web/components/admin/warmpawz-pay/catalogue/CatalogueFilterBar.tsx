'use client';

import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@warmpawz/ui';
import type { CatalogueEligibilityFilter } from '@/lib/warmpawz-pay-catalogue-admin';
import { SearchBar } from './SearchBar';
import {
  CATALOGUE_CATEGORY_OPTIONS,
  PLATFORM_STATUS_FILTER_OPTIONS,
} from './catalogue-filter-options';

export interface CatalogueFilterBarProps {
  readonly searchInput: string;
  readonly onSearchInputChange: (value: string) => void;
  readonly categoryFilter: string;
  readonly onCategoryFilterChange: (value: string) => void;
  readonly eligibilityFilter: CatalogueEligibilityFilter;
  readonly onEligibilityFilterChange: (value: CatalogueEligibilityFilter) => void;
  readonly vendorIdFilter: string;
  readonly onVendorIdFilterChange: (value: string) => void;
  readonly platformStatusFilter?: string;
  readonly onPlatformStatusFilterChange?: (value: string) => void;
  readonly showPlatformStatus?: boolean;
  readonly disabled?: boolean;
  readonly searchPlaceholder?: string;
}

export function CatalogueFilterBar({
  searchInput,
  onSearchInputChange,
  categoryFilter,
  onCategoryFilterChange,
  eligibilityFilter,
  onEligibilityFilterChange,
  vendorIdFilter,
  onVendorIdFilterChange,
  platformStatusFilter = 'all',
  onPlatformStatusFilterChange,
  showPlatformStatus = false,
  disabled = false,
  searchPlaceholder = 'Search business name…',
}: CatalogueFilterBarProps) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
      <SearchBar
        value={searchInput}
        onChange={onSearchInputChange}
        placeholder={searchPlaceholder}
        disabled={disabled}
      />
      <Select
        value={categoryFilter}
        onValueChange={onCategoryFilterChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-44 bg-white">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          {CATALOGUE_CATEGORY_OPTIONS.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showPlatformStatus && onPlatformStatusFilterChange ? (
        <Select
          value={platformStatusFilter}
          onValueChange={onPlatformStatusFilterChange}
          disabled={disabled}
        >
          <SelectTrigger className="w-44 bg-white">
            <SelectValue placeholder="Platform status" />
          </SelectTrigger>
          <SelectContent>
            {PLATFORM_STATUS_FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <Select
        value={eligibilityFilter}
        onValueChange={(value) =>
          onEligibilityFilterChange(value as CatalogueEligibilityFilter)
        }
        disabled={disabled}
      >
        <SelectTrigger className="w-52 bg-white">
          <SelectValue placeholder="Customer visibility" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All visibility</SelectItem>
          <SelectItem value="customer_visible">Customer visible</SelectItem>
          <SelectItem value="not_customer_visible">Not customer visible</SelectItem>
        </SelectContent>
      </Select>
      <Input
        value={vendorIdFilter}
        onChange={(event) => onVendorIdFilterChange(event.target.value)}
        placeholder="Filter by vendor ID"
        className="max-w-xs bg-white"
        disabled={disabled}
      />
    </div>
  );
}
