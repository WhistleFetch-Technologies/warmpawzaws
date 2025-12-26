/**
 * ============================================================================
 * DIAGNOSTIC BOOKINGS REPOSITORY
 * ============================================================================
 * 
 * Repository for diagnostic test bookings.
 * Replaces: diagnostics:booking:{bookingId} KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2024-12-24
 * Migration: Phase 2 - KV to SQL
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface DiagnosticBooking {
  id: string;
  customer_id: string;
  pet_id: string;
  vendor_id: string;
  center_id?: string | null;
  booking_number: string;
  tests: any[]; // JSONB array of { testId, testName, price }
  booking_type: 'home_collection' | 'center_visit';
  scheduled_date: string;
  scheduled_time: string;
  collection_address?: any;
  prescription_id?: string | null;
  prescription_url?: string | null;
  special_instructions?: string | null;
  status: string;
  status_changed_at: string;
  status_changed_by?: string | null;
  status_change_reason?: string | null;
  collector_id?: string | null;
  collector_name?: string | null;
  sample_collection_time?: string | null;
  reports?: any[];
  report_generation_time?: string | null;
  all_reports_uploaded: boolean;
  total_amount: number;
  home_collection_charge: number;
  payment_status: 'pending' | 'paid' | 'refunded';
  created_at: string;
  updated_at: string;
}

export interface CreateDiagnosticBookingInput {
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
  total_amount: number;
  home_collection_charge?: number;
  payment_status?: 'pending' | 'paid' | 'refunded';
}

export class DiagnosticBookingsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findById(bookingId: string): Promise<DiagnosticBooking | null> {
    const results = await selectQuery<DiagnosticBooking>("diagnostic_bookings", 
      { id: bookingId }, 
      { limit: 1 }
    );
    return results[0] || null;
  }

  async findByBookingNumber(bookingNumber: string): Promise<DiagnosticBooking | null> {
    const results = await selectQuery<DiagnosticBooking>("diagnostic_bookings", 
      { booking_number: bookingNumber }, 
      { limit: 1 }
    );
    return results[0] || null;
  }

  async findByCustomer(customerId: string, options?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<DiagnosticBooking[]> {
    const filters: any = { customer_id: customerId };
    if (options?.status) {
      filters.status = options.status;
    }
    
    return selectQuery<DiagnosticBooking>("diagnostic_bookings", filters, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc"
    });
  }

  async findByVendor(vendorId: string, options?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<DiagnosticBooking[]> {
    const filters: any = { vendor_id: vendorId };
    if (options?.status) {
      filters.status = options.status;
    }
    
    return selectQuery<DiagnosticBooking>("diagnostic_bookings", filters, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc"
    });
  }

  async create(input: CreateDiagnosticBookingInput): Promise<DiagnosticBooking> {
    const results = await insertQuery<DiagnosticBooking>("diagnostic_bookings", {
      ...input,
      status: 'scheduled',
      all_reports_uploaded: false,
      home_collection_charge: input.home_collection_charge || 0,
      payment_status: input.payment_status || 'pending',
    });
    
    if (!results[0]) {
      throw new Error("Failed to create diagnostic booking");
    }
    
    return results[0];
  }

  async update(bookingId: string, updates: Partial<CreateDiagnosticBookingInput & {
    status?: string;
    collector_id?: string;
    collector_name?: string;
    sample_collection_time?: string;
    reports?: any[];
    report_generation_time?: string;
    all_reports_uploaded?: boolean;
    payment_status?: 'pending' | 'paid' | 'refunded';
  }>): Promise<DiagnosticBooking> {
    const updateData: any = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    // Handle status change tracking
    if (updates.status) {
      updateData.status_changed_at = new Date().toISOString();
    }

    const results = await updateQuery<DiagnosticBooking>(
      "diagnostic_bookings",
      { id: bookingId },
      updateData
    );
    
    if (!results[0]) {
      throw new Error(`Diagnostic booking not found: ${bookingId}`);
    }
    
    return results[0];
  }

  async findAll(options?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<DiagnosticBooking[]> {
    const filters: any = {};
    if (options?.status) {
      filters.status = options.status;
    }
    
    return selectQuery<DiagnosticBooking>("diagnostic_bookings", filters, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc"
    });
  }
}

let repositoryInstance: DiagnosticBookingsRepository | null = null;

export function getDiagnosticBookingsRepository(client?: SupabaseClient): DiagnosticBookingsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new DiagnosticBookingsRepository(client);
  }
  return repositoryInstance;
}

