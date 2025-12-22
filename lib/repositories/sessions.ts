/**
 * ============================================================================
 * SESSIONS REPOSITORY
 * ============================================================================
 * 
 * Repository for session data access.
 * Replaces: session:{sessionId}, session:customer:{id} KV keys
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

export interface Session {
  id: string;
  user_id: string;
  user_type: string;
  token: string;
  expires_at: string;
  is_active: boolean;
  created_at: string;
  last_accessed_at?: string | null;
}

export interface CreateSessionInput {
  user_id: string;
  user_type: string;
  token: string;
  expires_in_days?: number;
}

export class SessionsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findById(sessionId: string): Promise<Session | null> {
    const results = await selectQuery<Session>("sessions", { id: sessionId }, { limit: 1 });
    return results[0] || null;
  }

  async findByToken(token: string): Promise<Session | null> {
    const results = await selectQuery<Session>("sessions", { token, is_active: true }, { limit: 1 });
    return results[0] || null;
  }

  async findByUser(userId: string, userType: string, options?: { limit?: number }): Promise<Session[]> {
    return selectQuery<Session>("sessions", { user_id: userId, user_type: userType, is_active: true }, {
      limit: options?.limit,
      orderBy: "created_at",
      orderDirection: "desc",
    });
  }

  async create(input: CreateSessionInput): Promise<Session> {
    const expiresInDays = input.expires_in_days || 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const results = await insertQuery<Session>("sessions", {
      user_id: input.user_id,
      user_type: input.user_type,
      token: input.token,
      expires_at: expiresAt.toISOString(),
      is_active: true,
    });
    
    if (!results[0]) {
      throw new Error("Failed to create session");
    }
    
    return results[0];
  }

  async update(sessionId: string, input: Partial<CreateSessionInput & { is_active?: boolean; last_accessed_at?: string }>): Promise<Session> {
    const updateData: any = { ...input };
    
    if (input.last_accessed_at === undefined) {
      updateData.last_accessed_at = new Date().toISOString();
    }
    
    const results = await updateQuery<Session>(
      "sessions",
      { id: sessionId },
      updateData
    );
    
    if (!results[0]) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    return results[0];
  }

  async invalidate(sessionId: string): Promise<void> {
    await this.update(sessionId, { is_active: false });
  }

  async invalidateUserSessions(userId: string, userType: string): Promise<void> {
    const sessions = await this.findByUser(userId, userType);
    for (const session of sessions) {
      await this.invalidate(session.id);
    }
  }

  async deleteExpired(): Promise<void> {
    const client = getDbClient();
    await client
      .from("sessions")
      .delete()
      .lt("expires_at", new Date().toISOString());
  }
}

let repositoryInstance: SessionsRepository | null = null;

export function getSessionsRepository(): SessionsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new SessionsRepository();
  }
  return repositoryInstance;
}

