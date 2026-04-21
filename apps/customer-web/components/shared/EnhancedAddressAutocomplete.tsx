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

/** Stable defaults — avoid new [] / {} each render when callers omit these props. */
const DEFAULT_AUTOCOMPLETE_TYPES: string[] = ['geocode', 'establishment'];
const DEFAULT_COMPONENT_RESTRICTIONS: NonNullable<
  EnhancedAddressAutocompleteProps['componentRestrictions']
> = Object.freeze({ country: 'in' });

export function EnhancedAddressAutocomplete({
  value,
  onChange,
  placeholder = 'Search address, landmark, city...',
  className = '',
  required = false,
  disabled = false,
  types: typesProp,
  componentRestrictions: componentRestrictionsProp,
}: EnhancedAddressAutocompleteProps) {
  const types = typesProp ?? DEFAULT_AUTOCOMPLETE_TYPES;
  const componentRestrictions =
    componentRestrictionsProp ?? DEFAULT_COMPONENT_RESTRICTIONS;
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const autocompleteRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [apiKey, setApiKey] = useState<string | null>(null);

  // Keep onChange ref up to date
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Fetch Google Maps API key from backend (AWS Secrets Manager)
  useEffect(() => {
    const fetchApiKey = async () => {
      console.log('[ADDRESS-AUTOCOMPLETE] Fetching Google Maps API key from backend...');
      // Set timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        console.warn('[ADDRESS-AUTOCOMPLETE] Google Maps API key fetch timeout - disabling autocomplete');
        setIsLoading(false);
      }, 10000); // 10 second timeout

      try {
        const response = await apiClient.get<{ apiKey: string; error?: string }>('/config/google-maps-key');
        clearTimeout(timeoutId);
        if (response?.error) {
          console.error('[ADDRESS-AUTOCOMPLETE] Backend returned error:', response.error);
          setIsLoading(false);
          return;
        }
        if (response?.apiKey) {
          console.log('[ADDRESS-AUTOCOMPLETE] Google Maps API key fetched successfully, length:', response.apiKey.length);
          setApiKey(response.apiKey);
        } else {
          console.warn('[ADDRESS-AUTOCOMPLETE] Google Maps API key not available from backend');
          setIsLoading(false);
        }
      } catch (error: any) {
        clearTimeout(timeoutId);
        console.error('[ADDRESS-AUTOCOMPLETE] Failed to fetch Google Maps API key:', error?.message || error);
        setIsLoading(false);
      }
    };

    fetchApiKey();
  }, []);

  // Load Google Maps script
  useEffect(() => {
    if (!apiKey) {
      console.log('[ADDRESS-AUTOCOMPLETE] No API key available, skipping script load');
      return;
    }

    console.log('[ADDRESS-AUTOCOMPLETE] Loading Google Maps script...');
    // Check if Google Maps is already loaded
    const win = window as any;
    if (win.google && win.google.maps && win.google.maps.places) {
      console.log('[ADDRESS-AUTOCOMPLETE] Google Maps already loaded');
      setIsLoaded(true);
      setIsLoading(false);
      return;
    }

    // Check if script is already being loaded
    if (document.querySelector(`script[src*="maps.googleapis.com"]`)) {
      console.log('[ADDRESS-AUTOCOMPLETE] Google Maps script already loading, waiting...');
      // Wait for script to load (with timeout)
      let attempts = 0;
      const maxAttempts = 100; // 10 seconds max (100 * 100ms)
      const checkInterval = setInterval(() => {
        attempts++;
        if (win.google && win.google.maps && win.google.maps.places) {
          console.log('[ADDRESS-AUTOCOMPLETE] Google Maps script loaded (waited for existing)');
          setIsLoaded(true);
          setIsLoading(false);
          clearInterval(checkInterval);
        } else if (attempts >= maxAttempts) {
          console.warn('[ADDRESS-AUTOCOMPLETE] Google Maps script loading timeout (waited for existing)');
          setIsLoading(false);
          clearInterval(checkInterval);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }

    // Load Google Maps script
    console.log('[ADDRESS-AUTOCOMPLETE] Creating and loading Google Maps script...');
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    
    // Set timeout for script loading
    const scriptTimeout = setTimeout(() => {
      console.warn('[ADDRESS-AUTOCOMPLETE] Google Maps script loading timeout');
      setIsLoading(false);
    }, 15000); // 15 second timeout for script load
    
    script.onload = () => {
      clearTimeout(scriptTimeout);
      console.log('[ADDRESS-AUTOCOMPLETE] Google Maps script loaded successfully');
      setIsLoaded(true);
      setIsLoading(false);
    };
    script.onerror = (error) => {
      clearTimeout(scriptTimeout);
      console.error('[ADDRESS-AUTOCOMPLETE] Failed to load Google Maps script:', error);
      setIsLoading(false);
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup: remove script if component unmounts (but only if we're the only one using it)
      // Actually, don't remove it - other components might be using it too
      // const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`);
      // if (existingScript && existingScript.parentNode) {
      //   existingScript.parentNode.removeChild(existingScript);
      // }
    };
  }, [apiKey]);

  // Initialize autocomplete
  useEffect(() => {
    if (!isLoaded || !inputRef.current || disabled) {
      if (!isLoaded) console.log('[ADDRESS-AUTOCOMPLETE] Waiting for Google Maps to load...');
      if (!inputRef.current) console.log('[ADDRESS-AUTOCOMPLETE] Input ref not ready...');
      if (disabled) console.log('[ADDRESS-AUTOCOMPLETE] Component disabled...');
      return;
    }

    try {
      console.log('[ADDRESS-AUTOCOMPLETE] Initializing Google Maps Autocomplete...');
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
      console.log('[ADDRESS-AUTOCOMPLETE] Autocomplete initialized successfully');

      // Handle place selection
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        console.log('[ADDRESS-AUTOCOMPLETE] Place selected:', place.formatted_address);
        
        if (!place.geometry || !place.geometry.location) {
          console.warn('[ADDRESS-AUTOCOMPLETE] No location data available for selected place');
          return;
        }

        // Parse address components
        const components: AddressComponents = {
          coordinates: {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          },
          formattedAddress: place.formatted_address,
        };

        // Extract address components
        place.address_components?.forEach((component: any) => {
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

        // Call onChange with formatted address and components (use ref to avoid recreation)
        onChangeRef.current(place.formatted_address, components);
      });

      return () => {
        if (autocompleteRef.current) {
          console.log('[ADDRESS-AUTOCOMPLETE] Cleaning up autocomplete instance');
          win.google.maps.event.clearInstanceListeners(autocompleteRef.current);
          autocompleteRef.current = null;
        }
      };
    } catch (error) {
      console.error('[ADDRESS-AUTOCOMPLETE] Error initializing Google Maps autocomplete:', error);
      setIsLoading(false);
    }
  }, [isLoaded, disabled, types, componentRestrictions]); // ✅ FIX: Removed onChange from deps to prevent recreation

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          ref={inputRef as any}
          type="text"
          value={value}
          onChange={(e) => {
            // Update value immediately for controlled input
            onChange(e.target.value);
            // Autocomplete dropdown will show automatically via Google Maps
          }}
          onFocus={() => {
            // Ensure autocomplete is ready when user focuses
            if (isLoaded && autocompleteRef.current && inputRef.current) {
              console.log('[ADDRESS-AUTOCOMPLETE] Input focused, autocomplete ready');
            }
          }}
          placeholder={placeholder}
          required={required}
          disabled={disabled || isLoading}
          autoComplete="off" // Prevent browser autocomplete from interfering
          className="w-full pl-10 pr-10 py-2 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <Loader2 className="w-4 h-4 animate-spin text-[#FF8C42]" />
          </div>
        )}
      </div>
      {!apiKey && !isLoading && (
        <p className="text-xs text-amber-600 mt-1">
          Address autocomplete unavailable - API key not configured
        </p>
      )}
    </div>
  );
}
