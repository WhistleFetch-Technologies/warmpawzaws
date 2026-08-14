/**
 * ============================================================================
 * CUSTOMER APPOINTMENTS ENDPOINTS
 * ============================================================================
 * 
 * Handles customer appointment management:
 * - List appointments
 * - Get appointment details
 * - Reschedule appointments
 * - Cancel appointments
 * 
 * Date: 2026-01-07
 * ============================================================================
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { BaseHandler, HandlerContext, HandlerResponse } from '../../../../handler/base-handler';
import {
  previewCustomerCancellationRefundByMethod,
  normalizeCustomerCancellationRefundMethod,
} from '../../../../lib/services/cancellation-policy-service';
import { hasCustomerPaidCapture } from '../../../../lib/services/refundable-base';
import { computeHoursUntilBookingStart } from '../../../../lib/utils/booking-start-wall-time';
import { creditCustomerWalletForBookingRefund } from '../../../../utils/credit-customer-wallet';
import { SlotConflictError, SLOT_CONFLICT_MESSAGE } from '../../../../utils/slot-occupancy';
import * as appointment_base_handlersRepo from '../repos/appointment-base-handlers.repo';
import { mapAppointmentRowForCustomer } from './map-appointment-row-for-customer.service';

// ============================================================================
// GET /customer/appointments - List all appointments for customer
// ============================================================================

export class GetCustomerAppointmentsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      // Extract customer ID from event path or user context
      const customerId = context.event.pathParameters?.customerId || 
                        context.event.queryStringParameters?.customerId ||
                        context.userId;

      console.log('[appointments] list customerId:', customerId ?? '(none)', 'appointmentId:', '(n/a)');
      
      if (!customerId) {
        return this.success({ appointments: [], count: 0, message: 'No booking' });
      }

      // Bookings are the source of truth (RDS has no legacy `appointments` table in many envs).
      // `bookings.service_id` references `vendor_services.id`; vendors use `business_name`, not `name`.
      const appointments = await appointment_base_handlersRepo.dbAppointmentBaseHandlers0(customerId).catch((err) => {
        console.warn('[appointments] list query failed:', err);
        return { rows: [] as Record<string, unknown>[] };
      });

      const rows = appointments.rows;
      if (rows.length === 0) {
        return this.success({ appointments: [], count: 0, message: 'No booking' });
      }
      const mapped = rows.map((row) =>
        mapAppointmentRowForCustomer(row as Record<string, unknown>),
      );
      return this.success({
        appointments: mapped,
        count: mapped.length,
      });
    } catch (error: any) {
      console.warn('[appointments] list handler error (returning empty):', error);
      return this.success({ appointments: [], count: 0, message: 'No booking' });
    }
  }
}

// ============================================================================
// GET /customer/appointments/:id - Get appointment details
// ============================================================================

export class GetAppointmentDetailsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const rawAppointmentId = context.event.pathParameters?.id;
      const rawCustomerId =
        context.event.pathParameters?.customerId ||
        (context.event.queryStringParameters as Record<string, string> | undefined)?.customerId ||
        context.userId;

      const appointmentId =
        typeof rawAppointmentId === 'string' ? rawAppointmentId.trim() : rawAppointmentId;
      const customerId = typeof rawCustomerId === 'string' ? rawCustomerId.trim() : rawCustomerId;

      console.log('[appointments] detail customerId:', customerId ?? '(none)', 'appointmentId:', appointmentId ?? '(none)');

      if (
        !appointmentId ||
        !customerId ||
        appointmentId === 'undefined' ||
        customerId === 'undefined'
      ) {
        return this.error('Appointment not found', 404);
      }

      // Treat :id as booking id (same id returned by the list endpoint above).
      const appointment = await appointment_base_handlersRepo.dbAppointmentBaseHandlers1(appointmentId, customerId).catch((err) => {
        console.warn('[appointments] detail main query failed:', (err as Error)?.message || err);
        return { rows: [] as Record<string, unknown>[] };
      });

      if (appointment.rows.length === 0) {
        return this.error('Appointment not found', 404);
      }

      const bookingId = appointment.rows[0].booking_id ?? appointment.rows[0].id;

      const prescriptions = await appointment_base_handlersRepo.dbAppointmentBaseHandlers2(bookingId).catch((err) => {
        console.warn('[appointments] optional prescriptions query failed:', err);
        return { rows: [] as unknown[] };
      });

      const medicalRecords = await appointment_base_handlersRepo.dbAppointmentBaseHandlers3(bookingId).catch((err) => {
        console.warn('[appointments] optional medical_records query failed:', err);
        return { rows: [] as unknown[] };
      });

      const appointmentHistory = await appointment_base_handlersRepo.dbAppointmentBaseHandlers4(bookingId).catch((err) => {
        console.warn('[appointments] optional appointment_history query failed:', err);
        return { rows: [] as unknown[] };
      });

      try {
        const mappedAppointment = mapAppointmentRowForCustomer(
          appointment.rows[0] as Record<string, unknown>,
        );
        return this.success({
          appointment: mappedAppointment,
          prescriptions: prescriptions.rows,
          medicalRecords: medicalRecords.rows,
          appointmentHistory: appointmentHistory.rows,
        });
      } catch (serializeErr: any) {
        console.warn('[appointments] detail response build failed (treating as not found):', serializeErr);
        return this.error('Appointment not found', 404);
      }
    } catch (error: any) {
      console.warn('[appointments] detail handler error:', error);
      return this.error('Appointment not found', 404);
    }
  }
}

// ============================================================================
// POST /customer/appointments/:id/reschedule - Reschedule appointment
// ============================================================================

export class RescheduleAppointmentHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const appointmentId = context.event.pathParameters?.id;
      const customerId =
        context.event.pathParameters?.customerId ||
        (context.event.queryStringParameters as Record<string, string> | undefined)?.customerId ||
        context.userId;
      const body = this.parseBody(context.event);
      const { appointment_date, appointment_time, reason } = body || {};

      if (!appointmentId) {
        return this.error('Appointment ID is required', 400);
      }

      if (!appointment_date || !appointment_time) {
        return this.error('Appointment date and time are required', 400);
      }

      if (!customerId) {
        return this.error('Customer ID is required', 401);
      }

      const appointmentResult = await appointment_base_handlersRepo.dbAppointmentBaseHandlers5(appointmentId, customerId).catch((err) => {
        console.warn('[appointments] reschedule lookup failed:', err);
        return { rows: [] as Record<string, unknown>[] };
      });

      if (appointmentResult.rows.length === 0) {
        return this.error('Appointment not found', 404);
      }

      const bookingStatus = String(appointmentResult.rows[0].booking_status || '');
      if (!['confirmed', 'pending'].includes(bookingStatus)) {
        return this.error('Appointment cannot be rescheduled in current status', 400);
      }

      const current = appointmentResult.rows[0] as {
        vendor_id?: string;
        staff_id?: string | null;
        booking_date?: string;
        duration_minutes?: number;
        total_duration_minutes?: number;
      };

      let updated: { rows: Record<string, unknown>[] };
      try {
        updated = await appointment_base_handlersRepo.dbAppointmentBaseHandlers6(
          appointment_date,
          appointment_time,
          reason || 'No reason provided',
          appointmentId,
          customerId,
          current
        );
      } catch (err: any) {
        if (err instanceof SlotConflictError || err?.code === 'SLOT_CONFLICT') {
          return this.error(SLOT_CONFLICT_MESSAGE, 409);
        }
        console.warn('[appointments] reschedule update failed:', err);
        return this.error('Appointment not found', 404);
      }

      if (updated.rows.length === 0) {
        return this.error('Appointment not found', 404);
      }

      await appointment_base_handlersRepo.dbAppointmentBaseHandlers7(
        appointmentId,
        appointmentResult.rows[0].booking_date,
        appointmentResult.rows[0].booking_time,
        appointment_date,
        appointment_time,
        reason || 'No reason provided'
      ).catch((histErr) => console.warn('[appointments] appointment_history insert skipped:', histErr));

      const row = updated.rows[0];
      return this.success({
        appointment: {
          ...row,
          appointment_date: row.booking_date,
          appointment_time: row.booking_time,
        },
        message: 'Appointment rescheduled successfully',
      });
    } catch (error: any) {
      console.warn('[appointments] reschedule handler error:', error);
      return this.error('Appointment not found', 404);
    }
  }
}

// ============================================================================
// POST /customer/appointments/:id/cancel - Cancel appointment
// ============================================================================

export class CancelAppointmentHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const appointmentId = context.event.pathParameters?.id;
      const customerId =
        context.event.pathParameters?.customerId ||
        (context.event.queryStringParameters as Record<string, string> | undefined)?.customerId ||
        context.userId;
      const body = this.parseBody(context.event);
      const { reason, refundMethod = 'wallet' } = body || {};

      if (!appointmentId) {
        return this.error('Appointment ID is required', 400);
      }

      if (!customerId) {
        return this.error('Customer ID is required', 401);
      }

      const appointment = await appointment_base_handlersRepo.dbAppointmentBaseHandlers8(appointmentId, customerId).catch((err) => {
        console.warn('[appointments] cancel lookup failed:', err);
        return { rows: [] as Record<string, unknown>[] };
      });

      if (appointment.rows.length === 0) {
        return this.error('Appointment not found', 404);
      }

      const bookingRow = appointment.rows[0];
      if (String(bookingRow.status || '') === 'cancelled') {
        return this.error('Appointment is already cancelled', 400);
      }

      const bookingId = bookingRow.booking_id ?? bookingRow.id;

      // Same wall-clock semantics as booking cancel + refund preview (vendor_timezone + date + time).
      const hoursUntilStart = computeHoursUntilBookingStart({
        booking_date: bookingRow.booking_date,
        booking_time: String(bookingRow.booking_time ?? ''),
        vendor_timezone: (bookingRow as any).vendor_timezone ?? null,
        booking_datetime: (bookingRow as any).booking_datetime ?? null,
        scheduled_at: (bookingRow as any).scheduled_at ?? null,
      });
      if (Number.isFinite(hoursUntilStart) && hoursUntilStart < 0) {
        return this.error('Cannot cancel past appointments', 400);
      }

      const updated = await appointment_base_handlersRepo.dbAppointmentBaseHandlers9(reason || 'No reason provided', bookingId).catch((err) => {
        console.warn('[appointments] cancel update failed:', err);
        return { rows: [] as Record<string, unknown>[] };
      });

      if (updated.rows.length === 0) {
        return this.error('Appointment not found', 404);
      }

      // Apply refund per policy (vendor_refund_tiers by who cancels)
      let refundInfo: { amount: number; percentage: number; method: string; status: string; message: string } | null = null;
      const bookingPaidForRefund = await hasCustomerPaidCapture(String(bookingId), {
        total_amount: bookingRow.total_amount as number | string | null,
        discount_amount: (bookingRow as any).discount_amount ?? null,
        payment_status: (bookingRow as any).payment_status ?? (bookingRow as any).paymentStatus,
      });
      const customerIdForRefund = String(
        (bookingRow as any).customer_id ?? (bookingRow as any).customerId ?? customerId
      );
      if (bookingPaidForRefund) {
        try {
          const preview = await previewCustomerCancellationRefundByMethod(
            {
              id: bookingId,
              vendor_id: bookingRow.vendor_id,
              service_id: bookingRow.service_id,
              service_type: bookingRow.service_type,
              booking_datetime: (bookingRow as any).booking_datetime ?? null,
              scheduled_at: (bookingRow as any).scheduled_at ?? null,
              booking_date: String(bookingRow.booking_date),
              booking_time: String(bookingRow.booking_time),
              vendor_timezone: (bookingRow as any).vendor_timezone ?? null,
              total_amount: bookingRow.total_amount,
              discount_amount: (bookingRow as any).discount_amount ?? null,
            },
            normalizeCustomerCancellationRefundMethod(refundMethod)
          );
          const refundAmount = Math.round(preview.refundAmount * 100) / 100;
          const refundPercentage = preview.refundPercentage;
          if (refundAmount > 0) {
            const payments = await appointment_base_handlersRepo.dbAppointmentBaseHandlers10(bookingId).catch(() => ({ rows: [] }));
            const paymentId = (payments as any).rows?.[0]?.id;
            if (refundMethod === 'wallet') {
              try {
                await creditCustomerWalletForBookingRefund({
                  customerId: customerIdForRefund,
                  bookingId,
                  refundAmount,
                  refundPercentage,
                  label: 'appointment',
                });
                refundInfo = {
                  amount: refundAmount,
                  percentage: refundPercentage,
                  method: 'wallet',
                  status: 'completed',
                  message: `₹${refundAmount.toFixed(2)} credited to wallet`,
                };
              } catch (e) {
                console.error('[appointments] wallet credit failed:', e);
                refundInfo = {
                  amount: refundAmount,
                  percentage: refundPercentage,
                  method: 'wallet',
                  status: 'failed',
                  message:
                    'Cancellation succeeded but wallet refund failed. Please contact support with your appointment ID.',
                };
              }
            } else if (refundMethod === 'original' || String(refundMethod).toLowerCase() === 'original') {
              try {
                const { processBookingOriginalPaymentRefund } = await import(
                  '../../../utils/payments/booking-original-refund'
                );
                const originalResult = await processBookingOriginalPaymentRefund({
                  bookingId: String(bookingId),
                  customerId: customerIdForRefund,
                  vendorId: bookingRow.vendor_id ? String(bookingRow.vendor_id) : null,
                  refundAmount,
                  refundPercentage,
                  reason: `Appointment cancellation: ${reason || 'No reason'} (${refundPercentage}% refund)`,
                  initiatedBy: 'customer',
                  label: 'appointment',
                });
                refundInfo = {
                  amount: originalResult.totalAmount,
                  percentage: refundPercentage,
                  method: 'original',
                  status: originalResult.status === 'completed' ? 'completed' : 'processing',
                  message: originalResult.message,
                };
              } catch (e) {
                console.error('[appointments] original refund failed:', e);
                refundInfo = {
                  amount: refundAmount,
                  percentage: refundPercentage,
                  method: 'original',
                  status: 'failed',
                  message:
                    'Cancellation succeeded but refund to original payment method failed. Please contact support with your appointment ID.',
                };
              }
            }
          }
        } catch (refundErr: any) {
          console.error('Error applying refund on appointment cancel:', refundErr);
        }
      }

      await appointment_base_handlersRepo.dbAppointmentBaseHandlers11(appointmentId, reason || 'No reason provided').catch((histErr) => console.warn('[appointments] appointment_history insert skipped:', histErr));

      const cancelledRow = updated.rows[0];
      return this.success({
        appointment: {
          ...cancelledRow,
          appointment_date: cancelledRow.booking_date,
          appointment_time: cancelledRow.booking_time,
        },
        message: 'Appointment cancelled successfully',
        refund: refundInfo ?? undefined,
      });
    } catch (error: any) {
      console.warn('[appointments] cancel handler error:', error?.message || error);
      return this.error(
        typeof error?.message === 'string' && error.message.trim()
          ? error.message.trim()
          : 'Failed to cancel appointment',
        500
      );
    }
  }
}

// ============================================================================
