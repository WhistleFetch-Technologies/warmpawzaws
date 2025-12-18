/**
 * Setup Availability Screen - Vendor Mobile App
 * Matches web app VendorAvailabilitySetup component
 * Stage 2: Availability configuration
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { projectId, publicAnonKey } from '../../config/api';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface TimeSlot {
  start: string;
  end: string;
}

interface DayAvailability {
  enabled: boolean;
  slots: TimeSlot[];
}

interface SetupAvailabilityScreenProps {
  route?: {
    params?: {
      vendorId?: string;
    };
  };
  navigation?: any;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function SetupAvailabilityScreen({
  route,
  navigation,
}: SetupAvailabilityScreenProps) {
  const vendorId = route?.params?.vendorId || '';
  const [everydayEnabled, setEverydayEnabled] = useState(false);
  const [availability, setAvailability] = useState<Record<string, DayAvailability>>({
    monday: { enabled: false, slots: [{ start: '09:00', end: '18:00' }] },
    tuesday: { enabled: false, slots: [{ start: '09:00', end: '18:00' }] },
    wednesday: { enabled: false, slots: [{ start: '09:00', end: '18:00' }] },
    thursday: { enabled: false, slots: [{ start: '09:00', end: '18:00' }] },
    friday: { enabled: false, slots: [{ start: '09:00', end: '18:00' }] },
    saturday: { enabled: false, slots: [{ start: '09:00', end: '18:00' }] },
    sunday: { enabled: false, slots: [{ start: '09:00', end: '18:00' }] },
  });
  const [loading, setLoading] = useState(false);

  const handleEverydayToggle = (value: boolean) => {
    setEverydayEnabled(value);
    if (value) {
      const updated: Record<string, DayAvailability> = {};
      DAYS.forEach((day) => {
        const dayKey = day.toLowerCase();
        updated[dayKey] = {
          enabled: true,
          slots: [{ start: '09:00', end: '18:00' }],
        };
      });
      setAvailability(updated);
    }
  };

  const handleDayToggle = (day: string, value: boolean) => {
    const dayKey = day.toLowerCase();
    setAvailability((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        enabled: value,
      },
    }));

    if (!value && everydayEnabled) {
      setEverydayEnabled(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/schedule/update`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            vendorId,
            availability,
          }),
        }
      );

      if (response.ok) {
        if (navigation) {
          navigation.navigate('SetupCompleted');
        }
      } else {
        throw new Error('Failed to save availability');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[Typography.h2, styles.title]}>
            Set Your Availability
          </Text>
          <Text style={[Typography.bodySmall, styles.subtitle]}>
            Configure your working hours for each day
          </Text>
        </View>

        {/* Everyday Toggle */}
        <View style={styles.everydayContainer}>
          <View style={styles.everydayRow}>
            <View style={styles.everydayContent}>
              <Icon name="calendar-today" size={24} color={BrandColors.primary.orange} />
              <Text style={[Typography.body, styles.everydayText]}>
                Same hours every day
              </Text>
            </View>
            <Switch
              value={everydayEnabled}
              onValueChange={handleEverydayToggle}
              trackColor={{
                false: BrandColors.neutral.gray300,
                true: BrandColors.primary.orange,
              }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Days List */}
        <View style={styles.daysContainer}>
          {DAYS.map((day) => {
            const dayKey = day.toLowerCase();
            const dayAvailability = availability[dayKey];

            return (
              <View key={day} style={styles.dayCard}>
                <View style={styles.dayHeader}>
                  <Text style={[Typography.body, styles.dayName]}>
                    {day}
                  </Text>
                  <Switch
                    value={dayAvailability.enabled}
                    onValueChange={(value) => handleDayToggle(day, value)}
                    trackColor={{
                      false: BrandColors.neutral.gray300,
                      true: BrandColors.primary.orange,
                    }}
                    thumbColor="#FFFFFF"
                    disabled={everydayEnabled}
                  />
                </View>

                {dayAvailability.enabled && (
                  <View style={styles.timeSlotContainer}>
                    {dayAvailability.slots.map((slot, index) => (
                      <View key={index} style={styles.timeSlot}>
                        <Text style={[Typography.body, styles.timeText]}>
                          {slot.start} - {slot.end}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <BrandedButton
          title={loading ? 'Saving...' : 'Save & Continue'}
          onPress={handleSave}
          disabled={loading}
          fullWidth
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: Spacing.xl,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    color: BrandColors.neutral.gray600,
  },
  everydayContainer: {
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    marginBottom: Spacing.xl,
  },
  everydayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  everydayContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
  },
  everydayText: {
    color: BrandColors.neutral.gray900,
    fontWeight: '600',
  },
  daysContainer: {
    gap: Spacing.base,
    marginBottom: Spacing.xl,
  },
  dayCard: {
    backgroundColor: BrandColors.neutral.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  dayName: {
    color: BrandColors.neutral.gray900,
    fontWeight: '600',
  },
  timeSlotContainer: {
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  timeSlot: {
    backgroundColor: BrandColors.neutral.gray100,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
  },
  timeText: {
    color: BrandColors.neutral.gray700,
  },
});

