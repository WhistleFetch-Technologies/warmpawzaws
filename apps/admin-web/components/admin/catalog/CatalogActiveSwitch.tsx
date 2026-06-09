'use client';

import { Switch } from '@warmpawz/ui';
import { Loader2 } from 'lucide-react';

interface CatalogActiveSwitchProps {
  active: boolean;
  loading?: boolean;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
}

export function CatalogActiveSwitch({
  active,
  loading = false,
  disabled = false,
  onToggle,
}: CatalogActiveSwitchProps) {
  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg border transition-colors ${
        active ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
      }`}
      title={active ? 'Visible to customers (still shown in admin)' : 'Hidden from customers only (still shown in admin)'}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-gray-400 shrink-0" />
      ) : (
        <Switch
          checked={active}
          disabled={disabled || loading}
          onCheckedChange={onToggle}
          className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500 shrink-0"
        />
      )}
      <span
        className={`text-xs font-semibold whitespace-nowrap ${
          active ? 'text-green-700' : 'text-gray-500'
        }`}
      >
        {active ? 'Customer on' : 'Customer off'}
      </span>
    </div>
  );
}
