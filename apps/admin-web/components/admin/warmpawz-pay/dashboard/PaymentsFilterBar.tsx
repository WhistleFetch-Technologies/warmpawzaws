'use client';

import { useState } from 'react';
import { Button } from '@warmpawz/ui';
import type { WpayPaymentsFilters } from '@/lib/warmpawz-pay-payments-admin';
import { downloadWpayPaymentsExcel } from '@/lib/warmpawz-pay-payments-export';

export interface PaymentsFilterBarProps {
  readonly filters: WpayPaymentsFilters;
  readonly onFiltersChange: (filters: WpayPaymentsFilters) => void;
  readonly disabled?: boolean;
}

function isRangeReady(filters: WpayPaymentsFilters): boolean {
  return Boolean(filters.fromDate && filters.toDate && filters.fromDate <= filters.toDate);
}

export function PaymentsFilterBar({
  filters,
  onFiltersChange,
  disabled = false,
}: PaymentsFilterBarProps) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const setMode = (mode: WpayPaymentsFilters['mode']) => {
    onFiltersChange({ ...filters, mode });
  };

  const setYearMonth = (yearMonth: string) => {
    onFiltersChange({ ...filters, mode: 'month', yearMonth });
  };

  const setFromDate = (fromDate: string) => {
    onFiltersChange({ ...filters, mode: 'range', fromDate });
  };

  const setToDate = (toDate: string) => {
    onFiltersChange({ ...filters, mode: 'range', toDate });
  };

  const exportDisabled =
    disabled ||
    exporting ||
    (filters.mode === 'range' && !isRangeReady(filters)) ||
    (filters.mode === 'month' && !filters.yearMonth);

  const handleExport = async () => {
    setExportError(null);
    setExporting(true);
    try {
      await downloadWpayPaymentsExcel(filters);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="inline-flex rounded-md border border-gray-200 bg-white p-0.5">
          <button
            type="button"
            onClick={() => setMode('month')}
            disabled={disabled}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              filters.mode === 'month'
                ? 'bg-orange-500 text-white'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            Month
          </button>
          <button
            type="button"
            onClick={() => setMode('range')}
            disabled={disabled}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              filters.mode === 'range'
                ? 'bg-orange-500 text-white'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            Date range
          </button>
        </div>

        {filters.mode === 'month' ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600">Month (IST)</span>
            <input
              type="month"
              aria-label="Month (IST)"
              value={filters.yearMonth}
              onChange={(event) => setYearMonth(event.target.value)}
              disabled={disabled}
              className="rounded-md border border-gray-300 bg-white px-3 py-2"
            />
          </label>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600">From (IST)</span>
              <input
                type="date"
                aria-label="From (IST)"
                value={filters.fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                disabled={disabled}
                className="rounded-md border border-gray-300 bg-white px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600">To (IST)</span>
              <input
                type="date"
                aria-label="To (IST)"
                value={filters.toDate}
                onChange={(event) => setToDate(event.target.value)}
                disabled={disabled}
                className="rounded-md border border-gray-300 bg-white px-3 py-2"
              />
            </label>
          </>
        )}

        <Button
          type="button"
          variant="outline"
          onClick={() => void handleExport()}
          disabled={exportDisabled}
        >
          {exporting ? 'Downloading…' : 'Download Excel'}
        </Button>
      </div>

      {exportError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {exportError}
        </div>
      ) : null}
    </div>
  );
}
