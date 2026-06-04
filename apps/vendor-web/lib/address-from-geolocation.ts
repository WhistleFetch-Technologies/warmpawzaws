import { apiClient } from '@/lib/api-client';

export type GeolocationAddressErrorCode =
  | 'unsupported'
  | 'permission_denied'
  | 'position_unavailable'
  | 'timeout'
  | 'unknown';

export class GeolocationAddressError extends Error {
  code: GeolocationAddressErrorCode;

  constructor(code: GeolocationAddressErrorCode, message: string) {
    super(message);
    this.name = 'GeolocationAddressError';
    this.code = code;
  }
}

export type VendorAddressFromGeolocationResult = {
  address?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  landmark?: string;
  latitude: number;
  longitude: number;
  coordinates: { lat: number; lng: number };
};

type GeocodeComponent = {
  long_name: string;
  types: string[];
};

function parseGeocodeResult(
  latitude: number,
  longitude: number,
  result: { formatted_address?: string; address_components?: GeocodeComponent[] } | null | undefined
): VendorAddressFromGeolocationResult {
  const base: VendorAddressFromGeolocationResult = {
    latitude,
    longitude,
    coordinates: { lat: latitude, lng: longitude },
  };

  if (!result) {
    return { ...base, address: 'Current Location' };
  }

  const parsed: VendorAddressFromGeolocationResult = {
    ...base,
    address: result.formatted_address || 'Current Location',
  };

  result.address_components?.forEach((component) => {
    if (component.types.includes('postal_code')) {
      parsed.pincode = component.long_name;
    }
    if (component.types.includes('locality')) {
      parsed.city = component.long_name;
    }
    if (component.types.includes('administrative_area_level_2') && !parsed.city) {
      parsed.city = component.long_name;
    }
    if (component.types.includes('administrative_area_level_1')) {
      parsed.state = component.long_name;
    }
    if (
      component.types.includes('sublocality_level_1') ||
      component.types.includes('sublocality')
    ) {
      if (!parsed.addressLine2) {
        parsed.addressLine2 = component.long_name;
      }
    }
  });

  return parsed;
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(
        new GeolocationAddressError(
          'unsupported',
          'Geolocation is not supported by your browser'
        )
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(
            new GeolocationAddressError(
              'permission_denied',
              'Please allow location access'
            )
          );
          return;
        }
        if (error.code === error.POSITION_UNAVAILABLE) {
          reject(
            new GeolocationAddressError(
              'position_unavailable',
              'Location information unavailable'
            )
          );
          return;
        }
        if (error.code === error.TIMEOUT) {
          reject(
            new GeolocationAddressError('timeout', 'Location request timed out')
          );
          return;
        }
        reject(
          new GeolocationAddressError('unknown', 'Could not detect location')
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

let cachedApiKey: string | null = null;

async function fetchVendorGoogleMapsKey(): Promise<string | null> {
  if (cachedApiKey) return cachedApiKey;
  try {
    const response = await apiClient.get<{ apiKey?: string; key?: string; error?: string }>(
      '/config/google-maps-key'
    );
    const key = response?.apiKey || response?.key;
    if (key && !response?.error) {
      cachedApiKey = key;
      return cachedApiKey;
    }
  } catch {
    /* allow retry */
  }
  const envKey =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      ? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.trim()
      : '';
  if (envKey) {
    cachedApiKey = envKey;
    return cachedApiKey;
  }
  return null;
}

async function reverseGeocodeLatLng(
  latitude: number,
  longitude: number
): Promise<VendorAddressFromGeolocationResult> {
  const apiKey = await fetchVendorGoogleMapsKey();

  if (!apiKey) {
    return {
      latitude,
      longitude,
      coordinates: { lat: latitude, lng: longitude },
      address: 'Current Location',
    };
  }

  const geocodeResponse = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`
  );
  const geocodeData = (await geocodeResponse.json()) as {
    results?: Array<{
      formatted_address?: string;
      address_components?: GeocodeComponent[];
    }>;
  };

  const result = geocodeData.results?.[0];
  if (!result) {
    return {
      latitude,
      longitude,
      coordinates: { lat: latitude, lng: longitude },
      address: 'Current Location',
    };
  }

  return parseGeocodeResult(latitude, longitude, result);
}

export async function fillAddressFromCurrentLocation(): Promise<VendorAddressFromGeolocationResult> {
  const position = await getCurrentPosition();
  const { latitude, longitude } = position.coords;

  try {
    return await reverseGeocodeLatLng(latitude, longitude);
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    return {
      latitude,
      longitude,
      coordinates: { lat: latitude, lng: longitude },
      address: 'Current Location',
    };
  }
}

export function geolocationSuccessMessage(result: VendorAddressFromGeolocationResult): {
  type: 'success' | 'info';
  message: string;
} {
  const hasDetails =
    Boolean(result.city?.trim()) &&
    Boolean(result.state?.trim()) &&
    Boolean(result.pincode?.trim()) &&
    result.address !== 'Current Location';

  if (hasDetails) {
    return { type: 'success', message: 'Location detected!' };
  }
  return {
    type: 'info',
    message: 'Location detected. Please enter address details.',
  };
}

export function geolocationErrorMessage(error: unknown): string {
  if (error instanceof GeolocationAddressError) {
    return error.message;
  }
  return 'Could not detect location';
}
