'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
} from '@warmpawz/ui';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react';
import {
  createCommercialCampaign,
  createCampaignFromTemplate,
  orchestrateCommercialCampaign,
  transitionCampaignLifecycle,
} from '@/lib/commercial-campaign/commercial-campaign-api';
import type {
  CampaignAudience,
  CampaignFundingPolicy,
  CampaignRegistryResponse,
  CampaignScheduleType,
  CampaignNotificationMode,
  CommercialCampaignRecord,
  CreateCampaignInput,
} from '@/lib/commercial-campaign/types';
import { CampaignAudienceEditor } from './CampaignAudienceEditor';
import { CampaignScheduleEditor } from './CampaignScheduleEditor';
import { CampaignFundingEditor } from './CampaignFundingEditor';
import { CampaignNotificationEditor } from './CampaignNotificationEditor';
import { CampaignOrchestrationPanel } from './CampaignOrchestrationPanel';
import { CampaignTemplateGrid } from './CampaignTemplateGrid';
import type { AdminPromoSurface } from '@/lib/promotion-domain/surface-config';

const STEPS = [
  'General',
  'Template',
  'Audience',
  'Funding',
  'Schedule',
  'Promotions',
  'Notifications',
  'Review',
] as const;

export interface CampaignBuilderDraft {
  name: string;
  campaignType: string;
  templateId?: string;
  funding: CampaignFundingPolicy;
  scheduleType: CampaignScheduleType;
  startAt?: string;
  endAt?: string;
  audience: CampaignAudience;
  notificationMode: CampaignNotificationMode;
  notificationCampaignId?: string | null;
  pendingPromotions: Array<Record<string, unknown>>;
  pendingCoupons: Array<Record<string, unknown>>;
}

const DEFAULT_DRAFT = (): CampaignBuilderDraft => ({
  name: '',
  campaignType: 'custom',
  funding: { type: 'PLATFORM' },
  scheduleType: 'immediate',
  audience: { kind: 'all_customers' },
  notificationMode: 'skip',
  pendingPromotions: [],
  pendingCoupons: [],
});

export function CampaignBuilderDialog({
  open,
  onClose,
  registry,
  initialTemplateId,
  cloneFrom,
  onSuccess,
  surface = 'marketing',
}: {
  open: boolean;
  onClose: () => void;
  registry: CampaignRegistryResponse | null;
  initialTemplateId?: string;
  cloneFrom?: CommercialCampaignRecord | null;
  onSuccess: () => void;
  surface?: AdminPromoSurface;
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<CampaignBuilderDraft>(DEFAULT_DRAFT);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const campaignTypes = useMemo(() => {
    const entries = Object.entries(registry?.campaignTypes ?? {});
    return entries.map(([id, meta]) => ({ id, label: meta.label }));
  }, [registry]);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    if (cloneFrom) {
      setDraft({
        name: `${cloneFrom.name} (copy)`,
        campaignType: cloneFrom.campaignType,
        templateId: cloneFrom.templateId ?? undefined,
        funding: cloneFrom.funding,
        scheduleType: cloneFrom.scheduleType,
        startAt: cloneFrom.startAt ?? undefined,
        endAt: cloneFrom.endAt ?? undefined,
        audience: cloneFrom.audience,
        notificationMode: cloneFrom.notificationMode,
        notificationCampaignId: cloneFrom.notificationCampaignId,
        pendingPromotions: [],
        pendingCoupons: [],
      });
      setDirty(true);
      return;
    }
    if (initialTemplateId && registry) {
      const t = registry.templates.find((x) => x.id === initialTemplateId);
      if (t) {
        setDraft({
          ...DEFAULT_DRAFT(),
          name: t.name,
          campaignType: t.campaignType,
          templateId: t.id,
          funding: t.defaultFunding,
          scheduleType: t.defaultScheduleType,
        });
        setDirty(true);
        return;
      }
    }
    setDraft(DEFAULT_DRAFT());
    setDirty(false);
  }, [open, cloneFrom, initialTemplateId, registry]);

  const patch = useCallback((p: Partial<CampaignBuilderDraft>) => {
    setDraft((d) => ({ ...d, ...p }));
    setDirty(true);
  }, []);

  const buildInput = (): CreateCampaignInput => {
    const discountDomain = surface === 'ecommerce' ? 'ECOMMERCE' : 'SERVICE';
    return {
      name: draft.name.trim(),
      campaignType: draft.campaignType,
      templateId: draft.templateId,
      funding: draft.funding,
      scheduleType: draft.scheduleType,
      startAt: draft.startAt,
      endAt: draft.endAt,
      audience: draft.audience,
      notificationMode: draft.notificationMode,
      notificationCampaignId: draft.notificationCampaignId ?? undefined,
      discountDomain,
      surface,
      metadata: {
        domain: surface === 'ecommerce' ? 'ecommerce' : 'service',
        surface,
        discount_domain: discountDomain,
      },
    };
  };

  const handlePublish = async () => {
    if (!draft.name.trim()) {
      toast.error('Campaign name is required');
      return;
    }
    setSaving(true);
    try {
      let campaign: CommercialCampaignRecord;
      if (draft.templateId && !cloneFrom) {
        campaign = await createCampaignFromTemplate(draft.templateId, buildInput());
      } else {
        campaign = await createCommercialCampaign(buildInput());
      }

      if (draft.pendingPromotions.length || draft.pendingCoupons.length) {
        await orchestrateCommercialCampaign(campaign.id, {
          promotions: draft.pendingPromotions,
          coupons: draft.pendingCoupons,
        });
      }

      await transitionCampaignLifecycle(campaign.id, 'review');
      toast.success('Campaign created and submitted for review');
      setDirty(false);
      onSuccess();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to publish campaign');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!draft.name.trim()) {
      toast.error('Campaign name is required');
      return;
    }
    setSaving(true);
    try {
      if (draft.templateId) {
        await createCampaignFromTemplate(draft.templateId, buildInput());
      } else {
        await createCommercialCampaign(buildInput());
      }
      toast.success('Draft campaign saved');
      setDirty(false);
      onSuccess();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (dirty && !confirm('Discard unsaved campaign changes?')) return;
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => !v && handleClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Campaign builder</DialogTitle>
          <p className="text-sm text-slate-500">
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {STEPS.map((s, i) => (
              <Badge key={s} variant={i === step ? 'default' : 'outline'} className="text-[10px]">
                {s}
              </Badge>
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === 0 ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Campaign name</Label>
                <Input value={draft.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => patch({ name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Campaign type</Label>
                <Select value={draft.campaignType} onValueChange={(v: string) => patch({ campaignType: v })}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {campaignTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <CampaignTemplateGrid
              templates={registry?.templates ?? []}
              onPreview={(t) => toast.message(`${t.name}: ${t.campaignType} / ${t.defaultFunding.type}`)}
              onDuplicate={(t) =>
                patch({
                  name: `${t.name} copy`,
                  campaignType: t.campaignType,
                  templateId: t.id,
                  funding: t.defaultFunding,
                  scheduleType: t.defaultScheduleType,
                })
              }
              onCreateFrom={(t) =>
                patch({
                  name: t.name,
                  campaignType: t.campaignType,
                  templateId: t.id,
                  funding: t.defaultFunding,
                  scheduleType: t.defaultScheduleType,
                })
              }
            />
          ) : null}

          {step === 2 ? (
            <CampaignAudienceEditor audience={draft.audience} onChange={(a) => patch({ audience: a })} />
          ) : null}

          {step === 3 ? (
            <CampaignFundingEditor funding={draft.funding} onChange={(f) => patch({ funding: f })} />
          ) : null}

          {step === 4 ? (
            <CampaignScheduleEditor
              scheduleType={draft.scheduleType}
              startAt={draft.startAt}
              endAt={draft.endAt}
              onChange={(p) => patch(p)}
            />
          ) : null}

          {step === 5 ? (
            <CampaignOrchestrationPanel surface={surface} pendingPromotions={draft.pendingPromotions}
              pendingCoupons={draft.pendingCoupons}
              onPromotionsChange={(rows) => patch({ pendingPromotions: rows })}
              onCouponsChange={(rows) => patch({ pendingCoupons: rows })}
            />
          ) : null}

          {step === 6 ? (
            <CampaignNotificationEditor
              mode={draft.notificationMode}
              notificationCampaignId={draft.notificationCampaignId}
              onChange={(p) => patch(p)}
            />
          ) : null}

          {step === 7 ? (
            <div className="space-y-3 rounded-xl border bg-slate-50 p-4 text-sm">
              <p>
                <strong>Name:</strong> {draft.name || '—'}
              </p>
              <p>
                <strong>Type:</strong> {draft.campaignType}
              </p>
              <p>
                <strong>Funding:</strong> {draft.funding.type}
              </p>
              <p>
                <strong>Schedule:</strong> {draft.scheduleType}
              </p>
              <p>
                <strong>Audience:</strong> {draft.audience.kind}
              </p>
              <p>
                <strong>Queued promotions:</strong> {draft.pendingPromotions.length}
              </p>
              <p>
                <strong>Queued coupons:</strong> {draft.pendingCoupons.length}
              </p>
              <p>
                <strong>Notification:</strong> {draft.notificationMode}
              </p>
            </div>
          ) : null}
        </div>

        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t bg-white px-6 py-3">
          <Button type="button" variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
            Back
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={() => void handleSaveDraft()}>
              <Save className="mr-1 h-4 w-4" aria-hidden />
              Save draft
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={() => setStep((s) => s + 1)}>
                Next
                <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
              </Button>
            ) : (
              <Button type="button" disabled={saving} onClick={() => void handlePublish()}>
                Publish for review
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
