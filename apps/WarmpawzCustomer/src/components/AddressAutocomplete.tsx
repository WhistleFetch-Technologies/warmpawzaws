/**
 * Google Maps Address Autocomplete Component for React Native
 * Reusable component for address search with autocomplete
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
} from 'react-native';

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

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string, components?: AddressComponents) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  apiKey?: string;
  styles?: {
    container?: any;
    input?: any;
    suggestions?: any;
    suggestionItem?: any;
    suggestionText?: any;
  };
}

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = 'Search address, landmark, city...',
  required = false,
  disabled = false,
  apiKey,
  styles: customStyles = {},
}: AddressAutocompleteProps) {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const apiKeyToUse = apiKey || process.env.GOOGLE_MAPS_API_KEY || '';

  const fetchPredictions = async (input: string) => {
    if (!input.trim() || !apiKeyToUse) {
      setPredictions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
          input
        )}&key=${apiKeyToUse}&components=country:in&types=address`
      );

      const data = await response.json();

      if (data.status === 'OK' && data.predictions) {
        setPredictions(data.predictions);
        setShowSuggestions(true);
      } else {
        setPredictions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Error fetching address predictions:', error);
      setPredictions([]);
      setShowSuggestions(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (text: string) => {
    onChange(text);

    // Debounce API calls
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchPredictions(text);
    }, 300);
  };

  const handleSelectPlace = async (placeId: string, description: string) => {
    if (!apiKeyToUse) {
      onChange(description);
      setShowSuggestions(false);
      return;
    }

    try {
      // Get place details
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${apiKeyToUse}&fields=address_components,formatted_address,geometry`
      );

      const data = await response.json();

      if (data.status === 'OK' && data.result) {
        const place = data.result;
        const components: AddressComponents = {
          formattedAddress: place.formatted_address,
          coordinates: place.geometry?.location
            ? {
                lat: place.geometry.location.lat,
                lng: place.geometry.location.lng,
              }
            : undefined,
        };

        // Parse address components
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

        onChange(place.formatted_address, components);
        setShowSuggestions(false);
        setPredictions([]);
      } else {
        // Fallback to description if details fetch fails
        onChange(description);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Error fetching place details:', error);
      // Fallback to description
      onChange(description);
      setShowSuggestions(false);
    }
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <View style={[defaultStyles.container, customStyles.container]}>
      <View style={defaultStyles.inputContainer}>
        <TextInput
          value={value}
          onChangeText={handleInputChange}
          placeholder={placeholder}
          editable={!disabled}
          style={[defaultStyles.input, customStyles.input]}
          placeholderTextColor="#999"
        />
        {isLoading && (
          <View style={defaultStyles.loader}>
            <ActivityIndicator size="small" color="#007AFF" />
          </View>
        )}
      </View>

      {showSuggestions && predictions.length > 0 && (
        <View style={[defaultStyles.suggestions, customStyles.suggestions]}>
          <FlatList
            data={predictions}
            keyExtractor={(item) => item.place_id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[defaultStyles.suggestionItem, customStyles.suggestionItem]}
                onPress={() => handleSelectPlace(item.place_id, item.description)}
              >
                <Text style={[defaultStyles.suggestionMainText, customStyles.suggestionText]}>
                  {item.structured_formatting?.main_text || item.description}
                </Text>
                {item.structured_formatting?.secondary_text && (
                  <Text style={defaultStyles.suggestionSecondaryText}>
                    {item.structured_formatting.secondary_text}
                  </Text>
                )}
              </TouchableOpacity>
            )}
            keyboardShouldPersistTaps="handled"
            style={defaultStyles.flatList}
          />
        </View>
      )}
    </View>
  );
}

const defaultStyles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1000,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
  },
  loader: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -10 }],
  },
  suggestions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1001,
  },
  flatList: {
    maxHeight: 200,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionMainText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  suggestionSecondaryText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});

