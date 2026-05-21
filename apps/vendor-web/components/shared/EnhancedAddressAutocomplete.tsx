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
  /** Google only honors the first type when an array is passed. Omit for POIs/landmarks (e.g. "bhive"). */
  types?: string[];
  componentRestrictions?: {
    country?: string | string[];
  };
}

const PREDICT_DEBOUNCE_MS = 280;

/** 6-digit postal code: prefer Places `postal_code`, else parse from formatted text (common for India when component is missing). */
function resolvePincodeFromPlace(
  rawPostal: string | undefined,
  formattedAddress: string,
  extraText?: string
): string | undefined {
  const digits = (s: string) => s.replace(/\D/g, '');
  let pin = rawPostal ? digits(rawPostal).slice(0, 8) : '';
  if (pin.length >= 6) pin = pin.slice(0, 6);
  if (/^\d{6}$/.test(pin)) return pin;
  for (const text of [formattedAddress, extraText || '']) {
    if (!text) continue;
    const m = text.match(/\b(\d{6})\b/);
    if (m && /^[0-9]{6}$/.test(m[1])) return m[1];
  }
  return undefined;
}

export function EnhancedAddressAutocomplete({
  value,
  onChange,
  placeholder = 'Search address, landmark, city...',
  className = '',
  required = false,
  disabled = false,
  types,
  componentRestrictions = { country: 'in' },
}: EnhancedAddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const autocompleteServiceRef = useRef<any>(null);
  const placesServiceRef = useRef<any>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch Google Maps API key from backend (AWS Secrets Manager)
  useEffect(() => {
    const fetchApiKey = async () => {
      console.log('🔑 [ADDRESS-AUTOCOMPLETE] Fetching Google Maps API key from backend...');
      setIsLoading(true);
      const timeout = new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('API key fetch timed out after 15 seconds')), 15000)
      );

      try {
        const response = await Promise.race([
          apiClient.get<{ apiKey: string; error?: string; hint?: string }>('/config/google-maps-key'),
          timeout
        ]) as { apiKey?: string; error?: string; hint?: string } | null;
        
        if (response?.error) {
          console.error('❌ [ADDRESS-AUTOCOMPLETE] Backend returned error for API key:', response.error, response.hint);
          if (response.error.includes('Invalid API key')) {
            setError('Invalid Google Maps API key configured. Please contact support.');
          } else {
            setError(response.error);
          }
          setApiKey(null);
          setIsLoading(false);
          return;
        }

        if (response?.apiKey) {
          // Basic validation: Google Maps API keys start with "AIza"
          if (!response.apiKey.startsWith('AIza')) {
            console.error('❌ [ADDRESS-AUTOCOMPLETE] Invalid Google Maps API key format (does not start with AIza):', response.apiKey);
            setError('Invalid Google Maps API key format. Please contact support.');
            setApiKey(null);
            setIsLoading(false);
            return;
          }
          console.log('✅ [ADDRESS-AUTOCOMPLETE] Google Maps API key fetched successfully.');
          setApiKey(response.apiKey);
        } else {
          console.warn('⚠️ [ADDRESS-AUTOCOMPLETE] Google Maps API key not available from backend response.');
          setError('Google Maps API key not configured. Autocomplete disabled.');
          setApiKey(null);
        }
      } catch (error: any) {
        console.error('❌ [ADDRESS-AUTOCOMPLETE] Failed to fetch Google Maps API key:', error);
        setError(error.message || 'Failed to load Google Maps API key.');
        setApiKey(null);
        
        // Try fallback to environment variable if backend fails
        const envApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (envApiKey) {
          console.log('✅ [ADDRESS-AUTOCOMPLETE] Using fallback API key from environment variable');
          setApiKey(envApiKey);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchApiKey();
  }, []);

  // Check if Google Maps is already loaded (from other components)
  useEffect(() => {
    const win = window as any;
    if (win.google && win.google.maps && win.google.maps.places) {
      if (!autocompleteServiceRef.current) {
        initServices();
      }
    }
  }, []);

  // Load Google Maps script and initialize services
  useEffect(() => {
    if (!apiKey) {
      return;
    }

    const win = window as any;
    if (win.google && win.google.maps && win.google.maps.places) {
      if (!autocompleteServiceRef.current) {
        initServices();
      }
      return;
    }

    const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`);
    if (existingScript) {
      const checkInterval = setInterval(() => {
        if (win.google && win.google.maps && win.google.maps.places) {
          if (!autocompleteServiceRef.current) {
            initServices();
          }
          clearInterval(checkInterval);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (!autocompleteServiceRef.current) {
        initServices();
      }
    };
    script.onerror = (e) => {
      setError('Failed to load Google Maps. Check your network connection.');
      setIsLoading(false);
    };
    document.head.appendChild(script);
  }, [apiKey]);

  const initServices = () => {
    const win = window as any;
    if (win.google?.maps?.places) {
      try {
        if (!autocompleteServiceRef.current) {
          autocompleteServiceRef.current = new win.google.maps.places.AutocompleteService();
        }
        if (!placesServiceRef.current) {
          const dummyDiv = document.createElement('div');
          placesServiceRef.current = new win.google.maps.places.PlacesService(dummyDiv);
        }
        setIsLoaded(true);
        setIsLoading(false);
      } catch (error) {
        console.error('Error initializing services:', error);
      }
    }
  };

  // Re-run search when Maps becomes ready (user may have typed before script loaded)
  useEffect(() => {
    if (!isLoaded || !inputRef.current) return;
    const q = inputRef.current.value.trim();
    if (q.length >= 2) {
      const t = window.setTimeout(() => searchPredictions(q), 0);
      return () => window.clearTimeout(t);
    }
  }, [isLoaded]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search for predictions as user types (broader match when `types` omitted — POIs like "bhive")
  const searchPredictions = (query: string, typesOverride?: string[] | null) => {
    if (!autocompleteServiceRef.current) {
      const win = window as any;
      if (win.google?.maps?.places && !autocompleteServiceRef.current) {
        initServices();
        setTimeout(() => {
          if (autocompleteServiceRef.current && query.length >= 2) {
            searchPredictions(query, typesOverride);
          }
        }, 100);
      }
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setPredictions([]);
      setShowSuggestions(false);
      return;
    }

    const effectiveTypes =
      typesOverride === null
        ? undefined
        : typesOverride !== undefined
          ? typesOverride
          : types;

    const request: {
      input: string;
      componentRestrictions: typeof componentRestrictions;
      types?: string[];
    } = {
      input: trimmed,
      componentRestrictions,
    };
    if (effectiveTypes?.length) {
      request.types = effectiveTypes;
    }

    try {
      autocompleteServiceRef.current.getPlacePredictions(
        request,
        (results: any[], status: any) => {
          const PS = window.google.maps.places.PlacesServiceStatus;
          const ok = status === PS.OK && results && results.length > 0;

          if (ok) {
            setPredictions(results.slice(0, 8));
            setShowSuggestions(true);
            return;
          }

          // Restricted type (e.g. address-only) often misses establishments — retry without types
          if (effectiveTypes?.length) {
            searchPredictions(trimmed, null);
            return;
          }

          setPredictions([]);
          setShowSuggestions(trimmed.length >= 2);
        }
      );
    } catch {
      setPredictions([]);
      setShowSuggestions(false);
    }
  };

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      if (!autocompleteServiceRef.current) {
        const win = window as any;
        if (win.google?.maps?.places) {
          initServices();
        }
      }

      if (autocompleteServiceRef.current && newValue.trim().length >= 2) {
        searchPredictions(newValue);
      } else if (newValue.trim().length < 2) {
        setPredictions([]);
        setShowSuggestions(false);
      }
    }, PREDICT_DEBOUNCE_MS);
  };

  // Handle place selection
  const handleSelectPlace = (prediction: any) => {
    setShowSuggestions(false);
    onChange(prediction.description);

    if (!placesServiceRef.current) return;

    placesServiceRef.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['address_components', 'formatted_address', 'geometry', 'place_id'],
      },
      (place: any, status: any) => {
        if (status !== window.google.maps.places.PlacesServiceStatus.OK || !place) {
          return;
        }

        const lat = place.geometry?.location?.lat?.() ?? 0;
        const lng = place.geometry?.location?.lng?.() ?? 0;
        const formattedAddress = place.formatted_address ?? prediction.description;

        const parseAddressComponents = (
          addressComponents: any[] | undefined,
          predictionDescription: string
        ): AddressComponents => {
          const components: AddressComponents = {
            coordinates: { lat, lng },
            formattedAddress,
            lat,
            lng,
            placeId: place.place_id,
          };

          let rawPostal: string | undefined;

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
              rawPostal = component.long_name || component.short_name || rawPostal;
            } else if (types.includes('country')) {
              components.country = component.long_name;
            } else if (types.includes('point_of_interest') || types.includes('establishment')) {
              components.landmark = component.long_name;
            }
          });

          const pin = resolvePincodeFromPlace(rawPostal, formattedAddress, predictionDescription);
          if (pin) components.pincode = pin;

          if (!components.street?.trim()) {
            components.street =
              components.landmark ||
              predictionDescription.split(',')[0]?.trim() ||
              formattedAddress;
          }

          return components;
        };

        const components = parseAddressComponents(place.address_components, prediction.description);
        const displayAddress = components.street?.trim() || formattedAddress;
        onChange(displayAddress, components);
      }
    );
  };


  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
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

      {/* Suggestions Dropdown */}
      {showSuggestions && predictions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-[9999] w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-80 overflow-y-auto"
        >
          {predictions.map((prediction) => (
            <button
              key={prediction.place_id}
              type="button"
              onClick={() => handleSelectPlace(prediction)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-start gap-3 border-b last:border-0 transition-colors"
            >
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {prediction.structured_formatting?.main_text || prediction.description}
                </p>
                {prediction.structured_formatting?.secondary_text && (
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {prediction.structured_formatting.secondary_text}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No Results */}
      {showSuggestions && value.length >= 2 && predictions.length === 0 && isLoaded && (
        <div className="absolute z-[9999] w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl p-4 text-center">
          <p className="text-sm text-gray-500">No addresses found. Try a different search.</p>
        </div>
      )}

      {!apiKey && !isLoading && (
        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
          <span className="text-amber-500">ℹ️</span>
          Type your address manually (autocomplete not available)
        </p>
      )}
      {isLoading && (
        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin text-[#FF8C42]" />
          Loading address autocomplete...
        </p>
      )}
    </div>
  );
}
