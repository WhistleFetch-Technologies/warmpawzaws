/**
 * ============================================================================
 * AMBULANCE VEHICLES REPOSITORY
 * ============================================================================
 * 
 * Repository for ambulance vehicle fleet management.
 * Replaces: vendor:{id}:ambulance:vehicles, ambulance:vehicle:{id} KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface AmbulanceVehicle {
  id: string;
  vendor_id: string;
  vehicle_number: string;
  vehicle_type: 'basic' | 'advanced' | 'critical_care';
  capacity: number;
  equipment: any[];
  current_location?: any;
  is_available: boolean;
  rating: number;
  total_trips: number;
  created_at: string;
  updated_at: string;
}

export interface CreateAmbulanceVehicleInput {
  vendor_id: string;
  vehicle_number: string;
  vehicle_type?: 'basic' | 'advanced' | 'critical_care';
  capacity?: number;
  equipment?: any[];
  current_location?: any;
  is_available?: boolean;
}

export class AmbulanceVehiclesRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findByVendor(vendorId: string): Promise<AmbulanceVehicle[]> {
    return selectQuery<AmbulanceVehicle>("ambulance_vehicles", 
      { vendor_id: vendorId }, 
      { orderBy: "created_at", orderDirection: "desc" }
    );
  }

  async findById(vehicleId: string): Promise<AmbulanceVehicle | null> {
    const results = await selectQuery<AmbulanceVehicle>("ambulance_vehicles", 
      { id: vehicleId }, 
      { limit: 1 }
    );
    return results[0] || null;
  }

  async create(input: CreateAmbulanceVehicleInput): Promise<AmbulanceVehicle> {
    const results = await insertQuery<AmbulanceVehicle>("ambulance_vehicles", {
      ...input,
      vehicle_type: input.vehicle_type || 'basic',
      capacity: input.capacity || 2,
      equipment: input.equipment || [],
      is_available: input.is_available !== false,
      rating: 5.0,
      total_trips: 0,
    });
    
    if (!results[0]) {
      throw new Error("Failed to create ambulance vehicle");
    }
    
    return results[0];
  }

  async update(vehicleId: string, updates: Partial<CreateAmbulanceVehicleInput & { is_available?: boolean; rating?: number; total_trips?: number }>): Promise<AmbulanceVehicle> {
    const results = await updateQuery<AmbulanceVehicle>(
      "ambulance_vehicles",
      { id: vehicleId },
      {
        ...updates,
        updated_at: new Date().toISOString(),
      }
    );
    
    if (!results[0]) {
      throw new Error(`Ambulance vehicle not found: ${vehicleId}`);
    }
    
    return results[0];
  }

  async findAll(): Promise<AmbulanceVehicle[]> {
    return selectQuery<AmbulanceVehicle>("ambulance_vehicles", {}, {
      orderBy: "created_at",
      orderDirection: "desc"
    });
  }
}

let repositoryInstance: AmbulanceVehiclesRepository | null = null;

export function getAmbulanceVehiclesRepository(client?: SupabaseClient): AmbulanceVehiclesRepository {
  if (!repositoryInstance) {
    repositoryInstance = new AmbulanceVehiclesRepository(client);
  }
  return repositoryInstance;
}

