'use client';

import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@warmpawz/ui';

export type PolicyViewDomain = 'services' | 'ecommerce' | 'meals' | 'pharmacy';

const OPTIONS: { value: PolicyViewDomain; label: string; description: string }[] = [
  { value: 'services', label: 'Services', description: 'Veterinary, grooming, training, boarding & clinic bookings' },
  { value: 'ecommerce', label: 'E-Commerce', description: 'Marketplace products, sellers & shop checkout' },
  { value: 'meals', label: 'Meals', description: 'Meal plans & nutrition subscriptions' },
  { value: 'pharmacy', label: 'Pharmacy', description: 'Pharmacy and health product discounts' },
];

export function PolicyCenterDomainView({
  value,
  onChange,
  locked = false,
}: {
  value: PolicyViewDomain;
  onChange: (v: PolicyViewDomain) => void;
  /** When true, hide the domain switcher (surface is fixed by the host page). */
  locked?: boolean;
}) {
  const active = OPTIONS.find((o) => o.value === value);

  return (
    <div className="mb-6 rounded-xl border bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Policy domain view</p>
          <p className="text-xs text-slate-500">
            {locked
              ? 'Domain is fixed for this surface.'
              : 'Single Policy Center — switch context without duplicating configuration screens.'}
          </p>
        </div>
        {!locked ? (
          <div className="space-y-1">
            <Label htmlFor="policy-view-domain" className="sr-only">
              Domain view
            </Label>
            <Select value={value} onValueChange={(v) => onChange(v as PolicyViewDomain)}>
              <SelectTrigger id="policy-view-domain" className="w-full sm:w-56 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>
      {active ? (
        <p className="mt-3 text-sm text-slate-600">
          Viewing policies for <strong>{active.label}</strong> — {active.description}
        </p>
      ) : null}
    </div>
  );
}
