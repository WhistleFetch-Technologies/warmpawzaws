/**
 * Schedule Screen
 * View and manage vendor schedule
 * Batch 2 - Screen 6
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { VendorScheduleApi } from '../../services/api';

interface ScheduleScreenProps {
  vendorId: string;
  onBack?: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface ScheduleItem {
  id: string;
  time: string;
  customerName: string;
  serviceName: string;
  status: string;
  bookingId: string;
}

export function ScheduleScreen({ vendorId, onBack, onNavigate }: ScheduleScreenProps) {
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    loadSchedule();
  }, [vendorId, selectedDate]);

  const loadSchedule = async () => {
    try {
      setLoading(true);
      const dateStr = selectedDate.toISOString().split('T')[0];
      const response = await VendorScheduleApi.getSchedule(vendorId, dateStr);
      setSchedule(response.schedule || []);
    } catch (error: any) {
      console.error('Error loading schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderScheduleItem = ({ item }: { item: ScheduleItem }) => (
    <TouchableOpacity
      style={styles.scheduleItem}
      onPress={() => onNavigate?.('booking-details', { bookingId: item.bookingId })}
    >
      <View style={styles.scheduleTime}>
        <Text style={styles.scheduleTimeText}>{item.time}</Text>
      </View>
      <View style={styles.scheduleInfo}>
        <Text style={styles.scheduleCustomer}>{item.customerName}</Text>
        <Text style={styles.scheduleService}>{item.serviceName}</Text>
      </View>
      <View style={styles.scheduleStatus}>
        <Text style={[styles.statusBadge, item.status === 'confirmed' && styles.statusConfirmed]}>
          {item.status}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Schedule</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Schedule</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.dateSelector}>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => {
              const prevDate = new Date(selectedDate);
              prevDate.setDate(prevDate.getDate() - 1);
              setSelectedDate(prevDate);
            }}
          >
            <Text style={styles.dateButtonText}>← Previous</Text>
          </TouchableOpacity>
          <Text style={styles.dateText}>
            {selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => {
              const nextDate = new Date(selectedDate);
              nextDate.setDate(nextDate.getDate() + 1);
              setSelectedDate(nextDate);
            }}
          >
            <Text style={styles.dateButtonText}>Next →</Text>
          </TouchableOpacity>
        </View>

        {schedule.length > 0 ? (
          <FlatList
            data={schedule}
            renderItem={renderScheduleItem}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        ) : (
          <View style={styles.emptySchedule}>
            <Text style={styles.emptyText}>No appointments scheduled for this date</Text>
          </View>
        )}
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
    padding: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.sm,
  },
  backButtonText: {
    fontSize: typography.size.md,
    color: colors.primary,
  },
  headerTitle: {
    fontSize: typography.size.lg,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
  },
  dateButton: {
    padding: spacing.sm,
  },
  dateButtonText: {
    fontSize: typography.size.sm,
    color: colors.primary,
  },
  dateText: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.text,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scheduleTime: {
    width: 80,
    marginRight: spacing.md,
  },
  scheduleTimeText: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.text,
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleCustomer: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  scheduleService: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  scheduleStatus: {
    marginLeft: spacing.md,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    fontSize: typography.size.xs,
    backgroundColor: colors.gray,
    color: colors.text,
  },
  statusConfirmed: {
    backgroundColor: colors.success,
    color: colors.white,
  },
  emptySchedule: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

