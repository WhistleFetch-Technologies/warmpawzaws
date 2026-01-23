/**
 * Vendor Personalization - Role-specific configurations and styling
 */

export interface VendorPersonalization {
  roleName: string;
  primaryColor: string;
  secondaryColor: string;
  icon: string;
  categoryIcon: string;
  description: string;
  features: string[];
}

const PERSONALIZATION_MAP: Record<string, VendorPersonalization> = {
  'vet': {
    roleName: 'Veterinary',
    primaryColor: '#DC2626', // red-600
    secondaryColor: '#FEE2E2', // red-100
    icon: '🏥',
    categoryIcon: '⚕️',
    description: 'Professional veterinary care for your pets',
    features: ['Emergency Care', 'Vaccination', 'Surgery', 'Check-up']
  },
  'groomer': {
    roleName: 'Grooming',
    primaryColor: '#2563EB', // blue-600
    secondaryColor: '#DBEAFE', // blue-100
    icon: '✂️',
    categoryIcon: '💅',
    description: 'Expert grooming services for all breeds',
    features: ['Bath & Groom', 'Nail Trimming', 'Styling', 'Spa Treatment']
  },
  'trainer': {
    roleName: 'Training',
    primaryColor: '#7C3AED', // violet-600
    secondaryColor: '#EDE9FE', // violet-100
    icon: '🎓',
    categoryIcon: '🏋️',
    description: 'Professional pet training services',
    features: ['Obedience Training', 'Behavioral Training', 'Puppy Training', 'Agility Training']
  },
  'walker': {
    roleName: 'Walking',
    primaryColor: '#059669', // emerald-600
    secondaryColor: '#D1FAE5', // emerald-100
    icon: '🚶',
    categoryIcon: '🌳',
    description: 'Daily walking and exercise services',
    features: ['Regular Walks', 'Group Walks', 'Exercise Sessions', 'Playtime']
  },
  'boarding': {
    roleName: 'Boarding',
    primaryColor: '#D97706', // amber-600
    secondaryColor: '#FEF3C7', // amber-100
    icon: '🏠',
    categoryIcon: '🛏️',
    description: 'Safe and comfortable boarding facilities',
    features: ['Day Care', 'Overnight Stay', 'Play Areas', 'Regular Updates']
  },
};

export function getVendorPersonalization(roleId: string | undefined, services?: any[]): VendorPersonalization {
  const role = roleId ? String(roleId).toLowerCase() : 'general';
  return PERSONALIZATION_MAP[role] || {
    roleName: 'Service Provider',
    primaryColor: '#6B7280', // gray-500
    secondaryColor: '#F3F4F6', // gray-100
    icon: '🏢',
    categoryIcon: '📍',
    description: 'Professional pet services',
    features: ['Quality Service', 'Expert Care', 'Affordable Pricing', 'Customer Satisfaction']
  };
}

export function getRoleColors(roleId: string | undefined): { primary: string; secondary: string } {
  const personalization = getVendorPersonalization(roleId);
  return {
    primary: personalization.primaryColor,
    secondary: personalization.secondaryColor
  };
}

