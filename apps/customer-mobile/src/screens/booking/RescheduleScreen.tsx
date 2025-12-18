/**
 * Reschedule Screen - Customer Mobile App
 * Handle booking rescheduling
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
  TextInput,
} from 'react-native';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import RefundService from '../../services/RefundService';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { format, addDays } from 'date-fns';

interface RescheduleScreenProps {
  route?: {
    params?: {
      bookingId: string;
      booking?: any;
    };
  };
  navigation?: any;
}

export default function RescheduleScreen({
  route,
  navigation,
}: RescheduleScreenProps) {
  const bookingId = route?.params?.bookingId || '';
  const booking = route?.params?.booking || {};

  const [loading, setLoading] = useState(true);
  const [rescheduling, setRescheduling] = useState(false);
  const [canReschedule, setCanReschedule] = useState(false);
  const [rescheduleFee, setRescheduleFee] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [reason, setReason] = useState('');
  const [dates, setDates] = useState<Date[]>([]);

  useEffect(() => {
    checkRescheduleEligibility();
    generateDates();
  }, [bookingId]);

  useEffect(() => {
    if (selectedDate) {
      loadAvailableSlots();
    }
  }, [selectedDate, bookingId]);

  const checkRescheduleEligibility = async () => {
    try {
      setLoading(true);
      const eligibility = await RefundService.canReschedule(bookingId);
      setCanReschedule(eligibility.canReschedule);
      setRescheduleFee(eligibility.rescheduleFee || 0);
    } catch (error) {
      console.error('Error checking reschedule eligibility:', error);
      Alert.alert('Error', 'Failed to check reschedule eligibility');
    } finally {
      setLoading(false);
    }
  };

  const generateDates = () => {
    const dateList: Date[] = [];
    for (let i = 1; i < 14; i++) {
      dateList.push(addDays(new Date(), i));
    }
    setDates(dateList);
  };

  const loadAvailableSlots = async () => {
    try {
      // TODO: Fetch available slots from API
      // For now, using placeholder
      const slots = [
        '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
        '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
        '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
        '18:00', '18:30', '19:00', '19:30', '20:00',
      ];
      setAvailableSlots(slots.map((time) => ({ time, available: true })));
    } catch (error) {
      console.error('Error loading slots:', error);
    }
  };

  const handleReschedule = async () => {
    if (!selectedDate || !selectedTime) {
      Alert.alert('Required', 'Please select a new date and time');
      return;
    }

    Alert.alert(
      'Confirm Reschedule',
      `Reschedule booking to ${format(selectedDate, 'MMM d, yyyy')} at ${selectedTime}?${rescheduleFee > 0 ? ` A reschedule fee of ₹${rescheduleFee} will be charged.` : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reschedule',
          onPress: async () => {
            try {
              setRescheduling(true);
              const result = await RefundService.rescheduleBooking({
                bookingId,
                newDate: format(selectedDate, 'yyyy-MM-dd'),
                newTime: selectedTime,
                reason,
              });

              if (result) {
                Alert.alert(
                  'Booking Rescheduled',
                  result.message || 'Your booking has been rescheduled successfully.',
                  [
                    {
                      text: 'OK',
                      onPress: () => navigation?.goBack(),
                    },
                  ]
                );
              } else {
                Alert.alert('Error', 'Failed to reschedule booking');
              }
            } catch (error) {
              console.error('Error rescheduling booking:', error);
              Alert.alert('Error', 'Failed to reschedule booking');
            } finally {
              setRescheduling(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
        <Text style={[Typography.body, { marginTop: Spacing.base }]}>
          Checking eligibility...
        </Text>
      </View>
    );
  }

  if (!canReschedule) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={64} color={BrandColors.semantic.error} />
          <Text style={[Typography.h3, styles.errorTitle]}>Cannot Reschedule</Text>
          <Text style={[Typography.body, styles.errorText]}>
            This booking cannot be rescheduled. Please contact support for assistance.
          </Text>
          <BrandedButton
            title="Go Back"
            onPress={() => navigation?.goBack()}
            variant="primary"
            fullWidth
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation?.goBack()}
          >
            <Icon name="arrow-back" size={24} color={BrandColors.primary.orange} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={[Typography.h2, styles.headerTitle]}>Reschedule Booking</Text>
            <Text style={[Typography.bodySmall, styles.headerSubtitle]}>
              Select a new date and time
            </Text>
          </View>
        </View>

        {/* Reschedule Fee Notice */}
        {rescheduleFee > 0 && (
          <View style={styles.feeNotice}>
            <Icon name="info" size={20} color={BrandColors.semantic.warning} />
            <Text style={[Typography.bodySmall, styles.feeNoticeText]}>
              A reschedule fee of ₹{rescheduleFee} will be charged
            </Text>
          </View>
        )}

        {/* Date Selection */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Select New Date</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.datesContainer}
          >
            {dates.map((date, index) => {
              const isSelected =
                format(selectedDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
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
                    {format(date, 'EEE')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Time Selection */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Select New Time</Text>
          <View style={styles.timeSlotsGrid}>
            {availableSlots.map((slot, index) => {
              const isSelected = selectedTime === slot.time;
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.timeSlotCard,
                    !slot.available && styles.timeSlotCardDisabled,
                    isSelected && styles.timeSlotCardSelected,
                  ]}
                  onPress={() => slot.available && setSelectedTime(slot.time)}
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
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Reason (Optional) */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Reason (Optional)</Text>
          <TextInput
            style={styles.reasonInput}
            placeholder="Why are you rescheduling?"
            placeholderTextColor={BrandColors.neutral.gray400}
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={3}
          />
        </View>
      </ScrollView>

      {/* Reschedule Button */}
      <View style={styles.footer}>
        <BrandedButton
          title={rescheduling ? 'Rescheduling...' : 'Reschedule Booking'}
          onPress={handleReschedule}
          disabled={rescheduling || !selectedDate || !selectedTime}
          variant="primary"
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  errorTitle: {
    color: BrandColors.semantic.error,
    marginTop: Spacing.base,
    marginBottom: Spacing.sm,
  },
  errorText: {
    color: BrandColors.neutral.gray600,
    textAlign: 'center',
    marginBottom: Spacing.xl,
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
  feeNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    margin: Spacing.lg,
    padding: Spacing.base,
    backgroundColor: BrandColors.semantic.warning + '20',
    borderRadius: BorderRadius.md,
  },
  feeNoticeText: {
    color: BrandColors.semantic.warning,
    flex: 1,
  },
  section: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutral.gray200,
  },
  sectionTitle: {
    color: BrandColors.neutral.gray900,
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
    borderColor: 'transparent',
  },
  dateCardSelected: {
    backgroundColor: BrandColors.primary.orange + '10',
    borderColor: BrandColors.primary.orange,
  },
  dateTextSelected: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  dateLabel: {
    color: BrandColors.neutral.gray600,
    marginTop: Spacing.xs,
  },
  dateLabelSelected: {
    color: BrandColors.primary.orange,
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
    borderColor: 'transparent',
  },
  timeSlotCardDisabled: {
    opacity: 0.5,
  },
  timeSlotCardSelected: {
    backgroundColor: BrandColors.primary.orange + '10',
    borderColor: BrandColors.primary.orange,
  },
  timeSlotTextDisabled: {
    color: BrandColors.neutral.gray400,
  },
  timeSlotTextSelected: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  reasonInput: {
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
    ...Typography.body,
    color: BrandColors.neutral.gray900,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: BrandColors.neutral.gray200,
    backgroundColor: '#FFFFFF',
  },
});

