import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { query, insert } from '../../database/rds-connection';
import { getPlatformTaxProduct } from './platform-tax-api.service';
import { resolveOrderCommissionByOrderId } from '../../utils/resolve-ecommerce-commission-rate';

const PRODUCT_CODE = 'PLATFORM_COMMISSION';
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
const PLATFORM_TAX_BUCKET =
  process.env.S3_INVOICES_BUCKET || process.env.S3_UPLOADS_BUCKET || 'warmpawz-invoices';

type PlatformTaxCommissionSource =
  | 'settlements'
  | 'vendor_earnings'
  | 'order_commission_audit'
  | 'recomputed_orders'
  | 'none';

interface PlatformTaxCommissionAggregation {
  taxableAmount: number;
  source: PlatformTaxCommissionSource;
  sourceRowCount: number;
  orderIds: string[];
  missing: string[];
  effectiveCommissionRate: number | null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseAmount(value: unknown): number {
  const parsed = parseFloat(String(value ?? 0));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function aggregateSettlements(
  vendorId: string,
  periodFrom: string,
  periodTo: string
): Promise<PlatformTaxCommissionAggregation | null> {
  try {
    const settlementRes = await query(
      `SELECT COALESCE(SUM(commission_amount), 0) AS commission,
              COUNT(*)::int AS row_count
       FROM settlements
       WHERE vendor_id = $1::uuid
         AND settlement_period_start >= $2::date
         AND settlement_period_end <= $3::date`,
      [vendorId, periodFrom, periodTo]
    );
    const commission = parseAmount(settlementRes.rows?.[0]?.commission);
    if (commission > 0) {
      return {
        taxableAmount: round2(commission),
        source: 'settlements',
        sourceRowCount: parseInt(String(settlementRes.rows?.[0]?.row_count ?? 0), 10) || 0,
        orderIds: [],
        missing: [],
        effectiveCommissionRate: null,
      };
    }
  } catch {
    /* settlements schema may vary */
  }
  return null;
}

async function aggregateVendorEarnings(
  vendorId: string,
  periodFrom: string,
  periodTo: string
): Promise<PlatformTaxCommissionAggregation | null> {
  try {
    const earningsRes = await query(
      `SELECT COALESCE(SUM(commission_amount), 0) AS commission,
              COUNT(*)::int AS row_count
       FROM vendor_earnings
       WHERE vendor_id = $1::uuid
         AND realized_at >= $2::timestamptz
         AND realized_at < ($3::date + INTERVAL '1 day')`,
      [vendorId, periodFrom, periodTo]
    );
    const commission = parseAmount(earningsRes.rows?.[0]?.commission);
    if (commission > 0) {
      return {
        taxableAmount: round2(commission),
        source: 'vendor_earnings',
        sourceRowCount: parseInt(String(earningsRes.rows?.[0]?.row_count ?? 0), 10) || 0,
        orderIds: [],
        missing: [],
        effectiveCommissionRate: null,
      };
    }
  } catch {
    /* vendor_earnings schema may vary */
  }
  return null;
}

async function loadDeliveredOrdersForPeriod(
  vendorId: string,
  periodFrom: string,
  periodTo: string
): Promise<Array<{ id: string; commissionAmount: number | null; subtotal: number }>> {
  const ordersRes = await query(
    `SELECT id::text AS id,
            commission_amount,
            COALESCE(subtotal, total_amount - COALESCE(tax_amount, 0), 0) AS subtotal
     FROM orders
     WHERE vendor_id = $1::uuid
       AND order_status = 'delivered'
       AND created_at >= $2::timestamptz
       AND created_at < ($3::date + INTERVAL '1 day')
     ORDER BY created_at ASC`,
    [vendorId, periodFrom, periodTo]
  );

  return (ordersRes.rows ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    commissionAmount:
      row.commission_amount == null ? null : round2(parseAmount(row.commission_amount)),
    subtotal: parseAmount(row.subtotal),
  }));
}

async function aggregateOrderCommissionAudit(
  vendorId: string,
  periodFrom: string,
  periodTo: string
): Promise<PlatformTaxCommissionAggregation | null> {
  try {
    const orders = await loadDeliveredOrdersForPeriod(vendorId, periodFrom, periodTo);
    const audited = orders.filter((order) => (order.commissionAmount ?? 0) > 0);
    const taxableAmount = round2(
      audited.reduce((sum, order) => sum + (order.commissionAmount ?? 0), 0)
    );
    if (taxableAmount > 0) {
      const subtotal = audited.reduce((sum, order) => sum + order.subtotal, 0);
      return {
        taxableAmount,
        source: 'order_commission_audit',
        sourceRowCount: audited.length,
        orderIds: audited.map((order) => order.id),
        missing: [],
        effectiveCommissionRate: subtotal > 0 ? round2((taxableAmount / subtotal) * 100) : null,
      };
    }
  } catch {
    /* orders audit columns may not exist until ecommerce commission migrations are applied */
  }
  return null;
}

async function aggregateRecomputedOrders(
  vendorId: string,
  periodFrom: string,
  periodTo: string
): Promise<PlatformTaxCommissionAggregation | null> {
  let orders: Array<{ id: string; subtotal: number }>;
  try {
    orders = await loadDeliveredOrdersForPeriod(vendorId, periodFrom, periodTo);
  } catch {
    return null;
  }

  let taxableAmount = 0;
  let subtotal = 0;
  const orderIds: string[] = [];
  const missing = new Set<string>();

  for (const order of orders) {
    try {
      const resolved = await resolveOrderCommissionByOrderId(vendorId, order.id);
      taxableAmount += resolved.commissionAmount;
      subtotal += resolved.orderSubtotal;
      orderIds.push(order.id);
    } catch (err) {
      const details = (err as { missing?: string[] })?.missing;
      if (Array.isArray(details)) {
        details.forEach((item) => missing.add(item));
      } else {
        missing.add('commission_rate');
      }
    }
  }

  taxableAmount = round2(taxableAmount);
  if (taxableAmount <= 0) {
    return null;
  }

  return {
    taxableAmount,
    source: 'recomputed_orders',
    sourceRowCount: orderIds.length,
    orderIds,
    missing: Array.from(missing),
    effectiveCommissionRate: subtotal > 0 ? round2((taxableAmount / subtotal) * 100) : null,
  };
}

async function aggregatePlatformCommissionForPeriod(
  vendorId: string,
  periodFrom: string,
  periodTo: string
): Promise<PlatformTaxCommissionAggregation> {
  const fromSettlements = await aggregateSettlements(vendorId, periodFrom, periodTo);
  if (fromSettlements) return fromSettlements;

  const fromEarnings = await aggregateVendorEarnings(vendorId, periodFrom, periodTo);
  if (fromEarnings) return fromEarnings;

  const fromAudit = await aggregateOrderCommissionAudit(vendorId, periodFrom, periodTo);
  if (fromAudit) return fromAudit;

  const recomputed = await aggregateRecomputedOrders(vendorId, periodFrom, periodTo);
  if (recomputed) return recomputed;

  return {
    taxableAmount: 0,
    source: 'none',
    sourceRowCount: 0,
    orderIds: [],
    missing: ['settlement_or_commission_audit'],
    effectiveCommissionRate: null,
  };
}

async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const countRes = await query(
    `SELECT COUNT(*)::int AS cnt FROM platform_tax_documents
     WHERE document_type = 'TAX_INVOICE'
       AND TO_CHAR(COALESCE(issued_at, created_at), 'YYYY-MM') = $1`,
    [`${year}-${month}`]
  );
  const seq = (parseInt(String(countRes.rows?.[0]?.cnt ?? 0), 10) || 0) + 1;
  return `WP-TAX-${year}${month}-${String(seq).padStart(4, '0')}`;
}

export interface IssuePlatformTaxInvoiceParams {
  vendorId: string;
  periodFrom: string;
  periodTo: string;
}

export interface IssuePlatformTaxInvoiceResult {
  documentId: string;
  invoiceNumber: string;
  taxableAmount: number;
  gstAmount: number;
  totalAmount: number;
  gstRate: number;
  commissionRate: number | null;
  source: PlatformTaxCommissionSource;
  sourceRowCount: number;
}

export interface PreviewPlatformTaxInvoiceResult {
  vendorId: string;
  periodFrom: string;
  periodTo: string;
  taxableAmount: number;
  gstAmount: number;
  totalAmount: number;
  gstRate: number;
  commissionRate: number | null;
  source: PlatformTaxCommissionSource;
  sourceRowCount: number;
  orderIds: string[];
  missing: string[];
  existingDocumentId: string | null;
  existingInvoiceNumber: string | null;
}

export async function previewPlatformTaxInvoice(
  params: IssuePlatformTaxInvoiceParams
): Promise<PreviewPlatformTaxInvoiceResult> {
  const { vendorId, periodFrom, periodTo } = params;
  const product = await getPlatformTaxProduct(PRODUCT_CODE);
  const gstRate = product?.default_gst_rate ?? 18;
  const aggregation = await aggregatePlatformCommissionForPeriod(vendorId, periodFrom, periodTo);
  const taxableAmount = round2(aggregation.taxableAmount);
  const gstAmount = round2(taxableAmount * (gstRate / 100));
  const totalAmount = round2(taxableAmount + gstAmount);
  const existing = await query(
    `SELECT id::text AS id, invoice_number
     FROM platform_tax_documents
     WHERE vendor_id = $1::uuid AND period_from = $2::date AND period_to = $3::date
       AND document_type = 'TAX_INVOICE' AND status != 'VOID'
     LIMIT 1`,
    [vendorId, periodFrom, periodTo]
  );
  const existingRow = existing.rows?.[0];

  return {
    vendorId,
    periodFrom,
    periodTo,
    taxableAmount,
    gstAmount,
    totalAmount,
    gstRate,
    commissionRate: aggregation.effectiveCommissionRate,
    source: aggregation.source,
    sourceRowCount: aggregation.sourceRowCount,
    orderIds: aggregation.orderIds,
    missing: aggregation.missing,
    existingDocumentId: existingRow?.id ? String(existingRow.id) : null,
    existingInvoiceNumber: existingRow?.invoice_number ? String(existingRow.invoice_number) : null,
  };
}

export async function issuePlatformTaxInvoice(
  params: IssuePlatformTaxInvoiceParams
): Promise<IssuePlatformTaxInvoiceResult> {
  const { vendorId, periodFrom, periodTo } = params;

  const dup = await query(
    `SELECT id FROM platform_tax_documents
     WHERE vendor_id = $1::uuid AND period_from = $2::date AND period_to = $3::date
       AND document_type = 'TAX_INVOICE' AND status != 'VOID'
     LIMIT 1`,
    [vendorId, periodFrom, periodTo]
  );
  if (dup.rows?.length) {
    throw new Error('Tax invoice already issued for this vendor and period');
  }

  const product = await getPlatformTaxProduct(PRODUCT_CODE);
  const gstRate = product?.default_gst_rate ?? 18;
  const sacCode = product?.sac_code ?? '998599';
  const preview = await previewPlatformTaxInvoice(params);
  if (preview.taxableAmount <= 0) {
    throw new Error(
      `No platform commission found for this vendor and period: missing ${preview.missing.join(', ')}`
    );
  }
  const taxableAmount = preview.taxableAmount;
  const gstAmount = round2(taxableAmount * (gstRate / 100));
  const totalAmount = round2(taxableAmount + gstAmount);
  const invoiceNumber = await nextInvoiceNumber();

  const vendorRes = await query(
    `SELECT business_name, gst_number, address, city, state, pincode FROM vendors WHERE id = $1::uuid`,
    [vendorId]
  );
  const vendor = vendorRes.rows?.[0] ?? {};

  const platformIdentity = {
    name: 'WarmPawz Technologies',
    gstin: process.env.PLATFORM_GSTIN || '',
    address: process.env.PLATFORM_BILLING_ADDRESS || 'WarmPawz Platform Billing',
  };

  const [doc] = await insert('platform_tax_documents', {
    vendor_id: vendorId,
    document_type: 'TAX_INVOICE',
    status: 'ISSUED',
    invoice_number: invoiceNumber,
    period_from: periodFrom,
    period_to: periodTo,
    taxable_amount: taxableAmount,
    gst_amount: gstAmount,
    total_amount: totalAmount,
    supplier_snapshot: JSON.stringify(platformIdentity),
    recipient_snapshot: JSON.stringify({
      name: vendor.business_name,
      gstin: vendor.gst_number,
      address: vendor.address,
      city: vendor.city,
      state: vendor.state,
      pincode: vendor.pincode,
    }),
    metadata: JSON.stringify({
      commissionRate: preview.commissionRate,
      gstRate,
      productCode: PRODUCT_CODE,
      source: preview.source,
      sourceRowCount: preview.sourceRowCount,
      orderIds: preview.orderIds,
      missing: preview.missing,
    }),
    issued_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const description =
    product?.name ??
    `Platform commission (${preview.commissionRate != null ? `${preview.commissionRate}%` : preview.source} source, ${periodFrom} to ${periodTo})`;

  await insert('platform_tax_document_lines', {
    tax_document_id: doc.id,
    charge_type: PRODUCT_CODE,
    description,
    sac_code: sacCode,
    gst_rate: gstRate,
    taxable_amount: taxableAmount,
    gst_amount: gstAmount,
    total_amount: totalAmount,
    metadata: JSON.stringify({
      commissionRate: preview.commissionRate,
      source: preview.source,
      sourceRowCount: preview.sourceRowCount,
    }),
    created_at: new Date().toISOString(),
  });

  return {
    documentId: String(doc.id),
    invoiceNumber,
    taxableAmount,
    gstAmount,
    totalAmount,
    gstRate,
    commissionRate: preview.commissionRate,
    source: preview.source,
    sourceRowCount: preview.sourceRowCount,
  };
}

export function resolveLocalPdfDir(): string {
  return process.env.PLATFORM_TAX_PDF_DIR || path.join(os.tmpdir(), 'platform-tax');
}

export async function readLocalPlatformTaxPdf(documentId: string): Promise<Buffer | null> {
  return readPlatformTaxDocumentBytes(documentId);
}

function isLikelyLocalPath(value: string): boolean {
  return value.includes('\\') || value.startsWith('/') || /^[A-Za-z]:/.test(value);
}

async function getObjectBuffer(key: string): Promise<Buffer | null> {
  try {
    const result = await s3Client.send(
      new GetObjectCommand({
        Bucket: PLATFORM_TAX_BUCKET,
        Key: key,
      })
    );
    const body = result.Body as
      | {
          transformToByteArray?: () => Promise<Uint8Array>;
          transformToString?: (encoding?: string) => Promise<string>;
        }
      | undefined;
    if (!body) return null;
    if (body.transformToByteArray) {
      return Buffer.from(await body.transformToByteArray());
    }
    if (body.transformToString) {
      return Buffer.from(await body.transformToString('utf-8'), 'utf8');
    }
  } catch (error) {
    console.warn('[PLATFORM-TAX] S3 document read failed:', error);
  }
  return null;
}

export async function readPlatformTaxDocumentBytes(documentId: string): Promise<Buffer | null> {
  const docRes = await query(
    `SELECT pdf_url FROM platform_tax_documents WHERE id = $1::uuid LIMIT 1`,
    [documentId]
  );
  const pdfUrl = docRes.rows?.[0]?.pdf_url ? String(docRes.rows[0].pdf_url) : '';

  if (pdfUrl && !isLikelyLocalPath(pdfUrl)) {
    const s3Bytes = await getObjectBuffer(pdfUrl);
    if (s3Bytes) return s3Bytes;
  }

  const legacyPath = pdfUrl && isLikelyLocalPath(pdfUrl)
    ? pdfUrl
    : path.join(resolveLocalPdfDir(), `${documentId}.pdf`);
  try {
    return await fs.readFile(legacyPath);
  } catch {
    return null;
  }
}

export async function writeLocalPlatformTaxPdf(documentId: string, bytes: Buffer): Promise<string> {
  const filePath = await writePlatformTaxDocumentBytes(documentId, bytes);
  return filePath;
}

function safeDocumentName(value: string): string {
  return value.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'document';
}

async function writePlatformTaxDocumentBytes(documentId: string, bytes: Buffer): Promise<string> {
  const docRes = await query(
    `SELECT id::text AS id, vendor_id::text AS vendor_id, invoice_number, pdf_url, issued_at, created_at
     FROM platform_tax_documents WHERE id = $1::uuid`,
    [documentId]
  );
  if (!docRes.rows?.length) throw new Error('Document not found');
  const doc = docRes.rows[0];
  const existingKey = doc.pdf_url ? String(doc.pdf_url) : '';
  const dateLabel = String(doc.issued_at ?? doc.created_at ?? new Date().toISOString()).slice(0, 4);
  const name = safeDocumentName(String(doc.invoice_number ?? documentId));
  const key =
    existingKey && !isLikelyLocalPath(existingKey)
      ? existingKey
      : `platform-tax/${doc.vendor_id}/${dateLabel}/${name}.html`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: PLATFORM_TAX_BUCKET,
      Key: key,
      Body: bytes,
      ContentType: 'text/html; charset=utf-8',
      CacheControl: 'private, no-store',
    })
  );
  await query(`UPDATE platform_tax_documents SET pdf_url = $2, updated_at = NOW() WHERE id = $1::uuid`, [
    documentId,
    key,
  ]);
  return key;
}

export function buildPlatformTaxInvoiceHtml(doc: {
  invoiceNumber: string;
  periodFrom: string;
  periodTo: string;
  taxableAmount: number;
  gstAmount: number;
  totalAmount: number;
  gstRate: number;
  supplier: { name: string; gstin?: string; address?: string };
  recipient: { name: string; gstin?: string; address?: string; state?: string };
  lines: Array<{ description: string; sacCode?: string | null; gstRate: number; taxableAmount: number; gstAmount: number; totalAmount: number }>;
}): string {
  const lineRows = doc.lines
    .map(
      (l) => `
    <tr>
      <td>${l.description}</td>
      <td>${l.sacCode ?? '—'}</td>
      <td class="num">${l.gstRate}%</td>
      <td class="num">₹${l.taxableAmount.toFixed(2)}</td>
      <td class="num">₹${l.gstAmount.toFixed(2)}</td>
      <td class="num">₹${l.totalAmount.toFixed(2)}</td>
    </tr>`
    )
    .join('');

  const cgst = doc.gstAmount / 2;
  const sgst = doc.gstAmount / 2;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Tax Invoice - ${doc.invoiceNumber}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  .meta { margin-bottom: 20px; font-size: 13px; color: #444; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
  th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
  th { background: #f5f5f5; }
  .num { text-align: right; }
  .totals { margin-top: 16px; width: 320px; margin-left: auto; }
  .totals td { border: none; padding: 4px 8px; }
</style></head><body>
  <h1>Tax Invoice</h1>
  <div class="meta">
    <div><strong>Invoice #:</strong> <span class="invoice-number">${doc.invoiceNumber}</span></div>
    <div><strong>Period:</strong> ${doc.periodFrom} to ${doc.periodTo}</div>
  </div>
  <div style="display:flex;gap:24px;margin-bottom:16px;">
    <div style="flex:1;"><strong>From (Supplier)</strong><br/>${doc.supplier.name}<br/>${doc.supplier.gstin ? `GSTIN: ${doc.supplier.gstin}<br/>` : ''}${doc.supplier.address ?? ''}</div>
    <div style="flex:1;"><strong>To (Recipient)</strong><br/>${doc.recipient.name}<br/>${doc.recipient.gstin ? `GSTIN: ${doc.recipient.gstin}<br/>` : ''}${doc.recipient.address ?? ''}</div>
  </div>
  <table>
    <thead><tr><th>Description</th><th>SAC</th><th>GST %</th><th>Taxable</th><th>GST</th><th>Total</th></tr></thead>
    <tbody>${lineRows}</tbody>
  </table>
  <table class="totals">
    <tr><td>Taxable amount</td><td class="num">₹${doc.taxableAmount.toFixed(2)}</td></tr>
    <tr><td>CGST (${(doc.gstRate / 2).toFixed(2)}%)</td><td class="num">₹${cgst.toFixed(2)}</td></tr>
    <tr><td>SGST (${(doc.gstRate / 2).toFixed(2)}%)</td><td class="num">₹${sgst.toFixed(2)}</td></tr>
    <tr><td><strong>Grand total</strong></td><td class="num"><strong>₹${doc.totalAmount.toFixed(2)}</strong></td></tr>
  </table>
  <p style="margin-top:24px;font-size:12px;color:#666;">Computer-generated tax invoice issued by WarmPawz.</p>
</body></html>`;
}

export async function generatePlatformTaxPdf(documentId: string): Promise<{ pdfPath: string; html: string; sizeBytes: number }> {
  const docRes = await query(`SELECT * FROM platform_tax_documents WHERE id = $1::uuid`, [documentId]);
  if (!docRes.rows?.length) throw new Error('Document not found');
  const doc = docRes.rows[0];

  const linesRes = await query(
    `SELECT * FROM platform_tax_document_lines WHERE tax_document_id = $1::uuid`,
    [documentId]
  );

  const supplier =
    typeof doc.supplier_snapshot === 'string'
      ? JSON.parse(doc.supplier_snapshot)
      : doc.supplier_snapshot ?? { name: 'WarmPawz' };
  const recipient =
    typeof doc.recipient_snapshot === 'string'
      ? JSON.parse(doc.recipient_snapshot)
      : doc.recipient_snapshot ?? { name: 'Vendor' };

  const html = buildPlatformTaxInvoiceHtml({
    invoiceNumber: String(doc.invoice_number),
    periodFrom: String(doc.period_from).slice(0, 10),
    periodTo: String(doc.period_to).slice(0, 10),
    taxableAmount: parseFloat(String(doc.taxable_amount)),
    gstAmount: parseFloat(String(doc.gst_amount)),
    totalAmount: parseFloat(String(doc.total_amount)),
    gstRate: parseFloat(String((linesRes.rows?.[0] as { gst_rate?: number })?.gst_rate ?? 18)),
    supplier,
    recipient,
    lines: (linesRes.rows ?? []).map((l: Record<string, unknown>) => ({
      description: String(l.description),
      sacCode: l.sac_code != null ? String(l.sac_code) : null,
      gstRate: parseFloat(String(l.gst_rate)),
      taxableAmount: parseFloat(String(l.taxable_amount)),
      gstAmount: parseFloat(String(l.gst_amount)),
      totalAmount: parseFloat(String(l.total_amount)),
    })),
  });

  const bytes = Buffer.from(html, 'utf8');
  const pdfPath = await writePlatformTaxDocumentBytes(documentId, bytes);
  return { pdfPath, html, sizeBytes: bytes.length };
}
