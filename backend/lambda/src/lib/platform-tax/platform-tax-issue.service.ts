import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { query, insert } from '../../database/rds-connection';
import { getPlatformTaxProduct } from './platform-tax-api.service';
import { resolveSellerCommissionRate } from '../../utils/seller-commission-rate';

const PRODUCT_CODE = 'PLATFORM_COMMISSION';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function aggregateCommissionForPeriod(
  vendorId: string,
  periodFrom: string,
  periodTo: string
): Promise<number> {
  try {
    const settlementRes = await query(
      `SELECT COALESCE(SUM(commission_amount), 0) AS commission
       FROM settlements
       WHERE vendor_id = $1::uuid
         AND settlement_period_start >= $2::date
         AND settlement_period_end <= $3::date`,
      [vendorId, periodFrom, periodTo]
    );
    const fromSettlements = parseFloat(String(settlementRes.rows?.[0]?.commission ?? 0));
    if (fromSettlements > 0) return fromSettlements;
  } catch {
    /* settlements schema may vary */
  }

  try {
    const earningsRes = await query(
      `SELECT COALESCE(SUM(commission_amount), 0) AS commission
       FROM vendor_earnings
       WHERE vendor_id = $1::uuid
         AND realized_at >= $2::timestamptz
         AND realized_at < ($3::date + INTERVAL '1 day')`,
      [vendorId, periodFrom, periodTo]
    );
    return parseFloat(String(earningsRes.rows?.[0]?.commission ?? 0));
  } catch {
    return 0;
  }
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
  commissionRate: number;
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

  let taxableAmount = await aggregateCommissionForPeriod(vendorId, periodFrom, periodTo);
  if (taxableAmount <= 0) {
    const { rate } = await resolveSellerCommissionRate(vendorId);
    const revenueRes = await query(
      `SELECT COALESCE(SUM(COALESCE(subtotal, total_amount - COALESCE(tax_amount, 0))), 0) AS base
       FROM orders
       WHERE vendor_id = $1::uuid
         AND order_status = 'delivered'
         AND created_at >= $2::timestamptz
         AND created_at < ($3::date + INTERVAL '1 day')`,
      [vendorId, periodFrom, periodTo]
    );
    const base = parseFloat(String(revenueRes.rows?.[0]?.base ?? 0));
    taxableAmount = round2(base * (rate / 100));
  }

  const { rate: commissionRate } = await resolveSellerCommissionRate(vendorId);
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
    metadata: JSON.stringify({ commissionRate, gstRate, productCode: PRODUCT_CODE }),
    issued_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const description =
    product?.name ??
    `Platform commission (${commissionRate}% on eligible sales, ${periodFrom} to ${periodTo})`;

  await insert('platform_tax_document_lines', {
    tax_document_id: doc.id,
    charge_type: PRODUCT_CODE,
    description,
    sac_code: sacCode,
    gst_rate: gstRate,
    taxable_amount: taxableAmount,
    gst_amount: gstAmount,
    total_amount: totalAmount,
    metadata: JSON.stringify({ commissionRate }),
    created_at: new Date().toISOString(),
  });

  return {
    documentId: String(doc.id),
    invoiceNumber,
    taxableAmount,
    gstAmount,
    totalAmount,
    gstRate,
    commissionRate,
  };
}

export function resolveLocalPdfDir(): string {
  return process.env.PLATFORM_TAX_PDF_DIR || path.join(os.tmpdir(), 'platform-tax');
}

export async function readLocalPlatformTaxPdf(documentId: string): Promise<Buffer | null> {
  const filePath = path.join(resolveLocalPdfDir(), `${documentId}.pdf`);
  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

export async function writeLocalPlatformTaxPdf(documentId: string, bytes: Buffer): Promise<string> {
  const dir = resolveLocalPdfDir();
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${documentId}.pdf`);
  await fs.writeFile(filePath, bytes);
  await query(`UPDATE platform_tax_documents SET pdf_url = $2, updated_at = NOW() WHERE id = $1::uuid`, [
    documentId,
    filePath,
  ]);
  return filePath;
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

export async function generatePlatformTaxPdf(documentId: string): Promise<{ pdfPath: string; html: string }> {
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

  // Store HTML as PDF placeholder bytes for MVP (vendors can print HTML-equivalent via browser)
  // Real PDF rendering can replace this in a follow-up.
  const pdfBytes = Buffer.from(html, 'utf8');
  const pdfPath = await writeLocalPlatformTaxPdf(documentId, pdfBytes);
  return { pdfPath, html };
}
