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
    estimatedArrival?: string;
}
/**
 * Calculate commute time between two locations
 *
 * @param origin - Starting location
 * @param destination - Destination location
 * @param options - Calculation options
 * @returns Commute time result
 */
export declare function calculateCommuteTime(origin: Location, destination: Location, options?: {
    googleMapsApiKey?: string;
    averageSpeedKmh?: number;
    trafficMultiplier?: number;
    departureTime?: Date;
}): Promise<CommuteTimeResult>;
/**
 * Calculate commute time for multiple destinations (route optimization)
 * Returns destinations sorted by commute time
 */
export declare function calculateMultipleCommuteTimes(origin: Location, destinations: Location[], options?: {
    googleMapsApiKey?: string;
    averageSpeedKmh?: number;
    trafficMultiplier?: number;
}): Promise<Array<CommuteTimeResult & {
    destination: Location;
    index: number;
}>>;
/**
 * Get staff location for commute calculation
 * Falls back to vendor location if staff location not available
 */
export declare function getStaffLocationForCommute(staffId: string, vendorId: string): Promise<Location | null>;
/**
 * Calculate ETA for staff arrival at customer location
 */
export declare function calculateStaffETA(staffId: string, customerLocation: Location, bookingDateTime: Date, options?: {
    googleMapsApiKey?: string;
    bufferMinutes?: number;
}): Promise<CommuteTimeResult & {
    staffId: string;
    bookingId?: string;
}>;
export {};
//# sourceMappingURL=commute-time-calculator.d.ts.map