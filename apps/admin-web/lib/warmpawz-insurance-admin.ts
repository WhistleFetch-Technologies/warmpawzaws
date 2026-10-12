import { apiClient } from '@/lib/api-client';

export const WINS_API_BASE = '/admin/warmpawz-insurance';

export type InsuranceApplicationStatus =
  | 'consultation_booked'
  | 'form_required'
  | 'form_submitted'
  | 'vendor_processing'
  | 'vendor_review'
  | 'payment_link_shared'
  | 'awaiting_payment'
  | 'payment_reported'
  | 'documents_uploaded'
  | 'policy_issued'
  | 'cancelled';

export type InsuranceStatusStage = 'new' | 'in_progress' | 'awaiting_external' | 'completed' | 'cancelled';

export const INSURANCE_STATUS_OPTIONS: ReadonlyArray<{ value: InsuranceApplicationStatus; label: string }> = [
  { value: 'consultation_booked', label: 'Consultation booked' },
  { value: 'form_required', label: 'Information needed' },
  { value: 'form_submitted', label: 'Information submitted' },
  { value: 'vendor_processing', label: 'Policy being prepared' },
  { value: 'vendor_review', label: 'Under review' },
  { value: 'payment_link_shared', label: 'Payment required' },
  { value: 'awaiting_payment', label: 'Awaiting payment' },
  { value: 'payment_reported', label: 'Payment update received' },
  { value: 'documents_uploaded', label: 'Documents received' },
  { value: 'policy_issued', label: 'Policy issued' },
  { value: 'cancelled', label: 'Cancelled' },
];

export type CommissionBasis = 'percent_of_premium' | 'percent_of_vendor_commission' | 'fixed_per_policy';
export type PayoutFrequency = 'weekly' | 'fortnightly' | 'twice_monthly' | 'monthly' | 'every_two_months';
export type PayoutPeriodStatus = 'open' | 'due' | 'grace' | 'overdue' | 'paid' | 'nothing_due';

export const COMMISSION_BASIS_OPTIONS: ReadonlyArray<{ value: CommissionBasis; label: string }> = [
  { value: 'percent_of_premium', label: '% of premium' },
  { value: 'percent_of_vendor_commission', label: "% of vendor's insurer commission" },
  { value: 'fixed_per_policy', label: 'Fixed ₹ per policy' },
];

export const PAYOUT_FREQUENCY_OPTIONS: ReadonlyArray<{ value: PayoutFrequency; label: string }> = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly (every 14 days)' },
  { value: 'twice_monthly', label: 'Twice monthly (1st–15th, 16th–month end)' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'every_two_months', label: 'Every two months' },
];

export interface InsuranceCompany {
  readonly id: string;
  readonly name: string;
  readonly legalName: string | null;
  readonly providerCode: string | null;
  readonly logoUrl: string | null;
  readonly contactName: string | null;
  readonly contactEmail: string | null;
  readonly contactPhone: string | null;
  readonly escalationContact: string | null;
  readonly products: string[];
  readonly integrationMode: 'manual' | 'link' | 'api';
  readonly status: 'active' | 'inactive';
  readonly notes: string | null;
  readonly activeVendorCount: number;
  readonly issuedPolicyCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type InsuranceCompanyInput = Omit<
  InsuranceCompany,
  'id' | 'activeVendorCount' | 'issuedPolicyCount' | 'createdAt' | 'updatedAt'
>;

export interface CommissionTerms {
  readonly id: string;
  readonly basis: CommissionBasis;
  readonly rate: number;
  readonly vendorCommissionRate: number | null;
  readonly gstRate: number;
  readonly effectiveFrom: string;
  readonly notes: string | null;
  readonly description: string;
  readonly createdAt: string;
}

export interface CommissionTermsInput {
  readonly basis: CommissionBasis;
  readonly rate: number;
  readonly vendorCommissionRate: number | null;
  readonly gstRate: number;
  readonly effectiveFrom: string;
  readonly notes: string | null;
}

export interface PayoutSchedule {
  readonly frequency: PayoutFrequency;
  readonly frequencyLabel: string;
  readonly anchorDate: string;
  readonly dueDaysAfterPeriodEnd: number;
  readonly graceDays: number;
  readonly reminderDaysBefore: number[];
}

export type PayoutScheduleInput = Omit<PayoutSchedule, 'frequencyLabel'>;

export interface VendorLink {
  readonly id: string;
  readonly vendorId: string;
  readonly vendorName: string;
  readonly vendorPhone: string | null;
  readonly vendorStatus: string | null;
  readonly companyId: string;
  readonly companyName: string;
  readonly authorisationRef: string | null;
  readonly agencyCode: string | null;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly status: 'active' | 'suspended' | 'ended';
  readonly notes: string | null;
  readonly currentTerms: CommissionTerms | null;
  readonly scheduleOverride: PayoutSchedule | null;
  readonly createdAt: string;
}

export interface VendorLinkCreateInput {
  readonly vendorId: string;
  readonly companyId: string;
  readonly authorisationRef: string | null;
  readonly agencyCode: string | null;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly notes: string | null;
  readonly terms: CommissionTermsInput;
}

export interface VendorLinkUpdateInput {
  readonly authorisationRef?: string | null;
  readonly agencyCode?: string | null;
  readonly effectiveFrom?: string;
  readonly effectiveTo?: string | null;
  readonly status?: VendorLink['status'];
  readonly notes?: string | null;
}

export interface InsuranceVendorCandidate {
  readonly vendorId: string;
  readonly name: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly status: string | null;
  readonly isActive: boolean;
  readonly linkedCompanyCount: number;
}

export interface OutreachRow {
  readonly rowId: string;
  readonly applicationId: string | null;
  readonly bookingId: string | null;
  readonly customer: { readonly id: string; readonly name: string | null; readonly phone: string | null };
  readonly vendor: { readonly id: string; readonly name: string };
  readonly pet: { readonly id: string; readonly name: string | null; readonly species: string | null } | null;
  readonly company: { readonly id: string; readonly name: string } | null;
  readonly status: InsuranceApplicationStatus;
  readonly statusLabel: string;
  readonly stage: InsuranceStatusStage;
  readonly statusDerived: boolean;
  readonly booking: {
    readonly date: string | null;
    readonly time: string | null;
    readonly status: string | null;
    readonly paymentStatus: string | null;
    readonly fee: number;
  } | null;
  readonly policy: {
    readonly number: string | null;
    readonly premium: number | null;
    readonly issuedAt: string | null;
    readonly documentUrl: string | null;
  };
  readonly reachedOutAt: string;
  readonly lastActivityAt: string;
}

export interface OutreachList {
  readonly items: OutreachRow[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export interface OutreachFilters {
  readonly page: number;
  readonly pageSize: number;
  readonly status?: InsuranceApplicationStatus;
  readonly vendorId?: string;
  readonly companyId?: string;
  readonly search?: string;
  readonly from?: string;
  readonly to?: string;
}

export interface ApplicationEvent {
  readonly id: string;
  readonly fromStatus: string | null;
  readonly fromLabel: string | null;
  readonly toStatus: string;
  readonly toLabel: string;
  readonly actorType: string;
  readonly actorId: string | null;
  readonly note: string | null;
  readonly createdAt: string;
}

export interface InsuranceDashboard {
  readonly range: { readonly from: string | null; readonly to: string | null };
  readonly outreach: number;
  readonly upcomingConsultations: number;
  readonly inProgress: number;
  readonly awaitingExternal: number;
  readonly policiesIssued: number;
  readonly premiumIssued: number;
  readonly cancelled: number;
  readonly activeCompanies: number;
  readonly activeVendorLinks: number;
  readonly generatedAt: string;
}

export interface CommissionEstimate {
  readonly base: number;
  readonly commission: number;
  readonly gst: number;
  readonly total: number;
  readonly isEstimate: boolean;
  readonly missingBase: boolean;
}

export interface PayoutPolicy {
  readonly applicationId: string;
  readonly customerName: string | null;
  readonly policyNumber: string;
  readonly premium: number;
  readonly vendorCommissionAmount: number | null;
  readonly issuedOn: string;
  readonly termsDescription: string | null;
  readonly estimate: CommissionEstimate;
}

export interface PayoutPeriod {
  readonly vendorCompanyId: string;
  readonly vendorId: string;
  readonly vendorName: string;
  readonly companyName: string;
  readonly frequency: PayoutFrequency;
  readonly scheduleSource: 'default' | 'override';
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly dueDate: string;
  readonly graceEndsOn: string;
  readonly isCurrent: boolean;
  readonly status: PayoutPeriodStatus;
  readonly policyCount: number;
  readonly premiumTotal: number;
  readonly commission: number;
  readonly gst: number;
  readonly expected: number;
  readonly received: number;
  readonly outstanding: number;
  readonly hasEstimates: boolean;
  readonly unpricedPolicies: number;
  readonly reminderCount: number;
  readonly lastRemindedAt: string | null;
  readonly reminderDueToday: boolean;
  readonly receivedReference: string | null;
  readonly policies: PayoutPolicy[];
}

export interface PayoutOverview {
  readonly today: string;
  readonly defaultSchedule: PayoutSchedule;
  readonly summary: {
    readonly expectedOutstanding: number;
    readonly overdue: number;
    readonly dueNext7Days: number;
    readonly currentPeriodAccruing: number;
    readonly receivedLast30Days: number;
  };
  readonly periods: PayoutPeriod[];
}

export interface PayoutPeriodRef {
  readonly vendorCompanyId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
}

export interface PayoutReceiptInput extends PayoutPeriodRef {
  readonly amount: number;
  readonly reference: string | null;
  readonly receivedOn?: string;
  readonly notes: string | null;
}

type SuccessEnvelope<T> = { success: true; data: T };
type ErrorEnvelope = { success: false; error: { message?: string; details?: unknown } };
type Envelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

function assertSuccess<T>(response: Envelope<T> | T): T {
  if (response && typeof response === 'object' && 'success' in response) {
    if (response.success === true && 'data' in response) return response.data;
    if (response.success === false && 'error' in response) {
      throw new Error(response.error.message || 'Request failed');
    }
  }
  return response as T;
}

function queryString(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

const get = async <T>(path: string) => assertSuccess(await apiClient.get<Envelope<T>>(`${WINS_API_BASE}${path}`));
const post = async <T>(path: string, body: unknown) =>
  assertSuccess(await apiClient.post<Envelope<T>>(`${WINS_API_BASE}${path}`, body));
const put = async <T>(path: string, body: unknown) =>
  assertSuccess(await apiClient.put<Envelope<T>>(`${WINS_API_BASE}${path}`, body));

export const fetchInsuranceDashboard = (range: { from?: string; to?: string } = {}) =>
  get<InsuranceDashboard>(`/dashboard${queryString(range)}`);

export const fetchInsuranceOutreach = (filters: OutreachFilters) =>
  get<OutreachList>(`/outreach${queryString({ ...filters })}`);

export const fetchApplicationEvents = (applicationId: string) =>
  get<ApplicationEvent[]>(`/applications/${applicationId}/events`);

export const fetchInsuranceCompanies = () => get<InsuranceCompany[]>('/companies');
export const createInsuranceCompany = (input: InsuranceCompanyInput) =>
  post<InsuranceCompany>('/companies', input);
export const updateInsuranceCompany = (id: string, input: InsuranceCompanyInput) =>
  put<InsuranceCompany>(`/companies/${id}`, input);

export const fetchInsuranceVendorCandidates = (search?: string) =>
  get<InsuranceVendorCandidate[]>(`/vendor-candidates${queryString({ search })}`);

export const fetchVendorLinks = (filter: { companyId?: string; vendorId?: string } = {}) =>
  get<VendorLink[]>(`/vendor-links${queryString(filter)}`);
export const createVendorLink = (input: VendorLinkCreateInput) => post<VendorLink>('/vendor-links', input);
export const updateVendorLink = (id: string, input: VendorLinkUpdateInput) =>
  put<VendorLink>(`/vendor-links/${id}`, input);
export const fetchVendorLinkTerms = (id: string) => get<CommissionTerms[]>(`/vendor-links/${id}/terms`);
export const addVendorLinkTerms = (id: string, input: CommissionTermsInput) =>
  post<CommissionTerms[]>(`/vendor-links/${id}/terms`, input);
export const setVendorLinkSchedule = (id: string, input: PayoutScheduleInput | { useDefault: true }) =>
  put<VendorLink>(`/vendor-links/${id}/payout-schedule`, input);

export const fetchDefaultPayoutSchedule = () => get<PayoutSchedule>('/payout-schedule');
export const saveDefaultPayoutSchedule = (input: PayoutScheduleInput) =>
  put<PayoutSchedule>('/payout-schedule', input);

export const fetchPayoutOverview = () => get<PayoutOverview>('/payouts');
export const sendPayoutReminder = (ref: PayoutPeriodRef) => post<PayoutPeriod>('/payouts/remind', ref);
export const recordPayoutReceipt = (input: PayoutReceiptInput) => post<PayoutOverview>('/payouts/receipt', input);
