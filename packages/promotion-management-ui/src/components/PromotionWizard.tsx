'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Sparkles, Ticket } from 'lucide-react';
import type {
  CreateKind,
  PromotionManagementScope,
  PromotionTargetCatalog,
  PromotionWizardForm,
  PromotionTypeId,
  TargetScopeId,
} from '../types';
import { DEFAULT_WIZARD_FORM } from '../types';
import { validatePromotionWizard, hasValidationErrors } from '../validation';
import { PromotionTypeSelector } from './PromotionTypeSelector';
import { PromotionTriggerSelector } from './PromotionTriggerSelector';
import { PromotionTargetSelector } from './PromotionTargetSelector';
import { PromotionSummary } from './PromotionSummary';
import { PromotionPreview } from './PromotionPreview';

const STEPS = [
  'Create type',
  'Basic info',
  'Promotion type',
  'Audience',
  'Targets',
  'Discount',
  'Schedule',
  'Review',
];

function enabledScopes(scope: PromotionManagementScope): TargetScopeId[] {
  if (scope.enabledTargetScopes?.length) {
    return scope.enabledTargetScopes;
  }
  if (scope.mode === 'platform') {
    return [
      'entire_platform',
      'vendors',
      'categories',
      'services',
      'packages',
      'meal_plans',
      'products',
      'styles',
    ];
  }
  if (scope.mode === 'vendor_services') {
    return ['services', 'packages', 'meal_plans', 'styles'];
  }
  return ['products', 'categories', 'packages', 'meal_plans'];
}

function allowedTypes(scope: PromotionManagementScope): PromotionTypeId[] | undefined {
  if (scope.mode === 'vendor_services') {
    return ['percentage', 'flat', 'first_booking', 'combo', 'loyalty', 'bundle', 'buy_x_get_y'];
  }
  if (scope.mode === 'vendor_seller') {
    return ['percentage', 'flat', 'first_order', 'buy_x_get_y', 'bundle', 'category_discount'];
  }
  return undefined;
}

export function PromotionWizard({
  open,
  onClose,
  scope,
  catalog,
  initial,
  existingCodes,
  onSave,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  scope: PromotionManagementScope;
  catalog: PromotionTargetCatalog;
  initial?: PromotionWizardForm;
  existingCodes?: string[];
  onSave: (form: PromotionWizardForm, publish: boolean) => Promise<void>;
  saving?: boolean;
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<PromotionWizardForm>(initial ?? DEFAULT_WIZARD_FORM());

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setForm(initial ?? DEFAULT_WIZARD_FORM());
  }, [open, initial]);

  const issues = useMemo(
    () => validatePromotionWizard(form, { existingCodes }),
    [form, existingCodes]
  );

  if (!open) return null;

  const patch = (p: Partial<PromotionWizardForm>) => setForm((f) => ({ ...f, ...p }));

  const pickKind = (kind: CreateKind) => {
    patch({
      createKind: kind,
      autoApply: kind === 'promotion',
      uiStatus: kind === 'promotion' ? 'active' : form.uiStatus,
    });
    setStep(1);
  };

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => (step === 0 ? onClose() : setStep((s) => Math.max(0, s - 1)));

  const handlePublish = async (asDraft: boolean) => {
    const payload = { ...form, uiStatus: asDraft ? ('draft' as const) : ('active' as const) };
    if (hasValidationErrors(validatePromotionWizard(payload, { existingCodes }))) return;
    await onSave(payload, !asDraft);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {initial ? 'Edit' : 'Create'}{' '}
              {form.createKind === 'coupon' ? 'coupon' : 'promotion'}
            </h2>
            <p className="text-xs text-slate-500">
              Step {step + 1} of {STEPS.length}: {STEPS[step]}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => pickKind('promotion')}
                className="rounded-2xl border-2 border-slate-200 p-6 text-left hover:border-orange-400 hover:bg-orange-50/50"
              >
                <Sparkles className="h-8 w-8 text-violet-600 mb-3" />
                <h3 className="font-bold text-slate-900">Promotion</h3>
                <p className="text-sm text-slate-500 mt-1">Auto applied at checkout — no code needed</p>
              </button>
              {scope.canManageCoupons ? (
                <button
                  type="button"
                  onClick={() => pickKind('coupon')}
                  className="rounded-2xl border-2 border-slate-200 p-6 text-left hover:border-amber-400 hover:bg-amber-50/50"
                >
                  <Ticket className="h-8 w-8 text-amber-600 mb-3" />
                  <h3 className="font-bold text-slate-900">Coupon</h3>
                  <p className="text-sm text-slate-500 mt-1">Customer enters a code at checkout</p>
                </button>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                  Coupons are managed at platform level for this portal.
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Name *</label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={form.name}
                  onChange={(e) => patch({ name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Description</label>
                <textarea
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  rows={3}
                  value={form.description}
                  onChange={(e) => patch({ description: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Status (visual)</label>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={form.uiStatus}
                  onChange={(e) => patch({ uiStatus: e.target.value as PromotionWizardForm['uiStatus'] })}
                >
                  <option value="draft">Draft</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </div>
              {form.createKind === 'coupon' && (
                <div>
                  <label className="text-sm font-medium text-slate-700">Coupon code *</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono uppercase"
                    value={form.code ?? ''}
                    onChange={(e) => patch({ code: e.target.value.toUpperCase() })}
                  />
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <PromotionTypeSelector
              value={form.promotionType}
              onChange={(promotionType) => patch({ promotionType })}
              allowed={allowedTypes(scope)}
            />
          )}

          {step === 3 && (
            <PromotionTriggerSelector value={form.audience} onChange={(audience) => patch({ audience })} />
          )}

          {step === 4 && (
            <PromotionTargetSelector
              enabledScopes={enabledScopes(scope)}
              catalog={catalog}
              selectedScopes={form.targetScopes}
              selectedTargets={form.selectedTargets}
              onScopesChange={(targetScopes) => patch({ targetScopes })}
              onTargetsChange={(selectedTargets) => patch({ selectedTargets })}
            />
          )}

          {step === 5 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">Discount type</label>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={form.discountType}
                  onChange={(e) =>
                    patch({ discountType: e.target.value as 'percentage' | 'fixed' })
                  }
                >
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Flat amount</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Value *</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={form.discountValue}
                  onChange={(e) => patch({ discountValue: Number(e.target.value) })}
                />
              </div>
              {form.discountType === 'percentage' && (
                <div>
                  <label className="text-sm font-medium text-slate-700">Max discount (₹)</label>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={form.maxDiscount ?? ''}
                    onChange={(e) =>
                      patch({ maxDiscount: e.target.value ? Number(e.target.value) : undefined })
                    }
                  />
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-slate-700">Minimum amount (₹)</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={form.minAmount ?? ''}
                  onChange={(e) =>
                    patch({ minAmount: e.target.value ? Number(e.target.value) : undefined })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Total usage limit</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={form.usageLimit ?? ''}
                  onChange={(e) =>
                    patch({ usageLimit: e.target.value ? Number(e.target.value) : undefined })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Per customer limit</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={form.usageLimitPerUser ?? ''}
                  onChange={(e) =>
                    patch({
                      usageLimitPerUser: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                />
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">Start date *</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={form.startDate}
                  onChange={(e) => patch({ startDate: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">End date *</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={form.endDate}
                  onChange={(e) => patch({ endDate: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Timezone</label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-slate-50"
                  value={form.timezone}
                  readOnly
                />
                <p className="text-xs text-slate-400 mt-1">Recurring schedules — coming soon</p>
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-4">
              <PromotionPreview form={form} />
              <PromotionSummary form={form} />
              {issues.length > 0 && (
                <ul className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm space-y-1">
                  {issues.map((i, idx) => (
                    <li key={idx} className={i.severity === 'error' ? 'text-red-700' : 'text-amber-800'}>
                      {i.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 bg-slate-50">
          <button
            type="button"
            onClick={back}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200"
          >
            <ChevronLeft className="h-4 w-4" />
            {step === 0 ? 'Cancel' : 'Back'}
          </button>
          <div className="flex gap-2">
            {step === 7 ? (
              <>
                <button
                  type="button"
                  disabled={saving || hasValidationErrors(issues)}
                  onClick={() => handlePublish(true)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  Save draft
                </button>
                <button
                  type="button"
                  disabled={saving || hasValidationErrors(issues)}
                  onClick={() => handlePublish(false)}
                  className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? 'Publishing…' : 'Publish'}
                </button>
              </>
            ) : step > 0 ? (
              <button
                type="button"
                onClick={next}
                className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
