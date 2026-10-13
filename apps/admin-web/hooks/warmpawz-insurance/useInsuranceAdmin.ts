import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addVendorLinkTerms,
  createInsuranceCompany,
  createVendorLink,
  fetchApplicationEvents,
  fetchInsuranceCompanies,
  fetchInsuranceDashboard,
  fetchInsuranceOutreach,
  fetchInsuranceVendorCandidates,
  fetchPayoutOverview,
  fetchVendorLinks,
  fetchVendorLinkTerms,
  recordPayoutReceipt,
  saveDefaultPayoutSchedule,
  sendPayoutReminder,
  setVendorLinkSchedule,
  updateInsuranceCompany,
  updateCompanyPlan,
  publishCompanyPlan,
  unpublishCompanyPlan,
  createCompanyPlan,
  fetchCompanyPlans,
  fetchPlanReadiness,
  updateVendorLink,
  type CommissionTermsInput,
  type InsuranceCompanyInput,
  type InsurancePlanInput,
  type OutreachFilters,
  type PayoutScheduleInput,
  type VendorLinkUpdateInput,
} from '@/lib/warmpawz-insurance-admin';

export const winsQueryKeys = {
  all: ['warmpawz-insurance'] as const,
  dashboard: (from?: string, to?: string) => [...winsQueryKeys.all, 'dashboard', from ?? '', to ?? ''] as const,
  outreach: (filters: OutreachFilters) => [...winsQueryKeys.all, 'outreach', filters] as const,
  events: (applicationId: string) => [...winsQueryKeys.all, 'events', applicationId] as const,
  companies: () => [...winsQueryKeys.all, 'companies'] as const,
  vendorLinks: () => [...winsQueryKeys.all, 'vendor-links'] as const,
  linkTerms: (linkId: string) => [...winsQueryKeys.all, 'terms', linkId] as const,
  candidates: (search: string) => [...winsQueryKeys.all, 'candidates', search] as const,
  payouts: () => [...winsQueryKeys.all, 'payouts'] as const,
  plans: (companyId: string) => [...winsQueryKeys.all, 'plans', companyId] as const,
  readiness: (companyId: string) => [...winsQueryKeys.all, 'readiness', companyId] as const,
};

export function useInsuranceDashboard(from?: string, to?: string) {
  return useQuery({
    queryKey: winsQueryKeys.dashboard(from, to),
    queryFn: () => fetchInsuranceDashboard({ from, to }),
    staleTime: 15_000,
  });
}

export function useInsuranceOutreach(filters: OutreachFilters) {
  return useQuery({
    queryKey: winsQueryKeys.outreach(filters),
    queryFn: () => fetchInsuranceOutreach(filters),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });
}

export function useApplicationEvents(applicationId: string | null) {
  return useQuery({
    queryKey: winsQueryKeys.events(applicationId ?? ''),
    queryFn: () => fetchApplicationEvents(applicationId as string),
    enabled: Boolean(applicationId),
    staleTime: 30_000,
  });
}

export function useInsuranceCompanies() {
  return useQuery({ queryKey: winsQueryKeys.companies(), queryFn: fetchInsuranceCompanies, staleTime: 30_000 });
}

export function useVendorLinks() {
  return useQuery({ queryKey: winsQueryKeys.vendorLinks(), queryFn: () => fetchVendorLinks(), staleTime: 30_000 });
}

export function useVendorLinkTerms(linkId: string | null) {
  return useQuery({
    queryKey: winsQueryKeys.linkTerms(linkId ?? ''),
    queryFn: () => fetchVendorLinkTerms(linkId as string),
    enabled: Boolean(linkId),
  });
}

export function useInsuranceVendorCandidates(search: string, enabled: boolean) {
  return useQuery({
    queryKey: winsQueryKeys.candidates(search),
    queryFn: () => fetchInsuranceVendorCandidates(search || undefined),
    enabled,
    staleTime: 30_000,
  });
}

export function usePayoutOverview() {
  return useQuery({ queryKey: winsQueryKeys.payouts(), queryFn: fetchPayoutOverview, staleTime: 15_000 });
}

function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: winsQueryKeys.all });
}

export function useSaveInsuranceCompany() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: InsuranceCompanyInput }) =>
      id ? updateInsuranceCompany(id, input) : createInsuranceCompany(input),
    onSuccess: invalidate,
  });
}

export function useCreateVendorLink() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: createVendorLink, onSuccess: invalidate });
}

export function useUpdateVendorLink() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: VendorLinkUpdateInput }) => updateVendorLink(id, input),
    onSuccess: invalidate,
  });
}

export function useAddVendorLinkTerms() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CommissionTermsInput }) => addVendorLinkTerms(id, input),
    onSuccess: invalidate,
  });
}

export function useSetVendorLinkSchedule() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PayoutScheduleInput | { useDefault: true } }) =>
      setVendorLinkSchedule(id, input),
    onSuccess: invalidate,
  });
}

export function useSaveDefaultPayoutSchedule() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: saveDefaultPayoutSchedule, onSuccess: invalidate });
}

export function useSendPayoutReminder() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: sendPayoutReminder, onSuccess: invalidate });
}

export function useRecordPayoutReceipt() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: recordPayoutReceipt, onSuccess: invalidate });
}

export function useCompanyPlans(companyId: string | null) {
  return useQuery({
    queryKey: winsQueryKeys.plans(companyId ?? ''),
    queryFn: () => fetchCompanyPlans(companyId as string),
    enabled: Boolean(companyId),
  });
}

export function usePlanReadiness(companyId: string | null) {
  return useQuery({
    queryKey: winsQueryKeys.readiness(companyId ?? ''),
    queryFn: () => fetchPlanReadiness(companyId as string),
    enabled: Boolean(companyId),
  });
}

export function useSaveCompanyPlan() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ companyId, planId, input }: { companyId: string; planId?: string; input: InsurancePlanInput }) =>
      planId ? updateCompanyPlan(companyId, planId, input) : createCompanyPlan(companyId, input),
    onSuccess: invalidate,
  });
}

export function usePublishCompanyPlan() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ planId, publish }: { planId: string; publish: boolean }) =>
      publish ? publishCompanyPlan(planId) : unpublishCompanyPlan(planId),
    onSuccess: invalidate,
  });
}
