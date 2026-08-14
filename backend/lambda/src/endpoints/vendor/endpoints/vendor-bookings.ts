/**
 * ============================================================================
 * VENDOR BOOKINGS ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles vendor booking management:
 * - Get vendor bookings with filters
 * - Update booking status
 * - Booking actions (confirm, cancel, complete)
 * 
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { select, update, query, insert } from '../../../database/rds-connection';
import { logBookingStatusChange } from '../../../utils/audit-log';
import { resolveVendorId } from '../../../utils/vendor-resolve';
import {
  normalizeDbRow,
  normalizeDbRows,
  extractEntityIds,
  parseSelectedServices,
  resolveVendorVisibleBookingAmount,
} from '../../../utils/entity-extractor';
import { loadBookingServiceSnapshot, snapshotToNestedService } from '../../../utils/booking-service-snapshot';
import {
  applyVendorBookingDisplayFields,
} from '../../warmpawz-appointments/shared/vendor-booking-display';
import { isValidUUID } from '../../../types/entities';
import { checkVendorCapability } from '../../../middleware/capability-enforcement';
import { getDiscoveryRules } from '../../../lib/rule-engine';
import { reversePendingPackageSessionEarnings } from '../../../utils/package-session-earnings-reverse';
import type { SqlClient } from '../../../utils/package-session-sync';
import {
  parseVendorCancellationReason,
  vendorCancellationReasonLabel,
  applyRefundAfterProviderCancellation,
} from '../../../lib/services/provider-booking-cancel-refund';
import {
  getTemporaryVendorSuppressionParams,
  shouldHideBookingRowFromVendorUi,
  sqlAndExcludeSuppressedBookingRows,
} from '../../../utils/temporary-vendor-ui-suppression';
import { notifyBookingCancelledByVendor } from '../../../utils/booking-notifications';

// Helper function to format detailed address with all fields
function formatDetailedAddress(addr: any): string {
  const parts: string[] = [];
  
  if (addr.apartment_name) parts.push(addr.apartment_name);
  if (addr.flat_no && addr.house_no) {
    parts.push(`Flat ${addr.flat_no}, House ${addr.house_no}`);
  } else if (addr.flat_no) {
    parts.push(`Flat ${addr.flat_no}`);
  } else if (addr.house_no) {
    parts.push(`House ${addr.house_no}`);
  }
  if (addr.floor) parts.push(`Floor ${addr.floor}`);
  if (addr.street_name) parts.push(addr.street_name);
  if (addr.address_line1) parts.push(addr.address_line1);
  if (addr.address_line2) parts.push(addr.address_line2);
  if (addr.landmark) parts.push(`Near ${addr.landmark}`);
  if (addr.city) parts.push(addr.city);
  if (addr.state) parts.push(addr.state);
  if (addr.pincode) parts.push(addr.pincode);
  
  return parts.filter(Boolean).join(', ');
}

/** ISO week Mon–Sun containing anchorDate (YYYY-MM-DD). Month = calendar month of anchor. */
function formatYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function bookingScheduleRange(
  period: 'today' | 'week' | 'month',
  anchorDate: string
): { startDate: string; endDate: string } {
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(anchorDate) ? anchorDate : formatYmdLocal(new Date());
  if (period === 'today') {
    return { startDate: anchor, endDate: anchor };
  }
  const d = new Date(`${anchor}T12:00:00`);
  if (period === 'week') {
    const day = d.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const mon = new Date(d);
    mon.setDate(d.getDate() + diffToMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { startDate: formatYmdLocal(mon), endDate: formatYmdLocal(sun) };
  }
  const y = d.getFullYear();
  const m = d.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return { startDate: formatYmdLocal(start), endDate: formatYmdLocal(end) };
}

function resolveVendorBookingsDateFilter(queries: {
  date?: string;
  startDate?: string;
  endDate?: string;
  period?: string;
  anchorDate?: string;
}): {
  startDate: string | null;
  endDate: string | null;
  mode: string;
} {
  const date = queries.date?.trim();
  const startDateQ = queries.startDate?.trim();
  const endDateQ = queries.endDate?.trim();
  const period = queries.period?.trim()?.toLowerCase();
  const anchorDate = queries.anchorDate?.trim() || date;

  if (period === 'today' || period === 'week' || period === 'month') {
    const anchor = anchorDate || formatYmdLocal(new Date());
    const range = bookingScheduleRange(period, anchor);
    return { startDate: range.startDate, endDate: range.endDate, mode: period };
  }
  if (date && !startDateQ && !endDateQ) {
    return { startDate: date, endDate: date, mode: 'single' };
  }
  if (startDateQ && endDateQ) {
    return { startDate: startDateQ, endDate: endDateQ, mode: 'range' };
  }
  if (startDateQ) {
    return { startDate: startDateQ, endDate: null, mode: 'startOnly' };
  }
  return { startDate: null, endDate: null, mode: 'none' };
}

function sqlTeleBookingPredicate(alias: string): string {
  return `(
    LOWER(COALESCE(${alias}.service_style, '')) IN ('tele', 'online', 'video_consultation', 'tele_consultation', 'teleconsultation')
    OR LOWER(COALESCE(${alias}.service_type, '')) IN ('tele', 'video_consultation', 'tele_consultation', 'teleconsultation')
    OR LOWER(COALESCE(${alias}.service_style, '')) LIKE '%tele%'
    OR LOWER(COALESCE(${alias}.service_type, '')) LIKE '%tele%'
    OR LOWER(COALESCE(${alias}.service_type, '')) LIKE '%video%'
  )`;
}

function sqlLocationBookingPredicate(alias: string): string {
  return `(
    LOWER(COALESCE(${alias}.service_style, ${alias}.service_type, '')) IN ('at_center', 'at_home', 'at_clinic', 'at_vendor', 'home_visit', 'home_service', 'clinic')
    OR LOWER(COALESCE(${alias}.service_style, '')) LIKE '%home%'
    OR LOWER(COALESCE(${alias}.service_type, '')) LIKE '%home%'
    OR LOWER(COALESCE(${alias}.service_style, '')) LIKE '%center%'
    OR LOWER(COALESCE(${alias}.service_type, '')) LIKE '%clinic%'
  ) AND NOT ${sqlTeleBookingPredicate(alias)}`;
}

function appendBookingViewFilter(view: string | undefined, alias: string): string {
  const v = (view || 'all').toLowerCase();
  if (v === 'consultations') return ` AND ${sqlTeleBookingPredicate(alias)}`;
  if (v === 'locations') return ` AND ${sqlLocationBookingPredicate(alias)}`;
  return '';
}

function parseVendorBookingsPagination(limitRaw: string | undefined, offsetRaw: string | undefined) {
  let limit = parseInt(String(limitRaw ?? '50'), 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 50;
  if (limit > 100) limit = 100;
  let offset = parseInt(String(offsetRaw ?? '0'), 10);
  if (!Number.isFinite(offset) || offset < 0) offset = 0;
  return { limit, offset };
}

function appendBookingDateFilterSql(
  queryText: string,
  params: any[],
  paramIndex: number,
  dateFilter: ReturnType<typeof resolveVendorBookingsDateFilter>
): { queryText: string; params: any[]; paramIndex: number } {
  if (dateFilter.startDate && dateFilter.endDate) {
    queryText += ` AND b.booking_date >= $${paramIndex} AND b.booking_date <= $${paramIndex + 1}`;
    params.push(dateFilter.startDate, dateFilter.endDate);
    return { queryText, params, paramIndex: paramIndex + 2 };
  }
  if (dateFilter.startDate && dateFilter.mode === 'startOnly') {
    queryText += ` AND b.booking_date >= $${paramIndex}`;
    params.push(dateFilter.startDate);
    return { queryText, params, paramIndex: paramIndex + 1 };
  }
  return { queryText, params, paramIndex };
}

export function registerVendorBookingsEndpoints(app: Hono) {
  /**
   * GET /vendor/bookings/:vendorId
   * Get all bookings for a vendor with filters
   * Requires: booking_view or booking_create capability
   */
  app.get("/vendor/bookings/:vendorId", async (c) => {
    try {
      const { vendorId: paramVendorId } = c.req.param();
      const vendorId = await resolveVendorId(paramVendorId);
      const vendorIds = [vendorId];
      if (paramVendorId !== vendorId) vendorIds.push(paramVendorId);

      const hasBookingCapability = await checkVendorCapability(vendorId, 'booking_view') ||
                                   await checkVendorCapability(vendorId, 'booking_create') ||
                                   await checkVendorCapability(paramVendorId, 'bookings') ||
                                   await checkVendorCapability(vendorId, 'bookings');
      if (!hasBookingCapability) {
        return c.json({ error: 'Vendor does not have booking viewing capability' }, 403);
      }
      const date = c.req.query('date');
      const filter = c.req.query('filter') || 'all';
      const startDate = c.req.query('startDate');
      const endDate = c.req.query('endDate');
      const period = c.req.query('period');
      const anchorDate = c.req.query('anchorDate');
      const view = c.req.query('view');
      const { limit, offset } = parseVendorBookingsPagination(
        c.req.query('limit'),
        c.req.query('offset')
      );

      const dateFilter = resolveVendorBookingsDateFilter({
        date,
        startDate,
        endDate,
        period,
        anchorDate,
      });

      console.log(`📋 [VENDOR-BOOKINGS] Fetching bookings for vendor: ${paramVendorId} (resolved: ${vendorId})`);
      console.log(`   Filters: date=${date}, period=${period}, anchorDate=${anchorDate}, range=${dateFilter.startDate}..${dateFilter.endDate}, status=${filter}, view=${view}, limit=${limit}, offset=${offset}`);

      // ✅ FIX: Get center_id for the querying vendor to include bookings from same center
      let centerId: string | null = null;
      try {
        const vendorInfo = await query(
          `SELECT center_id FROM vendors WHERE id = $1 OR id = $2 LIMIT 1`,
          vendorIds
        );
        if (vendorInfo.rows.length > 0 && vendorInfo.rows[0].center_id) {
          centerId = vendorInfo.rows[0].center_id;
          console.log(`[VENDOR-BOOKINGS] Vendor belongs to center: ${centerId}`);
        }
      } catch (e) {
        console.warn('[VENDOR-BOOKINGS] Could not check center_id:', e);
      }

      // Build query to include bookings from same vendor OR same center
      let queryText: string;
      const params: any[] = [...vendorIds];
      let paramIndex = vendorIds.length + 1;

      if (centerId) {
        // Include bookings from same vendor IDs OR vendors with same center_id
        const vendorIdConditions = vendorIds.map((_, idx) => `b.vendor_id = $${idx + 1}`).join(' OR ');
        queryText = `SELECT b.* FROM bookings b
           LEFT JOIN vendors v ON v.id = b.vendor_id
           WHERE (
             (${vendorIdConditions})
             OR (v.center_id = $${paramIndex} AND v.center_id IS NOT NULL)
           )
           AND b.status != 'pending_payment'
           AND (
             COALESCE(b.total_amount, 0) <= 0
             OR LOWER(COALESCE(b.payment_status, '')) IN ('paid', 'completed', 'partially_refunded', 'refunded', 'partial')
           )`;
        params.push(centerId);
        paramIndex++;
      } else {
        // No center_id, just match vendor IDs
        queryText = vendorIds.length === 1
          ? `SELECT b.* FROM bookings b WHERE b.vendor_id = $1
             AND b.status != 'pending_payment'
             AND (
               COALESCE(b.total_amount, 0) <= 0
               OR LOWER(COALESCE(b.payment_status, '')) IN ('paid', 'completed', 'partially_refunded', 'refunded', 'partial')
             )`
          : `SELECT b.* FROM bookings b WHERE (b.vendor_id = $1 OR b.vendor_id = $2)
             AND b.status != 'pending_payment'
             AND (
               COALESCE(b.total_amount, 0) <= 0
               OR LOWER(COALESCE(b.payment_status, '')) IN ('paid', 'completed', 'partially_refunded', 'refunded', 'partial')
             )`;
      }

      const temporarySuppression = getTemporaryVendorSuppressionParams();
      queryText += sqlAndExcludeSuppressedBookingRows(
        'b',
        temporarySuppression ? paramIndex : undefined,
        temporarySuppression ? paramIndex + 1 : undefined,
      );
      if (temporarySuppression) {
        params.push(temporarySuppression.vendorIds, temporarySuppression.cutoffDateIst);
        paramIndex += 2;
      }

      // Filter by date range (single day, week, month, or explicit start/end)
      const dateApplied = appendBookingDateFilterSql(queryText, params, paramIndex, dateFilter);
      queryText = dateApplied.queryText;
      paramIndex = dateApplied.paramIndex;

      // Filter by status (API param `filter` — not schedule period)
      if (filter && filter !== 'all') {
        queryText += ` AND b.status = $${paramIndex}`;
        params.push(filter);
        paramIndex++;
      }

      // Consultations vs physical locations
      queryText += appendBookingViewFilter(view, 'b');

      const countQueryText = queryText.replace(/^SELECT b\.\* FROM bookings b/i, 'SELECT COUNT(*)::int AS total FROM bookings b');
      const countResult = await query(countQueryText, params).catch(() => ({ rows: [{ total: '0' }] }));
      const total = parseInt(String(countResult.rows[0]?.total ?? '0'), 10) || 0;

      queryText += ' ORDER BY b.booking_date ASC, b.booking_time ASC';
      queryText += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);
      paramIndex += 2;

      const result = await query(queryText, params).catch(() => ({ rows: [] }));

      const chatRules = await getDiscoveryRules('all', 'chat');
      const chatDays = chatRules.chat_available_days_post_appointment ?? 7;

      const packagePurchaseIds = Array.from(
        new Set(
          (result.rows || [])
            .map((b: any) => b.package_purchase_id)
            .filter((id: unknown): id is string => id != null && String(id).trim() !== '')
        )
      );
      let packageByPurchaseId = new Map<string, any>();
      if (packagePurchaseIds.length > 0) {
        try {
          const pkgRows = await query(
            `SELECT id, package_name, total_sessions, remaining_sessions, unlimited_usage
             FROM package_purchases
             WHERE id = ANY($1::uuid[])`,
            [packagePurchaseIds]
          );
          for (const row of pkgRows.rows || []) {
            packageByPurchaseId.set(String(row.id), row);
          }
        } catch (e) {
          console.warn('[VENDOR-BOOKINGS] package_purchases batch lookup failed:', e);
          packageByPurchaseId = new Map();
        }
      }

      // Enrich bookings with customer, service, vendor, and related data (prescriptions, medical records, chat)
      const enrichedBookings = await Promise.all(
        result.rows.map(async (booking: any) => {
          const [customer, service, vendor, prescriptions, medicalRecords, chatMessages] = await Promise.all([
            booking.customer_id
              ? select('customers', { id: booking.customer_id }).catch(() => [])
              : Promise.resolve([]),
            booking.service_id
              ? select('services', { id: booking.service_id }).catch(() => [])
              : Promise.resolve([]),
            // ✅ FIX: Add vendor lookup for chat enabled logic
            booking.vendor_id
              ? select('vendors', { id: booking.vendor_id }).catch(() => [])
              : Promise.resolve([]),
            // Check for prescriptions
            query(
              `SELECT COUNT(*) as count FROM prescriptions 
               WHERE booking_id = $1 AND is_active = true`,
              [booking.id]
            ).catch(() => ({ rows: [{ count: '0' }] })),
            // Check for medical records
            query(
              `SELECT COUNT(*) as count FROM medical_records 
               WHERE booking_id = $1 AND is_active = true`,
              [booking.id]
            ).catch(() => ({ rows: [{ count: '0' }] })),
            // Check for unread chat messages
            query(
              `SELECT COUNT(*) as count FROM chat_messages 
               WHERE booking_id = $1 AND is_read = false`,
              [booking.id]
            ).catch(() => ({ rows: [{ count: '0' }] })),
          ]);

          const prescriptionCount = parseInt(prescriptions.rows[0]?.count || '0', 10);
          const medicalRecordCount = parseInt(medicalRecords.rows[0]?.count || '0', 10);
          const unreadMessageCount = parseInt(chatMessages.rows[0]?.count || '0', 10);

          const serviceSnap = await loadBookingServiceSnapshot(booking.vendor_id, booking.service_id);
          const vendorVisibleAmount = resolveVendorVisibleBookingAmount(booking, { serviceSnap });
          const catalogServiceName =
            serviceSnap?.displayName ||
            serviceSnap?.serviceName ||
            (service.length > 0 ? service[0].name : null) ||
            booking.service_name ||
            'Service';
          const display = applyVendorBookingDisplayFields(booking, {
            catalogServiceName,
            vendorVisibleAmount,
          });
          const ppId = booking.package_purchase_id ? String(booking.package_purchase_id) : '';
          const packagePurchase = ppId ? packageByPurchaseId.get(ppId) : null;
          return {
            ...booking,
            service_name: display.service_name,
            serviceName: display.serviceName,
            total_amount: display.total_amount,
            totalAmount: display.totalAmount,
            price: display.price,
            base_price: display.base_price,
            basePrice: display.basePrice,
            commerce_mode: display.commerce_mode,
            commerceMode: display.commerceMode,
            packagePurchaseId: booking.package_purchase_id || null,
            packageSessionNumber:
              booking.package_session_number != null ? Number(booking.package_session_number) : null,
            packageName: packagePurchase?.package_name || null,
            packageTotalSessions:
              packagePurchase?.total_sessions != null ? Number(packagePurchase.total_sessions) : null,
            packageRemainingSessions:
              packagePurchase?.remaining_sessions != null ? Number(packagePurchase.remaining_sessions) : null,
            packageUnlimitedUsage: Boolean(packagePurchase?.unlimited_usage),
            isPackageSession: Boolean(booking.is_package_session ?? booking.is_package),
            customer: customer.length > 0 ? {
              id: customer[0].id,
              name: customer[0].full_name,
              phone: customer[0].phone,
            } : null,
            service: service.length > 0 ? {
              id: service[0].id,
              name: display.serviceName,
              category: service[0].category,
              price: display.price,
              basePrice: display.basePrice,
            } : null,
            // Rule engine: Chat available for chat_available_days_post_appointment days after completion
            chatEnabled: (() => {
              if (booking.status === 'cancelled') return false;
              if (booking.status === 'completed' && booking.updated_at) {
                const completedDate = new Date(booking.updated_at);
                const daysSinceCompletion = (Date.now() - completedDate.getTime()) / (1000 * 60 * 60 * 24);
                return daysSinceCompletion <= chatDays;
              }
              return true;
            })(),
            hasUnreadMessages: unreadMessageCount > 0,
            unreadMessageCount,
            hasPrescription: prescriptionCount > 0,
            prescriptionCount,
            hasMedicalRecords: medicalRecordCount > 0,
            medicalRecordCount,
            isFollowUp: false, // Can be enhanced with follow_up_date check
            // Track rescheduled bookings: true if booking was rescheduled (has rescheduled_at timestamp)
            // Explicitly check if rescheduled_at exists and is not null/empty
            isRescheduled: Boolean(booking.rescheduled_at),
            rescheduledAt: booking.rescheduled_at || null,
          };
        })
      );

      // Debug: Log first booking to verify isRescheduled is set
      if (enrichedBookings.length > 0) {
        console.log(`[VENDOR-BOOKINGS] First booking rescheduled_at: ${enrichedBookings[0].rescheduled_at}, isRescheduled: ${enrichedBookings[0].isRescheduled}`);
      }

      return c.json({
        success: true,
        bookings: enrichedBookings,
        total,
        limit,
        offset,
        hasMore: offset + enrichedBookings.length < total,
        filters: {
          date,
          startDate: dateFilter.startDate,
          endDate: dateFilter.endDate,
          period: period || dateFilter.mode,
          anchorDate: anchorDate || date,
          status: filter,
          view: view || 'all',
        },
      });
    } catch (error: any) {
      console.error('❌ [VENDOR-BOOKINGS] Error fetching bookings:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/bookings/:bookingId/status
   * Update booking status
   * Requires: booking_create capability
   */
  app.put("/vendor/bookings/:bookingId/status", async (c) => {
    try {
      const { bookingId } = c.req.param();
      
      // Get booking first to get vendorId
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      const booking = bookings[0];
      const vendorId = c.req.header('x-vendor-id') || booking.vendor_id;
      
      // Check capability
      const hasBookingCapability = await checkVendorCapability(vendorId, 'booking_create');
      if (!hasBookingCapability) {
        return c.json({ error: 'Vendor does not have booking management capability' }, 403);
      }
      const { status, notes } = await c.req.json();

      if (!status) {
        return c.json({ error: 'status is required' }, 400);
      }

      const oldStatus = booking.status;

      // Update booking
      const updateData: any = { status };
      if (notes) {
        updateData.notes = notes;
      }

      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      } else if (status === 'cancelled') {
        updateData.cancelled_at = new Date().toISOString();
      }

      const updated = await update('bookings', { id: bookingId }, updateData);

      if (status === 'completed' && oldStatus !== 'completed') {
        const { ensureVendorEarningsForCompletedBooking, syncPackageSessionEarningsAfterBookingComplete } =
          await import('../../../utils/vendor-earnings-on-completion');
        const row = (updated[0] || { ...booking, ...updateData }) as Record<string, unknown>;
        await ensureVendorEarningsForCompletedBooking(row, bookingId, '[VENDOR-STATUS-COMPLETE]');
        await syncPackageSessionEarningsAfterBookingComplete(bookingId, '[VENDOR-STATUS-COMPLETE]');
      }

      // Log status change if status actually changed
      if (oldStatus !== status) {
        await logBookingStatusChange(
          bookingId,
          oldStatus,
          status,
          vendorId,
          'vendor',
          notes || 'Status updated by vendor'
        );

        // Publish notification event
        try {
          const { publishBookingStatusUpdated } = await import('../../../utils/sns-client');
          await publishBookingStatusUpdated({
            bookingId,
            customerId: booking.customer_id,
            vendorId: booking.vendor_id || vendorId,
            oldStatus,
            newStatus: status,
            reason: notes || 'Status updated by vendor',
            eventTimestamp: new Date().toISOString(),
            eventId: randomUUID(),
          });
        } catch (error) {
          console.error('Failed to publish booking status updated event:', error);
        }
      }

      return c.json({
        success: true,
        booking: updated[0],
        message: 'Booking status updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating booking status:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/bookings/:bookingId/confirm
   * Confirm a booking
   */
  app.post("/vendor/bookings/:bookingId/confirm", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const vendorId = c.req.header('x-vendor-id') || c.req.query('vendorId');

      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];
      if (booking.status !== 'pending') {
        return c.json({ error: `Booking cannot be confirmed. Current status: ${booking.status}` }, 400);
      }

      const updated = await update('bookings', { id: bookingId }, { status: 'confirmed' });

      // ✅ AUTO-GENERATE OTP for in-person services when booking is confirmed
      let otpCode: string | null = null;
      try {
        const serviceType = booking.service_type || '';
        const isTele = ['tele', 'online', 'video_consultation', 'tele_consultation'].includes(serviceType);
        
        if (!isTele && !booking.otp_code) {
          otpCode = Math.floor(1000 + Math.random() * 9000).toString();
          const otpExpiry = new Date();
          otpExpiry.setHours(otpExpiry.getHours() + 24);
          
          await query(
            `UPDATE bookings SET otp_code = $1, otp_expires_at = $2, updated_at = NOW() WHERE id = $3`,
            [otpCode, otpExpiry.toISOString(), bookingId]
          );
          console.log(`[CONFIRM-BOOKING] OTP ${otpCode} generated for booking ${bookingId} (service_type: ${serviceType})`);
        } else if (isTele) {
          console.log(`[CONFIRM-BOOKING] Tele service - no OTP needed for booking ${bookingId}`);
        } else {
          otpCode = booking.otp_code;
          console.log(`[CONFIRM-BOOKING] OTP already exists for booking ${bookingId}: ${otpCode}`);
        }
      } catch (otpErr: any) {
        console.warn(`[CONFIRM-BOOKING] Failed to generate OTP:`, otpErr?.message);
      }

      // Log status change
      await logBookingStatusChange(
        bookingId,
        'pending',
        'confirmed',
        vendorId || booking.vendor_id,
        'vendor',
        'Vendor confirmed booking'
      );

      // Publish notification event
      try {
        const { publishBookingStatusUpdated } = await import('../../../utils/sns-client');
        await publishBookingStatusUpdated({
          bookingId,
          customerId: booking.customer_id,
          vendorId: booking.vendor_id || vendorId,
          oldStatus: 'pending',
          newStatus: 'confirmed',
          reason: 'Vendor confirmed booking',
          eventTimestamp: new Date().toISOString(),
          eventId: randomUUID(),
        });
      } catch (error) {
        console.error('Failed to publish booking status updated event:', error);
      }

      return c.json({
        success: true,
        booking: updated[0],
        message: 'Booking confirmed successfully',
        ...(otpCode && { otp: otpCode }),
      });
    } catch (error: any) {
      console.error('Error confirming booking:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/bookings/:bookingId/cancel
   * Cancel a booking
   */
  app.post("/vendor/bookings/:bookingId/cancel", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const vendorId = c.req.header('x-vendor-id') || c.req.query('vendorId');
      const body = await c.req.json().catch(() => ({}));
      const { reason } = body;
      const vendorCancellationReason = parseVendorCancellationReason(
        body.vendorCancellationReason ?? body.vendor_cancellation_reason
      );
      if (!vendorCancellationReason) {
        return c.json(
          {
            error:
              'vendorCancellationReason is required. Use one of: emergency, operational, technical (Finance → Cancellation & Refund policy, provider / Service Provider tiers).',
          },
          400
        );
      }

      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];
      const oldStatus = booking.status;
      if (!['pending', 'confirmed'].includes(oldStatus)) {
        return c.json({ error: `Booking cannot be cancelled. Current status: ${oldStatus}` }, 400);
      }

      const reasonLabel = vendorCancellationReasonLabel(vendorCancellationReason);
      const extraNote = typeof reason === 'string' && reason.trim() ? reason.trim() : '';
      const cancellation_reason = extraNote
        ? `Provider cancelled (${reasonLabel}). ${extraNote}`
        : `Provider cancelled: ${reasonLabel}.`;

      const updated = await update('bookings',
        { id: bookingId },
        {
          status: 'cancelled',
          cancellation_reason,
          cancelled_at: new Date().toISOString(),
          cancelled_by: 'provider',
        }
      );

      const refundInfo = await applyRefundAfterProviderCancellation(
        booking,
        vendorCancellationReason,
        cancellation_reason,
        { refundMethod: 'original' }
      ).catch((e: any) => {
        console.warn('[vendor/cancel] refund apply failed:', e?.message);
        return null;
      });

      // Log status change
      await logBookingStatusChange(
        bookingId,
        oldStatus,
        'cancelled',
        vendorId || booking.vendor_id,
        'vendor',
        extraNote ? `Vendor cancelled (${reasonLabel}): ${extraNote}` : `Vendor cancelled (${reasonLabel})`
      );

      // Publish notification event
      try {
        const { publishBookingStatusUpdated } = await import('../../../utils/sns-client');
        await publishBookingStatusUpdated({
          bookingId,
          customerId: booking.customer_id,
          vendorId: booking.vendor_id || vendorId,
          oldStatus,
          newStatus: 'cancelled',
          reason: cancellation_reason,
          eventTimestamp: new Date().toISOString(),
          eventId: randomUUID(),
        });
      } catch (error) {
        console.error('Failed to publish booking status updated event:', error);
      }

      try {
        await notifyBookingCancelledByVendor({
          bookingId,
          reason: cancellation_reason,
          refundInfo: refundInfo ?? undefined,
        });
      } catch (notifErr: any) {
        console.warn(
          '[vendor/cancel] Customer cancel notification failed:',
          notifErr?.message || notifErr
        );
      }

      return c.json({
        success: true,
        booking: updated[0],
        message: 'Booking cancelled successfully',
        refund: refundInfo ?? undefined,
      });
    } catch (error: any) {
      console.error('Error cancelling booking:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/bookings/:bookingId/decline
   * Decline a booking (alias for cancel with reason)
   */
  app.post("/vendor/bookings/:bookingId/decline", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const body = await c.req.json().catch(() => ({}));
      const { vendorId, reason, suggestAlternative } = body;
      const vendorCancellationReason = parseVendorCancellationReason(
        body.vendorCancellationReason ?? body.vendor_cancellation_reason
      );
      if (!vendorCancellationReason) {
        return c.json(
          {
            error:
              'vendorCancellationReason is required. Use one of: emergency, operational, technical (Finance → Cancellation & Refund policy, provider tiers).',
          },
          400
        );
      }

      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];
      const oldStatus = booking.status;
      if (!['pending', 'confirmed'].includes(oldStatus)) {
        return c.json({ error: `Booking cannot be declined. Current status: ${oldStatus}` }, 400);
      }

      const pkgPurchaseIdEarly =
        (booking as any).package_purchase_id ?? (booking as any).packagePurchaseId ?? null;
      if (Boolean((booking as any).is_package_session) && pkgPurchaseIdEarly) {
        return c.json(
          {
            error:
              'Decline the package parent booking to refund the customer and cancel all sessions.',
          },
          400
        );
      }

      const pkgPidForParentCheck =
        (booking as any).package_purchase_id ?? (booking as any).packagePurchaseId ?? null;
      const isPackageParentDecline = Boolean(pkgPidForParentCheck) && !Boolean((booking as any).is_package_session);
      if (isPackageParentDecline && pkgPidForParentCheck) {
        try {
          const s1Res = await query(
            `SELECT status::text AS st, started_at
             FROM bookings
             WHERE package_purchase_id = $1::uuid
               AND COALESCE(is_package_session, false) = true
               AND COALESCE(package_session_number, 0) = 1
             LIMIT 1`,
            [String(pkgPidForParentCheck)]
          );
          const r = (s1Res as any).rows?.[0];
          if (r) {
            const st = String(r.st ?? '').toLowerCase();
            const sessionOneStarted =
              r.started_at != null ||
              [
                'in_progress',
                'arrived',
                'completed',
                'active',
                'service_started',
                'started',
              ].includes(st);
            if (sessionOneStarted) {
              return c.json(
                {
                  error:
                    'Cannot decline this package: session 1 has already started. Contact support if you need to cancel remaining sessions.',
                },
                400
              );
            }
          }
        } catch (e) {
          console.warn('[vendor/decline] session-1 check failed:', (e as any)?.message);
        }
      }

      const reasonLabel = vendorCancellationReasonLabel(vendorCancellationReason);
      const extraNote = typeof reason === 'string' && reason.trim() ? reason.trim() : '';
      const alt =
        typeof suggestAlternative === 'string' && suggestAlternative.trim()
          ? ` Suggested alternative: ${suggestAlternative.trim()}`
          : '';
      const cancellation_reason =
        (extraNote
          ? `Provider declined (${reasonLabel}). ${extraNote}`
          : `Provider declined: ${reasonLabel}.`) + alt;

      const updated = await update('bookings',
        { id: bookingId },
        {
          status: 'cancelled',
          cancellation_reason,
          cancelled_at: new Date().toISOString(),
          cancelled_by: 'provider',
        }
      );

      const pkgPidRaw =
        (booking as any).package_purchase_id ?? (booking as any).packagePurchaseId ?? null;
      const isPkgSession = Boolean((booking as any).is_package_session);
      const isPackagePurchaseParentRow = Boolean(pkgPidRaw) && !isPkgSession;

      let bookingRowForRefund: Record<string, any> = booking as Record<string, any>;
      if (isPackagePurchaseParentRow && pkgPidRaw) {
        try {
          const ppRes = await query(
            `SELECT COALESCE(total_with_tax, amount, package_price, 0)::numeric AS pkg_amt
             FROM package_purchases WHERE id = $1::uuid LIMIT 1`,
            [String(pkgPidRaw)]
          );
          const pkgAmt = ppRes.rows?.[0]?.pkg_amt;
          const ta = Number((booking as any).total_amount ?? 0);
          if (pkgAmt != null && Number(pkgAmt) > 0.009 && ta <= 0.009) {
            bookingRowForRefund = {
              ...(booking as Record<string, any>),
              total_amount: Number(pkgAmt),
            };
          }
        } catch (e) {
          console.warn('[vendor/decline] package purchase amount lookup failed:', (e as any)?.message);
        }
      }

      const refundInfo = await applyRefundAfterProviderCancellation(
        bookingRowForRefund,
        vendorCancellationReason,
        cancellation_reason,
        { refundMethod: 'original' }
      ).catch((e: any) => {
        console.warn('[vendor/decline] refund apply failed:', e?.message);
        return null;
      });

      const cascadeNote = `${cancellation_reason} (All package sessions cancelled.)`;
      let cancelledSessionIds: string[] = [];
      if (isPackagePurchaseParentRow && pkgPidRaw) {
        try {
          const casRes = await query(
            `UPDATE bookings AS b
             SET
               status = 'cancelled',
               cancellation_reason = $3,
               cancelled_at = NOW(),
               cancelled_by = 'provider'
             FROM (
               SELECT id, status AS old_st
               FROM bookings
               WHERE package_purchase_id = $1::uuid
                 AND id <> $2::uuid
                 AND COALESCE(is_package_session, false) = true
                 AND status NOT IN ('completed', 'cancelled')
             ) AS t
             WHERE b.id = t.id
             RETURNING b.id::text AS id, t.old_st::text AS old_status`,
            [String(pkgPidRaw), bookingId, cascadeNote]
          );
          const rows = (casRes as any).rows || [];
          cancelledSessionIds = rows.map((r: { id: string }) => r.id);
          for (const r of rows) {
            const sid = String((r as any).id);
            const oldSt = String((r as any).old_status || 'confirmed');
            try {
              await logBookingStatusChange(
                sid,
                oldSt,
                'cancelled',
                vendorId || (booking as any).vendor_id,
                'vendor',
                `Session cancelled: provider declined package (parent booking ${bookingId})`
              );
            } catch (e) {
              console.warn('[vendor/decline] cascade log failed for', sid, (e as any)?.message);
            }
            try {
              const { publishBookingStatusUpdated } = await import('../../../utils/sns-client');
              await publishBookingStatusUpdated({
                bookingId: sid,
                customerId: (booking as any).customer_id,
                vendorId: (booking as any).vendor_id || vendorId,
                oldStatus: oldSt,
                newStatus: 'cancelled',
                reason: cascadeNote,
                eventTimestamp: new Date().toISOString(),
                eventId: randomUUID(),
              });
            } catch (e) {
              console.warn('[vendor/decline] cascade publish failed for', sid, (e as any)?.message);
            }
          }
          await query(
            `UPDATE package_purchases
             SET status = 'cancelled', updated_at = NOW()
             WHERE id = $1::uuid AND status = 'active'`,
            [String(pkgPidRaw)]
          ).catch(() => null);
          await reversePendingPackageSessionEarnings(
            { query } as SqlClient,
            String(pkgPidRaw),
            '[VENDOR-DECLINE-PACKAGE]'
          ).catch((e: unknown) =>
            console.warn('[vendor/decline] earnings reverse:', (e as Error)?.message)
          );
        } catch (cascadeErr: any) {
          console.error('[vendor/decline] package session cascade failed:', cascadeErr?.message);
        }
      }

      // Log status change
      await logBookingStatusChange(
        bookingId,
        oldStatus,
        'cancelled',
        vendorId || booking.vendor_id,
        'vendor',
        extraNote ? `Vendor declined (${reasonLabel}): ${extraNote}` : `Vendor declined (${reasonLabel})`
      );

      // Publish notification event
      try {
        const { publishBookingStatusUpdated } = await import('../../../utils/sns-client');
        await publishBookingStatusUpdated({
          bookingId,
          customerId: booking.customer_id,
          vendorId: booking.vendor_id || vendorId,
          oldStatus,
          newStatus: 'cancelled',
          reason: cancellation_reason,
          eventTimestamp: new Date().toISOString(),
          eventId: randomUUID(),
        });
      } catch (error) {
        console.error('Failed to publish booking status updated event:', error);
      }

      // One customer SMS + in-app/push for the declined booking (not per cascaded session)
      try {
        await notifyBookingCancelledByVendor({
          bookingId,
          reason: cancellation_reason,
          refundInfo: refundInfo ?? undefined,
        });
      } catch (notifErr: any) {
        console.warn(
          '[vendor/decline] Customer cancel notification failed:',
          notifErr?.message || notifErr
        );
      }

      return c.json({
        success: true,
        booking: updated[0],
        message: 'Booking declined successfully',
        refund: refundInfo ?? undefined,
        cancelledPackageSessionIds:
          cancelledSessionIds.length > 0 ? cancelledSessionIds : undefined,
      });
    } catch (error: any) {
      console.error('Error declining booking:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/bookings/:bookingId/complete
   * ⚠️ DEPRECATED: This endpoint has been moved to vendor.gpstracking.ts
   * The new endpoint includes GPS tracking session completion and enhanced OTP handling.
   * This endpoint is kept commented out to avoid route conflicts.
   * 
   * The active endpoint is registered in: src/endpoints/gpsTracking/endpoints/vendor.gpstracking.ts
   */
  // app.post("/vendor/bookings/:bookingId/complete", async (c) => {
  //   ... (moved to vendor.gpstracking.ts for GPS tracking support)
  // });

  /**
   * GET /vendor/bookings/:bookingId/details
   * Get detailed booking information for appointment modal
   */
  app.get("/vendor/bookings/:bookingId/details", async (c) => {
    try {
      const rawBookingId = c.req.param('bookingId');
      // Normalize so client quirks (whitespace, casing) don't cause 404; UUIDs are case-insensitive in PG but param must be valid
      const bookingId = typeof rawBookingId === 'string' ? rawBookingId.trim().toLowerCase() : String(rawBookingId || '').trim().toLowerCase();

      console.log(`📋 [VENDOR-BOOKINGS] Fetching booking details for: ${bookingId}`);

      // Validate UUID format
      if (!bookingId || !isValidUUID(bookingId)) {
        return c.json({ error: 'Invalid booking ID format' }, 400);
      }

      // Get booking (by id only; vendor scoping is not required for details)
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];

      if (shouldHideBookingRowFromVendorUi(booking as Record<string, unknown>)) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      // ✅ FIX: Extract pet_id from notes if not in pet_id column
      // Legacy bookings stored pet_id in notes as "Pet ID: <uuid>"
      // Diagnostics store notes as JSON with optional petId, patientName, patientAge
      let petIdToUse = booking.pet_id;
      let notesParsed: { petId?: string; patientName?: string; patientAge?: string; [key: string]: any } | null = null;
      if (booking.notes) {
        const petIdMatch = typeof booking.notes === 'string' && booking.notes.match(/Pet ID:\s*([0-9a-f-]{36})/i);
        if (petIdMatch) {
          petIdToUse = petIdMatch[1];
          console.log(`📋 [BOOKING-DETAILS] Extracted pet_id from notes: ${petIdToUse}`);
        }
        // Diagnostics (and similar) store JSON in notes with patientName, patientAge, optional petId
        try {
          const parsed = typeof booking.notes === 'string' ? JSON.parse(booking.notes) : booking.notes;
          if (parsed && typeof parsed === 'object') {
            notesParsed = parsed;
            if (!petIdToUse && (parsed.petId || parsed.pet_id)) {
              petIdToUse = parsed.petId || parsed.pet_id;
              console.log(`📋 [BOOKING-DETAILS] Extracted pet_id from notes JSON: ${petIdToUse}`);
            }
          }
        } catch {
          // notes is not JSON (e.g. plain "Pet: Name") - ignore
        }
      }
      if (!petIdToUse && booking.special_instructions) {
        const petIdMatch = booking.special_instructions.match(/Pet ID:\s*([0-9a-f-]{36})/i);
        if (petIdMatch) {
          petIdToUse = petIdMatch[1];
          console.log(`📋 [BOOKING-DETAILS] Extracted pet_id from special_instructions: ${petIdToUse}`);
        }
      }
      // Package umbrella rows often omit pet_id; if customer has exactly one pet, use it for display.
      if (!petIdToUse && booking.customer_id) {
        try {
          const pr = await query(
            `SELECT id FROM pets WHERE customer_id = $1::uuid ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 2`,
            [booking.customer_id]
          );
          const rows = pr.rows || [];
          if (rows.length === 1 && rows[0]?.id) {
            petIdToUse = String(rows[0].id);
            console.log(`📋 [BOOKING-DETAILS] Single-pet fallback for customer: ${petIdToUse}`);
          }
        } catch (petFallbackErr) {
          console.warn('[BOOKING-DETAILS] Single-pet fallback failed:', petFallbackErr);
        }
      }

      // Package purchase (when booking is a package session) - fetch in parallel with others
      const packagePurchaseId = (booking as any).package_purchase_id;
      const packagePurchasePromise = packagePurchaseId
        ? query(
            'SELECT id, package_name, total_sessions, remaining_sessions, unlimited_usage FROM package_purchases WHERE id = $1',
            [packagePurchaseId]
          ).then((r: any) => r.rows?.[0] || null).catch(() => null)
        : Promise.resolve(null);

      // Fetch related data in parallel (service can be from services or service_catalog)
              // ✅ Fetch customer address details - try address_id first, then customer's default address
        let customerAddressDetails: any = null;
        if ((booking as any).address_id) {
          try {
            const addressResult = await query(
              `SELECT id, address_line1, address_line2, city, state, pincode, landmark, 
                      flat_no, house_no, floor, street_name, apartment_name,
                      latitude, longitude, coordinates, customer_id, is_default
               FROM customer_addresses 
               WHERE id = $1`,
              [(booking as any).address_id]
            );
            if (addressResult.rows && addressResult.rows.length > 0) {
              customerAddressDetails = addressResult.rows[0];
              console.log(`[VENDOR-BOOKINGS] Found address by address_id ${(booking as any).address_id}:`, {
                apartment_name: customerAddressDetails.apartment_name,
                flat_no: customerAddressDetails.flat_no,
                house_no: customerAddressDetails.house_no,
                floor: customerAddressDetails.floor,
                street_name: customerAddressDetails.street_name,
              });
            } else {
              console.warn(`[VENDOR-BOOKINGS] No address found with address_id ${(booking as any).address_id}`);
            }
          } catch (addrError) {
            console.warn('Could not fetch customer address details by address_id:', addrError);
          }
        }
        
        // ✅ FALLBACK: If no address_id or address not found, try customer's default address
        if (!customerAddressDetails && booking.customer_id) {
          try {
            const defaultAddressResult = await query(
              `SELECT id, address_line1, address_line2, city, state, pincode, landmark, 
                      flat_no, house_no, floor, street_name, apartment_name,
                      latitude, longitude, coordinates, customer_id, is_default
               FROM customer_addresses 
               WHERE customer_id = $1 
               ORDER BY is_default DESC NULLS LAST, created_at DESC 
               LIMIT 1`,
              [booking.customer_id]
            );
            if (defaultAddressResult.rows && defaultAddressResult.rows.length > 0) {
              customerAddressDetails = defaultAddressResult.rows[0];
              console.log(`[VENDOR-BOOKINGS] Using customer's default address for booking ${bookingId}:`, {
                address_id: customerAddressDetails.id,
                apartment_name: customerAddressDetails.apartment_name,
                flat_no: customerAddressDetails.flat_no,
                house_no: customerAddressDetails.house_no,
                floor: customerAddressDetails.floor,
                street_name: customerAddressDetails.street_name,
              });
            } else {
              // Final fallback: Get any address for this customer
              const anyAddrResult = await query(
                `SELECT id, address_line1, address_line2, city, state, pincode, landmark, 
                        flat_no, house_no, floor, street_name, apartment_name,
                        latitude, longitude, coordinates, customer_id, is_default
                 FROM customer_addresses 
                 WHERE customer_id = $1 
                 ORDER BY created_at DESC 
                 LIMIT 1`,
                [booking.customer_id]
              );
              if (anyAddrResult.rows && anyAddrResult.rows.length > 0) {
                customerAddressDetails = anyAddrResult.rows[0];
                console.log(`[VENDOR-BOOKINGS] Using any customer address for booking ${bookingId}:`, {
                  address_id: customerAddressDetails.id,
                  apartment_name: customerAddressDetails.apartment_name,
                  flat_no: customerAddressDetails.flat_no,
                  house_no: customerAddressDetails.house_no,
                  floor: customerAddressDetails.floor,
                  street_name: customerAddressDetails.street_name,
                });
              }
            }
          } catch (fallbackAddrError) {
            console.warn('Could not fetch customer default address:', fallbackAddrError);
          }
        }
        
        // ✅ CRITICAL FIX: If address was found but lacks detailed fields (flat_no, house_no, floor),
        // augment with customer's DEFAULT address which may have these fields
        if (customerAddressDetails && !customerAddressDetails.flat_no && !customerAddressDetails.house_no && !customerAddressDetails.floor && !customerAddressDetails.apartment_name && booking.customer_id) {
          try {
            const defaultAddrWithDetails = await query(
              `SELECT flat_no, house_no, floor, street_name, apartment_name
               FROM customer_addresses 
               WHERE customer_id = $1 
                 AND (flat_no IS NOT NULL OR house_no IS NOT NULL OR floor IS NOT NULL OR apartment_name IS NOT NULL)
               ORDER BY is_default DESC NULLS LAST, created_at DESC 
               LIMIT 1`,
              [booking.customer_id]
            );
            if (defaultAddrWithDetails.rows && defaultAddrWithDetails.rows.length > 0) {
              const detailedAddr = defaultAddrWithDetails.rows[0];
              customerAddressDetails.flat_no = detailedAddr.flat_no || customerAddressDetails.flat_no;
              customerAddressDetails.house_no = detailedAddr.house_no || customerAddressDetails.house_no;
              customerAddressDetails.floor = detailedAddr.floor || customerAddressDetails.floor;
              customerAddressDetails.street_name = detailedAddr.street_name || customerAddressDetails.street_name;
              customerAddressDetails.apartment_name = detailedAddr.apartment_name || customerAddressDetails.apartment_name;
              console.log(`[VENDOR-BOOKINGS] Augmented address with detailed fields from customer's other address:`, {
                flat_no: customerAddressDetails.flat_no,
                house_no: customerAddressDetails.house_no,
                floor: customerAddressDetails.floor,
                street_name: customerAddressDetails.street_name,
                apartment_name: customerAddressDetails.apartment_name,
              });
            }
          } catch (augmentError) {
            console.warn('Could not augment address with detailed fields:', augmentError);
          }
        }

const [customer, vendorServiceRows, pet, vendor, prescriptions, activities, packagePurchase] = await Promise.all([
        // Customer info
        booking.customer_id
          ? select('customers', { id: booking.customer_id }).catch(() => [])
          : Promise.resolve([]),
        // Vendor Manage row (bookings.service_id is vendor_services.id)
        booking.service_id && booking.vendor_id
          ? query(
              `SELECT id, service_id, service_name, duration_minutes, custom_duration, service_style, category, sub_category
               FROM vendor_services
               WHERE vendor_id = $1::uuid
                 AND (id = $2::uuid OR service_id = $2::uuid)
               ORDER BY
                 CASE WHEN id = $2::uuid THEN 0 ELSE 1 END,
                 CASE WHEN service_id = $2::uuid THEN 0 ELSE 1 END,
                 updated_at DESC NULLS LAST
               LIMIT 1`,
              [booking.vendor_id, booking.service_id]
            )
              .then((r: any) => r.rows || [])
              .catch(() => [])
          : Promise.resolve([]),
        // Pet info - use extracted petIdToUse
        petIdToUse
          ? select('pets', { id: petIdToUse }).catch(() => [])
          : Promise.resolve([]),
        // Vendor info
        booking.vendor_id
          ? select('vendors', { id: booking.vendor_id }).catch(() => [])
          : Promise.resolve([]),
        // Prescriptions (omit is_active filter for schema compatibility; table may not have is_active)
        query(
          `SELECT * FROM prescriptions 
           WHERE booking_id = $1
           ORDER BY created_at DESC`,
          [bookingId]
        ).catch(() => ({ rows: [] })),
        // Activities/history
        query(
          `SELECT * FROM booking_activities 
           WHERE booking_id = $1
           ORDER BY created_at DESC`,
          [bookingId]
        ).catch(() => ({ rows: [] })),
        packagePurchasePromise,
      ]);

      const vendorSvc = vendorServiceRows.length > 0 ? vendorServiceRows[0] : null;
      const serviceCatalogLookupId = (vendorSvc?.service_id as string | undefined) || booking.service_id;

      const [service, catalogService, serviceSnap] = await Promise.all([
        serviceCatalogLookupId
          ? select('services', { id: serviceCatalogLookupId }).catch(() => [])
          : Promise.resolve([]),
        serviceCatalogLookupId
          ? query(
              `SELECT service_name, display_name, description, category_id, category_name, base_price,
                      duration_minutes, specialization_ids, service_style
               FROM service_catalog WHERE id = $1`,
              [serviceCatalogLookupId]
            )
              .then((r: any) => r.rows)
              .catch(() => [])
          : Promise.resolve([]),
        loadBookingServiceSnapshot(booking.vendor_id, booking.service_id),
      ]);

      const manageDurationMinutes = vendorSvc
        ? Number(
            vendorSvc.custom_duration != null &&
              vendorSvc.custom_duration !== '' &&
              Number(vendorSvc.custom_duration) > 0
              ? vendorSvc.custom_duration
              : vendorSvc.duration_minutes
          )
        : NaN;
      const pickDuration = (...candidates: unknown[]) => {
        for (const c of candidates) {
          const n = Number(c);
          if (Number.isFinite(n) && n > 0) return n;
        }
        return 30;
      };
      const serviceDurationMinutes = Math.min(
        1440,
        Math.max(
          5,
          Math.round(
            pickDuration(
              Number.isFinite(manageDurationMinutes) && manageDurationMinutes > 0 ? manageDurationMinutes : null,
              serviceSnap?.durationMinutes,
              catalogService[0]?.duration_minutes,
              service[0]?.duration_minutes,
              (booking as any).duration,
              (booking as any).total_duration_minutes
            )
          )
        )
      );

      const catalogBaseForVendor =
        catalogService.length > 0 ? Number((catalogService[0] as any)?.base_price ?? 0) : null;
      const legacyServicePx =
        service.length > 0 ? Number((service[0] as any)?.price ?? 0) : null;
      const vendorVisibleAmount = resolveVendorVisibleBookingAmount(booking, {
        serviceSnap,
        vendorSvc,
        catalogBasePrice:
          catalogBaseForVendor != null && Number.isFinite(catalogBaseForVendor) && catalogBaseForVendor > 0
            ? catalogBaseForVendor
            : null,
        legacyServicePrice:
          legacyServicePx != null && Number.isFinite(legacyServicePx) && legacyServicePx > 0
            ? legacyServicePx
            : null,
      });

      const catalogServiceLabel =
        (serviceSnap?.displayName || serviceSnap?.serviceName) ||
        (catalogService.length > 0 ? (catalogService[0].display_name || catalogService[0].service_name) : null) ||
        vendorSvc?.service_name ||
        (service.length > 0 ? service[0].name : null) ||
        booking.service_name ||
        'Unknown Service';
      const display = applyVendorBookingDisplayFields(booking, {
        catalogServiceName: catalogServiceLabel,
        vendorVisibleAmount,
      });
      const resolvedServiceLabel = display.serviceName;
      const vendorPrice = display.price;

      // Build enriched booking response
      const enrichedBooking = {
        id: booking.id,
        bookingId: booking.id,
        status: booking.status,
        // ✅ FIX: Schedule information - ensure all formats are included
        bookingDate: booking.booking_date,
        booking_date: booking.booking_date,
        bookingTime: booking.booking_time,
        booking_time: booking.booking_time,
        scheduledDate: booking.booking_date, // Alias for frontend compatibility
        scheduledTime: booking.booking_time, // Alias for frontend compatibility
        schedule: booking.booking_time, // Alias for frontend compatibility
        startDate: booking.booking_date, // Alias for frontend compatibility
        duration: serviceDurationMinutes,
        totalAmount: vendorPrice,
        total_amount: vendorPrice,
        price: vendorPrice,
        basePrice: display.basePrice,
        base_price: display.base_price,
        commerceMode: display.commerceMode,
        commerce_mode: display.commerce_mode,
        serviceStyle: booking.service_style || booking.service_type || 'at_clinic',
        notes: booking.notes,
        specialInstructions: booking.special_instructions,
        paymentStatus: booking.payment_status || 'pending',
        
        // ✅ FIX: Ensure all IDs are at top level
        customerId: booking.customer_id,
        customer_id: booking.customer_id,
        vendorId: booking.vendor_id,
        vendor_id: booking.vendor_id,
        staffId: booking.staff_id || null,
        staff_id: booking.staff_id || null,
        petId: petIdToUse || booking.pet_id || null,
        pet_id: petIdToUse || booking.pet_id || null,
        serviceId: booking.service_id,
        service_id: booking.service_id,
        
        // Customer details
        customerName: customer.length > 0 ? customer[0].full_name : 'Unknown Customer',
        customerPhone: customer.length > 0 ? customer[0].phone : null,
        customerEmail: customer.length > 0 ? customer[0].email : null,
        customerAddress: customer.length > 0 ? customer[0].address : null,
        // ✅ Detailed address fields for GPS navigation
        customerAddressDetails: customerAddressDetails ? {
          addressLine1: customerAddressDetails.address_line1,
          addressLine2: customerAddressDetails.address_line2,
          city: customerAddressDetails.city,
          state: customerAddressDetails.state,
          pincode: customerAddressDetails.pincode,
          landmark: customerAddressDetails.landmark,
          flatNo: customerAddressDetails.flat_no,
          houseNo: customerAddressDetails.house_no,
          floor: customerAddressDetails.floor,
          streetName: customerAddressDetails.street_name,
          apartmentName: customerAddressDetails.apartment_name,
          latitude: customerAddressDetails.latitude,
          longitude: customerAddressDetails.longitude,
          // Format full address with detailed fields
          formattedAddress: formatDetailedAddress(customerAddressDetails)
        } : null,
        
        // Pet details - use pet from DB, or fallback to notes (diagnostics: patientName/patientAge)
        petName: pet.length > 0 ? pet[0].name : (booking.pet_name || (notesParsed?.patientName ?? null) || 'Unknown Pet'),
        petType: pet.length > 0 ? pet[0].species : (booking.pet_type || (notesParsed?.petType ?? notesParsed?.pet_type ?? '') || ''),
        petBreed: pet.length > 0 ? pet[0].breed : (booking.pet_breed || (notesParsed?.breed ?? '') || ''),
        petAge: pet.length > 0 ? (pet[0].age_years != null ? `${pet[0].age_years}` : (pet[0].age != null ? `${pet[0].age}` : '')) : (booking.pet_age || (notesParsed?.patientAge != null ? String(notesParsed.patientAge) : (notesParsed?.petAge != null ? String(notesParsed.petAge) : '')) || ''),
        petWeight: pet.length > 0 ? (pet[0].weight_kg || pet[0].weight) : null,
        petPhoto: pet.length > 0 ? pet[0].profile_photo_url : null,
        // Pet object for structured access
        pet: pet.length > 0 ? {
          id: pet[0].id || petIdToUse,
          name: pet[0].name,
          species: pet[0].species,
          breed: pet[0].breed,
          age: pet[0].age_years || pet[0].age,
          weight: pet[0].weight_kg || pet[0].weight,
          photo_url: pet[0].profile_photo_url,
        } : (notesParsed?.patientName || notesParsed?.patientAge ? {
          id: petIdToUse || null,
          name: notesParsed.patientName || 'Patient',
          species: notesParsed.petType || notesParsed.pet_type || '',
          breed: notesParsed.breed || '',
          age: notesParsed.patientAge ?? notesParsed.petAge ?? null,
          weight: null,
          photo_url: null,
        } : null),
        
        // Service details: align with customer booking details (vendor_services.id → catalog via snapshot)
        serviceName: resolvedServiceLabel,
        serviceCategory:
          serviceSnap?.category ||
          (catalogService.length > 0
            ? (catalogService[0].category_name || catalogService[0].category_id)
            : null) ||
          (service.length > 0 ? service[0].category : null) ||
          vendorSvc?.category ||
          null,
        serviceDescription:
          serviceSnap?.description ||
          (catalogService.length > 0 ? catalogService[0].description : null) ||
          (service.length > 0 ? service[0].description : null),
        service: (() => {
          const cat = catalogService[0];
          const specRaw = cat?.specialization_ids;
          const specArr: any[] = Array.isArray(specRaw)
            ? specRaw
            : specRaw != null
              ? [specRaw as any]
              : [];
          if (serviceSnap) {
            const base = snapshotToNestedService(serviceSnap);
            return {
              ...base,
              name: resolvedServiceLabel,
              serviceName: resolvedServiceLabel,
              displayName: resolvedServiceLabel,
              price: vendorPrice,
              basePrice: display.basePrice,
              duration: serviceDurationMinutes,
              duration_minutes: serviceDurationMinutes,
              durationMinutes: serviceDurationMinutes,
              specializationIds: specArr.length ? specArr : (base as any).specializationIds || [],
              specialization_ids: specArr.length ? specArr : (base as any).specialization_ids || [],
            };
          }
          if (catalogService.length > 0 || service.length > 0 || vendorSvc) {
            return {
              id: (catalogService[0] || service[0])?.id || vendorSvc?.service_id || booking.service_id,
              serviceId: booking.service_id,
              name: resolvedServiceLabel,
              serviceName: resolvedServiceLabel,
              displayName: resolvedServiceLabel,
              category: catalogService.length > 0
                ? (catalogService[0].category_name || catalogService[0].category_id)
                : (service.length > 0 ? service[0].category : vendorSvc?.category),
              description: catalogService.length > 0 ? catalogService[0].description : (service.length > 0 ? service[0].description : null),
              price: vendorPrice,
              basePrice: display.basePrice,
              duration: serviceDurationMinutes,
              duration_minutes: serviceDurationMinutes,
              durationMinutes: serviceDurationMinutes,
              specializationIds: specArr,
              specialization_ids: specArr,
              service_style: catalogService.length > 0 ? (catalogService[0].service_style || null) : (service[0]?.service_style || vendorSvc?.service_style || null),
              serviceStyle: catalogService.length > 0 ? (catalogService[0].service_style || null) : (service[0]?.service_style || vendorSvc?.service_style || null),
            };
          }
          return null;
        })(),
        
        // ✅ Home service: customer/delivery location for GPS tracking (vendor = start, customer = destination)
        address_id: (booking as any).address_id || null,
        delivery_latitude: (booking as any).delivery_latitude != null ? String((booking as any).delivery_latitude) : null,
        delivery_longitude: (booking as any).delivery_longitude != null ? String((booking as any).delivery_longitude) : null,
        latitude: (booking as any).latitude != null ? String((booking as any).latitude) : null,
        longitude: (booking as any).longitude != null ? String((booking as any).longitude) : null,
        location: customerAddressDetails 
          ? formatDetailedAddress(customerAddressDetails)
          : ((booking as any).delivery_address || (customer.length > 0 ? customer[0].address : null) || 'Home Visit'),

        // Vendor details
        vendorName: vendor.length > 0 ? vendor[0].business_name || vendor[0].full_name : null,
        vendorPhone: vendor.length > 0 ? vendor[0].phone : null,
        vendorAddress: vendor.length > 0 
          ? [vendor[0].address, vendor[0].city, vendor[0].state, vendor[0].pincode].filter(Boolean).join(', ')
          : null,
        // Vendor object for structured access
        vendor: vendor.length > 0 ? {
          id: vendor[0].id || booking.vendor_id,
          businessName: vendor[0].business_name || vendor[0].full_name,
          phone: vendor[0].phone,
          email: vendor[0].email,
          address: vendor[0].address,
          city: vendor[0].city,
          state: vendor[0].state,
          pincode: vendor[0].pincode,
        } : null,

        // OTP and session tracking
        otpCode: booking.otp_code,
        otpVerifiedAt: booking.otp_verified_at,
        sessionStartedAt: booking.session_started_at,
        sessionEndedAt: booking.session_ended_at,
        completedAt: booking.completed_at,
        cancelledAt: booking.cancelled_at,
        
        // Multi-service: list of services and total duration
        selectedServices: parseSelectedServices(booking.selected_services),
        totalDurationMinutes: booking.total_duration_minutes != null ? Number(booking.total_duration_minutes) : undefined,

        // Package session: when booking is part of a package (E2E Section 5 & 9)
        isPackageSession: Boolean((booking as any).is_package_session ?? (booking as any).is_package),
        packagePurchaseId: (booking as any).package_purchase_id || null,
        packageSessionNumber: (booking as any).package_session_number != null ? Number((booking as any).package_session_number) : null,
        packageName: packagePurchase?.package_name || null,
        packageTotalSessions: packagePurchase?.total_sessions != null ? Number(packagePurchase.total_sessions) : null,
        packageRemainingSessions: packagePurchase?.remaining_sessions != null ? Number(packagePurchase.remaining_sessions) : null,
        packageUnlimitedUsage: Boolean(packagePurchase?.unlimited_usage),
        // Snake_case for frontend compatibility
        is_package_session: Boolean((booking as any).is_package_session ?? (booking as any).is_package),
        package_purchase_id: (booking as any).package_purchase_id || null,
        package_session_number: (booking as any).package_session_number != null ? Number((booking as any).package_session_number) : null,
        package_name: packagePurchase?.package_name || null,
        package_total_sessions: packagePurchase?.total_sessions != null ? Number(packagePurchase.total_sessions) : null,
        package_remaining_sessions: packagePurchase?.remaining_sessions != null ? Number(packagePurchase.remaining_sessions) : null,

        // Timestamps
        createdAt: booking.created_at,
        updatedAt: booking.updated_at,
        
        // Rescheduled booking tracking: indicates if booking was rescheduled and when
        // Explicitly check if rescheduled_at exists and is not null/empty
        isRescheduled: Boolean(booking.rescheduled_at),
        rescheduledAt: booking.rescheduled_at || null,
        rescheduledFromBookingId: booking.rescheduled_from_booking_id || null,
      };

      return c.json({
        success: true,
        booking: enrichedBooking,
        activities: activities.rows.map((a: any) => ({
          id: a.id,
          type: a.activity_type,
          description: a.description,
          performedBy: a.performed_by,
          createdAt: a.created_at,
        })),
        prescriptions: prescriptions.rows.map((p: any) => ({
          id: p.id,
          notes: p.notes,
          medications: p.medications,
          uploadedAt: p.created_at,
          file: p.file_url,
        })),
      });
    } catch (error: any) {
      console.error('❌ [VENDOR-BOOKINGS] Error fetching booking details:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ✅ FIX: Add alias route for frontend compatibility
  // Frontend calls /vendor/:vendorId/bookings but backend has /vendor/bookings/:vendorId
  app.get("/vendor/:vendorId/bookings", async (c) => {
    try {
      const { vendorId: paramVendorId } = c.req.param();
      const vendorId = await resolveVendorId(paramVendorId);
      const vendorIds = [vendorId];
      if (paramVendorId !== vendorId) vendorIds.push(paramVendorId);

      const hasBookingCapability = await checkVendorCapability(vendorId, 'booking_view') ||
                                   await checkVendorCapability(vendorId, 'booking_create') ||
                                   await checkVendorCapability(vendorId, 'bookings');
      if (!hasBookingCapability) {
        return c.json({ error: 'Vendor does not have booking viewing capability' }, 403);
      }
      const date = c.req.query('date');
      const status = c.req.query('status') || c.req.query('filter') || 'all';
      const startDate = c.req.query('startDate');
      const endDate = c.req.query('endDate');
      const period = c.req.query('period');
      const anchorDate = c.req.query('anchorDate');
      const view = c.req.query('view');
      const { limit, offset } = parseVendorBookingsPagination(
        c.req.query('limit'),
        c.req.query('offset')
      );

      const dateFilter = resolveVendorBookingsDateFilter({
        date,
        startDate,
        endDate,
        period,
        anchorDate,
      });

      console.log(`📋 [VENDOR-BOOKINGS] Fetching bookings for vendor: ${paramVendorId} (alias, resolved: ${vendorId})`);
      console.log(`   Filters: date=${date}, period=${period}, range=${dateFilter.startDate}..${dateFilter.endDate}, status=${status}, view=${view}, limit=${limit}, offset=${offset}`);

      let queryText = vendorIds.length === 1
        ? `SELECT * FROM bookings b WHERE b.vendor_id = $1
           AND b.status != 'pending_payment'
           AND (
             COALESCE(b.total_amount, 0) <= 0
             OR LOWER(COALESCE(b.payment_status, '')) IN ('paid', 'completed', 'partially_refunded', 'refunded', 'partial')
           )`
        : `SELECT * FROM bookings b WHERE (b.vendor_id = $1 OR b.vendor_id = $2)
           AND b.status != 'pending_payment'
           AND (
             COALESCE(b.total_amount, 0) <= 0
             OR LOWER(COALESCE(b.payment_status, '')) IN ('paid', 'completed', 'partially_refunded', 'refunded', 'partial')
           )`;
      const params: any[] = [...vendorIds];
      let paramIndex = vendorIds.length + 1;

      const tempSupAlias = getTemporaryVendorSuppressionParams();
      queryText += sqlAndExcludeSuppressedBookingRows(
        'b',
        tempSupAlias ? paramIndex : undefined,
        tempSupAlias ? paramIndex + 1 : undefined,
      );
      if (tempSupAlias) {
        params.push(tempSupAlias.vendorIds, tempSupAlias.cutoffDateIst);
        paramIndex += 2;
      }

      const dateAppliedAlias = appendBookingDateFilterSql(queryText, params, paramIndex, dateFilter);
      queryText = dateAppliedAlias.queryText;
      paramIndex = dateAppliedAlias.paramIndex;

      if (status && status !== 'all') {
        queryText += ` AND b.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      queryText += appendBookingViewFilter(view, 'b');

      const countQueryTextAlias = queryText.replace(/^SELECT \* FROM bookings b/i, 'SELECT COUNT(*)::int AS total FROM bookings b');
      const countResultAlias = await query(countQueryTextAlias, params).catch(() => ({ rows: [{ total: '0' }] }));
      const totalAlias = parseInt(String(countResultAlias.rows[0]?.total ?? '0'), 10) || 0;

      queryText += ' ORDER BY b.booking_date ASC, b.booking_time ASC';
      queryText += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await query(queryText, params).catch(() => ({ rows: [] }));

      // Enrich bookings with customer and service data
      const enrichedBookings = await Promise.all(
        result.rows.map(async (booking: any) => {
          const [customer, service] = await Promise.all([
            booking.customer_id
              ? select('customers', { id: booking.customer_id }).catch(() => [])
              : Promise.resolve([]),
            booking.service_id
              ? select('services', { id: booking.service_id }).catch(() => [])
              : Promise.resolve([]),
          ]);

          const serviceSnapAlias = await loadBookingServiceSnapshot(booking.vendor_id, booking.service_id);
          const vendorVisibleAlias = resolveVendorVisibleBookingAmount(booking, { serviceSnap: serviceSnapAlias });
          const catalogServiceName =
            serviceSnapAlias?.displayName ||
            serviceSnapAlias?.serviceName ||
            (service.length > 0 ? service[0].name : null) ||
            booking.service_name ||
            'Service';
          const display = applyVendorBookingDisplayFields(booking, {
            catalogServiceName,
            vendorVisibleAmount: vendorVisibleAlias,
          });
          return {
            ...booking,
            service_name: display.service_name,
            serviceName: display.serviceName,
            total_amount: display.total_amount,
            totalAmount: display.totalAmount,
            price: display.price,
            base_price: display.base_price,
            basePrice: display.basePrice,
            commerce_mode: display.commerce_mode,
            commerceMode: display.commerceMode,
            customer: customer.length > 0 ? {
              id: customer[0].id,
              name: customer[0].full_name || customer[0].name,
              phone: customer[0].phone,
            } : null,
            service: service.length > 0 ? {
              id: service[0].id,
              name: display.serviceName,
              category: service[0].category,
              price: display.price,
              basePrice: display.basePrice,
            } : null,
            chatEnabled: true,
            hasUnreadMessages: false,
            unreadMessageCount: 0,
            hasPrescription: false,
            prescriptionCount: 0,
            hasMedicalRecords: false,
            medicalRecordCount: 0,
            isFollowUp: false,
            // Track rescheduled bookings: true if booking was rescheduled (has rescheduled_at timestamp)
            // Explicitly check if rescheduled_at exists and is not null/empty
            isRescheduled: Boolean(booking.rescheduled_at),
            rescheduledAt: booking.rescheduled_at || null,
          };
        })
      );

      return c.json({ 
        success: true, 
        bookings: enrichedBookings,
        total: totalAlias,
        limit,
        offset,
        hasMore: offset + enrichedBookings.length < totalAlias,
        filters: {
          date,
          startDate: dateFilter.startDate,
          endDate: dateFilter.endDate,
          period: period || dateFilter.mode,
          anchorDate: anchorDate || date,
          status,
          view: view || 'all',
        },
      });
    } catch (error: any) {
      console.error('❌ [VENDOR-BOOKINGS] Error fetching bookings:', error);
      return c.json({ error: error.message || 'Failed to fetch bookings' }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/bookings/today
   * Get today's bookings for a vendor
   */
  app.get("/vendor/:vendorId/bookings/today", async (c) => {
    try {
      const { vendorId: paramVendorId } = c.req.param();
      const vendorId = await resolveVendorId(paramVendorId);
      const today = new Date().toISOString().split('T')[0];

      console.log(`📋 [VENDOR-BOOKINGS] Fetching today's bookings for vendor: ${paramVendorId} (resolved: ${vendorId})`);

      const vendorIds = [vendorId];
      if (paramVendorId !== vendorId) vendorIds.push(paramVendorId);
      const todaySup = getTemporaryVendorSuppressionParams();
      const todaySupFrag1 = sqlAndExcludeSuppressedBookingRows('b', todaySup ? 3 : undefined, todaySup ? 4 : undefined);
      const todaySupFrag2 = sqlAndExcludeSuppressedBookingRows('b', todaySup ? 4 : undefined, todaySup ? 5 : undefined);
      const todaySupTail = todaySup ? [todaySup.vendorIds, todaySup.cutoffDateIst] : [];

      const result = vendorIds.length === 1
        ? await query(
            `SELECT * FROM bookings b
             WHERE b.vendor_id = $1 AND b.booking_date = $2 AND b.status != 'pending_payment'
               AND (
                 COALESCE(b.total_amount, 0) <= 0
                 OR LOWER(COALESCE(b.payment_status, '')) IN ('paid', 'completed', 'partially_refunded', 'refunded', 'partial')
               )
               ${todaySupFrag1}
             ORDER BY b.booking_time ASC`,
            [vendorId, today, ...todaySupTail]
          ).catch(() => ({ rows: [] }))
        : await query(
            `SELECT * FROM bookings b
             WHERE (b.vendor_id = $1 OR b.vendor_id = $2) AND b.booking_date = $3 AND b.status != 'pending_payment'
               AND (
                 COALESCE(b.total_amount, 0) <= 0
                 OR LOWER(COALESCE(b.payment_status, '')) IN ('paid', 'completed', 'partially_refunded', 'refunded', 'partial')
               )
               ${todaySupFrag2}
             ORDER BY b.booking_time ASC`,
            [vendorIds[0], vendorIds[1], today, ...todaySupTail]
          ).catch(() => ({ rows: [] }));

      // Enrich bookings with customer and service data
      const enrichedBookings = await Promise.all(
        result.rows.map(async (booking: any) => {
          const [customer, service] = await Promise.all([
            booking.customer_id
              ? select('customers', { id: booking.customer_id }).catch(() => [])
              : Promise.resolve([]),
            booking.service_id
              ? select('services', { id: booking.service_id }).catch(() => [])
              : Promise.resolve([]),
          ]);

          const serviceSnapToday = await loadBookingServiceSnapshot(booking.vendor_id, booking.service_id);
          const vendorVisibleToday = resolveVendorVisibleBookingAmount(booking, { serviceSnap: serviceSnapToday });
          const catalogServiceName =
            serviceSnapToday?.serviceName ||
            (service.length > 0 ? service[0].name : null) ||
            booking.service_name ||
            'Unknown Service';
          const display = applyVendorBookingDisplayFields(booking, {
            catalogServiceName,
            vendorVisibleAmount: vendorVisibleToday,
          });
          return {
            id: booking.id,
            customer_id: booking.customer_id,
            customerId: booking.customer_id,
            customer_name: customer.length > 0 ? customer[0].full_name : 'Unknown',
            service_name: display.service_name,
            serviceName: display.serviceName,
            booking_date: booking.booking_date,
            booking_time: booking.booking_time,
            status: booking.status,
            total_amount: display.total_amount,
            totalAmount: display.totalAmount,
            price: display.price,
            base_price: display.base_price,
            basePrice: display.basePrice,
            service_style: booking.service_style || 'at_clinic',
            service_type: booking.service_type,
            commerce_mode: display.commerce_mode,
            commerceMode: display.commerceMode,
            // Track rescheduled bookings: true if booking was rescheduled (has rescheduled_at timestamp)
            // Explicitly check if rescheduled_at exists and is not null/empty
            isRescheduled: Boolean(booking.rescheduled_at),
            rescheduledAt: booking.rescheduled_at || null,
          };
        })
      );

      return c.json({
        success: true,
        bookings: enrichedBookings,
      });
    } catch (error: any) {
      console.error('Error fetching today\'s bookings:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}
