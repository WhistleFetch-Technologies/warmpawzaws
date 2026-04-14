/**
 * Service Booking Flow Screen - Mobile
 * Single scrollable page: pet, date, time, address, summary — then confirm.
 */

import React, { useState, useEffect, useMemo } from 'react';
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

function formatChipDate(d: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cmp = new Date(d);
  cmp.setHours(0, 0, 0, 0);
  if (cmp.getTime() === today.getTime()) return 'Today';
  const tmr = new Date(today);
  tmr.setDate(tmr.getDate() + 1);
  if (cmp.getTime() === tmr.getTime()) return 'Tomorrow';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
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
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);

  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);

  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<any | null>(null);

  const [servicePrice, setServicePrice] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);

  const dateOptions = useMemo(() => {
    const out: { iso: string; label: string }[] = [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      out.push({
        iso: d.toISOString().split('T')[0],
        label: formatChipDate(d),
      });
    }
    return out;
  }, []);

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

      const customerKey = customerId || phone;
      if (customerKey) {
        const petsResponse = await CustomerApi.getPets(customerKey);
        const petsData = Array.isArray(petsResponse) ? petsResponse : petsResponse.pets || [];
        setPets(petsData);
        if (petsData.length > 0) {
          setSelectedPet(petsData[0]);
        }
      }

      const serviceResponse = await CustomerApi.getServiceDetails(serviceId);
      setServicePrice(serviceResponse.price || 0);
      setTotalAmount(serviceResponse.price || 0);

      if (customerKey) {
        try {
          const addressesResponse = await CustomerApi.getAddresses(customerKey);
          const addressesData = Array.isArray(addressesResponse)
            ? addressesResponse
            : (addressesResponse as any).addresses || [];
          setAddresses(addressesData);
          if (addressesData.length > 0) {
            const def = addressesData.find((a: any) => a.isDefault || a.is_default) || addressesData[0];
            setSelectedAddress(def);
          }
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

  const handleConfirmBooking = async () => {
    if (!selectedPet) {
      Alert.alert('Pet required', 'Please select a pet.');
      return;
    }
    if (!selectedDate || !selectedTime) {
      Alert.alert('Schedule', 'Please select a date and time.');
      return;
    }
    if (!selectedAddress) {
      Alert.alert('Address', 'Please select a service address.');
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
        Alert.alert('Booking Confirmed', 'Your booking has been confirmed successfully!', [
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
        ]);
      }
    } catch (error: any) {
      console.error('Error creating booking:', error);
      Alert.alert('Error', error.message || 'Failed to create booking');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backTap}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book {serviceName || 'Service'}</Text>
        <View style={styles.placeholder} />
      </View>

      <Text style={styles.subHeader}>All details below — scroll, then tap confirm.</Text>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionTitle}>Your pet</Text>
          {pets.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No pets found</Text>
              <TouchableOpacity style={styles.addButton} onPress={() => onNavigate && onNavigate('CustomerPetsPage')}>
                <Text style={styles.addButtonText}>+ Add Pet</Text>
              </TouchableOpacity>
            </View>
          ) : pets.length > 1 ? (
            <View style={styles.pickerWrap}>
              {pets.map((pet) => (
                <TouchableOpacity
                  key={pet.id}
                  style={[styles.petCard, selectedPet?.id === pet.id && styles.petCardSelected]}
                  onPress={() => setSelectedPet(pet)}
                >
                  <Text style={styles.petName}>{pet.name}</Text>
                  <Text style={styles.petType}>
                    {pet.type} {pet.breed && `• ${pet.breed}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={[styles.petCard, styles.petCardSelected]}>
              <Text style={styles.petName}>{pets[0].name}</Text>
              <Text style={styles.petType}>
                {pets[0].type} {pets[0].breed && `• ${pets[0].breed}`}
              </Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>Date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateStrip}>
            {dateOptions.map((d) => (
              <TouchableOpacity
                key={d.iso}
                style={[styles.dateChip, selectedDate === d.iso && styles.dateChipSelected]}
                onPress={() => {
                  setSelectedDate(d.iso);
                  setSelectedTime('');
                }}
              >
                <Text style={[styles.dateChipText, selectedDate === d.iso && styles.dateChipTextSelected]}>
                  {d.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.sectionTitle}>Time</Text>
          {!selectedDate ? (
            <Text style={styles.hint}>Pick a date first.</Text>
          ) : availableSlots.filter((s) => s.available).length === 0 ? (
            <Text style={styles.hint}>No slots for this day — try another date.</Text>
          ) : (
            <View style={styles.timeSlotsGrid}>
              {availableSlots
                .filter((slot) => slot.available)
                .map((slot, index) => (
                  <TouchableOpacity
                    key={`${slot.time}-${index}`}
                    style={[styles.timeSlot, selectedTime === slot.time && styles.timeSlotSelected]}
                    onPress={() => setSelectedTime(slot.time)}
                  >
                    <Text style={[styles.timeSlotText, selectedTime === slot.time && styles.timeSlotTextSelected]}>
                      {slot.time}
                    </Text>
                  </TouchableOpacity>
                ))}
            </View>
          )}

          <Text style={styles.sectionTitle}>Address</Text>
          {addresses.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No addresses saved</Text>
              <TouchableOpacity style={styles.addButton} onPress={() => onNavigate && onNavigate('Addresses')}>
                <Text style={styles.addButtonText}>+ Add Address</Text>
              </TouchableOpacity>
            </View>
          ) : (
            addresses.map((address) => (
              <TouchableOpacity
                key={address.id}
                style={[styles.addressCard, selectedAddress?.id === address.id && styles.addressCardSelected]}
                onPress={() => setSelectedAddress(address)}
              >
                <Text style={styles.addressName}>{address.name || address.label || 'Address'}</Text>
                <Text style={styles.addressText}>{address.address || address.addressLine1}</Text>
              </TouchableOpacity>
            ))
          )}

          <Text style={styles.sectionTitle}>Review</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Service</Text>
              <Text style={styles.summaryValue}>{serviceName}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Pet</Text>
              <Text style={styles.summaryValue}>{selectedPet?.name || '—'}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>When</Text>
              <Text style={styles.summaryValue}>
                {selectedDate || '—'} {selectedTime ? `• ${selectedTime}` : ''}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total</Text>
              <Text style={styles.summaryTotalInline}>₹{totalAmount.toLocaleString('en-IN')}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.confirmButton, submitting && styles.confirmButtonDisabled]}
            onPress={handleConfirmBooking}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.confirmButtonText}>Confirm booking</Text>
            )}
          </TouchableOpacity>
          <View style={{ height: spacing.xl }} />
        </ScrollView>
      )}
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
  backTap: {
    padding: spacing.xs,
    minWidth: 72,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 72,
  },
  subHeader: {
    fontSize: 13,
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  hint: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  dateStrip: {
    marginBottom: spacing.sm,
    maxHeight: 52,
  },
  dateChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  dateChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dateChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  dateChipTextSelected: {
    color: colors.white,
  },
  petCard: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
  },
  petCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FFF7ED',
  },
  pickerWrap: {
    marginBottom: spacing.sm,
  },
  petName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: colors.text,
  },
  petType: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  timeSlot: {
    backgroundColor: colors.white,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  timeSlotSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FFF7ED',
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
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
  },
  addressCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FFF7ED',
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
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    textAlign: 'right',
  },
  summaryTotalInline: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  confirmButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: spacing.lg,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  addButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
