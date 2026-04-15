/**
 * Booking Timeline Screen - Mobile
 * Visual timeline showing booking progress
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
} from 'react-native';
import { ScreenShell } from '../../components/layout/ScreenShell';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { CustomerApi } from '../../services/api';

interface BookingTimelineScreenProps {
  bookingId: string;
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface TimelineEvent {
  id: string;
  status: string;
  label: string;
  description: string;
  timestamp: string;
  isCompleted: boolean;
  isCurrent: boolean;
}

const STATUS_FLOW = [
  { status: 'initiated', label: 'Booking Initiated', description: 'Your booking has been created' },
  { status: 'payment', label: 'Payment Processed', description: 'Payment has been confirmed' },
  { status: 'confirmed', label: 'Booking Confirmed', description: 'Vendor has confirmed your booking' },
  { status: 'assigned', label: 'Staff Assigned', description: 'Service provider has been assigned' },
  { status: 'in_progress', label: 'Service In Progress', description: 'Service is being provided' },
  { status: 'completed', label: 'Service Completed', description: 'Service has been completed' },
  { status: 'closed', label: 'Booking Closed', description: 'Booking has been closed' },
];

export function BookingTimelineScreen({
  bookingId,
  phone,
  onBack,
  onNavigate,
}: BookingTimelineScreenProps) {
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);

  useEffect(() => {
    loadBooking();
  }, [bookingId]);

  const loadBooking = async () => {
    try {
      setLoading(true);
      const response = await CustomerApi.getBookingDetails(bookingId);
      const bookingData = response.booking || response;
      setBooking(bookingData);
      buildTimeline(bookingData);
    } catch (error) {
      console.error('Error loading booking:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildTimeline = (bookingData: any) => {
    const currentStatus = bookingData.status || 'initiated';
    const events: TimelineEvent[] = [];

    STATUS_FLOW.forEach((flowItem, index) => {
      const statusIndex = STATUS_FLOW.findIndex(s => s.status === currentStatus);
      const isCompleted = index < statusIndex;
      const isCurrent = index === statusIndex;

      events.push({
        id: flowItem.status,
        status: flowItem.status,
        label: flowItem.label,
        description: flowItem.description,
        timestamp: getTimestampForStatus(flowItem.status, bookingData),
        isCompleted,
        isCurrent,
      });
    });

    setTimeline(events);
  };

  const getTimestampForStatus = (status: string, booking: any): string => {
    const statusMap: Record<string, string> = {
      initiated: booking.createdAt || new Date().toISOString(),
      payment: booking.paymentDate || booking.createdAt || new Date().toISOString(),
      confirmed: booking.confirmedAt || booking.createdAt || new Date().toISOString(),
      assigned: booking.assignedAt || booking.createdAt || new Date().toISOString(),
      in_progress: booking.startedAt || booking.createdAt || new Date().toISOString(),
      completed: booking.completedAt || booking.createdAt || new Date().toISOString(),
      closed: booking.closedAt || booking.createdAt || new Date().toISOString(),
    };
    return statusMap[status] || new Date().toISOString();
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <ScreenShell style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Timeline</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Booking Info */}
        {booking && (
          <View style={styles.bookingInfo}>
            <Text style={styles.bookingId}>Booking #{bookingId}</Text>
            <Text style={styles.serviceName}>{booking.serviceName || 'Service'}</Text>
            <Text style={styles.petName}>For {booking.petName || 'Pet'}</Text>
          </View>
        )}

        {/* Timeline */}
        <View style={styles.timeline}>
          {timeline.map((event, index) => (
            <View key={event.id} style={styles.timelineItem}>
              <View style={styles.timelineLeft}>
                <View
                  style={[
                    styles.timelineDot,
                    event.isCompleted && styles.timelineDotCompleted,
                    event.isCurrent && styles.timelineDotCurrent,
                  ]}
                >
                  {event.isCompleted && <Text style={styles.checkIcon}>✓</Text>}
                </View>
                {index < timeline.length - 1 && (
                  <View
                    style={[
                      styles.timelineLine,
                      event.isCompleted && styles.timelineLineCompleted,
                    ]}
                  />
                )}
              </View>
              <View style={styles.timelineContent}>
                <Text
                  style={[
                    styles.eventLabel,
                    event.isCompleted && styles.eventLabelCompleted,
                    event.isCurrent && styles.eventLabelCurrent,
                  ]}
                >
                  {event.label}
                </Text>
                <Text style={styles.eventDescription}>{event.description}</Text>
                <Text style={styles.eventTimestamp}>{formatTimestamp(event.timestamp)}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </ScreenShell>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  bookingInfo: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bookingId: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  serviceName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  petName: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  timeline: {
    paddingLeft: spacing.md,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  timelineLeft: {
    alignItems: 'center',
    marginRight: spacing.md,
  },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gray['200'],
    borderWidth: 3,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotCompleted: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  timelineDotCurrent: {
    backgroundColor: colors.white,
    borderColor: colors.primary,
    borderWidth: 4,
  },
  checkIcon: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.gray['200'],
    minHeight: 60,
    marginTop: spacing.xs,
  },
  timelineLineCompleted: {
    backgroundColor: colors.primary,
  },
  timelineContent: {
    flex: 1,
    paddingTop: spacing.xs,
  },
  eventLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  eventLabelCompleted: {
    color: colors.text,
  },
  eventLabelCurrent: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  eventDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  eventTimestamp: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});

