/**
 * REGULATED FLOWS REPOSITORY
 * SQL-based repository for regulated flows (NO KV STORE)
 * Medical records, prescriptions, medicine orders, diagnostics, reports
 */

import { getDbClient, withTransaction } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface MedicalRecord {
  id: string;
  pet_id: string;
  booking_id?: string;
  vendor_id?: string;
  staff_id?: string;
  record_type: 'checkup' | 'vaccination' | 'surgery' | 'illness' | 'injury' | 'prescription' | 'diagnostic' | 'other';
  description: string;
  diagnosis?: string;
  observations?: string;
  treatment_notes?: string;
  medications?: any[];
  vitals?: any;
  attachments?: any[];
  is_immutable: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Prescription {
  id: string;
  booking_id: string;
  pet_id: string;
  customer_id: string;
  vendor_id: string;
  staff_id?: string;
  diagnosis?: string;
  observations?: string;
  medications: any[];
  products_used?: any[];
  tests_recommended?: any[];
  general_notes?: string;
  recommendations?: string;
  next_follow_up_date?: string;
  follow_up_reason?: string;
  vitals?: any;
  attachments?: any[];
  status: 'draft' | 'finalized' | 'immutable';
  is_immutable: boolean;
  finalized_at?: string;
  finalized_by?: string;
  created_at: string;
  updated_at: string;
}

export interface MedicineOrder {
  id: string;
  customer_id: string;
  pet_id: string;
  prescription_id?: string;
  order_number: string;
  medicines: any[];
  delivery_address: any;
  delivery_instructions?: string;
  prescription_url?: string;
  pharmacy_vendor_id?: string;
  pharmacy_name?: string;
  pharmacy_phone?: string;
  subtotal: number;
  delivery_charge: number;
  total_amount: number;
  proforma_invoice_url?: string;
  proforma_invoice_generated_at?: string;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  payment_id?: string;
  payment_method?: string;
  paid_at?: string;
  status: string;
  status_changed_at: string;
  status_changed_by?: string;
  status_change_reason?: string;
  tracking_id?: string;
  tracking_url?: string;
  estimated_delivery_date?: string;
  estimated_delivery_time?: string;
  actual_delivery_date?: string;
  actual_delivery_time?: string;
  delivery_agent_name?: string;
  delivery_agent_phone?: string;
  created_at: string;
  updated_at: string;
}

export interface DiagnosticBooking {
  id: string;
  customer_id: string;
  pet_id: string;
  vendor_id: string;
  center_id?: string;
  booking_number: string;
  tests: any[];
  booking_type: 'home_collection' | 'center_visit';
  scheduled_date: string;
  scheduled_time: string;
  collection_address?: any;
  prescription_id?: string;
  prescription_url?: string;
  special_instructions?: string;
  status: string;
  status_changed_at: string;
  status_changed_by?: string;
  status_change_reason?: string;
  collector_id?: string;
  collector_name?: string;
  sample_collection_time?: string;
  reports?: any[];
  report_generation_time?: string;
  all_reports_uploaded: boolean;
  total_amount: number;
  home_collection_charge: number;
  payment_status: 'pending' | 'paid' | 'refunded';
  created_at: string;
  updated_at: string;
}

export interface DiagnosticReport {
  id: string;
  diagnostic_booking_id: string;
  test_id: string;
  test_name: string;
  report_url: string;
  report_type?: 'pdf' | 'image' | 'document';
  file_size?: number;
  version: number;
  previous_version_id?: string;
  is_latest: boolean;
  uploaded_by: string;
  uploaded_at: string;
  created_at: string;
  updated_at: string;
}

export class RegulatedFlowsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  // ============================================
  // MEDICAL RECORDS
  // ============================================

  /**
   * Create medical record (immutable)
   */
  async createMedicalRecord(record: Partial<MedicalRecord>): Promise<MedicalRecord> {
    const { data, error } = await this.client
      .from('medical_records')
      .insert({
        pet_id: record.pet_id,
        booking_id: record.booking_id,
        vendor_id: record.vendor_id,
        staff_id: record.staff_id,
        record_type: record.record_type,
        description: record.description,
        diagnosis: record.diagnosis,
        observations: record.observations,
        treatment_notes: record.treatment_notes,
        medications: record.medications ? (typeof record.medications === 'string' ? record.medications : JSON.stringify(record.medications)) : null,
        vitals: record.vitals ? (typeof record.vitals === 'string' ? record.vitals : JSON.stringify(record.vitals)) : null,
        attachments: record.attachments ? (typeof record.attachments === 'string' ? record.attachments : JSON.stringify(record.attachments)) : null,
        is_immutable: true, // Medical records are always immutable
        created_by: record.created_by
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create medical record: ${error.message}`);
    }

    // Log audit trail
    await this.logAuditTrail('medical_record', data.id, 'create', record.created_by, 'customer', {
      record_type: record.record_type,
      pet_id: record.pet_id
    });

    return this.mapMedicalRecord(data);
  }

  /**
   * Get medical records for a pet
   */
  async getMedicalRecordsByPet(petId: string, userId: string, userType: string): Promise<MedicalRecord[]> {
    // Check permission (should be done in service layer)
    const { data, error } = await this.client
      .from('medical_records')
      .select('*')
      .eq('pet_id', petId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch medical records: ${error.message}`);
    }

    // Log audit trail for access
    for (const record of data || []) {
      await this.logAuditTrail('medical_record', record.id, 'read', userId, userType);
    }

    return (data || []).map(this.mapMedicalRecord);
  }

  /**
   * Map database record to MedicalRecord interface
   */
  private mapMedicalRecord(data: any): MedicalRecord {
    return {
      id: data.id,
      pet_id: data.pet_id,
      booking_id: data.booking_id,
      vendor_id: data.vendor_id,
      staff_id: data.staff_id,
      record_type: data.record_type,
      description: data.description,
      diagnosis: data.diagnosis,
      observations: data.observations,
      treatment_notes: data.treatment_notes,
      medications: data.medications ? (typeof data.medications === 'string' ? JSON.parse(data.medications) : data.medications) : undefined,
      vitals: data.vitals ? (typeof data.vitals === 'string' ? JSON.parse(data.vitals) : data.vitals) : undefined,
      attachments: data.attachments ? (typeof data.attachments === 'string' ? JSON.parse(data.attachments) : data.attachments) : undefined,
      is_immutable: data.is_immutable,
      created_by: data.created_by,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  }

  // ============================================
  // PRESCRIPTIONS
  // ============================================

  /**
   * Create prescription (draft)
   */
  async createPrescription(prescription: Partial<Prescription>): Promise<Prescription> {
    const { data, error } = await this.client
      .from('prescriptions')
      .insert({
        booking_id: prescription.booking_id,
        pet_id: prescription.pet_id,
        customer_id: prescription.customer_id,
        vendor_id: prescription.vendor_id,
        staff_id: prescription.staff_id,
        diagnosis: prescription.diagnosis,
        observations: prescription.observations,
        medications: typeof prescription.medications === 'string' ? prescription.medications : JSON.stringify(prescription.medications || []),
        products_used: prescription.products_used ? (typeof prescription.products_used === 'string' ? prescription.products_used : JSON.stringify(prescription.products_used)) : null,
        tests_recommended: prescription.tests_recommended ? (typeof prescription.tests_recommended === 'string' ? prescription.tests_recommended : JSON.stringify(prescription.tests_recommended)) : null,
        general_notes: prescription.general_notes,
        recommendations: prescription.recommendations,
        next_follow_up_date: prescription.next_follow_up_date,
        follow_up_reason: prescription.follow_up_reason,
        vitals: prescription.vitals ? JSON.stringify(prescription.vitals) : null,
        attachments: prescription.attachments ? JSON.stringify(prescription.attachments) : null,
        status: 'draft',
        is_immutable: false
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create prescription: ${error.message}`);
    }

    // Log audit trail
    await this.logAuditTrail('prescription', data.id, 'create', prescription.staff_id || prescription.vendor_id, 'vendor', {
      booking_id: prescription.booking_id,
      pet_id: prescription.pet_id
    });

    return this.mapPrescription(data);
  }

  /**
   * Finalize prescription (make immutable)
   */
  async finalizePrescription(prescriptionId: string, finalizedBy: string): Promise<Prescription> {
    return withTransaction(async (client) => {
      // Get current prescription
      const { data: current, error: fetchError } = await client
        .from('prescriptions')
        .select('*')
        .eq('id', prescriptionId)
        .single();

      if (fetchError || !current) {
        throw new Error('Prescription not found');
      }

      if (current.status !== 'draft') {
        throw new Error('Only draft prescriptions can be finalized');
      }

      // Finalize prescription
      const { data, error } = await client
        .from('prescriptions')
        .update({
          status: 'immutable',
          is_immutable: true,
          finalized_at: new Date().toISOString(),
          finalized_by: finalizedBy,
          updated_at: new Date().toISOString()
        })
        .eq('id', prescriptionId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to finalize prescription: ${error.message}`);
      }

      // Log audit trail
      await this.logAuditTrail('prescription', prescriptionId, 'finalize', finalizedBy, 'vendor', {
        old_status: 'draft',
        new_status: 'immutable'
      });

      return this.mapPrescription(data);
    });
  }

  /**
   * Get prescription by ID
   */
  async getPrescriptionById(prescriptionId: string, userId: string, userType: string): Promise<Prescription | null> {
    const { data, error } = await this.client
      .from('prescriptions')
      .select('*')
      .eq('id', prescriptionId)
      .single();

    if (error || !data) {
      return null;
    }

    // Log audit trail for access
    await this.logAuditTrail('prescription', prescriptionId, 'read', userId, userType);

    return this.mapPrescription(data);
  }

  /**
   * Map database record to Prescription interface
   */
  private mapPrescription(data: any): Prescription {
    return {
      id: data.id,
      booking_id: data.booking_id,
      pet_id: data.pet_id,
      customer_id: data.customer_id,
      vendor_id: data.vendor_id,
      staff_id: data.staff_id,
      diagnosis: data.diagnosis,
      observations: data.observations,
      medications: data.medications ? (typeof data.medications === 'string' ? JSON.parse(data.medications) : data.medications) : [],
      products_used: data.products_used ? (typeof data.products_used === 'string' ? JSON.parse(data.products_used) : data.products_used) : undefined,
      tests_recommended: data.tests_recommended ? (typeof data.tests_recommended === 'string' ? JSON.parse(data.tests_recommended) : data.tests_recommended) : undefined,
      general_notes: data.general_notes,
      recommendations: data.recommendations,
      next_follow_up_date: data.next_follow_up_date,
      follow_up_reason: data.follow_up_reason,
      vitals: data.vitals ? JSON.parse(data.vitals) : undefined,
      attachments: data.attachments ? JSON.parse(data.attachments) : undefined,
      status: data.status,
      is_immutable: data.is_immutable,
      finalized_at: data.finalized_at,
      finalized_by: data.finalized_by,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  }

  // ============================================
  // MEDICINE ORDERS
  // ============================================

  /**
   * Create medicine order
   */
  async createMedicineOrder(order: Partial<MedicineOrder>): Promise<MedicineOrder> {
    const orderNumber = `MED${Date.now().toString().slice(-8)}`;

    const { data, error } = await this.client
      .from('medicine_orders')
      .insert({
        customer_id: order.customer_id,
        pet_id: order.pet_id,
        prescription_id: order.prescription_id,
        order_number: orderNumber,
        medicines: typeof order.medicines === 'string' ? order.medicines : JSON.stringify(order.medicines || []),
        delivery_address: typeof order.delivery_address === 'string' ? order.delivery_address : JSON.stringify(order.delivery_address),
        delivery_instructions: order.delivery_instructions,
        prescription_url: order.prescription_url,
        subtotal: order.subtotal || 0,
        delivery_charge: order.delivery_charge || 0,
        total_amount: order.total_amount || 0,
        status: 'prescription_uploaded',
        payment_status: 'pending'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create medicine order: ${error.message}`);
    }

    // Log audit trail
    await this.logAuditTrail('medicine_order', data.id, 'create', order.customer_id, 'customer', {
      order_number: orderNumber,
      prescription_id: order.prescription_id
    });

    return this.mapMedicineOrder(data);
  }

  /**
   * Update medicine order status (with validation)
   */
  async updateMedicineOrderStatus(
    orderId: string,
    newStatus: string,
    changedBy: string,
    reason?: string
  ): Promise<MedicineOrder> {
    return withTransaction(async (client) => {
      // Get current order
      const { data: current, error: fetchError } = await client
        .from('medicine_orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (fetchError || !current) {
        throw new Error('Medicine order not found');
      }

      const oldStatus = current.status;

      // Update status (trigger will validate transition)
      const { data, error } = await client
        .from('medicine_orders')
        .update({
          status: newStatus,
          status_changed_by: changedBy,
          status_change_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update order status: ${error.message}`);
      }

      // Log audit trail
      await this.logAuditTrail('medicine_order', orderId, 'status_change', changedBy, 'vendor', {
        old_status: oldStatus,
        new_status: newStatus,
        reason
      });

      return this.mapMedicineOrder(data);
    });
  }

  /**
   * Broadcast order to pharmacies
   */
  async broadcastOrderToPharmacies(orderId: string, pharmacyIds: string[]): Promise<void> {
    const order = await this.getMedicineOrderById(orderId, '', '');
    if (!order) {
      throw new Error('Order not found');
    }

    // Update order status
    await this.updateMedicineOrderStatus(orderId, 'broadcasted_to_pharmacies', 'system', 'Order broadcasted to pharmacies');

    // Create quotes for each pharmacy (pharmacies will update these)
    for (const pharmacyId of pharmacyIds) {
      await this.client
        .from('pharmacy_quotes')
        .insert({
          medicine_order_id: orderId,
          pharmacy_vendor_id: pharmacyId,
          status: 'pending',
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
        });
    }
  }

  /**
   * Get medicine order by ID
   */
  async getMedicineOrderById(orderId: string, userId: string, userType: string): Promise<MedicineOrder | null> {
    const { data, error } = await this.client
      .from('medicine_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error || !data) {
      return null;
    }

    // Log audit trail for access
    await this.logAuditTrail('medicine_order', orderId, 'read', userId, userType);

    return this.mapMedicineOrder(data);
  }

  /**
   * Map database record to MedicineOrder interface
   */
  private mapMedicineOrder(data: any): MedicineOrder {
    return {
      id: data.id,
      customer_id: data.customer_id,
      pet_id: data.pet_id,
      prescription_id: data.prescription_id,
      order_number: data.order_number,
      medicines: data.medicines ? (typeof data.medicines === 'string' ? JSON.parse(data.medicines) : data.medicines) : [],
      delivery_address: data.delivery_address ? (typeof data.delivery_address === 'string' ? JSON.parse(data.delivery_address) : data.delivery_address) : {},
      delivery_instructions: data.delivery_instructions,
      prescription_url: data.prescription_url,
      pharmacy_vendor_id: data.pharmacy_vendor_id,
      pharmacy_name: data.pharmacy_name,
      pharmacy_phone: data.pharmacy_phone,
      subtotal: parseFloat(data.subtotal || 0),
      delivery_charge: parseFloat(data.delivery_charge || 0),
      total_amount: parseFloat(data.total_amount || 0),
      proforma_invoice_url: data.proforma_invoice_url,
      proforma_invoice_generated_at: data.proforma_invoice_generated_at,
      payment_status: data.payment_status,
      payment_id: data.payment_id,
      payment_method: data.payment_method,
      paid_at: data.paid_at,
      status: data.status,
      status_changed_at: data.status_changed_at,
      status_changed_by: data.status_changed_by,
      status_change_reason: data.status_change_reason,
      tracking_id: data.tracking_id,
      tracking_url: data.tracking_url,
      estimated_delivery_date: data.estimated_delivery_date,
      estimated_delivery_time: data.estimated_delivery_time,
      actual_delivery_date: data.actual_delivery_date,
      actual_delivery_time: data.actual_delivery_time,
      delivery_agent_name: data.delivery_agent_name,
      delivery_agent_phone: data.delivery_agent_phone,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  }

  // ============================================
  // DIAGNOSTIC BOOKINGS
  // ============================================

  /**
   * Create diagnostic booking
   */
  async createDiagnosticBooking(booking: Partial<DiagnosticBooking>): Promise<DiagnosticBooking> {
    const bookingNumber = `DIAG-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const { data, error } = await this.client
      .from('diagnostic_bookings')
      .insert({
        customer_id: booking.customer_id,
        pet_id: booking.pet_id,
        vendor_id: booking.vendor_id,
        center_id: booking.center_id,
        booking_number: bookingNumber,
        tests: typeof booking.tests === 'string' ? booking.tests : JSON.stringify(booking.tests || []),
        booking_type: booking.booking_type,
        scheduled_date: booking.scheduled_date,
        scheduled_time: booking.scheduled_time,
        collection_address: booking.collection_address ? (typeof booking.collection_address === 'string' ? booking.collection_address : JSON.stringify(booking.collection_address)) : null,
        prescription_id: booking.prescription_id,
        prescription_url: booking.prescription_url,
        special_instructions: booking.special_instructions,
        status: 'scheduled',
        total_amount: booking.total_amount || 0,
        home_collection_charge: booking.home_collection_charge || 0,
        payment_status: 'pending'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create diagnostic booking: ${error.message}`);
    }

    // Log audit trail
    await this.logAuditTrail('diagnostic_booking', data.id, 'create', booking.customer_id, 'customer', {
      booking_number: bookingNumber,
      vendor_id: booking.vendor_id
    });

    return this.mapDiagnosticBooking(data);
  }

  /**
   * Update diagnostic booking status (with validation)
   */
  async updateDiagnosticBookingStatus(
    bookingId: string,
    newStatus: string,
    changedBy: string,
    reason?: string,
    collectorId?: string,
    collectorName?: string
  ): Promise<DiagnosticBooking> {
    return withTransaction(async (client) => {
      // Get current booking
      const { data: current, error: fetchError } = await client
        .from('diagnostic_bookings')
        .select('*')
        .eq('id', bookingId)
        .single();

      if (fetchError || !current) {
        throw new Error('Diagnostic booking not found');
      }

      const oldStatus = current.status;

      // Prepare update data
      const updateData: any = {
        status: newStatus,
        status_changed_by: changedBy,
        status_change_reason: reason,
        updated_at: new Date().toISOString()
      };

      // Update timestamps based on status
      if (newStatus === 'sample_collected') {
        updateData.sample_collection_time = new Date().toISOString();
        if (collectorId) updateData.collector_id = collectorId;
        if (collectorName) updateData.collector_name = collectorName;
      } else if (newStatus === 'reports_ready') {
        updateData.report_generation_time = new Date().toISOString();
      }

      // Update status (trigger will validate transition)
      const { data, error } = await client
        .from('diagnostic_bookings')
        .update(updateData)
        .eq('id', bookingId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update booking status: ${error.message}`);
      }

      // Log audit trail
      await this.logAuditTrail('diagnostic_booking', bookingId, 'status_change', changedBy, 'vendor', {
        old_status: oldStatus,
        new_status: newStatus,
        reason
      });

      return this.mapDiagnosticBooking(data);
    });
  }

  /**
   * Upload diagnostic report
   */
  async uploadDiagnosticReport(
    bookingId: string,
    testId: string,
    testName: string,
    reportUrl: string,
    uploadedBy: string,
    reportType?: 'pdf' | 'image' | 'document',
    fileSize?: number
  ): Promise<DiagnosticReport> {
    return withTransaction(async (client) => {
      // Get current booking
      const { data: booking, error: bookingError } = await client
        .from('diagnostic_bookings')
        .select('*')
        .eq('id', bookingId)
        .single();

      if (bookingError || !booking) {
        throw new Error('Diagnostic booking not found');
      }

      // Get existing reports for this test
      const { data: existingReports } = await client
        .from('diagnostic_reports')
        .select('*')
        .eq('diagnostic_booking_id', bookingId)
        .eq('test_id', testId)
        .eq('is_latest', true);

      // Mark old reports as not latest
      if (existingReports && existingReports.length > 0) {
        await client
          .from('diagnostic_reports')
          .update({ is_latest: false })
          .eq('diagnostic_booking_id', bookingId)
          .eq('test_id', testId);
      }

      // Create new report version
      const version = existingReports ? existingReports[0].version + 1 : 1;
      const previousVersionId = existingReports && existingReports.length > 0 ? existingReports[0].id : null;

      const { data: report, error: reportError } = await client
        .from('diagnostic_reports')
        .insert({
          diagnostic_booking_id: bookingId,
          test_id: testId,
          test_name: testName,
          report_url: reportUrl,
          report_type: reportType,
          file_size: fileSize,
          version,
          previous_version_id: previousVersionId,
          is_latest: true,
          uploaded_by: uploadedBy
        })
        .select()
        .single();

      if (reportError) {
        throw new Error(`Failed to upload report: ${reportError.message}`);
      }

      // Update booking reports array
      const reports = booking.reports ? (typeof booking.reports === 'string' ? JSON.parse(booking.reports) : booking.reports) : [];
      reports.push({
        testId,
        testName,
        reportUrl,
        uploadedAt: new Date().toISOString()
      });

      // Check if all reports uploaded
      const tests = booking.tests ? (typeof booking.tests === 'string' ? JSON.parse(booking.tests) : booking.tests) : [];
      const allReportsUploaded = tests.length === reports.length;

      await client
        .from('diagnostic_bookings')
        .update({
          reports: JSON.stringify(reports),
          all_reports_uploaded: allReportsUploaded,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      // If all reports uploaded, update status
      if (allReportsUploaded) {
        await this.updateDiagnosticBookingStatus(bookingId, 'reports_ready', uploadedBy, 'All reports uploaded');
      }

      // Log audit trail
      await this.logAuditTrail('report', report.id, 'upload', uploadedBy, 'vendor', {
        diagnostic_booking_id: bookingId,
        test_id: testId,
        version
      });

      return this.mapDiagnosticReport(report);
    });
  }

  /**
   * Get diagnostic booking by ID
   */
  async getDiagnosticBookingById(bookingId: string, userId: string, userType: string): Promise<DiagnosticBooking | null> {
    const { data, error } = await this.client
      .from('diagnostic_bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (error || !data) {
      return null;
    }

    // Log audit trail for access
    await this.logAuditTrail('diagnostic_booking', bookingId, 'read', userId, userType);

    return this.mapDiagnosticBooking(data);
  }

  /**
   * Get diagnostic reports for a booking
   */
  async getDiagnosticReports(bookingId: string, userId: string, userType: string): Promise<DiagnosticReport[]> {
    const { data, error } = await this.client
      .from('diagnostic_reports')
      .select('*')
      .eq('diagnostic_booking_id', bookingId)
      .eq('is_latest', true)
      .order('uploaded_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch reports: ${error.message}`);
    }

    // Log audit trail for access
    for (const report of data || []) {
      await this.logAuditTrail('report', report.id, 'read', userId, userType);
    }

    return (data || []).map(this.mapDiagnosticReport);
  }

  /**
   * Map database record to DiagnosticBooking interface
   */
  private mapDiagnosticBooking(data: any): DiagnosticBooking {
    return {
      id: data.id,
      customer_id: data.customer_id,
      pet_id: data.pet_id,
      vendor_id: data.vendor_id,
      center_id: data.center_id,
      booking_number: data.booking_number,
      tests: data.tests ? (typeof data.tests === 'string' ? JSON.parse(data.tests) : data.tests) : [],
      booking_type: data.booking_type,
      scheduled_date: data.scheduled_date,
      scheduled_time: data.scheduled_time,
      collection_address: data.collection_address ? (typeof data.collection_address === 'string' ? JSON.parse(data.collection_address) : data.collection_address) : undefined,
      prescription_id: data.prescription_id,
      prescription_url: data.prescription_url,
      special_instructions: data.special_instructions,
      status: data.status,
      status_changed_at: data.status_changed_at,
      status_changed_by: data.status_changed_by,
      status_change_reason: data.status_change_reason,
      collector_id: data.collector_id,
      collector_name: data.collector_name,
      sample_collection_time: data.sample_collection_time,
      reports: data.reports ? (typeof data.reports === 'string' ? JSON.parse(data.reports) : data.reports) : undefined,
      report_generation_time: data.report_generation_time,
      all_reports_uploaded: data.all_reports_uploaded,
      total_amount: parseFloat(data.total_amount || 0),
      home_collection_charge: parseFloat(data.home_collection_charge || 0),
      payment_status: data.payment_status,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  }

  /**
   * Map database record to DiagnosticReport interface
   */
  private mapDiagnosticReport(data: any): DiagnosticReport {
    return {
      id: data.id,
      diagnostic_booking_id: data.diagnostic_booking_id,
      test_id: data.test_id,
      test_name: data.test_name,
      report_url: data.report_url,
      report_type: data.report_type,
      file_size: data.file_size,
      version: data.version,
      previous_version_id: data.previous_version_id,
      is_latest: data.is_latest,
      uploaded_by: data.uploaded_by,
      uploaded_at: data.uploaded_at,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  }

  // ============================================
  // AUDIT TRAIL
  // ============================================

  /**
   * Log audit trail entry
   */
  async logAuditTrail(
    entityType: string,
    entityId: string,
    action: string,
    userId: string,
    userType: string,
    details?: any,
    oldValues?: any,
    newValues?: any
  ): Promise<void> {
    await this.client
      .from('audit_trail')
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        action,
        action_details: details ? JSON.stringify(details) : null,
        user_id: userId,
        user_type: userType,
        old_values: oldValues ? JSON.stringify(oldValues) : null,
        new_values: newValues ? JSON.stringify(newValues) : null
      });
  }

  /**
   * Get audit trail for an entity
   */
  async getAuditTrail(entityType: string, entityId: string): Promise<any[]> {
    const { data, error } = await this.client
      .from('audit_trail')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch audit trail: ${error.message}`);
    }

    return (data || []).map(entry => ({
      ...entry,
      action_details: entry.action_details ? JSON.parse(entry.action_details) : null,
      old_values: entry.old_values ? JSON.parse(entry.old_values) : null,
      new_values: entry.new_values ? JSON.parse(entry.new_values) : null
    }));
  }
}

let regulatedFlowsRepositoryInstance: RegulatedFlowsRepository | null = null;

export function getRegulatedFlowsRepository(): RegulatedFlowsRepository {
  if (!regulatedFlowsRepositoryInstance) {
    regulatedFlowsRepositoryInstance = new RegulatedFlowsRepository();
  }
  return regulatedFlowsRepositoryInstance;
}

