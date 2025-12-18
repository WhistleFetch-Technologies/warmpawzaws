/**
 * Holiday Service - Customer Mobile App
 * Handles pet holiday package booking
 */

import { API_BASE_URL, publicAnonKey } from '../config/api';

export interface HolidayPackage {
  packageId: string;
  vendorId: string;
  packageName: string;
  description: string;
  destination: string;
  destinationImage?: string;
  packageType: 'beach' | 'mountain' | 'city' | 'wildlife' | 'adventure' | 'luxury';
  duration: {
    days: number;
    nights: number;
  };
  pricing: {
    basePrice: number;
    pricePerPet: number;
    pricePerAdult: number;
    pricePerChild: number;
    currency: string;
  };
  inclusions: string[];
  exclusions: string[];
  isGroupTour: boolean;
  minGroupSize?: number;
  maxGroupSize?: number;
  availableDates: Array<{
    startDate: string;
    endDate: string;
    availableSlots: number;
    bookedSlots: number;
  }>;
  itinerary: Array<{
    day: number;
    title: string;
    description: string;
    activities: string[];
  }>;
  requirements: {
    minAge?: number;
    maxAge?: number;
    petRequirements?: string[];
    healthRequirements?: string[];
  };
  cancellationPolicy: string;
  refundPolicy: string;
}

export interface HolidayBooking {
  bookingId: string;
  packageId: string;
  selectedStartDate: string;
  selectedEndDate: string;
  travelers: {
    adults: number;
    children: number;
    pets: Array<{
      petId: string;
      petName: string;
    }>;
  };
  totalAmount: number;
  status: string;
}

class HolidayService {
  /**
   * Get holiday packages
   */
  async getPackages(filters?: {
    packageType?: string;
    destination?: string;
    minPrice?: number;
    maxPrice?: number;
  }): Promise<HolidayPackage[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.packageType) params.append('packageType', filters.packageType);
      if (filters?.destination) params.append('destination', filters.destination);
      if (filters?.minPrice) params.append('minPrice', filters.minPrice.toString());
      if (filters?.maxPrice) params.append('maxPrice', filters.maxPrice.toString());

      const response = await fetch(
        `${API_BASE_URL}/holiday-packages?${params}`,
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
      console.error('Error fetching holiday packages:', error);
      return [];
    }
  }

  /**
   * Get package details
   */
  async getPackageDetails(packageId: string): Promise<HolidayPackage | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/holiday-packages/${encodeURIComponent(packageId)}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.package || null;
      }

      return null;
    } catch (error) {
      console.error('Error fetching package details:', error);
      return null;
    }
  }

  /**
   * Book holiday package
   */
  async bookPackage(
    packageId: string,
    selectedStartDate: string,
    selectedEndDate: string,
    travelers: {
      adults: number;
      children: number;
      pets: Array<{ petId: string; petName: string }>;
    },
    specialRequests?: string
  ): Promise<HolidayBooking | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/holiday-packages/book`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            packageId,
            selectedStartDate,
            selectedEndDate,
            travelers,
            specialRequests,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.booking || null;
      }

      return null;
    } catch (error) {
      console.error('Error booking package:', error);
      return null;
    }
  }

  /**
   * Calculate package price
   */
  calculatePrice(
    packageData: HolidayPackage,
    travelers: {
      adults: number;
      children: number;
      pets: number;
    }
  ): number {
    const { pricing } = packageData;
    return (
      pricing.basePrice +
      pricing.pricePerAdult * travelers.adults +
      pricing.pricePerChild * travelers.children +
      pricing.pricePerPet * travelers.pets
    );
  }
}

export default new HolidayService();

