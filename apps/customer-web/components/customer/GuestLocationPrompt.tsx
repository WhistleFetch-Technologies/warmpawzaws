'use client';

import { useState, type ReactNode } from 'react';
import { MapPin, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocationContextOptional } from '@/context/LocationContext';
import { hasAuthenticatedCustomerSession } from '@/lib/guest-auth-gate';
import { hasValidGuestHomeLocation } from '@/lib/guest-home-location-gate';
import { ManualLocationSheet } from './ManualLocationSheet';

const LEGACY_PROMPT_DISMISSED_KEY = 'warmpawz_location_prompt_dismissed';

function clearLegacyPromptDismiss(): void {
  try {
    sessionStorage.removeItem(LEGACY_PROMPT_DISMISSED_KEY);
  } catch {
    // ignore
  }
}

/**
 * Mandatory Guest Customer Home location gate.
 * Two actions only; GPS failure stays on this modal. Not used app-wide.
 */
export function GuestLocationPrompt() {
  const location = useLocationContextOptional();
  const [manualOpen, setManualOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!location) return null;

  const onEnable = async () => {
    setLoading(true);
    location.clearLocationError();
    const ok = await location.requestForegroundLocation({ force: true });
    setLoading(false);
    if (ok) {
      clearLegacyPromptDismiss();
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
        data-testid="guest-home-location-backdrop"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="guest-home-location-title"
          className="w-full max-w-md rounded-2xl border border-orange-100 bg-white p-6 shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
            {loading ? (
              <Loader className="h-6 w-6 animate-spin text-orange-600" />
            ) : (
              <MapPin className="h-6 w-6 text-orange-600" />
            )}
          </div>
          <h2
            id="guest-home-location-title"
            className="text-center text-lg font-semibold text-gray-900"
          >
            Choose your location
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Warmpawz uses your location while the app is open to show nearby services. We never
            track you in the background.
          </p>
          {location.error && (
            <p className="mt-3 text-center text-xs text-red-600">{location.error}</p>
          )}
          <div className="mt-5 flex flex-col gap-2">
            <Button
              type="button"
              className="w-full bg-orange-500 hover:bg-orange-600"
              disabled={loading}
              onClick={() => void onEnable()}
            >
              Use Current Location
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={loading}
              onClick={() => setManualOpen(true)}
            >
              Enter Manually
            </Button>
          </div>
        </div>
      </div>
      <ManualLocationSheet
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        requiredForGuestHome
      />
    </>
  );
}

function GuestHomeLocationHydratingShell() {
  return (
    <div
      className="flex min-h-[50vh] items-center justify-center"
      data-testid="guest-home-location-hydrating"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-orange-500" />
    </div>
  );
}

/**
 * Guest Home only: do not mount Home content until location is hydrated and valid.
 * Authenticated Home always renders children. Other routes must not use this host.
 */
export function GuestHomeLocationGateHost({
  isGuest,
  children,
}: {
  isGuest: boolean;
  children: ReactNode;
}) {
  const location = useLocationContextOptional();
  const isAuthenticated = hasAuthenticatedCustomerSession();
  const validLocation = hasValidGuestHomeLocation(location);

  // Authenticated Customer Home is never trapped by this Guest gate.
  if (!isGuest || isAuthenticated) {
    return <>{children}</>;
  }

  if (location?.hydrated !== true) {
    return <GuestHomeLocationHydratingShell />;
  }

  if (!validLocation) {
    return <GuestLocationPrompt />;
  }

  return <>{children}</>;
}
