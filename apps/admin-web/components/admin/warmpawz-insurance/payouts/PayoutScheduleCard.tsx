'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';
import {
  PayoutScheduleFields,
  scheduleDraftError,
  scheduleDraftToInput,
  scheduleToDraft,
  type ScheduleDraft,
} from '@/components/admin/warmpawz-insurance/shared/insurance-forms';
import {
  errorMessage,
  formatDate,
  primaryButtonClass,
  secondaryButtonClass,
} from '@/components/admin/warmpawz-insurance/shared/insurance-ui';
import { useSaveDefaultPayoutSchedule } from '@/hooks/warmpawz-insurance/useInsuranceAdmin';
import type { PayoutSchedule } from '@/lib/warmpawz-insurance-admin';

export function PayoutScheduleCard({ schedule, canEdit }: { schedule: PayoutSchedule; canEdit: boolean }) {
  const [draft, setDraft] = useState<ScheduleDraft | null>(null);
  const save = useSaveDefaultPayoutSchedule();
  const usesAnchor = ['weekly', 'fortnightly', 'every_two_months'].includes(schedule.frequency);

  const submit = async () => {
    if (!draft) return;
    const error = scheduleDraftError(draft);
    if (error) return toast.error(error);
    try {
      await save.mutateAsync(scheduleDraftToInput(draft));
      toast.success('Default payout schedule saved');
      setDraft(null);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Default payout schedule</h2>
          <p className="mt-1 text-sm text-gray-600">
            How often insurance vendors pay Warmpawz its commission on policies they issue. Individual vendor links
            can override this under Companies & vendors.
          </p>
        </div>
        {canEdit && !draft ? (
          <button type="button" className={secondaryButtonClass} onClick={() => setDraft(scheduleToDraft(schedule))}>
            <Pencil className="h-4 w-4" /> Edit
          </button>
        ) : null}
      </div>
      {draft ? (
        <div className="mt-4 space-y-4">
          <PayoutScheduleFields value={draft} onChange={setDraft} />
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryButtonClass} onClick={() => setDraft(null)}>
              Cancel
            </button>
            <button type="button" className={primaryButtonClass} disabled={save.isPending} onClick={submit}>
              {save.isPending ? 'Saving…' : 'Save schedule'}
            </button>
          </div>
        </div>
      ) : (
        <dl className="mt-4 grid gap-4 sm:grid-cols-4">
          <Item label="Frequency" value={schedule.frequencyLabel} />
          <Item
            label="Payment due"
            value={`${schedule.dueDaysAfterPeriodEnd} day${schedule.dueDaysAfterPeriodEnd === 1 ? '' : 's'} after period ends`}
          />
          <Item label="Grace" value={`${schedule.graceDays} day${schedule.graceDays === 1 ? '' : 's'}, then overdue`} />
          <Item
            label="Reminders"
            value={
              schedule.reminderDaysBefore.length
                ? `${schedule.reminderDaysBefore.join(', ')} day(s) before due, daily once overdue`
                : 'Daily once overdue'
            }
          />
          {usesAnchor ? <Item label="Cycle starts" value={formatDate(schedule.anchorDate)} /> : null}
        </dl>
      )}
    </section>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{value}</dd>
    </div>
  );
}
