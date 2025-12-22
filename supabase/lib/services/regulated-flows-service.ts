/**
 * REGULATED FLOWS SERVICE
 * Service layer for regulated flows with role permissions and notifications
 * NO KV STORE - All data from SQL
 */

import { getRegulatedFlowsRepository, RegulatedFlowsRepository } from "../repositories/regulated-flows.ts";
import type { MedicalRecord, Prescription, MedicineOrder, DiagnosticBooking, DiagnosticReport } from "../repositories/regulated-flows.ts";

// Role permissions mapping
const ROLE_PERMISSIONS: Record<string, string[]> = {
  'veterinarian': [
    'medical_records:create',
    'medical_records:read',
    'prescriptions:create',
    'prescriptions:read',
    'prescriptions:finalize',
    'diagnostics:read'
  ],
  'customer': [
    'medical_records:read',
    'prescriptions:read',
    'medicine_orders:create',
    'medicine_orders:read',
    'diagnostics:create_booking',
    'diagnostics:read',
    'diagnostics:download_report'
  ],
  'pharmacy': [
    'medicine_orders:read',
    'medicine_orders:verify',
    'medicine_orders:update_status',
    'prescriptions:read'
  ],
  'diagnostic_center': [
    'diagnostics:read',
    'diagnostics:update_status',
    'diagnostics:upload_report'
  ],
  'admin': [
    'medical_records:read',
    'medical_records:create',
    'prescriptions:read',
    'medicine_orders:read',
    'diagnostics:read'
  ]
};

export class RegulatedFlowsService {
  private repository: RegulatedFlowsRepository;

  constructor(repository?: RegulatedFlowsRepository) {
    this.repository = repository || getRegulatedFlowsRepository();
  }

  /**
   * Check if user has permission
   */
  async checkPermission(userId: string, userType: string, permission: string): Promise<boolean> {
    // Get user's role permissions
    const permissions = ROLE_PERMISSIONS[userType] || [];
    
    // Check if permission exists
    if (!permissions.includes(permission)) {
      // Try to get from RBAC system (if exists)
      // For now, return false if not in default permissions
      return false;
    }

    return true;
  }

  /**
   * Create medical record with permission check
   */
  async createMedicalRecord(
    record: Partial<MedicalRecord>,
    userId: string,
    userType: string
  ): Promise<MedicalRecord> {
    // Check permission
    const hasPermission = await this.checkPermission(userId, userType, 'medical_records:create');
    if (!hasPermission) {
      throw new Error('Unauthorized: No permission to create medical records');
    }

    const createdRecord = await this.repository.createMedicalRecord({
      ...record,
      created_by: userId
    });

    // Trigger notification
    await this.triggerNotification('medical_record_created', {
      record_id: createdRecord.id,
      pet_id: createdRecord.pet_id,
      customer_id: record.pet_id // Would need to get from pet
    });

    return createdRecord;
  }

  /**
   * Get medical records with permission check
   */
  async getMedicalRecords(
    petId: string,
    userId: string,
    userType: string
  ): Promise<MedicalRecord[]> {
    // Check permission
    const hasPermission = await this.checkPermission(userId, userType, 'medical_records:read');
    if (!hasPermission) {
      throw new Error('Unauthorized: No permission to read medical records');
    }

    return await this.repository.getMedicalRecordsByPet(petId, userId, userType);
  }

  /**
   * Create prescription with permission check
   */
  async createPrescription(
    prescription: Partial<Prescription>,
    userId: string,
    userType: string
  ): Promise<Prescription> {
    // Check permission
    const hasPermission = await this.checkPermission(userId, userType, 'prescriptions:create');
    if (!hasPermission) {
      throw new Error('Unauthorized: No permission to create prescriptions');
    }

    const createdPrescription = await this.repository.createPrescription(prescription);

    // Trigger notification
    await this.triggerNotification('prescription_created', {
      prescription_id: createdPrescription.id,
      booking_id: createdPrescription.booking_id,
      customer_id: createdPrescription.customer_id
    });

    return createdPrescription;
  }

  /**
   * Finalize prescription with permission check
   */
  async finalizePrescription(
    prescriptionId: string,
    userId: string,
    userType: string
  ): Promise<Prescription> {
    // Check permission
    const hasPermission = await this.checkPermission(userId, userType, 'prescriptions:finalize');
    if (!hasPermission) {
      throw new Error('Unauthorized: No permission to finalize prescriptions');
    }

    const finalizedPrescription = await this.repository.finalizePrescription(prescriptionId, userId);

    // Trigger notification
    await this.triggerNotification('prescription_finalized', {
      prescription_id: finalizedPrescription.id,
      customer_id: finalizedPrescription.customer_id
    });

    return finalizedPrescription;
  }

  /**
   * Get prescription with permission check
   */
  async getPrescription(
    prescriptionId: string,
    userId: string,
    userType: string
  ): Promise<Prescription | null> {
    // Check permission
    const hasPermission = await this.checkPermission(userId, userType, 'prescriptions:read');
    if (!hasPermission) {
      throw new Error('Unauthorized: No permission to read prescriptions');
    }

    return await this.repository.getPrescriptionById(prescriptionId, userId, userType);
  }

  /**
   * Create medicine order with permission check
   */
  async createMedicineOrder(
    order: Partial<MedicineOrder>,
    userId: string,
    userType: string
  ): Promise<MedicineOrder> {
    // Check permission
    const hasPermission = await this.checkPermission(userId, userType, 'medicine_orders:create');
    if (!hasPermission) {
      throw new Error('Unauthorized: No permission to create medicine orders');
    }

    const createdOrder = await this.repository.createMedicineOrder({
      ...order,
      customer_id: userId
    });

    // Trigger notification
    await this.triggerNotification('medicine_order_created', {
      order_id: createdOrder.id,
      order_number: createdOrder.order_number,
      customer_id: createdOrder.customer_id
    });

    return createdOrder;
  }

  /**
   * Broadcast order to pharmacies
   */
  async broadcastOrderToPharmacies(
    orderId: string,
    pharmacyIds: string[],
    userId: string,
    userType: string
  ): Promise<void> {
    // Check permission (system or admin)
    if (userType !== 'admin' && userType !== 'system') {
      throw new Error('Unauthorized: Only system/admin can broadcast orders');
    }

    await this.repository.broadcastOrderToPharmacies(orderId, pharmacyIds);

    // Trigger notifications to pharmacies
    for (const pharmacyId of pharmacyIds) {
      await this.triggerNotification('medicine_order_broadcasted', {
        order_id: orderId,
        pharmacy_id: pharmacyId
      });
    }

    // Trigger notification to customer
    const order = await this.repository.getMedicineOrderById(orderId, userId, userType);
    if (order) {
      await this.triggerNotification('order_broadcasted_to_pharmacies', {
        order_id: orderId,
        order_number: order.order_number,
        customer_id: order.customer_id
      });
    }
  }

  /**
   * Update medicine order status with permission check
   */
  async updateMedicineOrderStatus(
    orderId: string,
    newStatus: string,
    userId: string,
    userType: string,
    reason?: string
  ): Promise<MedicineOrder> {
    // Check permission based on status
    let requiredPermission = 'medicine_orders:update_status';
    if (newStatus === 'verified' || newStatus === 'quotes_received') {
      requiredPermission = 'medicine_orders:verify';
    }

    const hasPermission = await this.checkPermission(userId, userType, requiredPermission);
    if (!hasPermission) {
      throw new Error(`Unauthorized: No permission to update order status to ${newStatus}`);
    }

    const updatedOrder = await this.repository.updateMedicineOrderStatus(orderId, newStatus, userId, reason);

    // Trigger notification based on status
    await this.triggerNotificationForOrderStatus(updatedOrder, newStatus);

    return updatedOrder;
  }

  /**
   * Create diagnostic booking with permission check
   */
  async createDiagnosticBooking(
    booking: Partial<DiagnosticBooking>,
    userId: string,
    userType: string
  ): Promise<DiagnosticBooking> {
    // Check permission
    const hasPermission = await this.checkPermission(userId, userType, 'diagnostics:create_booking');
    if (!hasPermission) {
      throw new Error('Unauthorized: No permission to create diagnostic bookings');
    }

    const createdBooking = await this.repository.createDiagnosticBooking({
      ...booking,
      customer_id: userId
    });

    // Trigger notification
    await this.triggerNotification('diagnostic_booking_created', {
      booking_id: createdBooking.id,
      booking_number: createdBooking.booking_number,
      customer_id: createdBooking.customer_id,
      scheduled_date: createdBooking.scheduled_date,
      scheduled_time: createdBooking.scheduled_time
    });

    return createdBooking;
  }

  /**
   * Update diagnostic booking status with permission check
   */
  async updateDiagnosticBookingStatus(
    bookingId: string,
    newStatus: string,
    userId: string,
    userType: string,
    reason?: string,
    collectorId?: string,
    collectorName?: string
  ): Promise<DiagnosticBooking> {
    // Check permission
    const hasPermission = await this.checkPermission(userId, userType, 'diagnostics:update_status');
    if (!hasPermission) {
      throw new Error('Unauthorized: No permission to update diagnostic booking status');
    }

    const updatedBooking = await this.repository.updateDiagnosticBookingStatus(
      bookingId,
      newStatus,
      userId,
      reason,
      collectorId,
      collectorName
    );

    // Trigger notification based on status
    await this.triggerNotificationForDiagnosticStatus(updatedBooking, newStatus);

    return updatedBooking;
  }

  /**
   * Upload diagnostic report with permission check
   */
  async uploadDiagnosticReport(
    bookingId: string,
    testId: string,
    testName: string,
    reportUrl: string,
    userId: string,
    userType: string,
    reportType?: 'pdf' | 'image' | 'document',
    fileSize?: number
  ): Promise<DiagnosticReport> {
    // Check permission
    const hasPermission = await this.checkPermission(userId, userType, 'diagnostics:upload_report');
    if (!hasPermission) {
      throw new Error('Unauthorized: No permission to upload diagnostic reports');
    }

    const report = await this.repository.uploadDiagnosticReport(
      bookingId,
      testId,
      testName,
      reportUrl,
      userId,
      reportType,
      fileSize
    );

    // Trigger notification
    const booking = await this.repository.getDiagnosticBookingById(bookingId, userId, userType);
    if (booking) {
      await this.triggerNotification('diagnostic_report_uploaded', {
        booking_id: bookingId,
        test_id: testId,
        test_name: testName,
        customer_id: booking.customer_id,
        all_reports_ready: booking.all_reports_uploaded
      });
    }

    return report;
  }

  /**
   * Get diagnostic reports with permission check
   */
  async getDiagnosticReports(
    bookingId: string,
    userId: string,
    userType: string
  ): Promise<DiagnosticReport[]> {
    // Check permission
    const hasPermission = await this.checkPermission(userId, userType, 'diagnostics:download_report');
    if (!hasPermission) {
      throw new Error('Unauthorized: No permission to download diagnostic reports');
    }

    return await this.repository.getDiagnosticReports(bookingId, userId, userType);
  }

  /**
   * Trigger notification for order status change
   */
  private async triggerNotificationForOrderStatus(order: MedicineOrder, newStatus: string): Promise<void> {
    const notificationMap: Record<string, { type: string; message: string }> = {
      'broadcasted_to_pharmacies': {
        type: 'order_broadcasted',
        message: `Your medicine order ${order.order_number} has been sent to pharmacies for quotes.`
      },
      'quotes_received': {
        type: 'quotes_received',
        message: `Quotes received for your medicine order ${order.order_number}. Please select a pharmacy.`
      },
      'pharmacy_selected': {
        type: 'pharmacy_selected',
        message: `Pharmacy selected for your order ${order.order_number}. Proforma invoice is being generated.`
      },
      'proforma_invoice_generated': {
        type: 'proforma_invoice_ready',
        message: `Proforma invoice ready for order ${order.order_number}. Please complete payment.`
      },
      'payment_completed': {
        type: 'payment_completed',
        message: `Payment completed for order ${order.order_number}. Your order is being prepared.`
      },
      'order_confirmed': {
        type: 'order_confirmed',
        message: `Order ${order.order_number} confirmed. Pharmacy is preparing your medicines.`
      },
      'preparing': {
        type: 'order_preparing',
        message: `Your order ${order.order_number} is being prepared.`
      },
      'shipped': {
        type: 'order_shipped',
        message: `Your order ${order.order_number} has been shipped. Tracking: ${order.tracking_id || 'N/A'}`
      },
      'out_for_delivery': {
        type: 'out_for_delivery',
        message: `Your order ${order.order_number} is out for delivery.`
      },
      'delivered': {
        type: 'order_delivered',
        message: `Your order ${order.order_number} has been delivered.`
      }
    };

    const notification = notificationMap[newStatus];
    if (notification) {
      await this.triggerNotification(notification.type, {
        order_id: order.id,
        order_number: order.order_number,
        customer_id: order.customer_id,
        status: newStatus,
        message: notification.message
      });
    }
  }

  /**
   * Trigger notification for diagnostic status change
   */
  private async triggerNotificationForDiagnosticStatus(booking: DiagnosticBooking, newStatus: string): Promise<void> {
    const notificationMap: Record<string, { type: string; message: string }> = {
      'sample_collected': {
        type: 'sample_collected',
        message: `Sample collected for your diagnostic test ${booking.booking_number}. Reports will be ready soon.`
      },
      'sample_received_at_lab': {
        type: 'sample_received',
        message: `Sample received at lab for ${booking.booking_number}. Processing will begin shortly.`
      },
      'processing': {
        type: 'processing',
        message: `Your diagnostic tests for ${booking.booking_number} are being processed.`
      },
      'reports_ready': {
        type: 'reports_ready',
        message: `Your diagnostic reports for ${booking.booking_number} are ready!`
      },
      'completed': {
        type: 'diagnostic_completed',
        message: `All diagnostic tests for ${booking.booking_number} have been completed.`
      }
    };

    const notification = notificationMap[newStatus];
    if (notification) {
      await this.triggerNotification(notification.type, {
        booking_id: booking.id,
        booking_number: booking.booking_number,
        customer_id: booking.customer_id,
        status: newStatus,
        message: notification.message
      });
    }
  }

  /**
   * Trigger notification (placeholder - should integrate with notification system)
   */
  private async triggerNotification(type: string, data: any): Promise<void> {
    // This should integrate with the notification system
    // For now, we'll log it
    console.log(`📱 [NOTIFICATION] ${type}:`, data);
    
    // In production, this would call:
    // await createNotificationHelper(kv, { ... });
  }
}

let regulatedFlowsServiceInstance: RegulatedFlowsService | null = null;

export function getRegulatedFlowsService(): RegulatedFlowsService {
  if (!regulatedFlowsServiceInstance) {
    regulatedFlowsServiceInstance = new RegulatedFlowsService();
  }
  return regulatedFlowsServiceInstance;
}

