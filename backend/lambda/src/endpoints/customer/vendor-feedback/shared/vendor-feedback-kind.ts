import type {
  VendorFeedbackKind,
  VendorFeedbackReviewSource,
  VendorFeedbackSourceType,
} from './vendor-feedback.types';

const AT_HOME_STYLES = new Set(['at_home', 'home_visit', 'home']);
const AT_CLINIC_STYLES = new Set(['at_center', 'at_clinic', 'at_vendor', 'walk_in', 'clinic']);
const TELE_STYLES = new Set(['tele', 'teleconsult', 'teleconsultation', 'video', 'video_call', 'online']);

/** Booking style wins when a Warmpawz Pay bill paid for a booking (same visit). */
export function resolveVendorFeedbackKind(
  sourceType: VendorFeedbackSourceType,
  bookingStyle: string | null | undefined
): VendorFeedbackKind {
  const style = String(bookingStyle ?? '').trim().toLowerCase();
  if (sourceType === 'payment' && !style) return 'warmpawz_pay';
  if (AT_HOME_STYLES.has(style)) return 'appointment_at_home';
  if (AT_CLINIC_STYLES.has(style)) return 'appointment_at_clinic';
  if (TELE_STYLES.has(style)) return 'teleconsultation';
  return sourceType === 'payment' ? 'warmpawz_pay' : 'appointment';
}

const TITLES: Record<VendorFeedbackKind, string> = {
  appointment_at_home: 'Leave a review for your previous at-home appointment',
  appointment_at_clinic: 'Leave a review for your previous clinic appointment',
  appointment: 'Leave a review for your previous appointment',
  teleconsultation: 'Leave a review for your previous teleconsultation',
  warmpawz_pay: 'Leave a review for your previous Warmpawz Pay transaction',
};

export function vendorFeedbackTitle(kind: VendorFeedbackKind): string {
  return TITLES[kind];
}

const REVIEW_SOURCES: Record<VendorFeedbackKind, VendorFeedbackReviewSource> = {
  appointment_at_home: 'at_home',
  appointment_at_clinic: 'at_clinic',
  appointment: 'appointment',
  teleconsultation: 'tele',
  warmpawz_pay: 'warmpawz_pay',
};

export function vendorFeedbackReviewSource(kind: VendorFeedbackKind): VendorFeedbackReviewSource {
  return REVIEW_SOURCES[kind];
}
