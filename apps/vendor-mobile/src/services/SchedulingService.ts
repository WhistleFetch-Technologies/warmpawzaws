/**
 * Scheduling Service - Vendor Mobile App
 * Comprehensive scheduling management with buffer times, availability windows
 * Supports staff schedules, center schedules, and service-specific configurations
 */

import { API_BASE_URL, publicAnonKey } from '../config/api';

export interface TimeWindow {
  startTime: string; // "09:00"
  endTime: string; // "18:00"
  isEnabled: boolean;
  maxBookings?: number; // For center bookings
}

export interface ServiceSlotConfig {
  serviceStyle: 'at_center' | 'at_home' | 'tele';
  slotDuration: number; // minutes
  serviceArea?: number; // km radius for home services
  bufferTime?: number; // minutes
}

export interface DayAvailability {
  dayOfWeek: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  timeWindows: TimeWindow[];
  serviceConfigs: ServiceSlotConfig[];
  isEnabled: boolean;
}

export interface StaffSchedule {
  staffId: string;
  availability: DayAvailability[];
  breaks?: Array<{
    dayOfWeek: string;
    startTime: string;
    endTime: string;
  }>;
  holidays?: string[]; // ISO date strings
  vacationMode?: boolean;
}

export interface CenterSchedule {
  vendorId: string;
  operatingHours: DayAvailability[];
  holidays?: string[];
  vacationMode?: boolean;
}

export interface AvailableSlot {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  available: boolean;
  reason?: string;
  capacity?: number;
  booked?: number;
}

class SchedulingService {
  /**
   * Get vendor availability (V2 format)
   */
  async getVendorAvailability(vendorId: string): Promise<{
    availability: DayAvailability[];
    serviceStyles: string[];
  } | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/vendor/availability-v2/${vendorId}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return {
          availability: data.availability || [],
          serviceStyles: data.serviceStyles || [],
        };
      }

      return null;
    } catch (error) {
      console.error('Error fetching vendor availability:', error);
      return null;
    }
  }

  /**
   * Update vendor availability (V2 format)
   */
  async updateVendorAvailability(
    vendorId: string,
    availability: DayAvailability[]
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/vendor/availability-v2/${vendorId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ availability }),
        }
      );

      return response.ok;
    } catch (error) {
      console.error('Error updating vendor availability:', error);
      return false;
    }
  }

  /**
   * Get available slots for a vendor on a specific date
   */
  async getAvailableSlots(
    vendorId: string,
    date: string,
    serviceStyle?: string
  ): Promise<AvailableSlot[]> {
    try {
      const params = new URLSearchParams({ date });
      if (serviceStyle) {
        params.append('serviceStyle', serviceStyle);
      }

      const response = await fetch(
        `${API_BASE_URL}/vendor/${encodeURIComponent(vendorId)}/available-slots?${params}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.slots || [];
      }

      return [];
    } catch (error) {
      console.error('Error fetching available slots:', error);
      return [];
    }
  }

  /**
   * Check if a specific slot is available
   */
  async checkSlotAvailability(
    vendorId: string,
    date: string,
    time: string,
    serviceStyle?: string
  ): Promise<{
    available: boolean;
    reason?: string;
  }> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/vendor/${encodeURIComponent(vendorId)}/check-slot`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            date,
            time,
            serviceStyle,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        return {
          available: data.available || false,
          reason: data.reason,
        };
      }

      return { available: false, reason: 'Failed to check availability' };
    } catch (error) {
      console.error('Error checking slot availability:', error);
      return { available: false, reason: 'Network error' };
    }
  }

  /**
   * Get staff schedule
   */
  async getStaffSchedule(staffId: string): Promise<StaffSchedule | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/staff/${encodeURIComponent(staffId)}/schedule`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.schedule || null;
      }

      return null;
    } catch (error) {
      console.error('Error fetching staff schedule:', error);
      return null;
    }
  }

  /**
   * Update staff schedule
   */
  async updateStaffSchedule(
    staffId: string,
    schedule: StaffSchedule
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/staff/${encodeURIComponent(staffId)}/schedule`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify(schedule),
        }
      );

      return response.ok;
    } catch (error) {
      console.error('Error updating staff schedule:', error);
      return false;
    }
  }

  /**
   * Get schedule settings (buffer times, slot intervals, etc.)
   */
  async getScheduleSettings(): Promise<{
    bufferTime: Record<string, number>;
    slotInterval: number;
    maxDaysAhead: number;
    minSlotDuration: number;
  } | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/schedule/settings`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.settings || null;
      }

      // Return defaults if API not available
      return {
        bufferTime: {
          at_center: 30,
          at_home: 120,
          tele: 15,
        },
        slotInterval: 30,
        maxDaysAhead: 30,
        minSlotDuration: 30,
      };
    } catch (error) {
      console.error('Error fetching schedule settings:', error);
      return {
        bufferTime: {
          at_center: 30,
          at_home: 120,
          tele: 15,
        },
        slotInterval: 30,
        maxDaysAhead: 30,
        minSlotDuration: 30,
      };
    }
  }

  /**
   * Set vendor vacation mode
   */
  async setVacationMode(
    vendorId: string,
    enabled: boolean,
    startDate?: string,
    endDate?: string
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/vendor/${encodeURIComponent(vendorId)}/vacation-mode`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            enabled,
            startDate,
            endDate,
          }),
        }
      );

      return response.ok;
    } catch (error) {
      console.error('Error setting vacation mode:', error);
      return false;
    }
  }
}

export default new SchedulingService();

