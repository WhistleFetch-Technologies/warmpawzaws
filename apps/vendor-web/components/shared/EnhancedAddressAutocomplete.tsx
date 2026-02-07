'use client';

import { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export interface AddressComponents {
  street?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  landmark?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  formattedAddress?: string;
  // ✅ Direct lat/lng for backward compatibility
  lat?: number;
  lng?: number;
  placeId?: string;
}

interface EnhancedAddressAutocompleteProps {
  value: string;
  onChange: (address: string, components?: AddressComponents) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  types?: string[];
  componentRestrictions?: {
    country?: string | string[];
  };
}

export function EnhancedAddressAutocomplete({
  value,
  onChange,
  placeholder = 'Search address, landmark, city...',
  className = '',
  required = false,
  disabled = false,
  types = ['address'],
  componentRestrictions = { country: 'in' },
}: EnhancedAddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [apiKey, setApiKey] = useState<string | null>(null);

  // Fetch Google Maps API key from backend (AWS Secrets Manager)
  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const response = await apiClient.get<{ apiKey: string }>('/config/google-maps-key');
        if (response?.apiKey) {
          setApiKey(response.apiKey);
        } else {
          console.warn('Google Maps API key not available from backend');
          setIsLoading(false);
        }
      } catch (error) {
        console.warn('Failed to fetch Google Maps API key:', error);
        setIsLoading(false);
      }
    };

    fetchApiKey();
  }, []);

  // Load Google Maps script
  useEffect(() => {
    if (!apiKey) return;

    // Check if Google Maps is already loaded
    const win = window as any;
    if (win.google && win.google.maps && win.google.maps.places) {
      setIsLoaded(true);
      setIsLoading(false);
      return;
    }

    // Check if script is already being loaded
    if (document.querySelector(`script[src*="maps.googleapis.com"]`)) {
      // Wait for script to load
      const checkInterval = setInterval(() => {
        if (win.google && win.google.maps && win.google.maps.places) {
          setIsLoaded(true);
          setIsLoading(false);
          clearInterval(checkInterval);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }

    // Load Google Maps script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setIsLoaded(true);
      setIsLoading(false);
    };
    script.onerror = () => {
      console.error('Failed to load Google Maps script');
      setIsLoading(false);
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup: remove script if component unmounts
      const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`);
      if (existingScript && existingScript.parentNode) {
        existingScript.parentNode.removeChild(existingScript);
      }
    };
  }, [apiKey]);

  // Initialize autocomplete
  useEffect(() => {
    if (!isLoaded || !inputRef.current || disabled) return;

    try {
      // Create autocomplete instance
      const win = window as any;
      const autocomplete = new win.google.maps.places.Autocomplete(
        inputRef.current,
        {
          types,
          componentRestrictions,
          fields: [
            'address_components',
            'formatted_address',
            'geometry',
            'name',
            'place_id',
          ],
        }
      );

      autocompleteRef.current = autocomplete;

      // Helper: parse address_components into AddressComponents (including pincode)
      const parseAddressComponents = (addressComponents: any[] | undefined, base: Partial<AddressComponents>): AddressComponents => {
        const components: AddressComponents = { ...base };
        addressComponents?.forEach((component: any) => {
          const types = component.types;
          if (types.includes('street_number')) {
            components.street = (components.street || '') + component.long_name + ' ';
          } else if (types.includes('route')) {
            components.street = (components.street || '') + component.long_name;
          } else if (types.includes('locality') || types.includes('sublocality')) {
            components.city = component.long_name;
          } else if (types.includes('administrative_area_level_1')) {
            components.state = component.long_name;
          } else if (types.includes('postal_code')) {
            components.pincode = component.long_name;
          } else if (types.includes('country')) {
            components.country = component.long_name;
          } else if (types.includes('point_of_interest') || types.includes('establishment')) {
            components.landmark = component.long_name;
          }
        });
        return components as AddressComponents;
      };

      // Handle place selection
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place.place_id) {
          console.warn('No place_id for selected place');
          return;
        }
        const lat = place.geometry?.location?.lat?.() ?? 0;
        const lng = place.geometry?.location?.lng?.() ?? 0;
        const formattedAddress = place.formatted_address ?? '';

        const baseComponents: Partial<AddressComponents> = {
          coordinates: { lat, lng },
          formattedAddress,
          lat,
          lng,
          placeId: place.place_id,
        };

        // getPlace() often omits address_components; fetch full details by place_id when missing or when pincode not found
        const hasPincode = (comps: any[] | undefined) =>
          comps?.some((c: any) => c.types?.includes('postal_code'));
        if (place.address_components?.length && hasPincode(place.address_components)) {
          const components = parseAddressComponents(place.address_components, baseComponents);
          onChange(formattedAddress, components);
          return;
        }

        // Fetch place details to get address_components (including postal_code) when getPlace() omits them
        const placesService = new win.google.maps.places.PlacesService(document.createElement('div'));
        placesService.getDetails(
          {
            placeId: place.place_id,
            fields: ['address_components', 'formatted_address', 'geometry'],
          },
          (details: any, status: string) => {
            if (status !== win.google.maps.places.PlacesServiceStatus.OK || !details) {
              const fallback = parseAddressComponents(place.address_components, baseComponents);
              onChange(formattedAddress, fallback);
              return;
            }
            const detailLat = details.geometry?.location?.lat?.() ?? lat;
            const detailLng = details.geometry?.location?.lng?.() ?? lng;
            const fullBase: Partial<AddressComponents> = {
              ...baseComponents,
              coordinates: { lat: detailLat, lng: detailLng },
              lat: detailLat,
              lng: detailLng,
            };
            const components = parseAddressComponents(
              details.address_components ?? place.address_components,
              fullBase
            );
            onChange(details.formatted_address ?? formattedAddress, components);
          }
        );
      });

      return () => {
        if (autocompleteRef.current) {
          win.google.maps.event.clearInstanceListeners(autocompleteRef.current);
          autocompleteRef.current = null;
        }
      };
    } catch (error) {
      console.error('Error initializing Google Maps autocomplete:', error);
      setIsLoading(false);
    }
  }, [isLoaded, disabled, onChange, types, componentRestrictions]);

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={!apiKey && !isLoading ? "Enter your full address" : placeholder}
          required={required}
          disabled={disabled}
          className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:border-[#FF8C42] focus:ring-2 focus:ring-[#FF8C42]/20 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <Loader2 className="w-4 h-4 animate-spin text-[#FF8C42]" />
          </div>
        )}
        {!isLoading && apiKey && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <span className="text-xs text-gray-400">🔍</span>
          </div>
        )}
      </div>
      {!apiKey && !isLoading && (
        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
          <span className="text-amber-500">ℹ️</span>
          Type your address manually (autocomplete not available)
        </p>
      )}
    </div>
  );
}
