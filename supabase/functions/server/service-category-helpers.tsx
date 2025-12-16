/**
 * SERVICE CATEGORY HELPERS
 * 
 * Determines OTP requirements and service characteristics based on category
 */

/**
 * Get OTP requirements for a service based on its category
 */
export function getOTPRequirements(service: any): {
  requiresStartOTP: boolean;
  requiresEndOTP: boolean;
  tracksDuration: boolean;
} {
  // Determine category from various sources
  const categoryId = service.categoryId || service.category || '';
  const serviceName = (service.serviceName || service.name || '').toLowerCase();
  const applicableRoles = service.applicableRoles || [];
  
  // Services that require START + END OTP (for session duration tracking)
  const startOTPCategories = ['training', 'walking', 'behavioral'];
  const startOTPRoles = ['trainer', 'walker', 'behaviourist'];
  
  // Check if category or role matches
  const categoryMatch = startOTPCategories.includes(categoryId);
  const roleMatch = applicableRoles.some((role: string) => startOTPRoles.includes(role));
  
  // Also check service name for keywords
  const nameMatch = serviceName.includes('train') || 
                    serviceName.includes('walk') || 
                    serviceName.includes('behav');
  
  const requiresStartOTP = categoryMatch || roleMatch || nameMatch;
  
  return {
    requiresStartOTP: requiresStartOTP,
    requiresEndOTP: true, // All in-person services need completion OTP
    tracksDuration: requiresStartOTP // Track duration if START OTP is required
  };
}

/**
 * Check if a service is a trainer/walker/behaviourist service
 */
export function isTrainerWalkerBehaviourist(service: any): boolean {
  const { requiresStartOTP } = getOTPRequirements(service);
  return requiresStartOTP;
}

/**
 * Get service category display name
 */
export function getServiceCategoryName(service: any): string {
  const categoryId = service.categoryId || service.category || '';
  
  const categoryNames: Record<string, string> = {
    'veterinary': 'Veterinary',
    'grooming': 'Grooming',
    'training': 'Training',
    'walking': 'Dog Walking',
    'behavioral': 'Behavioral',
    'daycare': 'Daycare',
    'boarding': 'Boarding',
    'petcare': 'Pet Care',
    'breeding': 'Breeding',
    'adoption': 'Adoption'
  };
  
  return categoryNames[categoryId] || 'Pet Service';
}

/**
 * Validate OTP format (4 digits)
 */
export function validateOTP(otp: string): boolean {
  return /^\d{4}$/.test(otp);
}

/**
 * Calculate duration between start and end times
 */
export function calculateDuration(startTime: string, endTime: string): number {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const durationMs = end.getTime() - start.getTime();
  return Math.round(durationMs / 60000); // Convert to minutes
}

/**
 * Validate if actual duration is reasonable compared to expected duration
 */
export function validateDuration(
  actualDuration: number,
  expectedDuration: number
): {
  isValid: boolean;
  warning?: string;
} {
  // Allow 50% shorter to 200% longer than expected
  const minDuration = expectedDuration * 0.5;
  const maxDuration = expectedDuration * 2;
  
  if (actualDuration < minDuration) {
    return {
      isValid: false,
      warning: `Service completed too quickly: ${actualDuration}min vs expected ${expectedDuration}min`
    };
  }
  
  if (actualDuration > maxDuration) {
    return {
      isValid: false,
      warning: `Service took too long: ${actualDuration}min vs expected ${expectedDuration}min`
    };
  }
  
  return { isValid: true };
}
