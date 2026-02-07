"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Navigation, X, Loader2, Search, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';

// Google Maps Script Loader
declare global {
  interface Window {
    google: any;
    initGoogleMaps: () => void;
  }
}

interface Address {
  address: string;
  lat: number;
  lng: number;
  landmark?: string;
  pincode?: string;
  city?: string;
  state?: string;
}

interface AddressSearchInputProps {
  onAddressSelect: (address: Address) => void;
  placeholder?: string;
  initialAddress?: string;
  showCurrentLocation?: boolean;
  className?: string;
}

export function AddressSearchInput({
  onAddressSelect,
  placeholder = "Search for address...",
  initialAddress = "",
  showCurrentLocation = true,
  className = "",
}: AddressSearchInputProps) {
  const [inputValue, setInputValue] = useState(initialAddress);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [googleLoaded, setGoogleLoaded] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const autocompleteServiceRef = useRef<any>(null);
  const placesServiceRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Load Google Maps Script with API key from Secrets Manager
  useEffect(() => {
    const loadGoogleMaps = async () => {
      if (window.google?.maps?.places) {
        initServices();
        return;
      }

      // Check if script is already loading
      if (document.querySelector('script[src*="maps.googleapis.com"]')) {
        const checkGoogle = setInterval(() => {
          if (window.google?.maps?.places) {
            clearInterval(checkGoogle);
            initServices();
          }
        }, 100);
        return;
      }

      try {
        // Fetch API key from backend (Secrets Manager)
        const response = await apiClient.get('/config/google-maps-key') as any;
        const apiKey = response?.apiKey || response?.key;
        
        if (!apiKey) {
          console.warn('Google Maps API key not available');
          return;
        }

        // Load script
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps`;
        script.async = true;
        script.defer = true;
        
        window.initGoogleMaps = () => {
          initServices();
        };

        document.head.appendChild(script);
      } catch (error) {
        console.warn('Failed to fetch Google Maps API key:', error);
      }
    };

    loadGoogleMaps();
  }, []);

  const initServices = () => {
    if (window.google?.maps) {
      autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
      geocoderRef.current = new window.google.maps.Geocoder();
      // Create a dummy div for PlacesService
      const dummyDiv = document.createElement('div');
      placesServiceRef.current = new window.google.maps.places.PlacesService(dummyDiv);
      setGoogleLoaded(true);
    }
  };

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search for predictions
  const searchPredictions = useCallback((query: string) => {
    if (!autocompleteServiceRef.current || query.length < 3) {
      setPredictions([]);
      return;
    }

    setIsLoading(true);

    autocompleteServiceRef.current.getPlacePredictions(
      {
        input: query,
        componentRestrictions: { country: 'in' }, // Restrict to India
        types: ['address', 'establishment'],
      },
      (results: any[], status: any) => {
        setIsLoading(false);
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
          setPredictions(results.slice(0, 5));
          setShowDropdown(true);
        } else {
          setPredictions([]);
        }
      }
    );
  }, []);

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchPredictions(value);
    }, 300);
  };

  // Get place details and select
  const handleSelectPrediction = async (prediction: any) => {
    setIsLoading(true);
    setShowDropdown(false);
    setInputValue(prediction.description);

    try {
      placesServiceRef.current.getDetails(
        {
          placeId: prediction.place_id,
          fields: ['geometry', 'address_components', 'formatted_address'],
        },
        (place: any, status: any) => {
          setIsLoading(false);
          
          if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
            const address: Address = {
              address: place.formatted_address || prediction.description,
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            };

            // Extract address components
            place.address_components?.forEach((component: any) => {
              if (component.types.includes('postal_code')) {
                address.pincode = component.long_name;
              }
              if (component.types.includes('locality')) {
                address.city = component.long_name;
              }
              if (component.types.includes('administrative_area_level_1')) {
                address.state = component.long_name;
              }
            });

            onAddressSelect(address);
          }
        }
      );
    } catch (error) {
      setIsLoading(false);
      console.error('Error getting place details:', error);
    }
  };

  // Detect current location
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setDetectingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        // Reverse geocode
        if (geocoderRef.current) {
          geocoderRef.current.geocode(
            { location: { lat: latitude, lng: longitude } },
            (results: any[], status: any) => {
              setDetectingLocation(false);

              if (status === 'OK' && results[0]) {
                const result = results[0];
                const address: Address = {
                  address: result.formatted_address,
                  lat: latitude,
                  lng: longitude,
                };

                // Extract address components
                result.address_components?.forEach((component: any) => {
                  if (component.types.includes('postal_code')) {
                    address.pincode = component.long_name;
                  }
                  if (component.types.includes('locality')) {
                    address.city = component.long_name;
                  }
                  if (component.types.includes('administrative_area_level_1')) {
                    address.state = component.long_name;
                  }
                });

                setInputValue(result.formatted_address);
                onAddressSelect(address);
                toast.success('Location detected!');
              } else {
                // Fallback: Just use coordinates
                const address: Address = {
                  address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
                  lat: latitude,
                  lng: longitude,
                };
                setInputValue(address.address);
                onAddressSelect(address);
              }
            }
          );
        } else {
          setDetectingLocation(false);
          // Fallback without geocoding
          const address: Address = {
            address: 'Current Location',
            lat: latitude,
            lng: longitude,
          };
          setInputValue('Current Location');
          onAddressSelect(address);
          toast.success('Location detected!');
        }
      },
      (error) => {
        setDetectingLocation(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error('Please allow location access');
            break;
          case error.POSITION_UNAVAILABLE:
            toast.error('Location information unavailable');
            break;
          case error.TIMEOUT:
            toast.error('Location request timed out');
            break;
          default:
            toast.error('Could not detect location');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className={`relative ${className}`}>
      {/* Input Field */}
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => predictions.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          className="w-full py-3 pl-10 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        {inputValue && (
          <button
            onClick={() => {
              setInputValue('');
              setPredictions([]);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {isLoading && (
          <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
        )}
      </div>

      {/* Current Location Button */}
      {showCurrentLocation && (
        <button
          onClick={handleDetectLocation}
          disabled={detectingLocation}
          className="w-full mt-2 py-3 px-4 border-2 border-dashed border-green-300 rounded-xl text-green-600 font-medium flex items-center justify-center gap-2 hover:bg-green-50 disabled:opacity-50"
        >
          {detectingLocation ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Navigation className="w-5 h-5" />
          )}
          Use Current Location
        </button>
      )}

      {/* Predictions Dropdown */}
      {showDropdown && predictions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"
        >
          {predictions.map((prediction) => (
            <button
              key={prediction.place_id}
              onClick={() => handleSelectPrediction(prediction)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-start gap-3 border-b last:border-0"
            >
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {prediction.structured_formatting?.main_text || prediction.description}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {prediction.structured_formatting?.secondary_text || ''}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* No Results */}
      {showDropdown && !isLoading && inputValue.length >= 3 && predictions.length === 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-lg border border-gray-100 p-4 text-center">
          <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-500">No results found</p>
          <p className="text-xs text-gray-400">Try a different search term</p>
        </div>
      )}

      {/* Loading state for Google Maps */}
      {!googleLoaded && (
        <p className="text-xs text-gray-500 mt-1">
          Loading map search...
        </p>
      )}
    </div>
  );
}
