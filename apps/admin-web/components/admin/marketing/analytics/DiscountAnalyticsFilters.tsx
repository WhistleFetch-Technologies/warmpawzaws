'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
  Label,
  Button,
} from '@warmpawz/ui';
import { RefreshCw } from 'lucide-react';
import type { AnalyticsDomainFilter, AnalyticsPreset } from '@/lib/marketing-analytics/types';

export function DiscountAnalyticsFilters({
  preset,
  domain,
  vendorId,
  onPresetChange,
  onDomainChange,
  onVendorIdChange,
  onRefresh,
  loading,
  domainOptions,
  domainLocked = false,
}: {
  preset: AnalyticsPreset;
  domain: AnalyticsDomainFilter;
  vendorId: string;
  onPresetChange: (v: AnalyticsPreset) => void;
  onDomainChange: (v: AnalyticsDomainFilter) => void;
  onVendorIdChange: (v: string) => void;
  onRefresh: () => void;
  loading?: boolean;
  domainOptions?: AnalyticsDomainFilter[];
  domainLocked?: boolean;
}) {
  const allOptions: { value: AnalyticsDomainFilter; label: string }[] = [
    { value: 'ALL', label: 'All domains' },
    { value: 'SERVICE', label: 'Service' },
    { value: 'MEAL', label: 'Meal' },
    { value: 'PRODUCT', label: 'Product / shop' },
    { value: 'PHARMACY', label: 'Pharmacy' },
    { value: 'PACKAGE', label: 'Package' },
  ];
  const visible = domainOptions?.length
    ? allOptions.filter((o) => domainOptions.includes(o.value))
    : allOptions;
  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-white p-4 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="space-y-2">
        <Label htmlFor="analytics-preset">Date range</Label>
        <Select value={preset} onValueChange={(v) => onPresetChange(v as AnalyticsPreset)}>
          <SelectTrigger id="analytics-preset" className="w-full sm:w-40 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="analytics-domain">Domain</Label>
        <Select
          value={domain}
          disabled={domainLocked}
          onValueChange={(v) => onDomainChange(v as AnalyticsDomainFilter)}
        >
          <SelectTrigger id="analytics-domain" className="w-full sm:w-44 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {visible.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2 flex-1 min-w-[200px]">
        <Label htmlFor="analytics-vendor">Vendor ID (optional)</Label>
        <Input
          id="analytics-vendor"
          placeholder="Filter by vendor UUID"
          value={vendorId}
          onChange={(e) => onVendorIdChange(e.target.value)}
        />
      </div>

      <Button type="button" variant="outline" onClick={onRefresh} disabled={loading}>
        <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
        Refresh
      </Button>
    </div>
  );
}
