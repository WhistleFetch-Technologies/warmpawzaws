/**
 * ============================================================================
 * LIFECYCLE COMPLETENESS ENDPOINTS
 * ============================================================================
 * 
 * Endpoints for all lifecycle completeness handlers:
 * - Insurance claims
 * - Subscription lifecycle
 * - Adoption approval
 * - Post-service payment
 * - Package milestones
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { Hono } from "jsr:@hono/hono@^4.0.0";
import { sendSuccess, sendError } from "./response-utils.tsx";

const app = new Hono();

// ============================================================================
// INSURANCE CLAIMS
// ============================================================================

/**
 * POST /make-server-3dd53475/insurance/claims/submit
 * Submit insurance claim
 */
app.post("/make-server-3dd53475/insurance/claims/submit", async (c) => {
  try {
    const { bookingId, ...claimData } = await c.req.json();
    const { submitInsuranceClaim } = await import("../../lib/services/insurance-claim-handlers.ts");
    const claim = await submitInsuranceClaim(bookingId, claimData);
    return sendSuccess(c, { claim }, "Claim submitted successfully");
  } catch (error) {
    console.error("[Insurance] Error submitting claim:", error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /make-server-3dd53475/insurance/claims/:claimId/process
 * Process insurance claim (approve/reject)
 */
app.post("/make-server-3dd53475/insurance/claims/:claimId/process", async (c) => {
  try {
    const { claimId } = c.req.param();
    const { action, reviewedBy, approvedAmount, rejectionReason } = await c.req.json();
    const { processInsuranceClaim } = await import("../../lib/services/insurance-claim-handlers.ts");
    const claim = await processInsuranceClaim(claimId, action, reviewedBy, approvedAmount, rejectionReason);
    return sendSuccess(c, { claim }, `Claim ${action}d successfully`);
  } catch (error) {
    console.error("[Insurance] Error processing claim:", error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /make-server-3dd53475/insurance/claims/:claimId/complete
 * Complete insurance claim (payout)
 */
app.post("/make-server-3dd53475/insurance/claims/:claimId/complete", async (c) => {
  try {
    const { claimId } = c.req.param();
    const { completeInsuranceClaim } = await import("../../lib/services/insurance-claim-handlers.ts");
    const claim = await completeInsuranceClaim(claimId);
    return sendSuccess(c, { claim }, "Claim processed and payout completed");
  } catch (error) {
    console.error("[Insurance] Error completing claim:", error);
    return sendError(c, error, 500);
  }
});

/**
 * GET /make-server-3dd53475/insurance/claims/booking/:bookingId
 * Get claims for booking
 */
app.get("/make-server-3dd53475/insurance/claims/booking/:bookingId", async (c) => {
  try {
    const { bookingId } = c.req.param();
    const { getBookingClaims } = await import("../../lib/services/insurance-claim-handlers.ts");
    const claims = await getBookingClaims(bookingId);
    return sendSuccess(c, { claims }, "Claims retrieved successfully");
  } catch (error) {
    console.error("[Insurance] Error fetching claims:", error);
    return sendError(c, error, 500);
  }
});

// ============================================================================
// SUBSCRIPTIONS
// ============================================================================

/**
 * POST /make-server-3dd53475/subscriptions/create
 * Create subscription from booking
 */
app.post("/make-server-3dd53475/subscriptions/create", async (c) => {
  try {
    const { bookingId, ...subscriptionData } = await c.req.json();
    const { createSubscription } = await import("../../lib/services/subscription-lifecycle.ts");
    const subscription = await createSubscription(bookingId, subscriptionData);
    return sendSuccess(c, { subscription }, "Subscription created successfully");
  } catch (error) {
    console.error("[Subscription] Error creating subscription:", error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /make-server-3dd53475/subscriptions/:subscriptionId/pause
 * Pause subscription
 */
app.post("/make-server-3dd53475/subscriptions/:subscriptionId/pause", async (c) => {
  try {
    const { subscriptionId } = c.req.param();
    const { reason } = await c.req.json();
    const { pauseSubscription } = await import("../../lib/services/subscription-lifecycle.ts");
    const subscription = await pauseSubscription(subscriptionId, reason);
    return sendSuccess(c, { subscription }, "Subscription paused");
  } catch (error) {
    console.error("[Subscription] Error pausing subscription:", error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /make-server-3dd53475/subscriptions/:subscriptionId/resume
 * Resume subscription
 */
app.post("/make-server-3dd53475/subscriptions/:subscriptionId/resume", async (c) => {
  try {
    const { subscriptionId } = c.req.param();
    const { resumeSubscription } = await import("../../lib/services/subscription-lifecycle.ts");
    const subscription = await resumeSubscription(subscriptionId);
    return sendSuccess(c, { subscription }, "Subscription resumed");
  } catch (error) {
    console.error("[Subscription] Error resuming subscription:", error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /make-server-3dd53475/subscriptions/:subscriptionId/cancel
 * Cancel subscription
 */
app.post("/make-server-3dd53475/subscriptions/:subscriptionId/cancel", async (c) => {
  try {
    const { subscriptionId } = c.req.param();
    const { cancelledBy } = await c.req.json();
    const { cancelSubscription } = await import("../../lib/services/subscription-lifecycle.ts");
    const subscription = await cancelSubscription(subscriptionId, cancelledBy);
    return sendSuccess(c, { subscription }, "Subscription cancelled");
  } catch (error) {
    console.error("[Subscription] Error cancelling subscription:", error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /make-server-3dd53475/subscriptions/:subscriptionId/renew
 * Process subscription renewal
 */
app.post("/make-server-3dd53475/subscriptions/:subscriptionId/renew", async (c) => {
  try {
    const { subscriptionId } = c.req.param();
    const { processSubscriptionRenewal } = await import("../../lib/services/subscription-lifecycle.ts");
    const result = await processSubscriptionRenewal(subscriptionId);
    return sendSuccess(c, result, result.success ? "Renewal processed" : "Renewal failed");
  } catch (error) {
    console.error("[Subscription] Error processing renewal:", error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /make-server-3dd53475/subscriptions/process-renewals
 * Process all pending renewals
 */
app.post("/make-server-3dd53475/subscriptions/process-renewals", async (c) => {
  try {
    const { processPendingRenewals } = await import("../../lib/services/subscription-lifecycle.ts");
    const stats = await processPendingRenewals();
    return sendSuccess(c, stats, "Renewals processed");
  } catch (error) {
    console.error("[Subscription] Error processing renewals:", error);
    return sendError(c, error, 500);
  }
});

// ============================================================================
// ADOPTION
// ============================================================================

/**
 * POST /make-server-3dd53475/adoption/applications/create
 * Create adoption application
 */
app.post("/make-server-3dd53475/adoption/applications/create", async (c) => {
  try {
    const { bookingId, ...applicationData } = await c.req.json();
    const { createAdoptionApplication } = await import("../../lib/services/adoption-approval.ts");
    const application = await createAdoptionApplication(bookingId, applicationData);
    return sendSuccess(c, { application }, "Adoption application created");
  } catch (error) {
    console.error("[Adoption] Error creating application:", error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /make-server-3dd53475/adoption/applications/:applicationId/approve
 * Approve adoption application
 */
app.post("/make-server-3dd53475/adoption/applications/:applicationId/approve", async (c) => {
  try {
    const { applicationId } = c.req.param();
    const { reviewedBy, approvalReason } = await c.req.json();
    const { approveAdoption } = await import("../../lib/services/adoption-approval.ts");
    const application = await approveAdoption(applicationId, reviewedBy, approvalReason);
    return sendSuccess(c, { application }, "Adoption approved");
  } catch (error) {
    console.error("[Adoption] Error approving adoption:", error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /make-server-3dd53475/adoption/applications/:applicationId/reject
 * Reject adoption application
 */
app.post("/make-server-3dd53475/adoption/applications/:applicationId/reject", async (c) => {
  try {
    const { applicationId } = c.req.param();
    const { reviewedBy, rejectionReason } = await c.req.json();
    const { rejectAdoption } = await import("../../lib/services/adoption-approval.ts");
    const application = await rejectAdoption(applicationId, reviewedBy, rejectionReason);
    return sendSuccess(c, { application }, "Adoption rejected");
  } catch (error) {
    console.error("[Adoption] Error rejecting adoption:", error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /make-server-3dd53475/adoption/applications/:applicationId/complete
 * Complete adoption
 */
app.post("/make-server-3dd53475/adoption/applications/:applicationId/complete", async (c) => {
  try {
    const { applicationId } = c.req.param();
    const { completeAdoption } = await import("../../lib/services/adoption-approval.ts");
    const application = await completeAdoption(applicationId);
    return sendSuccess(c, { application }, "Adoption completed");
  } catch (error) {
    console.error("[Adoption] Error completing adoption:", error);
    return sendError(c, error, 500);
  }
});

/**
 * GET /make-server-3dd53475/adoption/applications/booking/:bookingId
 * Get adoption application for booking
 */
app.get("/make-server-3dd53475/adoption/applications/booking/:bookingId", async (c) => {
  try {
    const { bookingId } = c.req.param();
    const { getBookingAdoptionApplication } = await import("../../lib/services/adoption-approval.ts");
    const application = await getBookingAdoptionApplication(bookingId);
    return sendSuccess(c, { application }, "Application retrieved");
  } catch (error) {
    console.error("[Adoption] Error fetching application:", error);
    return sendError(c, error, 500);
  }
});

// ============================================================================
// POST-SERVICE PAYMENT
// ============================================================================

/**
 * POST /make-server-3dd53475/payments/post-service/create
 * Create post-service payment for emergency
 */
app.post("/make-server-3dd53475/payments/post-service/create", async (c) => {
  try {
    const { bookingId, amount, dueDate } = await c.req.json();
    const { createPostServicePayment } = await import("../../lib/services/post-service-payment.ts");
    const payment = await createPostServicePayment(bookingId, amount, dueDate);
    return sendSuccess(c, { payment }, "Post-service payment created");
  } catch (error) {
    console.error("[PostServicePayment] Error creating payment:", error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /make-server-3dd53475/payments/post-service/:paymentId/process
 * Process post-service payment
 */
app.post("/make-server-3dd53475/payments/post-service/:paymentId/process", async (c) => {
  try {
    const { paymentId } = c.req.param();
    const { paymentMethod, transactionId } = await c.req.json();
    const { processPostServicePayment } = await import("../../lib/services/post-service-payment.ts");
    const payment = await processPostServicePayment(paymentId, paymentMethod, transactionId);
    return sendSuccess(c, { payment }, "Payment processed");
  } catch (error) {
    console.error("[PostServicePayment] Error processing payment:", error);
    return sendError(c, error, 500);
  }
});

/**
 * GET /make-server-3dd53475/payments/post-service/booking/:bookingId
 * Get post-service payment for booking
 */
app.get("/make-server-3dd53475/payments/post-service/booking/:bookingId", async (c) => {
  try {
    const { bookingId } = c.req.param();
    const { getBookingPostServicePayment } = await import("../../lib/services/post-service-payment.ts");
    const payment = await getBookingPostServicePayment(bookingId);
    return sendSuccess(c, { payment }, "Payment retrieved");
  } catch (error) {
    console.error("[PostServicePayment] Error fetching payment:", error);
    return sendError(c, error, 500);
  }
});

// ============================================================================
// PACKAGE MILESTONES
// ============================================================================

/**
 * POST /make-server-3dd53475/packages/:bookingId/milestones/create
 * Create milestones for package
 */
app.post("/make-server-3dd53475/packages/:bookingId/milestones/create", async (c) => {
  try {
    const { bookingId } = c.req.param();
    const milestoneConfig = await c.req.json();
    const { createPackageMilestones } = await import("../../lib/services/package-milestone-tracking.ts");
    const milestones = await createPackageMilestones(bookingId, milestoneConfig);
    return sendSuccess(c, { milestones }, "Milestones created");
  } catch (error) {
    console.error("[PackageMilestones] Error creating milestones:", error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /make-server-3dd53475/packages/milestones/:milestoneId/complete
 * Complete milestone
 */
app.post("/make-server-3dd53475/packages/milestones/:milestoneId/complete", async (c) => {
  try {
    const { milestoneId } = c.req.param();
    const { completedBy, notes } = await c.req.json();
    const { completeMilestone } = await import("../../lib/services/package-milestone-tracking.ts");
    const milestone = await completeMilestone(milestoneId, completedBy, notes);
    return sendSuccess(c, { milestone }, "Milestone completed");
  } catch (error) {
    console.error("[PackageMilestones] Error completing milestone:", error);
    return sendError(c, error, 500);
  }
});

/**
 * GET /make-server-3dd53475/packages/:bookingId/milestones
 * Get milestones for booking
 */
app.get("/make-server-3dd53475/packages/:bookingId/milestones", async (c) => {
  try {
    const { bookingId } = c.req.param();
    const { getBookingMilestones } = await import("../../lib/services/package-milestone-tracking.ts");
    const milestones = await getBookingMilestones(bookingId);
    return sendSuccess(c, { milestones }, "Milestones retrieved");
  } catch (error) {
    console.error("[PackageMilestones] Error fetching milestones:", error);
    return sendError(c, error, 500);
  }
});

/**
 * GET /make-server-3dd53475/packages/:bookingId/milestones/next
 * Get next pending milestone
 */
app.get("/make-server-3dd53475/packages/:bookingId/milestones/next", async (c) => {
  try {
    const { bookingId } = c.req.param();
    const { getNextPendingMilestone } = await import("../../lib/services/package-milestone-tracking.ts");
    const milestone = await getNextPendingMilestone(bookingId);
    return sendSuccess(c, { milestone }, "Next milestone retrieved");
  } catch (error) {
    console.error("[PackageMilestones] Error fetching next milestone:", error);
    return sendError(c, error, 500);
  }
});

export default app;

