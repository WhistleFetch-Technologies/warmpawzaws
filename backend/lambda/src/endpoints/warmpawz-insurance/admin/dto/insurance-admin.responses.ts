import type { InsuranceApplicationStatus, InsuranceStatusStage } from '../domain/application-status';
import type { CommissionBasis, CommissionEstimate } from '../domain/commission';
import type { PayoutFrequency, PayoutPeriodStatus } from '../domain/payout-periods';

export interface InsuranceCompanyDTO {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
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
  readonly paymentLinkDomains: string[];
  readonly activeVendorCount: number;
  readonly issuedPolicyCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface InsurancePlanDTO {
  readonly id: string;
  readonly companyId: string;
  readonly name: string;
  readonly productType: string;
  readonly highlights: string[];
  readonly premiumFrom: number;
  readonly premiumUnit: 'month' | 'year';
  readonly coverOptions: ReadonlyArray<{ key: string; label: string; description?: string }>;
  readonly sumInsuredOptions: string[];
  readonly copayOptions: string[];
  readonly status: 'draft' | 'published' | 'archived';
  readonly sortOrder: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PlanReadinessDTO {
  readonly companyId: string;
  readonly planId: string | null;
  readonly publishable: boolean;
  readonly blockers: string[];
  readonly readyVendorCount: number;
  readonly vendors: ReadonlyArray<{
    linkId: string;
    vendorId: string;
    vendorName: string;
    ready: boolean;
    blockers: string[];
  }>;
}

export interface CommissionTermsDTO {
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

export interface PayoutScheduleDTO {
  readonly frequency: PayoutFrequency;
  readonly frequencyLabel: string;
  readonly anchorDate: string;
  readonly dueDaysAfterPeriodEnd: number;
  readonly graceDays: number;
  readonly reminderDaysBefore: number[];
}

export interface VendorLinkDTO {
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
  readonly currentTerms: CommissionTermsDTO | null;
  readonly scheduleOverride: PayoutScheduleDTO | null;
  readonly createdAt: string;
}

export interface InsuranceVendorCandidateDTO {
  readonly vendorId: string;
  readonly name: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly status: string | null;
  readonly isActive: boolean;
  readonly isApproved: boolean;
  readonly linkedCompanyCount: number;
}

export interface OutreachRowDTO {
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
  /** No vendor update yet — status is derived from the consultation booking. */
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

export interface OutreachListDTO {
  readonly items: OutreachRowDTO[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export interface ApplicationEventDTO {
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

export interface InsuranceDashboardDTO {
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

export interface PayoutPolicyDTO {
  readonly applicationId: string;
  readonly customerName: string | null;
  readonly policyNumber: string;
  readonly premium: number;
  readonly vendorCommissionAmount: number | null;
  readonly issuedOn: string;
  readonly termsDescription: string | null;
  readonly estimate: CommissionEstimate;
}

export interface PayoutPeriodDTO {
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
  readonly policies: PayoutPolicyDTO[];
}

/** Settlement of the vendor's commission, derived from the payout period the policy falls in. */
export type ReconciliationStatus = 'pending' | 'overdue' | 'settled' | 'nothing_due' | 'cancelled';

export interface ReconciliationPolicyDTO {
  readonly applicationId: string;
  readonly policyNumber: string;
  /** IST date the policy was confirmed; decides its payout period. */
  readonly policyDate: string;
  /** When the vendor uploaded the policy. */
  readonly addedAt: string | null;
  readonly customer: { readonly name: string | null; readonly phone: string | null };
  readonly pet: { readonly name: string | null; readonly species: string | null } | null;
  readonly company: { readonly id: string; readonly name: string; readonly logoUrl: string | null };
  readonly vendor: { readonly id: string; readonly name: string };
  readonly premium: number;
  readonly commission: number;
  readonly gst: number;
  readonly total: number;
  readonly isEstimate: boolean;
  /** No commission terms could price this policy. */
  readonly unpriced: boolean;
  readonly status: ReconciliationStatus;
  readonly period: { readonly start: string; readonly end: string; readonly dueDate: string } | null;
}

export interface ReconciliationSummaryDTO {
  readonly completedPolicies: number;
  readonly cancelledPolicies: number;
  readonly totalPremium: number;
  readonly commission: number;
  readonly gst: number;
  /** Commission + GST owed by vendors for the range. */
  readonly commissionDue: number;
  /** Owed on policies whose payout period is not fully paid. */
  readonly outstanding: number;
  /** Owed on policies whose payout period is fully paid. */
  readonly received: number;
}

export interface ReconciliationDTO {
  readonly range: { readonly from: string; readonly to: string };
  readonly summary: ReconciliationSummaryDTO;
  readonly items: ReconciliationPolicyDTO[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export interface ReconciliationExportDTO {
  readonly filename: string;
  readonly csv: string;
  readonly rowCount: number;
}

export interface PolicyDocumentsDTO {
  readonly applicationId: string;
  readonly policyNumber: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly documents: ReadonlyArray<{ readonly name: string; readonly mime: string | null; readonly url: string | null }>;
}

export interface PayoutOverviewDTO {
  readonly today: string;
  readonly defaultSchedule: PayoutScheduleDTO;
  readonly summary: {
    readonly expectedOutstanding: number;
    readonly overdue: number;
    readonly dueNext7Days: number;
    readonly currentPeriodAccruing: number;
    readonly receivedLast30Days: number;
  };
  readonly periods: PayoutPeriodDTO[];
}
