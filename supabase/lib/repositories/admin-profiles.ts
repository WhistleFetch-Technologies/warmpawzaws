/**
 * ============================================================================
 * ADMIN PROFILES REPOSITORY
 * ============================================================================
 * 
 * Repository for admin profile data access.
 * Replaces: admin:{adminId}, admin:user:{userId} KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2024-12-24
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface AdminProfile {
  id: string;
  admin_id: string;
  user_id: string;
  profile_data: any; // JSONB
  created_at: string;
  updated_at: string;
}

export interface CreateAdminProfileInput {
  admin_id: string;
  user_id: string;
  profile_data: any;
}

export class AdminProfilesRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findByAdminId(adminId: string): Promise<AdminProfile | null> {
    const results = await selectQuery<AdminProfile>(
      "admin_profiles",
      { admin_id: adminId },
      { limit: 1 }
    );
    return results[0] || null;
  }

  async findByUserId(userId: string): Promise<AdminProfile | null> {
    const results = await selectQuery<AdminProfile>(
      "admin_profiles",
      { user_id: userId },
      { limit: 1 }
    );
    return results[0] || null;
  }

  async create(input: CreateAdminProfileInput): Promise<AdminProfile> {
    const results = await insertQuery<AdminProfile>("admin_profiles", {
      admin_id: input.admin_id,
      user_id: input.user_id,
      profile_data: input.profile_data,
    });
    
    if (!results[0]) {
      throw new Error("Failed to create admin profile");
    }
    
    return results[0];
  }

  async update(adminId: string, profileData: any): Promise<AdminProfile> {
    const results = await updateQuery<AdminProfile>(
      "admin_profiles",
      { admin_id: adminId },
      { 
        profile_data: profileData,
        updated_at: new Date().toISOString()
      }
    );
    
    if (!results[0]) {
      throw new Error(`Admin profile not found: ${adminId}`);
    }
    
    return results[0];
  }

  async upsert(input: CreateAdminProfileInput): Promise<AdminProfile> {
    // Check if exists
    const existing = await this.findByAdminId(input.admin_id) || await this.findByUserId(input.user_id);
    
    if (existing) {
      return await this.update(input.admin_id, input.profile_data);
    } else {
      return await this.create(input);
    }
  }
}

let repositoryInstance: AdminProfilesRepository | null = null;

export function getAdminProfilesRepository(): AdminProfilesRepository {
  if (!repositoryInstance) {
    repositoryInstance = new AdminProfilesRepository();
  }
  return repositoryInstance;
}

