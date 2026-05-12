'use client';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export function AutoRenewToggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-orange-100 bg-white px-4 py-3">
      <div>
        <Label className="text-sm font-semibold text-slate-900">Auto-renew</Label>
        <p className="text-xs text-slate-500 mt-0.5">Continue deliveries after your paid sessions complete.</p>
      </div>
      <Switch checked={value} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
