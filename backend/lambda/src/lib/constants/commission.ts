/**
 * ============================================================================
 * COMMISSION CONSTANTS
 * ============================================================================
 * 
 * Centralized commission rate configuration to ensure consistency across
 * payment processing and settlement modules.
 * 
 * IMPORTANT: Any changes to commission rates should be made here only.
 * Both razorpay.ts and razorpay-settlements.ts import from this file.
 * ============================================================================
 */

/**
 * Default commission rate (percentage) when no tier is found
 * or database query fails/times out.
 * 
 * This is the platform's default commission on vendor earnings.
 */
export const DEFAULT_COMMISSION_RATE = 10.0;

/**
 * Minimum commission rate allowed
 */
export const MIN_COMMISSION_RATE = 5.0;

/**
 * Maximum commission rate allowed
 */
export const MAX_COMMISSION_RATE = 30.0;

/**
 * Commission rate tiers for reference (actual values stored in vendor_tiers table)
 */
export const COMMISSION_TIERS = {
  BRONZE: 15.0,   // Default tier for new vendors
  SILVER: 12.0,   // After meeting certain criteria
  GOLD: 10.0,     // Premium tier
  PLATINUM: 8.0,  // Top performers
} as const;
