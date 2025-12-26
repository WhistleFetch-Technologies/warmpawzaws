/**
 * ============================================================================
 * ACCESS TOKENS REPOSITORY
 * ============================================================================
 * 
 * Repository for access token data access.
 * Replaces: token:{token}, token:user:{userId} KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2024-12-24
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery, deleteQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface AccessToken {
  id: string;
  token: string;
  user_id: string;
  user_type: string;
  phone?: string | null;
  role?: string | null;
  expires_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAccessTokenInput {
  token: string;
  user_id: string;
  user_type: string;
  phone?: string;
  role?: string;
  expires_at: string;
}

export class AccessTokensRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findByToken(token: string): Promise<AccessToken | null> {
    const results = await selectQuery<AccessToken>(
      "access_tokens",
      { token, is_active: true },
      { limit: 1 }
    );
    return results[0] || null;
  }

  async findByUser(userId: string, userType: string): Promise<AccessToken | null> {
    const results = await selectQuery<AccessToken>(
      "access_tokens",
      { user_id: userId, user_type: userType, is_active: true },
      { 
        limit: 1,
        orderBy: "created_at",
        orderDirection: "desc"
      }
    );
    return results[0] || null;
  }

  async create(input: CreateAccessTokenInput): Promise<AccessToken> {
    const results = await insertQuery<AccessToken>("access_tokens", {
      token: input.token,
      user_id: input.user_id,
      user_type: input.user_type,
      phone: input.phone || null,
      role: input.role || null,
      expires_at: input.expires_at,
      is_active: true,
    });
    
    if (!results[0]) {
      throw new Error("Failed to create access token");
    }
    
    return results[0];
  }

  async invalidate(token: string): Promise<void> {
    await updateQuery(
      "access_tokens",
      { token },
      { is_active: false }
    );
  }

  async delete(token: string): Promise<void> {
    await deleteQuery("access_tokens", { token });
  }

  async deleteByUser(userId: string): Promise<void> {
    await deleteQuery("access_tokens", { user_id: userId });
  }

  async deleteExpired(): Promise<void> {
    const client = getDbClient();
    await client
      .from("access_tokens")
      .delete()
      .lt("expires_at", new Date().toISOString());
  }
}

let repositoryInstance: AccessTokensRepository | null = null;

export function getAccessTokensRepository(): AccessTokensRepository {
  if (!repositoryInstance) {
    repositoryInstance = new AccessTokensRepository();
  }
  return repositoryInstance;
}

