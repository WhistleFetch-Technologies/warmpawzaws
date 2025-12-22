/**
 * ============================================================================
 * KV MIGRATION HELPER
 * ============================================================================
 * 
 * Helper functions to migrate from KV to SQL
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery } from "../db.ts";

/**
 * Migration mapping: KV key pattern → SQL table
 */
export const KV_TO_SQL_MAPPING: Record<string, { table: string; idField: string }> = {
  'customer:': { table: 'customers', idField: 'id' },
  'vendor:': { table: 'vendors', idField: 'id' },
  'booking:': { table: 'bookings', idField: 'id' },
  'payment:': { table: 'payments', idField: 'id' },
  'service:': { table: 'services', idField: 'id' },
  'staff:': { table: 'staff', idField: 'id' },
  'order:': { table: 'orders', idField: 'id' },
  'refund:': { table: 'refunds', idField: 'id' },
  'settlement:': { table: 'settlements', idField: 'id' },
  'payout:': { table: 'payouts', idField: 'id' },
};

/**
 * Convert KV key to SQL table and ID
 */
export function kvKeyToSQL(key: string): { table: string; id: string } | null {
  for (const [prefix, mapping] of Object.entries(KV_TO_SQL_MAPPING)) {
    if (key.startsWith(prefix)) {
      const id = key.substring(prefix.length);
      return { table: mapping.table, id };
    }
  }
  return null;
}

/**
 * Get entity from SQL (replaces kv.get)
 */
export async function getEntityFromSQL(key: string): Promise<any> {
  const sql = kvKeyToSQL(key);
  if (!sql) {
    throw new Error(`Unknown KV key pattern: ${key}`);
  }
  
  const results = await selectQuery(
    `SELECT * FROM ${sql.table} WHERE ${KV_TO_SQL_MAPPING[`${key.split(':')[0]}:`].idField} = $1`,
    [sql.id]
  );
  
  return results[0] || null;
}

/**
 * Set entity in SQL (replaces kv.set)
 */
export async function setEntityInSQL(key: string, data: any): Promise<void> {
  const sql = kvKeyToSQL(key);
  if (!sql) {
    throw new Error(`Unknown KV key pattern: ${key}`);
  }
  
  const idField = KV_TO_SQL_MAPPING[`${key.split(':')[0]}:`].idField;
  
  // Check if exists
  const existing = await selectQuery(
    `SELECT * FROM ${sql.table} WHERE ${idField} = $1`,
    [sql.id]
  );
  
  if (existing && existing.length > 0) {
    // Update
    await updateQuery(sql.table, { [idField]: sql.id }, data);
  } else {
    // Insert
    await insertQuery(sql.table, { ...data, [idField]: sql.id });
  }
}

/**
 * Delete entity from SQL (replaces kv.delete)
 */
export async function deleteEntityFromSQL(key: string): Promise<void> {
  const sql = kvKeyToSQL(key);
  if (!sql) {
    throw new Error(`Unknown KV key pattern: ${key}`);
  }
  
  const idField = KV_TO_SQL_MAPPING[`${key.split(':')[0]}:`].idField;
  
  await getDbClient()
    .from(sql.table)
    .delete()
    .eq(idField, sql.id);
}

