/**
 * Lightweight home service configuration constants.
 * Kept free of React, routing, booking, and payment imports so shell code
 * can read SERVICE_CONFIGS without pulling UniversalHomeServiceRouter.
 */

export type HomeServiceType =
  | 'walker'
  | 'grooming'
  | 'training'
  | 'veterinary'
  | 'behaviourist'
  | 'sitter'
  | 'diagnostics';

export interface HomeServiceConfig {
  roleId: string;
  displayName: string;
  icon: string;
  primaryColor: string;
  bgGradient: string;
  problems: Array<{ id: string; name: string; icon: string }>;
  priceUnit: string;
  defaultDuration: number;
  requiresOTP: boolean;
  requiresStartOTP: boolean;
  supportsPackages: boolean;
  showMedicalHistory: boolean;
}

export const SERVICE_CONFIGS: Record<HomeServiceType, HomeServiceConfig> = {
  walker: {
    roleId: 'dog_walker',
    displayName: 'Dog Walking',
    icon: '🚶',
    primaryColor: '#FF8C42',
    bgGradient: 'from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]',
    problems: [
      { id: '30-min', name: '30 Min Walk', icon: '🚶' },
      { id: '60-min', name: '60 Min Walk', icon: '🏃' },
      { id: 'group-walk', name: 'Group Walk', icon: '👥' },
      { id: 'park-visit', name: 'Park Visit', icon: '🌳' },
      { id: 'puppy-walk', name: 'Puppy Walk', icon: '🐕' },
    ],
    priceUnit: 'per walk',
    defaultDuration: 30,
    requiresOTP: true,
    requiresStartOTP: true,
    supportsPackages: true,
    showMedicalHistory: false,
  },
  grooming: {
    roleId: 'pet_groomer',
    displayName: 'Pet Grooming',
    icon: '✂️',
    primaryColor: '#A855F7',
    bgGradient: 'from-purple-500 to-violet-600',
    problems: [
      { id: 'full-grooming', name: 'Full Grooming', icon: '✨' },
      { id: 'bath', name: 'Bath Only', icon: '🛁' },
      { id: 'haircut', name: 'Hair Cut', icon: '✂️' },
      { id: 'nail-trim', name: 'Nail Trim', icon: '💅' },
      { id: 'ear-cleaning', name: 'Ear Cleaning', icon: '👂' },
      { id: 'de-shedding', name: 'De-shedding', icon: '🧹' },
      { id: 'flea-treatment', name: 'Flea Treatment', icon: '🔬' },
    ],
    priceUnit: 'per session',
    defaultDuration: 60,
    requiresOTP: true,
    requiresStartOTP: false,
    supportsPackages: true,
    showMedicalHistory: false,
  },
  training: {
    roleId: 'pet_trainer',
    displayName: 'Pet Training',
    icon: '🎓',
    primaryColor: '#3B82F6',
    bgGradient: 'from-blue-500 to-indigo-600',
    problems: [
      { id: 'basic-obedience', name: 'Basic Obedience', icon: '🎓' },
      { id: 'potty-training', name: 'Potty Training', icon: '🚽' },
      { id: 'leash-training', name: 'Leash Training', icon: '🦮' },
      { id: 'aggression', name: 'Aggression', icon: '😠' },
      { id: 'anxiety', name: 'Anxiety', icon: '😰' },
      { id: 'socialization', name: 'Socialization', icon: '🐕‍🦺' },
      { id: 'puppy-training', name: 'Puppy Training', icon: '🐶' },
    ],
    priceUnit: 'per session',
    defaultDuration: 60,
    requiresOTP: true,
    requiresStartOTP: true,
    supportsPackages: true,
    showMedicalHistory: false,
  },
  veterinary: {
    roleId: 'veterinarian',
    displayName: 'Home Vet Visit',
    icon: '🏥',
    primaryColor: '#EF4444',
    bgGradient: 'from-red-500 to-rose-600',
    problems: [
      { id: 'vomiting', name: 'Vomiting', icon: '🤮' },
      { id: 'diarrhea', name: 'Diarrhea', icon: '💩' },
      { id: 'not-eating', name: 'Not Eating', icon: '🍽️' },
      { id: 'skin-issues', name: 'Skin Issues', icon: '🔴' },
      { id: 'limping', name: 'Limping', icon: '🦵' },
      { id: 'fever', name: 'Fever', icon: '🤒' },
      { id: 'vaccination', name: 'Vaccination', icon: '💉' },
      { id: 'checkup', name: 'General Checkup', icon: '🩺' },
    ],
    priceUnit: 'per visit',
    defaultDuration: 45,
    requiresOTP: true,
    requiresStartOTP: false,
    supportsPackages: false,
    showMedicalHistory: true,
  },
  behaviourist: {
    roleId: 'pet_behaviourist',
    displayName: 'Pet Behaviourist',
    icon: '🧠',
    primaryColor: '#F59E0B',
    bgGradient: 'from-amber-500 to-orange-600',
    problems: [
      { id: 'aggression', name: 'Aggression', icon: '😠' },
      { id: 'anxiety', name: 'Anxiety/Fear', icon: '😰' },
      { id: 'separation', name: 'Separation Anxiety', icon: '💔' },
      { id: 'destructive', name: 'Destructive Behavior', icon: '🔨' },
      { id: 'barking', name: 'Excessive Barking', icon: '🔊' },
      { id: 'biting', name: 'Biting/Nipping', icon: '🦷' },
      { id: 'assessment', name: 'Behavior Assessment', icon: '📋' },
      { id: 'resource-guarding', name: 'Resource Guarding', icon: '🍖' },
    ],
    priceUnit: 'per session',
    defaultDuration: 90,
    requiresOTP: true,
    requiresStartOTP: false,
    supportsPackages: true,
    showMedicalHistory: false,
  },
  sitter: {
    roleId: 'pet_sitter',
    displayName: 'Pet Sitting',
    icon: '🏠',
    primaryColor: '#EC4899',
    bgGradient: 'from-pink-500 to-rose-600',
    problems: [
      { id: 'day-sitting', name: 'Day Sitting', icon: '☀️' },
      { id: 'overnight', name: 'Overnight Stay', icon: '🌙' },
      { id: 'drop-in', name: 'Drop-in Visit', icon: '🚪' },
      { id: 'multi-day', name: 'Multi-day Care', icon: '📅' },
      { id: 'medication', name: 'With Medication', icon: '💊' },
      { id: 'special-needs', name: 'Special Needs Pet', icon: '♿' },
    ],
    priceUnit: 'per day',
    defaultDuration: 480,
    requiresOTP: true,
    requiresStartOTP: true,
    supportsPackages: true,
    showMedicalHistory: false,
  },
  diagnostics: {
    roleId: 'diagnostics_technician',
    displayName: 'Home Sample Collection',
    icon: '🧪',
    primaryColor: '#06B6D4',
    bgGradient: 'from-cyan-500 to-teal-600',
    problems: [
      { id: 'blood-test', name: 'Blood Test', icon: '🩸' },
      { id: 'urine-test', name: 'Urine Test', icon: '🧪' },
      { id: 'stool-test', name: 'Stool Test', icon: '💩' },
      { id: 'skin-scraping', name: 'Skin Scraping', icon: '🔬' },
      { id: 'general-screening', name: 'General Screening', icon: '📋' },
      { id: 'pre-surgery', name: 'Pre-Surgery Panel', icon: '🏥' },
    ],
    priceUnit: 'per test',
    defaultDuration: 30,
    requiresOTP: true,
    requiresStartOTP: false,
    supportsPackages: false,
    showMedicalHistory: true,
  },
};
