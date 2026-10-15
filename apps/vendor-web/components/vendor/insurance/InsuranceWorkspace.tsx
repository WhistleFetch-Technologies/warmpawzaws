'use client';

import { useEffect, useState } from 'react';
import type { FormSchema } from '@warmpawz/shared-types';
import { apiClient } from '@/lib/api-client';
import { InsuranceChatWorkspace } from './InsuranceChatWorkspace';
import { InsuranceFormLibrary } from './InsuranceFormLibrary';
import { InsuranceKanban } from './InsuranceKanban';
import type { BoardApplication } from './kanban-view';

const TABS = ['Kanban', 'Chat', 'Form Library'] as const;
export type InsuranceWorkspaceTab = (typeof TABS)[number];
type Tab = InsuranceWorkspaceTab;

type PlanRow = {
  id?: string;
  name?: string;
  companyId?: string;
  companyName?: string;
  premiumFrom?: number;
  premiumUnit?: string;
  coverOptions?: Array<{ key: string; label: string }>;
  sumInsuredOptions?: string[];
};

type FormRow = {
  id?: string;
  name?: string;
  status?: string;
  company_id?: string;
  plan_id?: string | null;
  draft_schema?: FormSchema;
  published_version?: number | string | null;
};

export function InsuranceWorkspace({
  vendorId,
  vendorPhone,
  vendorName,
  panel,
}: {
  vendorId: string;
  vendorPhone?: string;
  vendorName?: string;
  /** When set, the shell sidebar chooses the screen and this header is hidden. */
  panel?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(panel ?? 'Kanban');
  const [applications, setApplications] = useState<BoardApplication[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [forms, setForms] = useState<FormRow[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [vendorCompanyId, setVendorCompanyId] = useState('');

  async function reload() {
    const [formRes, appRes, workspace] = await Promise.all([
      apiClient.get<{ data?: { forms?: FormRow[] } }>(`/vendor/${vendorId}/insurance/forms`).catch(() => ({ data: { forms: [] } })),
      apiClient.get<{ data?: { applications?: BoardApplication[] } }>(`/vendor/${vendorId}/insurance/applications`).catch(() => ({ data: { applications: [] } })),
      apiClient.get<{ data?: { plans?: PlanRow[]; links?: Array<{ id?: string; companyId?: string; companyName?: string }> } }>(`/vendor/${vendorId}/insurance/workspace`).catch(() => ({ data: { plans: [], links: [] } })),
    ]);
    setForms(formRes.data?.forms || []);
    setApplications(appRes.data?.applications || []);
    const links = workspace.data?.links || [];
    const companyNames = new Map(links.map((link) => [link.companyId, link.companyName]));
    setPlans((workspace.data?.plans || []).map((plan) => ({ ...plan, companyName: plan.companyName || companyNames.get(plan.companyId) })));
    if (links[0]?.companyId) setCompanyId(String(links[0].companyId));
    if (links[0]?.id) setVendorCompanyId(String(links[0].id));
  }

  useEffect(() => {
    if (panel) setTab(panel);
  }, [panel]);

  useEffect(() => {
    void reload();
  }, [vendorId]);

  const companies = [...new Set(applications.map((row) => row.company_name).filter(Boolean))] as string[];

  return (
    <div className={panel ? 'min-h-0 bg-[#FFF8F3]' : 'min-h-screen bg-[#FFF8F3]'}>
      {panel ? null : (
      <header className="border-b border-orange-100 bg-white px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#FF8C42]">Insurance Vendor Portal</p>
        <nav className="mt-2 flex gap-2">
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${tab === item ? 'bg-[#FF8C42] text-white' : 'bg-orange-50 text-gray-600'}`}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
        </nav>
      </header>
      )}
      <main className="mx-auto max-w-7xl px-4 py-5">
        {tab === 'Kanban' ? (
          <InsuranceKanban
            vendorId={vendorId}
            applications={applications}
            companies={companies}
            vendorCompanyId={vendorCompanyId}
            onChanged={() => void reload()}
          />
        ) : null}
        {tab === 'Chat' ? (
          <InsuranceChatWorkspace
            vendorId={vendorId}
            vendorPhone={vendorPhone}
            vendorName={vendorName}
            applications={applications}
            plans={plans}
            forms={forms}
            onSent={() => void reload()}
          />
        ) : null}
        {tab === 'Form Library' ? (
          <InsuranceFormLibrary
            vendorId={vendorId}
            forms={forms}
            companyId={companyId}
            plans={plans}
            onChanged={() => void reload()}
          />
        ) : null}
      </main>
    </div>
  );
}
