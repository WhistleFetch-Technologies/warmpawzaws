/**
 * Booking Check-In Screen
 * Check-in flow for boarding/resort services
 * Batch 1 - Screen 4
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { BookingActionsApi } from '../../services/api';

interface BookingCheckInScreenProps {
  bookingId: string;
  vendorId: string;
  bookingData?: any;
  onBack?: () => void;
  onComplete?: (booking: any) => void;
}

export function BookingCheckInScreen({
  bookingId,
  vendorId,
  bookingData,
  onBack,
  onComplete,
}: BookingCheckInScreenProps) {
  const [notes, setNotes] = useState('');
  const [petCondition, setPetCondition] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCheckIn = async () => {
    if (!petCondition.trim()) {
      Alert.alert('Error', 'Please document the pet condition at check-in');
      return;
    }

    setLoading(true);
    try {
      const response = await BookingActionsApi.checkIn(
        bookingId,
        vendorId,
        undefined, // staffId - can be added later
        notes,
        petCondition
      );

      if (response.success || response.booking) {
        Alert.alert('Success', 'Check-in completed successfully!', [
          {
            text: 'OK',
            onPress: () => {
              if (onComplete) {
                onComplete(response.booking || response);
              }
            },
          },
        ]);
      } else {
        Alert.alert('Error', response.error || 'Failed to complete check-in');
      }
    } catch (error: any) {
      console.error('Error checking in:', error);
      Alert.alert('Error', error.message || 'Failed to complete check-in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Check In</Text>
        <Text style={styles.subtitle}>Document pet condition and notes</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {bookingData && (
          <View style={styles.bookingInfo}>
            <Text style={styles.bookingId}>Booking ID: {bookingId}</Text>
            {bookingData.customerName && (
              <Text style={styles.customerName}>Customer: {bookingData.customerName}</Text>
            )}
            {bookingData.petName && (
              <Text style={styles.petName}>Pet: {bookingData.petName}</Text>
            )}
          </View>
        )}

        <View style={styles.formSection}>
          <Text style={styles.label}>
            Pet Condition at Check-In <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.textArea, !petCondition.trim() && styles.textAreaError]}
            value={petCondition}
            onChangeText={setPetCondition}
            placeholder="Describe the pet's condition, any injuries, behavior, etc."
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
          <Text style={styles.hint}>
            Document any visible injuries, behavior issues, or special care requirements
          </Text>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.label}>Additional Notes (Optional)</Text>
          <TextInput
            style={styles.textArea}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional notes or observations..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.checkInButton, (loading || !petCondition.trim()) && styles.checkInButtonDisabled]}
          onPress={handleCheckIn}
          disabled={loading || !petCondition.trim()}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.checkInButtonText}>Complete Check-In</Text>
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
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginBottom: spacing.sm,
  },
  backButtonText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
  title: {
    fontSize: typography.fontSizes['2xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  content: {
    padding: spacing.lg,
  },
  bookingInfo: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  bookingId: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  customerName: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs / 2,
  },
  petName: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  formSection: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  required: {
    color: colors.error,
  },
  textArea: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    fontSize: typography.fontSizes.md,
    color: colors.text,
    backgroundColor: colors.background,
    minHeight: 120,
  },
  textAreaError: {
    borderColor: colors.error,
  },
  hint: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  checkInButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    marginTop: spacing.md,
  },
  checkInButtonDisabled: {
    opacity: 0.5,
  },
  checkInButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.white,
  },
});

