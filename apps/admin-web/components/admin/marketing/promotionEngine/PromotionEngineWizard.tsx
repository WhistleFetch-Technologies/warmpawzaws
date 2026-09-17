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
  onClose,
  onSaveDraft,
}: {
  open: boolean;
  draft: PromoEngineDraft | null;
  onClose: () => void;
  onSaveDraft: (draft: PromoEngineDraft) => void;
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

  const saveDraft = () => {
    const errors = validateBasicsDraft(working.basics);
    if (errors.length) {
      toast.error(errors[0]);
      setStep(0);
      return;
    }
    const next = applyBasicsToDraft(working, working.basics);
    onSaveDraft(next);
    setDirty(false);
    toast.success('Draft saved locally — Abhi CRUD will persist this');
    onClose();
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
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Promotion Engine wizard</DialogTitle>
          <p className="text-sm text-slate-500">
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {STEPS.map((label, i) => (
              <Badge key={label} variant={i === step ? 'default' : 'outline'} className="text-[10px]">
                {label}
              </Badge>
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === 0 ? (
            <BasicsStep
              basics={working.basics}
              onChange={(basics) => {
                setWorking((d) => ({ ...d, basics }));
                setDirty(true);
              }}
            />
          ) : null}
          {step === 1 ? <AudienceStep /> : null}
          {step === 2 ? <BenefitsStep /> : null}
          {step === 3 ? <LimitsStep /> : null}
          {step === 4 ? <ReviewStep draft={working} /> : null}
        </div>

        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t bg-white px-6 py-3">
          <Button type="button" variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
            Back
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={saveDraft}>
              <Save className="mr-1 h-4 w-4" aria-hidden />
              Save draft
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={goNext}>
                Next
                <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
              </Button>
            ) : (
              <Button type="button" disabled title="Activate lands in Bindu Phase 3 after Abhi CRUD">
                Activate (Phase 3)
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
