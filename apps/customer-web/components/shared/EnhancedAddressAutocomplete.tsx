'use client';

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Loader2, ChevronRight } from 'lucide-react';
import { getGoogleMapsBrowserApiKey } from '@/lib/google-maps-browser-key';

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

/** Omitting `types` on predictions tends to match POIs (e.g. “bhive”) and avoids some INVALID_REQUEST combos. */
const DEFAULT_COMPONENT_RESTRICTIONS: NonNullable<
  EnhancedAddressAutocompleteProps['componentRestrictions']
> = Object.freeze({ country: 'in' });

const PREDICT_DEBOUNCE_MS = 280;
const MIN_QUERY_LEN = 2;

function parsePlaceToComponents(place: any): AddressComponents {
  const components: AddressComponents = {
    coordinates: {
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
    },
    formattedAddress: place.formatted_address,
  };

  place.address_components?.forEach((component: any) => {
    const t = component.types;

    if (t.includes('street_number')) {
      components.street = (components.street || '') + component.long_name + ' ';
    } else if (t.includes('route')) {
      components.street = (components.street || '') + component.long_name;
    } else if (t.includes('locality') || t.includes('sublocality')) {
      components.city = component.long_name;
    } else if (t.includes('administrative_area_level_1')) {
      components.state = component.long_name;
    } else if (t.includes('postal_code')) {
      components.pincode = component.long_name;
    } else if (t.includes('country')) {
      components.country = component.long_name;
    } else if (t.includes('point_of_interest') || t.includes('establishment')) {
      components.landmark = component.long_name;
    }
  });

  return components;
}

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
  const componentRestrictions =
    componentRestrictionsProp ?? DEFAULT_COMPONENT_RESTRICTIONS;

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autocompleteServiceRef = useRef<any>(null);
  const placesServiceRef = useRef<any>(null);

  const [apiKey, setApiKey] = useState<string | null>(null);
  const [mapsReady, setMapsReady] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [predictLoading, setPredictLoading] = useState(false);
  const [inputText, setInputText] = useState(value);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    setInputText(value);
  }, [value]);

  useEffect(() => {
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        console.warn('[ADDRESS-AUTOCOMPLETE] Google Maps API key resolution timeout');
        setBootLoading(false);
      }
    }, 10000);

    (async () => {
      try {
        console.log('[ADDRESS-AUTOCOMPLETE] Resolving Google Maps API key...');
        const key = await getGoogleMapsBrowserApiKey();
        if (cancelled) return;
        clearTimeout(timeoutId);
        if (key) {
          console.log('[ADDRESS-AUTOCOMPLETE] API key resolved, length:', key.length);
          setApiKey(key);
        } else {
          console.warn(
            '[ADDRESS-AUTOCOMPLETE] No API key (check /config/google-maps-key and, on localhost, NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)'
          );
          setBootLoading(false);
        }
      } catch (e: any) {
        clearTimeout(timeoutId);
        if (!cancelled) {
          console.error('[ADDRESS-AUTOCOMPLETE] Key resolution failed:', e?.message || e);
          setBootLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!apiKey) {
      return;
    }

    const win = window as any;
    let pollId: ReturnType<typeof setInterval> | null = null;
    let scriptTimeout: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const initServices = (): boolean => {
      if (!win.google?.maps?.places) return false;
      try {
        autocompleteServiceRef.current = new win.google.maps.places.AutocompleteService();
        const dummy = document.createElement('div');
        placesServiceRef.current = new win.google.maps.places.PlacesService(dummy);
        setMapsReady(true);
        setBootLoading(false);
        console.log('[ADDRESS-AUTOCOMPLETE] Places services ready (AutocompleteService)');
        return true;
      } catch (e) {
        console.error('[ADDRESS-AUTOCOMPLETE] Failed to init Places services:', e);
        setBootLoading(false);
        return false;
      }
    };

    const stopPoll = () => {
      if (pollId != null) {
        clearInterval(pollId);
        pollId = null;
      }
    };

    /** Places often appears a few ticks after script onload (dynamic chunks); poll instead of a single initServices() call. */
    const startPlacesPoll = () => {
      stopPoll();
      let attempts = 0;
      pollId = setInterval(() => {
        if (cancelled) return;
        attempts += 1;
        if (initServices()) {
          stopPoll();
        } else if (attempts >= 150) {
          stopPoll();
          console.warn(
            '[ADDRESS-AUTOCOMPLETE] Places library not available after wait — you can still type the address manually.'
          );
          setBootLoading(false);
        }
      }, 100);
    };

    if (initServices()) {
      return () => {
        cancelled = true;
        stopPoll();
      };
    }

    if (document.querySelector(`script[src*="maps.googleapis.com"]`)) {
      startPlacesPoll();
      return () => {
        cancelled = true;
        stopPoll();
        if (scriptTimeout) clearTimeout(scriptTimeout);
      };
    }

    console.log('[ADDRESS-AUTOCOMPLETE] Loading Google Maps script (places)...');
    const script = document.createElement('script');
    // No `loading=async` here: onload + polling is more reliable for AutocompleteService availability.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    scriptTimeout = setTimeout(() => {
      scriptTimeout = null;
      console.warn('[ADDRESS-AUTOCOMPLETE] Google Maps script loading timeout');
      stopPoll();
      setBootLoading(false);
    }, 20000);
    script.onload = () => {
      if (scriptTimeout) {
        clearTimeout(scriptTimeout);
        scriptTimeout = null;
      }
      startPlacesPoll();
    };
    script.onerror = () => {
      if (scriptTimeout) {
        clearTimeout(scriptTimeout);
        scriptTimeout = null;
      }
      console.error('[ADDRESS-AUTOCOMPLETE] Failed to load Google Maps script');
      stopPoll();
      setBootLoading(false);
    };
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      stopPoll();
      if (scriptTimeout) clearTimeout(scriptTimeout);
    };
  }, [apiKey]);

  const runPredictions = useCallback(
    (query: string) => {
      const svc = autocompleteServiceRef.current;
      const win = window as any;
      const q = query.trim();
      if (!svc || !mapsReady || q.length < MIN_QUERY_LEN) {
        setPredictions([]);
        setPredictLoading(false);
        return;
      }

      setPredictLoading(true);
      const safety = window.setTimeout(() => setPredictLoading(false), 12000);

      const request: any = {
        input: q,
        componentRestrictions: {
          country: componentRestrictions.country,
        },
      };
      if (typesProp?.length) {
        request.types = typesProp;
      }

      svc.getPlacePredictions(request, (results: any[], status: any) => {
        window.clearTimeout(safety);
        const PS = win.google?.maps?.places?.PlacesServiceStatus;
        const ok = status === PS?.OK || String(status) === 'OK';
        try {
          if (ok && results?.length) {
            setPredictions(results.slice(0, 8));
            setShowDropdown(true);
          } else {
            const zero = PS?.ZERO_RESULTS;
            if (!ok && status !== zero) {
              console.warn('[ADDRESS-AUTOCOMPLETE] getPlacePredictions status:', status);
            }
            setPredictions([]);
            if (q.length >= MIN_QUERY_LEN) {
              setShowDropdown(true);
            }
          }
        } finally {
          setPredictLoading(false);
        }
      });
    },
    [mapsReady, typesProp, componentRestrictions]
  );

  /** User often finishes typing before Places finishes loading; debounced runs no-op until then — flush once maps is ready. */
  useEffect(() => {
    if (!mapsReady) return;
    const raw = (inputRef.current?.value ?? '').trim();
    if (raw.length < MIN_QUERY_LEN) return;
    const t = window.setTimeout(() => runPredictions(raw), 0);
    return () => window.clearTimeout(t);
  }, [mapsReady, runPredictions]);

  const schedulePredictions = useCallback(
    (query: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (query.length < MIN_QUERY_LEN) {
        setPredictions([]);
        setShowDropdown(false);
        setPredictLoading(false);
        return;
      }
      debounceRef.current = setTimeout(() => runPredictions(query), PREDICT_DEBOUNCE_MS);
    },
    [runPredictions]
  );

  useLayoutEffect(() => {
    if (!showDropdown || !inputRef.current) {
      setDropdownRect(null);
      return;
    }

    const el = inputRef.current;
    const update = () => {
      const r = el.getBoundingClientRect();
      setDropdownRect({
        top: r.bottom + 4,
        left: r.left,
        width: r.width,
      });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [showDropdown, predictions.length, inputText]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (inputRef.current?.contains(t)) return;
      if (dropdownRef.current?.contains(t)) return;
      setShowDropdown(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSelectPrediction = (prediction: any) => {
    const ps = placesServiceRef.current;
    const win = window as any;
    if (!ps) return;

    setPredictLoading(true);
    setShowDropdown(false);
    setPredictions([]);

    ps.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['geometry', 'address_components', 'formatted_address', 'name'],
      },
      (place: any, status: string) => {
        setPredictLoading(false);
        const ok = win.google?.maps?.places?.PlacesServiceStatus?.OK;
        if (status !== ok || !place?.geometry?.location) {
          console.warn('[ADDRESS-AUTOCOMPLETE] getDetails failed:', status);
          const fallback = prediction.description || '';
          setInputText(fallback);
          onChangeRef.current(fallback);
          return;
        }

        const formatted = place.formatted_address || prediction.description || '';
        const components = parsePlaceToComponents(place);
        setInputText(formatted);
        onChangeRef.current(formatted, components);
      }
    );
  };

  // Never disable typing while Maps boots — only the parent `disabled` prop should block input.
  const inputDisabled = !!disabled;
  const showSpinner =
    (bootLoading && !mapsReady) ||
    (predictLoading && !showDropdown && inputText.length >= MIN_QUERY_LEN);

  const dropdownPortal =
    showDropdown &&
    dropdownRect &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        ref={dropdownRef}
        className="rounded-xl border border-gray-200 bg-white shadow-xl max-h-[min(50vh,320px)] overflow-y-auto"
        style={{
          position: 'fixed',
          top: dropdownRect.top,
          left: dropdownRect.left,
          width: dropdownRect.width,
          zIndex: 2147483646,
        }}
      >
        {predictLoading && predictions.length === 0 ? (
          <div className="flex items-center justify-center gap-2 px-4 py-3 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin text-[#FF8C42]" />
            Searching…
          </div>
        ) : predictions.length > 0 ? (
          predictions.map((p) => (
            <button
              key={p.place_id}
              type="button"
              className="flex w-full items-start gap-3 border-b border-gray-100 px-3 py-3 text-left last:border-0 hover:bg-gray-50 active:bg-gray-100"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelectPrediction(p)}
            >
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">
                  {p.structured_formatting?.main_text || p.description}
                </p>
                <p className="truncate text-xs text-gray-500">
                  {p.structured_formatting?.secondary_text || ''}
                </p>
              </div>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-gray-400" />
            </button>
          ))
        ) : (
          <div className="px-4 py-3 text-center text-sm text-gray-500">No matches — try another phrase</div>
        )}
      </div>,
      document.body
    );

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => {
            const v = e.target.value;
            setInputText(v);
            onChange(v);
            schedulePredictions(v);
          }}
          onFocus={() => {
            if (predictions.length > 0) setShowDropdown(true);
          }}
          placeholder={placeholder}
          required={required}
          disabled={inputDisabled}
          autoComplete="off"
          className="w-full rounded-xl border-2 border-gray-200 py-2 pl-10 pr-10 focus:border-[#FF8C42] focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100"
        />
        {showSpinner && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 transform">
            <Loader2 className="h-4 w-4 animate-spin text-[#FF8C42]" />
          </div>
        )}
      </div>
      {!apiKey && !bootLoading && (
        <p className="mt-1 text-xs text-amber-600">
          Address autocomplete unavailable - API key not configured
        </p>
      )}
      {dropdownPortal}
    </div>
  );
}
