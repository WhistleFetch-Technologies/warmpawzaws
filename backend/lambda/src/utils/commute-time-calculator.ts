/**
 * ============================================================================
 * COMMUTE TIME CALCULATOR
 * ============================================================================
 * 
 * Calculates commute time between two locations using:
 * 1. Google Maps Distance Matrix API (preferred, accurate)
 * 2. Haversine formula fallback (simple distance-based estimate)
 * 
 * Used for:
 * - Staff assignment to bookings
 * - ETA calculations for home services
 * - Route optimization
 * 
 * Date: 2026-01-27
 * ============================================================================
 */

interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

interface CommuteTimeResult {
  distanceKm: number;
  durationMinutes: number;
  durationSeconds: number;
  trafficMultiplier?: number;
  method: 'google_maps' | 'haversine';
  estimatedArrival?: string; // ISO timestamp
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate commute time using Google Maps Distance Matrix API
 */
async function calculateWithGoogleMaps(
  origin: Location,
  destination: Location,
  apiKey?: string
): Promise<CommuteTimeResult | null> {
  if (!apiKey) {
    return null;
  }

  try {
    const originStr = `${origin.latitude},${origin.longitude}`;
    const destStr = `${destination.latitude},${destination.longitude}`;
    
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originStr}&destinations=${destStr}&key=${apiKey}&mode=driving&traffic_model=best_guess&departure_time=now`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.rows?.[0]?.elements?.[0]) {
      console.warn('Google Maps API error:', data.status);
      return null;
    }

    const element = data.rows[0].elements[0];
    
    if (element.status !== 'OK') {
      console.warn('Google Maps element error:', element.status);
      return null;
    }

    const distanceKm = element.distance.value / 1000; // Convert meters to km
    const durationSeconds = element.duration_in_traffic?.value || element.duration.value;
    const durationMinutes = Math.ceil(durationSeconds / 60);

    return {
      distanceKm: Math.round(distanceKm * 100) / 100,
      durationMinutes,
      durationSeconds,
      trafficMultiplier: element.duration_in_traffic 
        ? element.duration_in_traffic.value / element.duration.value 
        : 1.0,
      method: 'google_maps',
    };
  } catch (error) {
    console.error('Error calling Google Maps API:', error);
    return null;
  }
}

/**
 * Calculate commute time using Haversine formula (fallback)
 * Estimates based on distance and average speed
 */
function calculateWithHaversine(
  origin: Location,
  destination: Location,
  averageSpeedKmh: number = 30, // Default: 30 km/h for city traffic
  trafficMultiplier: number = 1.25 // 25% buffer for traffic
): CommuteTimeResult {
  const distanceKm = calculateHaversineDistance(
    origin.latitude,
    origin.longitude,
    destination.latitude,
    destination.longitude
  );

  // Calculate base time
  const baseTimeMinutes = (distanceKm / averageSpeedKmh) * 60;
  
  // Apply traffic multiplier
  const durationMinutes = Math.ceil(baseTimeMinutes * trafficMultiplier);
  const durationSeconds = durationMinutes * 60;

  return {
    distanceKm: Math.round(distanceKm * 100) / 100,
    durationMinutes,
    durationSeconds,
    trafficMultiplier,
    method: 'haversine',
  };
}

/**
 * Calculate commute time between two locations
 * 
 * @param origin - Starting location
 * @param destination - Destination location
 * @param options - Calculation options
 * @returns Commute time result
 */
export async function calculateCommuteTime(
  origin: Location,
  destination: Location,
  options: {
    googleMapsApiKey?: string;
    averageSpeedKmh?: number;
    trafficMultiplier?: number;
    departureTime?: Date; // For future bookings
  } = {}
): Promise<CommuteTimeResult> {
  // Try Google Maps first if API key is available
  if (options.googleMapsApiKey) {
    const googleResult = await calculateWithGoogleMaps(
      origin,
      destination,
      options.googleMapsApiKey
    );
    
    if (googleResult) {
      // Add estimated arrival time if departure time provided
      if (options.departureTime) {
        const arrivalTime = new Date(
          options.departureTime.getTime() + googleResult.durationSeconds * 1000
        );
        googleResult.estimatedArrival = arrivalTime.toISOString();
      }
      return googleResult;
    }
  }

  // Fallback to Haversine calculation
  const haversineResult = calculateWithHaversine(
    origin,
    destination,
    options.averageSpeedKmh || 30,
    options.trafficMultiplier || 1.25
  );

  // Add estimated arrival time if departure time provided
  if (options.departureTime) {
    const arrivalTime = new Date(
      options.departureTime.getTime() + haversineResult.durationSeconds * 1000
    );
    haversineResult.estimatedArrival = arrivalTime.toISOString();
  }

  return haversineResult;
}

/**
 * Calculate commute time for multiple destinations (route optimization)
 * Returns destinations sorted by commute time
 */
export async function calculateMultipleCommuteTimes(
  origin: Location,
  destinations: Location[],
  options: {
    googleMapsApiKey?: string;
    averageSpeedKmh?: number;
    trafficMultiplier?: number;
  } = {}
): Promise<Array<CommuteTimeResult & { destination: Location; index: number }>> {
  const results = await Promise.all(
    destinations.map(async (destination, index) => {
      const result = await calculateCommuteTime(origin, destination, options);
      return {
        ...result,
        destination,
        index,
      };
    })
  );

  // Sort by duration (shortest first)
  return results.sort((a, b) => a.durationMinutes - b.durationMinutes);
}

/**
 * Get staff location for commute calculation
 * Falls back to vendor location if staff location not available
 */
export async function getStaffLocationForCommute(
  staffId: string,
  vendorId: string
): Promise<Location | null> {
  try {
    const { select } = await import('../database/rds-connection');
    
    // Try to get staff current location
    const staff = await select('staff', { id: staffId });
    if (staff.length > 0 && staff[0].current_latitude && staff[0].current_longitude) {
      return {
        latitude: parseFloat(staff[0].current_latitude),
        longitude: parseFloat(staff[0].current_longitude),
      };
    }

    // Fallback to vendor location
    const vendors = await select('vendors', { id: vendorId });
    if (vendors.length > 0 && vendors[0].latitude && vendors[0].longitude) {
      return {
        latitude: parseFloat(vendors[0].latitude),
        longitude: parseFloat(vendors[0].longitude),
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting staff location:', error);
    return null;
  }
}

/**
 * Calculate ETA for staff arrival at customer location
 */
export async function calculateStaffETA(
  staffId: string,
  customerLocation: Location,
  bookingDateTime: Date,
  options: {
    googleMapsApiKey?: string;
    bufferMinutes?: number; // Additional buffer time
  } = {}
): Promise<CommuteTimeResult & { staffId: string; bookingId?: string }> {
  try {
    const { select } = await import('../database/rds-connection');
    
    // Get staff and vendor info
    const staff = await select('staff', { id: staffId });
    if (staff.length === 0) {
      throw new Error('Staff not found');
    }

    const vendorId = staff[0].vendor_id;
    const staffLocation = await getStaffLocationForCommute(staffId, vendorId);

    if (!staffLocation) {
      throw new Error('Staff location not available');
    }

    // Calculate commute time
    const commuteResult = await calculateCommuteTime(
      staffLocation,
      customerLocation,
      {
        googleMapsApiKey: options.googleMapsApiKey || process.env.GOOGLE_MAPS_API_KEY,
        departureTime: bookingDateTime,
      }
    );

    // Add buffer time if specified
    if (options.bufferMinutes) {
      commuteResult.durationMinutes += options.bufferMinutes;
      commuteResult.durationSeconds += options.bufferMinutes * 60;
      
      if (commuteResult.estimatedArrival) {
        const arrival = new Date(commuteResult.estimatedArrival);
        arrival.setMinutes(arrival.getMinutes() + options.bufferMinutes);
        commuteResult.estimatedArrival = arrival.toISOString();
      }
    }

    return {
      ...commuteResult,
      staffId,
    };
  } catch (error) {
    console.error('Error calculating staff ETA:', error);
    throw error;
  }
}

