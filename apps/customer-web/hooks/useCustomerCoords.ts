import { useState, useEffect, useRef } from 'react';
import { resolveCustomerDiscoveryCoords } from '@/lib/customer-discovery-coords';

export interface CustomerCoords {
  latitude: string | null;
  longitude: string | null;
  /** URL query suffix ready to append: "&latitude=...&longitude=..." or "" */
  locationParams: string;
}

/**
 * Resolves the customer's coordinates on mount.
 * Resolution order (see resolveCustomerDiscoveryCoords):
 *   1. Customer profile API (uses phone to fetch default address)
 *   2. localStorage (already cached from a previous resolution)
 *   3. Browser geolocation
 * Successful results are written back to localStorage so all other components
 * that only read localStorage will find them on subsequent renders.
 */
export function useCustomerCoords(phone?: string): CustomerCoords {
  const [coords, setCoords] = useState<CustomerCoords>(() => {
    // Synchronous initial read from localStorage so first render already has
    // coords if they were cached by a previous session.
    if (typeof window === 'undefined') return { latitude: null, longitude: null, locationParams: '' };
    try {
      const lat = localStorage.getItem('customer_latitude');
      const lng = localStorage.getItem('customer_longitude');
      if (lat && lng) {
        return {
          latitude: lat,
          longitude: lng,
          locationParams: `&latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}`,
        };
      }
    } catch { /* ignore */ }
    return { latitude: null, longitude: null, locationParams: '' };
  });

  const resolvedRef = useRef(false);

  useEffect(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;

    resolveCustomerDiscoveryCoords(phone).then(({ latitude, longitude }) => {
      if (latitude && longitude) {
        setCoords({
          latitude,
          longitude,
          locationParams: `&latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`,
        });
      }
    });
  }, [phone]);

  return coords;
}
