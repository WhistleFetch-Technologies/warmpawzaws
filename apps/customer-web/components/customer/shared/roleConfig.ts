/**
 * ROLE CONFIGURATION UTILITY
 * 
 * Centralized configuration for all service roles (vet, groomer, trainer)
 * This ensures single source of truth for role-specific settings
 */

import { Stethoscope, Scissors, GraduationCap, LucideIcon } from 'lucide-react';

export type RoleId = 'veterinarian' | 'groomer' | 'trainer';
export type ServiceStyle = 'tele' | 'at_home' | 'at_center';

export interface RoleConfig {
  roleId: RoleId;
  category: string;
  allowedStyles: ServiceStyle[];
  icon: LucideIcon;
  roleName: string;
  displayName: string;
  // Style-specific labels
  styleLabels: {
    tele?: string;
    at_home: string;
    at_center: string;
  };
  // Style-specific descriptions
  styleDescriptions: {
    tele?: string;
    at_home: string;
    at_center: string;
  };
}

export const ROLE_CONFIG: Record<RoleId, RoleConfig> = {
  veterinarian: {
    roleId: 'veterinarian',
    category: 'vet',
    allowedStyles: ['tele', 'at_home', 'at_center'],
    icon: Stethoscope,
    roleName: 'Veterinarian',
    displayName: 'Veterinary Services',
    styleLabels: {
      tele: 'Tele Consultation',
      at_home: 'Home Visit',
      at_center: 'Clinic Visit',
    },
    styleDescriptions: {
      tele: 'Video call with a vet from anywhere',
      at_home: 'Vet comes to your location',
      at_center: 'Visit a vet clinic near you',
    },
  },
  groomer: {
    roleId: 'groomer',
    category: 'grooming',
    allowedStyles: ['at_home', 'at_center'], // NO tele
    icon: Scissors,
    roleName: 'Groomer',
    displayName: 'Grooming Services',
    styleLabels: {
      at_home: 'Home Visit',
      at_center: 'Grooming Center',
    },
    styleDescriptions: {
      at_home: 'Groomer comes to your location',
      at_center: 'Visit a grooming center near you',
    },
  },
  trainer: {
    roleId: 'trainer',
    category: 'training',
    allowedStyles: ['at_home', 'at_center'], // NO tele
    icon: GraduationCap,
    roleName: 'Trainer',
    displayName: 'Training Services',
    styleLabels: {
      at_home: 'Home Training',
      at_center: 'Training Center',
    },
    styleDescriptions: {
      at_home: 'Trainer comes to your location',
      at_center: 'Visit a training center near you',
    },
  },
};

/**
 * Get role configuration by roleId
 */
export function getRoleConfig(roleId: RoleId): RoleConfig {
  return ROLE_CONFIG[roleId];
}

/**
 * Check if a service style is allowed for a role
 */
export function isStyleAllowed(roleId: RoleId, style: ServiceStyle): boolean {
  const config = ROLE_CONFIG[roleId];
  return config?.allowedStyles.includes(style) ?? false;
}

/**
 * Get roleId from category (backward compatibility)
 */
export function getRoleIdFromCategory(category: string): RoleId | null {
  const entry = Object.values(ROLE_CONFIG).find(config => config.category === category);
  return entry?.roleId ?? null;
}
