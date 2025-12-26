/**
 * ============================================================================
 * DISTANCE VALIDATION RULE
 * ============================================================================
 * 
 * Business rule for validating distance/radius for home services
 * Integrates with Business Rules Engine
 * 
 * Date: 2025-01-27
 * Phase 2: Task 2.2
 * ============================================================================
 */

import { createRule, type ValidationContext, type ValidationResult } from '../business-rules-engine.ts';
import { calculateDistance, validateVendorServiceRadius } from '../../utils/distance-calculation.ts';
import { getSchedulingRepository } from '../../repositories/scheduling.ts';
import { getVendorsRepository } from '../../repositories/vendors.ts';
import { getStaffRepository } from '../../repositories/staff.ts';

/**
 * Distance validation rule for booking context
 */
export function createDistanceValidationRule() {
  return createRule(
    'distance_validation',
    async (context: ValidationContext): Promise<ValidationResult> => {
      // Only validate for home services
      if (context.booking?.service_type !== 'at_home') {
        return { valid: true };
      }

      // Need customer location and staff/vendor location
      if (
        !context.booking.latitude ||
        !context.booking.longitude ||
        !context.booking.vendor_id
      ) {
        return {
          valid: false,
          message: 'Customer location and vendor ID are required for home services',
          error_code: 'MISSING_LOCATION_DATA',
        };
      }

      const customerLocation = {
        latitude: context.booking.latitude,
        longitude: context.booking.longitude,
      };

      try {
        const schedulingRepo = getSchedulingRepository();
        const vendorsRepo = getVendorsRepository();

        // Get vendor location
        const vendor = await vendorsRepo.findById(context.booking.vendor_id);
        if (!vendor || !vendor.latitude || !vendor.longitude) {
          return {
            valid: false,
            message: 'Vendor location not available',
            error_code: 'VENDOR_LOCATION_NOT_FOUND',
          };
        }

        const vendorLocation = {
          latitude: vendor.latitude,
          longitude: vendor.longitude,
        };

        // If staff_id is provided, check staff location instead
        let serviceLocation = vendorLocation;
        if (context.booking.staff_id) {
          const staffRepo = getStaffRepository();
          const staff = await staffRepo.findById(context.booking.staff_id);
          
          if (staff && staff.latitude && staff.longitude) {
            serviceLocation = {
              latitude: staff.latitude,
              longitude: staff.longitude,
            };
          }
          // If staff location not available, fall back to vendor location
        }

        // Get service radius from scheduling policy
        const policy = await schedulingRepo.getPolicy('commute_time');
        const maxRadiusKm = policy?.maxTravelDistance || 50; // Default 50km

        // Validate distance
        const validation = await validateVendorServiceRadius(
          serviceLocation,
          customerLocation,
          maxRadiusKm
        );

        if (!validation.valid) {
          return {
            valid: false,
            message: validation.error || 'Distance validation failed',
            error_code: 'DISTANCE_EXCEEDS_RADIUS',
            metadata: {
              distance_km: validation.distanceKm,
              max_radius_km: maxRadiusKm,
              service_location: serviceLocation,
              customer_location: customerLocation,
            },
          };
        }

        return {
          valid: true,
          metadata: {
            distance_km: validation.distanceKm,
            max_radius_km: maxRadiusKm,
          },
        };
      } catch (error) {
        console.error('[DISTANCE_VALIDATION] Error:', error);
        return {
          valid: false,
          message: error instanceof Error ? error.message : 'Failed to validate distance',
          error_code: 'DISTANCE_VALIDATION_ERROR',
          metadata: { error: String(error) },
        };
      }
    },
    {
      priority: 100, // High priority - should be checked early
      description: 'Validates that customer location is within vendor/staff service radius for home services',
      enabled: true,
    }
  );
}

/**
 * Distance validation rule for distance context (standalone validation)
 */
export function createDistanceValidationRuleForDistanceContext() {
  return createRule(
    'distance_validation_standalone',
    async (context: ValidationContext): Promise<ValidationResult> => {
      // Validate distance context
      if (!context.distance) {
        return { valid: true }; // Skip if no distance context
      }

      const { staff_id, customer_lat, customer_lng, vendor_id, max_distance_km } = context.distance;

      if (!customer_lat || !customer_lng) {
        return {
          valid: false,
          message: 'Customer location is required',
          error_code: 'MISSING_CUSTOMER_LOCATION',
        };
      }

      const customerLocation = {
        latitude: customer_lat,
        longitude: customer_lng,
      };

      try {
        let serviceLocation: { latitude: number; longitude: number } | null = null;

        // Get staff location if staff_id provided
        if (staff_id) {
          const staffRepo = getStaffRepository();
          const staff = await staffRepo.findById(staff_id);
          if (staff && staff.latitude && staff.longitude) {
            serviceLocation = {
              latitude: staff.latitude,
              longitude: staff.longitude,
            };
          }
        }

        // Fall back to vendor location
        if (!serviceLocation && vendor_id) {
          const vendorsRepo = getVendorsRepository();
          const vendor = await vendorsRepo.findById(vendor_id);
          if (vendor && vendor.latitude && vendor.longitude) {
            serviceLocation = {
              latitude: vendor.latitude,
              longitude: vendor.longitude,
            };
          }
        }

        if (!serviceLocation) {
          return {
            valid: false,
            message: 'Service provider location not available',
            error_code: 'SERVICE_LOCATION_NOT_FOUND',
          };
        }

        // Use provided max_distance or get from policy
        let maxRadiusKm = max_distance_km;
        if (!maxRadiusKm) {
          const schedulingRepo = getSchedulingRepository();
          const policy = await schedulingRepo.getPolicy('commute_time');
          maxRadiusKm = policy?.maxTravelDistance || 50;
        }

        // Validate distance
        const validation = await validateVendorServiceRadius(
          serviceLocation,
          customerLocation,
          maxRadiusKm
        );

        if (!validation.valid) {
          return {
            valid: false,
            message: validation.error || 'Distance validation failed',
            error_code: 'DISTANCE_EXCEEDS_RADIUS',
            metadata: {
              distance_km: validation.distanceKm,
              max_radius_km: maxRadiusKm,
              service_location: serviceLocation,
              customer_location: customerLocation,
            },
          };
        }

        return {
          valid: true,
          metadata: {
            distance_km: validation.distanceKm,
            max_radius_km: maxRadiusKm,
          },
        };
      } catch (error) {
        console.error('[DISTANCE_VALIDATION] Error:', error);
        return {
          valid: false,
          message: error instanceof Error ? error.message : 'Failed to validate distance',
          error_code: 'DISTANCE_VALIDATION_ERROR',
          metadata: { error: String(error) },
        };
      }
    },
    {
      priority: 100,
      description: 'Validates distance for standalone distance validation requests',
      enabled: true,
    }
  );
}

