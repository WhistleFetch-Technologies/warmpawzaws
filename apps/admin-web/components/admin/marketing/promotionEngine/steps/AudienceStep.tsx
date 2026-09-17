'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@warmpawz/ui';
import {
  TEMPLATES_NEEDING_M,
  TEMPLATES_NEEDING_N,
  applyAudienceToDraft,
  defaultAudienceState,
  type AudienceBuilderState,
} from '@/lib/promo-engine/audience';
import {
  JOURNEY_TEMPLATE_IDS,
  JOURNEY_TEMPLATE_LABELS,
  type JourneyTemplateId,
} from '@/lib/promo-engine/journey-templates';
import { describeBenefits, describeConditionGroup } from '@/lib/promo-engine/plain-language';
import {
  SERVICE_CATEGORIES,
  type PromoEngineCondition,
  type PromoEngineDraft,
  type ServiceCategory,
} from '@/lib/promo-engine/types';

const EXTRA_FIELDS = [
  { id: 'user.grooming_visit_count', label: 'Grooming visit count' },
  { id: 'user.vet_visit_count', label: 'Vet visit count' },
  { id: 'user.training_visit_count', label: 'Training visit count' },
  { id: 'user.days_since_last_grooming', label: 'Days since last grooming' },
  { id: 'user.days_since_last_vet', label: 'Days since last vet' },
  { id: 'transaction.amount', label: 'Transaction amount' },
];

const OPERATORS = ['=', '!=', '>=', '<=', '>', '<', 'BETWEEN', 'IN'];

export function AudienceStep({
  draft,
  onChange,
}: {
  draft: PromoEngineDraft;
  onChange: (next: PromoEngineDraft) => void;
}) {
  const [state, setState] = useState<AudienceBuilderState>(() => defaultAudienceState(draft));
  const [builderDirty, setBuilderDirty] = useState(false);

  const previewGroup = useMemo(
    () =>
      builderDirty || !draft.conditionJson.conditions.length
        ? applyAudienceToDraft(draft, state).conditionJson
        : draft.conditionJson,
    [builderDirty, draft, state],
  );

  const patchState = (partial: Partial<AudienceBuilderState>) => {
    const next = { ...state, ...partial };
    setState(next);
    setBuilderDirty(true);
    onChange(applyAudienceToDraft(draft, next));
  };

  useEffect(() => {
    if (!draft.conditionJson.conditions.length) {
      onChange(applyAudienceToDraft(draft, state));
      setBuilderDirty(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed empty drafts once
  }, []);

  const updateExtra = (index: number, partial: Partial<PromoEngineCondition>) => {
    const extras = state.extras.map((row, i) => (i === index ? { ...row, ...partial } : row));
    patchState({ extras });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Service</Label>
            <Select
              value={state.serviceCategory}
              onValueChange={(v: string) => patchState({ serviceCategory: v as ServiceCategory })}
            >
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_CATEGORIES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="promo-engine-package">Package (optional)</Label>
            <Input
              id="promo-engine-package"
              value={state.packageName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                patchState({ packageName: e.target.value })
              }
              placeholder="Full Groom"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Journey template</Label>
          <div className="flex flex-wrap gap-2">
            {JOURNEY_TEMPLATE_IDS.map((id) => {
              const selected = state.template === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => patchState({ template: id as JourneyTemplateId })}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    selected
                      ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42]'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {JOURNEY_TEMPLATE_LABELS[id]}
                </button>
              );
            })}
          </div>
        </div>

        {TEMPLATES_NEEDING_N.includes(state.template) || TEMPLATES_NEEDING_M.includes(state.template) ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {TEMPLATES_NEEDING_N.includes(state.template) ? (
              <div className="space-y-2">
                <Label htmlFor="promo-engine-n">N</Label>
                <Input
                  id="promo-engine-n"
                  type="number"
                  min={1}
                  value={state.n}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    patchState({ n: Number(e.target.value) || 1 })
                  }
                />
              </div>
            ) : null}
            {TEMPLATES_NEEDING_M.includes(state.template) ? (
              <div className="space-y-2">
                <Label htmlFor="promo-engine-m">M</Label>
                <Input
                  id="promo-engine-m"
                  type="number"
                  min={1}
                  value={state.m}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    patchState({ m: Number(e.target.value) || 1 })
                  }
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label>Combine extra rows with</Label>
          <Select
            value={state.groupOperator}
            onValueChange={(v: string) => patchState({ groupOperator: v as 'AND' | 'OR' })}
          >
            <SelectTrigger className="w-40 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AND">AND</SelectItem>
              <SelectItem value="OR">OR</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Extra behaviour conditions</Label>
            <button
              type="button"
              className="text-xs font-medium text-[#FF8C42]"
              onClick={() =>
                patchState({
                  extras: [...state.extras, { field: 'user.grooming_visit_count', operator: '>=', value: '' }],
                })
              }
            >
              Add row
            </button>
          </div>
          {state.extras.length === 0 ? (
            <p className="text-xs text-slate-500">Optional. Template already includes the journey WHEN clause.</p>
          ) : (
            state.extras.map((row, index) => (
              <div key={`${row.field}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_90px_1fr_auto]">
                <Select value={row.field} onValueChange={(v: string) => updateExtra(index, { field: v })}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXTRA_FIELDS.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={row.operator} onValueChange={(v: string) => updateExtra(index, { operator: v })}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((op) => (
                      <SelectItem key={op} value={op}>
                        {op}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={String(row.value ?? '')}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    updateExtra(index, { value: e.target.value })
                  }
                  placeholder="Value"
                />
                <button
                  type="button"
                  className="text-xs text-slate-500"
                  onClick={() => patchState({ extras: state.extras.filter((_, i) => i !== index) })}
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>

        <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-700">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Plain language</p>
          <p>{describeConditionGroup(previewGroup)}</p>
        </div>
      </div>

      <aside className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#FF8C42]">Promotion model</p>
        <div>
          <p className="text-xs font-semibold text-slate-500">IF</p>
          <p className="mt-1 text-slate-800">{describeConditionGroup(previewGroup)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500">THEN</p>
          <p className="mt-1 text-slate-600">{describeBenefits(draft.benefitJson)}</p>
        </div>
      </aside>
    </div>
  );
}
