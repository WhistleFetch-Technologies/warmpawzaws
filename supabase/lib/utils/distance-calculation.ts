/**
 * ============================================================================
 * DISTANCE CALCULATION UTILITIES
 * ============================================================================
 * 
 * Distance calculation functions for geolocation-based validation
 * Uses Haversine formula for accurate distance calculation
 * 
 * Date: 2025-01-27
 * Phase 2: Task 2.2
 * ============================================================================
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface Location {
  latitude: number;
  longitude: number;
}

export interface DistanceCalculationResult {
  distanceKm: number;
  distanceMeters: number;
  distanceMiles?: number; // Optional for future use
}

export interface VendorServiceRadius {
  vendor_id: string;
  service_type: string;
  radius_km: number;
  latitude?: number;
  longitude?: number;
}

// ============================================================================
// DISTANCE CALCULATION (HAVERSINE FORMULA)
// ============================================================================

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 * 
 * @param lat1 Latitude of first point
 * @param lng1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lng2 Longitude of second point
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  // Validate inputs
  if (
    !isFinite(lat1) || !isFinite(lng1) ||
    !isFinite(lat2) || !isFinite(lng2)
  ) {
    throw new Error('Invalid coordinates provided to calculateDistance');
  }

  if (lat1 < -90 || lat1 > 90 || lat2 < -90 || lat2 > 90) {
    throw new Error('Latitude must be between -90 and 90 degrees');
  }

  if (lng1 < -180 || lng1 > 180 || lng2 < -180 || lng2 > 180) {
    throw new Error('Longitude must be between -180 and 180 degrees');
  }

  // Earth's radius in kilometers
  const R = 6371;

  // Convert degrees to radians
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  // Haversine formula
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

/**
 * Calculate distance between two Location objects
 */
export function calculateDistanceBetween(
  location1: Location,
  location2: Location
): DistanceCalculationResult {
  const distanceKm = calculateDistance(
    location1.latitude,
    location1.longitude,
    location2.latitude,
    location2.longitude
  );

  return {
    distanceKm,
    distanceMeters: distanceKm * 1000,
    distanceMiles: distanceKm * 0.621371,
  };
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// ============================================================================
// VENDOR SERVICE RADIUS VALIDATION
// ============================================================================

/**
 * Validate if customer location is within vendor's service radius
 */
export async function validateVendorServiceRadius(
  vendorLocation: Location,
  customerLocation: Location,
  maxRadiusKm: number
): Promise<{
  valid: boolean;
  distanceKm?: number;
  error?: string;
}> {
  try {
    const distanceKm = calculateDistanceBetween(vendorLocation, customerLocation).distanceKm;

    if (distanceKm > maxRadiusKm) {
      return {
        valid: false,
        distanceKm,
        error: `Customer location is ${distanceKm.toFixed(2)}km away, exceeds service radius of ${maxRadiusKm}km`,
      };
    }

    return {
      valid: true,
      distanceKm,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Failed to calculate distance',
    };
  }
}

/**
 * Get vendor's service radius for a specific service type
 * This should be called from a repository/service layer
 */
export interface ServiceRadiusConfig {
  vendor_id: string;
  service_type: string;
  default_radius_km?: number;
}

/**
 * Check if a point is within a radius from a center point
 */
export function isWithinRadius(
  centerLat: number,
  centerLng: number,
  pointLat: number,
  pointLng: number,
  radiusKm: number
): boolean {
  const distanceKm = calculateDistance(centerLat, centerLng, pointLat, pointLng);
  return distanceKm <= radiusKm;
}

/**
 * Calculate estimated travel time in minutes
 * Uses simplified calculation: 3 minutes per kilometer with 1.5x traffic factor
 * 
 * @param distanceKm Distance in kilometers
 * @param trafficFactor Traffic factor (default 1.5)
 * @returns Estimated travel time in minutes
 */
export function calculateTravelTime(
  distanceKm: number,
  trafficFactor: number = 1.5
): number {
  const baseTimePerKm = 3; // minutes per kilometer
  return Math.ceil(distanceKm * baseTimePerKm * trafficFactor);
}

/**
 * Calculate commute time between two locations
 */
export function calculateCommuteTime(
  fromLocation: Location,
  toLocation: Location,
  trafficFactor: number = 1.5
): {
  distanceKm: number;
  travelTimeMinutes: number;
} {
  const result = calculateDistanceBetween(fromLocation, toLocation);
  const travelTimeMinutes = calculateTravelTime(result.distanceKm, trafficFactor);

  return {
    distanceKm: result.distanceKm,
    travelTimeMinutes,
  };
}

// ============================================================================
// BOUNDING BOX CALCULATION (for efficient radius queries)
// ============================================================================

/**
 * Calculate bounding box for a radius search
 * Useful for SQL queries to filter results before calculating exact distance
 */
export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export function calculateBoundingBox(
  centerLat: number,
  centerLng: number,
  radiusKm: number
): BoundingBox {
  // Approximate degrees per kilometer
  const latDegreePerKm = 1 / 111; // Approximately 1 degree latitude = 111 km
  const lngDegreePerKm = 1 / (111 * Math.cos(toRadians(centerLat))); // Varies by latitude

  const latOffset = radiusKm * latDegreePerKm;
  const lngOffset = radiusKm * lngDegreePerKm;

  return {
    minLat: centerLat - latOffset,
    maxLat: centerLat + latOffset,
    minLng: centerLng - lngOffset,
    maxLng: centerLng + lngOffset,
  };
}

/**
 * Validate if a point is within a bounding box
 */
export function isWithinBoundingBox(
  pointLat: number,
  pointLng: number,
  bbox: BoundingBox
): boolean {
  return (
    pointLat >= bbox.minLat &&
    pointLat <= bbox.maxLat &&
    pointLng >= bbox.minLng &&
    pointLng <= bbox.maxLng
  );
}

// ============================================================================
// DISTANCE-BASED SORTING HELPERS
// ============================================================================

/**
 * Sort locations by distance from a reference point
 */
export function sortByDistance<T extends Location>(
  locations: T[],
  referencePoint: Location
): T[] {
  return [...locations].sort((a, b) => {
    const distA = calculateDistanceBetween(a, referencePoint).distanceKm;
    const distB = calculateDistanceBetween(b, referencePoint).distanceKm;
    return distA - distB;
  });
}

/**
 * Filter locations within radius and sort by distance
 */
export function filterAndSortByDistance<T extends Location>(
  locations: T[],
  referencePoint: Location,
  maxRadiusKm: number
): T[] {
  return locations
    .filter((loc) => {
      const distance = calculateDistanceBetween(loc, referencePoint).distanceKm;
      return distance <= maxRadiusKm;
    })
    .sort((a, b) => {
      const distA = calculateDistanceBetween(a, referencePoint).distanceKm;
      const distB = calculateDistanceBetween(b, referencePoint).distanceKm;
      return distA - distB;
    });
}

