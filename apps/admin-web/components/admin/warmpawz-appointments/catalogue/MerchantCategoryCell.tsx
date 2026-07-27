'use client';

import type { ServiceCategoryOption } from '@/lib/warmpawz-appointments-catalogue-admin';

interface MerchantCategoryCellProps {
  readonly serviceCategory: string;
  readonly roleLabel?: string;
  readonly category?: string;
}

export function MerchantCategoryCell({
  serviceCategory,
  roleLabel,
  category,
}: MerchantCategoryCellProps) {
  const primary = serviceCategory?.trim() || category?.trim() || '—';
  const secondary = roleLabel?.trim();

  if (primary === '—') {
    return <span className="text-gray-600">—</span>;
  }

  return (
    <div>
      <div className="font-medium text-gray-900">{primary}</div>
      {secondary ? <div className="text-xs text-gray-500">{secondary}</div> : null}
    </div>
  );
}

export function buildServiceCategoryFilterOptions(
  options: readonly ServiceCategoryOption[],
): Array<{ value: string; label: string }> {
  return [
    { value: 'all', label: 'All services' },
    ...options.map((option) => ({ value: option.id, label: option.label })),
  ];
}
