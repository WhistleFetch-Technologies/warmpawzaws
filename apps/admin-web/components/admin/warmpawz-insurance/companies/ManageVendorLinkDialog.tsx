'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@warmpawz/ui';
import {
  CommissionTermsFields,
  emptyTermsDraft,
  PayoutScheduleFields,
  scheduleDraftError,
  scheduleDraftToInput,
  scheduleToDraft,
  termsDraftError,
  termsDraftToInput,
  type ScheduleDraft,
  type TermsDraft,
} from '@/components/admin/warmpawz-insurance/shared/insurance-forms';
import {
  errorMessage,
  Field,
  formatDate,
  inputClass,
  primaryButtonClass,
  todayIso,
} from '@/components/admin/warmpawz-insurance/shared/insurance-ui';
import {
  useAddVendorLinkTerms,
  usePayoutOverview,
  useSetVendorLinkSchedule,
  useUpdateVendorLink,
  useVendorLinkTerms,
} from '@/hooks/warmpawz-insurance/useInsuranceAdmin';
import type { VendorLink } from '@/lib/warmpawz-insurance-admin';

type Tab = 'details' | 'commission' | 'schedule';

export function ManageVendorLinkDialog({ link, onClose }: { link: VendorLink | null; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('details');
  const linkId = link?.id;
  useEffect(() => {
    if (linkId) setTab('details');
  }, [linkId]);

  return (
    <Dialog open={Boolean(link)} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        {link ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {link.vendorName} · {link.companyName}
              </DialogTitle>
            </DialogHeader>
            <div className="flex gap-1 border-b border-gray-200">
              {(
                [
                  ['details', 'Link details'],
                  ['commission', 'Commission terms'],
                  ['schedule', 'Payout schedule'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                    tab === id ? 'border-[#FF8C42] text-[#FF8C42]' : 'border-transparent text-gray-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab === 'details' ? <LinkDetailsTab link={link} onSaved={onClose} /> : null}
            {tab === 'commission' ? <CommissionTab link={link} /> : null}
            {tab === 'schedule' ? <ScheduleTab link={link} /> : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function LinkDetailsTab({ link, onSaved }: { link: VendorLink; onSaved: () => void }) {
  const [status, setStatus] = useState(link.status);
  const [authorisationRef, setAuthorisationRef] = useState(link.authorisationRef ?? '');
  const [agencyCode, setAgencyCode] = useState(link.agencyCode ?? '');
  const [effectiveFrom, setEffectiveFrom] = useState(link.effectiveFrom);
  const [effectiveTo, setEffectiveTo] = useState(link.effectiveTo ?? '');
  const [notes, setNotes] = useState(link.notes ?? '');
  const update = useUpdateVendorLink();

  const submit = async () => {
    if (effectiveTo && effectiveTo < effectiveFrom) return toast.error('End date must be after the start date');
    try {
      await update.mutateAsync({
        id: link.id,
        input: {
          status,
          authorisationRef: authorisationRef.trim() || null,
          agencyCode: agencyCode.trim() || null,
          effectiveFrom,
          effectiveTo: effectiveTo || null,
          notes: notes.trim() || null,
        },
      });
      toast.success('Link updated');
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Status" hint="Commission already earned on suspended or ended links still shows in Premium payout">
          <select
            className={inputClass}
            value={status}
            onChange={(e) => setStatus(e.target.value as VendorLink['status'])}
          >
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="ended">Ended</option>
          </select>
        </Field>
        <Field label="Authorisation reference">
          <input
            className={inputClass}
            value={authorisationRef}
            onChange={(e) => setAuthorisationRef(e.target.value)}
          />
        </Field>
        <Field label="Agency code">
          <input className={inputClass} value={agencyCode} onChange={(e) => setAgencyCode(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Effective from">
            <input
              type="date"
              className={inputClass}
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
          </Field>
          <Field label="Effective to">
            <input
              type="date"
              className={inputClass}
              value={effectiveTo}
              min={effectiveFrom}
              onChange={(e) => setEffectiveTo(e.target.value)}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="flex justify-end">
        <button type="button" className={primaryButtonClass} disabled={update.isPending} onClick={submit}>
          {update.isPending ? 'Saving…' : 'Save link'}
        </button>
      </div>
    </div>
  );
}

function CommissionTab({ link }: { link: VendorLink }) {
  const { data: history, isLoading } = useVendorLinkTerms(link.id);
  const [draft, setDraft] = useState<TermsDraft>(emptyTermsDraft(todayIso()));
  const add = useAddVendorLinkTerms();

  const submit = async () => {
    const error = termsDraftError(draft);
    if (error) return toast.error(error);
    try {
      await add.mutateAsync({ id: link.id, input: termsDraftToInput(draft) });
      toast.success('New commission terms added');
      setDraft(emptyTermsDraft(todayIso()));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="space-y-5 pt-2">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">History</h3>
        {isLoading ? (
          <p className="mt-2 text-sm text-gray-500">Loading…</p>
        ) : history?.length ? (
          <ul className="mt-2 divide-y divide-gray-100 rounded-md border border-gray-200">
            {history.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div>
                  <div className="font-medium text-gray-900">{t.description}</div>
                  {t.notes ? <div className="text-xs text-gray-500">{t.notes}</div> : null}
                </div>
                <div className="whitespace-nowrap text-xs text-gray-600">
                  From {formatDate(t.effectiveFrom)}
                  {link.currentTerms?.id === t.id ? (
                    <span className="ml-2 rounded-full bg-green-50 px-2 py-0.5 text-green-700">In force</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-gray-500">No terms yet.</p>
        )}
      </div>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Add new terms</h3>
        <p className="text-xs text-gray-500">
          Policies issued on or after the start date use the new terms. Earlier policies are not repriced.
        </p>
        <CommissionTermsFields value={draft} onChange={setDraft} />
        <div className="flex justify-end">
          <button type="button" className={primaryButtonClass} disabled={add.isPending} onClick={submit}>
            {add.isPending ? 'Adding…' : 'Add terms'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ScheduleTab({ link }: { link: VendorLink }) {
  const { data: overview } = usePayoutOverview();
  const fallback = overview?.defaultSchedule;
  const [useDefault, setUseDefault] = useState(!link.scheduleOverride);
  const [draft, setDraft] = useState<ScheduleDraft | null>(
    link.scheduleOverride ? scheduleToDraft(link.scheduleOverride) : null,
  );
  const save = useSetVendorLinkSchedule();

  useEffect(() => {
    if (!draft && fallback) setDraft(scheduleToDraft(fallback));
  }, [draft, fallback]);

  const submit = async () => {
    if (!useDefault) {
      if (!draft) return;
      const error = scheduleDraftError(draft);
      if (error) return toast.error(error);
    }
    try {
      await save.mutateAsync({
        id: link.id,
        input: useDefault || !draft ? { useDefault: true } : scheduleDraftToInput(draft),
      });
      toast.success(useDefault ? 'Using the default payout schedule' : 'Payout schedule saved for this vendor');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="space-y-4 pt-2">
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={useDefault} onChange={(e) => setUseDefault(e.target.checked)} />
        Use the default payout schedule
        {fallback ? <span className="text-gray-500">({fallback.frequencyLabel})</span> : null}
      </label>
      {!useDefault && draft ? <PayoutScheduleFields value={draft} onChange={setDraft} /> : null}
      <p className="text-xs text-gray-500">
        Changing the frequency regroups all policies into the new periods, and receipts recorded against the old
        periods will no longer match. Settle open periods before switching.
      </p>
      <div className="flex justify-end">
        <button type="button" className={primaryButtonClass} disabled={save.isPending} onClick={submit}>
          {save.isPending ? 'Saving…' : 'Save schedule'}
        </button>
      </div>
    </div>
  );
}
