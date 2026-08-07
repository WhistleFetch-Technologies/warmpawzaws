'use client';

import { useState, useCallback } from 'react';
import { Navigation, Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import {
  fillAddressFromCurrentLocation,
  geolocationErrorMessage,
  geolocationSuccessMessage,
  type AddressFromGeolocationResult,
} from '@/lib/address-from-geolocation';

type UseCurrentLocationButtonProps = {
  onSuccess: (result: AddressFromGeolocationResult) => void;
  /** Default: dashed orange (AddAddressModal style) */
  variant?: 'dashed' | 'solid' | 'blue';
  label?: string;
  loadingLabel?: string;
  className?: string;
  disabled?: boolean;
};

export function UseCurrentLocationButton({
  onSuccess,
  variant = 'dashed',
  label = 'Use Current Location',
  loadingLabel = 'Detecting...',
  className = '',
  disabled = false,
}: UseCurrentLocationButtonProps) {
  const [detecting, setDetecting] = useState(false);

  const handleClick = useCallback(async () => {
    setDetecting(true);
    try {
      const result = await fillAddressFromCurrentLocation();
      onSuccess(result);
      const { type, message } = geolocationSuccessMessage(result);
      if (type === 'success') {
        toast.success(message);
      } else {
        toast.info(message);
      }
    } catch (error) {
      toast.error(geolocationErrorMessage(error));
    } finally {
      setDetecting(false);
    }
  }, [onSuccess]);

  const variantClasses =
    variant === 'solid'
      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0 shadow-md'
      : variant === 'blue'
        ? 'bg-blue-50 text-blue-600 border border-blue-100 text-xs py-2'
        : 'border-2 border-dashed border-[#FF8C42] text-[#FF8C42] hover:bg-orange-50';

  const Icon = variant === 'solid' ? MapPin : Navigation;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || detecting}
      className={`w-full py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all ${variantClasses} ${className}`}
    >
      {detecting ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>{loadingLabel}</span>
        </>
      ) : (
        <>
          <Icon className="w-5 h-5" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
