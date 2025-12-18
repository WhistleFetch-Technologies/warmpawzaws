/**
 * Resort Service - Customer Mobile App
 * Handles resort and boarding room booking
 */

import { API_BASE_URL, publicAnonKey } from '../config/api';

export interface ResortRoom {
  id: string;
  name: string;
  description: string;
  price: number; // per night
  maxOccupancy: number;
  totalInventory: number;
  amenities: string[];
  images: string[];
  isActive: boolean;
}

export interface RoomAvailability {
  roomId: string;
  available: boolean;
  availableRooms: number;
  reason?: string;
}

export interface ResortBooking {
  bookingId: string;
  roomId: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  guests: number;
  pets: Array<{
    petId: string;
    petName: string;
  }>;
  totalAmount: number;
  status: string;
}

class ResortService {
  /**
   * Get resort rooms
   */
  async getRooms(vendorId: string): Promise<ResortRoom[]> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/resort/rooms/${encodeURIComponent(vendorId)}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.rooms || [];
      }

      return [];
    } catch (error) {
      console.error('Error fetching rooms:', error);
      return [];
    }
  }

  /**
   * Check room availability
   */
  async checkAvailability(
    vendorId: string,
    roomId: string,
    checkInDate: string,
    checkOutDate: string
  ): Promise<RoomAvailability | null> {
    try {
      const params = new URLSearchParams({
        checkInDate,
        checkOutDate,
      });

      const response = await fetch(
        `${API_BASE_URL}/resort/availability/${encodeURIComponent(vendorId)}/${encodeURIComponent(roomId)}?${params}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return {
          roomId,
          available: data.available || false,
          availableRooms: data.availableRooms || 0,
          reason: data.reason,
        };
      }

      return null;
    } catch (error) {
      console.error('Error checking availability:', error);
      return null;
    }
  }

  /**
   * Create resort booking
   */
  async createBooking(
    vendorId: string,
    roomId: string,
    checkInDate: string,
    checkOutDate: string,
    guests: number,
    pets: Array<{ petId: string; petName: string }>,
    specialRequest?: string
  ): Promise<ResortBooking | null> {
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
            serviceId: roomId,
            serviceName: 'Resort/Boarding Stay',
            serviceType: 'boarding',
            bookingType: 'stay',
            checkInDate,
            checkOutDate,
            numberOfPax: guests,
            petDetails: pets,
            specialInstructions: specialRequest,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        return {
          bookingId: data.bookingId || data.id,
          roomId,
          checkInDate,
          checkOutDate,
          nights: data.nights || 1,
          guests,
          pets,
          totalAmount: data.totalAmount || data.amount || 0,
          status: data.status || 'pending',
        };
      }

      return null;
    } catch (error) {
      console.error('Error creating booking:', error);
      return null;
    }
  }

  /**
   * Calculate nights between dates
   */
  calculateNights(checkIn: string, checkOut: string): number {
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const diffTime = Math.abs(checkOutDate.getTime() - checkInDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays);
  }
}

export default new ResortService();

