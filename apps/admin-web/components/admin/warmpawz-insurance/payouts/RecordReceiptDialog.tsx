'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@warmpawz/ui';
import {
  errorMessage,
  Field,
  formatDate,
  formatInr,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  todayIso,
} from '@/components/admin/warmpawz-insurance/shared/insurance-ui';
import { useRecordPayoutReceipt } from '@/hooks/warmpawz-insurance/useInsuranceAdmin';
import type { PayoutPeriod } from '@/lib/warmpawz-insurance-admin';

export function RecordReceiptDialog({ period, onClose }: { period: PayoutPeriod | null; onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [tdsAmount, setTdsAmount] = useState('0');
  const [reference, setReference] = useState('');
  const [receivedOn, setReceivedOn] = useState(todayIso());
  const [notes, setNotes] = useState('');
  const record = useRecordPayoutReceipt();

  useEffect(() => {
    if (!period) return;
    setAmount(String(period.received > 0 ? period.received : period.expected));
    setTdsAmount('0');
    setReference(period.receivedReference ?? '');
    setReceivedOn(todayIso());
    setNotes('');
  }, [period]);

  const submit = async () => {
    if (!period) return;
    const value = Number(amount);
    if (amount.trim() === '' || !Number.isFinite(value) || value < 0) return toast.error('Enter the amount received');
    try {
      await record.mutateAsync({
        vendorCompanyId: period.vendorCompanyId,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        amount: value,
        tdsAmount: Number(tdsAmount) || 0,
        reference: reference.trim() || null,
        receivedOn,
        notes: notes.trim() || null,
      });
      toast.success('Receipt recorded');
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Dialog open={Boolean(period)} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record payment received</DialogTitle>
        </DialogHeader>
        {period ? (
          <div className="space-y-4">
            <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-700">
              <div className="font-medium text-gray-900">
                {period.vendorName} · {period.companyName}
              </div>
              <div>
                {formatDate(period.periodStart)} – {formatDate(period.periodEnd)} · {period.policyCount} polic
                {period.policyCount === 1 ? 'y' : 'ies'}
              </div>
              <div>
                Expected {formatInr(period.expected, 2)}
                {period.hasEstimates ? ' (includes estimates)' : ''}
              </div>
            </div>
            <Field label="Total amount received (₹)" hint="Enter the total received for this period so far">
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputClass}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field label="TDS (₹)" hint="Window is paid when amount received plus TDS covers the expected total">
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputClass}
                value={tdsAmount}
                onChange={(e) => setTdsAmount(e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Received on">
                <input
                  type="date"
                  className={inputClass}
                  value={receivedOn}
                  max={todayIso()}
                  onChange={(e) => setReceivedOn(e.target.value)}
                />
              </Field>
              <Field label="Reference / UTR">
                <input className={inputClass} value={reference} onChange={(e) => setReference(e.target.value)} />
              </Field>
            </div>
            <Field label="Notes">
              <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
        ) : null}
        <DialogFooter>
          <button type="button" className={secondaryButtonClass} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={primaryButtonClass} disabled={record.isPending} onClick={submit}>
            {record.isPending ? 'Saving…' : 'Record receipt'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
