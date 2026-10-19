import type { Context } from 'hono';
import { resolveCustomerIdFromPhone, seedPackagesForCustomer } from '../repos/module-helpers.repo';
import * as customer_phone_packages_getRepo from '../repos/customer_phone_packages_get.repo';
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

export async function executecustomerPhonePackagesGet(c: Context) {
    try {
      const { phone } = c.req.param();
      const serviceType = c.req.query('serviceType');

      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        return c.json({ packages: [], success: true });
      }

      await seedPackagesForCustomer(customerId);

      let packageQuery = `
        SELECT 
          pp.*,
          v.business_name as vendor_name,
          v.phone as vendor_phone,
          (pp.total_sessions - pp.remaining_sessions) as sessions_used,
          ${sqlPackagePurchaseComputedStatus('pp')} as computed_status,
          pkg_pet.name as pet_name,
          pkg_pet.breed as pet_breed,
          pkg_pet.species as pet_species,
          pkg_pet.profile_photo_url as pet_photo
        FROM package_purchases pp
        LEFT JOIN vendors v ON pp.vendor_id = v.id
        LEFT JOIN LATERAL (
          SELECT b.pet_id
          FROM bookings b
          WHERE b.package_purchase_id = pp.id
            AND b.pet_id IS NOT NULL
          ORDER BY
            CASE
              WHEN COALESCE(b.is_package_session, false) = false AND b.parent_booking_id IS NULL THEN 0
              ELSE 1
            END,
            b.created_at ASC NULLS LAST
          LIMIT 1
        ) pkg_booking ON true
        LEFT JOIN pets pkg_pet ON pkg_pet.id = pkg_booking.pet_id
        WHERE pp.customer_id = $1
        AND pp.status NOT IN ('cancelled')
        AND (
          pp.expires_at IS NULL
          OR pp.expires_at > NOW() - INTERVAL '180 days'
        )
        AND (
          ${sqlPackagePurchaseActiveForListing('pp')}
          OR EXISTS (
            SELECT 1 FROM package_scheduled_sessions pss_hist
            WHERE pss_hist.package_purchase_id = pp.id
          )
          OR (COALESCE(pp.unlimited_usage, false) = false AND COALESCE(pp.remaining_sessions, pp.total_sessions) < COALESCE(pp.total_sessions, 1))
        )
      `;

      const params: any[] = [customerId];

      if (serviceType) {
        packageQuery += ` AND pp.package_type = $2`;
        params.push(serviceType);
      }

      packageQuery += ` ORDER BY pp.expires_at ASC NULLS LAST, pp.created_at DESC`;

      const result = await customer_phone_packages_getRepo.dbCustomerPhonePackagesGet0(packageQuery, params)

      // Enrich each package with includedServices (from snapshot or package definition)
      const packages = await Promise.all(result.rows.map(async (pkg: any) => {
        let includedServices: Array<{ id: string; name: string }> = [];
        const snapshot = pkg.package_snapshot && (typeof pkg.package_snapshot === 'string' ? JSON.parse(pkg.package_snapshot) : pkg.package_snapshot);
        if (snapshot?.includedServices && Array.isArray(snapshot.includedServices)) {
          includedServices = snapshot.includedServices.map((s: any) => ({ id: s.id || s.vendor_service_id, name: s.name || s.serviceName || 'Service' }));
        } else {
          // Try vendor_services (catalog package): package_id may be vendor_services.id
          try {
            const vsRows = await customer_phone_packages_getRepo.dbCustomerPhonePackagesGet1(pkg)
            if (vsRows.rows?.length > 0) {
              const meta = vsRows.rows[0].metadata;
              const parsed = typeof meta === 'string' ? (meta ? JSON.parse(meta) : {}) : (meta || {});
              const details = parsed?.packageDetails || parsed;
              const inc = details?.includedServices || details?.included_services;
              if (Array.isArray(inc) && inc.length > 0) {
                includedServices = inc.map((s: any) => ({ id: s.id || s.vendor_service_id, name: s.name || s.serviceName || 'Service' }));
              }
            }
          } catch (_) {}
          // Fallback: service_packages + package_services (legacy)
          if (includedServices.length === 0) {
            try {
              const psRows = await customer_phone_packages_getRepo.dbCustomerPhonePackagesGet2(pkg)
              if (psRows.rows?.length > 0) {
                includedServices = psRows.rows.map((r: any) => ({ id: r.service_id, name: r.service_name || 'Service' }));
              }
            } catch (_) {}
          }
        }
        return {
          id: pkg.id,
          packageName: pkg.package_name || pkg.name,
          vendorName: pkg.vendor_name,
          vendorId: pkg.vendor_id,
          serviceStyle: pkg.service_style || pkg.service_type || null,
          totalSessions: pkg.total_sessions,
          remainingSessions: pkg.unlimited_usage ? 'unlimited' : pkg.remaining_sessions,
          sessionsUsed: pkg.sessions_used || 0,
          expiresAt: pkg.expires_at,
          purchasedAt: pkg.purchased_at || pkg.created_at || null,
          isUnlimited: pkg.unlimited_usage,
          packageType: pkg.package_type,
          status: pkg.computed_status,
          petName: pkg.pet_name || null,
          petBreed: pkg.pet_breed || null,
          petSpecies: pkg.pet_species || null,
          petPhoto: pkg.pet_photo || null,
          includedServices,
        };
      }));

      return c.json({
        success: true,
        packages: packages,
        count: packages.length
      });
    } catch (error: any) {
      console.error('Error fetching packages by phone:', error);
      return c.json({ packages: [], success: true });
    }
}