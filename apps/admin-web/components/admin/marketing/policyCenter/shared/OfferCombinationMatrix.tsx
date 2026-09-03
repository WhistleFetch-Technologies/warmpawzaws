'use client';

import { Switch, Label } from '@warmpawz/ui';
import { formatCombinationLabel } from '@/lib/discount-policy/business-rules-matrix';
import type { OfferCombinationRule, OfferTypeDefinition } from '@/lib/discount-policy/business-rules-types';

export function OfferCombinationMatrix({
  matrix,
  offerTypes,
  readOnly,
  readOnlyMessage = 'Resolved by Winning Strategy',
  onChange,
}: {
  matrix: OfferCombinationRule[];
  offerTypes: OfferTypeDefinition[];
  readOnly: boolean;
  readOnlyMessage?: string;
  onChange: (matrix: OfferCombinationRule[]) => void;
}) {
  const toggle = (id: string, allowed: boolean) => {
    onChange(matrix.map((r) => (r.id === id ? { ...r, allowed } : r)));
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Configure which offer types may combine when stacking is enabled.
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left">
              <th className="px-4 py-2 font-medium text-slate-700">Offer combination</th>
              <th className="px-4 py-2 font-medium text-slate-700 w-40">Allowed</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((rule) => (
              <tr key={rule.id} className="border-b last:border-0">
                <td className="px-4 py-3 text-slate-800">
                  {formatCombinationLabel(rule.left, rule.right, offerTypes)}
                </td>
                <td className="px-4 py-3">
                  {readOnly ? (
                    <span className="text-xs text-slate-500 italic">{readOnlyMessage}</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`matrix-${rule.id}`}
                        checked={rule.allowed}
                        onCheckedChange={(checked: boolean) => toggle(rule.id, checked)}
                      />
                      <Label htmlFor={`matrix-${rule.id}`} className="text-xs text-slate-600">
                        {rule.allowed ? 'Enabled' : 'Disabled'}
                      </Label>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
