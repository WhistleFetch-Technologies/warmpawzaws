/**
 * Role-based service style labels
 * Returns labels (and icons/descriptions) per service style based on vendor role
 * so UI shows "Training center booking", "Clinic booking", "Home grooming", etc.
 */

export type ServiceStyle = 'at_home' | 'at_center' | 'tele';

export interface ServiceStyleLabelConfig {
  label: string;
  icon: string;
  description: string;
}

// Default (generic) labels when role is unknown
const DEFAULT_STYLE_LABELS: Record<ServiceStyle, ServiceStyleLabelConfig> = {
  at_home: { label: 'Home Services', icon: '🏠', description: 'Services delivered at customer\'s home' },
  at_center: { label: 'Book at Center', icon: '🏥', description: 'Services at your location' },
  tele: { label: 'Tele Consultation', icon: '📱', description: 'Online consultation services' },
};

// Role-specific overrides: role key (normalized) -> { at_home?, at_center?, tele? }
// Keys are matched with role name lowercased and spaces -> underscores
const ROLE_STYLE_LABELS: Record<string, Partial<Record<ServiceStyle, ServiceStyleLabelConfig>>> = {
  // Training
  pet_trainer: {
    at_home: { label: 'Home Training', icon: '🏠', description: 'Training sessions at customer\'s home' },
    at_center: { label: 'Training Center Booking', icon: '🏟️', description: 'Book sessions at your training center' },
    tele: { label: 'Online Training', icon: '📱', description: 'Virtual training sessions' },
  },
  trainer: {
    at_home: { label: 'Home Training', icon: '🏠', description: 'Training sessions at customer\'s home' },
    at_center: { label: 'Training Center Booking', icon: '🏟️', description: 'Book sessions at your training center' },
    tele: { label: 'Online Training', icon: '📱', description: 'Virtual training sessions' },
  },
  trainer_center: {
    at_home: { label: 'Home Training', icon: '🏠', description: 'Training at customer\'s home' },
    at_center: { label: 'Center Services', icon: '🏟️', description: 'Services at your training center' },
    tele: { label: 'Online Training', icon: '📱', description: 'Virtual training sessions' },
  },
  training_center: {
    at_home: { label: 'Home Training', icon: '🏠', description: 'Training at customer\'s home' },
    at_center: { label: 'Center Services', icon: '🏟️', description: 'Services at your training center' },
    tele: { label: 'Online Training', icon: '📱', description: 'Virtual training sessions' },
  },
  trainer_solo: {
    at_home: { label: 'Home Training', icon: '🏠', description: 'Training at customer\'s home' },
    tele: { label: 'Online Training', icon: '📱', description: 'Virtual training sessions' },
  },
  // Behaviorist (same as Trainer)
  pet_behaviorist: {
    at_home: { label: 'Home Behavior Session', icon: '🏠', description: 'Behavior sessions at customer\'s home' },
    at_center: { label: 'Behavior Center Booking', icon: '🏟️', description: 'Book sessions at your behavior center' },
    tele: { label: 'Online Behavior Consultation', icon: '📱', description: 'Virtual behavior sessions' },
  },
  behaviorist: {
    at_home: { label: 'Home Behavior Session', icon: '🏠', description: 'Behavior sessions at customer\'s home' },
    at_center: { label: 'Behavior Center Booking', icon: '🏟️', description: 'Book sessions at your behavior center' },
    tele: { label: 'Online Behavior Consultation', icon: '📱', description: 'Virtual behavior sessions' },
  },
  behaviorist_solo: {
    at_home: { label: 'Home Behavior Session', icon: '🏠', description: 'Behavior sessions at customer\'s home' },
    tele: { label: 'Online Behavior Consultation', icon: '📱', description: 'Virtual behavior sessions' },
  },
  behaviorist_center: {
    at_home: { label: 'Home Behavior Session', icon: '🏠', description: 'Behavior at customer\'s home' },
    at_center: { label: 'Center Services', icon: '🏟️', description: 'Services at your behavior center' },
    tele: { label: 'Online Behavior Consultation', icon: '📱', description: 'Virtual behavior sessions' },
  },
  // Grooming
  pet_groomer: {
    at_home: { label: 'Home Grooming', icon: '🏠', description: 'Grooming at customer\'s home' },
    at_center: { label: 'Salon / Center Booking', icon: '✂️', description: 'Book appointments at your salon' },
    tele: { label: 'Consultation', icon: '📱', description: 'Pre-visit consultation' },
  },
  groomer: {
    at_home: { label: 'Home Grooming', icon: '🏠', description: 'Grooming at customer\'s home' },
    at_center: { label: 'Salon / Center Booking', icon: '✂️', description: 'Book appointments at your salon' },
    tele: { label: 'Consultation', icon: '📱', description: 'Pre-visit consultation' },
  },
  groomer_center: {
    at_home: { label: 'Home Grooming', icon: '🏠', description: 'Grooming at customer\'s home' },
    at_center: { label: 'Salon Booking', icon: '✂️', description: 'Book at your grooming salon' },
  },
  // Veterinary
  veterinarian: {
    at_home: { label: 'Home Visit', icon: '🏠', description: 'Veterinary visit at customer\'s home' },
    at_center: { label: 'Clinic Booking', icon: '🏥', description: 'Book appointments at your clinic' },
    tele: { label: 'Video Consultation', icon: '📱', description: 'Telehealth consultation' },
  },
  vet: {
    at_home: { label: 'Home Visit', icon: '🏠', description: 'Veterinary visit at customer\'s home' },
    at_center: { label: 'Clinic Booking', icon: '🏥', description: 'Book appointments at your clinic' },
    tele: { label: 'Video Consultation', icon: '📱', description: 'Telehealth consultation' },
  },
  veterinary_clinic: {
    at_home: { label: 'Home Visit', icon: '🏠', description: 'Veterinary visit at customer\'s home' },
    at_center: { label: 'Clinic Booking', icon: '🏥', description: 'Book at your clinic' },
    tele: { label: 'Video Consultation', icon: '📱', description: 'Telehealth consultation' },
  },
  vet_clinic: {
    at_home: { label: 'Home Visit', icon: '🏠', description: 'Veterinary visit at customer\'s home' },
    at_center: { label: 'Clinic Booking', icon: '🏥', description: 'Book at your clinic' },
    tele: { label: 'Video Consultation', icon: '📱', description: 'Telehealth consultation' },
  },
  // Walker / Sitter
  pet_walker: {
    at_home: { label: 'Dog Walking', icon: '🏠', description: 'Walking services' },
    tele: { label: 'Check-in / Updates', icon: '📱', description: 'Updates and coordination' },
  },
  walker: {
    at_home: { label: 'Dog Walking', icon: '🏠', description: 'Walking services' },
    tele: { label: 'Check-in / Updates', icon: '📱', description: 'Updates and coordination' },
  },
  pet_sitter: {
    at_home: { label: 'Pet Sitting', icon: '🏠', description: 'Sitting at customer\'s home' },
    tele: { label: 'Updates', icon: '📱', description: 'Updates and coordination' },
  },
  sitter: {
    at_home: { label: 'Pet Sitting', icon: '🏠', description: 'Sitting at customer\'s home' },
    tele: { label: 'Updates', icon: '📱', description: 'Updates and coordination' },
  },
  pet_taxi: {
    at_home: { label: 'Pet Taxi', icon: '🚗', description: 'Transport services' },
  },
  // Boarding / Resort / Cafe
  pet_boarding: {
    at_center: { label: 'Boarding Facility', icon: '🏨', description: 'Boarding at your facility' },
  },
  boarding: {
    at_center: { label: 'Boarding Facility', icon: '🏨', description: 'Boarding at your facility' },
  },
  pet_resort: {
    at_center: { label: 'Resort Booking', icon: '🏖️', description: 'Book stays at your resort' },
  },
  resort: {
    at_center: { label: 'Resort Booking', icon: '🏖️', description: 'Book stays at your resort' },
  },
  pet_cafe: {
    at_center: { label: 'Cafe Visit', icon: '☕', description: 'Visits at your cafe' },
  },
  cafe: {
    at_center: { label: 'Cafe Visit', icon: '☕', description: 'Visits at your cafe' },
  },
  // Nutrition / Behavior
  pet_nutritionist: {
    at_home: { label: 'Home Consultation', icon: '🏠', description: 'Nutrition consultation at home' },
    at_center: { label: 'Clinic Booking', icon: '🏥', description: 'Book at your practice' },
    tele: { label: 'Video Consultation', icon: '📱', description: 'Online nutrition consultation' },
  },
  nutritionist: {
    at_home: { label: 'Home Consultation', icon: '🏠', description: 'Nutrition consultation at home' },
    at_center: { label: 'Clinic Booking', icon: '🏥', description: 'Book at your practice' },
    tele: { label: 'Video Consultation', icon: '📱', description: 'Online nutrition consultation' },
  },
  pet_behaviorist: {
    at_home: { label: 'Home Session', icon: '🏠', description: 'Behavior sessions at home' },
    at_center: { label: 'Center Booking', icon: '🏥', description: 'Sessions at your center' },
    tele: { label: 'Video Consultation', icon: '📱', description: 'Online behavior consultation' },
  },
  // Pharmacy / Retail
  pet_pharmacy: {
    at_center: { label: 'Store / Pickup', icon: '💊', description: 'Pick up at your store' },
    at_home: { label: 'Delivery', icon: '🏠', description: 'Home delivery' },
  },
  pharmacy: {
    at_center: { label: 'Store / Pickup', icon: '💊', description: 'Pick up at your store' },
    at_home: { label: 'Delivery', icon: '🏠', description: 'Home delivery' },
  },
  pet_products_store: {
    at_center: { label: 'Store / Pickup', icon: '🛒', description: 'Pick up at your store' },
    at_home: { label: 'Delivery', icon: '🏠', description: 'Home delivery' },
  },
  // Diagnostics / Other
  diagnostics: {
    at_home: { label: 'Home Visit', icon: '🏠', description: 'At customer\'s home' },
    at_center: { label: 'Lab / Center', icon: '🏥', description: 'At your lab or center' },
  },
  pet_photographer: {
    at_home: { label: 'On Location', icon: '🏠', description: 'Photo session on location' },
    at_center: { label: 'Studio Booking', icon: '📷', description: 'Book studio sessions' },
  },
  event_organizer: {
    at_center: { label: 'Event Booking', icon: '🎉', description: 'Book events at your venue' },
  },
};

function normalizeRoleName(roleName: string | null | undefined): string {
  if (!roleName || typeof roleName !== 'string') return '';
  return roleName.toLowerCase().trim().replace(/\s+/g, '_');
}

/**
 * Get label config for a service style based on vendor role.
 * Use this for vendor dashboard, service management, catalog, etc.
 */
export function getServiceStyleLabelForRole(
  roleName: string | null | undefined,
  style: ServiceStyle
): ServiceStyleLabelConfig {
  const key = normalizeRoleName(roleName);
  if (!key) return DEFAULT_STYLE_LABELS[style];

  const roleConfig = ROLE_STYLE_LABELS[key];
  if (roleConfig && roleConfig[style]) {
    return roleConfig[style]!;
  }
  // Try without pet_ prefix (e.g. trainer if key was pet_trainer)
  const shortKey = key.replace(/^pet_/, '');
  const shortConfig = ROLE_STYLE_LABELS[shortKey];
  if (shortConfig && shortConfig[style]) {
    return shortConfig[style]!;
  }
  return DEFAULT_STYLE_LABELS[style];
}

/**
 * Get display label only (for badges, table cells, etc.)
 */
export function getServiceStyleLabel(roleName: string | null | undefined, style: ServiceStyle): string {
  return getServiceStyleLabelForRole(roleName, style).label;
}

/**
 * Get all three style configs for a role (for tabs/cards that show all allowed styles).
 */
export function getAllStyleLabelsForRole(
  roleName: string | null | undefined,
  styles: ServiceStyle[] = ['at_home', 'at_center', 'tele']
): Record<ServiceStyle, ServiceStyleLabelConfig> {
  const result = {} as Record<ServiceStyle, ServiceStyleLabelConfig>;
  for (const s of styles) {
    result[s] = getServiceStyleLabelForRole(roleName, s);
  }
  return result;
}
