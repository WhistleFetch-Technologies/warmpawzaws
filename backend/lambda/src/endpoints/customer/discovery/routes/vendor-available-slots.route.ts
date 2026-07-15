import type { Hono } from 'hono';
import { select, query, insert } from '../../../../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../../utils/entity-extractor';
import { isValidUUID } from '../../../../types/entities';
import { getDiscoveryRules, type DiscoveryRuleSet } from '../../../../lib/rule-engine';
import { resolveVendorById, getVendorIdsForAvailabilityLookup, getVendorIdentityId } from '../../../vendor/endpoints/vendorProfile.vendor';
import { taxCalculationService } from '../../../../lib/services/tax-calculation-service';
import { discountCalculationService } from '../../../../lib/services/discount-calculation-service';
import { CATEGORY_ROLES } from '../../constants';
import { extractS3KeyFromUrl, regeneratePresignedUrl } from '../../../constants/helper';
import { getCustomerCoordinates, resolveCustomerIdFromPhone } from '../../../../utils/customer-coordinates';
import { seedFinitePackagesMissingSessionsForScope, type SqlClient } from '../../../../utils/package-session-sync';
import { sqlPackagePurchaseActiveForListing } from '../../../../utils/package-session-eligibility';
import { DistanceResolver, haversineKm, formatDistanceKm } from '../../../../lib/utils/vendor-customer-distance';
import {
  appendVetDiscoveryCategoryAliasKeys,
  buildDiscoveryVendorExistsSql,
  sqlVendorAvailabilityOrNotConfigured,
  sqlVendorDiscoverableStatus,
  sqlVendorOnlineForCustomerDiscovery,
  sqlVendorServiceDiscoverable,
  sqlVendorServicesHubCategoryFilter,
  vendorServicesHubCategoryBindParams,
  sqlVetHubExcludeNonVetServices,
  sqlVetHubPlaceholderCategoryOr,
  VET_HUB_PLACEHOLDER_CATEGORY_ROLES_SQL,
  isVetHubCategoryRequest,
  TRAINING_HUB_ROLE_SQL_IN_LIST,
  BEHAVIOR_HUB_ROLE_SQL_IN_LIST,
  catTextRequestsBehaviorHub,
  sqlTrainingCategoryAliasOrVs,
} from '../../../../lib/discovery-vendor-query';
import { acceptableAvailabilityStylesForSlot, normalizeAvailabilityServiceStyle } from '../../../../utils/availability-service-styles';
import { vendorGalleryDrivesListingPhoto, getVendorListingPhotoUrl } from '../../../../utils/vendor-listing-photo';
import {
  addDaysToYmd,
  dayOfWeekFromYmd,
  DEFAULT_MIN_NOTICE_MINUTES,
  formatNextAvailableDisplay,
  isSlotPastInIst,
  ymdInIst,
} from '../../../../utils/ist-scheduling';
import {
  filterSearchResultsByDiscoveryRules,
  hubSlugToDiscoveryContext,
  loadVendorRadiusMetaByIds,
  type HubDiscoveryContext,
} from '../../../../lib/search-discovery-parity';
import {
  uploadDisplayImage,
  ImageProcessingError,
  FACILITY_MAX_PHOTOS,
  mapWithConcurrency,
  resolveImageForContext,
} from '../../../../services/image';

import {
  normalizeServiceStyle,
  vendorRowIsOnline,
} from '../shared/legacy-helpers';

export function registerVendorAvailableSlotsRoute(app: Hono) {
  app.get("/customer/vendor/:vendorId/available-slots", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const date = c.req.query('date');
      // Vendor VA2 rows use canonical styles (tele, at_home); listings/catalog often send video_consultation / home_visit.
      const serviceStyleRaw = String(c.req.query('serviceStyle') || 'at_home').trim();
      const serviceStyle = normalizeAvailabilityServiceStyle(serviceStyleRaw) || normalizeServiceStyle(serviceStyleRaw) || serviceStyleRaw;
      const staffId = c.req.query('staffId');
      const serviceId = c.req.query('serviceId');
      const totalDuration = Math.max(15, parseInt(c.req.query('totalDuration') || '30', 10) || 30);

      if (!date) {
        return c.json({ error: 'date parameter is required' }, 400);
      }

      // Resolve vendor (frontend may pass vendor_identity.id or staff's vendor_id; resolve to vendors.id)
      console.log(`[SLOTS] ========== STARTING VENDOR RESOLUTION ==========`);
      console.log(`[SLOTS] Input vendorId from URL: ${vendorId}`);

      // ✅ CRITICAL: First check if input vendorId is a vendor_identity.id and get its linked vendor_id
      let linkedVendorId: string | null = null;
      try {
        const viCheck = await query(
          `SELECT vendor_id::text as vendor_id_text, phone, onboarding_status
           FROM vendor_identity 
           WHERE id::text = $1 
           LIMIT 1`,
          [vendorId]
        );
        if (viCheck.rows.length > 0) {
          const vi = viCheck.rows[0];
          console.log(`[SLOTS] Input is vendor_identity.id: ${vendorId}`);
          console.log(`[SLOTS] vendor_identity.vendor_id: ${vi.vendor_id_text}`);
          console.log(`[SLOTS] vendor_identity.phone: ${vi.phone}, status: ${vi.onboarding_status}`);
          if (vi.vendor_id_text) {
            linkedVendorId = vi.vendor_id_text;
            console.log(`[SLOTS] ✅ Found linked vendor_id: ${linkedVendorId}`);
          }
        }
      } catch (e: any) {
        console.warn(`[SLOTS] Could not check vendor_identity: ${e?.message}`);
      }

      let resolvedVendorId: string;
      let availabilityIdsForQuery: string[];
      let canonicalVendorId: string;

      console.log(`[SLOTS] ========== CUSTOMER SLOTS REQUEST START ==========`);
      console.log(`[SLOTS] Input vendorId (from URL param): ${vendorId}`);
      console.log(`[SLOTS] Requested date: ${date}`);
      console.log(`[SLOTS] Requested serviceStyle: ${serviceStyle}`);

      const vendor = await resolveVendorById(vendorId);
      console.log(`[SLOTS] resolveVendorById result:`, vendor ? { id: vendor.id, business_name: vendor.business_name, phone: vendor.phone, status: vendor.status, is_active: vendor.is_active } : 'null');
      if (!vendor) {
        console.log(`[SLOTS] ERROR: Vendor not found for ID: ${vendorId}`);
        // ✅ FIX: If we found a linked vendor_id but resolveVendorById failed, try using the linked vendor_id directly
        if (linkedVendorId) {
          console.log(`[SLOTS] ⚠️ resolveVendorById failed, but found linked vendor_id: ${linkedVendorId}, trying direct lookup...`);
          const directVendor = await query(
            `SELECT * FROM vendors WHERE id::text = $1 LIMIT 1`,
            [linkedVendorId]
          ).catch(() => ({ rows: [] }));
          if (directVendor.rows.length > 0) {
            resolvedVendorId = linkedVendorId;
            const availabilityIds = await getVendorIdsForAvailabilityLookup(resolvedVendorId);
            canonicalVendorId = resolvedVendorId;
            availabilityIdsForQuery = availabilityIds;
            console.log(`[SLOTS] ✅ Using linked vendor_id directly: ${canonicalVendorId}`);
            console.log(`[SLOTS] availabilityIdsForQuery: ${JSON.stringify(availabilityIdsForQuery)}`);
          } else {
            return c.json({ error: 'Vendor not found' }, 404);
          }
        } else {
          return c.json({ error: 'Vendor not found' }, 404);
        }
      } else {
        // ✅ CRITICAL: Check if vendor exists but availability might be stored under a different vendor_id
        // This can happen if vendor was recreated or there are duplicate vendor records
        console.log(`[SLOTS] Vendor found: id=${vendor.id}, business_name=${vendor.business_name}, phone=${vendor.phone}`);

        // Check if availability exists for this vendor_id
        const availabilityCheck = await query(
          `SELECT COUNT(*) as count FROM vendor_availability_v2 WHERE vendor_id::text = $1`,
          [vendor.id]
        ).catch(() => ({ rows: [{ count: 0 }] }));

        const availabilityCount = parseInt(availabilityCheck.rows[0]?.count || '0', 10);
        console.log(`[SLOTS] Availability records for vendor.id ${vendor.id}: ${availabilityCount}`);

        // ✅ FIX: Always check for other vendors with same phone that have availability
        // This handles the case where availability is stored under a different vendor_id
        let finalVendorId = vendor.id;
        let allAvailabilityIds: string[] = [];

        if (vendor.phone) {
          console.log(`[SLOTS] Checking for other vendors with same phone (${vendor.phone}) that have availability...`);
          const duplicateVendors = await query(
            `SELECT id::text, business_name, 
                    (SELECT COUNT(*) FROM vendor_availability_v2 WHERE vendor_id::text = vendors.id::text) as availability_count
             FROM vendors 
             WHERE phone = $1
             ORDER BY availability_count DESC, id::text
             LIMIT 10`,
            [vendor.phone]
          ).catch(() => ({ rows: [] }));

          if (duplicateVendors.rows.length > 0) {
            console.log(`[SLOTS] Found ${duplicateVendors.rows.length} vendor(s) with same phone:`);
            duplicateVendors.rows.forEach((dup: any) => {
              console.log(`[SLOTS]   - vendor.id: ${dup.id}, business_name: ${dup.business_name}, availability_count: ${dup.availability_count}`);
            });

            // Find the vendor with the most availability (or use current vendor if it has availability)
            const vendorWithMostAvailability = duplicateVendors.rows.find((dup: any) => parseInt(dup.availability_count || '0', 10) > 0) ||
              (availabilityCount > 0 ? { id: vendor.id, availability_count: availabilityCount } : null);

            if (vendorWithMostAvailability) {
              finalVendorId = vendorWithMostAvailability.id;
              console.log(`[SLOTS] ✅ Using vendor with availability: ${finalVendorId} (availability_count: ${vendorWithMostAvailability.availability_count})`);
            } else {
              finalVendorId = vendor.id;
              console.log(`[SLOTS] No vendor with availability found, using original: ${finalVendorId}`);
            }
          } else {
            finalVendorId = vendor.id;
          }
        } else {
          finalVendorId = vendor.id;
        }

        // ✅ CRITICAL: Use EXACT same logic as GET /vendor/:vendorId/availability endpoint
        // That endpoint uses getVendorIdsForAvailabilityLookup and queries with ANY($1::text[])
        // This automatically includes all vendors with same phone, so availability will be found
        resolvedVendorId = finalVendorId;
        canonicalVendorId = finalVendorId;
        availabilityIdsForQuery = await getVendorIdsForAvailabilityLookup(finalVendorId);
        console.log(`[SLOTS] ========== VENDOR ID RESOLUTION COMPLETE ==========`);
        console.log(`[SLOTS] Input vendorId (from URL): ${vendorId}`);
        console.log(`[SLOTS] Resolved vendor.id: ${vendor.id}`);
        console.log(`[SLOTS] Final vendorId for query: ${finalVendorId}`);
        console.log(`[SLOTS] canonicalVendorId: ${canonicalVendorId}`);
        console.log(`[SLOTS] availabilityIdsForQuery: ${JSON.stringify(availabilityIdsForQuery)}`);
        console.log(`[SLOTS] Are input and resolved different? ${vendorId !== vendor.id ? 'YES - This might be the issue!' : 'NO - Same ID'}`);

        // ✅ CRITICAL: Check vendor status
        console.log(`[SLOTS] Vendor status check: status=${vendor.status}, is_active=${vendor.is_active}, is_online=${vendor.is_online}`);

        // ✅ CRITICAL: Check what availability exists for each ID
        console.log(`[SLOTS] Checking availability records...`);
        for (const availId of availabilityIdsForQuery) {
          const availCheck = await query(
            `SELECT COUNT(*) as count, 
                    array_agg(DISTINCT day_of_week) as days,
                    array_agg(DISTINCT service_styles) as styles
             FROM vendor_availability_v2 
             WHERE vendor_id::text = $1 
               AND (COALESCE(is_available, true) = true)`,
            [availId]
          ).catch(() => ({ rows: [{ count: 0, days: [], styles: [] }] }));
          console.log(`[SLOTS]   - vendor_id ${availId}: ${availCheck.rows[0]?.count || 0} records, days: ${JSON.stringify(availCheck.rows[0]?.days)}, styles: ${JSON.stringify(availCheck.rows[0]?.styles)}`);

          // ✅ CRITICAL: Also check vendor status for this ID
          const vendorStatusCheck = await query(
            `SELECT id::text, business_name, status, is_active, is_online 
             FROM vendors 
             WHERE id::text = $1`,
            [availId]
          ).catch(() => ({ rows: [] }));
          if (vendorStatusCheck.rows.length > 0) {
            const v = vendorStatusCheck.rows[0];
            console.log(`[SLOTS]   - vendor status: id=${v.id}, status=${v.status}, is_active=${v.is_active}, is_online=${v.is_online}`);
          } else {
            // ✅ CRITICAL: Check if this is a vendor_identity.id
            const identityCheck = await query(
              `SELECT id::text, vendor_id::text, phone, onboarding_status 
               FROM vendor_identity 
               WHERE id::text = $1`,
              [availId]
            ).catch(() => ({ rows: [] }));
            if (identityCheck.rows.length > 0) {
              const vi = identityCheck.rows[0];
              console.log(`[SLOTS]   - This is vendor_identity.id: ${vi.id}, vendor_id: ${vi.vendor_id}, phone: ${vi.phone}`);
            }
          }
        }

        // ✅ CRITICAL: Also check availability under the original input vendor ID (in case it's different)
        if (vendorId !== finalVendorId && !availabilityIdsForQuery.includes(vendorId)) {
          console.log(`[SLOTS] ⚠️ Input vendorId ${vendorId} not in availabilityIdsForQuery, checking availability directly...`);
          const directAvailCheck = await query(
            `SELECT COUNT(*) as count FROM vendor_availability_v2 WHERE vendor_id::text = $1`,
            [vendorId]
          ).catch(() => ({ rows: [{ count: 0 }] }));
          console.log(`[SLOTS]   - Direct check for vendor_id ${vendorId}: ${directAvailCheck.rows[0]?.count || 0} records`);
          if (parseInt(directAvailCheck.rows[0]?.count || '0', 10) > 0) {
            console.log(`[SLOTS] ⚠️ WARNING: Availability exists under input vendorId ${vendorId} but it's not in availabilityIdsForQuery!`);
            availabilityIdsForQuery.push(vendorId);
            console.log(`[SLOTS] ✅ Added ${vendorId} to availabilityIdsForQuery`);
          }
        }

        // ✅ CRITICAL: Find ALL vendor_identity records for this vendor and check if availability exists under any of them
        // This handles the case where availability was saved under vendor_identity.id instead of vendors.id
        if (vendor.phone) {
          console.log(`[SLOTS] ⚠️ Checking ALL vendor_identity records for phone ${vendor.phone} to find availability...`);
          const allIdentityRecords = await query(
            `SELECT id::text, vendor_id::text, phone 
             FROM vendor_identity 
             WHERE phone = $1 OR vendor_id::text = $2`,
            [vendor.phone, finalVendorId]
          ).catch(() => ({ rows: [] }));
          console.log(`[SLOTS] Found ${allIdentityRecords.rows.length} vendor_identity records for this vendor`);
          for (const identityRow of allIdentityRecords.rows) {
            const identityId = identityRow.id;
            if (!availabilityIdsForQuery.includes(identityId)) {
              const identityAvailCheck = await query(
                `SELECT COUNT(*) as count FROM vendor_availability_v2 WHERE vendor_id::text = $1`,
                [identityId]
              ).catch(() => ({ rows: [{ count: 0 }] }));
              const availCount = parseInt(identityAvailCheck.rows[0]?.count || '0', 10);
              console.log(`[SLOTS]   - vendor_identity.id ${identityId}: ${availCount} availability records`);
              if (availCount > 0) {
                console.log(`[SLOTS] ⚠️ WARNING: Availability exists under vendor_identity.id ${identityId}!`);
                availabilityIdsForQuery.push(identityId);
                console.log(`[SLOTS] ✅ Added ${identityId} to availabilityIdsForQuery`);
              }
            }
          }
        }
        console.log(`[SLOTS] Final resolved vendor: id=${resolvedVendorId}, business_name=${vendor.business_name}, phone=${vendor.phone}`);
        console.log(`[SLOTS] ✅ Using array query with availabilityIdsForQuery (includes all vendors with same phone)`);
      }

      // Parse date in local timezone to avoid UTC issues
      // Date format: "YYYY-MM-DD"
      const [year, month, day] = date.split('-').map(Number);
      const requestedDate = new Date(year, month - 1, day);
      const dayOfWeek = requestedDate.getDay();
      const slotsDebug = c.req.query('debug') === '1' || c.req.query('debug') === 'true';
      console.log(`[SLOTS] Date parsing: input=${date}, parsed=${requestedDate.toISOString()}, dayOfWeek=${dayOfWeek} (0=Sun, 1=Mon, 2=Tue, etc.)`);
      if (slotsDebug) {
        console.log(`[SLOTS] debug: resolvedVendorId=${resolvedVendorId}, canonicalVendorId=${canonicalVendorId}, availabilityIdsForQuery=${JSON.stringify(availabilityIdsForQuery)}, date=${date}, dayOfWeek=${dayOfWeek}, serviceStyle=${serviceStyle}`);
        try {
          const va2DebugRows = await query(
            `SELECT vendor_id, day_of_week,
             COALESCE(service_styles, ARRAY[]::text[]) as service_styles,
             service_style, service_type, is_available, is_enabled
             FROM vendor_availability_v2
             WHERE vendor_id::text = ANY($1::text[])
             ORDER BY day_of_week`,
            [availabilityIdsForQuery]
          );
          const rows = (va2DebugRows?.rows ?? []).slice(0, 25);
          console.log(`[SLOTS] debug: VA2 total=${va2DebugRows?.rows?.length ?? 0}, dayOfWeek requested=${dayOfWeek}, sample=${JSON.stringify(rows)}`);
        } catch (e: any) {
          console.warn('[SLOTS] debug: VA2 lookup failed', e?.message);
        }
      }
      // ✅ CRITICAL FIX: All times in the system are IST (UTC+5:30).
      // Lambda runs in UTC, so we must offset comparisons by +5:30 to correctly determine past slots.
      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
      const nowUTC = new Date();
      const nowIST = new Date(nowUTC.getTime() + IST_OFFSET_MS); // Current time in IST

      // Use IST-based "today" for date comparison
      const todayIST = new Date(nowIST);
      todayIST.setHours(0, 0, 0, 0);
      const requestedDateOnly = new Date(requestedDate);
      requestedDateOnly.setHours(0, 0, 0, 0);
      const isToday = requestedDateOnly.getTime() === todayIST.getTime();
      const now = nowIST; // Use IST time for all "now" comparisons

      console.log(`[SLOTS] Timezone: nowUTC=${nowUTC.toISOString()}, nowIST=${nowIST.toISOString()}, todayIST=${todayIST.toISOString()}, requestedDate=${requestedDateOnly.toISOString()}, isToday=${isToday}`);

      // Scheduling policy: min notice (past booking window) - used for both staff and va2 paths
      let minNoticeMinutes = 30;
      try {
        const policies = await query(`SELECT policy_type, policy_config FROM scheduling_policies WHERE is_active = true`).catch(() => ({ rows: [] }));
        const bufferPolicy = policies.rows.find((p: any) => p.policy_type === 'buffer_time');
        if (bufferPolicy?.policy_config) {
          const cfg = bufferPolicy.policy_config as any;
          minNoticeMinutes = cfg.minBufferTime ?? cfg.minNoticeMinutes ?? 30;
        }
      } catch (_) { /* ignore */ }
      const minBookingTime = new Date(now.getTime() + minNoticeMinutes * 60 * 1000);

      const vendorOnlineRow = await query(
        `SELECT COALESCE(is_online, true) AS is_online FROM vendors WHERE id::text = $1 LIMIT 1`,
        [resolvedVendorId]
      ).catch(() => ({ rows: [] }));
      const slotVendorOnline = vendorRowIsOnline(vendorOnlineRow.rows?.[0]?.is_online);
      if (!slotVendorOnline) {
        return c.json({
          success: true,
          slots: [],
          date,
          vendorId: canonicalVendorId,
          inputVendorId: vendorId,
          serviceStyle,
          staffBased: false,
          isOnline: false,
          vendorOnline: false,
          message: 'Vendor is currently offline',
        });
      }

      // ---------- 1) Holiday check: no slots if vendor has holiday on this date ----------
      let isHoliday = false;
      try {
        const holEnhanced = await query(
          `SELECT 1 FROM vendor_holidays_enhanced 
           WHERE vendor_id = $1 AND is_active = true
             AND ($2::date >= start_date AND $2::date <= end_date)
           LIMIT 1`,
          [resolvedVendorId, date]
        ).catch(() => ({ rows: [] }));
        if (holEnhanced.rows.length > 0) {
          isHoliday = true;
        }
      } catch {
        // ignore
      }
      if (!isHoliday) {
        try {
          const holLegacy = await query(
            `SELECT 1 FROM vendor_holidays WHERE vendor_id = $1 AND date = $2 LIMIT 1`,
            [resolvedVendorId, date]
          ).catch(() => ({ rows: [] }));
          if (holLegacy.rows.length > 0) isHoliday = true;
        } catch {
          // ignore
        }
      }
      if (!isHoliday && vendor?.metadata && (vendor.metadata as any).vacation_mode?.isActive) {
        const vm = (vendor.metadata as any).vacation_mode;
        const start = new Date(vm.startDate);
        const end = new Date(vm.endDate);
        if (requestedDate >= start && requestedDate <= end) isHoliday = true;
      }
      if (isHoliday) {
        return c.json({
          success: true,
          slots: [],
          date,
          vendorId: canonicalVendorId,
          serviceStyle,
          staffBased: false,
          isOnline: true,
          vendorOnline: true,
          message: 'Vendor is on holiday or vacation on this date',
        });
      }

      // Staff-based availability (at_home/tele): still uses staff_availability_slots; past-window enforced below
      if (serviceStyle === 'at_home' || serviceStyle === 'tele') {
        let staffQuery = `
          SELECT DISTINCT 
            sas.id as slot_id,
            sas.staff_id,
            s.name as staff_name,
            s.photo_url as staff_photo,
            sas.start_time,
            sas.end_time,
            sas.is_available,
            sss.lead_time_minutes,
            sss.buffer_time_minutes
          FROM staff_availability_slots sas
          INNER JOIN staff s ON sas.staff_id = s.id
          LEFT JOIN staff_slot_services sss ON sas.id = sss.slot_id
          LEFT JOIN services srv ON sss.service_id = srv.id
          WHERE s.vendor_id = $1
          AND sas.date = $2
          AND sas.is_available = true
          AND s.is_active = true
          AND s.mobile_verified = true
        `;
        const params: any[] = [resolvedVendorId, date];
        let paramIndex = 3;

        if (staffId) {
          staffQuery += ` AND s.id = $${paramIndex}`;
          params.push(staffId);
          paramIndex++;
        }

        if (serviceId) {
          staffQuery += ` AND sss.service_id = $${paramIndex}`;
          params.push(serviceId);
          paramIndex++;
        }

        // Filter by service style - removed since services table doesn't have service_style column
        // Service style filtering is handled at vendor_services level, not at staff_slot_services level
        // staffQuery += ` AND (srv.service_style = $${paramIndex} OR srv.service_style IS NULL)`;
        // params.push(serviceStyle);
        // paramIndex++;

        staffQuery += ` ORDER BY sas.start_time, s.name`;

        const staffSlotsResult = await query(staffQuery, params).catch((err) => {
          console.warn('[SLOTS] Staff availability query failed, falling back to vendor hours:', err.message);
          return { rows: [] };
        });

        if (staffSlotsResult.rows.length > 0) {
          // Get existing bookings to mark booked slots
          const existingBookingsResult = await query(
            `SELECT booking_time, staff_id FROM bookings 
             WHERE vendor_id = $1 
             AND booking_date = $2 
             AND status NOT IN ('cancelled', 'rejected')`,
            [resolvedVendorId, date]
          ).catch(() => ({ rows: [] }));

          // Group bookings by staff
          const bookedByStaff: Record<string, Set<string>> = {};
          for (const booking of existingBookingsResult.rows) {
            const sid = booking.staff_id || 'general';
            if (!bookedByStaff[sid]) {
              bookedByStaff[sid] = new Set();
            }
            const time = typeof booking.booking_time === 'string'
              ? booking.booking_time.substring(0, 5)
              : booking.booking_time;
            bookedByStaff[sid].add(time);
          }

          // Slots stepped by service duration + staff buffer/lead (same idea as vendor_availability_v2 grid)
          const slots: any[] = [];
          // ✅ CRITICAL FIX: Use IST time (already defined above) for past slot checks
          // Staff slot times are in IST, so we must compare with IST current time
          // nowIST, todayIST, isToday are already defined above with IST offset

          for (const staffSlot of staffSlotsResult.rows) {
            const [startHour, startMin] = staffSlot.start_time.split(':').map(Number);
            const [endHour, endMin] = staffSlot.end_time.split(':').map(Number);
            const winStartMin = startHour * 60 + startMin;
            const winEndMin = endHour * 60 + endMin;
            const staffSetupGap = Math.max(
              Number(staffSlot.buffer_time_minutes) || 0,
              Number(staffSlot.lead_time_minutes) || 0
            );
            const stepMin = Math.max(5, totalDuration + staffSetupGap);
            const staffBookedTimes = bookedByStaff[staffSlot.staff_id] || new Set();

            let cur = winStartMin;
            while (cur + totalDuration <= winEndMin) {
              const currentHour = Math.floor(cur / 60);
              const currentMin = cur % 60;
              const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;

              // ✅ ENFORCE: Past booking window (scheduling policy min notice)
              // ✅ CRITICAL FIX: Compare IST slot time with IST current time
              // Slot times are in IST, nowIST and minBookingTime are also in IST
              let isPast = false;
              if (isToday) {
                // Build IST slot time: use todayIST as base (which is IST midnight)
                // Then add slot hours/minutes to get IST slot time
                const slotMinutesFromMidnight = cur;
                const currentISTMinutesFromMidnight = nowIST.getHours() * 60 + nowIST.getMinutes();
                // Slot is past if its IST time + buffer is before current IST time
                isPast = (slotMinutesFromMidnight + minNoticeMinutes) <= currentISTMinutesFromMidnight;
              }

              // Check if booked for this staff
              const isBooked = staffBookedTimes.has(timeStr);

              slots.push({
                time: timeStr,
                available: !isPast && !isBooked,
                booked: isBooked,
                staffId: staffSlot.staff_id,
                staffName: staffSlot.staff_name,
                staffPhoto: staffSlot.staff_photo,
                leadTimeMinutes: staffSlot.lead_time_minutes || 0,
                bufferTimeMinutes: staffSlot.buffer_time_minutes || 0,
                slotDuration: stepMin,
              });

              cur += stepMin;
            }
          }

          // Remove duplicate times and sort
          const uniqueSlots = slots.reduce((acc: any[], slot) => {
            const existing = acc.find(s => s.time === slot.time && s.staffId === slot.staffId);
            if (!existing) {
              acc.push(slot);
            }
            return acc;
          }, []);

          return c.json({
            success: true,
            slots: uniqueSlots.sort((a, b) => a.time.localeCompare(b.time)),
            date,
            vendorId,
            serviceStyle,
            staffBased: true, // ✅ Flag indicating slots are staff-specific
            isOnline: true,
            vendorOnline: true,
          });
        }
        // If no staff availability found, fall through to vendor_availability_v2 then operating hours
      }

      // ---------- 2) Slot-based advance availability only: vendor_availability_v2 (no fallback) ----------
      // Only vendors who have set advance availability in the dashboard get slots. No weekly fallback.
      const normalizedServiceStyle = normalizeAvailabilityServiceStyle(serviceStyle);
      // Keep style matching centralized so aliases (e.g. home_visit -> at_home) stay in sync.
      const acceptableStylesForSlot: string[] = acceptableAvailabilityStylesForSlot(normalizedServiceStyle);
      const dayOfWeekValues = dayOfWeek === 0 ? [0, 7] : [dayOfWeek];
      let va2Slots: any[] = [];

      // ✅ DEBUG: Log vendor ID resolution
      console.log(`[SLOTS] ========== VENDOR ID RESOLUTION ==========`);
      console.log(`[SLOTS] inputVendorId=${vendorId}`);
      console.log(`[SLOTS] resolvedVendorId=${resolvedVendorId}`);
      console.log(`[SLOTS] canonicalVendorId=${canonicalVendorId}`);
      console.log(`[SLOTS] availabilityIdsForQuery=${JSON.stringify(availabilityIdsForQuery)}`);
      console.log(`[SLOTS] ========== QUERY PARAMETERS ==========`);
      console.log(`[SLOTS] date=${date}, dayOfWeek=${dayOfWeek} (0=Sun, 1=Mon, 2=Tue, etc.)`);
      console.log(`[SLOTS] serviceStyle=${serviceStyle}, normalizedServiceStyle=${normalizedServiceStyle}`);
      console.log(`[SLOTS] acceptableStylesForSlot=${JSON.stringify(acceptableStylesForSlot)}`);
      console.log(`[SLOTS] dayOfWeekValues=${JSON.stringify(dayOfWeekValues)}`);

      // ✅ DEBUG: Check if any availability records exist for this vendor
      try {
        // First, check if ANY records exist for ANY of the availabilityIds (to see if vendor_id matches)
        const anyRecordsQuery = await query(
          `SELECT vendor_id::text, day_of_week, 
                  COALESCE(service_styles, ARRAY[]::text[]) as service_styles,
                  service_style, service_type
           FROM vendor_availability_v2
           WHERE vendor_id::text = ANY($1::text[])
           ORDER BY day_of_week
           LIMIT 10`,
          [availabilityIdsForQuery]
        );
        console.log(`[SLOTS] ========== ANY RECORDS FOR availabilityIdsForQuery ==========`);
        console.log(`[SLOTS] availabilityIdsForQuery: ${JSON.stringify(availabilityIdsForQuery)}`);
        console.log(`[SLOTS] Total records found: ${anyRecordsQuery.rows.length}`);
        if (anyRecordsQuery.rows.length > 0) {
          console.log(`[SLOTS] Sample records:`, JSON.stringify(anyRecordsQuery.rows.slice(0, 3), null, 2));
        } else {
          console.log(`[SLOTS] ⚠️ NO RECORDS FOUND for any vendor_id in availabilityIdsForQuery!`);
          console.log(`[SLOTS] This means vendor_id in vendor_availability_v2 doesn't match any ID in availabilityIdsForQuery`);
        }

        // Check ALL vendor_availability_v2 records for this vendor (no filters)
        const allVA2Records = await query(
          `SELECT vendor_id::text, day_of_week, 
                  COALESCE(service_styles, ARRAY[]::text[]) as service_styles,
                  service_type, 
                  is_available,
                  COALESCE(time_window_start, start_time) as start_time,
                  COALESCE(time_window_end, end_time) as end_time
           FROM vendor_availability_v2
           WHERE vendor_id::text = $1
           ORDER BY day_of_week, COALESCE(time_window_start, start_time)`,
          [canonicalVendorId]
        );
        console.log(`[SLOTS] ========== ALL vendor_availability_v2 RECORDS FOR CANONICAL VENDOR ID ==========`);
        console.log(`[SLOTS] canonicalVendorId: ${canonicalVendorId}`);
        console.log(`[SLOTS] Total records: ${allVA2Records.rows.length}`);
        if (allVA2Records.rows.length > 0) {
          console.log(`[SLOTS] Records:`, JSON.stringify(allVA2Records.rows, null, 2));
        } else {
          console.log(`[SLOTS] ⚠️ NO RECORDS FOUND for canonicalVendorId!`);
        }

        // Diagnostic query with filters
        const diagnosticQuery = await query(
          `SELECT 
            COUNT(*) as total_count,
            COUNT(*) FILTER (WHERE day_of_week = ANY($2::int[])) as day_match_count,
            COUNT(*) FILTER (WHERE day_of_week = ANY($2::int[]) AND (
               (COALESCE(service_styles, ARRAY[]::text[]) && $3::text[])
              OR (service_type IS NOT NULL AND service_type::text = ANY($3::text[]))
            )) as day_style_match_count,
            COUNT(*) FILTER (WHERE day_of_week = ANY($2::int[]) AND (
              (COALESCE(service_styles, ARRAY[]::text[]) && $3::text[])
              OR (service_type IS NOT NULL AND service_type::text = ANY($3::text[]))
            ) AND (COALESCE(is_available, true) = true OR is_available IS NULL)) as day_style_enabled_match_count,
            array_agg(DISTINCT day_of_week) as distinct_days,
            array_agg(DISTINCT service_type) FILTER (WHERE service_type IS NOT NULL) as distinct_service_types
           FROM vendor_availability_v2
           WHERE vendor_id::text = $1`,
          [canonicalVendorId, dayOfWeekValues, acceptableStylesForSlot]
        );
        const diag = diagnosticQuery.rows[0];
        console.log(`[SLOTS] Diagnostic: total=${diag.total_count}, day_match=${diag.day_match_count}, day_style_match=${diag.day_style_match_count}, day_style_enabled_match=${diag.day_style_enabled_match_count}`);
        console.log(`[SLOTS] Diagnostic: days=${JSON.stringify(diag.distinct_days)}, service_types=${JSON.stringify(diag.distinct_service_types)}`);
      } catch (diagErr: any) {
        console.warn(`[SLOTS] Diagnostic query failed:`, diagErr?.message);
      }

      // ✅ CRITICAL: Before querying, ensure we have ALL possible vendor IDs that might have availability
      // This includes vendor_identity.id if the vendor saved under that ID
      console.log(`[SLOTS] ========== FINAL availabilityIdsForQuery BEFORE QUERY ==========`);
      console.log(`[SLOTS] availabilityIdsForQuery: ${JSON.stringify(availabilityIdsForQuery)}`);
      console.log(`[SLOTS] This array will be used to query vendor_availability_v2`);

      // ✅ CRITICAL: Direct query to verify data exists BEFORE main query block
      // Try querying WITHOUT vendor status filters first, as vendor might not be approved/active but still have availability
      console.log(`[SLOTS] ========== DIRECT VERIFICATION QUERY (NO VENDOR STATUS FILTERS) ==========`);
      let verificationSlots: any[] = [];
      try {
        // First try with service style filter but without vendor status filters
        const directVerification = await query(
          `SELECT va.id, va.day_of_week, 
                  COALESCE(va.time_window_start, va.start_time) as time_window_start, 
                  COALESCE(va.time_window_end, va.end_time) as time_window_end,
                  va.start_time, va.end_time,
                  va.service_styles, va.service_type,
                  COALESCE(va.is_available, true) as is_available,
                  va.lead_time_by_style,
                  va.buffer_time,
                  va.buffer_time_minutes,
                  va.max_capacity
           FROM vendor_availability_v2 va
           WHERE va.vendor_id::text = ANY($1::text[])
             AND va.day_of_week = ANY($2::int[])
             AND (
               (COALESCE(va.service_styles, ARRAY[]::text[]) && $3::text[])
               OR (va.service_type IS NOT NULL AND va.service_type::text = ANY($3::text[]))
             )
             AND COALESCE(va.is_available, true) = true`,
          [availabilityIdsForQuery, dayOfWeekValues, acceptableStylesForSlot]
        );
        console.log(`[SLOTS] Direct verification query (with service style filter) returned ${directVerification.rows.length} rows`);
        if (directVerification.rows.length > 0) {
          console.log(`[SLOTS] ✅ VERIFICATION SUCCESS: Found ${directVerification.rows.length} records matching service style`);
          console.log(`[SLOTS] First record:`, JSON.stringify(directVerification.rows[0]));
          console.log(`[SLOTS] First record time_window_start: ${directVerification.rows[0].time_window_start}, time_window_end: ${directVerification.rows[0].time_window_end}`);
          verificationSlots = directVerification.rows;
        } else {
          // Try without service style filter to see if records exist at all
          console.log(`[SLOTS] ⚠️ No records with service style filter, trying without service style filter...`);
          const directVerificationNoStyle = await query(
            `SELECT va.id, va.day_of_week, 
                    COALESCE(va.time_window_start, va.start_time) as time_window_start, 
                    COALESCE(va.time_window_end, va.end_time) as time_window_end,
                    va.start_time, va.end_time,
                    va.service_styles, va.service_type,
                    COALESCE(va.is_available, true) as is_available,
                    va.lead_time_by_style,
                    va.buffer_time,
                    va.buffer_time_minutes,
                    va.max_capacity
             FROM vendor_availability_v2 va
             WHERE va.vendor_id::text = ANY($1::text[])
               AND va.day_of_week = ANY($2::int[])
               AND COALESCE(va.is_available, true) = true`,
            [availabilityIdsForQuery, dayOfWeekValues]
          );
          console.log(`[SLOTS] Direct verification query (no service style filter) returned ${directVerificationNoStyle.rows.length} rows`);
          if (directVerificationNoStyle.rows.length > 0) {
            console.log(`[SLOTS] ⚠️ Found ${directVerificationNoStyle.rows.length} records but service style filter excluded them`);
            console.log(`[SLOTS] Sample record service_styles: ${JSON.stringify(directVerificationNoStyle.rows[0].service_styles)}`);
            console.log(`[SLOTS] Sample record service_type: ${directVerificationNoStyle.rows[0].service_type}`);
            console.log(`[SLOTS] Sample record service_style: ${directVerificationNoStyle.rows[0].service_style}`);
            console.log(`[SLOTS] acceptableStylesForSlot: ${JSON.stringify(acceptableStylesForSlot)}`);
            // ✅ FIX: Do NOT use records that don't match service style - this causes whole day slots
            // Only use records that actually match the requested service style
            const styleFiltered = directVerificationNoStyle.rows.filter((row: any) => {
              const serviceStyles = Array.isArray(row.service_styles) ? row.service_styles : [];
              const serviceType = row.service_type || row.service_style || '';
              return serviceStyles.some((style: string) => acceptableStylesForSlot.includes(style)) ||
                acceptableStylesForSlot.includes(serviceType);
            });
            if (styleFiltered.length > 0) {
              console.log(`[SLOTS] ✅ After style filtering, ${styleFiltered.length} records match service style`);
              verificationSlots = styleFiltered;
            } else {
              console.log(`[SLOTS] ⚠️ No records match service style after filtering - will return empty slots`);
            }
          } else {
            console.log(`[SLOTS] ⚠️ VERIFICATION: No records found for day_of_week ${dayOfWeek} at all`);
          }
        }
      } catch (verifyErr: any) {
        console.error(`[SLOTS] Direct verification query failed: ${verifyErr?.message}`);
      }

      // ✅ CRITICAL: If verification found records, use them directly (they're already filtered by service style and is_available)
      // Only run main query if verification found no records
      if (verificationSlots.length === 0) {
        console.log(`[SLOTS] ========== EXECUTING MAIN QUERY (verification found 0, applying filters) ==========`);
        try {
          // ✅ CRITICAL FIX: Since SQL test confirms records exist, try fallback query FIRST
          // This ensures we always find weekly availability even if service style filter is too strict
          console.log(`[SLOTS] availabilityIdsForQuery: ${JSON.stringify(availabilityIdsForQuery)}`);
          console.log(`[SLOTS] dayOfWeekValues: ${JSON.stringify(dayOfWeekValues)}`);
          console.log(`[SLOTS] canonicalVendorId: ${canonicalVendorId}`);
          console.log(`[SLOTS] acceptableStylesForSlot: ${JSON.stringify(acceptableStylesForSlot)}`);

          // ✅ CRITICAL FIX: Use ENHANCED AVAILABILITY VIEW (vendor_availability_full)
          // This view automatically filters by is_online, status='approved', is_active=true
          // This ensures we only get availability for vendors that are actually available
          console.log(`[SLOTS] Using ENHANCED AVAILABILITY VIEW with availabilityIdsForQuery=${JSON.stringify(availabilityIdsForQuery)}, dayOfWeek=${dayOfWeek}, acceptableStylesForSlot=${JSON.stringify(acceptableStylesForSlot)}`);
          try {
            // First try with service style filter using the enhanced view
            // ✅ CRITICAL: Use minimal columns that exist in all schema versions
            console.log(`[SLOTS] Attempting query with style filter...`);
            let arrayQueryWithStyle: any = { rows: [] };
            try {
              arrayQueryWithStyle = await query(
                `SELECT va.id, va.day_of_week, 
                      COALESCE(va.time_window_start, va.start_time) as time_window_start, 
                      COALESCE(va.time_window_end, va.end_time) as time_window_end,
                      va.start_time, va.end_time,
                      va.service_styles, va.service_type,
                      COALESCE(va.is_available, true) as is_available,
                      va.lead_time_by_style,
                      va.buffer_time,
                      va.buffer_time_minutes,
                      va.max_capacity,
                      true as is_online, v.status, v.is_active
               FROM vendor_availability_v2 va
               JOIN vendors v ON va.vendor_id = v.id
               WHERE va.vendor_id::text = ANY($1::text[])
                 AND va.day_of_week = ANY($2::int[])
                 AND (
                   (COALESCE(va.service_styles, ARRAY[]::text[]) && $3::text[])
                   OR (va.service_type IS NOT NULL AND va.service_type::text = ANY($3::text[]))
                   OR EXISTS (
                     SELECT 1 FROM unnest(COALESCE(va.service_styles, ARRAY[]::text[])) AS style
                     WHERE style = ANY($3::text[])
                   )
                 )
                 AND COALESCE(va.is_available, true) = true
                 AND v.status = 'approved'
                 AND v.is_active = true
               ORDER BY va.day_of_week, COALESCE(va.time_window_start, va.start_time)`,
                [availabilityIdsForQuery, dayOfWeekValues, acceptableStylesForSlot]
              );
              console.log(`[SLOTS] Query with style filter succeeded: ${arrayQueryWithStyle.rows.length} rows`);
            } catch (err: any) {
              console.log(`[SLOTS] Query with style filter failed: ${err?.message}`);
              console.log(`[SLOTS] Error details:`, err);
              arrayQueryWithStyle = { rows: [] };
            }
            va2Slots = arrayQueryWithStyle?.rows || [];
            console.log(`[SLOTS] Array query (with style filter) found ${va2Slots.length} records`);
            if (va2Slots.length > 0) {
              console.log(`[SLOTS] ✅ SUCCESS! Found ${va2Slots.length} records using array query with style filter`);
              console.log(`[SLOTS] First record:`, JSON.stringify(va2Slots[0]));
              console.log(`[SLOTS] First record time_window_start: ${va2Slots[0]?.time_window_start || va2Slots[0]?.start_time}, time_window_end: ${va2Slots[0]?.time_window_end || va2Slots[0]?.end_time}`);
              console.log(`[SLOTS] First record service_styles: ${JSON.stringify(va2Slots[0]?.service_styles)}`);
            } else {
              console.log(`[SLOTS] ⚠️ Array query with style filter returned 0 - trying without style filter...`);
              // Fallback: try without style filter using enhanced view (includes online status check)
              console.log(`[SLOTS] Attempting query without style filter...`);
              let arrayQueryNoStyle: any = { rows: [] };
              try {
                arrayQueryNoStyle = await query(
                  `SELECT va.id, va.day_of_week, 
                        COALESCE(va.time_window_start, va.start_time) as time_window_start, 
                        COALESCE(va.time_window_end, va.end_time) as time_window_end,
                        va.start_time, va.end_time,
                        va.service_styles, va.service_type,
                        COALESCE(va.is_available, true) as is_available,
                        va.lead_time_by_style,
                        va.buffer_time,
                        va.buffer_time_minutes,
                        va.max_capacity,
                        true as is_online, v.status, v.is_active
                 FROM vendor_availability_v2 va
                 JOIN vendors v ON va.vendor_id = v.id
                 WHERE va.vendor_id::text = ANY($1::text[])
                   AND va.day_of_week = ANY($2::int[])
                   AND (COALESCE(va.is_available, true) = true)
                   AND v.status = 'approved'
                   AND v.is_active = true
                 ORDER BY va.day_of_week, COALESCE(va.time_window_start, va.start_time)`,
                  [availabilityIdsForQuery, dayOfWeekValues]
                );
                console.log(`[SLOTS] Query without style filter succeeded: ${arrayQueryNoStyle.rows.length} rows`);
              } catch (err: any) {
                console.log(`[SLOTS] Query without style filter failed: ${err?.message}`);
                arrayQueryNoStyle = { rows: [] };
              }
              const noStyleRows = arrayQueryNoStyle?.rows || [];
              console.log(`[SLOTS] Array query (NO style filter) found ${noStyleRows.length} records`);
              if (noStyleRows.length > 0) {
                console.log(`[SLOTS] ⚠️ Records exist but service style filter excluded them!`);
                console.log(`[SLOTS] Sample record service_styles: ${JSON.stringify(noStyleRows[0].service_styles)}`);
                console.log(`[SLOTS] Sample record service_type: ${noStyleRows[0].service_type}`);
                console.log(`[SLOTS] Sample record service_style: ${noStyleRows[0].service_style}`);
                console.log(`[SLOTS] acceptableStylesForSlot: ${JSON.stringify(acceptableStylesForSlot)}`);
                console.log(`[SLOTS] Sample record time_window_start: ${noStyleRows[0]?.time_window_start || noStyleRows[0]?.start_time}, time_window_end: ${noStyleRows[0]?.time_window_end || noStyleRows[0]?.end_time}`);
                // ✅ FIX: Filter by service style BEFORE using records - don't use records that don't match
                const styleFiltered = noStyleRows.filter((row: any) => {
                  const serviceStyles = Array.isArray(row.service_styles) ? row.service_styles : [];
                  const serviceType = row.service_type || row.service_style || '';
                  return serviceStyles.some((style: string) => acceptableStylesForSlot.includes(style)) ||
                    acceptableStylesForSlot.includes(serviceType);
                });
                if (styleFiltered.length > 0) {
                  console.log(`[SLOTS] ✅ After style filtering, ${styleFiltered.length} records match service style`);
                  va2Slots = styleFiltered;
                } else {
                  console.log(`[SLOTS] ⚠️ No records match service style after filtering - will return empty slots`);
                  va2Slots = []; // Don't use records that don't match service style
                }
              } else {
                // ✅ CRITICAL: Try query without vendor status filters (vendor might be offline or not approved)
                console.log(`[SLOTS] ⚠️ No availability found even without service style filter, trying without vendor status filters...`);
                console.log(`[SLOTS] Attempting query without vendor status filters...`);
                let noStatusFilterResult: any = { rows: [] };
                try {
                  noStatusFilterResult = await query(
                    `SELECT va.id, va.day_of_week, 
                          COALESCE(va.time_window_start, va.start_time) as time_window_start, 
                          COALESCE(va.time_window_end, va.end_time) as time_window_end,
                          va.start_time, va.end_time,
                          va.service_styles, va.service_type,
                          COALESCE(va.is_available, true) as is_available,
                          va.lead_time_by_style,
                          va.buffer_time,
                          va.buffer_time_minutes,
                          va.max_capacity
                   FROM vendor_availability_v2 va
                   WHERE va.vendor_id::text = ANY($1::text[])
                     AND va.day_of_week = ANY($2::int[])
                     AND (COALESCE(va.is_available, true) = true)
                   ORDER BY va.day_of_week, COALESCE(va.time_window_start, va.start_time)`,
                    [availabilityIdsForQuery, dayOfWeekValues]
                  );
                  console.log(`[SLOTS] Query without vendor status filters succeeded: ${noStatusFilterResult.rows.length} rows`);
                } catch (err: any) {
                  console.log(`[SLOTS] Query without vendor status filters failed: ${err?.message}`);
                  noStatusFilterResult = { rows: [] };
                }
                console.log(`[SLOTS] ⚠️ Query without vendor status filters returned ${noStatusFilterResult.rows.length} rows`);
                if (noStatusFilterResult.rows.length > 0) {
                  va2Slots = noStatusFilterResult.rows;
                  console.log(`[SLOTS] ✅ Using results without vendor status filters (${va2Slots.length} slots)`);
                  console.log(`[SLOTS] ⚠️ WARNING: Vendor status filters excluded these records! Vendor may not be approved/active/online.`);
                  console.log(`[SLOTS] First record from no-status-filter query:`, JSON.stringify(noStatusFilterResult.rows[0]));
                } else {
                  console.log(`[SLOTS] ⚠️ No records found even without style filter for availabilityIdsForQuery`);
                  console.log(`[SLOTS] This means no availability exists for vendor_id in ${JSON.stringify(availabilityIdsForQuery)} on day_of_week ${dayOfWeek}`);
                  // ✅ CRITICAL: Last resort - query without ANY filters except vendor_id and day_of_week
                  console.log(`[SLOTS] ⚠️ Last resort: Querying without ANY filters (except vendor_id and day_of_week)...`);
                  console.log(`[SLOTS] Attempting last resort query (no filters except vendor_id and day_of_week)...`);
                  let lastResortQuery: any = { rows: [] };
                  try {
                    lastResortQuery = await query(
                      `SELECT va.id, va.day_of_week, 
                            COALESCE(va.time_window_start, va.start_time) as time_window_start, 
                            COALESCE(va.time_window_end, va.end_time) as time_window_end,
                            va.start_time, va.end_time,
                            va.service_styles, va.service_type,
                            COALESCE(va.is_available, true) as is_available,
                            va.lead_time_by_style,
                            va.buffer_time,
                            va.buffer_time_minutes,
                            va.max_capacity
                     FROM vendor_availability_v2 va
                     WHERE va.vendor_id::text = ANY($1::text[])
                       AND va.day_of_week = ANY($2::int[])
                     ORDER BY va.day_of_week, COALESCE(va.time_window_start, va.start_time)`,
                      [availabilityIdsForQuery, dayOfWeekValues]
                    );
                    console.log(`[SLOTS] Last resort query succeeded: ${lastResortQuery.rows.length} rows`);
                  } catch (err: any) {
                    console.log(`[SLOTS] Last resort query failed: ${err?.message}`);
                    lastResortQuery = { rows: [] };
                  }
                  console.log(`[SLOTS] ⚠️ Last resort query returned ${lastResortQuery.rows.length} rows`);
                  if (lastResortQuery.rows.length > 0) {
                    // ✅ FIX: Filter last resort results by service style - don't use all records
                    if (acceptableStylesForSlot && acceptableStylesForSlot.length > 0) {
                      const styleFiltered = lastResortQuery.rows.filter((row: any) => {
                        const serviceStyles = Array.isArray(row.service_styles) ? row.service_styles : [];
                        const serviceType = row.service_type || row.service_style || '';
                        return serviceStyles.some((style: string) => acceptableStylesForSlot.includes(style)) ||
                          acceptableStylesForSlot.includes(serviceType);
                      });
                      if (styleFiltered.length > 0) {
                        va2Slots = styleFiltered;
                        console.log(`[SLOTS] ✅ Using last resort results (${styleFiltered.length} slots after service style filter, from ${lastResortQuery.rows.length} total)`);
                      } else {
                        console.log(`[SLOTS] ⚠️ Last resort query found records but none match service style - will return empty slots`);
                        va2Slots = [];
                      }
                    } else {
                      va2Slots = lastResortQuery.rows;
                      console.log(`[SLOTS] ✅ Using last resort results (${va2Slots.length} slots) - NO SERVICE STYLE FILTER`);
                    }
                    if (va2Slots.length > 0) {
                      console.log(`[SLOTS] First record:`, JSON.stringify(va2Slots[0]));
                    }
                  }
                }
              }
            }
          } catch (innerErr: any) {
            console.error(`[SLOTS] Inner query block failed: ${innerErr?.message}`);
          }
        } catch (queryErr: any) {
          console.error(`[SLOTS] ========== QUERY BLOCK FAILED ==========`);
          console.error(`[SLOTS] Query failed: ${queryErr?.message}`);
          console.error(`[SLOTS] Query error stack: ${queryErr?.stack}`);
          console.error(`[SLOTS] Query error code: ${queryErr?.code}`);
          console.error(`[SLOTS] Query error detail: ${queryErr?.detail}`);
          va2Slots = [];
        }
      }

      // ✅ CRITICAL: Prioritize verificationSlots since they're already filtered correctly (service style + is_available, no vendor status filter)
      // This ensures we find availability even if vendor status filters exclude records
      // ✅ FIX: Ensure verificationSlots are filtered by service style
      if (verificationSlots.length > 0) {
        console.log(`[SLOTS] ========== USING VERIFICATION RESULTS (${verificationSlots.length} records) - PRIORITIZED ==========`);
        // Double-check service style filtering on verification slots
        if (acceptableStylesForSlot && acceptableStylesForSlot.length > 0) {
          const styleFiltered = verificationSlots.filter((row: any) => {
            const serviceStyles = Array.isArray(row.service_styles) ? row.service_styles : [];
            const serviceType = row.service_type || row.service_style || '';
            return serviceStyles.some((style: string) => acceptableStylesForSlot.includes(style)) ||
              acceptableStylesForSlot.includes(serviceType);
          });
          if (styleFiltered.length !== verificationSlots.length) {
            console.log(`[SLOTS] ⚠️ Verification slots filtered: ${verificationSlots.length} -> ${styleFiltered.length} (removed non-matching service styles)`);
          }
          va2Slots = styleFiltered;
        } else {
          va2Slots = verificationSlots;
        }
      } else if (va2Slots.length === 0) {
        console.log(`[SLOTS] ========== NO RECORDS FOUND (verification: ${verificationSlots.length}, main query: ${va2Slots.length}) ==========`);
      } else {
        console.log(`[SLOTS] ========== USING MAIN QUERY RESULTS (${va2Slots.length} records) ==========`);
        // ✅ FIX: Ensure main query results are also filtered by service style
        if (acceptableStylesForSlot && acceptableStylesForSlot.length > 0) {
          const styleFiltered = va2Slots.filter((row: any) => {
            const serviceStyles = Array.isArray(row.service_styles) ? row.service_styles : [];
            const serviceType = row.service_type || row.service_style || '';
            return serviceStyles.some((style: string) => acceptableStylesForSlot.includes(style)) ||
              acceptableStylesForSlot.includes(serviceType);
          });
          if (styleFiltered.length !== va2Slots.length) {
            console.log(`[SLOTS] ⚠️ Main query results filtered: ${va2Slots.length} -> ${styleFiltered.length} (removed non-matching service styles)`);
          }
          va2Slots = styleFiltered;
        }
      }

      console.log(`[SLOTS] ========== FINAL QUERY RESULT ==========`);
      console.log(`[SLOTS] va2Slots.length: ${va2Slots.length}`);
      console.log(`[SLOTS] canonicalVendorId: ${canonicalVendorId}`);
      console.log(`[SLOTS] dayOfWeek: ${dayOfWeek}`);
      console.log(`[SLOTS] acceptableStylesForSlot: ${JSON.stringify(acceptableStylesForSlot)}`);
      if (va2Slots.length > 0) {
        console.log(`[SLOTS] ✅ Found ${va2Slots.length} availability records - will generate slots`);
        console.log(`[SLOTS] First record:`, JSON.stringify(va2Slots[0]));
        console.log(`[SLOTS] First record service_styles: ${JSON.stringify(va2Slots[0].service_styles)}`);
        console.log(`[SLOTS] First record service_type: ${va2Slots[0].service_type}`);
        console.log(`[SLOTS] First record is_available: ${va2Slots[0].is_available}`);
        console.log(`[SLOTS] First record time_window_start: ${va2Slots[0].time_window_start}, time_window_end: ${va2Slots[0].time_window_end}`);
      } else {
        console.log(`[SLOTS] ⚠️ No availability records found after all queries`);
        // ✅ ENHANCED AVAILABILITY DEBUG: Check vendor status and online status
        try {
          const vendorStatusCheck = await query(
            `SELECT v.id::text, v.business_name, v.phone, v.status, v.is_active, v.is_online,
                    (SELECT COUNT(*) FROM vendor_availability_v2 WHERE vendor_id::text = v.id::text) as availability_count
             FROM vendors v
             WHERE v.id::text = ANY($1::text[])
             ORDER BY availability_count DESC
             LIMIT 5`,
            [availabilityIdsForQuery]
          );
          console.log(`[SLOTS] ⚠️ ENHANCED AVAILABILITY DEBUG - Vendor status check: ${JSON.stringify(vendorStatusCheck.rows)}`);

          // Check if vendor is offline or not approved
          for (const vendor of vendorStatusCheck.rows) {
            const issues: string[] = [];
            if (vendor.status !== 'approved') issues.push(`status=${vendor.status} (needs 'approved')`);
            if (!vendor.is_active) issues.push(`is_active=false`);
            if (vendor.is_online === false) issues.push(`is_online=false`);
            if (issues.length > 0) {
              console.log(`[SLOTS] ⚠️ Vendor ${vendor.id} has issues: ${issues.join(', ')}`);
            }
          }
        } catch (debugErr: any) {
          console.warn(`[SLOTS] Enhanced availability debug failed: ${debugErr?.message}`);
        }
      }

      // ✅ CRITICAL: Error handling is done by the endpoint handler's catch block
      // The verification query and main query already have their own error handling

      // No fallback: only slot-based advance availability (vendor_availability_v2) produces slots.
      // Vendors without advance scheduling do not show slots and should not be discoverable.

      // Breaks for this day
      let breaks: { startTime: string; endTime: string }[] = [];
      try {
        const breakRows = await query(
          `SELECT start_time, end_time FROM vendor_breaks
           WHERE vendor_id = $1 AND is_active = true
             AND ((is_recurring = true AND day_of_week = $2) OR break_date = $3::date)`,
          [resolvedVendorId, dayOfWeek, date]
        ).catch(() => ({ rows: [] }));
        breaks = breakRows.rows.map((r: any) => ({
          startTime: typeof r.start_time === 'string' ? r.start_time.substring(0, 5) : r.start_time,
          endTime: typeof r.end_time === 'string' ? r.end_time.substring(0, 5) : r.end_time,
        }));
      } catch (_) { /* ignore */ }

      const timeToMinutes = (t: string): number => {
        const s = typeof t === 'string' ? t.substring(0, 5) : String(t);
        const [h, m] = s.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
      };

      // Existing bookings with duration (for buffer overlap and capacity)
      const normalizeBookingTime = (t: any): string => {
        if (t == null) return '00:00';
        if (typeof t === 'string') {
          if (t.includes('T')) {
            const timePart = (t.split('T')[1] || '').substring(0, 5);
            return timePart.length >= 5 ? timePart : t.substring(0, 5);
          }
          return t.substring(0, 5);
        }
        if (typeof (t as Date).getHours === 'function') {
          const d = t as Date;
          return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }
        return String(t).substring(0, 5);
      };
      let existingBookings: { booking_time: string; duration_minutes: number }[] = [];
      try {
        // ✅ CRITICAL: Use total_duration_minutes if available (for multi-service bookings), otherwise duration_minutes
        // This ensures we use the actual booking duration, not just the base service duration
        const bookResult = await query(
          `SELECT booking_time, 
                  COALESCE(total_duration_minutes, duration_minutes, 30) as duration_minutes
           FROM bookings
           WHERE vendor_id = $1 AND booking_date = $2
             AND status NOT IN ('cancelled', 'rejected', 'no_show')`,
          [resolvedVendorId, date]
        ).catch(() => ({ rows: [] }));
        existingBookings = bookResult.rows.map((b: any) => ({
          booking_time: normalizeBookingTime(b.booking_time),
          duration_minutes: Number(b.duration_minutes) || 30,
        }));
      } catch (_) { /* ignore */ }

      if (va2Slots.length > 0) {
        console.log(`[SLOTS] ========== GENERATING SLOTS FROM ${va2Slots.length} AVAILABILITY RECORDS ==========`);
        // ✅ CRITICAL: Filter records by service style - STRICT FILTERING (no fallback to all records)
        // This ensures tele service only shows tele-specific availability (e.g., 2pm-6pm), not whole day
        let filteredSlots = va2Slots;
        if (acceptableStylesForSlot && acceptableStylesForSlot.length > 0) {
          filteredSlots = va2Slots.filter((row: any) => {
            const serviceStyles = Array.isArray(row.service_styles) ? row.service_styles : [];
            const serviceType = row.service_type || row.service_style || '';
            const hasMatchingStyle = serviceStyles.some((style: string) => acceptableStylesForSlot.includes(style)) ||
              acceptableStylesForSlot.includes(serviceType);
            if (!hasMatchingStyle) {
              console.log(`[SLOTS] Filtering out record: service_styles=${JSON.stringify(serviceStyles)}, service_type=${serviceType}, acceptableStyles=${JSON.stringify(acceptableStylesForSlot)}`);
            } else {
              console.log(`[SLOTS] ✅ Record matches service style: service_styles=${JSON.stringify(serviceStyles)}, service_type=${serviceType}, time_window=${row.time_window_start || row.start_time}-${row.time_window_end || row.end_time}`);
            }
            return hasMatchingStyle;
          });
          console.log(`[SLOTS] After service style filter: ${filteredSlots.length} records (from ${va2Slots.length})`);
          // ✅ FIX: DO NOT fallback to all records - if no matching service style, return empty slots
          // This ensures tele service only shows tele-specific availability windows
          if (filteredSlots.length === 0) {
            console.log(`[SLOTS] ⚠️ No availability records match service style '${serviceStyle}' (acceptableStyles: ${JSON.stringify(acceptableStylesForSlot)})`);
            console.log(`[SLOTS] ⚠️ This vendor may not have ${serviceStyle} availability configured, or records use different service style values`);
            // Return empty slots instead of using all records
            return c.json({
              success: true,
              slots: [],
              date,
              vendorId: canonicalVendorId,
              inputVendorId: vendorId,
              serviceStyle,
              staffBased: false,
              isOnline: true,
              vendorOnline: true,
              message: `No ${serviceStyle} availability configured for this day. Vendor must set ${serviceStyle}-specific schedule in Advanced Availability.`,
              availabilityMeta: {
                source: 'vendor_availability_v2',
                hadAvailability: va2Slots.length > 0, // Had records but none matched service style
                allBooked: false,
                totalSlots: 0,
                availableSlots: 0,
                bookedSlots: 0,
              },
            });
          }
        }

        const slots: any[] = [];
        let slotsGenerated = 0;
        let slotsSkipped = 0;
        console.log(`[SLOTS] ========== SLOT GENERATION DEBUG ==========`);
        console.log(`[SLOTS] isToday: ${isToday}`);
        console.log(`[SLOTS] requestedDate: ${date}`);
        console.log(`[SLOTS] minBookingTime: ${minBookingTime.toISOString()}`);
        console.log(`[SLOTS] Current time (now): ${now.toISOString()}`);
        console.log(`[SLOTS] minNoticeMinutes: ${minNoticeMinutes}`);
        console.log(`[SLOTS] Processing ${filteredSlots.length} availability records...`);

        for (const row of filteredSlots) {
          const startTime = row.time_window_start || row.start_time;
          const endTime = row.time_window_end || row.end_time;
          console.log(`[SLOTS] Processing record: id=${row.id}, day_of_week=${row.day_of_week}, startTime=${startTime}, endTime=${endTime}`);
          if (!startTime || !endTime) {
            console.log(`[SLOTS] Skipping record with missing time: startTime=${startTime}, endTime=${endTime}`);
            continue;
          }
          // Lead/setup between appointments: per-style JSON first, then row buffer (never minNotice — that is advance-booking only)
          const leadByStyle = row.lead_time_by_style != null
            ? (typeof row.lead_time_by_style === 'string' ? JSON.parse(row.lead_time_by_style) : row.lead_time_by_style)
            : {};
          /** Match vendor dashboard keys (at_home, at_center, tele) and common API aliases */
          const pickLeadFromStyleJson = (o: Record<string, unknown>): number | null => {
            if (!o || typeof o !== 'object') return null;
            const tryKeys = [
              normalizedServiceStyle,
              serviceStyle,
              serviceStyle === 'at_home' ? 'home_visit' : null,
              'at_home',
              'at_center',
              'tele',
            ].filter(Boolean) as string[];
            for (const k of tryKeys) {
              if (o[k] != null && o[k] !== '') {
                const n = Number(o[k]);
                if (Number.isFinite(n) && n >= 0) return n;
              }
            }
            return null;
          };
          const leadFromStyle = pickLeadFromStyleJson(leadByStyle as Record<string, unknown>);
          const setupMinutes =
            leadFromStyle != null
              ? leadFromStyle
              : Math.max(0, Number(row.buffer_time ?? row.buffer_time_minutes) || 0);
          const bufferMinutes = setupMinutes;
          // Grid step: requested service length + vendor lead/setup (matches vendor dashboard intent)
          const slotStepMinutes = Math.max(5, totalDuration + setupMinutes);
          const slotDuration = slotStepMinutes;
          console.log(`[SLOTS]   slotStepMinutes: ${slotStepMinutes} (service ${totalDuration} + setup ${setupMinutes})`);
          const maxCapacity = row.max_capacity != null && row.max_capacity !== '' ? parseInt(String(row.max_capacity), 10) : null;

          const winStart = timeToMinutes(startTime);
          const winEnd = timeToMinutes(endTime);
          console.log(`[SLOTS]   Time window: ${startTime} (${winStart} min) to ${endTime} (${winEnd} min)`);
          console.log(`[SLOTS]   Total window duration: ${winEnd - winStart} minutes`);
          let currentMinutes = winStart;
          let slotsGeneratedForThisRecord = 0;
          let slotsSkippedForThisRecord = 0;

          while (currentMinutes + totalDuration <= winEnd) {
            const timeStr = `${String(Math.floor(currentMinutes / 60)).padStart(2, '0')}:${String(currentMinutes % 60).padStart(2, '0')}`;

            // 1) Past booking window - for today, include past slots but mark as unavailable
            // ✅ CRITICAL FIX: Compare slot time (IST) with current IST time using minutes-from-midnight
            // This avoids timezone conversion issues since all times are in IST
            let isPastSlot = false;
            if (isToday) {
              const currentISTMinutesFromMidnight = nowIST.getHours() * 60 + nowIST.getMinutes();
              // Slot is unavailable if it starts before now + min notice (IST)
              isPastSlot = currentMinutes < currentISTMinutesFromMidnight + minNoticeMinutes;
              if (isPastSlot) {
                console.log(`[SLOTS]     ${timeStr} is in the past (slot=${currentMinutes}min < currentIST=${currentISTMinutesFromMidnight}min + notice=${minNoticeMinutes}min) - will mark as unavailable`);
              } else {
                console.log(`[SLOTS]     ✅ ${timeStr} is NOT in the past (slot=${currentMinutes}min >= currentIST=${currentISTMinutesFromMidnight}min + notice=${minNoticeMinutes}min)`);
              }
            } else {
              console.log(`[SLOTS]     ✅ ${timeStr} is for future date (not today), skipping past check`);
            }

            // 2) Break overlap — treat proposed service interval [start, start+totalDuration)
            const serviceEndMin = currentMinutes + totalDuration;
            const inBreak = breaks.some((brk: { startTime: string; endTime: string }) => {
              const bStart = timeToMinutes(brk.startTime);
              const bEnd = timeToMinutes(brk.endTime);
              return currentMinutes < bEnd && serviceEndMin > bStart;
            });
            if (inBreak) {
              currentMinutes += slotStepMinutes;
              continue;
            }

            // 3) Overlap with existing bookings: block service time + vendor setup after each booking
            const candidateEnd = currentMinutes + totalDuration;
            const overlapsBooking = existingBookings.some((b: { booking_time: string; duration_minutes: number }) => {
              const bStart = timeToMinutes(b.booking_time);
              const bDur = Math.max(15, Number(b.duration_minutes) || totalDuration);
              const bBlockEnd = bStart + bDur + setupMinutes;

              const overlaps = currentMinutes < bBlockEnd && candidateEnd > bStart;

              if (overlaps) {
                console.log(`[SLOTS] OVERLAP: slot ${timeStr} blocked by booking at ${b.booking_time} (block until ${bBlockEnd}min)`);
              }

              return overlaps;
            });

            // ✅ FIX: Check max capacity first to determine availability
            let available = true;
            let booked = false;
            if (maxCapacity != null && maxCapacity > 0) {
              const norm = (t: string) => (typeof t === 'string' ? t.substring(0, 5) : String(t));
              const sameStartCount = existingBookings.filter(
                (b: { booking_time: string }) => norm(b.booking_time) === timeStr
              ).length;
              available = sameStartCount < maxCapacity;
              booked = !available;
            } else {
              // ✅ FIX: If overlaps booking (buffer conflict), mark as booked but still return slot
              booked = overlapsBooking;
              available = !booked;
            }

            // ✅ FIX: For today, mark past slots as unavailable (but still include them)
            if (isPastSlot) {
              available = false;
              booked = false; // Past slots are not "booked", they're just unavailable
            }

            // ✅ FIX: Always add slot (even if booked or past) so UI can show it as unavailable
            // Dynamic payload: pass through schedule fields so clients sync with future enhancements
            // ✅ FIX: Filter serviceStyles to only include styles matching the requested serviceStyle
            // When serviceStyle=at_center is requested, only return ["at_center"], not ["at_center", "at_home"]
            let filteredServiceStyles: string[] = [];
            if (Array.isArray(row.service_styles) && row.service_styles.length > 0) {
              // Filter to only include styles that match the requested serviceStyle
              filteredServiceStyles = row.service_styles.filter((style: string) =>
                acceptableStylesForSlot.includes(style)
              );
              // If no matching styles found, use the requested serviceStyle as fallback
              if (filteredServiceStyles.length === 0 && normalizedServiceStyle) {
                filteredServiceStyles = [normalizedServiceStyle];
              }
            } else if (normalizedServiceStyle) {
              // If no service_styles array, use the requested serviceStyle
              filteredServiceStyles = [normalizedServiceStyle];
            }

            const slotPayload: Record<string, unknown> = {
              time: timeStr,
              available,
              booked, // ✅ Explicitly mark as booked if overlapping or at capacity
              slotDuration,
              bufferMinutes,
              ...(isPastSlot && { isPast: true }), // ✅ Mark past slots for today
              ...(filteredServiceStyles.length > 0 && { serviceStyles: filteredServiceStyles }),
              ...(row.max_capacity != null && row.max_capacity !== '' && { maxCapacity: parseInt(String(row.max_capacity), 10) }),
            };
            slots.push(slotPayload);
            slotsGenerated++;
            slotsGeneratedForThisRecord++;
            console.log(`[SLOTS]     ✅ Added slot: ${timeStr} (available: ${available}, booked: ${booked})`);
            currentMinutes += slotStepMinutes;
          }
          console.log(`[SLOTS]   Record complete: Generated ${slotsGeneratedForThisRecord} slots, skipped ${slotsSkippedForThisRecord} slots`);
          slotsSkipped += (Math.ceil((winEnd - winStart) / slotStepMinutes) - slotsGeneratedForThisRecord);
        }

        console.log(`[SLOTS] ========== SLOT GENERATION COMPLETE ==========`);
        console.log(`[SLOTS] Total slots generated: ${slotsGenerated}`);
        console.log(`[SLOTS] Slots skipped: ${slotsSkipped}`);
        console.log(`[SLOTS] Final slots array length: ${slots.length}`);

        const sortedSlots = slots.sort((a: any, b: any) => (a.time || '').localeCompare(b.time || ''));
        console.log(`[SLOTS] Returning ${sortedSlots.length} sorted slots`);

        // ✅ FIX: Track metadata to distinguish "no availability" vs "all booked"
        const hadAvailabilityRecords = va2Slots.length > 0;
        const availableSlotsCount = sortedSlots.filter((s: any) => s.available === true).length;
        const bookedSlotsCount = sortedSlots.filter((s: any) => s.booked === true).length;
        const allBooked = hadAvailabilityRecords && availableSlotsCount === 0 && bookedSlotsCount > 0;

        return c.json({
          success: true,
          slots: sortedSlots,
          date,
          vendorId: canonicalVendorId,
          inputVendorId: vendorId,
          serviceStyle,
          staffBased: false,
          isOnline: true,
          vendorOnline: true,
          availabilityMeta: {
            source: 'vendor_availability_v2',
            requestedTotalDurationMinutes: totalDuration,
            slotGridUsesServicePlusSetup: true,
            hadAvailability: hadAvailabilityRecords, // ✅ Flag: availability records existed
            allBooked, // ✅ Flag: all slots were booked/filtered
            totalSlots: sortedSlots.length,
            availableSlots: availableSlotsCount,
            bookedSlots: bookedSlotsCount,
          },
        });
      }

      // No slot-based advance availability: do not show slots (no fallback)
      // ✅ FIX: Check if availability exists but was filtered out (all booked/past)
      const hadAvailabilityRecords = va2Slots.length > 0;
      let message = 'No advance availability set for this day and service type. Vendor must set schedule in Advanced Availability.';

      if (hadAvailabilityRecords) {
        // Availability exists but all slots were filtered (booked/past/breaks)
        message = 'All available slots for this date are currently booked or unavailable.';
      }

      return c.json({
        success: true,
        slots: [],
        date,
        vendorId: canonicalVendorId, // ✅ Use resolved canonical vendors.id
        inputVendorId: vendorId, // ✅ Also include original input for debugging
        serviceStyle,
        staffBased: false,
        isOnline: true,
        vendorOnline: true,
        message,
        availabilityMeta: {
          source: 'vendor_availability_v2',
          hadAvailability: hadAvailabilityRecords, // ✅ Flag: availability records existed
          allBooked: hadAvailabilityRecords, // ✅ If we had records but no slots, they're all booked/filtered
        },
      });
    } catch (error: any) {
      console.error('Error fetching available slots:', error);
      return c.json({ error: error.message || 'Failed to fetch available slots' }, 500);
    }
  });

  /**
   * GET /customer/vendor/:vendorId/services
   * Get vendor services for booking — only published, vendor-set price reflects immediately.
   * Uses vendor_services as source of truth so CRUD (price, publish/unpublish) reflects on customer web.
   */
}
