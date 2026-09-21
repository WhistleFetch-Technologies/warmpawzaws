'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@warmpawz/ui';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { applyBasicsToDraft, validateBasicsDraft } from '@/lib/promo-engine/draft';
import { validateAudience } from '@/lib/promo-engine/audience';
import { validateVcfAudience, validateVcfBenefits, vcfOrEmpty } from '@/lib/promo-engine/vcf';
import { createEmptyDraft, type PromoEngineDraft } from '@/lib/promo-engine/types';
import { BasicsStep } from './steps/BasicsStep';
import { AudienceStep } from './steps/AudienceStep';
import { BenefitsStep } from './steps/BenefitsStep';
import { LimitsStep } from './steps/LimitsStep';
import { ReviewStep } from './steps/ReviewStep';

const STEPS = ['Basics', 'Audience', 'Benefits', 'Limits', 'Review'] as const;

export function PromotionEngineWizard({
  open,
  draft,
  saving = false,
  onClose,
  onSaveDraft,
  onActivate,
}: {
  open: boolean;
  draft: PromoEngineDraft | null;
  saving?: boolean;
  onClose: () => void;
  onSaveDraft: (draft: PromoEngineDraft) => void | Promise<void>;
  onActivate: (draft: PromoEngineDraft) => void | Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [working, setWorking] = useState<PromoEngineDraft>(draft ?? createEmptyDraft('draft'));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setWorking(draft ?? createEmptyDraft('draft'));
    setDirty(false);
  }, [open, draft]);

  const handleClose = () => {
    if (dirty && !confirm('Discard unsaved promotion engine changes?')) return;
    onClose();
  };

  const prepared = () => applyBasicsToDraft(working, working.basics);

  const saveDraft = async () => {
    const errors = validateBasicsDraft(working.basics);
    if (errors.length) {
      toast.error(errors[0]);
      setStep(0);
      return;
    }
    await onSaveDraft(prepared());
    setDirty(false);
  };

  const activate = async () => {
    const basicsErrors = validateBasicsDraft(working.basics);
    if (basicsErrors.length) {
      toast.error(basicsErrors[0]);
      setStep(0);
      return;
    }
    const audienceErrors = working.vcf
      ? validateVcfAudience(working.vcf)
      : validateAudience(working);
    if (audienceErrors.length) {
      toast.error(audienceErrors[0]);
      setStep(1);
      return;
    }
    const vcf = vcfOrEmpty(working);
    const hasDiscount = working.benefitJson.some((b) => b.type === 'DISCOUNT' && Number(b.value) > 0);
    const hasCashback = working.benefitJson.some((b) => b.type === 'CASHBACK' && Number(b.value) > 0);
    const benefitErrors = validateVcfBenefits(vcf, hasDiscount, hasCashback);
    if (benefitErrors.length) {
      toast.error(benefitErrors[0]);
      setStep(2);
      return;
    }
    await onActivate(prepared());
    setDirty(false);
  };

  const goNext = () => {
    if (step === 0) {
      const errors = validateBasicsDraft(working.basics);
      if (errors.length) {
        toast.error(errors[0]);
        return;
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => !v && handleClose()}>
      <DialogContent
        className="flex h-[min(94vh,56rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0 sm:w-[calc(100vw-2rem)] sm:max-w-6xl"
      >
        <DialogHeader className="shrink-0 border-b px-4 py-4 text-left sm:px-8">
          <DialogTitle>Promotion Engine wizard</DialogTitle>
          <p className="text-sm text-slate-500">
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {STEPS.map((label, i) => (
              <Badge key={label} variant={i === step ? 'default' : 'outline'} className="text-xs">
                {label}
              </Badge>
            ))}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-6">
          {step === 0 ? (
            <BasicsStep
              basics={working.basics}
              onChange={(basics) => {
                setWorking((d) => ({ ...d, basics }));
                setDirty(true);
              }}
            />
          ) : null}
          {step === 1 ? (
            <AudienceStep
              draft={working}
              onChange={(next) => {
                setWorking(next);
                setDirty(true);
              }}
            />
          ) : null}
          {step === 2 ? (
            <BenefitsStep
              draft={working}
              onChange={(next) => {
                setWorking(next);
                setDirty(true);
              }}
            />
          ) : null}
          {step === 3 ? (
            <LimitsStep
              draft={working}
              onChange={(next) => {
                setWorking(next);
                setDirty(true);
              }}
            />
          ) : null}
          {step === 4 ? <ReviewStep draft={working} /> : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t bg-white px-4 py-4 sm:px-8">
          <Button type="button" variant="ghost" disabled={step === 0 || saving} onClick={() => setStep((s) => s - 1)}>
            <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
            Back
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={() => void saveDraft()}>
              <Save className="mr-1 h-4 w-4" aria-hidden />
              Save draft
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" disabled={saving} onClick={goNext}>
                Next
                <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
              </Button>
            ) : (
              <Button type="button" disabled={saving} onClick={() => void activate()}>
                Activate
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
