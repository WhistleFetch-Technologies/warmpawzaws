const STYLE_ALIASES: Record<string, string> = {
  at_clinic: 'at_center',
  at_vendor: 'at_center',
  clinic: 'at_center',
  center: 'at_center',
  in_clinic: 'at_center',
  in_center: 'at_center',
  video: 'tele',
  online: 'tele',
  video_consultation: 'tele',
  teleconsultation: 'tele',
  video_call: 'tele',
  home: 'at_home',
  home_visit: 'at_home',
  at_home_visit: 'at_home',
  doorstep: 'at_home',
  home_service: 'at_home',
};

export function normalizeAvailabilityServiceStyle(style: string | null | undefined): string {
  if (!style) return '';
  const normalized = String(style).toLowerCase().trim().replace(/[-\s]+/g, '_');
  return STYLE_ALIASES[normalized] || normalized;
}

export function normalizeAvailabilityServiceStyles(styles: unknown): string[] {
  const input = Array.isArray(styles) ? styles : [];
  const normalized = input
    .map((style) => normalizeAvailabilityServiceStyle(typeof style === 'string' ? style : String(style || '')))
    .filter(Boolean);
  return [...new Set(normalized)];
}

export function acceptableAvailabilityStylesForSlot(serviceStyle: string): string[] {
  const normalized = normalizeAvailabilityServiceStyle(serviceStyle);
  if (!normalized) return [];
  if (normalized === 'at_center') {
    return [
      'at_center',
      'at_vendor',
      'at_clinic',
      'boarding',
      'checkin_checkout',
      'center',
      'training',
      'trainer',
      'pet_training',
    ];
  }
  if (normalized === 'at_home') {
    return ['at_home', 'home_visit', 'home', 'at_home_visit', 'training', 'trainer', 'pet_training'];
  }
  if (normalized === 'tele') {
    return ['tele', 'online', 'video_consultation'];
  }
  return [normalized];
}
