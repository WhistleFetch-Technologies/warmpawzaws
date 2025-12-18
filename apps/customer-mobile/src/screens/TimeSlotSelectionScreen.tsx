/**
 * Time Slot Selection Screen - Customer Mobile App
 * Select time slots for booking (single session & subscription packages)
 * Matches web app TimeSlotSelector
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { projectId, publicAnonKey } from '../../config/api';
import SubscriptionService, { TIME_WINDOWS } from '../../services/SubscriptionService';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { format, addDays, isToday, isTomorrow } from 'date-fns';

interface TimeSlot {
  time: string;
  available: boolean;
  reason?: string;
}

interface TimeSlotSelectionScreenProps {
  route?: {
    params?: {
      vendorId?: string;
      serviceId?: string;
      serviceType?: 'center' | 'home' | 'tele';
      petId?: string;
      services?: any[];
      isPackage?: boolean;
    };
  };
  navigation?: any;
}

// Use TIME_WINDOWS from SubscriptionService
const TIME_SLOTS = {
  morning: { start: '08:00', end: '12:00', label: 'Morning (8 AM - 12 PM)' },
  afternoon: { start: '12:00', end: '16:00', label: 'Afternoon (12 PM - 4 PM)' },
  evening: { start: '16:00', end: '20:00', label: 'Evening (4 PM - 8 PM)' },
};

const SINGLE_SESSION_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00',
];

export default function TimeSlotSelectionScreen({
  route,
  navigation,
}: TimeSlotSelectionScreenProps) {
  const vendorId = route?.params?.vendorId || '';
  const serviceId = route?.params?.serviceId || '';
  const serviceType = route?.params?.serviceType || 'center';
  const petId = route?.params?.petId || '';
  const services = route?.params?.services || [];
  const isPackage = route?.params?.isPackage || services[0]?.isPackage || false;

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [selectedPackageSlot, setSelectedPackageSlot] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [dates, setDates] = useState<Date[]>([]);

  useEffect(() => {
    generateDates();
    loadAvailableSlots();
  }, [selectedDate, vendorId, serviceId]);

  const generateDates = () => {
    const dateList: Date[] = [];
    for (let i = 0; i < 14; i++) {
      dateList.push(addDays(new Date(), i));
    }
    setDates(dateList);
  };

  const loadAvailableSlots = async () => {
    try {
      setLoading(true);
      // TODO: Implement API call to fetch available slots
      // For now, using placeholder logic
      if (isPackage) {
        // Package slots are always available (general time windows)
        setAvailableSlots([]);
      } else {
        // Single session - fetch specific time slots
        const slots: TimeSlot[] = SINGLE_SESSION_SLOTS.map((time) => ({
          time,
          available: Math.random() > 0.3, // Placeholder: 70% availability
        }));
        setAvailableSlots(slots);
      }
    } catch (error) {
      console.error('Error loading slots:', error);
      Alert.alert('Error', 'Failed to load available time slots');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEE, MMM d');
  };

  const handleContinue = () => {
    if (!selectedDate) {
      Alert.alert('Select Date', 'Please select a date');
      return;
    }

    if (isPackage && !selectedPackageSlot) {
      Alert.alert('Select Time Slot', 'Please select a time slot');
      return;
    }

    if (!isPackage && !selectedTimeSlot) {
      Alert.alert('Select Time', 'Please select a time');
      return;
    }

    const bookingData = {
      vendorId,
      serviceId,
      serviceType,
      petId,
      services,
      scheduledDate: format(selectedDate, 'yyyy-MM-dd'),
      scheduledTime: isPackage ? selectedPackageSlot : selectedTimeSlot,
      isPackage,
    };

    // Navigate to address selection for home services, otherwise to payment
    if (serviceType === 'home') {
      navigation?.navigate('AddressSelection', { bookingData });
    } else {
      navigation?.navigate('Payment', { bookingData });
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation?.goBack()}
          >
            <Icon name="arrow-back" size={24} color={BrandColors.primary.orange} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={[Typography.h2, styles.headerTitle]}>Select Time</Text>
            <Text style={[Typography.bodySmall, styles.headerSubtitle]}>
              {isPackage ? 'Choose your preferred time slot' : 'Select date and time'}
            </Text>
          </View>
        </View>

        {/* Date Selection */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Select Date</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.datesContainer}
          >
            {dates.map((date, index) => {
              const isSelected = format(selectedDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.dateCard, isSelected && styles.dateCardSelected]}
                  onPress={() => setSelectedDate(date)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      Typography.bodySmall,
                      isSelected && styles.dateTextSelected,
                    ]}
                  >
                    {format(date, 'd')}
                  </Text>
                  <Text
                    style={[
                      Typography.bodyTiny,
                      styles.dateLabel,
                      isSelected && styles.dateLabelSelected,
                    ]}
                  >
                    {formatDate(date)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Time Slot Selection */}
        {isPackage ? (
          <View style={styles.section}>
            <Text style={[Typography.h3, styles.sectionTitle]}>Time Slot</Text>
            <Text style={[Typography.bodySmall, styles.sectionDescription]}>
              Select your preferred time window for package sessions
            </Text>
            <View style={styles.packageSlots}>
              {Object.entries(TIME_SLOTS).map(([key, slot]) => {
                const isSelected = selectedPackageSlot === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.packageSlotCard,
                      isSelected && styles.packageSlotCardSelected,
                    ]}
                    onPress={() => setSelectedPackageSlot(key)}
                    activeOpacity={0.7}
                  >
                    <Icon
                      name={isSelected ? 'radio-button-checked' : 'radio-button-unchecked'}
                      size={24}
                      color={isSelected ? BrandColors.primary.orange : BrandColors.neutral.gray400}
                    />
                    <View style={styles.packageSlotInfo}>
                      <Text
                        style={[
                          Typography.body,
                          styles.packageSlotLabel,
                          isSelected && styles.packageSlotLabelSelected,
                        ]}
                      >
                        {slot.label}
                      </Text>
                      <Text style={[Typography.bodyTiny, styles.packageSlotTime]}>
                        {slot.start} - {slot.end}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={[Typography.h3, styles.sectionTitle]}>Available Times</Text>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={BrandColors.primary.orange} />
                <Text style={[Typography.bodySmall, styles.loadingText]}>
                  Loading available slots...
                </Text>
              </View>
            ) : (
              <View style={styles.timeSlotsGrid}>
                {availableSlots.map((slot, index) => {
                  const isSelected = selectedTimeSlot === slot.time;
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.timeSlotCard,
                        !slot.available && styles.timeSlotCardDisabled,
                        isSelected && styles.timeSlotCardSelected,
                      ]}
                      onPress={() => slot.available && setSelectedTimeSlot(slot.time)}
                      disabled={!slot.available}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          Typography.body,
                          !slot.available && styles.timeSlotTextDisabled,
                          isSelected && styles.timeSlotTextSelected,
                        ]}
                      >
                        {slot.time}
                      </Text>
                      {!slot.available && (
                        <Text style={[Typography.bodyTiny, styles.unavailableText]}>
                          Unavailable
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.footer}>
        <BrandedButton
          title="Continue"
          onPress={handleContinue}
          disabled={!selectedDate || (isPackage ? !selectedPackageSlot : !selectedTimeSlot)}
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl + 80,
  },
  header: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutral.gray200,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    color: BrandColors.neutral.gray600,
  },
  section: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.sm,
  },
  sectionDescription: {
    color: BrandColors.neutral.gray600,
    marginBottom: Spacing.base,
  },
  datesContainer: {
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  dateCard: {
    width: 70,
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: BrandColors.neutral.gray200,
    marginRight: Spacing.sm,
  },
  dateCardSelected: {
    backgroundColor: BrandColors.primary.orange,
    borderColor: BrandColors.primary.orange,
  },
  dateTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  dateLabel: {
    color: BrandColors.neutral.gray600,
    marginTop: Spacing.xs,
  },
  dateLabelSelected: {
    color: '#FFFFFF',
  },
  packageSlots: {
    gap: Spacing.base,
  },
  packageSlotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: BrandColors.neutral.gray200,
    gap: Spacing.base,
  },
  packageSlotCardSelected: {
    borderColor: BrandColors.primary.orange,
    backgroundColor: BrandColors.primary.orange + '10',
  },
  packageSlotInfo: {
    flex: 1,
  },
  packageSlotLabel: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.xs,
  },
  packageSlotLabelSelected: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  packageSlotTime: {
    color: BrandColors.neutral.gray600,
  },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  timeSlotCard: {
    width: '30%',
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: BrandColors.neutral.gray200,
  },
  timeSlotCardDisabled: {
    opacity: 0.5,
    borderColor: BrandColors.neutral.gray300,
  },
  timeSlotCardSelected: {
    borderColor: BrandColors.primary.orange,
    backgroundColor: BrandColors.primary.orange + '10',
  },
  timeSlotTextDisabled: {
    color: BrandColors.neutral.gray400,
  },
  timeSlotTextSelected: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  unavailableText: {
    color: BrandColors.semantic.error,
    marginTop: Spacing.xs,
  },
  loadingContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.base,
  },
  loadingText: {
    color: BrandColors.neutral.gray600,
  },
  footer: {
    padding: Spacing.lg,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: BrandColors.neutral.gray200,
  },
});

