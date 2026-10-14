'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@warmpawz/ui';
import {
  errorMessage,
  Field,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '@/components/admin/warmpawz-insurance/shared/insurance-ui';
import { useSaveInsuranceCompany } from '@/hooks/warmpawz-insurance/useInsuranceAdmin';
import type { InsuranceCompany, InsuranceCompanyInput } from '@/lib/warmpawz-insurance-admin';

const EMPTY: InsuranceCompanyInput = {
  name: '',
  description: null,
  legalName: null,
  providerCode: null,
  logoUrl: null,
  contactName: null,
  contactEmail: null,
  contactPhone: null,
  escalationContact: null,
  products: [],
  integrationMode: 'manual',
  status: 'active',
  notes: null,
  paymentLinkDomains: [],
};

type TextKey = 'name' | 'description' | 'legalName' | 'providerCode' | 'logoUrl' | 'contactName' | 'contactEmail' | 'contactPhone' | 'escalationContact' | 'notes';

export function CompanyDialog({
  open,
  company,
  onClose,
}: {
  open: boolean;
  company: InsuranceCompany | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState<InsuranceCompanyInput>(EMPTY);
  const [products, setProducts] = useState('');
  const [domains, setDomains] = useState('');
  const save = useSaveInsuranceCompany();

  useEffect(() => {
    if (!open) return;
    const next: InsuranceCompanyInput = company
      ? {
          name: company.name,
          description: company.description,
          legalName: company.legalName,
          providerCode: company.providerCode,
          logoUrl: company.logoUrl,
          contactName: company.contactName,
          contactEmail: company.contactEmail,
          contactPhone: company.contactPhone,
          escalationContact: company.escalationContact,
          products: company.products,
          integrationMode: company.integrationMode,
          status: company.status,
          notes: company.notes,
          paymentLinkDomains: company.paymentLinkDomains ?? [],
        }
      : EMPTY;
    setForm(next);
    setProducts(next.products.join(', '));
    setDomains((company?.paymentLinkDomains ?? []).join(', '));
  }, [open, company]);

  const text = (key: TextKey) => ({
    value: form[key] ?? '',
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: key === 'name' ? e.target.value : e.target.value || null })),
  });

  const submit = async () => {
    if (form.name.trim().length < 2) {
      toast.error('Enter the company name');
      return;
    }
    const input: InsuranceCompanyInput = {
      ...form,
      name: form.name.trim(),
      products: products
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean),
      paymentLinkDomains: domains
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean),
    };
    try {
      await save.mutateAsync({ id: company?.id, input });
      toast.success(company ? 'Company updated' : 'Company added');
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{company ? `Manage ${company.name}` : 'Add insurance company'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Display name *">
            <input className={inputClass} {...text('name')} placeholder="e.g. HDFC ERGO" />
          </Field>
          <Field label="Short description" hint="Shown under the name, max 200 characters">
            <input
              className={inputClass}
              maxLength={200}
              {...text('description')}
              placeholder="e.g. Comprehensive pet insurance"
            />
          </Field>
          <Field label="Legal name">
            <input className={inputClass} {...text('legalName')} />
          </Field>
          <Field label="Provider code" hint="Short unique code, e.g. HDFC_ERGO">
            <input className={inputClass} {...text('providerCode')} />
          </Field>
          <Field label="Logo URL">
            <input className={inputClass} {...text('logoUrl')} />
          </Field>
          <Field label="Contact name">
            <input className={inputClass} {...text('contactName')} />
          </Field>
          <Field label="Contact email">
            <input type="email" className={inputClass} {...text('contactEmail')} />
          </Field>
          <Field label="Contact phone">
            <input className={inputClass} {...text('contactPhone')} />
          </Field>
          <Field label="Escalation contact">
            <input className={inputClass} {...text('escalationContact')} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Products offered" hint="Comma separated, e.g. Pet health, Accident cover">
              <input className={inputClass} value={products} onChange={(e) => setProducts(e.target.value)} />
            </Field>
          </div>
          <Field label="How policies are bought">
            <select
              className={inputClass}
              value={form.integrationMode}
              onChange={(e) =>
                setForm((f) => ({ ...f, integrationMode: e.target.value as InsuranceCompanyInput['integrationMode'] }))
              }
            >
              <option value="manual">Manual — vendor handles it offline</option>
              <option value="link">Payment / proposal link shared by vendor</option>
              <option value="api">Insurer API</option>
            </select>
          </Field>
          <Field label="Status">
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as InsuranceCompanyInput['status'] }))}
            >
              <option value="active">Active — offered to customers</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Payment link domains" hint="Comma-separated hosts allowed on insurer payment links">
              <input className={inputClass} value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="pay.example.com" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <textarea rows={3} className={inputClass} {...text('notes')} />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <button type="button" className={secondaryButtonClass} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={primaryButtonClass} disabled={save.isPending} onClick={submit}>
            {save.isPending ? 'Saving…' : 'Save company'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
