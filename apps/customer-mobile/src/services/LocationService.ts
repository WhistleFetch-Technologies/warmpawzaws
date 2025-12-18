/**
 * Location Service - Customer Mobile App
 * Real-time GPS tracking for home services
 * Handles location updates, route calculation, and ETA
 */

import Geolocation from '@react-native-community/geolocation';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { Platform } from 'react-native';

export interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

export interface RouteInfo {
  distance: number; // in kilometers
  duration: number; // in minutes
  polyline?: string; // encoded polyline for map display
}

export interface LocationUpdate {
  bookingId: string;
  staffId: string;
  location: Location;
  timestamp: string;
  status: 'en_route' | 'arrived' | 'completed';
}

class LocationService {
  private watchId: number | null = null;
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private isTracking = false;
  private currentLocation: Location | null = null;
  private onLocationUpdateCallback: ((location: Location) => void) | null = null;

  /**
   * Request location permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const permission = Platform.OS === 'ios'
        ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
        : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

      const result = await request(permission);
      return result === RESULTS.GRANTED;
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return false;
    }
  }

  /**
   * Get current location
   */
  async getCurrentLocation(): Promise<Location | null> {
    return new Promise((resolve) => {
      Geolocation.getCurrentPosition(
        (position) => {
          const location: Location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy || undefined,
            timestamp: position.timestamp,
          };
          this.currentLocation = location;
          resolve(location);
        },
        (error) => {
          console.error('Error getting current location:', error);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
        }
      );
    });
  }

  /**
   * Start watching location updates
   */
  startWatchingLocation(
    onUpdate: (location: Location) => void,
    options?: {
      enableHighAccuracy?: boolean;
      distanceFilter?: number; // meters
      interval?: number; // milliseconds
    }
  ): void {
    if (this.watchId !== null) {
      this.stopWatchingLocation();
    }

    this.onLocationUpdateCallback = onUpdate;

    const watchOptions = {
      enableHighAccuracy: options?.enableHighAccuracy ?? true,
      distanceFilter: options?.distanceFilter ?? 10, // 10 meters
      timeout: 15000,
      maximumAge: 10000,
    };

    this.watchId = Geolocation.watchPosition(
      (position) => {
        const location: Location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy || undefined,
          timestamp: position.timestamp,
        };
        this.currentLocation = location;
        if (this.onLocationUpdateCallback) {
          this.onLocationUpdateCallback(location);
        }
      },
      (error) => {
        console.error('Error watching location:', error);
      },
      watchOptions
    );

    this.isTracking = true;
  }

  /**
   * Stop watching location updates
   */
  stopWatchingLocation(): void {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.updateInterval !== null) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.isTracking = false;
    this.onLocationUpdateCallback = null;
  }

  /**
   * Calculate distance between two locations (Haversine formula)
   */
  calculateDistance(loc1: Location, loc2: Location): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRad(loc2.latitude - loc1.latitude);
    const dLon = this.toRad(loc2.longitude - loc1.longitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(loc1.latitude)) *
        Math.cos(this.toRad(loc2.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calculate ETA based on distance and average speed
   */
  calculateETA(distance: number, averageSpeed: number = 30): number {
    // distance in km, averageSpeed in km/h
    // Returns ETA in minutes
    return Math.round((distance / averageSpeed) * 60);
  }

  /**
   * Start sending location updates to server
   */
  startLocationUpdates(
    bookingId: string,
    staffId: string,
    updateInterval: number = 30000 // 30 seconds
  ): void {
    if (this.updateInterval !== null) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(async () => {
      const location = await this.getCurrentLocation();
      if (location) {
        await this.sendLocationUpdate(bookingId, staffId, location);
      }
    }, updateInterval);
  }

  /**
   * Stop sending location updates
   */
  stopLocationUpdates(): void {
    if (this.updateInterval !== null) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Send location update to server
   */
  private async sendLocationUpdate(
    bookingId: string,
    staffId: string,
    location: Location
  ): Promise<void> {
    try {
      const { projectId, publicAnonKey, API_BASE_URL } = require('../config/api');
      
      await fetch(
        `${API_BASE_URL}/vendor/location/update`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            bookingId,
            staffId,
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
            timestamp: new Date().toISOString(),
          }),
        }
      );
    } catch (error) {
      console.error('Error sending location update:', error);
    }
  }

  /**
   * Get staff location for a booking
   */
  async getStaffLocation(bookingId: string): Promise<LocationUpdate | null> {
    try {
      const { API_BASE_URL, publicAnonKey } = require('../config/api');
      
      const response = await fetch(
        `${API_BASE_URL}/customer/location/track/${encodeURIComponent(bookingId)}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.location || null;
      }
      return null;
    } catch (error) {
      console.error('Error getting staff location:', error);
      return null;
    }
  }

  /**
   * Convert degrees to radians
   */
  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get current location if available
   */
  getCurrentLocationSync(): Location | null {
    return this.currentLocation;
  }

  /**
   * Check if currently tracking
   */
  isCurrentlyTracking(): boolean {
    return this.isTracking;
  }
}

export default new LocationService();

