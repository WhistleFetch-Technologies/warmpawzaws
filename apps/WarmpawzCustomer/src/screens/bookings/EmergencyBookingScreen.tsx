/**
 * Emergency Booking Screen - Mobile
 * SOS/Emergency booking for urgent pet care needs
 * Identical functionality to web app
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import * as Location from 'expo-location';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi, BookingValidationApi } from '../../services/api';

interface EmergencyBookingScreenProps {
  phone: string;
  customerId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onSuccess?: (bookingId: string) => void;
}

interface Pet {
  id: string;
  name: string;
  type: string;
  breed?: string;
}

interface EmergencyService {
  id: string;
  name: string;
  description: string;
  estimatedTime: string;
  icon: string;
}

const EMERGENCY_SERVICES: EmergencyService[] = [
  {
    id: 'ambulance',
    name: 'Pet Ambulance',
    description: 'Immediate transport to nearest vet',
    estimatedTime: '10-15 min',
    icon: '🚑',
  },
  {
    id: 'emergency_vet',
    name: 'Emergency Vet',
    description: '24/7 emergency veterinary care',
    estimatedTime: '15-20 min',
    icon: '🏥',
  },
  {
    id: 'home_emergency',
    name: 'Emergency Home Visit',
    description: 'Vet comes to your location',
    estimatedTime: '20-30 min',
    icon: '🏠',
  },
];

export function EmergencyBookingScreen({
  phone,
  customerId,
  onBack,
  onNavigate,
  onSuccess,
}: EmergencyBookingScreenProps) {
  const [loading, setLoading] = useState(false);
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [selectedService, setSelectedService] = useState<EmergencyService | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [address, setAddress] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);

  useEffect(() => {
    loadPets();
    getCurrentLocation();
  }, []);

  const loadPets = async () => {
    try {
      if (customerId) {
        const response = await CustomerApi.getPets(customerId);
        const petsData = Array.isArray(response) ? response : response.pets || [];
        setPets(petsData);
        if (petsData.length > 0) {
          setSelectedPet(petsData[0]);
        }
      }
    } catch (error) {
      console.error('Error loading pets:', error);
    }
  };

  const getCurrentLocation = async () => {
    try {
      setLocationLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for emergency services');
        setLocationLoading(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });

      // Reverse geocode to get address
      const geocode = await Location.reverseGeocodeAsync({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });

      if (geocode.length > 0) {
        const addr = geocode[0];
        setAddress(
          `${addr.street || ''} ${addr.streetNumber || ''}, ${addr.city || ''}, ${addr.region || ''}`.trim()
        );
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get your location. Please enter manually.');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleBookEmergency = async () => {
    if (!selectedService || !selectedPet || !location) {
      Alert.alert('Missing Information', 'Please select service, pet, and ensure location is available');
      return;
    }

    try {
      setLoading(true);

      // Validate booking eligibility
      const validation = await BookingValidationApi.validateBooking({
        serviceType: selectedService.id,
        customerLocation: location,
      });

      if (!validation.eligible) {
        Alert.alert('Not Available', validation.message || 'Service not available at your location');
        return;
      }

      // Create emergency booking
      const bookingData = {
        phone,
        customerId,
        serviceType: selectedService.id,
        serviceName: selectedService.name,
        petId: selectedPet.id,
        petName: selectedPet.name,
        serviceStyle: 'emergency',
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          address: address || 'Current Location',
        },
        problemDescription,
        isEmergency: true,
        paymentMethod: 'post_payment', // Emergency services are post-payment
      };

      const response = await CustomerApi.createBooking(bookingData);

      if (response.bookingId || response.id) {
        Alert.alert(
          'Emergency Booking Created',
          `${selectedService.name} has been dispatched. You will receive updates shortly.`,
          [
            {
              text: 'OK',
              onPress: () => {
                if (onSuccess) {
                  onSuccess(response.bookingId || response.id);
                } else if (onNavigate) {
                  onNavigate('BookingDetail', { bookingId: response.bookingId || response.id });
                }
              },
            },
          ]
        );
      }
    } catch (error: any) {
      console.error('Error creating emergency booking:', error);
      Alert.alert('Error', error.message || 'Failed to create emergency booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Emergency Booking</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* SOS Alert Banner */}
        <View style={styles.sosBanner}>
          <Text style={styles.sosIcon}>🚨</Text>
          <View style={styles.sosContent}>
            <Text style={styles.sosTitle}>24/7 Emergency Services</Text>
            <Text style={styles.sosSubtitle}>Immediate help for your pet</Text>
          </View>
        </View>

        {/* Service Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Emergency Service</Text>
          {EMERGENCY_SERVICES.map((service) => (
            <TouchableOpacity
              key={service.id}
              style={[
                styles.serviceCard,
                selectedService?.id === service.id && styles.serviceCardSelected,
              ]}
              onPress={() => setSelectedService(service)}
            >
              <Text style={styles.serviceIcon}>{service.icon}</Text>
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceName}>{service.name}</Text>
                <Text style={styles.serviceDescription}>{service.description}</Text>
                <Text style={styles.serviceTime}>ETA: {service.estimatedTime}</Text>
              </View>
              {selectedService?.id === service.id && (
                <View style={styles.selectedIndicator}>
                  <Text style={styles.selectedCheck}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Pet Selection */}
        {pets.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Pet</Text>
            {pets.map((pet) => (
              <TouchableOpacity
                key={pet.id}
                style={[
                  styles.petCard,
                  selectedPet?.id === pet.id && styles.petCardSelected,
                ]}
                onPress={() => setSelectedPet(pet)}
              >
                <Text style={styles.petName}>{pet.name}</Text>
                <Text style={styles.petType}>{pet.type} {pet.breed ? `• ${pet.breed}` : ''}</Text>
                {selectedPet?.id === pet.id && (
                  <View style={styles.selectedIndicator}>
                    <Text style={styles.selectedCheck}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          {locationLoading ? (
            <View style={styles.locationLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.locationLoadingText}>Getting your location...</Text>
            </View>
          ) : location ? (
            <View style={styles.locationCard}>
              <Text style={styles.locationIcon}>📍</Text>
              <View style={styles.locationInfo}>
                <Text style={styles.locationText}>{address || 'Current Location'}</Text>
                <Text style={styles.locationCoords}>
                  {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                </Text>
              </View>
              <TouchableOpacity onPress={getCurrentLocation} style={styles.refreshButton}>
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={getCurrentLocation} style={styles.getLocationButton}>
              <Text style={styles.getLocationButtonText}>Get My Location</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Problem Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Problem Description (Optional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Describe the emergency situation..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
            value={problemDescription}
            onChangeText={setProblemDescription}
          />
        </View>

        {/* Book Button */}
        <TouchableOpacity
          style={[styles.bookButton, (!selectedService || !selectedPet || !location || loading) && styles.bookButtonDisabled]}
          onPress={handleBookEmergency}
          disabled={!selectedService || !selectedPet || !location || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.bookButtonText}>🚨 REQUEST EMERGENCY SERVICE</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Emergency services are dispatched immediately. Payment will be processed after service.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  placeholder: {
    width: 60,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  sosBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error + 20% opacity,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  sosIcon: {
    fontSize: 32,
    marginRight: spacing.sm,
  },
  sosContent: {
    flex: 1,
  },
  sosTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.error,
    marginBottom: spacing.xs,
  },
  sosSubtitle: {
    fontSize: 14,
    color: '#991b1b',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
  },
  serviceCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.gradientOrange50,
  },
  serviceIcon: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  serviceDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  serviceTime: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  selectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCheck: {
    color: colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  petCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
  },
  petCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.gradientOrange50,
  },
  petName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  petType: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  locationLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.gray.100,
    borderRadius: borderRadius.md,
  },
  locationLoadingText: {
    marginLeft: spacing.sm,
    fontSize: 14,
    color: colors.textSecondary,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  locationIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  locationInfo: {
    flex: 1,
  },
  locationText: {
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  locationCoords: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  refreshButton: {
    padding: spacing.xs,
  },
  refreshButtonText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  getLocationButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  getLocationButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 14,
    color: colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  bookButton: {
    backgroundColor: colors.error,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  bookButtonDisabled: {
    backgroundColor: colors.gray.400,
  },
  bookButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    padding: spacing.md,
    backgroundColor: colors.gray.100,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  footerText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

