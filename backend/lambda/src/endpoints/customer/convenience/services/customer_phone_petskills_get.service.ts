import type { Context } from 'hono';
import * as customer_phone_petskills_getRepo from '../repos/customer_phone_petskills_get.repo';
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

export async function executecustomerPhonePetskillsGet(c: Context) {
    try {
      const { phone } = c.req.param();

      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        return c.json({ skills: [], success: true });
      }

      // Get all pets for this customer
      const pets = await customer_phone_petskills_getRepo.dbCustomerPhonePetskillsGet0(customerId)

      if (pets.rows.length === 0) {
        return c.json({ skills: [], success: true });
      }

      const petIds = pets.rows.map((p: any) => p.id);

      // Get skill progress for all pets
      const skillsResult = await customer_phone_petskills_getRepo.dbCustomerPhonePetskillsGet1(ts, p, psp)

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