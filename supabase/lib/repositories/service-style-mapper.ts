/**
 * ============================================================================
 * SERVICE STYLE MAPPER
 * ============================================================================
 * 
 * Standardizes service style naming across the application
 * Maps legacy names to standard: at_center, at_home, tele
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient, selectQuery } from "../db.ts";

// Standard service styles
export type StandardServiceStyle = 'at_center' | 'at_home' | 'tele';

// Legacy service style names
type LegacyServiceStyle = 
  | 'clinic' 
  | 'home' 
  | 'both' 
  | 'at_clinic' 
  | 'at_vendor' 
  | 'online' 
  | 'tele-consultation'
  | 'at_center'
  | 'at_home'
  | 'tele';

// Default mapping (fallback if DB not available)
const DEFAULT_MAPPING: Record<string, StandardServiceStyle> = {
  'clinic': 'at_center',
  'home': 'at_home',
  'both': 'at_center', // Default to at_center for 'both'
  'at_clinic': 'at_center',
  'at_vendor': 'at_center',
  'online': 'tele',
  'tele-consultation': 'tele',
  'at_center': 'at_center',
  'at_home': 'at_home',
  'tele': 'tele',
};

/**
 * Standardize service style name
 * Maps any legacy name to standard format
 */
export async function standardizeServiceStyle(
  input: string | null | undefined
): Promise<StandardServiceStyle | null> {
  if (!input) return null;
  
  const normalized = input.toLowerCase().trim();
  
  // Check if already standard
  if (normalized === 'at_center' || normalized === 'at_home' || normalized === 'tele') {
    return normalized as StandardServiceStyle;
  }
  
  // Try to get from database mapping
  try {
    const mappings = await selectQuery<{ legacy_name: string; standard_name: StandardServiceStyle }>(
      "service_style_mappings",
      { legacy_name: normalized },
      { limit: 1 }
    );
    
    if (mappings[0]) {
      return mappings[0].standard_name;
    }
  } catch (error) {
    console.warn('[ServiceStyleMapper] Database lookup failed, using default mapping:', error);
  }
  
  // Fallback to default mapping
  return DEFAULT_MAPPING[normalized] || 'at_center';
}

/**
 * Standardize array of service styles
 */
export async function standardizeServiceStyles(
  inputs: (string | null | undefined)[]
): Promise<StandardServiceStyle[]> {
  const standardized = await Promise.all(
    inputs.map(input => standardizeServiceStyle(input))
  );
  
  return standardized.filter((s): s is StandardServiceStyle => s !== null);
}

/**
 * Validate service style is standard format
 */
export function isStandardServiceStyle(input: string): input is StandardServiceStyle {
  return input === 'at_center' || input === 'at_home' || input === 'tele';
}

