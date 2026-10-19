export type VendorFeedbackSourceType = 'booking' | 'payment';

export type VendorFeedbackKind =
  | 'appointment_at_home'
  | 'appointment_at_clinic'
  | 'appointment'
  | 'teleconsultation'
  | 'warmpawz_pay';

/** Stored in reviews.source_type. */
export type VendorFeedbackReviewSource = 'at_home' | 'at_clinic' | 'appointment' | 'tele' | 'warmpawz_pay';

export interface VendorFeedbackVendorDto {
  vendorId: string;
  name: string;
  photoUrl: string | null;
  categoryLabel: string;
  isVerified: boolean;
  distanceKm: number | null;
  distanceText: string | null;
  address: string | null;
}

export interface VendorFeedbackPromptDto {
  sourceType: VendorFeedbackSourceType;
  sourceId: string;
  bookingId: string | null;
  paymentId: string | null;
  kind: VendorFeedbackKind;
  title: string;
  transactionAt: string | null;
  vendor: VendorFeedbackVendorDto;
}

export interface VendorFeedbackPromptResponse {
  success: true;
  prompt: VendorFeedbackPromptDto | null;
}

export interface VendorFeedbackSourceRef {
  sourceType: VendorFeedbackSourceType;
  sourceId: string;
}

export interface VendorFeedbackSubmitInput extends VendorFeedbackSourceRef {
  rating: number;
  comment: string | null;
}
