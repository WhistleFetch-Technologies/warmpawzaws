/**
 * ============================================================================
 * AUTOMATION ENDPOINTS
 * ============================================================================
 * 
 * Endpoints for automation services:
 * - Booking status transitions
 * - Payment retry
 * - Payout processing
 * - Delivery automation
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { Hono } from "jsr:@hono/hono@^4.0.0";
import { sendSuccess, sendError } from "./response-utils.tsx";

const app = new Hono();

// ============================================================================
// BOOKING AUTOMATION
// ============================================================================

/**
 * POST /make-server-3dd53475/automation/bookings/process-transitions
 * Process automatic booking status transitions
 */
app.post("/make-server-3dd53475/automation/bookings/process-transitions", async (c) => {
  try {
    const { processAutomaticStatusTransitions } = await import("../../lib/services/booking-automation.ts");
    await processAutomaticStatusTransitions();
    return sendSuccess(c, {}, "Status transitions processed successfully");
  } catch (error) {
    console.error("[Automation] Error processing status transitions:", error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /make-server-3dd53475/automation/bookings/auto-confirm
 * Auto-confirm pending bookings
 */
app.post("/make-server-3dd53475/automation/bookings/auto-confirm", async (c) => {
  try {
    const { autoConfirmPendingBookings } = await import("../../lib/services/booking-automation.ts");
    await autoConfirmPendingBookings();
    return sendSuccess(c, {}, "Pending bookings auto-confirmed");
  } catch (error) {
    console.error("[Automation] Error auto-confirming bookings:", error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /make-server-3dd53475/automation/bookings/auto-complete
 * Auto-complete in-progress bookings
 */
app.post("/make-server-3dd53475/automation/bookings/auto-complete", async (c) => {
  try {
    const { autoCompleteInProgressBookings } = await import("../../lib/services/booking-automation.ts");
    await autoCompleteInProgressBookings();
    return sendSuccess(c, {}, "In-progress bookings auto-completed");
  } catch (error) {
    console.error("[Automation] Error auto-completing bookings:", error);
    return sendError(c, error, 500);
  }
});

// ============================================================================
// PAYMENT RETRY
// ============================================================================

/**
 * POST /make-server-3dd53475/automation/payments/retry/:paymentId
 * Retry a failed payment
 */
app.post("/make-server-3dd53475/automation/payments/retry/:paymentId", async (c) => {
  try {
    const { paymentId } = c.req.param();
    const { retryPayment } = await import("../../lib/services/payment-retry.ts");
    const result = await retryPayment(paymentId);
    return sendSuccess(c, result, result.success ? "Payment retry successful" : "Payment retry failed");
  } catch (error) {
    console.error("[Automation] Error retrying payment:", error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /make-server-3dd53475/automation/payments/process-retries
 * Process pending payment retries
 */
app.post("/make-server-3dd53475/automation/payments/process-retries", async (c) => {
  try {
    const { processPendingPaymentRetries } = await import("../../lib/services/payment-retry.ts");
    await processPendingPaymentRetries();
    return sendSuccess(c, {}, "Payment retries processed");
  } catch (error) {
    console.error("[Automation] Error processing payment retries:", error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /make-server-3dd53475/automation/payments/auto-cancel
 * Auto-cancel bookings with failed payments
 */
app.post("/make-server-3dd53475/automation/payments/auto-cancel", async (c) => {
  try {
    const { autoCancelFailedPayments } = await import("../../lib/services/payment-retry.ts");
    await autoCancelFailedPayments();
    return sendSuccess(c, {}, "Failed payments auto-cancelled");
  } catch (error) {
    console.error("[Automation] Error auto-cancelling failed payments:", error);
    return sendError(c, error, 500);
  }
});

// ============================================================================
// PAYOUT PROCESSING
// ============================================================================

/**
 * POST /make-server-3dd53475/automation/payouts/process
 * Process automatic payouts
 */
app.post("/make-server-3dd53475/automation/payouts/process", async (c) => {
  try {
    const { processAutomaticPayouts } = await import("../../lib/services/payout-processing.ts");
    const stats = await processAutomaticPayouts();
    return sendSuccess(c, stats, "Payouts processed successfully");
  } catch (error) {
    console.error("[Automation] Error processing payouts:", error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /make-server-3dd53475/automation/payouts/schedule
 * Schedule automatic payouts from settlements
 */
app.post("/make-server-3dd53475/automation/payouts/schedule", async (c) => {
  try {
    const { scheduleAutomaticPayouts } = await import("../../lib/services/payout-processing.ts");
    await scheduleAutomaticPayouts();
    return sendSuccess(c, {}, "Payouts scheduled successfully");
  } catch (error) {
    console.error("[Automation] Error scheduling payouts:", error);
    return sendError(c, error, 500);
  }
});

// ============================================================================
// DELIVERY AUTOMATION
// ============================================================================

/**
 * POST /make-server-3dd53475/automation/delivery/create-shipment/:orderId
 * Create shipment for order
 */
app.post("/make-server-3dd53475/automation/delivery/create-shipment/:orderId", async (c) => {
  try {
    const { orderId } = c.req.param();
    const { createShipmentForOrder } = await import("../../lib/services/delivery-automation.ts");
    const shipmentId = await createShipmentForOrder(orderId);
    return sendSuccess(c, { shipmentId }, "Shipment created successfully");
  } catch (error) {
    console.error("[Automation] Error creating shipment:", error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /make-server-3dd53475/automation/delivery/auto-create
 * Auto-create shipments for orders ready to ship
 */
app.post("/make-server-3dd53475/automation/delivery/auto-create", async (c) => {
  try {
    const { autoCreateShipments } = await import("../../lib/services/delivery-automation.ts");
    await autoCreateShipments();
    return sendSuccess(c, {}, "Shipments auto-created");
  } catch (error) {
    console.error("[Automation] Error auto-creating shipments:", error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /make-server-3dd53475/automation/delivery/webhook/:partnerType
 * Process delivery webhook from logistics partner
 */
app.post("/make-server-3dd53475/automation/delivery/webhook/:partnerType", async (c) => {
  try {
    const { partnerType } = c.req.param();
    const webhookData = await c.req.json();
    const { processDeliveryWebhook } = await import("../../lib/services/delivery-automation.ts");
    await processDeliveryWebhook(partnerType, webhookData);
    return sendSuccess(c, {}, "Webhook processed successfully");
  } catch (error) {
    console.error("[Automation] Error processing webhook:", error);
    return sendError(c, error, 500);
  }
});

// ============================================================================
// MULTI-STAFF ASSIGNMENT
// ============================================================================

/**
 * POST /make-server-3dd53475/automation/staff/assign
 * Assign multiple staff to booking
 */
app.post("/make-server-3dd53475/automation/staff/assign", async (c) => {
  try {
    const { bookingId, staffIds, assignmentTypes } = await c.req.json();
    const { assignStaffToBooking } = await import("../../lib/services/multi-staff-assignment.ts");
    const assignments = await assignStaffToBooking(bookingId, staffIds, assignmentTypes);
    return sendSuccess(c, { assignments }, "Staff assigned successfully");
  } catch (error) {
    console.error("[Automation] Error assigning staff:", error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /make-server-3dd53475/automation/staff/accept
 * Accept staff assignment
 */
app.post("/make-server-3dd53475/automation/staff/accept", async (c) => {
  try {
    const { bookingId, staffId } = await c.req.json();
    const { acceptStaffAssignment } = await import("../../lib/services/multi-staff-assignment.ts");
    const assignment = await acceptStaffAssignment(bookingId, staffId);
    return sendSuccess(c, { assignment }, "Assignment accepted");
  } catch (error) {
    console.error("[Automation] Error accepting assignment:", error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /make-server-3dd53475/automation/staff/reject
 * Reject staff assignment
 */
app.post("/make-server-3dd53475/automation/staff/reject", async (c) => {
  try {
    const { bookingId, staffId, reason } = await c.req.json();
    const { rejectStaffAssignment } = await import("../../lib/services/multi-staff-assignment.ts");
    const assignment = await rejectStaffAssignment(bookingId, staffId, reason);
    return sendSuccess(c, { assignment }, "Assignment rejected");
  } catch (error) {
    console.error("[Automation] Error rejecting assignment:", error);
    return sendError(c, error, 500);
  }
});

export default app;

