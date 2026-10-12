'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@warmpawz/ui';
import {
  CommissionTermsFields,
  emptyTermsDraft,
  termsDraftError,
  termsDraftToInput,
  type TermsDraft,
} from '@/components/admin/warmpawz-insurance/shared/insurance-forms';
import {
  errorMessage,
  Field,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  todayIso,
} from '@/components/admin/warmpawz-insurance/shared/insurance-ui';
import {
  useCreateVendorLink,
  useInsuranceVendorCandidates,
} from '@/hooks/warmpawz-insurance/useInsuranceAdmin';
import type { InsuranceCompany } from '@/lib/warmpawz-insurance-admin';

export function VendorLinkDialog({
  open,
  companies,
  defaultCompanyId,
  onClose,
}: {
  open: boolean;
  companies: InsuranceCompany[];
  defaultCompanyId?: string;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [authorisationRef, setAuthorisationRef] = useState('');
  const [agencyCode, setAgencyCode] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [effectiveTo, setEffectiveTo] = useState('');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState<TermsDraft>(emptyTermsDraft(todayIso()));
  const create = useCreateVendorLink();
  const candidates = useInsuranceVendorCandidates(debounced, open);
  const activeCompanies = companies.filter((c) => c.status === 'active');

  useEffect(() => {
    if (!open) return;
    const today = todayIso();
    setSearch('');
    setDebounced('');
    setVendorId('');
    setCompanyId(defaultCompanyId ?? '');
    setAuthorisationRef('');
    setAgencyCode('');
    setEffectiveFrom(today);
    setEffectiveTo('');
    setNotes('');
    setTerms(emptyTermsDraft(today));
  }, [open, defaultCompanyId]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const submit = async () => {
    if (!vendorId) return toast.error('Choose an insurance vendor');
    if (!companyId) return toast.error('Choose a company');
    if (effectiveTo && effectiveTo < effectiveFrom) return toast.error('End date must be after the start date');
    const termsError = termsDraftError(terms);
    if (termsError) return toast.error(termsError);
    try {
      await create.mutateAsync({
        vendorId,
        companyId,
        authorisationRef: authorisationRef.trim() || null,
        agencyCode: agencyCode.trim() || null,
        effectiveFrom,
        effectiveTo: effectiveTo || null,
        notes: notes.trim() || null,
        terms: termsDraftToInput(terms),
      });
      toast.success('Vendor linked');
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Link an insurance vendor to a company</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Vendor and company</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Find insurance vendor" hint="Only vendors registered with the insurance role are listed">
                <input
                  className={inputClass}
                  placeholder="Business, owner, phone or email"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </Field>
              <Field label="Vendor *">
                <select className={inputClass} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                  <option value="">
                    {candidates.isLoading ? 'Loading…' : `Select vendor (${candidates.data?.length ?? 0} found)`}
                  </option>
                  {(candidates.data ?? []).map((v) => (
                    <option key={v.vendorId} value={v.vendorId}>
                      {v.name}
                      {v.phone ? ` · ${v.phone}` : ''}
                      {v.isActive ? '' : ' (inactive)'}
                      {v.linkedCompanyCount ? ` · ${v.linkedCompanyCount} linked` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Company *">
                <select className={inputClass} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                  <option value="">Select company</option>
                  {activeCompanies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Authorisation reference" hint="Agency / POSP / broker authorisation for this insurer">
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
                <Field label="Effective from *">
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
          </section>
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Warmpawz commission</h3>
            <p className="text-xs text-gray-500">
              What the vendor owes Warmpawz for each policy issued with this company. You can add new terms later;
              past policies keep the terms that applied when they were issued.
            </p>
            <CommissionTermsFields value={terms} onChange={setTerms} />
          </section>
        </div>
        <DialogFooter>
          <button type="button" className={secondaryButtonClass} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={primaryButtonClass} disabled={create.isPending} onClick={submit}>
            {create.isPending ? 'Linking…' : 'Link vendor'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
