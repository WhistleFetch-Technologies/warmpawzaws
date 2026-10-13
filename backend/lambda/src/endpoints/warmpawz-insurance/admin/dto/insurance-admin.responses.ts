import type { InsuranceApplicationStatus, InsuranceStatusStage } from '../domain/application-status';
import type { CommissionBasis, CommissionEstimate } from '../domain/commission';
import type { PayoutFrequency, PayoutPeriodStatus } from '../domain/payout-periods';

export interface InsuranceCompanyDTO {
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
