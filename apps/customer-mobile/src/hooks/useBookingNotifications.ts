/**
 * Hook for booking-related notifications
 * Automatically sets up notifications for booking lifecycle events
 */

import { useEffect, useRef } from 'react';
import NotificationService from '../services/NotificationService';
import { API_BASE_URL, publicAnonKey } from '../config/api';

interface UseBookingNotificationsProps {
  bookingId?: string;
  enabled?: boolean;
}

export function useBookingNotifications({
  bookingId,
  enabled = true,
}: UseBookingNotificationsProps) {
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled || !bookingId) return;

    // Poll for booking updates and send notifications
    const pollBookingUpdates = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/customer/booking/${encodeURIComponent(bookingId)}/status`,
          {
            headers: {
              Authorization: `Bearer ${publicAnonKey}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const booking = data.booking;

          // Check for status changes and send notifications
          if (booking.status === 'confirmed') {
            NotificationService.showLocalNotification({
              title: 'Booking Confirmed! 🎉',
              message: `Your booking for ${booking.serviceName || 'service'} has been confirmed.`,
              data: {
                type: 'booking_confirmed',
                bookingId: booking.id,
              },
              priority: 'high',
            });
          } else if (booking.status === 'cancelled') {
            NotificationService.showLocalNotification({
              title: 'Booking Cancelled',
              message: `Your booking for ${booking.serviceName || 'service'} has been cancelled.`,
              data: {
                type: 'booking_cancelled',
                bookingId: booking.id,
              },
            });
          } else if (booking.status === 'completed') {
            NotificationService.showLocalNotification({
              title: 'Service Completed ✅',
              message: `Your ${booking.serviceName || 'service'} has been completed. Please rate your experience.`,
              data: {
                type: 'service_completed',
                bookingId: booking.id,
              },
              priority: 'high',
            });
          }

          // Check for GPS tracking updates
          if (booking.trackingSessionId) {
            checkTrackingUpdates(booking.trackingSessionId, booking);
          }
        }
      } catch (error) {
        console.error('Error polling booking updates:', error);
      }
    };

    // Poll every 30 seconds
    pollingIntervalRef.current = setInterval(pollBookingUpdates, 30000);

    // Initial poll
    pollBookingUpdates();

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [bookingId, enabled]);

  const checkTrackingUpdates = async (trackingSessionId: string, booking: any) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/tracking/${encodeURIComponent(trackingSessionId)}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const session = data.session;

        if (session.status === 'traveling' && !session.notifiedStarted) {
          NotificationService.showLocalNotification({
            title: 'Service Provider On The Way 🚗',
            message: `${booking.staffName || 'Service provider'} has started traveling to your location.`,
            data: {
              type: 'staff_started',
              bookingId: booking.id,
              trackingSessionId,
            },
            priority: 'high',
          });
        } else if (session.status === 'arrived' && !session.notifiedArrived) {
          NotificationService.showLocalNotification({
            title: 'Service Provider Arrived! 🎉',
            message: `${booking.staffName || 'Service provider'} has arrived at your location.`,
            data: {
              type: 'staff_arrived',
              bookingId: booking.id,
              trackingSessionId,
            },
            priority: 'high',
          });
        }
      }
    } catch (error) {
      console.error('Error checking tracking updates:', error);
    }
  };
}

