'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@warmpawz/ui';
import {
  errorMessage,
  Field,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '@/components/admin/warmpawz-insurance/shared/insurance-ui';
import { useSaveCompanyPlan } from '@/hooks/warmpawz-insurance/useInsuranceAdmin';
import type { InsurancePlan, InsurancePlanInput } from '@/lib/warmpawz-insurance-admin';

const EMPTY: InsurancePlanInput = {
  name: '',
  productType: '',
  highlights: [],
  premiumFrom: 0,
  premiumUnit: 'year',
  coverOptions: [],
  sumInsuredOptions: [],
  copayOptions: [],
  sortOrder: 0,
};

function lines(value: string): string[] {
  return value.split('\n').map((line) => line.trim()).filter(Boolean);
}

export function PlanDialog({
  open,
  companyId,
  plan,
  onClose,
}: {
  open: boolean;
  companyId: string;
  plan: InsurancePlan | null;
  onClose: () => void;
}) {
  const save = useSaveCompanyPlan();
  const [name, setName] = useState('');
  const [productType, setProductType] = useState('');
  const [highlights, setHighlights] = useState('');
  const [premiumFrom, setPremiumFrom] = useState('0');
  const [premiumUnit, setPremiumUnit] = useState<'month' | 'year'>('year');
  const [covers, setCovers] = useState('');
  const [sums, setSums] = useState('');
  const [copays, setCopays] = useState('');
  const [sortOrder, setSortOrder] = useState('0');

  useEffect(() => {
    if (!open) return;
    setName(plan?.name ?? '');
    setProductType(plan?.productType ?? '');
    setHighlights((plan?.highlights ?? []).join('\n'));
    setPremiumFrom(String(plan?.premiumFrom ?? 0));
    setPremiumUnit(plan?.premiumUnit ?? 'year');
    setCovers((plan?.coverOptions ?? []).map((c) => `${c.key}|${c.label}`).join('\n'));
    setSums((plan?.sumInsuredOptions ?? []).join('\n'));
    setCopays((plan?.copayOptions ?? []).join('\n'));
    setSortOrder(String(plan?.sortOrder ?? 0));
  }, [open, plan]);

  const submit = async () => {
    const highlightList = lines(highlights);
    if (name.trim().length < 2) return toast.error('Enter the plan name');
    if (!productType.trim()) return toast.error('Enter the product type');
    if (highlightList.length > 3) return toast.error('Use at most 3 highlights');
    const premium = Number(premiumFrom);
    if (!Number.isFinite(premium) || premium < 0) return toast.error('Premium must be 0 or more');
    const input: InsurancePlanInput = {
      ...EMPTY,
      name: name.trim(),
      productType: productType.trim(),
      highlights: highlightList,
      premiumFrom: premium,
      premiumUnit,
      coverOptions: lines(covers).map((line) => {
        const [key, label] = line.split('|');
        return { key: (key || label || '').trim(), label: (label || key || '').trim() };
      }).filter((row) => row.key && row.label),
      sumInsuredOptions: lines(sums),
      copayOptions: lines(copays),
      sortOrder: Number(sortOrder) || 0,
    };
    try {
      await save.mutateAsync({ companyId, planId: plan?.id, input });
      toast.success(plan ? 'Plan updated' : 'Plan added');
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{plan ? `Edit ${plan.name}` : 'Add plan'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Plan name">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Product type">
            <input className={inputClass} value={productType} onChange={(e) => setProductType(e.target.value)} placeholder="Health" />
          </Field>
          <Field label="Highlights" hint="Up to 3, one per line">
            <textarea className={inputClass} rows={3} value={highlights} onChange={(e) => setHighlights(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Premium starts at (₹)">
              <input className={inputClass} type="number" min={0} value={premiumFrom} onChange={(e) => setPremiumFrom(e.target.value)} />
            </Field>
            <Field label="Unit">
              <select className={inputClass} value={premiumUnit} onChange={(e) => setPremiumUnit(e.target.value as 'month' | 'year')}>
                <option value="month">Per month</option>
                <option value="year">Per year</option>
              </select>
            </Field>
          </div>
          <Field label="Cover options" hint="One per line: key|label">
            <textarea className={inputClass} rows={3} value={covers} onChange={(e) => setCovers(e.target.value)} />
          </Field>
          <Field label="Sum insured options" hint="One per line">
            <textarea className={inputClass} rows={2} value={sums} onChange={(e) => setSums(e.target.value)} />
          </Field>
          <Field label="Co-pay options" hint="One per line">
            <textarea className={inputClass} rows={2} value={copays} onChange={(e) => setCopays(e.target.value)} />
          </Field>
          <Field label="Sort order">
            <input className={inputClass} type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <button type="button" className={secondaryButtonClass} onClick={onClose}>Cancel</button>
          <button type="button" className={primaryButtonClass} onClick={submit} disabled={save.isPending}>Save plan</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
