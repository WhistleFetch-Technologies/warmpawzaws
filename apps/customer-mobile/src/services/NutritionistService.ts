/**
 * Nutritionist Service - Customer Mobile App
 * Handles nutritionist food delivery and meal ordering
 */

import { API_BASE_URL, publicAnonKey } from '../config/api';

export interface MealItem {
  itemId: string;
  name: string;
  description: string;
  type: 'fresh' | 'frozen' | 'dry' | 'treat';
  dietaryTags: string[];
  ingredients: string[];
  nutritionalInfo: {
    calories: number;
    protein: string;
    fat: string;
    fiber: string;
  };
  price: number;
  isAvailable: boolean;
  preparationTime: number; // minutes
  images: string[];
}

export interface MealOrder {
  orderId: string;
  nutritionistId: string;
  items: Array<{
    itemId: string;
    quantity: number;
    customization?: string;
  }>;
  type: 'one-time' | 'subscription';
  subscriptionDetails?: {
    frequency: 'daily' | 'weekly';
    startDate: string;
    endDate: string;
    deliverySlot: 'morning' | 'afternoon' | 'evening';
  };
  deliveryAddress: {
    street: string;
    city: string;
    zip: string;
    location: { lat: number; lng: number };
  };
  status: string;
  totalAmount: number;
}

class NutritionistService {
  /**
   * Get nutritionist menu
   */
  async getMenu(nutritionistId: string): Promise<MealItem[]> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/nutritionist/${encodeURIComponent(nutritionistId)}/menu`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.menu || [];
      }

      return [];
    } catch (error) {
      console.error('Error fetching menu:', error);
      return [];
    }
  }

  /**
   * Place meal order
   */
  async placeOrder(
    nutritionistId: string,
    items: Array<{ itemId: string; quantity: number; customization?: string }>,
    type: 'one-time' | 'subscription',
    deliveryAddress: {
      street: string;
      city: string;
      zip: string;
      location: { lat: number; lng: number };
    },
    subscriptionDetails?: {
      frequency: 'daily' | 'weekly';
      startDate: string;
      endDate: string;
      deliverySlot: 'morning' | 'afternoon' | 'evening';
    },
    totalAmount: number
  ): Promise<MealOrder | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/nutritionist/meals/order`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            nutritionistId,
            items,
            type,
            deliveryAddress,
            subscriptionDetails,
            totalAmount,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.order || null;
      }

      return null;
    } catch (error) {
      console.error('Error placing order:', error);
      return null;
    }
  }

  /**
   * Get order tracking
   */
  async getOrderTracking(orderId: string): Promise<{
    status: string;
    deliveryPartner?: {
      name: string;
      phone: string;
      currentLocation?: { lat: number; lng: number };
    };
    estimatedDelivery?: string;
  } | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/nutritionist/orders/${encodeURIComponent(orderId)}/tracking`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.tracking || null;
      }

      return null;
    } catch (error) {
      console.error('Error fetching order tracking:', error);
      return null;
    }
  }
}

export default new NutritionistService();

