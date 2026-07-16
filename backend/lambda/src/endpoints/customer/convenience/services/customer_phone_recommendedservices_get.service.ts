import type { Context } from 'hono';
import { resolveCustomerIdFromPhone } from '../repos/module-helpers.repo';
import * as customer_phone_recommendedservices_getRepo from '../repos/customer_phone_recommendedservices_get.repo';
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

export async function executecustomerPhoneRecommendedservicesGet(c: Context) {
    try {
      const { phone } = c.req.param();
      const limit = parseInt(c.req.query('limit') || '5');

      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        return c.json({ success: true, services: [] });
      }

      // Get customer's recent booking categories (bookings.service_id -> services.id)
      const recentBookings = await customer_phone_recommendedservices_getRepo.dbCustomerPhoneRecommendedservicesGet0(customerId).catch(() => ({ rows: [] }));

      const usedCategories = new Set((recentBookings.rows || []).map((r: any) => (r.category || '').toLowerCase()).filter(Boolean));

      // Complementary service suggestions based on what they've used
      const categoryToSuggestions: Record<string, Array<{ name: string; screen: string; category: string }>> = {
        vet: [
          { name: 'Grooming', screen: 'grooming', category: 'grooming' },
          { name: 'Dog Walking', screen: 'walker', category: 'walker' },
          { name: 'Training', screen: 'training', category: 'training' },
        ],
        grooming: [
          { name: 'Vet Consultation', screen: 'vet', category: 'vet' },
          { name: 'Dog Walking', screen: 'walker', category: 'walker' },
          { name: 'Training', screen: 'training', category: 'training' },
        ],
        training: [
          { name: 'Vet Consultation', screen: 'vet', category: 'vet' },
          { name: 'Grooming', screen: 'grooming', category: 'grooming' },
          { name: 'Dog Walking', screen: 'walker', category: 'walker' },
        ],
        walker: [
          { name: 'Grooming', screen: 'grooming', category: 'grooming' },
          { name: 'Vet Consultation', screen: 'vet', category: 'vet' },
          { name: 'Training', screen: 'training', category: 'training' },
        ],
        boarding: [
          { name: 'Vet Consultation', screen: 'vet', category: 'vet' },
          { name: 'Grooming', screen: 'grooming', category: 'grooming' },
          { name: 'Dog Walking', screen: 'walker', category: 'walker' },
        ],
      };

      const suggested = new Map<string, { name: string; screen: string; category: string }>();
      for (const row of recentBookings.rows || []) {
        const cat = (row.category || '').toLowerCase();
        const list = categoryToSuggestions[cat] || categoryToSuggestions['vet'] || [];
        for (const s of list) {
          if (!usedCategories.has(s.category) && !suggested.has(s.screen)) {
            suggested.set(s.screen, s);
          }
        }
      }

      // If no recent bookings, suggest popular services
      if (suggested.size === 0) {
        const popular = [
          { name: 'Vet Consultation', screen: 'vet', category: 'vet' },
          { name: 'Grooming', screen: 'grooming', category: 'grooming' },
          { name: 'Dog Walking', screen: 'walker', category: 'walker' },
          { name: 'Training', screen: 'training', category: 'training' },
          { name: 'Boarding', screen: 'boarding', category: 'boarding' },
        ];
        popular.slice(0, limit).forEach((s) => suggested.set(s.screen, s));
      }

      const services = Array.from(suggested.values()).slice(0, limit).map((s) => ({
        id: s.screen,
        name: s.name,
        screen: s.screen,
        category: s.category,
        serviceName: s.name,
      }));

      return c.json({ success: true, services });
    } catch (error: any) {
      console.error('[recommended-services] Error:', error?.message);
      return c.json({ success: true, services: [] });
    }
}