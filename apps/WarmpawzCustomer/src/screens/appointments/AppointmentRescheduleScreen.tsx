/**
 * Appointment Reschedule Screen - Mobile
 * Reschedule appointment with date/time selection
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
import { colors, spacing, borderRadius } from '../../theme/colors';
import { AppointmentApi, ReschedulingApi } from '../../services/api';

interface AppointmentRescheduleScreenProps {
  appointmentId: string;
  currentDate?: string;
  currentTime?: string;
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onSuccess?: () => void;
}

export function AppointmentRescheduleScreen({
  appointmentId,
  currentDate,
  currentTime,
  phone,
  onBack,
  onNavigate,
  onSuccess,
}: AppointmentRescheduleScreenProps) {
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [rescheduleOptions, setRescheduleOptions] = useState<any[]>([]);

  useEffect(() => {
    loadRescheduleOptions();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      loadAvailableSlots();
    }
  }, [selectedDate]);

  const loadRescheduleOptions = async () => {
    try {
      const response = await ReschedulingApi.getRescheduleOptions(appointmentId);
      setRescheduleOptions(response.options || []);
    } catch (error) {
      console.error('Error loading reschedule options:', error);
    }
  };

  const loadAvailableSlots = async () => {
    try {
      // TODO: Call actual availability API
      // For now, use mock slots
      const mockSlots = [
        '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
        '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM',
      ];
      setAvailableSlots(mockSlots);
    } catch (error) {
      console.error('Error loading slots:', error);
    }
  };

  const handleReschedule = async () => {
    if (!selectedDate || !selectedTime) {
      Alert.alert('Error', 'Please select both date and time');
      return;
    }

    try {
      setLoading(true);
      await AppointmentApi.rescheduleAppointment(
        appointmentId,
        selectedDate,
        selectedTime,
        reason || undefined
      );

      Alert.alert(
        'Appointment Rescheduled',
        'Your appointment has been rescheduled successfully.',
        [
          {
            text: 'OK',
            onPress: () => {
              if (onSuccess) {
                onSuccess();
              } else if (onNavigate) {
                onNavigate('AppointmentDetail', { appointmentId });
              }
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error rescheduling appointment:', error);
      Alert.alert('Error', error.message || 'Failed to reschedule appointment');
    } finally {
      setLoading(false);
    }
  };

  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reschedule Appointment</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Current Appointment */}
        {currentDate && currentTime && (
          <View style={styles.currentAppointment}>
            <Text style={styles.currentLabel}>Current Appointment</Text>
            <Text style={styles.currentDate}>
              {new Date(currentDate).toLocaleDateString()} at {currentTime}
            </Text>
          </View>
        )}

        {/* Date Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select New Date</Text>
          <TextInput
            style={styles.dateInput}
            placeholder="Select date"
            value={selectedDate}
            onChangeText={setSelectedDate}
            // TODO: Use proper date picker component
          />
          <Text style={styles.helperText}>
            Select a date at least 24 hours in advance
          </Text>
        </View>

        {/* Time Selection */}
        {selectedDate && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Time Slot</Text>
            <View style={styles.timeSlots}>
              {availableSlots.map((slot) => (
                <TouchableOpacity
                  key={slot}
                  style={[
                    styles.timeSlot,
                    selectedTime === slot && styles.timeSlotSelected,
                  ]}
                  onPress={() => setSelectedTime(slot)}
                >
                  <Text
                    style={[
                      styles.timeSlotText,
                      selectedTime === slot && styles.timeSlotTextSelected,
                    ]}
                  >
                    {slot}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Reason (Optional) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reason for Rescheduling (Optional)</Text>
          <TextInput
            style={styles.reasonInput}
            placeholder="Enter reason..."
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Reschedule Button */}
        <TouchableOpacity
          style={[styles.rescheduleButton, (!selectedDate || !selectedTime || loading) && styles.rescheduleButtonDisabled]}
          onPress={handleReschedule}
          disabled={!selectedDate || !selectedTime || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.rescheduleButtonText}>Reschedule Appointment</Text>
          )}
        </TouchableOpacity>
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
  currentAppointment: {
    backgroundColor: colors.primary.50,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  currentLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  currentDate: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
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
  dateInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 14,
    color: colors.text,
  },
  helperText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  timeSlots: {
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
    backgroundColor: colors.primary.50,
  },
  timeSlotText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  timeSlotTextSelected: {
    color: colors.primary,
  },
  reasonInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 14,
    color: colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  rescheduleButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  rescheduleButtonDisabled: {
    backgroundColor: colors.gray.400,
  },
  rescheduleButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

