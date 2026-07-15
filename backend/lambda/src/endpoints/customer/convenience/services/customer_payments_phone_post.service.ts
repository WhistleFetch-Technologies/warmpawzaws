import type { Context } from 'hono';
import * as customer_payments_phone_postRepo from '../repos/customer_payments_phone_post.repo';
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

export async function executecustomerPaymentsPhonePost(c: Context) {
    try {
      const { phone } = c.req.param();
      const body = (await c.req.json().catch(() => ({}))) as Record<string, any>;

      const customerId = await resolveCustomerIdFromPhone(decodePhoneParam(phone));
      if (!customerId) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const type = normalizeIncomingPaymentType(body);
      const digitsOnly = (s: string) => s.replace(/\D/g, '');

      let cardLast4: string | undefined;
      if (type === 'card') {
        const raw = body.cardNumber ?? body.card_number;
        const d = typeof raw === 'string' ? digitsOnly(raw) : '';
        cardLast4 = d.length >= 4 ? d.slice(-4) : undefined;
        if (!cardLast4) {
          return c.json({ error: 'Valid card number is required' }, 400);
        }
      }

      if (type === 'upi') {
        const upi = body.upiId ?? body.upi_id;
        if (!upi || String(upi).trim() === '') {
          return c.json({ error: 'UPI ID is required' }, 400);
        }
      }

      if (type === 'netbanking') {
        const bank = body.bankName ?? body.bank_name;
        if (!bank || String(bank).trim() === '') {
          return c.json({ error: 'Bank name is required' }, 400);
        }
      }

      const isDefault = Boolean(body.isDefault ?? body.is_default);

      if (isDefault) {
        await customer_payments_phone_postRepo.dbCustomerPaymentsPhonePost0().catch((e) =>
          console.warn('[POST /customer/payments] clear defaults:', e?.message)
        );
      }

      // Per-type row: never send card_brand (e.g. default "visa") or card_last4 for UPI/netbanking.
      const insertRow: Record<string, unknown> = {
        customer_id: customerId,
        payment_type: type,
        is_default: isDefault || false,
        is_active: true,
      };
      const rt = body.razorpayToken ?? body.razorpay_token;
      if (rt != null && String(rt).trim() !== '') {
        insertRow.razorpay_token = rt;
      }

      if (type === 'card') {
        insertRow.card_last4 = cardLast4 ?? body.last4 ?? body.last_four;
        insertRow.card_brand = body.cardType ?? body.card_brand ?? body.brand ?? null;
        const holder = body.cardHolderName ?? body.card_holder_name;
        if (holder != null && String(holder).trim() !== '') {
          insertRow.card_holder_name = String(holder).trim().slice(0, 200);
        }
        const em = body.expiryMonth ?? body.expiry_month;
        const ey = body.expiryYear ?? body.expiry_year;
        if (em != null && String(em).trim() !== '') {
          const mn = parseInt(String(em).replace(/\D/g, ''), 10);
          if (!Number.isNaN(mn) && mn >= 1 && mn <= 12) {
            insertRow.card_expiry_month = String(mn).padStart(2, '0');
          }
        }
        if (ey != null && String(ey).trim() !== '') {
          let y = String(ey).replace(/\D/g, '');
          if (y.length === 2) y = `20${y}`;
          if (y.length === 4) insertRow.card_expiry_year = y;
        }
      } else if (type === 'upi') {
        insertRow.upi_id = String(body.upiId ?? body.upi_id ?? '').trim();
      } else if (type === 'netbanking') {
        insertRow.bank_name = String(body.bankName ?? body.bank_name ?? '').trim();
      }

      let inserted: any[];
      try {
        inserted = await customer_payments_phone_postRepo.dbCustomerPaymentsPhonePost1(insertRow)
      } catch (insertErr: any) {
        const errMsg = String(insertErr?.message || insertErr);
        const optionalCols = /card_holder_name|card_expiry_month|card_expiry_year/i.test(
          errMsg
        );
        if (optionalCols && /column/i.test(errMsg)) {
          delete insertRow.card_holder_name;
          delete insertRow.card_expiry_month;
          delete insertRow.card_expiry_year;
          try {
            inserted = await customer_payments_phone_postRepo.dbCustomerPaymentsPhonePost2(insertRow)
          } catch (retryErr: any) {
            console.error(
              '[POST /customer/payments] insert retry failed:',
              retryErr?.message || retryErr
            );
            const msg = retryErr?.message || 'Failed to save payment method';
            const isClient =
              /not null|violates|invalid input|check constraint/i.test(String(msg));
            return c.json({ error: msg }, isClient ? 400 : 500);
          }
        } else {
          console.error(
            '[POST /customer/payments] insert customer_payment_methods failed:',
            errMsg
          );
          const msg = insertErr?.message || 'Failed to save payment method';
          const isClient =
            /not null|violates|invalid input|check constraint/i.test(String(msg));
          return c.json({ error: msg }, isClient ? 400 : 500);
        }
      }

      const row = inserted[0] as Record<string, unknown> | undefined;
      if (!row) {
        return c.json({ error: 'Payment method was not created' }, 500);
      }

      return c.json({
        success: true,
        message: 'Payment method added successfully',
        paymentMethod: mapPaymentMethodRowForCustomerWeb(row),
      });
    } catch (error: any) {
      console.error('Error creating payment method:', error);
      return c.json({ error: error.message }, 500);
    }
}