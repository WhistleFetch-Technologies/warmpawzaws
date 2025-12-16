/**
 * Phone Number Utilities
 * Ensures consistent phone number handling across the entire platform
 */

/**
 * Normalize phone number to 10-digit Indian mobile number
 * Removes country code, spaces, special characters
 * 
 * Examples:
 * - "+91 9876543210" -> "9876543210"
 * - "919876543210" -> "9876543210"
 * - "9876543210" -> "9876543210"
 * - "+91-987-654-3210" -> "9876543210"
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-digit characters
  let clean = phone.replace(/[^0-9]/g, '');
  
  // If starts with 91 and has 12 digits (91 + 10 digits), remove country code
  if (clean.startsWith('91') && clean.length === 12) {
    clean = clean.substring(2);
  }
  
  // If starts with 0, remove it (some people write 09876543210)
  if (clean.startsWith('0') && clean.length === 11) {
    clean = clean.substring(1);
  }
  
  return clean;
}

/**
 * Create vendor ID from phone number
 * Always uses normalized 10-digit phone
 */
export function createVendorId(phone: string): string {
  const normalized = normalizePhone(phone);
  return `vendor_${normalized}`;
}

/**
 * Compare two phone numbers for equality
 * Normalizes both before comparison
 */
export function phonesMatch(phone1: string, phone2: string): boolean {
  return normalizePhone(phone1) === normalizePhone(phone2);
}

/**
 * Validate if phone is a valid 10-digit Indian mobile number
 */
export function isValidIndianMobile(phone: string): boolean {
  const normalized = normalizePhone(phone);
  
  // Must be exactly 10 digits
  if (normalized.length !== 10) return false;
  
  // Must start with 6, 7, 8, or 9 (valid Indian mobile prefixes)
  if (!['6', '7', '8', '9'].includes(normalized[0])) return false;
  
  return true;
}
