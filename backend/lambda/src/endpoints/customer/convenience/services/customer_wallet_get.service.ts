import type { Context } from 'hono';
import { resolveCustomerIdFromPhone, getWalletLedgerTotalsByCustomerId } from '../repos/module-helpers.repo';
import * as customer_wallet_getRepo from '../repos/customer_wallet_get.repo';
import { Hono } from 'hono';
import { randomUUID } from 'crypto';
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

export async function executecustomerWalletGet(c: Context) {
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
        const walletResult = await customer_wallet_getRepo.dbCustomerWalletGet0(customerId)

        if (walletResult.rows && walletResult.rows.length > 0) {
          wallet = walletResult.rows[0];
        } else {
          try {
            await customer_wallet_getRepo.dbCustomerWalletGet1(customerId)
          } catch (insertError) {
            console.log('[WALLET] Could not create wallet (table may not exist)');
          }
          const afterUpsert = await customer_wallet_getRepo.dbCustomerWalletGet2(customerId)
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