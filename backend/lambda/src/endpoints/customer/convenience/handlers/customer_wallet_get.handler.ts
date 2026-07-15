import type { Context } from 'hono';
/**
 * ============================================================================
 * CUSTOMER PHONE-BASED CONVENIENCE ENDPOINTS
 * ============================================================================
 * 
 * Provides convenience endpoints that accept phone numbers instead of customer IDs
 * These endpoints resolve phone to customer ID internally and forward to main endpoints
 * 
 * Endpoints:
 * - GET /customer/bookings?phone=... - Get bookings by phone
 * - GET /customer/cart/:phone - Get cart by phone
 * - PUT /customer/cart/:phone/items/:itemId - Update cart item by phone
 * - DELETE /customer/cart/:phone/items/:itemId - Remove cart item by phone
 * - GET /customer/saved/:phone - Get saved items by phone
 * - DELETE /customer/saved/:phone/items/:itemId - Remove saved item by phone
 * - GET /customer/wallet?phone=... - Get wallet by phone
 * - GET /customer/wallet/transactions?phone=... - Get wallet transactions by phone
 * - GET /customer/notifications/:phone - Inbox + notification channel settings (preferences.notificationSettings)
 * - PUT /customer/notifications/:phone - Save notification channel settings
 * - POST /customer/payments/:phone - Create payment by phone
 * 
 * Date: 2026-01-12
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { select, query, insert } from '../../../../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../../utils/entity-extractor';
import { isValidUUID } from '../../../../types/entities';
import { reconcileBookingPayments } from '../../../../utils/payments/payment-reconciliation';
import { resolveBookingPaymentSourcesBatch } from '../../../../utils/payments/booking-payment-sources';
import {
  DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS,
  fetchCustomerNotificationSettings,
  normalizeCustomerNotificationSettings,
  persistCustomerNotificationSettings,
} from '../../../../utils/customer-notification-settings';
import { presignProductImagesJsonb } from '../../../../utils/s3-media-presign';
import { bookingUsesDedicatedEndSessionOtp } from '../../../../lib/booking-dedicated-end-otp';
import {
  packageFieldsFromBookingRow,
  SQL_PACKAGE_PURCHASE_JOIN,
  SQL_PACKAGE_PURCHASE_SELECT,
} from '../../../../utils/customer-booking-package-fields';
import { expirePaymentHolds } from '../../../../utils/payment-hold';
import {
  seedFinitePackagesMissingSessionsForScope,
  type SqlClient,
} from '../../../../utils/package-session-sync';
import {
  sqlPackagePurchaseActiveForListing,
  sqlPackagePurchaseComputedStatus,
} from '../../../../utils/package-session-eligibility';

export async function customerWalletGetHandler(c: Context) {
    // Default wallet response - always return this structure
    const defaultWallet = {
      success: true,
      wallet: {
        balance: 0,
        currency: 'INR',
        pending_credits: 0,
        total_earned: 0,
        total_spent: 0,
      },
    };

    try {
      const phone = c.req.query('phone');

      if (!phone) {
        // Return default wallet instead of error for missing phone
        console.log('[WALLET] No phone provided, returning default wallet');
        return c.json(defaultWallet);
      }

      let customerId: string | null = null;
      try {
        customerId = await resolveCustomerIdFromPhone(phone);
      } catch (resolveError) {
        console.warn('[WALLET] Error resolving customer ID:', resolveError);
        return c.json(defaultWallet);
      }

      if (!customerId) {
        // Return default wallet for unregistered customers
        console.log('[WALLET] Customer not found for phone:', phone);
        return c.json(defaultWallet);
      }

      let wallet: any = { balance: 0, currency: 'INR', pending_credits: 0 };

      try {
        const walletResult = await query(
          `SELECT * FROM customer_wallets WHERE customer_id = $1 LIMIT 1`,
          [customerId]
        );

        if (walletResult.rows && walletResult.rows.length > 0) {
          wallet = walletResult.rows[0];
        } else {
          try {
            await query(
              `INSERT INTO customer_wallets (customer_id, balance, currency)
               VALUES ($1, 0, 'INR')
               ON CONFLICT (customer_id) DO NOTHING`,
              [customerId]
            );
          } catch (insertError) {
            console.log('[WALLET] Could not create wallet (table may not exist)');
          }
          const afterUpsert = await query(
            `SELECT * FROM customer_wallets WHERE customer_id = $1 LIMIT 1`,
            [customerId]
          );
          if (afterUpsert.rows && afterUpsert.rows.length > 0) {
            wallet = afterUpsert.rows[0];
          }
        }
      } catch (dbError: any) {
        console.warn('[WALLET] Database query failed:', dbError?.message || dbError);
        return c.json(defaultWallet);
      }

      const { totalEarned, totalSpent } = await getWalletLedgerTotalsByCustomerId(customerId);

      return c.json({
        success: true,
        wallet: {
          balance: parseFloat(wallet.balance || '0') || 0,
          currency: wallet.currency || 'INR',
          pending_credits: parseFloat(wallet.pending_credits || '0') || 0,
          total_earned: totalEarned,
          total_spent: totalSpent,
        },
      });
    } catch (error: any) {
      console.error('[WALLET] Unexpected error:', error?.message || error);
      // ✅ CRITICAL: Return default wallet on ANY error - never 500
      return c.json(defaultWallet);
    }
}
