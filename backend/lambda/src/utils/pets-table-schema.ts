import { query } from '../database/rds-connection';

const columnExistsCache = new Map<string, boolean>();

/** Cached check — prod may lag migrations (e.g. vaccination_records on pets). */
export async function petsTableHasColumn(column: string): Promise<boolean> {
  const key = `pets.${column}`;
  if (columnExistsCache.has(key)) {
    return columnExistsCache.get(key)!;
  }
  try {
    const res = await query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'pets' AND column_name = $1
      ) AS exists`,
      [column]
    );
    const exists = !!res.rows[0]?.exists;
    columnExistsCache.set(key, exists);
    return exists;
  } catch {
    columnExistsCache.set(key, false);
    return false;
  }
}

/** Drop pets columns from an update payload when they are not on the current schema. */
export async function omitMissingPetsColumns(
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const out = { ...payload };
  if (!(await petsTableHasColumn('vaccination_records'))) {
    delete out.vaccination_records;
  }
  if (!(await petsTableHasColumn('microchip_id'))) {
    delete out.microchip_id;
  }
  return out;
}
