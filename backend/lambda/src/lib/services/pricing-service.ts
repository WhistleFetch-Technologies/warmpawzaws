/**
 * ============================================================================
 * PRICING SERVICE - BUSINESS LOGIC LAYER
 * ============================================================================
 * 
 * Functional model for service pricing capabilities
 * Contains pure business logic for pricing operations
 * 
 * Capabilities: service_pricing
 * ============================================================================
 */

import { isValidUUID } from '../../types/entities';

export interface ServicePricingData {
  serviceId: string;
  price: number;
  duration?: number; // in minutes
  currency?: string;
}

export interface BulkPricingUpdate {
  serviceId: string;
  price: number;
  duration?: number;
}

export interface BulkPricingData {
  updates: BulkPricingUpdate[];
}

export interface PricingValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates service pricing data according to business rules
 */
export function validateServicePricing(data: ServicePricingData): PricingValidationResult {
  const errors: string[] = [];

  // Service ID validation
  if (!data.serviceId || !isValidUUID(data.serviceId)) {
    errors.push('Valid serviceId is required');
  }

  // Price validation
  if (data.price === undefined || data.price === null) {
    errors.push('Price is required');
  } else if (data.price < 0) {
    errors.push('Price cannot be negative');
  } else if (data.price > 1000000) {
    errors.push('Price exceeds maximum allowed value (1,000,000)');
  } else if (data.price < 1) {
    errors.push('Price must be at least 1');
  }

  // Duration validation
  if (data.duration !== undefined) {
    if (data.duration < 1) {
      errors.push('Duration must be at least 1 minute');
    } else if (data.duration > 1440) {
      errors.push('Duration cannot exceed 1440 minutes (24 hours)');
    }
  }

  // Currency validation
  if (data.currency && data.currency.length !== 3) {
    errors.push('Currency must be a 3-letter ISO code (e.g., INR, USD)');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates bulk pricing update data
 */
export function validateBulkPricing(data: BulkPricingData): PricingValidationResult {
  const errors: string[] = [];

  if (!data.updates || !Array.isArray(data.updates)) {
    errors.push('Updates array is required');
    return { isValid: false, errors };
  }

  if (data.updates.length === 0) {
    errors.push('At least one pricing update is required');
  }

  if (data.updates.length > 100) {
    errors.push('Maximum 100 updates allowed per bulk operation');
  }

  // Validate each update
  const serviceIds = new Set<string>();
  data.updates.forEach((update, index) => {
    if (!update.serviceId || !isValidUUID(update.serviceId)) {
      errors.push(`Update ${index + 1}: Valid serviceId is required`);
    } else {
      if (serviceIds.has(update.serviceId)) {
        errors.push(`Update ${index + 1}: Duplicate serviceId found`);
      }
      serviceIds.add(update.serviceId);
    }

    if (update.price === undefined || update.price === null) {
      errors.push(`Update ${index + 1}: Price is required`);
    } else if (update.price < 0) {
      errors.push(`Update ${index + 1}: Price cannot be negative`);
    } else if (update.price > 1000000) {
      errors.push(`Update ${index + 1}: Price exceeds maximum allowed value`);
    }

    if (update.duration !== undefined) {
      if (update.duration < 1) {
        errors.push(`Update ${index + 1}: Duration must be at least 1 minute`);
      } else if (update.duration > 1440) {
        errors.push(`Update ${index + 1}: Duration cannot exceed 1440 minutes`);
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Normalizes pricing data for database storage
 */
export function normalizePricingData(data: ServicePricingData): any {
  const normalized: any = {
    service_id: data.serviceId,
    price: Math.round(data.price * 100) / 100, // Round to 2 decimal places
  };

  if (data.duration !== undefined) {
    normalized.duration_minutes = data.duration;
  }

  if (data.currency) {
    normalized.currency = data.currency.toUpperCase();
  } else {
    normalized.currency = 'INR'; // Default currency
  }

  return normalized;
}

/**
 * Formats pricing data for API response
 */
export function formatPricingResponse(pricing: any): any {
  return {
    serviceId: pricing.service_id,
    price: pricing.price,
    duration: pricing.duration_minutes,
    currency: pricing.currency || 'INR',
    updatedAt: pricing.updated_at,
  };
}

/**
 * Calculates price with tax (business rule)
 */
export function calculatePriceWithTax(price: number, taxRate: number = 0.18): number {
  // Default GST rate: 18%
  return Math.round((price * (1 + taxRate)) * 100) / 100;
}

/**
 * Validates price change (business rule: prevent drastic changes)
 */
export function validatePriceChange(
  oldPrice: number,
  newPrice: number,
  maxChangePercent: number = 50
): PricingValidationResult {
  const errors: string[] = [];

  if (oldPrice === 0) {
    // New pricing, no validation needed
    return { isValid: true, errors: [] };
  }

  const changePercent = Math.abs((newPrice - oldPrice) / oldPrice) * 100;

  if (changePercent > maxChangePercent) {
    errors.push(
      `Price change exceeds maximum allowed (${maxChangePercent}%). ` +
      `Current change: ${changePercent.toFixed(2)}%`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Applies pricing rules based on service type
 */
export function applyPricingRules(
  price: number,
  serviceType?: string
): { finalPrice: number; warnings: string[] } {
  const warnings: string[] = [];
  let finalPrice = price;

  // Business rules based on service type
  if (serviceType === 'consultation') {
    // Consultations typically range from 200-5000 INR
    if (price < 200) {
      warnings.push('Consultation price seems low');
    }
    if (price > 5000) {
      warnings.push('Consultation price seems high');
    }
  } else if (serviceType === 'surgery') {
    // Surgeries typically range from 5000-50000 INR
    if (price < 5000) {
      warnings.push('Surgery price seems low');
    }
    if (price > 50000) {
      warnings.push('Surgery price seems high');
    }
  } else if (serviceType === 'grooming') {
    // Grooming typically ranges from 500-3000 INR
    if (price < 500) {
      warnings.push('Grooming price seems low');
    }
    if (price > 3000) {
      warnings.push('Grooming price seems high');
    }
  }

  return {
    finalPrice,
    warnings,
  };
}
