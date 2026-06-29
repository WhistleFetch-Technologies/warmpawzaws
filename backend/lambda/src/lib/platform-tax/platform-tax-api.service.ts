import { query } from '../../database/rds-connection';

export async function isPlatformTaxMigrationApplied(): Promise<boolean> {
  try {
    const result = await query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'platform_tax_documents'
       LIMIT 1`
    );
    return (result.rows?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

export interface PlatformTaxDocumentRow {
  id: string;
  vendor_id: string;
  document_type: string;
  status: string;
  invoice_number: string | null;
  period_from: string;
  period_to: string;
  taxable_amount: string | number;
  gst_amount: string | number;
  total_amount: string | number;
  pdf_url: string | null;
  issued_at: string | null;
  supplier_snapshot?: unknown;
  recipient_snapshot?: unknown;
  metadata?: unknown;
}

export interface PlatformTaxDocumentLineRow {
  id: string;
  tax_document_id: string;
  charge_type: string;
  description: string;
  sac_code: string | null;
  gst_rate: string | number;
  taxable_amount: string | number;
  gst_amount: string | number;
  total_amount: string | number;
}

export async function listVendorPlatformTaxDocuments(params: {
  vendorId: string;
  status?: string;
  documentType?: string;
  periodFrom?: string;
  periodTo?: string;
  limit?: number;
  offset?: number;
}): Promise<{ documents: PlatformTaxDocumentRow[]; total: number }> {
  const conditions = ['vendor_id = $1'];
  const values: unknown[] = [params.vendorId];
  let idx = 2;

  if (params.status) {
    conditions.push(`status = $${idx++}`);
    values.push(params.status);
  }
  if (params.documentType) {
    conditions.push(`document_type = $${idx++}`);
    values.push(params.documentType);
  }
  if (params.periodFrom) {
    conditions.push(`period_from >= $${idx++}::date`);
    values.push(params.periodFrom);
  }
  if (params.periodTo) {
    conditions.push(`period_to <= $${idx++}::date`);
    values.push(params.periodTo);
  }

  const where = conditions.join(' AND ');
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  const countRes = await query(
    `SELECT COUNT(*)::int AS total FROM platform_tax_documents WHERE ${where}`,
    values
  );
  const total = countRes.rows?.[0]?.total ?? 0;

  const listRes = await query(
    `SELECT * FROM platform_tax_documents
     WHERE ${where}
     ORDER BY COALESCE(issued_at, created_at) DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...values, limit, offset]
  );

  return { documents: listRes.rows as PlatformTaxDocumentRow[], total };
}

export async function getVendorPlatformTaxDocument(
  vendorId: string,
  documentId: string
): Promise<PlatformTaxDocumentRow & { lines: PlatformTaxDocumentLineRow[] }> {
  const docRes = await query(
    `SELECT * FROM platform_tax_documents WHERE id = $1::uuid AND vendor_id = $2::uuid`,
    [documentId, vendorId]
  );
  if (!docRes.rows?.length) {
    throw new Error('Document not found');
  }
  const linesRes = await query(
    `SELECT * FROM platform_tax_document_lines WHERE tax_document_id = $1::uuid ORDER BY created_at`,
    [documentId]
  );
  return {
    ...(docRes.rows[0] as PlatformTaxDocumentRow),
    lines: (linesRes.rows ?? []) as PlatformTaxDocumentLineRow[],
  };
}

export async function getPlatformTaxProduct(code: string): Promise<{
  code: string;
  name: string;
  sac_code: string | null;
  default_gst_rate: number;
} | null> {
  const res = await query(
    `SELECT code, name, sac_code, default_gst_rate FROM platform_tax_products
     WHERE code = $1 AND active = true LIMIT 1`,
    [code]
  );
  if (!res.rows?.length) return null;
  const row = res.rows[0];
  return {
    code: String(row.code),
    name: String(row.name),
    sac_code: row.sac_code != null ? String(row.sac_code) : null,
    default_gst_rate: parseFloat(String(row.default_gst_rate ?? 18)),
  };
}

export async function getPlatformTaxHealthSnapshot(): Promise<{
  enabled: boolean;
  migrationApplied: boolean;
}> {
  const { isPlatformTaxDocumentsEnabled } = await import('./platform-tax-feature-flag');
  return {
    enabled: isPlatformTaxDocumentsEnabled(),
    migrationApplied: await isPlatformTaxMigrationApplied(),
  };
}
