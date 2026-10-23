'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { DynamicFormRenderer } from '@warmpawz/ui';
import type { FormSchema } from '@warmpawz/shared-types';
import { validateDynamicForm } from '@warmpawz/shared-types';
import { apiClient } from '@/lib/api-client';
import { resolveCustomerId } from '@/lib/insurance-customer';
import { registerLeaveGuard } from '@/lib/navigation/leave-guard';

export function InsuranceFormScreen({
  applicationId,
  onBack,
}: {
  applicationId: string;
  onBack: () => void;
}) {
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [prefilled, setPrefilled] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void resolveCustomerId().then((customerId) => {
      if (!customerId) {
        setMessage('Sign in again to open this form.');
        return;
      }
    apiClient
      .get<{ data?: { schema?: FormSchema; prefilled?: Record<string, string>; answers?: Record<string, unknown>; changeNotes?: Record<string, string> } }>(
        `/customer/insurance/applications/${applicationId}/form?customerId=${customerId}`,
      )
      .then((res) => {
        const data = res.data;
        setSchema(data?.schema || null);
        const answers = data?.answers || {};
        const filled = data?.prefilled || {};
        setValues({ ...filled, ...answers });
        setPrefilled(Object.fromEntries(Object.keys(filled).map((key) => [key, true])));
        setNotes(data?.changeNotes || {});
      })
      .catch(() => setMessage('This form is not ready yet.'));
    });
  }, [applicationId]);

  useEffect(() => {
    return registerLeaveGuard({
      id: 'insurance-form',
      canLeave: () => !dirty,
      confirmLeave: () => window.confirm('Leave this form? Unsaved answers will be lost.'),
    });
  }, [dirty]);

  async function submit() {
    if (!schema) return;
    const nextErrors = validateDynamicForm(schema, values);
    setErrors(nextErrors);
    if (!consent || Object.keys(nextErrors).length) return;
    const customerId = await resolveCustomerId();
    if (!customerId) {
      setMessage('Sign in again to submit this form.');
      return;
    }
    try {
      await apiClient.post(`/customer/insurance/applications/${applicationId}/form`, {
        customerId,
        consent: true,
        answers: values,
      });
      setDirty(false);
      setMessage('Submitted');
    } catch {
      setMessage('The form could not be submitted.');
    }
  }

  const submitted = message === 'Submitted';

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#FFF8F3]">
      <header className="bg-gradient-to-br from-[#FF8C42] to-[#FF7A2F] px-4 pb-5 text-white cw-header-safe-top">
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/15"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Insurance</p>
        <h1 className="text-xl font-bold">Information form</h1>
      </header>
      <div className="mx-auto w-full max-w-lg flex-1 space-y-3 px-4 py-4 pb-28">
        {message && !schema ? <p className="rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm text-gray-600">{message}</p> : null}
        {schema ? (
          <DynamicFormRenderer
            schema={schema}
            values={values}
            prefilled={prefilled}
            fieldNotes={notes}
            errors={errors}
            suppressUnverifiedHelp
            onChange={(key, value) => {
              setDirty(true);
              setValues((prev) => ({ ...prev, [key]: value }));
            }}
          />
        ) : null}
        {schema ? (
          <label className="flex items-start gap-3 rounded-2xl border border-orange-100 bg-white p-4 text-sm text-gray-800 shadow-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[#FF8C42]"
              checked={consent}
              onChange={(e) => { setConsent(e.target.checked); setDirty(true); }}
            />
            I confirm these details are correct
          </label>
        ) : null}
        {message && schema ? (
          <p className={`rounded-2xl px-4 py-3 text-sm ${submitted ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{message}</p>
        ) : null}
      </div>
      {schema && !submitted ? (
        <div className="sticky bottom-0 bg-[#FFF8F3] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
          <button
            type="button"
            className="mx-auto flex h-12 w-full max-w-lg items-center justify-center rounded-2xl bg-[#FF8C42] text-sm font-bold text-white disabled:bg-slate-300"
            disabled={!consent}
            onClick={() => void submit()}
          >
            Submit
          </button>
        </div>
      ) : null}
    </div>
  );
}
