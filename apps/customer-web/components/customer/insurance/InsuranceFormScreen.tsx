'use client';

import { useEffect, useState } from 'react';
import { DynamicFormRenderer } from '@warmpawz/ui';
import type { FormSchema } from '@warmpawz/shared-types';
import { validateDynamicForm } from '@warmpawz/shared-types';
import { apiClient } from '@/lib/api-client';
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
    const customerId = window.localStorage.getItem('customerId') || '';
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
    const customerId = window.localStorage.getItem('customerId') || '';
    await apiClient.post(`/customer/insurance/applications/${applicationId}/form`, {
      customerId,
      consent: true,
      answers: values,
    });
    setDirty(false);
    setMessage('Submitted');
  }

  return (
    <div className="min-h-screen bg-white px-4 py-4">
      <button type="button" className="text-sm font-semibold" onClick={onBack}>Back</button>
      <h1 className="mt-2 text-xl font-bold">Insurance form</h1>
      {schema ? (
        <DynamicFormRenderer
          schema={schema}
          values={values}
          prefilled={prefilled}
          fieldNotes={notes}
          errors={errors}
          onChange={(key, value) => {
            setDirty(true);
            setValues((prev) => ({ ...prev, [key]: value }));
          }}
        />
      ) : null}
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setDirty(true); }} />
        I confirm these details are correct
      </label>
      <button type="button" className="mt-4 w-full rounded-xl bg-[#FF8C42] py-3 font-bold text-white" onClick={() => void submit()}>
        Submit
      </button>
      {message ? <p className="mt-3 text-sm">{message}</p> : null}
    </div>
  );
}
