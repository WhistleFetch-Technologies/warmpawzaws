/**
 * Role-based service style labels for vendor app
 * Matches vendor-web lib/service-style-labels.ts so UI shows e.g. "Training center booking"
 */

export type ServiceStyle = 'at_home' | 'at_center' | 'tele';

export interface ServiceStyleLabelConfig {
  label: string;
  icon: string;
  description: string;
}

const DEFAULT: Record<ServiceStyle, ServiceStyleLabelConfig> = {
  at_home: { label: 'Home Services', icon: '🏠', description: 'Services delivered at customer\'s home' },
  at_center: { label: 'Book at Center', icon: '🏥', description: 'Services at your location' },
  tele: { label: 'Tele Consultation', icon: '📱', description: 'Online consultation services' },
};

// Role key (normalized) -> partial config per style
const ROLE_LABELS: Record<string, Partial<Record<ServiceStyle, ServiceStyleLabelConfig>>> = {
  pet_trainer: { at_home: { label: 'Home Training', icon: '🏠', description: 'Training at customer\'s home' }, at_center: { label: 'Training Center Booking', icon: '🏟️', description: 'Book sessions at your training center' }, tele: { label: 'Online Training', icon: '📱', description: 'Virtual training' } },
  trainer: { at_home: { label: 'Home Training', icon: '🏠', description: 'Training at customer\'s home' }, at_center: { label: 'Training Center Booking', icon: '🏟️', description: 'Book at your training center' }, tele: { label: 'Online Training', icon: '📱', description: 'Virtual training' } },
  pet_groomer: { at_home: { label: 'Home Grooming', icon: '🏠', description: 'Grooming at customer\'s home' }, at_center: { label: 'Salon / Center Booking', icon: '✂️', description: 'Book at your salon' }, tele: { label: 'Consultation', icon: '📱', description: 'Pre-visit consultation' } },
  groomer: { at_home: { label: 'Home Grooming', icon: '🏠', description: 'Grooming at customer\'s home' }, at_center: { label: 'Salon / Center Booking', icon: '✂️', description: 'Book at your salon' }, tele: { label: 'Consultation', icon: '📱', description: 'Pre-visit consultation' } },
  veterinarian: { at_home: { label: 'Home Visit', icon: '🏠', description: 'Veterinary visit at home' }, at_center: { label: 'Clinic Booking', icon: '🏥', description: 'Book at your clinic' }, tele: { label: 'Video Consultation', icon: '📱', description: 'Telehealth' } },
  vet: { at_home: { label: 'Home Visit', icon: '🏠', description: 'Veterinary visit at home' }, at_center: { label: 'Clinic Booking', icon: '🏥', description: 'Book at your clinic' }, tele: { label: 'Video Consultation', icon: '📱', description: 'Telehealth' } },
  veterinary_clinic: { at_home: { label: 'Home Visit', icon: '🏠', description: 'Veterinary visit at home' }, at_center: { label: 'Clinic Booking', icon: '🏥', description: 'Book at your clinic' }, tele: { label: 'Video Consultation', icon: '📱', description: 'Telehealth' } },
  vet_clinic: { at_home: { label: 'Home Visit', icon: '🏠', description: 'Veterinary visit at home' }, at_center: { label: 'Clinic Booking', icon: '🏥', description: 'Book at your clinic' }, tele: { label: 'Video Consultation', icon: '📱', description: 'Telehealth' } },
  pet_walker: { at_home: { label: 'Dog Walking', icon: '🏠', description: 'Walking services' }, tele: { label: 'Check-in / Updates', icon: '📱', description: 'Updates' } },
  walker: { at_home: { label: 'Dog Walking', icon: '🏠', description: 'Walking services' }, tele: { label: 'Check-in / Updates', icon: '📱', description: 'Updates' } },
  pet_sitter: { at_home: { label: 'Pet Sitting', icon: '🏠', description: 'Sitting at customer\'s home' }, tele: { label: 'Updates', icon: '📱', description: 'Updates' } },
  sitter: { at_home: { label: 'Pet Sitting', icon: '🏠', description: 'Sitting at customer\'s home' }, tele: { label: 'Updates', icon: '📱', description: 'Updates' } },
  pet_boarding: { at_center: { label: 'Boarding Facility', icon: '🏨', description: 'Boarding at your facility' } },
  pet_resort: { at_center: { label: 'Resort Booking', icon: '🏖️', description: 'Book stays at your resort' } },
  pet_cafe: { at_center: { label: 'Cafe Visit', icon: '☕', description: 'Visits at your cafe' } },
  pet_pharmacy: { at_center: { label: 'Store / Pickup', icon: '💊', description: 'Pick up at store' }, at_home: { label: 'Delivery', icon: '🏠', description: 'Home delivery' } },
  pharmacy: { at_center: { label: 'Store / Pickup', icon: '💊', description: 'Pick up at store' }, at_home: { label: 'Delivery', icon: '🏠', description: 'Home delivery' } },
  pet_nutritionist: { at_home: { label: 'Home Consultation', icon: '🏠', description: 'Nutrition at home' }, at_center: { label: 'Clinic Booking', icon: '🏥', description: 'Book at your practice' }, tele: { label: 'Video Consultation', icon: '📱', description: 'Online consultation' } },
  nutritionist: { at_home: { label: 'Home Consultation', icon: '🏠', description: 'Nutrition at home' }, at_center: { label: 'Clinic Booking', icon: '🏥', description: 'Book at your practice' }, tele: { label: 'Video Consultation', icon: '📱', description: 'Online consultation' } },
  pet_behaviorist: { at_home: { label: 'Home Session', icon: '🏠', description: 'Behavior at home' }, at_center: { label: 'Center Booking', icon: '🏥', description: 'Sessions at your center' }, tele: { label: 'Video Consultation', icon: '📱', description: 'Online consultation' } },
};

function normalizeRole(roleName: string | null | undefined): string {
  if (!roleName || typeof roleName !== 'string') return '';
  return roleName.toLowerCase().trim().replace(/\s+/g, '_');
}

export function getServiceStyleLabelForRole(roleName: string | null | undefined, style: ServiceStyle): ServiceStyleLabelConfig {
  const key = normalizeRole(roleName);
  if (!key) return DEFAULT[style];
  const roleConfig = ROLE_LABELS[key] ?? ROLE_LABELS[key.replace(/^pet_/, '')];
  if (roleConfig?.[style]) return roleConfig[style]!;
  return DEFAULT[style];
}
