/** Insurance application statuses (internal key -> customer-facing label). */
export const INSURANCE_APPLICATION_STATUSES = [
  'consultation_booked',
  'form_required',
  'form_submitted',
  'vendor_processing',
  'vendor_review',
  'payment_link_shared',
  'awaiting_payment',
  'payment_reported',
  'documents_uploaded',
  'policy_issued',
  'cancelled',
] as const;

export type InsuranceApplicationStatus = (typeof INSURANCE_APPLICATION_STATUSES)[number];

export const INSURANCE_STATUS_LABELS: Readonly<Record<InsuranceApplicationStatus, string>> = {
  consultation_booked: 'Consultation booked',
  form_required: 'Information needed',
  form_submitted: 'Information submitted',
  vendor_processing: 'Policy being prepared',
  vendor_review: 'Under review',
  payment_link_shared: 'Payment required',
  awaiting_payment: 'Awaiting payment',
  payment_reported: 'Payment update received',
  documents_uploaded: 'Documents received',
  policy_issued: 'Policy issued',
  cancelled: 'Cancelled',
};

/** Board column each status belongs to (matches the vendor Kanban). */
export type InsuranceStatusStage = 'new' | 'in_progress' | 'awaiting_external' | 'completed' | 'cancelled';

export const INSURANCE_STATUS_STAGE: Readonly<Record<InsuranceApplicationStatus, InsuranceStatusStage>> = {
  consultation_booked: 'new',
  form_required: 'in_progress',
  form_submitted: 'in_progress',
  vendor_processing: 'in_progress',
  vendor_review: 'in_progress',
  payment_link_shared: 'awaiting_external',
  awaiting_payment: 'awaiting_external',
  payment_reported: 'awaiting_external',
  documents_uploaded: 'awaiting_external',
  policy_issued: 'completed',
  cancelled: 'cancelled',
};

export function isInsuranceApplicationStatus(value: unknown): value is InsuranceApplicationStatus {
  return typeof value === 'string' && (INSURANCE_APPLICATION_STATUSES as readonly string[]).includes(value);
}

export function insuranceStatusLabel(status: string): string {
  return isInsuranceApplicationStatus(status) ? INSURANCE_STATUS_LABELS[status] : status;
}
