/**
 * ============================================================================
 * DIAGNOSTIC SAMPLES REPOSITORY
 * ============================================================================
 * 
 * Repository for diagnostic sample collection with chain of custody tracking.
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ Chain of custody enforced
 * ✅ State transitions validated
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery, withTransaction } from "../db.ts";

// ============================================================================
// TYPES
// ============================================================================

export interface DiagnosticSample {
  id: string;
  sample_number: string;
  booking_id: string;
  pet_id: string;
  customer_id: string;
  vendor_id: string;
  staff_id?: string | null;
  sample_type: 'blood' | 'urine' | 'stool' | 'tissue' | 'swab' | 'other';
  test_types: string[];
  collection_method?: string | null;
  collection_notes?: string | null;
  collection_date: string;
  collection_time: string;
  collection_address: string;
  collector_name?: string | null;
  collector_id?: string | null;
  collector_role?: 'staff' | 'vendor' | 'customer' | 'lab_technician' | null;
  custody_status: 'collected' | 'packaged' | 'in_transit_to_lab' | 'received_at_lab' | 'processing' | 'processed' | 'disposed';
  custody_transfers: any[];
  storage_temperature?: string | null;
  storage_conditions?: string | null;
  expiry_date?: string | null;
  status: 'pending_collection' | 'collected' | 'in_transit' | 'received_at_lab' | 'processing' | 'completed' | 'failed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface CreateDiagnosticSampleInput {
  booking_id: string;
  pet_id: string;
  customer_id: string;
  vendor_id: string;
  staff_id?: string;
  sample_type: DiagnosticSample['sample_type'];
  test_types: string[];
  collection_method?: string;
  collection_notes?: string;
  collection_date: string;
  collection_time: string;
  collection_address: string;
  collector_name?: string;
  collector_id?: string;
  collector_role?: DiagnosticSample['collector_role'];
  storage_temperature?: string;
  storage_conditions?: string;
  expiry_date?: string;
}

export interface CustodyTransfer {
  from: string;
  to: string;
  timestamp: string;
  signature?: string;
  notes?: string;
}

// ============================================================================
// REPOSITORY
// ============================================================================

export class DiagnosticSamplesRepository {
  private db = getDbClient();

  /**
   * Generate unique sample number
   */
  private generateSampleNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `SAMPLE-${year}${month}${day}-${random}`;
  }

  /**
   * Validate custody status transition
   */
  private validateCustodyTransition(currentStatus: DiagnosticSample['custody_status'], newStatus: DiagnosticSample['custody_status']): boolean {
    const validTransitions: Record<string, string[]> = {
      'collected': ['packaged', 'disposed'],
      'packaged': ['in_transit_to_lab', 'disposed'],
      'in_transit_to_lab': ['received_at_lab', 'disposed'],
      'received_at_lab': ['processing', 'disposed'],
      'processing': ['processed', 'disposed'],
      'processed': ['disposed'],
      'disposed': [],
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  /**
   * Create diagnostic sample
   */
  async create(input: CreateDiagnosticSampleInput): Promise<DiagnosticSample> {
    const sampleNumber = this.generateSampleNumber();

    const results = await insertQuery<DiagnosticSample>("diagnostic_samples", {
      sample_number: sampleNumber,
      booking_id: input.booking_id,
      pet_id: input.pet_id,
      customer_id: input.customer_id,
      vendor_id: input.vendor_id,
      staff_id: input.staff_id || null,
      sample_type: input.sample_type,
      test_types: input.test_types,
      collection_method: input.collection_method || null,
      collection_notes: input.collection_notes || null,
      collection_date: input.collection_date,
      collection_time: input.collection_time,
      collection_address: input.collection_address,
      collector_name: input.collector_name || null,
      collector_id: input.collector_id || null,
      collector_role: input.collector_role || null,
      custody_status: 'collected',
      custody_transfers: [],
      storage_temperature: input.storage_temperature || null,
      storage_conditions: input.storage_conditions || null,
      expiry_date: input.expiry_date || null,
      status: 'pending_collection',
    });

    if (!results[0]) {
      throw new Error("Failed to create diagnostic sample");
    }

    return results[0];
  }

  /**
   * Update custody status with transfer record
   */
  async transferCustody(
    sampleId: string,
    newStatus: DiagnosticSample['custody_status'],
    transfer: CustodyTransfer
  ): Promise<boolean> {
    const sample = await this.getById(sampleId);
    if (!sample) {
      throw new Error("Diagnostic sample not found");
    }

    if (!this.validateCustodyTransition(sample.custody_status, newStatus)) {
      throw new Error(`Invalid custody transition from ${sample.custody_status} to ${newStatus}`);
    }

    const transfers = [...(sample.custody_transfers || []), transfer];

    await updateQuery<DiagnosticSample>(
      "diagnostic_samples",
      {
        custody_status: newStatus,
        custody_transfers: transfers,
        updated_at: new Date().toISOString(),
      },
      { id: sampleId }
    );

    return true;
  }

  /**
   * Update sample status
   */
  async updateStatus(
    sampleId: string,
    status: DiagnosticSample['status']
  ): Promise<boolean> {
    const validTransitions: Record<string, string[]> = {
      'pending_collection': ['collected', 'cancelled'],
      'collected': ['in_transit', 'cancelled'],
      'in_transit': ['received_at_lab', 'failed', 'cancelled'],
      'received_at_lab': ['processing', 'failed', 'cancelled'],
      'processing': ['completed', 'failed', 'cancelled'],
      'completed': [],
      'failed': ['cancelled'],
      'cancelled': [],
    };

    const sample = await this.getById(sampleId);
    if (!sample) {
      throw new Error("Diagnostic sample not found");
    }

    if (!validTransitions[sample.status]?.includes(status)) {
      throw new Error(`Invalid status transition from ${sample.status} to ${status}`);
    }

    await updateQuery<DiagnosticSample>(
      "diagnostic_samples",
      {
        status,
        updated_at: new Date().toISOString(),
      },
      { id: sampleId }
    );

    return true;
  }

  /**
   * Get diagnostic sample by ID
   */
  async getById(sampleId: string): Promise<DiagnosticSample | null> {
    const results = await selectQuery<DiagnosticSample>(
      "SELECT * FROM diagnostic_samples WHERE id = $1",
      [sampleId]
    );

    return results && results.length > 0 ? results[0] : null;
  }

  /**
   * Get samples by booking ID
   */
  async getByBookingId(bookingId: string): Promise<DiagnosticSample[]> {
    const results = await selectQuery<DiagnosticSample>(
      "SELECT * FROM diagnostic_samples WHERE booking_id = $1 ORDER BY created_at DESC",
      [bookingId]
    );

    return results || [];
  }

  /**
   * Get samples by pet ID
   */
  async getByPetId(petId: string): Promise<DiagnosticSample[]> {
    const results = await selectQuery<DiagnosticSample>(
      "SELECT * FROM diagnostic_samples WHERE pet_id = $1 ORDER BY created_at DESC",
      [petId]
    );

    return results || [];
  }

  /**
   * Get chain of custody for sample
   */
  async getChainOfCustody(sampleId: string): Promise<CustodyTransfer[]> {
    const sample = await this.getById(sampleId);
    if (!sample) {
      return [];
    }

    return sample.custody_transfers || [];
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let diagnosticSamplesRepositoryInstance: DiagnosticSamplesRepository | null = null;

export function getDiagnosticSamplesRepository(): DiagnosticSamplesRepository {
  if (!diagnosticSamplesRepositoryInstance) {
    diagnosticSamplesRepositoryInstance = new DiagnosticSamplesRepository();
  }
  return diagnosticSamplesRepositoryInstance;
}

