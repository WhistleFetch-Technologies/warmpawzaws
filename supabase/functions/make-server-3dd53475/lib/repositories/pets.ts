/**
 * ============================================================================
 * PETS REPOSITORY
 * ============================================================================
 * 
 * Repository for pet data access.
 * Replaces: pet:{petId}, customer:{id}:pets KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2024-12-22
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery, deleteQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface Pet {
  id: string;
  customer_id: string;
  name: string;
  type?: string | null;
  breed?: string | null;
  age?: number | null;
  gender?: string | null;
  weight?: number | null;
  color?: string | null;
  photo_url?: string | null;
  medical_conditions?: any;
  allergies?: any;
  vaccinations?: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePetInput {
  customer_id: string;
  name: string;
  type?: string;
  breed?: string;
  age?: number;
  gender?: string;
  weight?: number;
  color?: string;
  photo_url?: string;
  medical_conditions?: any;
  allergies?: any;
  vaccinations?: any;
}

export class PetsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findById(petId: string): Promise<Pet | null> {
    const results = await selectQuery<Pet>("pets", { id: petId }, { limit: 1 });
    return results[0] || null;
  }

  async findByCustomer(customerId: string, options?: { limit?: number; offset?: number }): Promise<Pet[]> {
    return selectQuery<Pet>("pets", { customer_id: customerId, is_active: true }, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc",
    });
  }

  async create(input: CreatePetInput): Promise<Pet> {
    const results = await insertQuery<Pet>("pets", {
      ...input,
      is_active: true,
    });
    
    if (!results[0]) {
      throw new Error("Failed to create pet");
    }
    
    return results[0];
  }

  async update(petId: string, input: Partial<CreatePetInput>): Promise<Pet> {
    const results = await updateQuery<Pet>(
      "pets",
      { id: petId },
      {
        ...input,
        updated_at: new Date().toISOString(),
      }
    );
    
    if (!results[0]) {
      throw new Error(`Pet not found: ${petId}`);
    }
    
    return results[0];
  }

  async delete(petId: string): Promise<void> {
    await this.update(petId, { is_active: false });
  }
}

let repositoryInstance: PetsRepository | null = null;

export function getPetsRepository(): PetsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new PetsRepository();
  }
  return repositoryInstance;
}

