/** Single status list for admin, vendor, and customer insurance applications. */

export const INSURANCE_APPLICATION_STATUSES = [
  'consultation_booked',
  'consulted',
  'quote_shared',
  'form_sent',
  'form_submitted',
  'changes_requested',
  'form_confirmed',
  'payment_link_sent',
  'payment_link_expired',
  'payment_reported',
  'policy_uploaded',
  'policy_confirmed',
  'free_look_cancelled',
  'dropped',
  'cancelled',
] as const;

export type InsuranceApplicationStatus = (typeof INSURANCE_APPLICATION_STATUSES)[number];

/** Columns on the vendor Kanban. */
export type InsuranceKanbanColumn = 'new' | 'in_progress' | 'awaiting_payment' | 'policy_issued' | 'closed';

/** Stage names already used by the admin dashboard pills. */
export type InsuranceStatusStage = 'new' | 'in_progress' | 'awaiting_external' | 'completed' | 'cancelled';

export const INSURANCE_STATUS_LABELS: Readonly<Record<InsuranceApplicationStatus, string>> = {
  consultation_booked: 'Consultation booked',
  consulted: 'Consultation done',
  quote_shared: 'Plan shared',
  form_sent: 'Information needed',
  form_submitted: 'Information submitted',
  changes_requested: 'Corrections needed',
  form_confirmed: 'Details confirmed',
  payment_link_sent: 'Payment required',
  payment_link_expired: 'Payment link expired',
  payment_reported: 'Payment received',
  policy_uploaded: 'Review your policy',
  policy_confirmed: 'Policy active',
  free_look_cancelled: 'Policy cancelled',
  dropped: 'Closed',
  cancelled: 'Cancelled',
};

export const INSURANCE_KANBAN_COLUMN: Readonly<Record<InsuranceApplicationStatus, InsuranceKanbanColumn>> = {
  consultation_booked: 'new',
  consulted: 'new',
  quote_shared: 'in_progress',
  form_sent: 'in_progress',
  form_submitted: 'in_progress',
  changes_requested: 'in_progress',
  form_confirmed: 'in_progress',
  payment_link_sent: 'awaiting_payment',
  payment_link_expired: 'awaiting_payment',
  payment_reported: 'awaiting_payment',
  policy_uploaded: 'policy_issued',
  policy_confirmed: 'policy_issued',
  free_look_cancelled: 'closed',
  dropped: 'closed',
  cancelled: 'closed',
};

const STAGE_BY_COLUMN: Readonly<Record<InsuranceKanbanColumn, InsuranceStatusStage>> = {
  new: 'new',
  in_progress: 'in_progress',
  awaiting_payment: 'awaiting_external',
  policy_issued: 'completed',
  closed: 'cancelled',
};

export const INSURANCE_STATUS_STAGE: Readonly<Record<InsuranceApplicationStatus, InsuranceStatusStage>> =
  Object.fromEntries(
    INSURANCE_APPLICATION_STATUSES.map((status) => [status, STAGE_BY_COLUMN[INSURANCE_KANBAN_COLUMN[status]]]),
  ) as Record<InsuranceApplicationStatus, InsuranceStatusStage>;

export const INSURANCE_STATUS_TRANSITIONS: Readonly<
  Record<InsuranceApplicationStatus, readonly InsuranceApplicationStatus[]>
> = {
  consultation_booked: ['consulted', 'cancelled'],
  consulted: ['quote_shared', 'dropped'],
  quote_shared: ['quote_shared', 'form_sent', 'dropped'],
  form_sent: ['form_submitted', 'dropped'],
  form_submitted: ['changes_requested', 'form_confirmed'],
  changes_requested: ['form_submitted', 'dropped'],
  form_confirmed: ['payment_link_sent'],
  payment_link_sent: ['payment_reported', 'payment_link_expired', 'payment_link_sent'],
  payment_link_expired: ['payment_link_sent', 'dropped'],
  payment_reported: ['policy_uploaded'],
  policy_uploaded: ['policy_confirmed', 'policy_uploaded'],
  policy_confirmed: ['free_look_cancelled'],
  free_look_cancelled: [],
  dropped: [],
  cancelled: [],
};

/** Keys written by the first admin module, before the status list was replaced. */
export const LEGACY_INSURANCE_STATUS_MAP: Readonly<Record<string, InsuranceApplicationStatus>> = {
  form_required: 'form_sent',
  vendor_processing: 'form_confirmed',
  vendor_review: 'form_confirmed',
  payment_link_shared: 'payment_link_sent',
  awaiting_payment: 'payment_link_sent',
  documents_uploaded: 'policy_uploaded',
  policy_issued: 'policy_confirmed',
};

export function isInsuranceApplicationStatus(value: unknown): value is InsuranceApplicationStatus {
  return typeof value === 'string' && (INSURANCE_APPLICATION_STATUSES as readonly string[]).includes(value);
}

export function normalizeInsuranceStatus(value: unknown): InsuranceApplicationStatus | null {
  if (isInsuranceApplicationStatus(value)) return value;
  if (typeof value !== 'string') return null;
  return LEGACY_INSURANCE_STATUS_MAP[value] ?? null;
}

export function insuranceStatusLabel(status: string): string {
  const normalized = normalizeInsuranceStatus(status);
  return normalized ? INSURANCE_STATUS_LABELS[normalized] : status;
}

export function canTransitionInsuranceStatus(
  from: InsuranceApplicationStatus,
  to: InsuranceApplicationStatus,
): boolean {
  return INSURANCE_STATUS_TRANSITIONS[from].includes(to);
}

export function isTerminalInsuranceStatus(status: InsuranceApplicationStatus): boolean {
  return INSURANCE_STATUS_TRANSITIONS[status].length === 0;
}
