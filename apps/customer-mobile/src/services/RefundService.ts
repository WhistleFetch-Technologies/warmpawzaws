/**
 * Refund Service - Customer Mobile App
 * Handles refund policies, cancellation, and rescheduling
 */

import { API_BASE_URL, publicAnonKey } from '../config/api';

export interface RefundPolicy {
  serviceType: string;
  fullRefund: number; // hours before appointment
  partialRefund: number; // hours before appointment
  partialPercentage: number; // percentage
  noRefund: number; // hours before appointment
  processingFee: number;
  rules: string[];
}

export interface RefundEstimate {
  bookingId: string;
  paidAmount: number;
  hoursUntilService: number;
  refundPercentage: number;
  cancellationFee: number;
  estimatedRefund: number;
  policyApplied: RefundPolicy;
  refundable: boolean;
  reason?: string;
}

export interface RefundRequest {
  bookingId: string;
  reason: string;
  refundMethod: 'wallet' | 'original'; // wallet = instant, original = 5-7 days
}

export interface RefundResponse {
  success: boolean;
  bookingId: string;
  status: 'cancelled';
  refundAmount: number;
  refundStatus: 'processing' | 'completed' | 'initiated';
  refundMethod: string;
  refundTransactionId?: string;
  message: string;
}

export interface RescheduleRequest {
  bookingId: string;
  newDate: string;
  newTime: string;
  reason?: string;
}

export interface RescheduleResponse {
  success: boolean;
  bookingId: string;
  oldDate: string;
  oldTime: string;
  newDate: string;
  newTime: string;
  rescheduleFee?: number;
  message: string;
}

class RefundService {
  /**
   * Get refund policy for a booking
   */
  async getRefundPolicy(bookingId: string): Promise<{
    policy: RefundPolicy;
    currentRefund: RefundEstimate;
  } | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/refunds/policy/${encodeURIComponent(bookingId)}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return {
          policy: data.policy,
          currentRefund: data.currentRefund,
        };
      }

      return null;
    } catch (error) {
      console.error('Error fetching refund policy:', error);
      return null;
    }
  }

  /**
   * Get refund estimate
   */
  async getRefundEstimate(bookingId: string): Promise<RefundEstimate | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/refunds/estimate/${encodeURIComponent(bookingId)}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data;
      }

      return null;
    } catch (error) {
      console.error('Error fetching refund estimate:', error);
      return null;
    }
  }

  /**
   * Request refund/cancellation
   */
  async requestRefund(request: RefundRequest): Promise<RefundResponse | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/refunds/request`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify(request),
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data;
      }

      const errorData = await response.json();
      throw new Error(errorData.error || 'Refund request failed');
    } catch (error) {
      console.error('Error requesting refund:', error);
      return null;
    }
  }

  /**
   * Reschedule booking
   */
  async rescheduleBooking(request: RescheduleRequest): Promise<RescheduleResponse | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/bookings/${encodeURIComponent(request.bookingId)}/reschedule`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            newDate: request.newDate,
            newTime: request.newTime,
            reason: request.reason,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data;
      }

      const errorData = await response.json();
      throw new Error(errorData.error || 'Reschedule failed');
    } catch (error) {
      console.error('Error rescheduling booking:', error);
      return null;
    }
  }

  /**
   * Check if booking can be rescheduled
   */
  async canReschedule(bookingId: string): Promise<{
    canReschedule: boolean;
    reason?: string;
    rescheduleFee?: number;
  }> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/bookings/${encodeURIComponent(bookingId)}/can-reschedule`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data;
      }

      return { canReschedule: false, reason: 'Unable to check reschedule eligibility' };
    } catch (error) {
      console.error('Error checking reschedule eligibility:', error);
      return { canReschedule: false, reason: 'Network error' };
    }
  }

  /**
   * Calculate refund percentage based on hours until service
   */
  calculateRefundPercentage(
    hoursUntilService: number,
    policy: RefundPolicy
  ): {
    percentage: number;
    reason: string;
  } {
    if (hoursUntilService >= policy.fullRefund) {
      return {
        percentage: 100,
        reason: `Full refund (cancelled ${hoursUntilService.toFixed(1)} hours before service)`,
      };
    } else if (hoursUntilService >= policy.partialRefund) {
      return {
        percentage: policy.partialPercentage,
        reason: `Partial refund ${policy.partialPercentage}% (cancelled ${hoursUntilService.toFixed(1)} hours before service)`,
      };
    } else if (hoursUntilService >= policy.noRefund) {
      return {
        percentage: 0,
        reason: `No refund (cancelled ${hoursUntilService.toFixed(1)} hours before service)`,
      };
    } else {
      return {
        percentage: 0,
        reason: `Service time too close for refund`,
      };
    }
  }
}

export default new RefundService();

