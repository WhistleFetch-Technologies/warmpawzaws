/** Mirrors backend endpoints/customer/vendor-feedback/shared/vendor-feedback.types.ts */

export type VendorFeedbackSourceType = 'booking' | 'payment';

export type VendorFeedbackKind =
  | 'appointment_at_home'
  | 'appointment_at_clinic'
  | 'appointment'
  | 'teleconsultation'
  | 'warmpawz_pay';

export interface VendorFeedbackVendor {
  vendorId: string;
  name: string;
  photoUrl: string | null;
  categoryLabel: string;
  isVerified: boolean;
  distanceKm: number | null;
  distanceText: string | null;
  address: string | null;
}

export interface VendorFeedbackPrompt {
  sourceType: VendorFeedbackSourceType;
  sourceId: string;
  bookingId: string | null;
  paymentId: string | null;
  kind: VendorFeedbackKind;
  title: string;
  transactionAt: string | null;
  vendor: VendorFeedbackVendor;
}

export interface VendorFeedbackSubmission {
  rating: number;
  comment: string;
}
