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
export declare function normalizePhone(phone: string): string;
/**
 * Create vendor ID from phone number
 * Always uses normalized 10-digit phone
 */
export declare function createVendorId(phone: string): string;
/**
 * Compare two phone numbers for equality
 * Normalizes both before comparison
 */
export declare function phonesMatch(phone1: string, phone2: string): boolean;
/**
 * Validate if phone is a valid 10-digit Indian mobile number
 */
export declare function isValidIndianMobile(phone: string): boolean;
//# sourceMappingURL=phone-utils.d.ts.map