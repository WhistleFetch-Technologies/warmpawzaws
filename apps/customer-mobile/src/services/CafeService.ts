/**
 * Cafe Service - Customer Mobile App
 * Handles pet cafe table booking and reservations
 */

import { API_BASE_URL, publicAnonKey } from '../config/api';

export interface CafeTable {
  id: string;
  name: string;
  capacity: number; // PAX capacity
  section: string;
  isOutdoor: boolean;
  isActive: boolean;
}

export interface CafePackage {
  id: string;
  name: string;
  description: string;
  price: number;
  minPax: number;
  maxPax: number;
  duration: number; // minutes
  inclusions: string[];
}

export interface CafeConfig {
  vendorId: string;
  vendorName: string;
  amenities: string[];
  petPolicies: string[];
  operatingHours: string;
  images: string[];
}

export interface TableAvailability {
  tableId: string;
  available: boolean;
  reason?: string;
}

class CafeService {
  /**
   * Get cafe configuration
   */
  async getCafeConfig(vendorId: string): Promise<CafeConfig | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/vendor/${encodeURIComponent(vendorId)}/cafe-config`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.config || null;
      }

      return null;
    } catch (error) {
      console.error('Error fetching cafe config:', error);
      return null;
    }
  }

  /**
   * Get available tables for a date/time
   */
  async getAvailableTables(
    vendorId: string,
    date: string,
    time: string,
    guests: number,
    pets: number
  ): Promise<CafeTable[]> {
    try {
      const params = new URLSearchParams({
        date,
        time,
        guests: guests.toString(),
        pets: pets.toString(),
      });

      const response = await fetch(
        `${API_BASE_URL}/vendor/${encodeURIComponent(vendorId)}/cafe-available-tables?${params}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.tables || [];
      }

      return [];
    } catch (error) {
      console.error('Error fetching available tables:', error);
      return [];
    }
  }

  /**
   * Get party packages
   */
  async getPartyPackages(vendorId: string): Promise<CafePackage[]> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/cafe/packages/${encodeURIComponent(vendorId)}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.packages || [];
      }

      return [];
    } catch (error) {
      console.error('Error fetching party packages:', error);
      return [];
    }
  }

  /**
   * Check table availability
   */
  async checkAvailability(
    vendorId: string,
    date: string,
    time: string,
    pax: number
  ): Promise<TableAvailability | null> {
    try {
      const params = new URLSearchParams({
        vendorId,
        date,
        time,
        pax: pax.toString(),
      });

      const response = await fetch(
        `${API_BASE_URL}/cafe/availability?${params}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return {
          tableId: data.tableId || '',
          available: data.available || false,
          reason: data.message,
        };
      }

      return null;
    } catch (error) {
      console.error('Error checking availability:', error);
      return null;
    }
  }

  /**
   * Create cafe reservation
   */
  async createReservation(
    vendorId: string,
    tableId: string,
    date: string,
    time: string,
    guests: number,
    pets: number,
    specialRequest?: string,
    partyPackageId?: string
  ): Promise<{ bookingId: string } | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/bookings/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            vendorId,
            serviceId: tableId,
            serviceName: 'Cafe Table Reservation',
            serviceType: 'pet_cafe',
            bookingDate: date,
            bookingTime: time,
            numberOfPax: guests,
            petDetails: { count: pets },
            specialInstructions: specialRequest,
            tableId,
            partyPackageId,
            bookingType: 'reservation',
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        return { bookingId: data.bookingId || data.id };
      }

      return null;
    } catch (error) {
      console.error('Error creating reservation:', error);
      return null;
    }
  }
}

export default new CafeService();

