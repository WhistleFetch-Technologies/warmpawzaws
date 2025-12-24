/**
 * ============================================================================
 * BOARDING FACILITIES REPOSITORY
 * ============================================================================
 * 
 * Repository for boarding facilities configuration.
 * Replaces: vendor:{id}:boarding:facilities KV keys
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

export interface BoardingFacility {
  id: string;
  vendor_id: string;
  has_daycare: boolean;
  has_boarding: boolean;
  amenities: any[];
  created_at: string;
  updated_at: string;
}

export interface CreateBoardingFacilityInput {
  vendor_id: string;
  has_daycare?: boolean;
  has_boarding?: boolean;
  amenities?: any[];
}

export class BoardingFacilitiesRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findByVendor(vendorId: string): Promise<BoardingFacility | null> {
    const results = await selectQuery<BoardingFacility>("boarding_facilities", 
      { vendor_id: vendorId }, 
      { limit: 1 }
    );
    return results[0] || null;
  }

  async create(input: CreateBoardingFacilityInput): Promise<BoardingFacility> {
    const results = await insertQuery<BoardingFacility>("boarding_facilities", {
      ...input,
      has_daycare: input.has_daycare || false,
      has_boarding: input.has_boarding || false,
      amenities: input.amenities || [],
    });
    
    if (!results[0]) {
      throw new Error("Failed to create boarding facility");
    }
    
    return results[0];
  }

  async update(vendorId: string, updates: Partial<CreateBoardingFacilityInput>): Promise<BoardingFacility> {
    const results = await updateQuery<BoardingFacility>(
      "boarding_facilities",
      { vendor_id: vendorId },
      {
        ...updates,
        updated_at: new Date().toISOString(),
      }
    );
    
    if (!results[0]) {
      // If doesn't exist, create it
      return this.create({ vendor_id: vendorId, ...updates });
    }
    
    return results[0];
  }
}

let repositoryInstance: BoardingFacilitiesRepository | null = null;

export function getBoardingFacilitiesRepository(client?: SupabaseClient): BoardingFacilitiesRepository {
  if (!repositoryInstance) {
    repositoryInstance = new BoardingFacilitiesRepository(client);
  }
  return repositoryInstance;
}

