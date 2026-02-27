/**
 * Validation utilities for customer data
 */

/**
 * Validates email address using RFC-compliant regex
 * Rejects invalid TLDs (minimum 2 characters, alphabetic only)
 * @param email - Email address to validate
 * @returns true if email is valid, false otherwise
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  
  // RFC-compliant email regex with strict TLD validation
  // - Local part: allows alphanumeric, dots, and special chars
  // - Domain: allows alphanumeric and hyphens
  // - TLD: minimum 2 alphabetic characters only
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})+$/;
  
  return emailRegex.test(email.trim());
}

/**
 * Validates phone number - exactly 10 digits, numeric only
 * @param phone - Phone number to validate
 * @returns true if phone is valid, false otherwise
 */
export function validatePhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Must be exactly 10 digits
  return cleaned.length === 10 && /^\d{10}$/.test(cleaned);
}

/**
 * Cleans phone number to exactly 10 digits
 * @param phone - Phone number to clean
 * @returns cleaned phone number (10 digits) or empty string if invalid
 */
export function cleanPhone(phone: string): string {
  if (!phone || typeof phone !== 'string') return '';
  
  const cleaned = phone.replace(/\D/g, '');
  
  // If longer than 10, take last 10 digits
  if (cleaned.length > 10) {
    return cleaned.slice(-10);
  }
  
  // If exactly 10, return as-is
  if (cleaned.length === 10) {
    return cleaned;
  }
  
  // If less than 10, return empty (invalid)
  return '';
}

/**
 * Safely converts a value to a number, returning fallback if conversion fails or result is NaN
 * @param val - Value to convert
 * @param fallback - Fallback value if conversion fails (default: 0)
 * @returns Valid number or fallback
 */
export function safeNumber(val: any, fallback: number = 0): number {
  if (val === null || val === undefined || val === '') return fallback;
  const num = Number(val);
  return isNaN(num) ? fallback : num;
}
