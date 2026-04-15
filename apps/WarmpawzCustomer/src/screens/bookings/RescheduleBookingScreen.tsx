/**
 * Reschedule Booking Screen - Mobile
 * Allow customers to reschedule their bookings
 * Identical functionality to web app
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { ScreenShell } from '../../components/layout/ScreenShell';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi, ReschedulingApi } from '../../services/api';

interface RescheduleBookingScreenProps {
  bookingId: string;
  phone: string;
  currentDate?: string;
  currentTime?: string;
  onBack: () => void;
  onSuccess?: () => void;
}

interface TimeSlot {
  date: string;
  timeSlot: string;
}

export function RescheduleBookingScreen({
  bookingId,
  phone,
  currentDate,
  currentTime,
  onBack,
  onSuccess,
}: RescheduleBookingScreenProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [reason, setReason] = useState('');
  const [policy, setPolicy] = useState<{
    canReschedule: boolean;
    rules: string[];
    fee: number;
    reason?: string;
  } | null>(null);

  useEffect(() => {
    loadRescheduleData();
  }, [bookingId]);

  const loadRescheduleData = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call when available
      // For now, using mock data
      setPolicy({
        canReschedule: true,
        rules: [
          'Reschedule up to 12 hours before booking',
          'Maximum 2 reschedules per booking',
          'No fee for reschedules 24+ hours in advance',
        ],
        fee: 0,
      });

      // Mock available slots
      const mockSlots: TimeSlot[] = [
        { date: new Date(Date.now() + 86400000).toISOString().split('T')[0], timeSlot: '09:00 AM' },
        { date: new Date(Date.now() + 86400000).toISOString().split('T')[0], timeSlot: '11:00 AM' },
        { date: new Date(Date.now() + 86400000).toISOString().split('T')[0], timeSlot: '02:00 PM' },
        { date: new Date(Date.now() + 86400000).toISOString().split('T')[0], timeSlot: '04:00 PM' },
        { date: new Date(Date.now() + 172800000).toISOString().split('T')[0], timeSlot: '09:00 AM' },
        { date: new Date(Date.now() + 172800000).toISOString().split('T')[0], timeSlot: '11:00 AM' },
        { date: new Date(Date.now() + 172800000).toISOString().split('T')[0], timeSlot: '02:00 PM' },
        { date: new Date(Date.now() + 172800000).toISOString().split('T')[0], timeSlot: '04:00 PM' },
      ];
      setSlots(mockSlots);
    } catch (error) {
      console.error('Error loading reschedule data:', error);
      Alert.alert('Error', 'Failed to load reschedule options');
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!selectedSlot) {
      Alert.alert('Error', 'Please select a new date and time');
      return;
    }

    try {
      setSubmitting(true);
      const response = await CustomerApi.rescheduleBooking(
        bookingId,
        selectedSlot.date,
        selectedSlot.timeSlot,
        reason
      );

      Alert.alert('Success', 'Booking rescheduled successfully!', [
        { text: 'OK', onPress: () => onSuccess?.() || onBack() },
      ]);
    } catch (error) {
      console.error('Error rescheduling booking:', error);
      Alert.alert('Error', 'Failed to reschedule booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  // Group slots by date
  const slotsByDate = slots.reduce((acc, slot) => {
    const date = slot.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(slot);
    return acc;
  }, {} as Record<string, TimeSlot[]>);

  if (loading) {
    return (
      <ScreenShell style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Reschedule Booking</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenShell>
    );
  }

  if (policy && !policy.canReschedule) {
    return (
      <ScreenShell style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Reschedule Booking</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Cannot Reschedule</Text>
          <Text style={styles.errorText}>
            {policy.reason || 'Rescheduling is not available for this booking'}
          </Text>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reschedule Booking</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Current Booking Info */}
        {currentDate && (
          <View style={styles.currentBookingCard}>
            <Text style={styles.currentBookingLabel}>Current Schedule</Text>
            <Text style={styles.currentBookingDate}>
              {formatDate(currentDate)}
            </Text>
            {currentTime && (
              <Text style={styles.currentBookingTime}>{currentTime}</Text>
            )}
          </View>
        )}

        {/* Policy Info */}
        {policy && (
          <View style={styles.policyCard}>
            <Text style={styles.policyIcon}>ℹ️</Text>
            <View style={styles.policyContent}>
              <Text style={styles.policyTitle}>Rescheduling Policy</Text>
              {policy.rules.map((rule, idx) => (
                <Text key={idx} style={styles.policyRule}>
                  • {rule}
                </Text>
              ))}
              {policy.fee > 0 && (
                <Text style={styles.policyFee}>
                  Rescheduling Fee: ₹{policy.fee}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Available Slots */}
        <View style={styles.slotsCard}>
          <Text style={styles.slotsTitle}>Select New Date & Time</Text>
          {Object.keys(slotsByDate).length === 0 ? (
            <Text style={styles.noSlotsText}>No available slots found</Text>
          ) : (
            <View style={styles.slotsContainer}>
              {Object.entries(slotsByDate).map(([date, dateSlots]) => (
                <View key={date} style={styles.dateGroup}>
                  <View style={styles.dateHeader}>
                    <Text style={styles.dateIcon}>📅</Text>
                    <Text style={styles.dateText}>{formatDate(date)}</Text>
                  </View>
                  <View style={styles.timeSlotsGrid}>
                    {dateSlots.map((slot, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.timeSlotButton,
                          selectedSlot?.date === slot.date &&
                            selectedSlot?.timeSlot === slot.timeSlot &&
                            styles.timeSlotButtonSelected,
                        ]}
                        onPress={() => setSelectedSlot(slot)}
                      >
                        <Text style={styles.timeSlotIcon}>🕐</Text>
                        <Text
                          style={[
                            styles.timeSlotText,
                            selectedSlot?.date === slot.date &&
                              selectedSlot?.timeSlot === slot.timeSlot &&
                              styles.timeSlotTextSelected,
                          ]}
                        >
                          {slot.timeSlot}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Reason */}
        {selectedSlot && (
          <View style={styles.reasonCard}>
            <Text style={styles.reasonTitle}>Reason (Optional)</Text>
            <TextInput
              style={styles.reasonInput}
              value={reason}
              onChangeText={setReason}
              placeholder="Why are you rescheduling?"
              multiline
              numberOfLines={4}
            />
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!selectedSlot || submitting) && styles.submitButtonDisabled,
            ]}
            onPress={handleReschedule}
            disabled={!selectedSlot || submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.submitButtonText}>Confirm Reschedule</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
  },
  backButton: {
    fontSize: typography.body,
    color: colors.white,
    marginRight: spacing.md,
  },
  headerTitle: {
    fontSize: typography.h1,
    fontWeight: 'bold',
    color: colors.white,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  errorTitle: {
    fontSize: typography.h2,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  currentBookingCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  currentBookingLabel: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  currentBookingDate: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  currentBookingTime: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  policyCard: {
    backgroundColor: '#DBEAFE',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#93C5FD',
    flexDirection: 'row',
  },
  policyIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  policyContent: {
    flex: 1,
  },
  policyTitle: {
    fontSize: typography.body,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  policyRule: {
    fontSize: typography.caption,
    color: colors.text,
    marginBottom: spacing.xs,
    lineHeight: 18,
  },
  policyFee: {
    fontSize: typography.body,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: spacing.sm,
  },
  slotsCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  slotsTitle: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  noSlotsText: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    padding: spacing.xl,
  },
  slotsContainer: {
    gap: spacing.lg,
  },
  dateGroup: {
    marginBottom: spacing.lg,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dateIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  dateText: {
    fontSize: typography.body,
    fontWeight: 'bold',
    color: colors.text,
  },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  timeSlotButton: {
    width: '30%',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.gray['200'],
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  timeSlotButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.error + 20% opacity,
  },
  timeSlotIcon: {
    fontSize: 20,
    marginBottom: spacing.xs,
  },
  timeSlotText: {
    fontSize: typography.caption,
    fontWeight: '600',
    color: colors.text,
  },
  timeSlotTextSelected: {
    color: colors.primary,
  },
  reasonCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  reasonTitle: {
    fontSize: typography.body,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  reasonInput: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
    fontSize: typography.body,
    color: colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  actionsContainer: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: colors.gray['200'],
  },
  submitButtonText: {
    color: colors.white,
    fontSize: typography.body,
    fontWeight: 'bold',
  },
});

