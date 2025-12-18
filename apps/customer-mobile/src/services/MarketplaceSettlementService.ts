/**
 * Marketplace Settlement Service - Customer Mobile App
 * Handles commission calculation and settlement information
 * Marketplace mode with automatic settlement via Razorpay Route
 */

import { API_BASE_URL, publicAnonKey } from '../config/api';

export interface SettlementInfo {
  commissionRate: number;
  commissionAmount: number;
  vendorAmount: number;
  vendorTier?: string;
  payoutPeriod?: number; // T+0, T+2, T+3 days
}

export interface TierInfo {
  id: string;
  name: string;
  displayName: string;
  commissionRate: number;
  payoutPeriod: number;
  monthlyCost: number;
  yearlyCost: number;
  features: string[];
}

class MarketplaceSettlementService {
  /**
   * Calculate settlement for a booking
   * Uses tier-based commission calculation from backend
   */
  async calculateSettlement(
    bookingId: string,
    vendorId: string,
    amount: number,
    paymentId?: string
  ): Promise<SettlementInfo | null> {
    try {
      // First get vendor tier to determine commission rate
      const tierResponse = await fetch(
        `${API_BASE_URL}/vendor/${encodeURIComponent(vendorId)}/tier`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      let commissionRate = 15; // Default
      let vendorTier = 'SILVER';
      let payoutPeriod = 3; // T+3 days

      if (tierResponse.ok) {
        const tierData = await tierResponse.json();
        if (tierData.config) {
          commissionRate = tierData.config.commissionRate || 15;
          vendorTier = tierData.currentTier || 'SILVER';
        }
      }

      // Calculate commission and vendor amount
      const commissionAmount = (amount * commissionRate) / 100;
      const vendorAmount = amount - commissionAmount;

      // Get tier details for payout period
      const tierDetailsResponse = await fetch(
        `${API_BASE_URL}/vendor/${encodeURIComponent(vendorId)}/payment-tier`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (tierDetailsResponse.ok) {
        const tierDetails = await tierDetailsResponse.json();
        if (tierDetails.tier) {
          payoutPeriod = tierDetails.tier.payoutPeriod || 3;
        }
      }

      return {
        commissionRate,
        commissionAmount,
        vendorAmount,
        vendorTier,
        payoutPeriod,
      };
    } catch (error) {
      console.error('Error calculating settlement:', error);
      return null;
    }
  }

  /**
   * Get vendor tier information
   */
  async getVendorTier(vendorId: string): Promise<TierInfo | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/vendor/${encodeURIComponent(vendorId)}/payment-tier`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.tier || null;
      }

      return null;
    } catch (error) {
      console.error('Error fetching vendor tier:', error);
      return null;
    }
  }

  /**
   * Get all available tiers
   */
  async getAvailableTiers(): Promise<TierInfo[]> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/payments/tiers`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.tiers || [];
      }

      return [];
    } catch (error) {
      console.error('Error fetching tiers:', error);
      return [];
    }
  }

  /**
   * Get settlement status for a booking
   */
  async getSettlementStatus(bookingId: string, vendorId?: string): Promise<{
    status: 'pending' | 'processing' | 'settled' | 'failed';
    settlementId?: string;
    settledAt?: string;
    commissionAmount?: number;
    vendorAmount?: number;
  } | null> {
    try {
      // Try to get settlement by booking ID or vendor ID
      if (vendorId) {
        const response = await fetch(
          `${API_BASE_URL}/payment/settlement/vendor/${encodeURIComponent(vendorId)}`,
          {
            headers: {
              Authorization: `Bearer ${publicAnonKey}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const settlement = data.settlements?.find((s: any) => s.bookingId === bookingId);
          if (settlement) {
            return {
              status: settlement.status,
              settlementId: settlement.settlementId,
              settledAt: settlement.processedAt,
              commissionAmount: settlement.commission,
              vendorAmount: settlement.netAmount,
            };
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error fetching settlement status:', error);
      return null;
    }
  }
}

export default new MarketplaceSettlementService();

