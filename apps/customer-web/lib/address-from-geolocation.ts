import { Capacitor } from '@capacitor/core';
import { getGoogleMapsBrowserApiKey } from '@/lib/google-maps-browser-key';

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

export type AddressFromGeolocationResult = {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  landmark?: string;
  latitude: number;
  longitude: number;
  coordinates: { lat: number; lng: number };
};

/** Vendor-facing shape (address instead of addressLine1). */
export type VendorAddressFromGeolocationResult = Omit<
  AddressFromGeolocationResult,
  'addressLine1' | 'addressLine2'
> & {
  address?: string;
  addressLine2?: string;
};

type GeocodeComponent = {
  long_name: string;
  types: string[];
};

function parseGeocodeResult(
  latitude: number,
  longitude: number,
  result: { formatted_address?: string; address_components?: GeocodeComponent[] } | null | undefined
): AddressFromGeolocationResult {
  const base: AddressFromGeolocationResult = {
    latitude,
    longitude,
    coordinates: { lat: latitude, lng: longitude },
  };

  if (!result) {
    return {
      ...base,
      addressLine1: 'Current Location',
    };
  }

  const parsed: AddressFromGeolocationResult = {
    ...base,
    addressLine1: result.formatted_address || 'Current Location',
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

const GEO_OPTIONS = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } as const;

function rejectFromGeolocationErrorCode(
  code: number,
  reject: (reason: GeolocationAddressError) => void
): void {
  if (code === 1) {
    reject(
      new GeolocationAddressError('permission_denied', 'Please allow location access')
    );
    return;
  }
  if (code === 2) {
    reject(
      new GeolocationAddressError(
        'position_unavailable',
        'Location information unavailable'
      )
    );
    return;
  }
  if (code === 3) {
    reject(new GeolocationAddressError('timeout', 'Location request timed out'));
    return;
  }
  reject(new GeolocationAddressError('unknown', 'Could not detect location'));
}

function shouldUseCapacitorGeolocation(): boolean {
  if (typeof window === 'undefined') return false;
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Geolocation');
}

function capacitorPositionToGeolocationPosition(position: {
  timestamp: number;
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude: number | null;
    altitudeAccuracy: number | null;
    heading: number | null;
    speed: number | null;
  };
}): GeolocationPosition {
  return {
    timestamp: position.timestamp,
    coords: {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      altitudeAccuracy: position.coords.altitudeAccuracy,
      heading: position.coords.heading,
      speed: position.coords.speed,
    },
  } as GeolocationPosition;
}

function mapCapacitorGeolocationError(error: unknown): never {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (message.includes('permission') || message.includes('denied')) {
    throw new GeolocationAddressError(
      'permission_denied',
      'Please allow location access'
    );
  }
  if (message.includes('timeout')) {
    throw new GeolocationAddressError('timeout', 'Location request timed out');
  }
  if (message.includes('unavailable') || message.includes('disabled')) {
    throw new GeolocationAddressError(
      'position_unavailable',
      'Location information unavailable'
    );
  }
  throw new GeolocationAddressError('unknown', 'Could not detect location');
}

async function getCapacitorCurrentPosition(): Promise<GeolocationPosition> {
  const { Geolocation } = await import(
    /* webpackIgnore: true */ '@capacitor/geolocation'
  );

  let permissions = await Geolocation.checkPermissions();
  if (
    permissions.location === 'prompt' ||
    permissions.location === 'prompt-with-rationale'
  ) {
    permissions = await Geolocation.requestPermissions();
  }

  if (permissions.location === 'denied') {
    throw new GeolocationAddressError(
      'permission_denied',
      'Please allow location access'
    );
  }

  try {
    const position = await Geolocation.getCurrentPosition(GEO_OPTIONS);
    return capacitorPositionToGeolocationPosition(position);
  } catch (error) {
    mapCapacitorGeolocationError(error);
  }
}

function getBrowserCurrentPosition(): Promise<GeolocationPosition> {
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
      (error) => rejectFromGeolocationErrorCode(error.code, reject),
      GEO_OPTIONS
    );
  });
}

async function getCurrentPosition(): Promise<GeolocationPosition> {
  if (shouldUseCapacitorGeolocation()) {
    return getCapacitorCurrentPosition();
  }
  return getBrowserCurrentPosition();
}

/** Coords only — for permission probes (no reverse geocode). */
export async function resolveCurrentGeolocationCoords(): Promise<{
  latitude: number;
  longitude: number;
}> {
  const position = await getCurrentPosition();
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}

async function reverseGeocodeLatLng(
  latitude: number,
  longitude: number,
  fetchApiKey: () => Promise<string | null>
): Promise<AddressFromGeolocationResult> {
  const apiKey = await fetchApiKey();

  if (!apiKey) {
    return {
      latitude,
      longitude,
      coordinates: { lat: latitude, lng: longitude },
      addressLine1: 'Current Location',
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
      addressLine1: 'Current Location',
    };
  }

  return parseGeocodeResult(latitude, longitude, result);
}

/** Customer-web: resolve Google Maps key via shared helper. */
async function fetchCustomerGoogleMapsKey(): Promise<string | null> {
  return getGoogleMapsBrowserApiKey();
}

/**
 * Request browser location and reverse-geocode via Google Maps.
 * Never sets houseNo / flatNo / floor — caller must keep those user-entered.
 */
export async function fillAddressFromCurrentLocation(): Promise<AddressFromGeolocationResult> {
  const position = await getCurrentPosition();
  const { latitude, longitude } = position.coords;

  try {
    return await reverseGeocodeLatLng(latitude, longitude, fetchCustomerGoogleMapsKey);
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    return {
      latitude,
      longitude,
      coordinates: { lat: latitude, lng: longitude },
      addressLine1: 'Current Location',
    };
  }
}

/** Map customer result to vendor form field names. */
export function toVendorAddressFromGeolocation(
  result: AddressFromGeolocationResult
): VendorAddressFromGeolocationResult {
  const { addressLine1, ...rest } = result;
  return {
    ...rest,
    address: addressLine1,
  };
}

/** Fields to merge into customer address form state after geolocation detect. */
export function geolocationResultToFormFields(result: AddressFromGeolocationResult) {
  return {
    addressLine1: result.addressLine1,
    addressLine2: result.addressLine2,
    city: result.city,
    state: result.state,
    pincode: result.pincode,
    landmark: result.landmark,
    latitude: result.latitude,
    longitude: result.longitude,
    coordinates: result.coordinates,
  };
}

/** User-facing toast message after a successful detect (partial vs full geocode). */
export function geolocationSuccessMessage(result: AddressFromGeolocationResult): {
  type: 'success' | 'info';
  message: string;
} {
  const hasDetails =
    Boolean(result.city?.trim()) &&
    Boolean(result.state?.trim()) &&
    Boolean(result.pincode?.trim()) &&
    result.addressLine1 !== 'Current Location';

  if (hasDetails) {
    return { type: 'success', message: 'Location detected!' };
  }
  return {
    type: 'info',
    message: 'Location detected. Please enter address details.',
  };
}

/** Toast message for GeolocationAddressError. */
export function geolocationErrorMessage(error: unknown): string {
  if (error instanceof GeolocationAddressError) {
    return error.message;
  }
  return 'Could not detect location';
}
