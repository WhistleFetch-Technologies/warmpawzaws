'use client';

import { useEffect, useState } from 'react';
import { MapPin, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocationContextOptional } from '@/context/LocationContext';
import { isGuestLocationEnabled } from '@/lib/guest-location-flag';
import { ManualLocationSheet } from './ManualLocationSheet';

const PROMPT_DISMISSED_KEY = 'warmpawz_location_prompt_dismissed';

/**
 * One-time foreground location explanation + request.
 * Never blocks browsing; offers manual fallback on deny/unavailable.
 */
export function GuestLocationPrompt() {
  const location = useLocationContextOptional();
  const [visible, setVisible] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const permissionStatus = location?.permissionStatus;
  const latitude = location?.latitude;
  const isStale = location?.isStale;
  const source = location?.source;

  useEffect(() => {
    if (!isGuestLocationEnabled() || !location) return;
    try {
      if (sessionStorage.getItem(PROMPT_DISMISSED_KEY) === '1') return;
    } catch {
      // ignore
    }
    // Show when we still lack a usable fresh GPS fix and permission is not granted
    if (permissionStatus === 'granted' && latitude != null && !isStale) {
      return;
    }
    if (source === 'manual_city' || source === 'manual_pincode') {
      return;
    }
    setVisible(true);
  }, [location, permissionStatus, latitude, isStale, source]);

  if (!location || !visible) {
    return (
      <ManualLocationSheet open={manualOpen} onClose={() => setManualOpen(false)} />
    );
  }

  const dismiss = () => {
    try {
      sessionStorage.setItem(PROMPT_DISMISSED_KEY, '1');
    } catch {
      // ignore
    }
    setVisible(false);
  };

  const onEnable = async () => {
    setLoading(true);
    const ok = await location.requestForegroundLocation({ force: true });
    setLoading(false);
    if (ok) {
      dismiss();
      return;
    }
    // Denied / unavailable — keep sheet for manual path
    setManualOpen(true);
    dismiss();
  };

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-[70] mx-auto max-w-customer p-4 pointer-events-none">
        <div className="pointer-events-auto rounded-2xl border border-orange-100 bg-white p-4 shadow-lg">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100">
              {loading ? (
                <Loader className="h-5 w-5 animate-spin text-orange-600" />
              ) : (
                <MapPin className="h-5 w-5 text-orange-600" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">Find services near you</p>
              <p className="mt-1 text-xs text-gray-600">
                Warmpawz uses your location only while the app is open to show nearby vets, groomers,
                and more. We never track you in the background.
              </p>
              {location.error && (
                <p className="mt-2 text-xs text-red-600">{location.error}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="bg-orange-500 hover:bg-orange-600"
                  disabled={loading}
                  onClick={() => void onEnable()}
                >
                  Use current location
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={loading}
                  onClick={() => {
                    setManualOpen(true);
                    dismiss();
                  }}
                >
                  Enter manually
                </Button>
                <Button type="button" size="sm" variant="ghost" disabled={loading} onClick={dismiss}>
                  Not now
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ManualLocationSheet open={manualOpen} onClose={() => setManualOpen(false)} />
    </>
  );
}
