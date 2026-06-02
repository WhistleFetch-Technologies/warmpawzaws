'use client';

import { toast } from 'sonner';
import {
  fillAddressFromCurrentLocation,
  geolocationErrorMessage,
  geolocationResultToFormFields,
  geolocationSuccessMessage,
} from '@/lib/address-from-geolocation';

type InlineAddressForm = {
  addressLine1?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number | null;
  longitude?: number | null;
  coordinates?: { lat: number; lng: number };
};

/**
 * Shared detect handler for inline AddAddressModal copies in booking routers.
 * Keeps loading state in the caller via setDetectingLocation.
 */
export async function runInlineAddressDetect<T extends InlineAddressForm>(
  setFormData: React.Dispatch<React.SetStateAction<T>>,
  options?: { onError?: (message: string) => void }
): Promise<void> {
  try {
    const result = await fillAddressFromCurrentLocation();
    setFormData((prev) => ({
      ...prev,
      ...geolocationResultToFormFields(result),
      addressLine1: result.addressLine1 ?? prev.addressLine1,
      city: result.city ?? prev.city,
      state: result.state ?? prev.state,
      pincode: result.pincode ?? prev.pincode,
    }));
    const { type, message } = geolocationSuccessMessage(result);
    if (type === 'success') {
      toast.success(message);
    } else {
      toast.info(message);
    }
  } catch (error) {
    const message = geolocationErrorMessage(error);
    if (options?.onError) {
      options.onError(message);
    } else {
      toast.error(message);
    }
  }
}

/** Coords payload for legacy `{ phone, addresses: [...] }` save. */
export function inlineAddressCoordsPayload(formData: InlineAddressForm) {
  const coords =
    formData.coordinates ??
    (formData.latitude != null &&
    formData.longitude != null &&
    Number.isFinite(formData.latitude) &&
    Number.isFinite(formData.longitude)
      ? { lat: formData.latitude, lng: formData.longitude }
      : undefined);
  return {
    coordinates: coords,
    latitude: formData.latitude ?? coords?.lat,
    longitude: formData.longitude ?? coords?.lng,
  };
}
