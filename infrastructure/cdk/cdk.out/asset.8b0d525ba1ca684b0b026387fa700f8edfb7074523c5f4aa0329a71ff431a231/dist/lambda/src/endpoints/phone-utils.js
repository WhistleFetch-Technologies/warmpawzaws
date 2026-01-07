"use strict";
/**
 * Phone Number Utilities
 * Ensures consistent phone number handling across the entire platform
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePhone = normalizePhone;
exports.createVendorId = createVendorId;
exports.phonesMatch = phonesMatch;
exports.isValidIndianMobile = isValidIndianMobile;
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
function normalizePhone(phone) {
    if (!phone)
        return '';
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
function createVendorId(phone) {
    const normalized = normalizePhone(phone);
    return `vendor_${normalized}`;
}
/**
 * Compare two phone numbers for equality
 * Normalizes both before comparison
 */
function phonesMatch(phone1, phone2) {
    return normalizePhone(phone1) === normalizePhone(phone2);
}
/**
 * Validate if phone is a valid 10-digit Indian mobile number
 */
function isValidIndianMobile(phone) {
    const normalized = normalizePhone(phone);
    // Must be exactly 10 digits
    if (normalized.length !== 10)
        return false;
    // Must start with 6, 7, 8, or 9 (valid Indian mobile prefixes)
    if (!['6', '7', '8', '9'].includes(normalized[0]))
        return false;
    return true;
}
//# sourceMappingURL=phone-utils.js.map