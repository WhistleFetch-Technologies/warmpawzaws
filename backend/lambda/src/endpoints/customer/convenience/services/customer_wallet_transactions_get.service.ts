import type { Context } from 'hono';
import { resolveCustomerIdFromPhone } from '../repos/module-helpers.repo';
import * as customer_wallet_transactions_getRepo from '../repos/customer_wallet_transactions_get.repo';
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

export async function executecustomerWalletTransactionsGet(c: Context) {
    try {
      const phone = c.req.query('phone');
      const type = c.req.query('type');
      const limit = parseInt(c.req.query('limit') || '50', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      if (!phone) {
        return c.json({ error: 'phone parameter is required' }, 400);
      }

      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      let transactionQuery = `
        SELECT * FROM wallet_transactions
        WHERE customer_id = $1
      `;

      const params: any[] = [customerId];
      let paramIndex = 2;

      if (type && type !== 'all') {
        transactionQuery += ` AND transaction_type = $${paramIndex}`;
        params.push(type);
        paramIndex++;
      }

      transactionQuery += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const transactions = await customer_wallet_transactions_getRepo.dbCustomerWalletTransactionsGet0(transactionQuery, params)

      return c.json({
        success: true,
        transactions: transactions.rows,
        count: transactions.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching wallet transactions by phone:', error);
      return c.json({ error: error.message }, 500);
    }
}