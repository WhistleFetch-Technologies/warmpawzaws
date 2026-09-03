'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Label,
} from '@warmpawz/ui';
import { POLICY_DOMAIN_OPTIONS } from '@/lib/discount-policy/option-registry';
import type { PolicyScope } from '@/lib/discount-policy/types';

export function DomainScopeSelector({
  scope,
  onScopeChange,
  id = 'policy-domain-scope',
}: {
  scope: PolicyScope;
  onScopeChange: (scope: PolicyScope) => void;
  id?: string;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <Label htmlFor={id} className="text-sm font-medium text-slate-700 shrink-0">
        Configuration scope
      </Label>
      <Select
        value={scope}
        onValueChange={(v: string) => onScopeChange(v as PolicyScope)}
      >
        <SelectTrigger id={id} className="w-full sm:w-64 bg-white" aria-label="Configuration scope">
          <SelectValue placeholder="Select scope" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="global">Global (default)</SelectItem>
          {POLICY_DOMAIN_OPTIONS.map((d) => (
            <SelectItem key={d.value} value={d.value}>
              Domain override — {d.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
