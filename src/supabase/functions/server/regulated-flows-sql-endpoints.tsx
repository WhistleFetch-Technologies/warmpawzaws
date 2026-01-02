/**
 * REGULATED FLOWS SQL ENDPOINTS
 * NO KV STORE - All data from SQL
 * Medical records, prescriptions, medicine orders, diagnostics, reports
 */

import { Hono } from 'hono';
import { getRegulatedFlowsService } from '../../../supabase/lib/services/regulated-flows-service';
import { getRegulatedFlowsRepository } from '../../../supabase/lib/repositories/regulated-flows';

export function registerRegulatedFlowsSQLEndpoints(app: Hono) {
  // ============================================
  // MEDICAL RECORDS
  // ============================================

  /**
   * POST /make-server-3dd53475/medical-records/create
   * Create medical record (immutable)
   */
  app.post('/make-server-3dd53475/medical-records/create', async (c) => {
    try {
      const body = await c.req.json();
      const { userId, userType } = c.req.header('x-user-id') 
        ? { userId: c.req.header('x-user-id')!, userType: c.req.header('x-user-type') || 'customer' }
        : { userId: body.userId || '', userType: body.userType || 'customer' };

      const service = getRegulatedFlowsService();
      const record = await service.createMedicalRecord(body, userId, userType);

      return c.json({
        success: true,
        record
      });
    } catch (error: any) {
      console.error('❌ [MEDICAL-RECORD] Error:', error);
      return c.json({
        success: false,
        error: error.message || String(error)
      }, error.message?.includes('Unauthorized') ? 403 : 500);
    }
  });

  /**
   * GET /make-server-3dd53475/medical-records/pet/:petId
   * Get medical records for a pet
   */
  app.get('/make-server-3dd53475/medical-records/pet/:petId', async (c) => {
    try {
      const { petId } = c.req.param();
      const { userId, userType } = c.req.header('x-user-id')
        ? { userId: c.req.header('x-user-id')!, userType: c.req.header('x-user-type') || 'customer' }
        : { userId: c.req.query('userId') || '', userType: c.req.query('userType') || 'customer' };

      const service = getRegulatedFlowsService();
      const records = await service.getMedicalRecords(petId, userId, userType);

      return c.json({
        success: true,
        records,
        total: records.length
      });
    } catch (error: any) {
      console.error('❌ [MEDICAL-RECORDS] Error:', error);
      return c.json({
        success: false,
        error: error.message || String(error)
      }, error.message?.includes('Unauthorized') ? 403 : 500);
    }
  });

  // ============================================
  // PRESCRIPTIONS
  // ============================================

  /**
   * POST /make-server-3dd53475/prescriptions/create
   * Create prescription (draft)
   */
  app.post('/make-server-3dd53475/prescriptions/create', async (c) => {
    try {
      const body = await c.req.json();
      const { userId, userType } = c.req.header('x-user-id')
        ? { userId: c.req.header('x-user-id')!, userType: c.req.header('x-user-type') || 'vendor' }
        : { userId: body.userId || body.staff_id || '', userType: 'vendor' };

      const service = getRegulatedFlowsService();
      const prescription = await service.createPrescription(body, userId, userType);

      return c.json({
        success: true,
        prescription
      });
    } catch (error: any) {
      console.error('❌ [PRESCRIPTION] Error:', error);
      return c.json({
        success: false,
        error: error.message || String(error)
      }, error.message?.includes('Unauthorized') ? 403 : 500);
    }
  });

  /**
   * POST /make-server-3dd53475/prescriptions/:prescriptionId/finalize
   * Finalize prescription (make immutable)
   */
  app.post('/make-server-3dd53475/prescriptions/:prescriptionId/finalize', async (c) => {
    try {
      const { prescriptionId } = c.req.param();
      const { userId, userType } = c.req.header('x-user-id')
        ? { userId: c.req.header('x-user-id')!, userType: c.req.header('x-user-type') || 'vendor' }
        : { userId: c.req.query('userId') || '', userType: 'vendor' };

      const service = getRegulatedFlowsService();
      const prescription = await service.finalizePrescription(prescriptionId, userId, userType);

      return c.json({
        success: true,
        prescription
      });
    } catch (error: any) {
      console.error('❌ [PRESCRIPTION-FINALIZE] Error:', error);
      return c.json({
        success: false,
        error: error.message || String(error)
      }, error.message?.includes('Unauthorized') ? 403 : 500);
    }
  });

  /**
   * GET /make-server-3dd53475/prescriptions/:prescriptionId
   * Get prescription
   */
  app.get('/make-server-3dd53475/prescriptions/:prescriptionId', async (c) => {
    try {
      const { prescriptionId } = c.req.param();
      const { userId, userType } = c.req.header('x-user-id')
        ? { userId: c.req.header('x-user-id')!, userType: c.req.header('x-user-type') || 'customer' }
        : { userId: c.req.query('userId') || '', userType: c.req.query('userType') || 'customer' };

      const service = getRegulatedFlowsService();
      const prescription = await service.getPrescription(prescriptionId, userId, userType);

      if (!prescription) {
        return c.json({
          success: false,
          error: 'Prescription not found'
        }, 404);
      }

      return c.json({
        success: true,
        prescription
      });
    } catch (error: any) {
      console.error('❌ [PRESCRIPTION] Error:', error);
      return c.json({
        success: false,
        error: error.message || String(error)
      }, error.message?.includes('Unauthorized') ? 403 : 500);
    }
  });

  // ============================================
  // MEDICINE ORDERS
  // ============================================

  /**
   * POST /make-server-3dd53475/medicine-orders/create
   * Create medicine order
   */
  app.post('/make-server-3dd53475/medicine-orders/create', async (c) => {
    try {
      const body = await c.req.json();
      const { userId, userType } = c.req.header('x-user-id')
        ? { userId: c.req.header('x-user-id')!, userType: c.req.header('x-user-type') || 'customer' }
        : { userId: body.customer_id || '', userType: 'customer' };

      const service = getRegulatedFlowsService();
      const order = await service.createMedicineOrder(body, userId, userType);

      // Auto-broadcast to pharmacies (if configured)
      // This would typically be done by a background job
      // For now, we'll return the order and let the frontend trigger broadcast

      return c.json({
        success: true,
        order,
        message: 'Order created. Broadcasting to pharmacies...'
      });
    } catch (error: any) {
      console.error('❌ [MEDICINE-ORDER] Error:', error);
      return c.json({
        success: false,
        error: error.message || String(error)
      }, error.message?.includes('Unauthorized') ? 403 : 500);
    }
  });

  /**
   * POST /make-server-3dd53475/medicine-orders/:orderId/broadcast
   * Broadcast order to pharmacies
   */
  app.post('/make-server-3dd53475/medicine-orders/:orderId/broadcast', async (c) => {
    try {
      const { orderId } = c.req.param();
      const { pharmacyIds } = await c.req.json();
      const { userId, userType } = c.req.header('x-user-id')
        ? { userId: c.req.header('x-user-id')!, userType: c.req.header('x-user-type') || 'system' }
        : { userId: 'system', userType: 'system' };

      const service = getRegulatedFlowsService();
      await service.broadcastOrderToPharmacies(orderId, pharmacyIds, userId, userType);

      return c.json({
        success: true,
        message: `Order broadcasted to ${pharmacyIds.length} pharmacies`
      });
    } catch (error: any) {
      console.error('❌ [MEDICINE-ORDER-BROADCAST] Error:', error);
      return c.json({
        success: false,
        error: error.message || String(error)
      }, error.message?.includes('Unauthorized') ? 403 : 500);
    }
  });

  /**
   * POST /make-server-3dd53475/medicine-orders/:orderId/update-status
   * Update medicine order status
   */
  app.post('/make-server-3dd53475/medicine-orders/:orderId/update-status', async (c) => {
    try {
      const { orderId } = c.req.param();
      const { status, reason } = await c.req.json();
      const { userId, userType } = c.req.header('x-user-id')
        ? { userId: c.req.header('x-user-id')!, userType: c.req.header('x-user-type') || 'vendor' }
        : { userId: c.req.query('userId') || '', userType: 'vendor' };

      const service = getRegulatedFlowsService();
      const order = await service.updateMedicineOrderStatus(orderId, status, userId, userType, reason);

      return c.json({
        success: true,
        order
      });
    } catch (error: any) {
      console.error('❌ [MEDICINE-ORDER-STATUS] Error:', error);
      return c.json({
        success: false,
        error: error.message || String(error)
      }, error.message?.includes('Unauthorized') ? 403 : 500);
    }
  });

  // ============================================
  // DIAGNOSTIC BOOKINGS
  // ============================================

  /**
   * POST /make-server-3dd53475/diagnostics/bookings/create
   * Create diagnostic booking
   */
  app.post('/make-server-3dd53475/diagnostics/bookings/create', async (c) => {
    try {
      const body = await c.req.json();
      const { userId, userType } = c.req.header('x-user-id')
        ? { userId: c.req.header('x-user-id')!, userType: c.req.header('x-user-type') || 'customer' }
        : { userId: body.customer_id || '', userType: 'customer' };

      const service = getRegulatedFlowsService();
      const booking = await service.createDiagnosticBooking(body, userId, userType);

      return c.json({
        success: true,
        booking
      });
    } catch (error: any) {
      console.error('❌ [DIAGNOSTIC-BOOKING] Error:', error);
      return c.json({
        success: false,
        error: error.message || String(error)
      }, error.message?.includes('Unauthorized') ? 403 : 500);
    }
  });

  /**
   * POST /make-server-3dd53475/diagnostics/bookings/:bookingId/update-status
   * Update diagnostic booking status
   */
  app.post('/make-server-3dd53475/diagnostics/bookings/:bookingId/update-status', async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { status, reason, collectorId, collectorName } = await c.req.json();
      const { userId, userType } = c.req.header('x-user-id')
        ? { userId: c.req.header('x-user-id')!, userType: c.req.header('x-user-type') || 'vendor' }
        : { userId: c.req.query('userId') || '', userType: 'vendor' };

      const service = getRegulatedFlowsService();
      const booking = await service.updateDiagnosticBookingStatus(
        bookingId,
        status,
        userId,
        userType,
        reason,
        collectorId,
        collectorName
      );

      return c.json({
        success: true,
        booking
      });
    } catch (error: any) {
      console.error('❌ [DIAGNOSTIC-STATUS] Error:', error);
      return c.json({
        success: false,
        error: error.message || String(error)
      }, error.message?.includes('Unauthorized') ? 403 : 500);
    }
  });

  /**
   * POST /make-server-3dd53475/diagnostics/bookings/:bookingId/upload-report
   * Upload diagnostic report
   */
  app.post('/make-server-3dd53475/diagnostics/bookings/:bookingId/upload-report', async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { testId, testName, reportUrl, reportType, fileSize } = await c.req.json();
      const { userId, userType } = c.req.header('x-user-id')
        ? { userId: c.req.header('x-user-id')!, userType: c.req.header('x-user-type') || 'vendor' }
        : { userId: c.req.query('userId') || '', userType: 'vendor' };

      const service = getRegulatedFlowsService();
      const report = await service.uploadDiagnosticReport(
        bookingId,
        testId,
        testName,
        reportUrl,
        userId,
        userType,
        reportType,
        fileSize
      );

      return c.json({
        success: true,
        report
      });
    } catch (error: any) {
      console.error('❌ [DIAGNOSTIC-REPORT] Error:', error);
      return c.json({
        success: false,
        error: error.message || String(error)
      }, error.message?.includes('Unauthorized') ? 403 : 500);
    }
  });

  /**
   * GET /make-server-3dd53475/diagnostics/bookings/:bookingId/reports
   * Get diagnostic reports
   */
  app.get('/make-server-3dd53475/diagnostics/bookings/:bookingId/reports', async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { userId, userType } = c.req.header('x-user-id')
        ? { userId: c.req.header('x-user-id')!, userType: c.req.header('x-user-type') || 'customer' }
        : { userId: c.req.query('userId') || '', userType: c.req.query('userType') || 'customer' };

      const service = getRegulatedFlowsService();
      const reports = await service.getDiagnosticReports(bookingId, userId, userType);

      return c.json({
        success: true,
        reports,
        total: reports.length
      });
    } catch (error: any) {
      console.error('❌ [DIAGNOSTIC-REPORTS] Error:', error);
      return c.json({
        success: false,
        error: error.message || String(error)
      }, error.message?.includes('Unauthorized') ? 403 : 500);
    }
  });

  // ============================================
  // AUDIT TRAIL
  // ============================================

  /**
   * GET /make-server-3dd53475/audit-trail/:entityType/:entityId
   * Get audit trail for an entity
   */
  app.get('/make-server-3dd53475/audit-trail/:entityType/:entityId', async (c) => {
    try {
      const { entityType, entityId } = c.req.param();
      const { userId, userType } = c.req.header('x-user-id')
        ? { userId: c.req.header('x-user-id')!, userType: c.req.header('x-user-type') || 'admin' }
        : { userId: c.req.query('userId') || '', userType: 'admin' };

      // Only admin can view audit trail
      if (userType !== 'admin') {
        return c.json({
          success: false,
          error: 'Unauthorized: Only admins can view audit trail'
        }, 403);
      }

      const repository = getRegulatedFlowsRepository();
      const auditTrail = await repository.getAuditTrail(entityType, entityId);

      return c.json({
        success: true,
        audit_trail: auditTrail,
        total: auditTrail.length
      });
    } catch (error: any) {
      console.error('❌ [AUDIT-TRAIL] Error:', error);
      return c.json({
        success: false,
        error: error.message || String(error)
      }, 500);
    }
  });
}

