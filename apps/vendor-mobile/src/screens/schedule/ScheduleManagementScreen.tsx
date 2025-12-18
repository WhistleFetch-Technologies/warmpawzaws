/**
 * Schedule Management Screen - Vendor Mobile App
 * Comprehensive scheduling management with time windows, buffer times, and availability
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
  Switch,
  TextInput,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import SchedulingService, { DayAvailability, ServiceSlotConfig } from '../../services/SchedulingService';
import Icon from 'react-native-vector-icons/MaterialIcons';

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
] as const;

export default function ScheduleManagementScreen({ navigation }: any) {
  const { vendor } = useAuth();
  const vendorId = vendor?.id || '';

  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [scheduleSettings, setScheduleSettings] = useState<any>(null);

  useEffect(() => {
    loadSchedule();
  }, [vendorId]);

  const loadSchedule = async () => {
    if (!vendorId) return;

    try {
      setLoading(true);
      const [availabilityData, settings] = await Promise.all([
        SchedulingService.getVendorAvailability(vendorId),
        SchedulingService.getScheduleSettings(),
      ]);

      if (availabilityData) {
        // Initialize days if not present
        const daysMap = new Map<string, DayAvailability>();
        availabilityData.availability.forEach((day) => {
          daysMap.set(day.dayOfWeek, day);
        });

        const initializedAvailability: DayAvailability[] = DAYS_OF_WEEK.map((day) => {
          const existing = daysMap.get(day.key);
          return existing || {
            dayOfWeek: day.key,
            timeWindows: [],
            serviceConfigs: [],
            isEnabled: false,
          };
        });

        setAvailability(initializedAvailability);
      }

      if (settings) {
        setScheduleSettings(settings);
      }
    } catch (error) {
      console.error('Error loading schedule:', error);
      Alert.alert('Error', 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (dayKey: string) => {
    setAvailability((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayKey
          ? { ...day, isEnabled: !day.isEnabled }
          : day
      )
    );
  };

  const addTimeWindow = (dayKey: string) => {
    setAvailability((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayKey
          ? {
              ...day,
              timeWindows: [
                ...day.timeWindows,
                {
                  startTime: '09:00',
                  endTime: '18:00',
                  isEnabled: true,
                  maxBookings: 3,
                },
              ],
            }
          : day
      )
    );
  };

  const updateTimeWindow = (
    dayKey: string,
    windowIndex: number,
    updates: Partial<{ startTime: string; endTime: string; isEnabled: boolean; maxBookings: number }>
  ) => {
    setAvailability((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayKey
          ? {
              ...day,
              timeWindows: day.timeWindows.map((window, idx) =>
                idx === windowIndex ? { ...window, ...updates } : window
              ),
            }
          : day
      )
    );
  };

  const removeTimeWindow = (dayKey: string, windowIndex: number) => {
    setAvailability((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayKey
          ? {
              ...day,
              timeWindows: day.timeWindows.filter((_, idx) => idx !== windowIndex),
            }
          : day
      )
    );
  };

  const addServiceConfig = (dayKey: string) => {
    setAvailability((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayKey
          ? {
              ...day,
              serviceConfigs: [
                ...day.serviceConfigs,
                {
                  serviceStyle: 'at_center',
                  slotDuration: 30,
                  bufferTime: scheduleSettings?.bufferTime?.at_center || 30,
                },
              ],
            }
          : day
      )
    );
  };

  const updateServiceConfig = (
    dayKey: string,
    configIndex: number,
    updates: Partial<ServiceSlotConfig>
  ) => {
    setAvailability((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayKey
          ? {
              ...day,
              serviceConfigs: day.serviceConfigs.map((config, idx) =>
                idx === configIndex ? { ...config, ...updates } : config
              ),
            }
          : day
      )
    );
  };

  const handleSave = async () => {
    if (!vendorId) return;

    try {
      setSaving(true);
      const success = await SchedulingService.updateVendorAvailability(
        vendorId,
        availability
      );

      if (success) {
        Alert.alert('Success', 'Schedule updated successfully');
        navigation?.goBack();
      } else {
        Alert.alert('Error', 'Failed to update schedule');
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
      Alert.alert('Error', 'Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
        <Text style={[Typography.body, { marginTop: Spacing.base }]}>
          Loading schedule...
        </Text>
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
            <Text style={[Typography.h2, styles.headerTitle]}>Schedule Management</Text>
            <Text style={[Typography.bodySmall, styles.headerSubtitle]}>
              Configure your availability and time windows
            </Text>
          </View>
        </View>

        {/* Schedule Settings Info */}
        {scheduleSettings && (
          <View style={styles.settingsCard}>
            <Text style={[Typography.h4, styles.settingsTitle]}>Buffer Times</Text>
            <View style={styles.settingsRow}>
              <Text style={[Typography.bodySmall, styles.settingsLabel]}>At Center:</Text>
              <Text style={[Typography.bodySmall, styles.settingsValue]}>
                {scheduleSettings.bufferTime?.at_center || 30} min
              </Text>
            </View>
            <View style={styles.settingsRow}>
              <Text style={[Typography.bodySmall, styles.settingsLabel]}>At Home:</Text>
              <Text style={[Typography.bodySmall, styles.settingsValue]}>
                {scheduleSettings.bufferTime?.at_home || 120} min
              </Text>
            </View>
            <View style={styles.settingsRow}>
              <Text style={[Typography.bodySmall, styles.settingsLabel]}>Tele:</Text>
              <Text style={[Typography.bodySmall, styles.settingsValue]}>
                {scheduleSettings.bufferTime?.tele || 15} min
              </Text>
            </View>
          </View>
        )}

        {/* Days Configuration */}
        <View style={styles.daysContainer}>
          {availability.map((day) => (
            <View key={day.dayOfWeek} style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <View style={styles.dayHeaderLeft}>
                  <Switch
                    value={day.isEnabled}
                    onValueChange={() => toggleDay(day.dayOfWeek)}
                    trackColor={{
                      false: BrandColors.neutral.gray300,
                      true: BrandColors.primary.orange,
                    }}
                    thumbColor="#FFFFFF"
                  />
                  <Text style={[Typography.h4, styles.dayName]}>
                    {DAYS_OF_WEEK.find((d) => d.key === day.dayOfWeek)?.label}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() =>
                    setExpandedDay(expandedDay === day.dayOfWeek ? null : day.dayOfWeek)
                  }
                >
                  <Icon
                    name={expandedDay === day.dayOfWeek ? 'expand-less' : 'expand-more'}
                    size={24}
                    color={BrandColors.neutral.gray600}
                  />
                </TouchableOpacity>
              </View>

              {expandedDay === day.dayOfWeek && day.isEnabled && (
                <View style={styles.dayContent}>
                  {/* Time Windows */}
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Text style={[Typography.body, styles.sectionTitle]}>
                        Time Windows
                      </Text>
                      <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => addTimeWindow(day.dayOfWeek)}
                      >
                        <Icon name="add" size={20} color={BrandColors.primary.orange} />
                        <Text style={[Typography.bodySmall, styles.addButtonText]}>
                          Add Window
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {day.timeWindows.map((window, idx) => (
                      <View key={idx} style={styles.timeWindowCard}>
                        <View style={styles.timeWindowRow}>
                          <View style={styles.timeInputContainer}>
                            <Text style={[Typography.bodyTiny, styles.timeLabel]}>Start</Text>
                            <TextInput
                              style={styles.timeInput}
                              value={window.startTime}
                              onChangeText={(text) =>
                                updateTimeWindow(day.dayOfWeek, idx, { startTime: text })
                              }
                              placeholder="09:00"
                            />
                          </View>
                          <View style={styles.timeInputContainer}>
                            <Text style={[Typography.bodyTiny, styles.timeLabel]}>End</Text>
                            <TextInput
                              style={styles.timeInput}
                              value={window.endTime}
                              onChangeText={(text) =>
                                updateTimeWindow(day.dayOfWeek, idx, { endTime: text })
                              }
                              placeholder="18:00"
                            />
                          </View>
                          <Switch
                            value={window.isEnabled}
                            onValueChange={(enabled) =>
                              updateTimeWindow(day.dayOfWeek, idx, { isEnabled: enabled })
                            }
                            trackColor={{
                              false: BrandColors.neutral.gray300,
                              true: BrandColors.primary.orange,
                            }}
                            thumbColor="#FFFFFF"
                          />
                          <TouchableOpacity
                            onPress={() => removeTimeWindow(day.dayOfWeek, idx)}
                            style={styles.removeButton}
                          >
                            <Icon name="delete" size={20} color={BrandColors.semantic.error} />
                          </TouchableOpacity>
                        </View>
                        {window.maxBookings && (
                          <View style={styles.maxBookingsRow}>
                            <Text style={[Typography.bodyTiny, styles.maxBookingsLabel]}>
                              Max Bookings:
                            </Text>
                            <TextInput
                              style={styles.maxBookingsInput}
                              value={window.maxBookings.toString()}
                              onChangeText={(text) =>
                                updateTimeWindow(day.dayOfWeek, idx, {
                                  maxBookings: parseInt(text) || 1,
                                })
                              }
                              keyboardType="numeric"
                            />
                          </View>
                        )}
                      </View>
                    ))}
                  </View>

                  {/* Service Configurations */}
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Text style={[Typography.body, styles.sectionTitle]}>
                        Service Configurations
                      </Text>
                      <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => addServiceConfig(day.dayOfWeek)}
                      >
                        <Icon name="add" size={20} color={BrandColors.primary.orange} />
                        <Text style={[Typography.bodySmall, styles.addButtonText]}>
                          Add Service
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {day.serviceConfigs.map((config, idx) => (
                      <View key={idx} style={styles.serviceConfigCard}>
                        <View style={styles.serviceConfigRow}>
                          <Text style={[Typography.bodySmall, styles.serviceConfigLabel]}>
                            Style:
                          </Text>
                          <View style={styles.serviceStyleButtons}>
                            {(['at_center', 'at_home', 'tele'] as const).map((style) => (
                              <TouchableOpacity
                                key={style}
                                style={[
                                  styles.serviceStyleButton,
                                  config.serviceStyle === style &&
                                    styles.serviceStyleButtonActive,
                                ]}
                                onPress={() =>
                                  updateServiceConfig(day.dayOfWeek, idx, {
                                    serviceStyle: style,
                                  })
                                }
                              >
                                <Text
                                  style={[
                                    Typography.bodyTiny,
                                    config.serviceStyle === style &&
                                      styles.serviceStyleButtonTextActive,
                                  ]}
                                >
                                  {style === 'at_center'
                                    ? 'Center'
                                    : style === 'at_home'
                                    ? 'Home'
                                    : 'Tele'}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                        <View style={styles.serviceConfigRow}>
                          <Text style={[Typography.bodySmall, styles.serviceConfigLabel]}>
                            Duration:
                          </Text>
                          <TextInput
                            style={styles.durationInput}
                            value={config.slotDuration.toString()}
                            onChangeText={(text) =>
                              updateServiceConfig(day.dayOfWeek, idx, {
                                slotDuration: parseInt(text) || 30,
                              })
                            }
                            keyboardType="numeric"
                            placeholder="30"
                          />
                          <Text style={[Typography.bodyTiny, styles.durationUnit]}>min</Text>
                        </View>
                        {config.serviceStyle === 'at_home' && (
                          <View style={styles.serviceConfigRow}>
                            <Text style={[Typography.bodySmall, styles.serviceConfigLabel]}>
                              Service Area:
                            </Text>
                            <TextInput
                              style={styles.areaInput}
                              value={config.serviceArea?.toString() || ''}
                              onChangeText={(text) =>
                                updateServiceConfig(day.dayOfWeek, idx, {
                                  serviceArea: parseInt(text) || 5,
                                })
                              }
                              keyboardType="numeric"
                              placeholder="5"
                            />
                            <Text style={[Typography.bodyTiny, styles.areaUnit]}>km</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Save Button */}
        <View style={styles.footer}>
          <BrandedButton
            title={saving ? 'Saving...' : 'Save Schedule'}
            onPress={handleSave}
            disabled={saving}
            variant="primary"
          />
        </View>
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
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
  settingsCard: {
    margin: Spacing.lg,
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  settingsTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.sm,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  settingsLabel: {
    color: BrandColors.neutral.gray700,
  },
  settingsValue: {
    color: BrandColors.neutral.gray900,
    fontWeight: '600',
  },
  daysContainer: {
    padding: Spacing.lg,
    gap: Spacing.base,
  },
  dayCard: {
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
  },
  dayName: {
    color: BrandColors.neutral.gray900,
  },
  dayContent: {
    marginTop: Spacing.base,
    gap: Spacing.base,
  },
  section: {
    marginTop: Spacing.base,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    color: BrandColors.neutral.gray900,
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  addButtonText: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  timeWindowCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.sm,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  timeWindowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  timeInputContainer: {
    flex: 1,
  },
  timeLabel: {
    color: BrandColors.neutral.gray600,
    marginBottom: Spacing.xs,
  },
  timeInput: {
    padding: Spacing.sm,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
    ...Typography.body,
    color: BrandColors.neutral.gray900,
  },
  removeButton: {
    padding: Spacing.xs,
  },
  maxBookingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  maxBookingsLabel: {
    color: BrandColors.neutral.gray600,
  },
  maxBookingsInput: {
    flex: 1,
    padding: Spacing.sm,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
    ...Typography.body,
    color: BrandColors.neutral.gray900,
    maxWidth: 80,
  },
  serviceConfigCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.sm,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  serviceConfigRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  serviceConfigLabel: {
    color: BrandColors.neutral.gray700,
    minWidth: 100,
  },
  serviceStyleButtons: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flex: 1,
  },
  serviceStyleButton: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: BrandColors.neutral.gray100,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
    alignItems: 'center',
  },
  serviceStyleButtonActive: {
    backgroundColor: BrandColors.primary.orange,
    borderColor: BrandColors.primary.orange,
  },
  serviceStyleButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  durationInput: {
    flex: 1,
    padding: Spacing.sm,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
    ...Typography.body,
    color: BrandColors.neutral.gray900,
    maxWidth: 100,
  },
  durationUnit: {
    color: BrandColors.neutral.gray600,
  },
  areaInput: {
    flex: 1,
    padding: Spacing.sm,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
    ...Typography.body,
    color: BrandColors.neutral.gray900,
    maxWidth: 100,
  },
  areaUnit: {
    color: BrandColors.neutral.gray600,
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: BrandColors.neutral.gray200,
  },
});

