import { query } from '../database/rds-connection';

const columnExistsCache = new Map<string, boolean>();

/** Cached information_schema probe — safe when prod/dev lag migrations. */
export async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const key = `${tableName}.${columnName}`;
  if (columnExistsCache.has(key)) return columnExistsCache.get(key) as boolean;
  try {
    const res = await query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
       ) as exists`,
      [tableName, columnName]
    );
    const exists = res.rows?.[0]?.exists === true || res.rows?.[0]?.exists === 't';
    columnExistsCache.set(key, exists);
    return exists;
  } catch {
    columnExistsCache.set(key, false);
    return false;
  }
}
