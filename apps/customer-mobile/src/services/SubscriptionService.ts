/**
 * Subscription Service - Customer Mobile App
 * Handles subscription package booking with time window scheduling
 * Supports morning, afternoon, and evening time slots
 */

import { API_BASE_URL, publicAnonKey } from '../config/api';

export interface TimeWindow {
  name: 'morning' | 'afternoon' | 'evening';
  label: string;
  startHour: number;
  endHour: number;
}

export interface RecurringSchedule {
  frequency: 'daily' | 'weekly' | 'monthly';
  days?: string[]; // For weekly: ['monday', 'wednesday', 'friday']
  dates?: number[]; // For monthly: [1, 15, 30]
}

export interface TimeWindowSubscription {
  subscriptionId: string;
  bookingId: string;
  customerId: string;
  providerId?: string;
  serviceType: string;
  timeWindow: 'morning' | 'afternoon' | 'evening';
  recurringSchedule: RecurringSchedule;
  startDate: string;
  endDate: string;
  status: 'active' | 'paused' | 'cancelled' | 'completed';
  sessionsCompleted: number;
  totalSessions: number;
  createdAt: string;
  updatedAt: string;
}

export const TIME_WINDOWS: TimeWindow[] = [
  { name: 'morning', label: 'Morning (8 AM - 12 PM)', startHour: 8, endHour: 12 },
  { name: 'afternoon', label: 'Afternoon (12 PM - 4 PM)', startHour: 12, endHour: 16 },
  { name: 'evening', label: 'Evening (4 PM - 8 PM)', startHour: 16, endHour: 20 },
];

class SubscriptionService {
  /**
   * Create time window subscription for a booking
   */
  async createTimeWindowSubscription(
    bookingId: string,
    customerId: string,
    serviceType: string,
    timeWindow: 'morning' | 'afternoon' | 'evening',
    recurringSchedule: RecurringSchedule,
    startDate: string,
    endDate: string,
    totalSessions: number,
    providerId?: string
  ): Promise<TimeWindowSubscription | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/booking/subscription/time-window`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            bookingId,
            customerId,
            providerId,
            serviceType,
            timeWindow,
            recurringSchedule,
            startDate,
            endDate,
            totalSessions,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.subscription || null;
      }

      return null;
    } catch (error) {
      console.error('Error creating time window subscription:', error);
      return null;
    }
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string): Promise<TimeWindowSubscription | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/booking/subscription/${encodeURIComponent(subscriptionId)}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.subscription || null;
      }

      return null;
    } catch (error) {
      console.error('Error fetching subscription:', error);
      return null;
    }
  }

  /**
   * Get customer's active subscriptions
   */
  async getCustomerSubscriptions(customerId: string): Promise<TimeWindowSubscription[]> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/customer/${encodeURIComponent(customerId)}/subscriptions`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.subscriptions || [];
      }

      return [];
    } catch (error) {
      console.error('Error fetching customer subscriptions:', error);
      return [];
    }
  }

  /**
   * Pause subscription
   */
  async pauseSubscription(subscriptionId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/booking/subscription/${encodeURIComponent(subscriptionId)}/pause`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      return response.ok;
    } catch (error) {
      console.error('Error pausing subscription:', error);
      return false;
    }
  }

  /**
   * Resume subscription
   */
  async resumeSubscription(subscriptionId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/booking/subscription/${encodeURIComponent(subscriptionId)}/resume`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      return response.ok;
    } catch (error) {
      console.error('Error resuming subscription:', error);
      return false;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string, reason?: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/booking/subscription/${encodeURIComponent(subscriptionId)}/cancel`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ reason }),
        }
      );

      return response.ok;
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      return false;
    }
  }

  /**
   * Get time window label
   */
  getTimeWindowLabel(timeWindow: 'morning' | 'afternoon' | 'evening'): string {
    const window = TIME_WINDOWS.find((w) => w.name === timeWindow);
    return window?.label || timeWindow;
  }
}

export default new SubscriptionService();

