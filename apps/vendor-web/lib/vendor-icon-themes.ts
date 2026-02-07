import { 
  PersonStanding, Scissors, GraduationCap, Home, Stethoscope, Baby,
  Building2, Video, Phone, Calendar, Briefcase, TrendingUp, Settings,
  Pill, FileText, Heart, Users, Building, ShoppingBag, Package, 
  LayoutDashboard, CalendarClock, Dog, Cat, PawPrint, Utensils,
  Coffee, Camera, Ambulance, Microscope, Shield, Truck, Plane,
  Car, PartyPopper, MapPin
} from 'lucide-react';
import React from 'react';

// ============================================================================
// ROLE ICON MAPPING - Maps role IDs to lucide icon names
// ============================================================================

const ROLE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  // Service Providers
  'walker': PersonStanding,
  'pet_walker': PersonStanding,
  'groomer': Scissors,
  'pet_groomer': Scissors,
  'trainer': GraduationCap,
  'pet_trainer': GraduationCap,
  'pet_boarder': Home,
  'boarder': Home,
  'veterinarian': Stethoscope,
  'vet': Stethoscope,
  'vet_clinic': Building2,
  'pet_sitter': Baby,
  'sitter': Baby,
  
  // Specialty
  'nutritionist': Utensils,
  'pet_nutritionist': Utensils,
  'pet_cafe': Coffee,
  'pet_photographer': Camera,
  'ambulance': Ambulance,
  'diagnostics_center': Microscope,
  'pet_insurance': Shield,
  'pet_transport': Truck,
  'pet_relocation': Plane,
  'shelter': Heart,
  'pet_adoption_center': Heart,
  'pet_event_organizer': PartyPopper,
  'pet_daycare': Building,
  'pet_spa': Scissors,
  
  // Commerce
  'pharmacy': Pill,
  'seller': ShoppingBag,
};

// ============================================================================
// ROLE COLOR SCHEMES
// ============================================================================

const ROLE_COLOR_MAP: Record<string, { primary: string; secondary: string; bg: string; text: string }> = {
  // Healthcare
  'veterinarian': { primary: 'text-emerald-600', secondary: 'bg-emerald-50', bg: 'bg-emerald-500', text: 'text-white' },
  'vet': { primary: 'text-emerald-600', secondary: 'bg-emerald-50', bg: 'bg-emerald-500', text: 'text-white' },
  'vet_clinic': { primary: 'text-emerald-600', secondary: 'bg-emerald-50', bg: 'bg-emerald-500', text: 'text-white' },
  'pharmacy': { primary: 'text-red-600', secondary: 'bg-red-50', bg: 'bg-red-500', text: 'text-white' },
  'ambulance': { primary: 'text-red-600', secondary: 'bg-red-50', bg: 'bg-red-500', text: 'text-white' },
  'diagnostics_center': { primary: 'text-blue-600', secondary: 'bg-blue-50', bg: 'bg-blue-500', text: 'text-white' },
  
  // Grooming & Spa
  'groomer': { primary: 'text-pink-600', secondary: 'bg-pink-50', bg: 'bg-pink-500', text: 'text-white' },
  'pet_groomer': { primary: 'text-pink-600', secondary: 'bg-pink-50', bg: 'bg-pink-500', text: 'text-white' },
  'pet_spa': { primary: 'text-pink-600', secondary: 'bg-pink-50', bg: 'bg-pink-500', text: 'text-white' },
  
  // Training
  'trainer': { primary: 'text-orange-600', secondary: 'bg-orange-50', bg: 'bg-orange-500', text: 'text-white' },
  'pet_trainer': { primary: 'text-orange-600', secondary: 'bg-orange-50', bg: 'bg-orange-500', text: 'text-white' },
  
  // Walking & Sitting
  'walker': { primary: 'text-blue-600', secondary: 'bg-blue-50', bg: 'bg-blue-500', text: 'text-white' },
  'pet_walker': { primary: 'text-blue-600', secondary: 'bg-blue-50', bg: 'bg-blue-500', text: 'text-white' },
  'pet_sitter': { primary: 'text-violet-600', secondary: 'bg-violet-50', bg: 'bg-violet-500', text: 'text-white' },
  'sitter': { primary: 'text-violet-600', secondary: 'bg-violet-50', bg: 'bg-violet-500', text: 'text-white' },
  
  // Boarding
  'pet_boarder': { primary: 'text-amber-600', secondary: 'bg-amber-50', bg: 'bg-amber-500', text: 'text-white' },
  'boarder': { primary: 'text-amber-600', secondary: 'bg-amber-50', bg: 'bg-amber-500', text: 'text-white' },
  'pet_daycare': { primary: 'text-amber-600', secondary: 'bg-amber-50', bg: 'bg-amber-500', text: 'text-white' },
  
  // Nutrition
  'nutritionist': { primary: 'text-lime-600', secondary: 'bg-lime-50', bg: 'bg-lime-500', text: 'text-white' },
  'pet_nutritionist': { primary: 'text-lime-600', secondary: 'bg-lime-50', bg: 'bg-lime-500', text: 'text-white' },
  
  // Hospitality
  'pet_cafe': { primary: 'text-rose-600', secondary: 'bg-rose-50', bg: 'bg-rose-500', text: 'text-white' },
  
  // Specialty
  'pet_photographer': { primary: 'text-purple-600', secondary: 'bg-purple-50', bg: 'bg-purple-500', text: 'text-white' },
  'pet_insurance': { primary: 'text-indigo-600', secondary: 'bg-indigo-50', bg: 'bg-indigo-500', text: 'text-white' },
  'pet_transport': { primary: 'text-cyan-600', secondary: 'bg-cyan-50', bg: 'bg-cyan-500', text: 'text-white' },
  'pet_relocation': { primary: 'text-teal-600', secondary: 'bg-teal-50', bg: 'bg-teal-500', text: 'text-white' },
  'shelter': { primary: 'text-cyan-600', secondary: 'bg-cyan-50', bg: 'bg-cyan-500', text: 'text-white' },
  'pet_adoption_center': { primary: 'text-cyan-600', secondary: 'bg-cyan-50', bg: 'bg-cyan-500', text: 'text-white' },
  'pet_event_organizer': { primary: 'text-yellow-600', secondary: 'bg-yellow-50', bg: 'bg-yellow-500', text: 'text-white' },
  
  // Commerce
  'seller': { primary: 'text-indigo-600', secondary: 'bg-indigo-50', bg: 'bg-indigo-500', text: 'text-white' },
};

const DEFAULT_COLOR = { primary: 'text-gray-600', secondary: 'bg-gray-50', bg: 'bg-gray-500', text: 'text-white' };

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function getVendorIconTheme(roleId?: string): string {
  if (!roleId) return 'default';
  const normalized = roleId.toLowerCase().trim();
  return ROLE_COLOR_MAP[normalized] ? normalized : 'default';
}

/**
 * Get the lucide icon component for a role
 * Returns PawPrint as default for unknown roles
 */
export function getRoleIconComponent(roleId?: string): React.ComponentType<{ className?: string }> {
  if (!roleId) return PawPrint;
  const normalized = roleId.toLowerCase().trim();
  return ROLE_ICON_MAP[normalized] || PawPrint;
}

/**
 * Legacy function that returns a placeholder string
 * @deprecated Use getRoleIconComponent for React icon rendering
 */
export function getRoleIcon(roleId?: string): string {
  // Return an empty string - UI should use getRoleIconComponent instead
  return '';
}

/**
 * Get color scheme classes for a role
 */
export function getRoleColorScheme(roleId?: string): { primary: string; secondary: string; bg?: string; text?: string } {
  if (!roleId) return DEFAULT_COLOR;
  const normalized = roleId.toLowerCase().trim();
  return ROLE_COLOR_MAP[normalized] || DEFAULT_COLOR;
}

/**
 * Render a role icon as a React element
 * Use this in JSX: {renderRoleIcon(roleId, 'w-6 h-6')}
 */
export function renderRoleIcon(roleId?: string, className: string = 'w-6 h-6'): React.ReactNode {
  const IconComponent = getRoleIconComponent(roleId);
  return React.createElement(IconComponent, { className });
}
