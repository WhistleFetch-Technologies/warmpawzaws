/**
 * Google Maps Address Autocomplete Component
 * Reusable component for address search with autocomplete
 */
'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
export function AddressAutocomplete({ value, onChange, placeholder = 'Search address, landmark, city...', className = '', required = false, disabled = false, apiKey, types = ['address'], componentRestrictions = { country: 'in' }, }) {
    const inputRef = useRef(null);
    const autocompleteRef = useRef(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    // Load Google Maps script
    useEffect(() => {
        const apiKeyToUse = apiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
        if (!apiKeyToUse) {
            console.warn('Google Maps API key not provided');
            setIsLoading(false);
            return;
        }
        // Check if Google Maps is already loaded
        if (window.google && window.google.maps && window.google.maps.places) {
            setIsLoaded(true);
            setIsLoading(false);
            return;
        }
        // Check if script is already being loaded
        if (document.querySelector(`script[src*="maps.googleapis.com"]`)) {
            // Wait for script to load
            const checkInterval = setInterval(() => {
                if (window.google && window.google.maps && window.google.maps.places) {
                    setIsLoaded(true);
                    setIsLoading(false);
                    clearInterval(checkInterval);
                }
            }, 100);
            return () => clearInterval(checkInterval);
        }
        // Load Google Maps script
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKeyToUse}&libraries=places&loading=async`;
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
        if (!isLoaded || !inputRef.current || disabled)
            return;
        try {
            // Create autocomplete instance
            const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
                types,
                componentRestrictions,
                fields: [
                    'address_components',
                    'formatted_address',
                    'geometry',
                    'name',
                    'place_id',
                ],
            });
            autocompleteRef.current = autocomplete;
            // Handle place selection
            autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();
                if (!place.geometry || !place.geometry.location) {
                    console.warn('No location data available for selected place');
                    return;
                }
                // Parse address components
                const components = {
                    coordinates: {
                        lat: place.geometry.location.lat(),
                        lng: place.geometry.location.lng(),
                    },
                    formattedAddress: place.formatted_address,
                };
                // Extract address components
                place.address_components?.forEach((component) => {
                    const types = component.types;
                    if (types.includes('street_number')) {
                        components.street = (components.street || '') + component.long_name + ' ';
                    }
                    else if (types.includes('route')) {
                        components.street = (components.street || '') + component.long_name;
                    }
                    else if (types.includes('locality') || types.includes('sublocality')) {
                        components.city = component.long_name;
                    }
                    else if (types.includes('administrative_area_level_1')) {
                        components.state = component.long_name;
                    }
                    else if (types.includes('postal_code')) {
                        components.pincode = component.long_name;
                    }
                    else if (types.includes('country')) {
                        components.country = component.long_name;
                    }
                    else if (types.includes('point_of_interest') || types.includes('establishment')) {
                        components.landmark = component.long_name;
                    }
                });
                // Call onChange with formatted address and components
                onChange(place.formatted_address, components);
            });
            return () => {
                if (autocompleteRef.current) {
                    window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
                    autocompleteRef.current = null;
                }
            };
        }
        catch (error) {
            console.error('Error initializing Google Maps autocomplete:', error);
            setIsLoading(false);
        }
    }, [isLoaded, disabled, onChange, types, componentRestrictions]);
    return (_jsxs("div", { className: `relative ${className}`, children: [_jsx("input", { ref: inputRef, type: "text", value: value, onChange: (e) => onChange(e.target.value), placeholder: placeholder, required: required, disabled: disabled || isLoading, className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary outline-none disabled:bg-gray-100 disabled:cursor-not-allowed" }), isLoading && (_jsx("div", { className: "absolute right-3 top-1/2 transform -translate-y-1/2", children: _jsx("div", { className: "animate-spin rounded-full h-4 w-4 border-b-2 border-primary" }) }))] }));
}
