'use client';

import { useState } from 'react';
import { MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocationContextOptional } from '@/context/LocationContext';
import { hasValidGuestHomeLocation } from '@/lib/location-storage';

/** Approximate city centers for manual fallback (not live GPS). */
const CITY_COORDS: Record<string, { lat: number; lng: number; state: string; label: string }> = {
  bangalore: { lat: 12.9716, lng: 77.5946, state: 'Karnataka', label: 'Bangalore' },
  bengaluru: { lat: 12.9716, lng: 77.5946, state: 'Karnataka', label: 'Bengaluru' },
  mumbai: { lat: 19.076, lng: 72.8777, state: 'Maharashtra', label: 'Mumbai' },
  delhi: { lat: 28.6139, lng: 77.209, state: 'Delhi', label: 'Delhi' },
  'new delhi': { lat: 28.6139, lng: 77.209, state: 'Delhi', label: 'New Delhi' },
  chennai: { lat: 13.0827, lng: 80.2707, state: 'Tamil Nadu', label: 'Chennai' },
  hyderabad: { lat: 17.385, lng: 78.4867, state: 'Telangana', label: 'Hyderabad' },
  pune: { lat: 18.5204, lng: 73.8567, state: 'Maharashtra', label: 'Pune' },
  kolkata: { lat: 22.5726, lng: 88.3639, state: 'West Bengal', label: 'Kolkata' },
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** Guest Home gate: no X / Cancel / backdrop dismiss; Back returns to the mandatory gate. */
  requiredForGuestHome?: boolean;
};

export function ManualLocationSheet({ open, onClose, requiredForGuestHome = false }: Props) {
  const location = useLocationContextOptional();
  const [city, setCity] = useState(location?.city || '');
  const [pincode, setPincode] = useState(location?.pincode || '');
  const [error, setError] = useState<string | null>(null);

  if (!open || !location) return null;

  const apply = () => {
    setError(null);
    const cityTrim = city.trim();
    const pinTrim = pincode.trim();
    if (!cityTrim && !/^\d{6}$/.test(pinTrim)) {
      setError('Enter a city name or a 6-digit pincode.');
      return;
    }
    const known = cityTrim ? CITY_COORDS[cityTrim.toLowerCase()] : undefined;
    const next = {
      city: known?.label || cityTrim || undefined,
      pincode: /^\d{6}$/.test(pinTrim) ? pinTrim : undefined,
      state: known?.state,
      latitude: known?.lat ?? null,
      longitude: known?.lng ?? null,
      source: (/^\d{6}$/.test(pinTrim) ? 'manual_pincode' : 'manual_city') as const,
    };
    if (requiredForGuestHome && !hasValidGuestHomeLocation(next)) {
      setError('Choose a city we can locate, or go back and use current location.');
      return;
    }
    location.setManualLocation(next);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      data-testid="manual-location-backdrop"
      onClick={requiredForGuestHome ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-location-title"
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
              <MapPin className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <h2 id="manual-location-title" className="text-lg font-semibold text-gray-900">
                Set your location
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Choose a city or pincode to browse nearby services. You can enable GPS later.
              </p>
            </div>
          </div>
          {requiredForGuestHome ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-2 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <label className="mb-3 block text-sm font-medium text-gray-700">
          City
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Bangalore"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-400"
          />
        </label>

        <label className="mb-4 block text-sm font-medium text-gray-700">
          Pincode (optional)
          <input
            value={pincode}
            onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="560001"
            inputMode="numeric"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-400"
          />
        </label>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          {requiredForGuestHome ? null : (
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
          )}
          <Button type="button" className="flex-1 bg-orange-500 hover:bg-orange-600" onClick={apply}>
            Use this location
          </Button>
        </div>
      </div>
    </div>
  );
}
