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

export async function customerPhonePetskillsGetHandler(c: Context) {
    try {
      const { phone } = c.req.param();

      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        return c.json({ skills: [], success: true });
      }

      // Get all pets for this customer
      const pets = await query(`
        SELECT id, name FROM pets WHERE customer_id = $1
      `, [customerId]);

      if (pets.rows.length === 0) {
        return c.json({ skills: [], success: true });
      }

      const petIds = pets.rows.map((p: any) => p.id);

      // Get skill progress for all pets
      const skillsResult = await query(`
        SELECT 
          psp.*,
          ts.skill_name,
          ts.skill_category,
          p.name as pet_name
        FROM pet_skill_progress psp
        LEFT JOIN training_skills ts ON psp.skill_id = ts.id
        LEFT JOIN pets p ON psp.pet_id = p.id
        WHERE psp.pet_id = ANY($1)
        ORDER BY psp.updated_at DESC
      `, [petIds]);

      const skills = skillsResult.rows.map((skill: any) => {
        // Use proficiency_score (0-100) and current_level from schema
        const progressLevel = skill.proficiency_score || 0;
        const currentLevel = skill.current_level || 'not_started';

        return {
          skillName: skill.skill_name || 'Unknown Skill',
          level: progressLevel,
          status: currentLevel,
          petName: skill.pet_name,
          category: skill.skill_category,
          lastUpdated: skill.updated_at,
          sessionsPracticed: skill.sessions_practiced || 0
        };
      });

      return c.json({
        success: true,
        skills: skills,
        count: skills.length
      });
    } catch (error: any) {
      console.error('Error fetching pet skills by phone:', error);
      return c.json({ skills: [], success: true });
    }
}
