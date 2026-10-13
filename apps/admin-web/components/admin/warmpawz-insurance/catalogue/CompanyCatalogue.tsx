'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { WarmpawzInsuranceShell } from '@/components/admin/warmpawz-insurance/shared/WarmpawzInsuranceShell';
import {
  CommissionTermsFields,
  emptyTermsDraft,
  termsDraftError,
  termsDraftToInput,
  type ScheduleDraft,
  type TermsDraft,
} from '@/components/admin/warmpawz-insurance/shared/insurance-forms';
import {
  errorMessage,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  todayIso,
} from '@/components/admin/warmpawz-insurance/shared/insurance-ui';
import { CompanyDialog } from '@/components/admin/warmpawz-insurance/companies/CompanyDialog';
import { ManageVendorLinkDialog } from '@/components/admin/warmpawz-insurance/companies/ManageVendorLinkDialog';
import { VendorLinkDialog } from '@/components/admin/warmpawz-insurance/companies/VendorLinkDialog';
import { PlanDialog } from './PlanDialog';
import {
  useAddVendorLinkTerms,
  useCompanyPlans,
  useInsuranceCompanies,
  usePlanReadiness,
  usePublishCompanyPlan,
  useSetVendorLinkSchedule,
  useVendorLinks,
} from '@/hooks/warmpawz-insurance/useInsuranceAdmin';
import { canManageInsuranceCompanies } from '@/lib/admin-permissions';
import {
  PAYOUT_FREQUENCY_OPTIONS,
  type InsuranceCompany,
  type InsurancePlan,
  type PayoutFrequency,
  type VendorLink,
} from '@/lib/warmpawz-insurance-admin';

function ReadinessBadge({ ready, blockers }: { ready: boolean; blockers: string[] }) {
  return (
    <span
      title={blockers.join('\n')}
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
        ready ? 'border-green-200 bg-green-50 text-green-700' : 'border-amber-200 bg-amber-50 text-amber-800'
      }`}
    >
      {ready ? 'Ready' : blockers[0] || 'Not ready'}
    </span>
  );
}

function VendorConfigRow({ link, canWrite }: { link: VendorLink; canWrite: boolean }) {
  const saveTerms = useAddVendorLinkTerms();
  const saveSchedule = useSetVendorLinkSchedule();
  const [terms, setTerms] = useState<TermsDraft>(() =>
    emptyTermsDraft(link.currentTerms?.effectiveFrom || todayIso()),
  );
  const [schedule, setSchedule] = useState<ScheduleDraft>({
    frequency: link.scheduleOverride?.frequency || 'monthly',
    anchorDate: link.scheduleOverride?.anchorDate || '2026-01-01',
    dueDaysAfterPeriodEnd: String(link.scheduleOverride?.dueDaysAfterPeriodEnd ?? 7),
    graceDays: String(link.scheduleOverride?.graceDays ?? 3),
    reminderDaysBefore: (link.scheduleOverride?.reminderDaysBefore ?? [3, 1]).join(', '),
  });

  useEffect(() => {
    const current = link.currentTerms;
    setTerms(
      current
        ? {
            basis: current.basis,
            rate: String(current.rate),
            vendorCommissionRate: current.vendorCommissionRate == null ? '' : String(current.vendorCommissionRate),
            gstRate: String(current.gstRate),
            effectiveFrom: current.effectiveFrom,
            notes: current.notes ?? '',
          }
        : emptyTermsDraft(todayIso()),
    );
  }, [link]);

  const save = async () => {
    const termsError = termsDraftError(terms);
    if (termsError) return toast.error(termsError);
    const reminderDaysBefore = schedule.reminderDaysBefore
      .split(',')
      .map((n) => Number(n.trim()))
      .filter((n) => Number.isFinite(n));
    try {
      await saveTerms.mutateAsync({ id: link.id, input: termsDraftToInput(terms) });
      await saveSchedule.mutateAsync({
        id: link.id,
        input: {
          frequency: schedule.frequency,
          anchorDate: schedule.anchorDate,
          dueDaysAfterPeriodEnd: Number(schedule.dueDaysAfterPeriodEnd) || 0,
          graceDays: Number(schedule.graceDays) || 0,
          reminderDaysBefore,
        },
      });
      toast.success(`Saved ${link.vendorName}`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="space-y-3 border-t border-gray-100 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-medium text-gray-900">{link.vendorName}</div>
          <div className="text-xs text-gray-500">{link.status}</div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm text-gray-700">
          Payout frequency
          <select
            className={`${inputClass} mt-1`}
            value={schedule.frequency}
            disabled={!canWrite}
            onChange={(e) => setSchedule({ ...schedule, frequency: e.target.value as PayoutFrequency })}
          >
            {PAYOUT_FREQUENCY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>
      <CommissionTermsFields value={terms} onChange={setTerms} />
      {canWrite ? (
        <button type="button" className={primaryButtonClass} onClick={save} disabled={saveTerms.isPending || saveSchedule.isPending}>
          Save vendor
        </button>
      ) : null}
    </div>
  );
}

function CompanyCard({
  company,
  links,
  canWrite,
  onEdit,
  onAssign,
  onHistory,
}: {
  company: InsuranceCompany;
  links: VendorLink[];
  canWrite: boolean;
  onEdit: () => void;
  onAssign: () => void;
  onHistory: (linkId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [planDialog, setPlanDialog] = useState<InsurancePlan | null | undefined>(undefined);
  const plans = useCompanyPlans(open ? company.id : null);
  const readiness = usePlanReadiness(open ? company.id : null);
  const publish = usePublishCompanyPlan();
  const companyLinks = links.filter((link) => link.companyId === company.id);

  const togglePublish = async (plan: InsurancePlan) => {
    try {
      await publish.mutateAsync({ planId: plan.id, publish: plan.status !== 'published' });
      toast.success(plan.status === 'published' ? 'Plan unpublished' : 'Plan published');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <article className="rounded-xl border border-gray-200 bg-white">
      <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" onClick={() => setOpen((v) => !v)}>
        <span className="flex items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span>
            <span className="block font-semibold text-gray-900">{company.name}</span>
            <span className="text-xs text-gray-500">{company.status} · {company.activeVendorCount} vendors</span>
          </span>
        </span>
        {readiness.data ? (
          <ReadinessBadge ready={readiness.data.publishable} blockers={readiness.data.blockers} />
        ) : null}
      </button>
      {open ? (
        <div className="space-y-4 border-t border-gray-100 px-4 py-4">
          <div className="flex flex-wrap gap-2">
            {canWrite ? <button type="button" className={secondaryButtonClass} onClick={onEdit}>Edit company</button> : null}
            {canWrite ? <button type="button" className={secondaryButtonClass} onClick={onAssign}>Assign vendor</button> : null}
          </div>
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Plans</h3>
              {canWrite ? (
                <button type="button" className={primaryButtonClass} onClick={() => setPlanDialog(null)}>
                  <Plus className="h-4 w-4" /> Add plan
                </button>
              ) : null}
            </div>
            {plans.isLoading ? <p className="text-sm text-gray-500">Loading plans…</p> : null}
            <ul className="divide-y divide-gray-100">
              {(plans.data ?? []).map((plan) => (
                <li key={plan.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div>
                    <div className="font-medium text-gray-900">{plan.name}</div>
                    <div className="text-xs text-gray-500">
                      {plan.productType} · from ₹{plan.premiumFrom} / {plan.premiumUnit} · {plan.status}
                      {plan.highlights.length ? ` · ${plan.highlights.join(' · ')}` : ''}
                    </div>
                  </div>
                  {canWrite ? (
                    <div className="flex gap-2">
                      <button type="button" className={secondaryButtonClass} onClick={() => setPlanDialog(plan)}>Edit</button>
                      <button type="button" className={secondaryButtonClass} onClick={() => togglePublish(plan)}>
                        {plan.status === 'published' ? 'Unpublish' : 'Publish'}
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Assigned vendors</h3>
            {companyLinks.length === 0 ? <p className="text-sm text-gray-500">No vendors assigned.</p> : null}
            {companyLinks.map((link) => {
              const vendorReady = readiness.data?.vendors.find((row) => row.linkId === link.id);
              return (
                <div key={link.id}>
                  <div className="mb-2 flex items-center justify-between">
                    {vendorReady ? <ReadinessBadge ready={vendorReady.ready} blockers={vendorReady.blockers} /> : <span />}
                    <button type="button" className="text-sm text-[#FF8C42]" onClick={() => onHistory(link.id)}>View history</button>
                  </div>
                  <VendorConfigRow link={link} canWrite={canWrite} />
                </div>
              );
            })}
          </section>
          {planDialog !== undefined ? (
            <PlanDialog open companyId={company.id} plan={planDialog} onClose={() => setPlanDialog(undefined)} />
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function CompanyCatalogue() {
  const companies = useInsuranceCompanies();
  const links = useVendorLinks();
  const [canWrite, setCanWrite] = useState(false);
  const [editing, setEditing] = useState<InsuranceCompany | null>(null);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [assignCompanyId, setAssignCompanyId] = useState<string | undefined>();
  const [assignOpen, setAssignOpen] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);

  useEffect(() => {
    setCanWrite(canManageInsuranceCompanies());
  }, []);

  const historyLink = useMemo(
    () => (links.data ?? []).find((link) => link.id === historyId) ?? null,
    [links.data, historyId],
  );

  return (
    <WarmpawzInsuranceShell
      title="Catalogue"
      subtitle="Insurance companies, their plans, and the vendors who can sell them"
      actions={
        canWrite ? (
          <button type="button" className={primaryButtonClass} onClick={() => { setEditing(null); setCompanyOpen(true); }}>
            <Plus className="h-4 w-4" /> Add company
          </button>
        ) : null
      }
    >
      {companies.isLoading ? <p className="text-sm text-gray-500">Loading companies…</p> : null}
      {companies.isError ? <p className="text-sm text-red-600">{errorMessage(companies.error)}</p> : null}
      <div className="space-y-3">
        {(companies.data ?? []).map((company) => (
          <CompanyCard
            key={company.id}
            company={company}
            links={links.data ?? []}
            canWrite={canWrite}
            onEdit={() => { setEditing(company); setCompanyOpen(true); }}
            onAssign={() => { setAssignCompanyId(company.id); setAssignOpen(true); }}
            onHistory={setHistoryId}
          />
        ))}
      </div>
      <CompanyDialog open={companyOpen} company={editing} onClose={() => setCompanyOpen(false)} />
      <VendorLinkDialog
        open={assignOpen}
        companies={companies.data ?? []}
        defaultCompanyId={assignCompanyId}
        onClose={() => setAssignOpen(false)}
      />
      <ManageVendorLinkDialog link={historyLink} onClose={() => setHistoryId(null)} />
    </WarmpawzInsuranceShell>
  );
}
