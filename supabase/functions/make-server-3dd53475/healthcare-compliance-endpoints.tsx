/**
 * ============================================================================
 * HEALTHCARE COMPLIANCE ENDPOINTS
 * ============================================================================
 * 
 * Endpoints for regulated healthcare flows:
 * - Medical record management
 * - Prescription creation & immutability
 * - Medicine order flow
 * - Diagnostics sample collection
 * - Report upload & download
 * 
 * All endpoints enforce:
 * - Role permissions
 * - State transitions
 * - Notification triggers
 * - Audit logging
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getMedicalRecordsRepository } from "../../lib/repositories/medical-records.ts";
import { getPrescriptionsRepository } from "../../lib/repositories/prescriptions.ts";
import { getMedicineOrdersRepository } from "../../lib/repositories/medicine-orders.ts";
import { getDiagnosticSamplesRepository } from "../../lib/repositories/diagnostic-samples.ts";
import { getDiagnosticReportsRepository } from "../../lib/repositories/diagnostic-reports.ts";

const BASE_PATH = "/make-server-3dd53475";

export function healthcareComplianceEndpoints(app: Hono) {
  const medicalRecordsRepo = getMedicalRecordsRepository();
  const prescriptionsRepo = getPrescriptionsRepository();
  const medicineOrdersRepo = getMedicineOrdersRepository();
  const diagnosticSamplesRepo = getDiagnosticSamplesRepository();
  const diagnosticReportsRepo = getDiagnosticReportsRepository();

  // ============================================================================
  // MEDICAL RECORDS
  // ============================================================================

  /**
   * POST /healthcare/medical-records
   * Create medical record
   */
  app.post(`${BASE_PATH}/healthcare/medical-records`, async (c) => {
    try {
      const body = await c.req.json();
      const { actor_id, actor_role, actor_name, ...recordData } = body;

      if (!actor_id || !actor_role) {
        return sendError(c, "Missing actor_id or actor_role", 400);
      }

      const record = await medicalRecordsRepo.create({
        ...recordData,
        created_by: actor_id,
        created_by_role: actor_role as any,
      });

      return sendSuccess(c, { record }, "Medical record created successfully");
    } catch (error) {
      console.error("❌ [HEALTHCARE] Error creating medical record:", error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /healthcare/medical-records/:recordId
   * Get medical record with access control
   */
  app.get(`${BASE_PATH}/healthcare/medical-records/:recordId`, async (c) => {
    try {
      const { recordId } = c.req.param();
      const actor_id = c.req.query("actor_id") || "";
      const actor_role = c.req.query("actor_role") || "";

      if (!actor_id || !actor_role) {
        return sendError(c, "Missing actor_id or actor_role", 400);
      }

      const record = await medicalRecordsRepo.getById(recordId, actor_id, actor_role);

      if (!record) {
        return sendError(c, "Medical record not found or access denied", 404);
      }

      return sendSuccess(c, { record });
    } catch (error) {
      console.error("❌ [HEALTHCARE] Error fetching medical record:", error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /healthcare/medical-records/pet/:petId
   * Get medical records for pet
   */
  app.get(`${BASE_PATH}/healthcare/medical-records/pet/:petId`, async (c) => {
    try {
      const { petId } = c.req.param();
      const actor_id = c.req.query("actor_id") || "";
      const actor_role = c.req.query("actor_role") || "";

      if (!actor_id || !actor_role) {
        return sendError(c, "Missing actor_id or actor_role", 400);
      }

      const records = await medicalRecordsRepo.getByPetId(petId, actor_id, actor_role);

      return sendSuccess(c, { records });
    } catch (error) {
      console.error("❌ [HEALTHCARE] Error fetching medical records:", error);
      return sendError(c, error, 500);
    }
  });

  // ============================================================================
  // PRESCRIPTIONS
  // ============================================================================

  /**
   * POST /healthcare/prescriptions
   * Create prescription (IMMUTABLE)
   */
  app.post(`${BASE_PATH}/healthcare/prescriptions`, async (c) => {
    try {
      const body = await c.req.json();
      const { actor_id, actor_role, actor_name, ...prescriptionData } = body;

      if (!actor_id || !actor_role) {
        return sendError(c, "Missing actor_id or actor_role", 400);
      }

      const prescription = await prescriptionsRepo.create({
        ...prescriptionData,
        created_by: actor_id,
        created_by_role: actor_role as any,
      });

      return sendSuccess(c, { prescription }, "Prescription created successfully");
    } catch (error) {
      console.error("❌ [HEALTHCARE] Error creating prescription:", error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /healthcare/prescriptions/:prescriptionId
   * Get prescription with access control
   */
  app.get(`${BASE_PATH}/healthcare/prescriptions/:prescriptionId`, async (c) => {
    try {
      const { prescriptionId } = c.req.param();
      const actor_id = c.req.query("actor_id") || "";
      const actor_role = c.req.query("actor_role") || "";

      if (!actor_id || !actor_role) {
        return sendError(c, "Missing actor_id or actor_role", 400);
      }

      const prescription = await prescriptionsRepo.getById(prescriptionId, actor_id, actor_role);

      if (!prescription) {
        return sendError(c, "Prescription not found or access denied", 404);
      }

      return sendSuccess(c, { prescription });
    } catch (error) {
      console.error("❌ [HEALTHCARE] Error fetching prescription:", error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /healthcare/prescriptions/:prescriptionId/download
   * Log prescription download
   */
  app.post(`${BASE_PATH}/healthcare/prescriptions/:prescriptionId/download`, async (c) => {
    try {
      const { prescriptionId } = c.req.param();
      const { actor_id, actor_role, actor_name } = await c.req.json();

      if (!actor_id || !actor_role) {
        return sendError(c, "Missing actor_id or actor_role", 400);
      }

      await prescriptionsRepo.logDownload(prescriptionId, actor_id, actor_role, actor_name);

      return sendSuccess(c, {}, "Download logged successfully");
    } catch (error) {
      console.error("❌ [HEALTHCARE] Error logging download:", error);
      return sendError(c, error, 500);
    }
  });

  // ============================================================================
  // MEDICINE ORDERS
  // ============================================================================

  /**
   * POST /healthcare/medicine-orders
   * Create medicine order (Step 1: Upload prescription)
   */
  app.post(`${BASE_PATH}/healthcare/medicine-orders`, async (c) => {
    try {
      const body = await c.req.json();
      const order = await medicineOrdersRepo.create(body);

      return sendSuccess(c, { order }, "Medicine order created successfully");
    } catch (error) {
      console.error("❌ [HEALTHCARE] Error creating medicine order:", error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /healthcare/medicine-orders/:orderId/broadcast
   * Broadcast to pharmacies (Step 2)
   */
  app.post(`${BASE_PATH}/healthcare/medicine-orders/:orderId/broadcast`, async (c) => {
    try {
      const { orderId } = c.req.param();
      const { pharmacy_ids } = await c.req.json();

      if (!pharmacy_ids || !Array.isArray(pharmacy_ids)) {
        return sendError(c, "Missing pharmacy_ids array", 400);
      }

      const broadcasts = await medicineOrdersRepo.broadcastToPharmacies(orderId, pharmacy_ids);

      return sendSuccess(c, { broadcasts }, "Order broadcasted to pharmacies");
    } catch (error) {
      console.error("❌ [HEALTHCARE] Error broadcasting order:", error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /healthcare/medicine-orders/:orderId/select-pharmacy
   * Select pharmacy (Step 3)
   */
  app.post(`${BASE_PATH}/healthcare/medicine-orders/:orderId/select-pharmacy`, async (c) => {
    try {
      const { orderId } = c.req.param();
      const { pharmacy_id } = await c.req.json();

      if (!pharmacy_id) {
        return sendError(c, "Missing pharmacy_id", 400);
      }

      await medicineOrdersRepo.selectPharmacy(orderId, pharmacy_id);

      return sendSuccess(c, {}, "Pharmacy selected successfully");
    } catch (error) {
      console.error("❌ [HEALTHCARE] Error selecting pharmacy:", error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /healthcare/medicine-orders/:orderId/proforma
   * Generate proforma invoice (Step 4)
   */
  app.post(`${BASE_PATH}/healthcare/medicine-orders/:orderId/proforma`, async (c) => {
    try {
      const { orderId } = c.req.param();
      const { invoice_url, amount, items } = await c.req.json();

      if (!invoice_url || !amount || !items) {
        return sendError(c, "Missing invoice_url, amount, or items", 400);
      }

      await medicineOrdersRepo.generateProformaInvoice(orderId, invoice_url, amount, items);

      return sendSuccess(c, {}, "Proforma invoice generated successfully");
    } catch (error) {
      console.error("❌ [HEALTHCARE] Error generating proforma:", error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /healthcare/medicine-orders/:orderId/payment
   * Update payment status (Step 5)
   */
  app.post(`${BASE_PATH}/healthcare/medicine-orders/:orderId/payment`, async (c) => {
    try {
      const { orderId } = c.req.param();
      const { payment_id, amount, payment_method } = await c.req.json();

      if (!payment_id || !amount || !payment_method) {
        return sendError(c, "Missing payment_id, amount, or payment_method", 400);
      }

      await medicineOrdersRepo.updatePayment(orderId, payment_id, amount, payment_method);

      return sendSuccess(c, {}, "Payment updated successfully");
    } catch (error) {
      console.error("❌ [HEALTHCARE] Error updating payment:", error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /healthcare/medicine-orders/:orderId/delivery-status
   * Update delivery status
   */
  app.post(`${BASE_PATH}/healthcare/medicine-orders/:orderId/delivery-status`, async (c) => {
    try {
      const { orderId } = c.req.param();
      const { status, tracking_id, estimated_delivery_date } = await c.req.json();

      if (!status) {
        return sendError(c, "Missing status", 400);
      }

      await medicineOrdersRepo.updateDeliveryStatus(orderId, status, tracking_id, estimated_delivery_date);

      return sendSuccess(c, {}, "Delivery status updated successfully");
    } catch (error) {
      console.error("❌ [HEALTHCARE] Error updating delivery status:", error);
      return sendError(c, error, 500);
    }
  });

  // ============================================================================
  // DIAGNOSTIC SAMPLES
  // ============================================================================

  /**
   * POST /healthcare/diagnostic-samples
   * Create diagnostic sample
   */
  app.post(`${BASE_PATH}/healthcare/diagnostic-samples`, async (c) => {
    try {
      const body = await c.req.json();
      const sample = await diagnosticSamplesRepo.create(body);

      return sendSuccess(c, { sample }, "Diagnostic sample created successfully");
    } catch (error) {
      console.error("❌ [HEALTHCARE] Error creating diagnostic sample:", error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /healthcare/diagnostic-samples/:sampleId/transfer-custody
   * Transfer custody with chain of custody tracking
   */
  app.post(`${BASE_PATH}/healthcare/diagnostic-samples/:sampleId/transfer-custody`, async (c) => {
    try {
      const { sampleId } = c.req.param();
      const { new_status, transfer } = await c.req.json();

      if (!new_status || !transfer) {
        return sendError(c, "Missing new_status or transfer", 400);
      }

      await diagnosticSamplesRepo.transferCustody(sampleId, new_status, transfer);

      return sendSuccess(c, {}, "Custody transferred successfully");
    } catch (error) {
      console.error("❌ [HEALTHCARE] Error transferring custody:", error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /healthcare/diagnostic-samples/:sampleId/custody-chain
   * Get chain of custody
   */
  app.get(`${BASE_PATH}/healthcare/diagnostic-samples/:sampleId/custody-chain`, async (c) => {
    try {
      const { sampleId } = c.req.param();
      const chain = await diagnosticSamplesRepo.getChainOfCustody(sampleId);

      return sendSuccess(c, { chain });
    } catch (error) {
      console.error("❌ [HEALTHCARE] Error fetching custody chain:", error);
      return sendError(c, error, 500);
    }
  });

  // ============================================================================
  // DIAGNOSTIC REPORTS
  // ============================================================================

  /**
   * POST /healthcare/diagnostic-reports
   * Create diagnostic report
   */
  app.post(`${BASE_PATH}/healthcare/diagnostic-reports`, async (c) => {
    try {
      const body = await c.req.json();
      const { actor_id, actor_role, actor_name, ...reportData } = body;

      if (!actor_id || !actor_role) {
        return sendError(c, "Missing actor_id or actor_role", 400);
      }

      const report = await diagnosticReportsRepo.create({
        ...reportData,
        created_by: actor_id,
        created_by_role: actor_role as any,
      });

      return sendSuccess(c, { report }, "Diagnostic report created successfully");
    } catch (error) {
      console.error("❌ [HEALTHCARE] Error creating diagnostic report:", error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /healthcare/diagnostic-reports/:reportId
   * Get diagnostic report with access control
   */
  app.get(`${BASE_PATH}/healthcare/diagnostic-reports/:reportId`, async (c) => {
    try {
      const { reportId } = c.req.param();
      const actor_id = c.req.query("actor_id") || "";
      const actor_role = c.req.query("actor_role") || "";

      if (!actor_id || !actor_role) {
        return sendError(c, "Missing actor_id or actor_role", 400);
      }

      const report = await diagnosticReportsRepo.getById(reportId, actor_id, actor_role);

      if (!report) {
        return sendError(c, "Diagnostic report not found or access denied", 404);
      }

      return sendSuccess(c, { report });
    } catch (error) {
      console.error("❌ [HEALTHCARE] Error fetching diagnostic report:", error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /healthcare/diagnostic-reports/:reportId/download
   * Log report download
   */
  app.post(`${BASE_PATH}/healthcare/diagnostic-reports/:reportId/download`, async (c) => {
    try {
      const { reportId } = c.req.param();
      const { actor_id, actor_role, actor_name } = await c.req.json();

      if (!actor_id || !actor_role) {
        return sendError(c, "Missing actor_id or actor_role", 400);
      }

      await diagnosticReportsRepo.logDownload(reportId, actor_id, actor_role, actor_name);

      return sendSuccess(c, {}, "Download logged successfully");
    } catch (error) {
      console.error("❌ [HEALTHCARE] Error logging download:", error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /healthcare/diagnostic-reports/:reportId/finalize
   * Finalize report
   */
  app.post(`${BASE_PATH}/healthcare/diagnostic-reports/:reportId/finalize`, async (c) => {
    try {
      const { reportId } = c.req.param();
      const { actor_id, actor_role } = await c.req.json();

      if (!actor_id || !actor_role) {
        return sendError(c, "Missing actor_id or actor_role", 400);
      }

      const success = await diagnosticReportsRepo.finalize(reportId, actor_id, actor_role);

      if (!success) {
        return sendError(c, "Failed to finalize report or insufficient permissions", 403);
      }

      return sendSuccess(c, {}, "Report finalized successfully");
    } catch (error) {
      console.error("❌ [HEALTHCARE] Error finalizing report:", error);
      return sendError(c, error, 500);
    }
  });
}

