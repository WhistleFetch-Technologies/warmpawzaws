'use client';

import { useCallback, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@warmpawz/ui';
import { Scale, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDiscountPolicyDraft } from '@/lib/discount-policy/useDiscountPolicyDraft';
import { POLICY_CENTER_TABS, type PolicyCenterTabId } from '@/lib/discount-policy/option-registry';
import { ApiPendingBanner } from './shared/ApiPendingBanner';
import { PolicyStickySaveBar } from './shared/PolicyStickySaveBar';
import {
  PolicyCenterDomainView,
  type PolicyViewDomain,
} from './shared/PolicyCenterDomainView';
import { PriorityConfigSection } from './sections/PriorityConfigSection';
import { StackConfigSection } from './sections/StackConfigSection';
import { FundingConfigSection } from './sections/FundingConfigSection';
import { LimitsConfigSection } from './sections/LimitsConfigSection';
import { RuntimePolicySection } from './sections/RuntimePolicySection';
import { ValidationSection } from './sections/ValidationSection';
import { PublishWorkflowSection } from './sections/PublishWorkflowSection';
import { PolicyHistorySection } from './sections/PolicyHistorySection';
import { PolicySimulatorSection } from './sections/PolicySimulatorSection';
import { AuditViewerSection } from './sections/AuditViewerSection';

export function PolicyCenter({ embedded = false }: { embedded?: boolean }) {
  const [activeTab, setActiveTab] = useState<PolicyCenterTabId>('stack');
  const [viewDomain, setViewDomain] = useState<PolicyViewDomain>('services');
  const {
    draft,
    capabilities,
    loading,
    saving,
    isDirty,
    updateDraft,
    saveDraft,
    resetDraft,
    reload,
    exportConfiguration,
  } = useDiscountPolicyDraft();

  const handleChange = useCallback(
    (next: typeof draft) => {
      updateDraft(() => next);
    },
    [updateDraft]
  );

  const handleSave = useCallback(async () => {
    await saveDraft();
    toast.success(
      capabilities?.draftWrite
        ? 'Draft saved to server'
        : 'Draft saved locally (policy API pending Phase 8)'
    );
  }, [saveDraft, capabilities?.draftWrite]);

  const configTabs = useMemo(
    () => POLICY_CENTER_TABS.filter((t) => t.group === 'configuration'),
    []
  );
  const lifecycleTabs = useMemo(
    () => POLICY_CENTER_TABS.filter((t) => t.group === 'lifecycle'),
    []
  );
  const diagnosticTabs = useMemo(
    () => POLICY_CENTER_TABS.filter((t) => t.group === 'diagnostics'),
    []
  );

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
        Loading policy configuration…
      </div>
    );
  }

  return (
    <div className={embedded ? 'flex flex-col' : 'flex min-h-screen flex-col'}>
      {!embedded ? (
        <div className="border-b bg-white">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-4">
            <div className="rounded-lg bg-violet-100 p-2">
              <Scale className="h-6 w-6 text-violet-700" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Policy Center</h1>
              <p className="text-sm text-slate-500">
                Configure discount application, winning offer strategy, funding, and limits for Discount
                Engine V2.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className={`mx-auto w-full max-w-6xl flex-1 px-6 py-6 ${embedded ? 'pb-12' : 'pb-24'}`}>
        {!capabilities?.runtimeRead ? (
          <div className="mb-6">
            <ApiPendingBanner />
          </div>
        ) : !capabilities.draftWrite ? (
          <div
            className="mb-6 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
            role="status"
          >
            <p>
              <span className="font-medium">Runtime policy is live</span> from Discount Engine V2
              config. Draft publish to the server is not enabled yet — use Save to keep changes in
              this browser only.
            </p>
          </div>
        ) : null}

        <PolicyCenterDomainView value={viewDomain} onChange={setViewDomain} />

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PolicyCenterTabId)}>
          <TabsList className="mb-6 flex h-auto flex-wrap justify-start gap-1 bg-white p-1">
            {[...configTabs, ...lifecycleTabs, ...diagnosticTabs].map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="text-xs sm:text-sm">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="priority">
            <PriorityConfigSection draft={draft} onChange={handleChange} />
          </TabsContent>
          <TabsContent value="stack">
            <StackConfigSection draft={draft} onChange={handleChange} />
          </TabsContent>
          <TabsContent value="funding">
            <FundingConfigSection draft={draft} onChange={handleChange} />
          </TabsContent>
          <TabsContent value="limits">
            <LimitsConfigSection draft={draft} onChange={handleChange} />
          </TabsContent>
          <TabsContent value="runtime">
            <RuntimePolicySection draft={draft} />
          </TabsContent>
          <TabsContent value="validation">
            <ValidationSection draft={draft} />
          </TabsContent>
          <TabsContent value="publish">
            <PublishWorkflowSection draft={draft} onPublished={() => void reload()} />
          </TabsContent>
          <TabsContent value="history">
            <PolicyHistorySection />
          </TabsContent>
          <TabsContent value="simulator">
            <PolicySimulatorSection draft={draft} />
          </TabsContent>
          <TabsContent value="audit">
            <AuditViewerSection />
          </TabsContent>
        </Tabs>
      </div>

      <PolicyStickySaveBar
        isDirty={isDirty}
        saving={saving}
        onSave={() => void handleSave()}
        onReset={resetDraft}
        onExport={exportConfiguration}
      />
    </div>
  );
}
