/**
 * ============================================================================
 * PRESCRIPTIONS REPOSITORY
 * ============================================================================
 * 
 * Repository for prescriptions with IMMUTABILITY enforcement and audit logging.
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ Prescriptions are IMMUTABLE after creation
 * ✅ Complete audit trail for all access
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery, withTransaction } from "../db.ts";

// ============================================================================
// TYPES
// ============================================================================

export interface Prescription {
  id: string;
  prescription_number: string;
  booking_id: string;
  pet_id: string;
  customer_id: string;
  vendor_id: string;
  staff_id?: string | null;
  diagnosis?: string | null;
  observations?: string | null;
  medications: any[];
  products_used?: any;
  tests_recommended?: string[] | null;
  general_notes?: string | null;
  recommendations?: string | null;
  follow_up_date?: string | null;
  follow_up_reason?: string | null;
  vitals?: any;
  prescription_file_url?: string | null;
  attachments?: any;
  is_immutable: boolean;
  created_by: string;
  created_by_role: 'vendor' | 'staff' | 'admin';
  created_at: string;
  status: 'active' | 'expired' | 'cancelled' | 'replaced';
  expires_at?: string | null;
}

export interface CreatePrescriptionInput {
  booking_id: string;
  pet_id: string;
  customer_id: string;
  vendor_id: string;
  staff_id?: string;
  diagnosis?: string;
  observations?: string;
  medications: any[];
  products_used?: any;
  tests_recommended?: string[];
  general_notes?: string;
  recommendations?: string;
  follow_up_date?: string;
  follow_up_reason?: string;
  vitals?: any;
  prescription_file_url?: string;
  attachments?: any;
  created_by: string;
  created_by_role: Prescription['created_by_role'];
  expires_at?: string;
}

// ============================================================================
// REPOSITORY
// ============================================================================

export class PrescriptionsRepository {
  private db = getDbClient();

  /**
   * Generate unique prescription number
   */
  private generatePrescriptionNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `RX-${year}${month}${day}-${random}`;
  }

  /**
   * Check if user has permission to access prescription
   */
  async checkAccess(prescriptionId: string, actorId: string, actorRole: string): Promise<boolean> {
    const prescription = await selectQuery<Prescription>(
      "SELECT customer_id, vendor_id, created_by FROM prescriptions WHERE id = $1",
      [prescriptionId]
    );

    if (!prescription || prescription.length === 0) return false;
    const rx = prescription[0];

    // Admin has full access
    if (actorRole === 'admin') return true;

    // Customer can view their own prescriptions
    if (actorRole === 'customer') {
      return rx.customer_id === actorId;
    }

    // Vendor/Staff can view prescriptions they created or for their bookings
    if (actorRole === 'vendor' || actorRole === 'staff') {
      return rx.created_by === actorId || rx.vendor_id === actorId;
    }

    // Pharmacy can view prescriptions for medicine orders they're handling
    if (actorRole === 'pharmacy') {
      const order = await selectQuery<{ id: string }>(
        "SELECT id FROM medicine_orders WHERE prescription_id = $1 AND selected_pharmacy_id = $2",
        [prescriptionId, actorId]
      );
      return order && order.length > 0;
    }

    return false;
  }

  /**
   * Log prescription access/action
   */
  async logAccess(
    prescriptionId: string,
    action: 'created' | 'viewed' | 'downloaded' | 'shared' | 'expired' | 'cancelled' | 'replaced',
    actorId: string,
    actorRole: string,
    actorName?: string,
    ipAddress?: string,
    userAgent?: string,
    details?: any
  ): Promise<void> {
    await insertQuery("prescription_audit_log", {
      prescription_id: prescriptionId,
      action,
      actor_id: actorId,
      actor_role: actorRole,
      actor_name: actorName,
      ip_address: ipAddress,
      user_agent: userAgent,
      details: details || {}
    });
  }

  /**
   * Create prescription (IMMUTABLE after creation)
   */
  async create(input: CreatePrescriptionInput): Promise<Prescription> {
    const prescriptionNumber = this.generatePrescriptionNumber();

    const results = await insertQuery<Prescription>("prescriptions", {
      prescription_number: prescriptionNumber,
      booking_id: input.booking_id,
      pet_id: input.pet_id,
      customer_id: input.customer_id,
      vendor_id: input.vendor_id,
      staff_id: input.staff_id || null,
      diagnosis: input.diagnosis || null,
      observations: input.observations || null,
      medications: input.medications || [],
      products_used: input.products_used || [],
      tests_recommended: input.tests_recommended || [],
      general_notes: input.general_notes || null,
      recommendations: input.recommendations || null,
      follow_up_date: input.follow_up_date || null,
      follow_up_reason: input.follow_up_reason || null,
      vitals: input.vitals || null,
      prescription_file_url: input.prescription_file_url || null,
      attachments: input.attachments || [],
      is_immutable: true,
      created_by: input.created_by,
      created_by_role: input.created_by_role,
      status: 'active',
      expires_at: input.expires_at || null,
    });

    if (!results[0]) {
      throw new Error("Failed to create prescription");
    }

    // Log creation
    await this.logAccess(
      results[0].id,
      'created',
      input.created_by,
      input.created_by_role,
      undefined,
      undefined,
      undefined,
      { prescription_number: prescriptionNumber }
    );

    return results[0];
  }

  /**
   * Get prescription with access control
   */
  async getById(prescriptionId: string, actorId: string, actorRole: string): Promise<Prescription | null> {
    // Check access first
    const hasAccess = await this.checkAccess(prescriptionId, actorId, actorRole);
    
    if (!hasAccess) {
      await this.logAccess(prescriptionId, 'viewed', actorId, actorRole, undefined, undefined, undefined, { access_denied: true });
      return null;
    }

    const results = await selectQuery<Prescription>(
      "SELECT * FROM prescriptions WHERE id = $1",
      [prescriptionId]
    );

    if (results && results.length > 0) {
      // Log successful access
      await this.logAccess(prescriptionId, 'viewed', actorId, actorRole, undefined, undefined, undefined, { access_granted: true });
      return results[0];
    }

    return null;
  }

  /**
   * Get prescriptions by booking ID
   */
  async getByBookingId(bookingId: string, actorId: string, actorRole: string): Promise<Prescription[]> {
    const results = await selectQuery<Prescription>(
      "SELECT * FROM prescriptions WHERE booking_id = $1 ORDER BY created_at DESC",
      [bookingId]
    );

    // Filter by access and log
    const accessible: Prescription[] = [];
    for (const rx of results) {
      const hasAccess = await this.checkAccess(rx.id, actorId, actorRole);
      if (hasAccess) {
        accessible.push(rx);
        await this.logAccess(rx.id, 'viewed', actorId, actorRole, undefined, undefined, undefined, { access_granted: true });
      }
    }

    return accessible;
  }

  /**
   * Get prescriptions by pet ID
   */
  async getByPetId(petId: string, actorId: string, actorRole: string): Promise<Prescription[]> {
    const results = await selectQuery<Prescription>(
      "SELECT * FROM prescriptions WHERE pet_id = $1 AND status = 'active' ORDER BY created_at DESC",
      [petId]
    );

    // Filter by access and log
    const accessible: Prescription[] = [];
    for (const rx of results) {
      const hasAccess = await this.checkAccess(rx.id, actorId, actorRole);
      if (hasAccess) {
        accessible.push(rx);
        await this.logAccess(rx.id, 'viewed', actorId, actorRole, undefined, undefined, undefined, { access_granted: true });
      }
    }

    return accessible;
  }

  /**
   * Mark prescription as expired (only status change allowed)
   */
  async expire(prescriptionId: string, actorId: string, actorRole: string): Promise<boolean> {
    if (actorRole !== 'admin' && actorRole !== 'vendor') {
      await this.logAccess(prescriptionId, 'expired', actorId, actorRole, undefined, undefined, undefined, { access_denied: true });
      return false;
    }

    const results = await updateQuery<Prescription>(
      "prescriptions",
      { status: 'expired', updated_at: new Date().toISOString() },
      { id: prescriptionId }
    );

    if (results && results.length > 0) {
      await this.logAccess(prescriptionId, 'expired', actorId, actorRole, undefined, undefined, undefined, { status: 'expired' });
      return true;
    }

    return false;
  }

  /**
   * Cancel prescription (only status change allowed)
   */
  async cancel(prescriptionId: string, actorId: string, actorRole: string, reason?: string): Promise<boolean> {
    if (actorRole !== 'admin' && actorRole !== 'vendor') {
      await this.logAccess(prescriptionId, 'cancelled', actorId, actorRole, undefined, undefined, undefined, { access_denied: true });
      return false;
    }

    const results = await updateQuery<Prescription>(
      "prescriptions",
      { status: 'cancelled', updated_at: new Date().toISOString() },
      { id: prescriptionId }
    );

    if (results && results.length > 0) {
      await this.logAccess(prescriptionId, 'cancelled', actorId, actorRole, undefined, undefined, undefined, { reason });
      return true;
    }

    return false;
  }

  /**
   * Replace prescription (creates new, marks old as replaced)
   */
  async replace(oldPrescriptionId: string, newPrescription: CreatePrescriptionInput, actorId: string, actorRole: string): Promise<Prescription | null> {
    // Check access to old prescription
    const hasAccess = await this.checkAccess(oldPrescriptionId, actorId, actorRole);
    if (!hasAccess) {
      await this.logAccess(oldPrescriptionId, 'replaced', actorId, actorRole, undefined, undefined, undefined, { access_denied: true });
      return null;
    }

    // Create new prescription
    const newRx = await this.create(newPrescription);

    // Mark old as replaced
    await updateQuery<Prescription>(
      "prescriptions",
      { status: 'replaced', updated_at: new Date().toISOString() },
      { id: oldPrescriptionId }
    );

    await this.logAccess(oldPrescriptionId, 'replaced', actorId, actorRole, undefined, undefined, undefined, { replaced_by: newRx.id });
    await this.logAccess(newRx.id, 'created', actorId, actorRole, undefined, undefined, undefined, { replaces: oldPrescriptionId });

    return newRx;
  }

  /**
   * Log download action
   */
  async logDownload(prescriptionId: string, actorId: string, actorRole: string, actorName?: string): Promise<void> {
    await this.logAccess(prescriptionId, 'downloaded', actorId, actorRole, actorName, undefined, undefined, { action: 'download' });
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let prescriptionsRepositoryInstance: PrescriptionsRepository | null = null;

export function getPrescriptionsRepository(): PrescriptionsRepository {
  if (!prescriptionsRepositoryInstance) {
    prescriptionsRepositoryInstance = new PrescriptionsRepository();
  }
  return prescriptionsRepositoryInstance;
}

