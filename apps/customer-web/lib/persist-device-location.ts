import { apiClient } from '@/lib/api-client';

const MIN_INTERVAL_MS = 60_000;
let lastSentAt = 0;
let lastKey = '';

function readCustomerPhone(): string {
  if (typeof window === 'undefined') return '';
  const raw =
    localStorage.getItem('customerPhone') ||
    localStorage.getItem('customer_phone') ||
    '';
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : '';
}

/** Fill empty profile city/coords from the device location. Does not overwrite a completed profile. */
export function persistDeviceLocationToProfile(loc: {
  latitude: number | null;
  longitude: number | null;
  city?: string;
  locality?: string;
  state?: string;
  pincode?: string;
}): void {
  const phone = readCustomerPhone();
  if (!phone || loc.latitude == null || loc.longitude == null) return;
  const key = `${phone}:${loc.latitude.toFixed(4)}:${loc.longitude.toFixed(4)}`;
  const now = Date.now();
  if (key === lastKey && now - lastSentAt < MIN_INTERVAL_MS) return;
  lastKey = key;
  lastSentAt = now;
  void apiClient
    .post('/customer/profile', {
      phone,
      locationSource: 'device',
      latitude: loc.latitude,
      longitude: loc.longitude,
      city: loc.city || loc.locality,
      state: loc.state,
      pincode: loc.pincode,
    })
    .catch(() => {
      /* non-blocking */
    });
}
