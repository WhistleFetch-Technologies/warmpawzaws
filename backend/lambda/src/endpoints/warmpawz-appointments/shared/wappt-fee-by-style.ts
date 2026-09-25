/**
 * Resolve Warmpawz Appointments catalogue fee for a booking style.
 * Centre fee = appointment_fee; home fee = appointment_fee_home (fallback centre).
 */
export function pickWapptFeeForStyle(opts: {
  centreFee: number;
  homeFee?: number | null;
  serviceStyle?: string | null;
}): number {
  const rawStyle = String(opts.serviceStyle || 'at_center').toLowerCase();
  const isHome =
    rawStyle === 'at_home' ||
    rawStyle === 'home_visit' ||
    rawStyle === 'home' ||
    rawStyle === 'sitting' ||
    rawStyle === 'pet_sitting';

  const centre = Math.round((Number(opts.centreFee) || 0) * 100) / 100;
  const homeRaw = opts.homeFee == null ? null : Number(opts.homeFee);
  const home =
    homeRaw != null && Number.isFinite(homeRaw)
      ? Math.round(homeRaw * 100) / 100
      : null;

  if (isHome) {
    if (home != null && home > 0) return home;
    return centre;
  }
  return centre;
}

/** Extract serviceStyles from roles.config for admin catalogue UX. */
export function extractServiceStylesFromRoleConfig(roleConfig: unknown): string[] {
  if (!roleConfig || typeof roleConfig !== 'object') return [];
  const cfg = roleConfig as Record<string, unknown>;
  const raw = cfg.serviceStyles ?? cfg.service_styles;
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
}

export function vendorOffersHomeStyle(serviceStyles: readonly string[]): boolean {
  return serviceStyles.some((s) =>
    ['at_home', 'home_visit', 'home', 'sitting', 'pet_sitting'].includes(s),
  );
}

export function vendorOffersCenterStyle(serviceStyles: readonly string[]): boolean {
  if (serviceStyles.length === 0) return true; // unknown → assume centre (legacy)
  return serviceStyles.some((s) =>
    ['at_center', 'at_vendor', 'at_clinic', 'boarding', 'center', 'checkin_checkout'].includes(s),
  );
}
