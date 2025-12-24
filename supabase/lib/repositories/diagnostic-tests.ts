/**
 * ============================================================================
 * DIAGNOSTIC TESTS REPOSITORY
 * ============================================================================
 * 
 * Repository for diagnostic tests catalog management.
 * Replaces: vendor:{id}:diagnostics:tests KV keys
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

export interface DiagnosticTest {
  id: string;
  vendor_id: string;
  test_name: string;
  test_code?: string;
  category?: string;
  description?: string;
  price?: number;
  duration_minutes?: number;
  sample_type?: string;
  preparation_instructions?: string;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateDiagnosticTestInput {
  vendor_id: string;
  test_name: string;
  test_code?: string;
  category?: string;
  description?: string;
  price?: number;
  duration_minutes?: number;
  sample_type?: string;
  preparation_instructions?: string;
  is_available?: boolean;
}

export class DiagnosticTestsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findByVendor(vendorId: string): Promise<DiagnosticTest[]> {
    return selectQuery<DiagnosticTest>("diagnostic_tests", 
      { vendor_id: vendorId }, 
      { orderBy: "created_at", orderDirection: "desc" }
    );
  }

  async findById(testId: string): Promise<DiagnosticTest | null> {
    const results = await selectQuery<DiagnosticTest>("diagnostic_tests", 
      { id: testId }, 
      { limit: 1 }
    );
    return results[0] || null;
  }

  async create(input: CreateDiagnosticTestInput): Promise<DiagnosticTest> {
    const results = await insertQuery<DiagnosticTest>("diagnostic_tests", {
      ...input,
      is_available: input.is_available !== false,
    });
    
    if (!results[0]) {
      throw new Error("Failed to create diagnostic test");
    }
    
    return results[0];
  }

  async update(testId: string, updates: Partial<CreateDiagnosticTestInput>): Promise<DiagnosticTest> {
    const results = await updateQuery<DiagnosticTest>(
      "diagnostic_tests",
      { id: testId },
      {
        ...updates,
        updated_at: new Date().toISOString(),
      }
    );
    
    if (!results[0]) {
      throw new Error(`Diagnostic test not found: ${testId}`);
    }
    
    return results[0];
  }
}

let repositoryInstance: DiagnosticTestsRepository | null = null;

export function getDiagnosticTestsRepository(client?: SupabaseClient): DiagnosticTestsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new DiagnosticTestsRepository(client);
  }
  return repositoryInstance;
}

