/**
 * ============================================================================
 * AMBULANCE DRIVERS REPOSITORY
 * ============================================================================
 * 
 * Repository for ambulance driver management.
 * Replaces: ambulance:driver:{driverId} KV keys
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

export interface AmbulanceDriver {
  id: string;
  driver_id: string;
  vendor_id: string;
  name: string;
  phone: string;
  license_number: string;
  is_available: boolean;
  current_location?: any;
  current_booking_id?: string | null;
  rating: number;
  total_trips: number;
  specialization: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateAmbulanceDriverInput {
  driver_id: string;
  vendor_id: string;
  name: string;
  phone: string;
  license_number: string;
  is_available?: boolean;
  current_location?: any;
  specialization?: string[];
}

export class AmbulanceDriversRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findByVendor(vendorId: string): Promise<AmbulanceDriver[]> {
    return selectQuery<AmbulanceDriver>("ambulance_drivers", 
      { vendor_id: vendorId }, 
      { orderBy: "created_at", orderDirection: "desc" }
    );
  }

  async findById(driverId: string): Promise<AmbulanceDriver | null> {
    const results = await selectQuery<AmbulanceDriver>("ambulance_drivers", 
      { driver_id: driverId }, 
      { limit: 1 }
    );
    return results[0] || null;
  }

  async findByDriverId(driverId: string): Promise<AmbulanceDriver | null> {
    return this.findById(driverId);
  }

  async findAvailable(vendorId?: string): Promise<AmbulanceDriver[]> {
    const conditions: any = { is_available: true };
    if (vendorId) {
      conditions.vendor_id = vendorId;
    }
    return selectQuery<AmbulanceDriver>("ambulance_drivers", 
      conditions, 
      { orderBy: "rating", orderDirection: "desc" }
    );
  }

  async create(input: CreateAmbulanceDriverInput): Promise<AmbulanceDriver> {
    const results = await insertQuery<AmbulanceDriver>("ambulance_drivers", {
      ...input,
      is_available: input.is_available !== false,
      rating: 5.0,
      total_trips: 0,
      specialization: input.specialization || [],
    });
    
    if (!results[0]) {
      throw new Error("Failed to create ambulance driver");
    }
    
    return results[0];
  }

  async update(driverId: string, updates: Partial<CreateAmbulanceDriverInput & { 
    is_available?: boolean; 
    rating?: number; 
    total_trips?: number;
    current_location?: any;
    current_booking_id?: string | null;
  }>): Promise<AmbulanceDriver> {
    const results = await updateQuery<AmbulanceDriver>(
      "ambulance_drivers",
      { driver_id: driverId },
      {
        ...updates,
        updated_at: new Date().toISOString(),
      }
    );
    
    if (!results[0]) {
      throw new Error(`Ambulance driver not found: ${driverId}`);
    }
    
    return results[0];
  }

  async findAll(): Promise<AmbulanceDriver[]> {
    return selectQuery<AmbulanceDriver>("ambulance_drivers", {}, {
      orderBy: "created_at",
      orderDirection: "desc"
    });
  }
}

let repositoryInstance: AmbulanceDriversRepository | null = null;

export function getAmbulanceDriversRepository(client?: SupabaseClient): AmbulanceDriversRepository {
  if (!repositoryInstance) {
    repositoryInstance = new AmbulanceDriversRepository(client);
  }
  return repositoryInstance;
}

