/**
 * Shared empty-state CTA: detect current location (Capacitor-aware via LocationContext)
 * or open manual city/pincode sheet. Used by discovery lists when lat/lng are missing.
 */

'use client';

import { useCallback, useState } from 'react';
import { MapPin, Loader2, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLocationContextOptional } from '@/context/LocationContext';
import { ManualLocationSheet } from '@/components/customer/ManualLocationSheet';
import { LOCATION_UPDATED_EVENT } from '@/lib/customer-discovery-coords';

type Props = {
  title?: string;
  description?: string;
  className?: string;
  /** Called after coords are persisted (detect or manual). */
  onLocationReady?: () => void;
};

export function DiscoveryLocationRequired({
  title = 'Set your location',
  description = 'Detect your current location to see nearby vets, groomers, walkers, and more.',
  className = '',
  onLocationReady,
}: Props) {
  const location = useLocationContextOptional();
  const [loading, setLoading] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const notifyReady = useCallback(() => {
    try {
      window.dispatchEvent(new CustomEvent(LOCATION_UPDATED_EVENT));
    } catch {
      /* ignore */
    }
    onLocationReady?.();
  }, [onLocationReady]);

  const onDetect = useCallback(async () => {
    if (!location) {
      toast.error('Location is unavailable. Enter a city or pincode instead.');
      setManualOpen(true);
      return;
    }
    setLoading(true);
    try {
      const ok = await location.requestForegroundLocation({ force: true });
      if (ok) {
        toast.success('Location updated');
        notifyReady();
        return;
      }
      toast.info('Could not detect GPS. Enter a city or pincode.');
      setManualOpen(true);
    } finally {
      setLoading(false);
    }
  }, [location, notifyReady]);

  return (
    <>
      <Card className={`p-8 text-center bg-white border border-gray-100 ${className}`.trim()}>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-50">
          <MapPin className="h-8 w-8 text-[#FF8C42]" aria-hidden />
        </div>
        <h3 className="mb-2 font-semibold text-gray-900">{title}</h3>
        <p className="mb-5 text-sm text-gray-500">{description}</p>
        <div className="mx-auto flex max-w-xs flex-col gap-2">
          <Button
            type="button"
            className="bg-[#FF8C42] hover:bg-[#FF7029] text-white"
            disabled={loading}
            onClick={() => void onDetect()}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Detecting…
              </>
            ) : (
              <>
                <Navigation className="mr-2 h-4 w-4" />
                Detect current location
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-[#FF8C42] text-[#FF8C42] hover:bg-orange-50"
            disabled={loading}
            onClick={() => setManualOpen(true)}
          >
            Enter city or pincode
          </Button>
        </div>
      </Card>
      <ManualLocationSheet
        open={manualOpen}
        onClose={() => {
          setManualOpen(false);
          if (location?.latitude != null && location?.longitude != null) {
            notifyReady();
          }
        }}
      />
    </>
  );
}
