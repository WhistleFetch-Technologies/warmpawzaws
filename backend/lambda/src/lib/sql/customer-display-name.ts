/** SQL expression for customers.full_name with phone fallback (customers has no first_name/last_name). */
export function customerDisplayNameSql(alias: string, columnAlias: string): string {
  return `COALESCE(NULLIF(TRIM(${alias}.full_name), ''), ${alias}.phone, 'Unknown') AS ${columnAlias}`;
}
