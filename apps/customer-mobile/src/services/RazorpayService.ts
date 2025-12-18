/**
 * Razorpay Service - Customer Mobile App
 * Razorpay payment gateway integration with Marketplace Mode
 * Handles payment initiation, checkout, verification, and automatic settlement
 */

import RazorpayCheckout from 'react-native-razorpay';
import { projectId, publicAnonKey, API_BASE_URL } from '../config/api';
import { Platform, Alert } from 'react-native';

// Razorpay types
interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id?: string;
  prefill?: {
    email?: string;
    contact?: string;
    name?: string;
  };
  theme?: {
    color: string;
  };
  notes?: Record<string, string>;
  handler?: (response: RazorpayResponse) => void;
  modal?: {
    ondismiss?: () => void;
  };
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

class RazorpayService {
  private razorpayKey: string | null = null;

  /**
   * Initialize Razorpay with API key
   */
  async initialize(): Promise<boolean> {
    try {
      // Get Razorpay key from environment or API
      // For now, using placeholder - should come from environment variables
      const response = await fetch(
        `${API_BASE_URL}/config/razorpay-key`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        this.razorpayKey = data.key;
        return true;
      }

      // Fallback: Use environment variable
      // In production, this should be set via environment variables
      if (typeof process !== 'undefined' && process.env) {
        this.razorpayKey = process.env.RAZORPAY_KEY || process.env.EXPO_PUBLIC_RAZORPAY_KEY || null;
      }

      return this.razorpayKey !== null;
    } catch (error) {
      console.error('Error initializing Razorpay:', error);
      return false;
    }
  }

  /**
   * Create Razorpay order
   */
  async createOrder(
    amount: number,
    currency: string = 'INR',
    receipt?: string,
    notes?: Record<string, string>
  ): Promise<{ orderId: string; amount: number } | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/payments/razorpay/create-order`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            amount: Math.round(amount * 100), // Convert to paise
            currency,
            receipt: receipt || `receipt_${Date.now()}`,
            notes: notes || {},
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        return {
          orderId: data.id,
          amount: data.amount / 100, // Convert back to rupees
        };
      }

      return null;
    } catch (error) {
      console.error('Error creating Razorpay order:', error);
      return null;
    }
  }

  /**
   * Open Razorpay checkout with Marketplace Mode support
   */
  async openCheckout(options: RazorpayOptions): Promise<RazorpayResponse | null> {
    return new Promise((resolve, reject) => {
      try {
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          // Get Razorpay key if not already initialized
          if (!this.razorpayKey) {
            this.initialize().then(() => {
              this.openCheckoutInternal(options, resolve, reject);
            }).catch((error) => {
              reject(error);
            });
          } else {
            this.openCheckoutInternal(options, resolve, reject);
          }
        } else {
          reject(new Error('Razorpay is only available on iOS and Android'));
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Internal checkout implementation
   */
  private openCheckoutInternal(
    options: RazorpayOptions,
    resolve: (value: RazorpayResponse) => void,
    reject: (error: any) => void
  ): void {
    const razorpayOptions = {
      description: options.description,
      image: 'https://warmpawz.com/logo.png', // Platform logo
      currency: 'INR',
      key: this.razorpayKey!,
      amount: options.amount,
      name: options.name,
      order_id: options.order_id,
      prefill: {
        email: options.prefill?.email || '',
        contact: options.prefill?.contact || '',
        name: options.prefill?.name || '',
      },
      theme: {
        color: options.theme?.color || '#FF8C42',
      },
      notes: options.notes || {},
      // Marketplace mode configuration
      method: {
        netbanking: 1,
        wallet: 1,
        upi: 1,
        card: 1,
      },
    };

    RazorpayCheckout.open(razorpayOptions)
      .then((data: any) => {
        const response: RazorpayResponse = {
          razorpay_payment_id: data.razorpay_payment_id,
          razorpay_order_id: data.razorpay_order_id,
          razorpay_signature: data.razorpay_signature,
        };
        resolve(response);
      })
      .catch((error: any) => {
        if (error.code === 'BAD_REQUEST_ERROR') {
          reject(new Error('Invalid payment parameters'));
        } else if (error.code === 'NETWORK_ERROR') {
          reject(new Error('Network error. Please check your connection'));
        } else if (error.code === 'USER_CANCELLED_PAYMENT') {
          reject(new Error('Payment cancelled by user'));
        } else {
          reject(error);
        }
      });
  }

  /**
   * Verify Razorpay payment
   */
  async verifyPayment(
    paymentId: string,
    orderId: string,
    signature: string,
    bookingId?: string
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/payments/razorpay/verify`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            paymentId,
            orderId,
            signature,
            bookingId,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.verified === true;
      }

      return false;
    } catch (error) {
      console.error('Error verifying payment:', error);
      return false;
    }
  }

  /**
   * Process complete payment flow with Marketplace Mode
   * Automatically handles commission calculation and settlement
   */
  async processPayment(
    amount: number,
    customerInfo: {
      name?: string;
      email?: string;
      contact?: string;
    },
    bookingId?: string,
    description?: string,
    vendorId?: string
  ): Promise<{
    success: boolean;
    paymentId?: string;
    orderId?: string;
    error?: string;
    settlementData?: {
      commissionRate: number;
      commissionAmount: number;
      vendorAmount: number;
    };
  }> {
    try {
      // 1. Create order with marketplace mode
      const order = await this.createOrder(
        amount,
        'INR',
        bookingId ? `receipt_${bookingId}` : undefined,
        bookingId ? { bookingId, vendorId: vendorId || '' } : undefined
      );

      if (!order) {
        return { success: false, error: 'Failed to create payment order' };
      }

      // 2. Initialize Razorpay if not already done
      if (!this.razorpayKey) {
        const initialized = await this.initialize();
        if (!initialized) {
          return { success: false, error: 'Failed to initialize Razorpay' };
        }
      }

      // 3. Open checkout
      const paymentResponse = await this.openCheckout({
        key: this.razorpayKey!,
        amount: Math.round(amount * 100), // Convert to paise
        currency: 'INR',
        name: 'Warmpawz',
        description: description || 'Service Booking',
        order_id: order.orderId,
        prefill: {
          name: customerInfo.name,
          email: customerInfo.email,
          contact: customerInfo.contact,
        },
        theme: {
          color: '#FF8C42',
        },
        notes: {
          bookingId: bookingId || '',
          vendorId: vendorId || '',
          marketplace: 'true',
        },
      });

      if (!paymentResponse) {
        return { success: false, error: 'Payment cancelled' };
      }

      // 4. Verify payment
      const verified = await this.verifyPayment(
        paymentResponse.razorpay_payment_id,
        paymentResponse.razorpay_order_id,
        paymentResponse.razorpay_signature,
        bookingId
      );

      if (!verified) {
        return { success: false, error: 'Payment verification failed' };
      }

      // 5. Get settlement data (commission calculation happens server-side)
      let settlementData;
      if (bookingId && vendorId) {
        try {
          const settlementResponse = await fetch(
            `${API_BASE_URL}/payments/settlement/calculate`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${publicAnonKey}`,
              },
              body: JSON.stringify({
                bookingId,
                vendorId,
                amount,
                paymentId: paymentResponse.razorpay_payment_id,
              }),
            }
          );

          if (settlementResponse.ok) {
            const settlement = await settlementResponse.json();
            settlementData = {
              commissionRate: settlement.commissionRate || 15,
              commissionAmount: settlement.commissionAmount || 0,
              vendorAmount: settlement.vendorAmount || amount,
            };
          }
        } catch (error) {
          console.error('Error calculating settlement:', error);
          // Continue without settlement data - server will handle it
        }
      }

      return {
        success: true,
        paymentId: paymentResponse.razorpay_payment_id,
        orderId: paymentResponse.razorpay_order_id,
        settlementData,
      };
    } catch (error: any) {
      console.error('Payment processing error:', error);
      return { success: false, error: error.message || 'Payment failed' };
    }
  }

  /**
   * Get Razorpay key
   */
  getKey(): string | null {
    return this.razorpayKey;
  }
}

export default new RazorpayService();

