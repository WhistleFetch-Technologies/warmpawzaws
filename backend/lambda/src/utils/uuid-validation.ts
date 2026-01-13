/**
 * ============================================================================
 * UUID Validation Helper
 * ============================================================================
 * 
 * Helper functions to validate UUIDs and handle test IDs gracefully
 * 
 * Date: 2026-01-12
 * ============================================================================
 */

/**
 * Check if a string is a valid UUID
 */
export function isValidUUID(str: string): boolean {
  if (!str || typeof str !== 'string') {
    return false;
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Check if an ID is a test ID (not a valid UUID)
 */
export function isTestID(id: string): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }
  
  // Common test IDs
  const testIDs = [
    'test-vendor-id',
    'test-staff-id',
    'test-package-id',
    'test-booking-id',
    'test-customer-id',
    'test-order-id',
    'test-product-id',
  ];
  
  return testIDs.includes(id) || !isValidUUID(id);
}

/**
 * Validate UUID and return error response if invalid (for test IDs, return empty result)
 */
export function validateUUIDOrReturnEmpty(id: string, emptyResult: any): { isValid: boolean; result?: any } {
  if (isTestID(id)) {
    return { isValid: false, result: emptyResult };
  }
  return { isValid: true };
}
