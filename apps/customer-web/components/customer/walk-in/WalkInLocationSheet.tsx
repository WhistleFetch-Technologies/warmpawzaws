'use client';

import { MapPin, Navigation, X } from 'lucide-react';
import type { WalkInSavedAddress } from '@/hooks/useWalkInDiscoveryLocation';

export function WalkInLocationSheet({
  open,
  onClose,
  addresses,
  selectedAddressId,
  onSelectAddress,
  onSelectCurrent,
}: {
  open: boolean;
  onClose: () => void;
  addresses: WalkInSavedAddress[];
  selectedAddressId?: string;
  onSelectAddress: (address: WalkInSavedAddress) => boolean;
  onSelectCurrent: () => Promise<boolean>;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="walk-in-location-title"
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="walk-in-location-title" className="text-base font-semibold text-slate-900">
              Discovery location
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Walk-in vendors use this location. Saved addresses override cached GPS.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close location picker"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          className="mb-3 flex w-full items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-3 py-3 text-left"
          onClick={() => {
            void onSelectCurrent().then((ok) => {
              if (ok) onClose();
            });
          }}
        >
          <Navigation className="h-4 w-4 shrink-0 text-[#FF8C42]" />
          <span className="text-sm font-medium text-slate-900">Use current location</span>
        </button>

        <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
          {addresses.map((address) => {
            const hasCoords =
              Number.isFinite(Number(address.latitude)) && Number.isFinite(Number(address.longitude));
            const selected = selectedAddressId === address.id;
            return (
              <li key={address.id}>
                <button
                  type="button"
                  disabled={!hasCoords}
                  className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left ${
                    selected ? 'border-[#FF8C42] bg-orange-50' : 'border-slate-200 bg-white'
                  } disabled:opacity-50`}
                  onClick={() => {
                    if (onSelectAddress(address)) onClose();
                  }}
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-900">
                      {address.label || 'Saved address'}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {[address.addressLine1, address.city, address.pincode].filter(Boolean).join(', ')}
                    </span>
                    {!hasCoords ? (
                      <span className="mt-1 block text-xs text-amber-600">
                        This address has no coordinates.
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
