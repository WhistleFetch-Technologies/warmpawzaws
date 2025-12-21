/**
 * Location Services Utility
 * Handles location access and geocoding
 * Requires expo-location package
 */

import { Alert, Platform } from 'react-native';
// import * as Location from 'expo-location';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface LocationAddress {
  address: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

export async function requestLocationPermission(): Promise<boolean> {
  // TODO: Implement when expo-location is installed
  // const { status } = await Location.requestForegroundPermissionsAsync();
  // return status === 'granted';
  return false;
}

export async function getCurrentLocation(): Promise<LocationCoordinates | null> {
  // TODO: Implement when expo-location is installed
  Alert.alert(
    'Location Services',
    'expo-location package is required. Please install it: npm install expo-location',
    [{ text: 'OK' }]
  );
  return null;
  
  // try {
  //   const hasPermission = await requestLocationPermission();
  //   if (!hasPermission) {
  //     Alert.alert('Permission Required', 'Please grant location permission');
  //     return null;
  //   }

  //   const location = await Location.getCurrentPositionAsync({
  //     accuracy: Location.Accuracy.Balanced,
  //   });

  //   return {
  //     latitude: location.coords.latitude,
  //     longitude: location.coords.longitude,
  //   };
  // } catch (error) {
  //   console.error('Error getting location:', error);
  //   Alert.alert('Error', 'Failed to get location');
  //   return null;
  // }
}

export async function reverseGeocode(
  coordinates: LocationCoordinates
): Promise<LocationAddress | null> {
  // TODO: Implement when expo-location is installed
  return null;
  
  // try {
  //   const addresses = await Location.reverseGeocodeAsync(coordinates);
  //   if (addresses.length > 0) {
  //     const addr = addresses[0];
  //     return {
  //       address: `${addr.street || ''} ${addr.streetNumber || ''}`.trim(),
  //       city: addr.city || '',
  //       state: addr.region || '',
  //       pincode: addr.postalCode || '',
  //       country: addr.country || '',
  //     };
  //   }
  //   return null;
  // } catch (error) {
  //   console.error('Error reverse geocoding:', error);
  //   return null;
  // }
}

