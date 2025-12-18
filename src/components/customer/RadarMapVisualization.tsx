/**
 * Radar Map Visualization Component
 * Shows service providers on map with coverage radius
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { BrandColors } from '../../theme/colors';

interface ServiceProvider {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  coverageRadius: number; // in km
  rating: number;
  isAvailable: boolean;
  distance?: number;
}

interface RadarMapVisualizationProps {
  providers: ServiceProvider[];
  customerLocation?: { lat: number; lng: number };
  onProviderSelect?: (provider: ServiceProvider) => void;
  showCoverageRadius?: boolean;
}

export function RadarMapVisualization({
  providers,
  customerLocation,
  onProviderSelect,
  showCoverageRadius = true,
}: RadarMapVisualizationProps) {
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (mapReady && providers.length > 0) {
      // Fit map to show all providers
      const coordinates = providers.map(p => ({
        latitude: p.latitude,
        longitude: p.longitude,
      }));

      if (customerLocation) {
        coordinates.push({
          latitude: customerLocation.lat,
          longitude: customerLocation.lng,
        });
      }

      if (coordinates.length > 0) {
        mapRef.current?.fitToCoordinates(coordinates, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }
    }
  }, [mapReady, providers, customerLocation]);

  if (providers.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={BrandColors.primary} />
        </View>
      </View>
    );
  }

  const initialRegion = customerLocation
    ? {
        latitude: customerLocation.lat,
        longitude: customerLocation.lng,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      }
    : providers.length > 0
    ? {
        latitude: providers[0].latitude,
        longitude: providers[0].longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      }
    : {
        latitude: 12.9716,
        longitude: 77.5946,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={initialRegion}
        onMapReady={() => setMapReady(true)}
        showsUserLocation={!!customerLocation}
        showsMyLocationButton={true}
      >
        {/* Customer location marker */}
        {customerLocation && (
          <Marker
            coordinate={{
              latitude: customerLocation.lat,
              longitude: customerLocation.lng,
            }}
            title="Your Location"
            pinColor="blue"
          />
        )}

        {/* Service provider markers */}
        {providers.map((provider) => (
          <React.Fragment key={provider.id}>
            {/* Coverage radius circle */}
            {showCoverageRadius && provider.coverageRadius > 0 && (
              <Circle
                center={{
                  latitude: provider.latitude,
                  longitude: provider.longitude,
                }}
                radius={provider.coverageRadius * 1000} // Convert km to meters
                strokeColor={provider.isAvailable ? '#4CAF50' : '#F44336'}
                fillColor={provider.isAvailable ? '#4CAF5020' : '#F4433620'}
                strokeWidth={2}
              />
            )}

            {/* Provider marker */}
            <Marker
              coordinate={{
                latitude: provider.latitude,
                longitude: provider.longitude,
              }}
              title={provider.name}
              description={`Rating: ${provider.rating}/5${provider.distance ? ` • ${provider.distance.toFixed(1)} km away` : ''}`}
              pinColor={provider.isAvailable ? 'green' : 'red'}
              onPress={() => onProviderSelect?.(provider)}
            />
          </React.Fragment>
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: 400,
  },
  map: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

