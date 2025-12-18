/**
 * Hook for vendor booking notifications
 * Polls for new bookings and sends notifications
 */

import { useEffect, useRef } from 'react';
import NotificationService from '../services/NotificationService';
import { API_BASE_URL, publicAnonKey } from '../config/api';
import { useAuth } from '../context/AuthContext';

export function useBookingNotifications(enabled: boolean = true) {
  const { vendor } = useAuth();
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastBookingCountRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || !vendor?.id) return;

    // Poll for new bookings
    const pollNewBookings = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/vendor/bookings?status=pending&limit=10`,
          {
            headers: {
              Authorization: `Bearer ${publicAnonKey}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const bookings = data.bookings || [];
          const currentCount = bookings.length;

          // Check if there are new bookings
          if (currentCount > lastBookingCountRef.current && lastBookingCountRef.current > 0) {
            const newBookings = bookings.slice(0, currentCount - lastBookingCountRef.current);
            
            newBookings.forEach((booking: any) => {
              NotificationService.showLocalNotification({
                title: 'New Booking Received! 🎉',
                message: `New booking for ${booking.serviceName || 'service'} from ${booking.customerName || 'customer'}`,
                data: {
                  type: 'new_booking',
                  bookingId: booking.id,
                },
                priority: 'high',
              });
            });
          }

          lastBookingCountRef.current = currentCount;
        }
      } catch (error) {
        console.error('Error polling new bookings:', error);
      }
    };

    // Poll every 30 seconds
    pollingIntervalRef.current = setInterval(pollNewBookings, 30000);

    // Initial poll
    pollNewBookings();

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [enabled, vendor?.id]);
}

