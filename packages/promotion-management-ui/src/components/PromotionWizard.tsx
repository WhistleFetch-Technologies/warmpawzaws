'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, Ticket, X } from 'lucide-react';
import type {
  CreateKind,
  PromotionManagementScope,
  PromotionTargetCatalog,
  PromotionWizardForm,
  PromotionTypeId,
  SmartTargetCatalogAdapter,
  TargetScopeId,
} from '../types';
import { DEFAULT_WIZARD_FORM } from '../types';
import { validatePromotionWizard, hasValidationErrors } from '../validation';
import { WIZARD_STEP_LABELS, wizardProgressPercent } from '../wizard-steps';
import { PromotionTypeSelector } from './PromotionTypeSelector';
import { PromotionTriggerSelector } from './PromotionTriggerSelector';
import { PromotionTargetSelector } from './PromotionTargetSelector';
import { PromotionSummary } from './PromotionSummary';
import { PromotionPreview } from './PromotionPreview';

const LAST_STEP = WIZARD_STEP_LABELS.length - 1;

function enabledScopes(scope: PromotionManagementScope): TargetScopeId[] {
  // Never offer entire_platform / all_products as static tabs — Smart Context owns those flows.
  const withoutBroad = (scopes: TargetScopeId[]) =>
    scopes.filter((s) => s !== 'entire_platform' && s !== 'all_products');

  if (scope.enabledTargetScopes?.length) {
    return withoutBroad(scope.enabledTargetScopes);
  }
  if (scope.mode === 'platform') {
    return [
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

function snapshotForm(form: PromotionWizardForm): string {
  return JSON.stringify(form);
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
  initialStep = 0,
  smartTargetAdapter,
}: {
  open: boolean;
  onClose: () => void;
  scope: PromotionManagementScope;
  catalog: PromotionTargetCatalog;
  initial?: PromotionWizardForm;
  existingCodes?: string[];
  onSave: (form: PromotionWizardForm, publish: boolean) => Promise<void>;
  saving?: boolean;
  initialStep?: number;
  smartTargetAdapter?: SmartTargetCatalogAdapter;
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<PromotionWizardForm>(initial ?? DEFAULT_WIZARD_FORM());
  const baselineRef = useRef('');

  useEffect(() => {
    if (!open) return;
    const next = initial ?? DEFAULT_WIZARD_FORM();
    setStep(Math.min(LAST_STEP, Math.max(0, initialStep)));
    setForm(next);
    baselineRef.current = snapshotForm(next);
  }, [open, initial, initialStep]);

  const validationAudience = scope.mode === 'platform' ? 'admin' : 'vendor';
  const smartTargetSurface = scope.smartTargetSurface;

  const issues = useMemo(
    () =>
      validatePromotionWizard(form, {
        existingCodes,
        audience: validationAudience,
        smartTargetSurface,
      }),
    [form, existingCodes, validationAudience, smartTargetSurface]
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

  const requestClose = () => {
    const dirty = snapshotForm(form) !== baselineRef.current;
    if (dirty && step > 0) {
      if (!window.confirm('Discard unsaved changes?')) return;
    }
    onClose();
  };

  const stepBlockingIssues = useMemo(() => {
    if (step === 1) {
      return issues.filter((i) => i.field === 'name' || i.field === 'code');
    }
    if (step === 2) {
      return issues.filter((i) => i.field === 'target');
    }
    if (step === 3) {
      return issues.filter((i) =>
        ['discountValue', 'maxDiscount', 'minAmount', 'usageLimit', 'usageLimitPerUser', 'schedule'].includes(
          i.field
        )
      );
    }
    return [];
  }, [issues, step]);

  const canAdvance =
    step === 0 || !hasValidationErrors(stepBlockingIssues);

  const next = () => {
    if (!canAdvance) return;
    setStep((s) => Math.min(LAST_STEP, s + 1));
  };
  const back = () => (step === 0 ? requestClose() : setStep((s) => Math.max(0, s - 1)));

  const handlePublish = async (asDraft: boolean) => {
    const payload = { ...form, uiStatus: asDraft ? ('draft' as const) : ('active' as const) };
    if (hasValidationErrors(
      validatePromotionWizard(payload, {
        existingCodes,
        audience: validationAudience,
        smartTargetSurface,
      })
    )) return;
    await onSave(payload, !asDraft);
    baselineRef.current = snapshotForm(payload);
    setStep(0);
  };

  const progress = wizardProgressPercent(step);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-0 sm:p-4">
      <div className="flex min-h-full items-stretch justify-center sm:items-center sm:py-4">
        <div className="flex h-[100dvh] w-full max-w-4xl min-h-0 flex-col overflow-hidden rounded-none bg-white shadow-2xl sm:h-[92dvh] sm:max-h-[92dvh] sm:rounded-2xl">
        <div className="space-y-2 border-b border-slate-100 px-4 py-3 sm:space-y-3 sm:px-5 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-slate-900 sm:text-lg">
                {initial ? 'Edit' : 'Create'}{' '}
                {form.createKind === 'coupon' ? 'coupon' : 'promotion'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Step {step + 1} of {WIZARD_STEP_LABELS.length}: {WIZARD_STEP_LABELS[step]}
              </p>
            </div>
            <button
              type="button"
              onClick={requestClose}
              aria-label="Close"
              className="rounded-lg p-2 hover:bg-slate-100"
            >
              <X className="h-5 w-5 text-slate-500" />
            </button>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-orange-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="hidden max-h-12 flex-wrap gap-1 overflow-hidden sm:flex">
            {WIZARD_STEP_LABELS.map((label, i) => (
              <span
                key={label}
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  i === step
                    ? 'bg-orange-100 text-orange-800'
                    : i < step
                      ? 'text-slate-500'
                      : 'text-slate-300'
                }`}
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => pickKind('promotion')}
                className="rounded-2xl border-2 border-slate-200 p-4 text-left hover:border-orange-400 hover:bg-orange-50/50 sm:p-6"
              >
                <Sparkles className="h-8 w-8 text-violet-600 mb-3" />
                <h3 className="font-bold text-slate-900">Promotion</h3>
                <p className="text-sm text-slate-500 mt-1">Auto-applied at checkout — no code needed</p>
              </button>
              {scope.canManageCoupons ? (
                <button
                  type="button"
                  onClick={() => pickKind('coupon')}
                  className="rounded-2xl border-2 border-slate-200 p-4 text-left hover:border-amber-400 hover:bg-amber-50/50 sm:p-6"
                >
                  <Ticket className="h-8 w-8 text-amber-600 mb-3" />
                  <h3 className="font-bold text-slate-900">Coupon</h3>
                  <p className="text-sm text-slate-500 mt-1">Customer enters a code at checkout</p>
                </button>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 sm:p-6">
                  Coupons are managed at platform level for this portal.
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-800">Basic information</h3>
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
                    rows={2}
                    value={form.description}
                    onChange={(e) => patch({ description: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Status</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={form.uiStatus}
                    onChange={(e) =>
                      patch({ uiStatus: e.target.value as PromotionWizardForm['uiStatus'] })
                    }
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
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-2">Offer type</h3>
                <PromotionTypeSelector
                  value={form.promotionType}
                  onChange={(promotionType) => patch({ promotionType })}
                  allowed={allowedTypes(scope)}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-2">Who is eligible?</h3>
                <PromotionTriggerSelector value={form.audience} onChange={(audience) => patch({ audience })} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-2">
                  What does this apply to? <span className="text-red-500">*</span>
                </h3>
                <p className="mb-2 text-xs text-slate-500">
                  Required — select a target type, then choose specific items. Leaving this blank would apply to
                  all, which is not allowed.
                </p>
                <PromotionTargetSelector
                  enabledScopes={enabledScopes(scope)}
                  catalog={catalog}
                  selectedScopes={form.targetScopes}
                  selectedTargets={form.selectedTargets}
                  onScopesChange={(targetScopes) =>
                    patch({
                      // Smart Context owns broad scopes (entire_platform / all_products).
                      // Static vendor mode still strips broad apply-all scopes.
                      targetScopes: scope.smartTargetSurface
                        ? targetScopes
                        : targetScopes.filter(
                            (s) => s !== 'entire_platform' && s !== 'all_products'
                          ),
                    })
                  }
                  onTargetsChange={(selectedTargets) => patch({ selectedTargets })}
                  smartTargetSurface={scope.smartTargetSurface}
                  smartTargetAdapter={smartTargetAdapter}
                />
                {step === 2 && stepBlockingIssues.length > 0 ? (
                  <ul className="mt-3 space-y-1 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {stepBlockingIssues.map((i, idx) => (
                      <li key={idx}>{i.message}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
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
              <div className="grid gap-4 sm:grid-cols-2 border-t border-slate-100 pt-4">
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
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <PromotionPreview
                form={form}
                catalog={catalog}
                smartTargetAdapter={smartTargetAdapter}
              />
              <PromotionSummary
                form={form}
                catalog={catalog}
                smartSurface={
                  scope.smartTargetSurface === 'marketing' || scope.smartTargetSurface === 'ecommerce'
                    ? scope.smartTargetSurface
                    : undefined
                }
              />
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

        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
          <button
            type="button"
            onClick={back}
            className="inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 sm:justify-start"
          >
            <ChevronLeft className="h-4 w-4" />
            {step === 0 ? 'Close' : 'Back'}
          </button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {step === LAST_STEP ? (
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
                  {saving ? 'Saving…' : initial ? 'Update' : 'Publish'}
                </button>
              </>
            ) : step > 0 ? (
              <button
                type="button"
                disabled={!canAdvance}
                onClick={next}
                className="inline-flex items-center justify-center gap-1 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
