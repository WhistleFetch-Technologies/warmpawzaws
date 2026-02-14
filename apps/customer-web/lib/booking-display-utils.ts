/**
 * Utility helpers for booking and service display
 * - Safe price formatting (prevents NaN)
 * - Service style labels (tele, video, at_center, at_home)
 */

/** Safely format price - never returns NaN */
export function formatPrice(price: number | string | null | undefined): string {
  const n = typeof price === 'number' ? price : parseFloat(String(price || 0));
  if (Number.isNaN(n) || n < 0) return '0';
  return n.toLocaleString('en-IN');
}

/** Get display price with ₹ prefix, safe against NaN */
export function formatPriceWithSymbol(price: number | string | null | undefined): string {
  return `₹${formatPrice(price)}`;
}

/**
 * Get human-readable service style label for My Bookings and elsewhere
 * tele / video_consultation → Video Consultation
 * at_home → Home Visit
 * at_center → Clinic Visit (or Centre Visit for UK spelling)
 */
export function getServiceStyleDisplayLabel(
  serviceStyle?: string | null,
  serviceType?: string | null,
  serviceName?: string | null
): string {
  const style = (serviceStyle || serviceType || '').toLowerCase();
  const name = (serviceName || '').toLowerCase();

  if (style === 'tele' || style === 'video_consultation' || style === 'video' || style === 'online') {
    return 'Video Consultation';
  }
  if (name.includes('video') || name.includes('tele') || name.includes('online consultation')) {
    return 'Video Consultation';
  }
  if (style === 'at_home' || style === 'home') {
    return 'Home Visit';
  }
  if (style === 'at_center' || style === 'at_vendor' || style === 'at_clinic' || style === 'clinic') {
    return 'Clinic Visit';
  }
  // Fallback: capitalize with space
  if (style) return style.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return 'Service';
}
