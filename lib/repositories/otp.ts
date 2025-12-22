/**
 * ============================================================================
 * OTP REPOSITORY
 * ============================================================================
 * 
 * Repository for OTP token data access.
 * Replaces: otp:{phone} KV keys
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

export interface OtpToken {
  id: string;
  phone?: string | null;
  email?: string | null;
  otp_code: string;
  otp_type: string;
  expires_at: string;
  attempts: number;
  max_attempts: number;
  is_used: boolean;
  used_at?: string | null;
  created_at: string;
}

export interface CreateOtpInput {
  phone?: string;
  email?: string;
  otp_code: string;
  otp_type?: string;
  expires_in_minutes?: number;
  max_attempts?: number;
}

export class OtpRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findByPhone(phone: string, otpType?: string): Promise<OtpToken | null> {
    const filters: any = { phone };
    if (otpType) {
      filters.otp_type = otpType;
    }
    const results = await selectQuery<OtpToken>("otp_tokens", filters, { 
      limit: 1,
      orderBy: "created_at",
      orderDirection: "desc",
    });
    return results[0] || null;
  }

  async findByEmail(email: string, otpType?: string): Promise<OtpToken | null> {
    const filters: any = { email };
    if (otpType) {
      filters.otp_type = otpType;
    }
    const results = await selectQuery<OtpToken>("otp_tokens", filters, { 
      limit: 1,
      orderBy: "created_at",
      orderDirection: "desc",
    });
    return results[0] || null;
  }

  async create(input: CreateOtpInput): Promise<OtpToken> {
    const expiresIn = input.expires_in_minutes || 5;
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiresIn);

    const results = await insertQuery<OtpToken>("otp_tokens", {
      phone: input.phone || undefined,
      email: input.email || undefined,
      otp_code: input.otp_code,
      otp_type: input.otp_type || "login",
      expires_at: expiresAt.toISOString(),
      attempts: 0,
      max_attempts: input.max_attempts || 3,
      is_used: false,
    });
    
    if (!results[0]) {
      throw new Error("Failed to create OTP token");
    }
    
    return results[0];
  }

  async verify(phoneOrEmail: string, otpCode: string, isPhone: boolean = true): Promise<boolean> {
    const token = isPhone 
      ? await this.findByPhone(phoneOrEmail)
      : await this.findByEmail(phoneOrEmail);
    
    if (!token) {
      return false;
    }

    // Check if expired
    if (new Date(token.expires_at) < new Date()) {
      return false;
    }

    // Check if already used
    if (token.is_used) {
      return false;
    }

    // Check if max attempts exceeded
    if (token.attempts >= token.max_attempts) {
      return false;
    }

    // Increment attempts
    await this.incrementAttempts(token.id);

    // Verify code
    if (token.otp_code !== otpCode) {
      return false;
    }

    // Mark as used
    await this.markAsUsed(token.id);

    return true;
  }

  async incrementAttempts(otpId: string): Promise<void> {
    await updateQuery<OtpToken>(
      "otp_tokens",
      { id: otpId },
      {
        attempts: getDbClient().rpc('increment', { column: 'attempts', table: 'otp_tokens', id: otpId }),
      }
    );
  }

  async markAsUsed(otpId: string): Promise<void> {
    await updateQuery<OtpToken>(
      "otp_tokens",
      { id: otpId },
      {
        is_used: true,
        used_at: new Date().toISOString(),
      }
    );
  }

  async deleteExpired(): Promise<void> {
    const client = getDbClient();
    await client
      .from("otp_tokens")
      .delete()
      .lt("expires_at", new Date().toISOString());
  }
}

let repositoryInstance: OtpRepository | null = null;

export function getOtpRepository(): OtpRepository {
  if (!repositoryInstance) {
    repositoryInstance = new OtpRepository();
  }
  return repositoryInstance;
}

