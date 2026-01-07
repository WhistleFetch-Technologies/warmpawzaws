/**
 * Service Booking Flow Screen - Mobile
 * Complete service booking flow with all steps
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
import { colors, spacing, borderRadius } from '../../theme/colors';
import { CustomerApi, SlotAvailabilityApi } from '../../services/api';

interface ServiceBookingFlowScreenProps {
  serviceId: string;
  vendorId: string;
  serviceName: string;
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

interface TimeSlot {
  date: string;
  time: string;
  available: boolean;
}

export function ServiceBookingFlowScreen({
  serviceId,
  vendorId,
  serviceName,
  phone,
  customerId,
  onBack,
  onNavigate,
  onSuccess,
}: ServiceBookingFlowScreenProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Step 1: Pet Selection
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  
  // Step 2: Date/Time Selection
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  
  // Step 3: Address Selection
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<any | null>(null);
  
  // Step 4: Price & Confirmation
  const [servicePrice, setServicePrice] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      loadAvailableSlots();
    }
  }, [selectedDate]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Load pets
      if (customerId) {
        const petsResponse = await CustomerApi.getPets(customerId);
        const petsData = Array.isArray(petsResponse) ? petsResponse : petsResponse.pets || [];
        setPets(petsData);
        if (petsData.length > 0) {
          setSelectedPet(petsData[0]);
        }
      }

      // Load service price
      const serviceResponse = await CustomerApi.getServiceDetails(serviceId);
      setServicePrice(serviceResponse.price || 0);
      setTotalAmount(serviceResponse.price || 0);

      // Load addresses
      if (customerId) {
        try {
          const addressesResponse = await CustomerApi.getAddresses(customerId);
          const addressesData = Array.isArray(addressesResponse) ? addressesResponse : (addressesResponse as any).addresses || [];
          setAddresses(addressesData);
        } catch (error) {
          console.error('Error loading addresses:', error);
          setAddresses([]);
        }
      } else {
        setAddresses([]);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableSlots = async () => {
    try {
      const response = await SlotAvailabilityApi.getAvailableSlots(vendorId, serviceId, selectedDate);
      setAvailableSlots(response.slots || []);
    } catch (error) {
      console.error('Error loading slots:', error);
    }
  };

  const handleNext = () => {
    if (step === 1 && !selectedPet) {
      Alert.alert('Error', 'Please select a pet');
      return;
    }
    if (step === 2 && (!selectedDate || !selectedTime)) {
      Alert.alert('Error', 'Please select date and time');
      return;
    }
    if (step === 3 && !selectedAddress) {
      Alert.alert('Error', 'Please select an address');
      return;
    }
    
    if (step < 4) {
      setStep((step + 1) as 1 | 2 | 3 | 4);
    } else {
      handleConfirmBooking();
    }
  };

  const handleConfirmBooking = async () => {
    if (!selectedPet || !selectedDate || !selectedTime) {
      Alert.alert('Error', 'Please complete all steps');
      return;
    }

    try {
      setSubmitting(true);
      const bookingData = {
        phone,
        customerId,
        serviceId,
        serviceName,
        vendorId,
        petId: selectedPet.id,
        petName: selectedPet.name,
        serviceStyle: 'at_center',
        appointmentDate: selectedDate,
        appointmentTime: selectedTime,
        addressId: selectedAddress?.id,
        price: servicePrice,
        totalAmount,
      };

      const response = await CustomerApi.createBooking(bookingData);

      if (response.bookingId || response.id) {
        Alert.alert(
          'Booking Confirmed',
          'Your booking has been confirmed successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                if (onSuccess) {
                  onSuccess(response.bookingId || response.id);
                } else if (onNavigate) {
                  onNavigate('BookingConfirmation', { bookingId: response.bookingId || response.id });
                }
              },
            },
          ]
        );
      }
    } catch (error: any) {
      console.error('Error creating booking:', error);
      Alert.alert('Error', error.message || 'Failed to create booking');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Select Pet</Text>
      {pets.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No pets found</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => onNavigate && onNavigate('CustomerPetsPage')}
          >
            <Text style={styles.addButtonText}>+ Add Pet</Text>
          </TouchableOpacity>
        </View>
      ) : (
        pets.map((pet) => (
          <TouchableOpacity
            key={pet.id}
            style={[
              styles.petCard,
              selectedPet?.id === pet.id && styles.petCardSelected,
            ]}
            onPress={() => setSelectedPet(pet)}
          >
            <Text style={styles.petName}>{pet.name}</Text>
            <Text style={styles.petType}>{pet.type} {pet.breed && `• ${pet.breed}`}</Text>
            {selectedPet?.id === pet.id && (
              <View style={styles.selectedIndicator}>
                <Text style={styles.selectedCheck}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Select Date & Time</Text>
      <TouchableOpacity style={styles.dateButton}>
        <Text style={styles.dateButtonText}>
          {selectedDate || 'Select Date'}
        </Text>
      </TouchableOpacity>
      
      {selectedDate && availableSlots.length > 0 && (
        <View style={styles.timeSlotsContainer}>
          <Text style={styles.timeSlotsTitle}>Available Times</Text>
          <View style={styles.timeSlotsGrid}>
            {availableSlots
              .filter(slot => slot.available)
              .map((slot, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.timeSlot,
                    selectedTime === slot.time && styles.timeSlotSelected,
                  ]}
                  onPress={() => setSelectedTime(slot.time)}
                >
                  <Text
                    style={[
                      styles.timeSlotText,
                      selectedTime === slot.time && styles.timeSlotTextSelected,
                    ]}
                  >
                    {slot.time}
                  </Text>
                </TouchableOpacity>
              ))}
          </View>
        </View>
      )}
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Select Address</Text>
      {addresses.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No addresses found</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => onNavigate && onNavigate('Addresses')}
          >
            <Text style={styles.addButtonText}>+ Add Address</Text>
          </TouchableOpacity>
        </View>
      ) : (
        addresses.map((address) => (
          <TouchableOpacity
            key={address.id}
            style={[
              styles.addressCard,
              selectedAddress?.id === address.id && styles.addressCardSelected,
            ]}
            onPress={() => setSelectedAddress(address)}
          >
            <Text style={styles.addressName}>{address.name}</Text>
            <Text style={styles.addressText}>{address.address}</Text>
            {selectedAddress?.id === address.id && (
              <View style={styles.selectedIndicator}>
                <Text style={styles.selectedCheck}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Confirm Booking</Text>
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Service</Text>
          <Text style={styles.summaryValue}>{serviceName}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Pet</Text>
          <Text style={styles.summaryValue}>{selectedPet?.name}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Date & Time</Text>
          <Text style={styles.summaryValue}>
            {selectedDate} at {selectedTime}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Service Price</Text>
          <Text style={styles.summaryValue}>₹{servicePrice.toLocaleString()}</Text>
        </View>
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>₹{totalAmount.toLocaleString()}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book Service</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Progress Steps */}
      <View style={styles.progressContainer}>
        {[1, 2, 3, 4].map((stepNum) => (
          <View key={stepNum} style={styles.progressStep}>
            <View
              style={[
                styles.progressCircle,
                step >= stepNum && styles.progressCircleActive,
              ]}
            >
              {step > stepNum ? (
                <Text style={styles.progressCheck}>✓</Text>
              ) : (
                <Text style={styles.progressNumber}>{stepNum}</Text>
              )}
            </View>
            {stepNum < 4 && (
              <View
                style={[
                  styles.progressLine,
                  step > stepNum && styles.progressLineActive,
                ]}
              />
            )}
          </View>
        ))}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
          </>
        )}
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={styles.actions}>
        {step > 1 && (
          <TouchableOpacity
            style={styles.backButtonAction}
            onPress={() => setStep((step - 1) as 1 | 2 | 3 | 4)}
          >
            <Text style={styles.backButtonActionText}>Previous</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.nextButton, submitting && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.nextButtonText}>
              {step === 4 ? 'Confirm Booking' : 'Next'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
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
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  progressCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gray['200'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCircleActive: {
    backgroundColor: colors.primary,
  },
  progressCheck: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressNumber: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.gray['200'],
    marginHorizontal: spacing.xs,
  },
  progressLineActive: {
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  stepContent: {
    marginBottom: spacing.lg,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  petCard: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  petCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.gradientOrange50,
  },
  petName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  petType: {
    fontSize: 14,
    color: colors.textSecondary,
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
  dateButton: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  dateButtonText: {
    fontSize: 16,
    color: colors.text,
  },
  timeSlotsContainer: {
    marginTop: spacing.md,
  },
  timeSlotsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  timeSlot: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    minWidth: 100,
    alignItems: 'center',
  },
  timeSlotSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.gradientOrange50,
  },
  timeSlotText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  timeSlotTextSelected: {
    color: colors.primary,
  },
  addressCard: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addressCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.gradientOrange50,
  },
  addressName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  addressText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  summaryCard: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginTop: spacing.md,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  addButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  addButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  backButtonAction: {
    flex: 1,
    backgroundColor: colors.gray['100'],
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  backButtonActionText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    flex: 2,
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: colors.gray['400'],
  },
  nextButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

