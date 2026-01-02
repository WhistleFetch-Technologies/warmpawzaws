/**
 * Walker Service Screen - Mobile
 * Handles dog walking service booking flow
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
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi } from '../../services/api';

type StepType = 'select' | 'walkers' | 'confirm';

interface WalkerServiceScreenProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onViewBooking?: (bookingId: string, petId: string) => void;
  data?: any;
}

interface BookingDetails {
  petId: string;
  petName: string;
  duration: '30' | '60' | 'custom';
  customDuration?: number;
  schedule: 'morning' | 'evening' | 'anytime';
  frequency: 'single' | 'weekly' | 'monthly';
  sessionsPerDay?: number;
  walkerId?: string;
  walkerName?: string;
}

export function WalkerServiceScreen({
  phone,
  onBack,
  onNavigate,
  onViewBooking,
  data,
}: WalkerServiceScreenProps) {
  const [step, setStep] = useState<StepType>('select');
  const [loading, setLoading] = useState(false);
  const [customerId, setCustomerId] = useState<string>('');
  const [pets, setPets] = useState<any[]>([]);
  const [walkers, setWalkers] = useState<any[]>([]);
  const [selectedWalker, setSelectedWalker] = useState<any | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const [bookingDetails, setBookingDetails] = useState<BookingDetails>({
    petId: '',
    petName: '',
    duration: '30',
    schedule: 'morning',
    frequency: 'single',
    sessionsPerDay: 1,
  });

  useEffect(() => {
    loadCustomerData();
    getUserLocation();
  }, [phone]);

  const loadCustomerData = async () => {
    try {
      setLoading(true);
      const customer = await CustomerApi.getCustomerByPhone(phone);
      if (customer) {
        setCustomerId(customer.id);
        const petsData = await CustomerApi.getPets(customer.id);
        setPets(petsData || []);
      }
    } catch (error) {
      console.error('Error loading customer data:', error);
      Alert.alert('Error', 'Failed to load customer data');
    } finally {
      setLoading(false);
    }
  };

  const getUserLocation = () => {
    // TODO: Implement native location service
    // For now, use default location
    setUserLocation({ lat: 12.9716, lng: 77.5946 });
  };

  const handlePetSelect = (pet: any) => {
    setBookingDetails(prev => ({
      ...prev,
      petId: pet.id,
      petName: pet.name,
    }));
  };

  const handleDurationSelect = (duration: '30' | '60' | 'custom') => {
    setBookingDetails(prev => ({ ...prev, duration }));
  };

  const handleScheduleSelect = (schedule: 'morning' | 'evening' | 'anytime') => {
    setBookingDetails(prev => ({ ...prev, schedule }));
  };

  const handleFrequencySelect = (frequency: 'single' | 'weekly' | 'monthly') => {
    setBookingDetails(prev => ({ ...prev, frequency }));
  };

  const handleNext = () => {
    if (!bookingDetails.petId) {
      Alert.alert('Error', 'Please select a pet');
      return;
    }
    if (bookingDetails.duration === 'custom' && (!bookingDetails.customDuration || bookingDetails.customDuration < 15)) {
      Alert.alert('Error', 'Please enter a valid custom duration (minimum 15 minutes)');
      return;
    }
    loadWalkers();
    setStep('walkers');
  };

  const loadWalkers = async () => {
    try {
      setLoading(true);
      const response = await CustomerApi.searchServices({
        serviceType: 'walker',
        location: userLocation ? `${userLocation.lat},${userLocation.lng}` : '',
      });
      setWalkers(response.vendors || []);
    } catch (error) {
      console.error('Error loading walkers:', error);
      Alert.alert('Error', 'Failed to load walkers');
    } finally {
      setLoading(false);
    }
  };

  const handleWalkerSelect = (walker: any) => {
    setSelectedWalker(walker);
    setBookingDetails(prev => ({
      ...prev,
      walkerId: walker.id,
      walkerName: walker.name,
    }));
    setStep('confirm');
  };

  const handleConfirmBooking = async () => {
    try {
      setLoading(true);
      const booking = await CustomerApi.createBooking({
        vendorId: bookingDetails.walkerId!,
        petId: bookingDetails.petId!,
        duration: bookingDetails.duration === 'custom' 
          ? bookingDetails.customDuration 
          : parseInt(bookingDetails.duration),
        schedule: bookingDetails.schedule,
        frequency: bookingDetails.frequency,
        sessionsPerDay: bookingDetails.sessionsPerDay,
        serviceType: 'walker',
      });

      if (onViewBooking && booking) {
        onViewBooking(booking.id, bookingDetails.petId);
      } else {
        Alert.alert('Success', 'Booking confirmed!', [
          { text: 'OK', onPress: onBack },
        ]);
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      Alert.alert('Error', 'Failed to create booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderSelectStep = () => (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dog Walking Service</Text>
        <Text style={styles.headerSubtitle}>Book a trusted walker for your pet</Text>
      </View>

      {/* Step 1: Select Pet */}
      <View style={styles.section}>
        <View style={styles.stepHeader}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>1</Text>
          </View>
          <Text style={styles.sectionTitle}>Select Your Pet</Text>
        </View>

        {pets.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No pets found</Text>
            <Text style={styles.emptyStateSubtext}>Please add a pet profile first</Text>
          </View>
        ) : (
          <View style={styles.petList}>
            {pets.map((pet) => (
              <TouchableOpacity
                key={pet.id}
                style={[
                  styles.petCard,
                  bookingDetails.petId === pet.id && styles.petCardSelected,
                ]}
                onPress={() => handlePetSelect(pet)}
              >
                <Text style={styles.petName}>{pet.name}</Text>
                <Text style={styles.petBreed}>{pet.breed}</Text>
                {bookingDetails.petId === pet.id && (
                  <Text style={styles.selectedBadge}>✓ Selected</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Step 2: Select Duration */}
      <View style={styles.section}>
        <View style={styles.stepHeader}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>2</Text>
          </View>
          <Text style={styles.sectionTitle}>Walk Duration</Text>
        </View>

        <View style={styles.optionsRow}>
          <TouchableOpacity
            style={[
              styles.optionButton,
              bookingDetails.duration === '30' && styles.optionButtonSelected,
            ]}
            onPress={() => handleDurationSelect('30')}
          >
            <Text
              style={[
                styles.optionButtonText,
                bookingDetails.duration === '30' && styles.optionButtonTextSelected,
              ]}
            >
              30 min
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.optionButton,
              bookingDetails.duration === '60' && styles.optionButtonSelected,
            ]}
            onPress={() => handleDurationSelect('60')}
          >
            <Text
              style={[
                styles.optionButtonText,
                bookingDetails.duration === '60' && styles.optionButtonTextSelected,
              ]}
            >
              60 min
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Step 3: Select Schedule */}
      <View style={styles.section}>
        <View style={styles.stepHeader}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>3</Text>
          </View>
          <Text style={styles.sectionTitle}>Preferred Time</Text>
        </View>

        <View style={styles.optionsColumn}>
          <TouchableOpacity
            style={[
              styles.optionCard,
              bookingDetails.schedule === 'morning' && styles.optionCardSelected,
            ]}
            onPress={() => handleScheduleSelect('morning')}
          >
            <Text style={styles.optionCardText}>🌅 Morning</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.optionCard,
              bookingDetails.schedule === 'evening' && styles.optionCardSelected,
            ]}
            onPress={() => handleScheduleSelect('evening')}
          >
            <Text style={styles.optionCardText}>🌆 Evening</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.optionCard,
              bookingDetails.schedule === 'anytime' && styles.optionCardSelected,
            ]}
            onPress={() => handleScheduleSelect('anytime')}
          >
            <Text style={styles.optionCardText}>⏰ Anytime</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Step 4: Select Frequency */}
      <View style={styles.section}>
        <View style={styles.stepHeader}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>4</Text>
          </View>
          <Text style={styles.sectionTitle}>Frequency</Text>
        </View>

        <View style={styles.optionsColumn}>
          <TouchableOpacity
            style={[
              styles.optionCard,
              bookingDetails.frequency === 'single' && styles.optionCardSelected,
            ]}
            onPress={() => handleFrequencySelect('single')}
          >
            <Text style={styles.optionCardText}>One-time</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.optionCard,
              bookingDetails.frequency === 'weekly' && styles.optionCardSelected,
            ]}
            onPress={() => handleFrequencySelect('weekly')}
          >
            <Text style={styles.optionCardText}>Weekly</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.optionCard,
              bookingDetails.frequency === 'monthly' && styles.optionCardSelected,
            ]}
            onPress={() => handleFrequencySelect('monthly')}
          >
            <Text style={styles.optionCardText}>Monthly</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, !bookingDetails.petId && styles.primaryButtonDisabled]}
        onPress={handleNext}
        disabled={!bookingDetails.petId}
      >
        <Text style={styles.primaryButtonText}>Find Walkers</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderWalkersStep = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setStep('select')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Walker</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <ScrollView style={styles.walkerList}>
          {walkers.map((walker) => (
            <TouchableOpacity
              key={walker.id}
              style={styles.walkerCard}
              onPress={() => handleWalkerSelect(walker)}
            >
              <View style={styles.walkerInfo}>
                <Text style={styles.walkerName}>{walker.name}</Text>
                {walker.rating && (
                  <Text style={styles.walkerRating}>
                    ⭐ {walker.rating.toFixed(1)}
                  </Text>
                )}
                {walker.experience && (
                  <Text style={styles.walkerExperience}>
                    {walker.experience} years experience
                  </Text>
                )}
                {walker.distance && (
                  <Text style={styles.walkerDistance}>
                    📍 {walker.distance} km away
                  </Text>
                )}
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );

  const renderConfirmStep = () => {
    const durationText = bookingDetails.duration === 'custom'
      ? `${bookingDetails.customDuration} min`
      : `${bookingDetails.duration} min`;

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('walkers')}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Confirm Booking</Text>
        </View>

        <ScrollView style={styles.confirmContainer}>
          <View style={styles.bookingSummary}>
            <Text style={styles.summaryTitle}>Booking Details</Text>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Pet:</Text>
              <Text style={styles.summaryValue}>{bookingDetails.petName}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Walker:</Text>
              <Text style={styles.summaryValue}>{bookingDetails.walkerName}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Duration:</Text>
              <Text style={styles.summaryValue}>{durationText}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Time:</Text>
              <Text style={styles.summaryValue}>
                {bookingDetails.schedule === 'morning' ? 'Morning' :
                 bookingDetails.schedule === 'evening' ? 'Evening' : 'Anytime'}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Frequency:</Text>
              <Text style={styles.summaryValue}>
                {bookingDetails.frequency === 'single' ? 'One-time' :
                 bookingDetails.frequency === 'weekly' ? 'Weekly' : 'Monthly'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleConfirmBooking}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Confirm Booking</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  };

  if (loading && step === 'select') {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {step === 'select' && renderSelectStep()}
      {step === 'walkers' && renderWalkersStep()}
      {step === 'confirm' && renderConfirmStep()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: spacing.md,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
  },
  backButton: {
    fontSize: typography.body,
    color: '#fff',
    marginBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.h1,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: typography.body,
    color: '#fff',
    opacity: 0.9,
  },
  section: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  stepNumberText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: typography.body,
  },
  sectionTitle: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
  },
  petList: {
    gap: spacing.sm,
  },
  petCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  petCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FEE2E2',
  },
  petName: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  petBreed: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  selectedBadge: {
    fontSize: typography.caption,
    color: colors.primary,
    fontWeight: 'bold',
    marginTop: spacing.xs,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  emptyStateSubtext: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  optionsColumn: {
    gap: spacing.sm,
  },
  optionButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  optionButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FEE2E2',
  },
  optionButtonText: {
    fontSize: typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  optionButtonTextSelected: {
    color: colors.primary,
  },
  optionCard: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FEE2E2',
  },
  optionCardText: {
    fontSize: typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  walkerList: {
    flex: 1,
    padding: spacing.md,
  },
  walkerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  walkerInfo: {
    flex: 1,
  },
  walkerName: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  walkerRating: {
    fontSize: typography.body,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  walkerExperience: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  walkerDistance: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  chevron: {
    fontSize: 24,
    color: colors.textSecondary,
  },
  confirmContainer: {
    flex: 1,
    padding: spacing.md,
  },
  bookingSummary: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  summaryTitle: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  summaryLabel: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: typography.body,
    fontWeight: 'bold',
  },
});

