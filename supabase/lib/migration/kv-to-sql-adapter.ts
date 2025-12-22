/**
 * ============================================================================
 * KV TO SQL ADAPTER
 * ============================================================================
 * 
 * This adapter provides a bridge between existing KV-based code and SQL.
 * It allows gradual migration by intercepting KV operations and routing
 * them to SQL instead.
 * 
 * USAGE:
 * Instead of: import * as kv from './kv_store.tsx'
 * Use: import { kvAdapter } from '../../lib/migration/kv-to-sql-adapter.ts'
 * 
 * The adapter automatically routes operations to SQL when data exists there,
 * falling back to KV only when necessary during migration.
 * 
 * Date: 2025-01-22
 * ============================================================================
 */

import { getDbClient } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

// KV store import (temporary bridge)
let kvStore: any = null;

async function getKVStore() {
  if (!kvStore) {
    kvStore = await import("../../supabase/functions/server/kv_store.tsx");
  }
  return kvStore;
}

/**
 * KV to SQL mapping patterns
 */
const KV_TO_SQL_MAP: Record<string, { table: string; idColumn: string }> = {
  'payment:': { table: 'payments', idColumn: 'id' },
  'booking:': { table: 'bookings', idColumn: 'id' },
  'vendor:': { table: 'vendors', idColumn: 'id' },
  'customer:': { table: 'customers', idColumn: 'id' },
  'service:': { table: 'services', idColumn: 'id' },
  'payout:': { table: 'payouts', idColumn: 'id' },
  'order:': { table: 'orders', idColumn: 'id' },
};

/**
 * Extract ID from KV key
 */
function extractId(key: string): string | null {
  for (const [pattern, config] of Object.entries(KV_TO_SQL_MAP)) {
    if (key.startsWith(pattern)) {
      return key.replace(pattern, '');
    }
  }
  return null;
}

/**
 * Get table name from KV key
 */
function getTableName(key: string): string | null {
  for (const [pattern, config] of Object.entries(KV_TO_SQL_MAP)) {
    if (key.startsWith(pattern)) {
      return config.table;
    }
  }
  return null;
}

/**
 * KV Adapter that routes to SQL
 */
export const kvAdapter = {
  /**
   * Get value - tries SQL first, falls back to KV
   */
  async get(key: string): Promise<any> {
    const table = getTableName(key);
    const id = extractId(key);
    
    if (table && id) {
      try {
        const client = getDbClient();
        const { data, error } = await client
          .from(table)
          .select('*')
          .eq('id', id)
          .single();
        
        if (!error && data) {
          console.log(`[KV-ADAPTER] ✅ Found in SQL: ${key}`);
          return data;
        }
      } catch (error) {
        console.log(`[KV-ADAPTER] ⚠️ SQL lookup failed for ${key}, falling back to KV`);
      }
    }
    
    // Fallback to KV
    const kv = await getKVStore();
    return await kv.get(key);
  },

  /**
   * Set value - writes to SQL, also updates KV for backward compatibility
   */
  async set(key: string, value: any): Promise<void> {
    const table = getTableName(key);
    const id = extractId(key);
    
    if (table && id) {
      try {
        const client = getDbClient();
        const { error } = await client
          .from(table)
          .upsert({
            id,
            ...value,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'id'
          });
        
        if (!error) {
          console.log(`[KV-ADAPTER] ✅ Saved to SQL: ${key}`);
        } else {
          throw error;
        }
      } catch (error) {
        console.error(`[KV-ADAPTER] ❌ SQL save failed for ${key}:`, error);
        // Fall through to KV fallback
      }
    }
    
    // Also update KV for backward compatibility during migration
    const kv = await getKVStore();
    await kv.set(key, value);
  },

  /**
   * Delete value - deletes from both SQL and KV
   */
  async del(key: string): Promise<void> {
    const table = getTableName(key);
    const id = extractId(key);
    
    if (table && id) {
      try {
        const client = getDbClient();
        await client
          .from(table)
          .delete()
          .eq('id', id);
        
        console.log(`[KV-ADAPTER] ✅ Deleted from SQL: ${key}`);
      } catch (error) {
        console.error(`[KV-ADAPTER] ❌ SQL delete failed for ${key}:`, error);
      }
    }
    
    // Also delete from KV
    const kv = await getKVStore();
    await kv.del(key);
  },

  /**
   * Get by prefix - queries SQL, falls back to KV
   */
  async getByPrefix(prefix: string): Promise<any[]> {
    const table = getTableName(prefix);
    
    if (table) {
      try {
        const client = getDbClient();
        const { data, error } = await client
          .from(table)
          .select('*');
        
        if (!error && data) {
          console.log(`[KV-ADAPTER] ✅ Found ${data.length} records in SQL for prefix: ${prefix}`);
          return data;
        }
      } catch (error) {
        console.log(`[KV-ADAPTER] ⚠️ SQL prefix lookup failed for ${prefix}, falling back to KV`);
      }
    }
    
    // Fallback to KV
    const kv = await getKVStore();
    return await kv.getByPrefix(prefix);
  },
};

/**
 * Migration helper: Check if data exists in SQL
 */
export async function isMigratedToSQL(key: string): Promise<boolean> {
  const table = getTableName(key);
  const id = extractId(key);
  
  if (!table || !id) {
    return false;
  }
  
  try {
    const client = getDbClient();
    const { data, error } = await client
      .from(table)
      .select('id')
      .eq('id', id)
      .single();
    
    return !error && !!data;
  } catch {
    return false;
  }
}

