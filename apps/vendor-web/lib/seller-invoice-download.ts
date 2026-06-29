'use client';

import { getApiBaseUrl } from '@/lib/api-client';
import { shouldUseMobileSavePipeline } from '@/lib/capacitor-pdf-save';
import {
  downloadBlob,
  downloadFromApi,
  getAuthHeaders,
  getDownloadMessage,
  type DownloadSaveResult,
} from '@/lib/download-file';
import {
  convertInvoiceHtmlToPdfBlob,
  extractInvoiceNumberFromHtml,
  safeInvoiceFileBaseName,
} from '@/lib/invoice-html-to-pdf';

export type SalesInvoiceSaveResult = DownloadSaveResult;

export function getSalesInvoiceDownloadMessage(saveResult: SalesInvoiceSaveResult): string {
  return getDownloadMessage(saveResult, 'invoice');
}

/** Download customer sales invoice by invoice row id. */
export async function downloadSalesInvoiceById(
  invoiceId: string,
  invoiceNumber?: string
): Promise<{
  filename: string;
  saveResult: DownloadSaveResult;
  openedInBrowser: boolean;
}> {
  const baseName = safeInvoiceFileBaseName(invoiceNumber ?? '', invoiceId);

  if (shouldUseMobileSavePipeline()) {
    const authHeaders = getAuthHeaders();
    const apiBaseUrl = getApiBaseUrl() || '';
    const response = await fetch(`${apiBaseUrl}/invoices/download/${invoiceId}`, {
      headers: authHeaders,
    });
    if (!response.ok) throw new Error('Failed to download invoice');

    const contentType = (response.headers.get('Content-Type') || '').toLowerCase();
    let html: string;
    if (contentType.includes('application/json')) {
      const json = await response.json();
      const presignedUrl = json.downloadUrl ?? json.download_url;
      if (!presignedUrl) throw new Error('Invoice download URL not available');
      const s3Response = await fetch(presignedUrl);
      if (!s3Response.ok) throw new Error('Failed to download invoice from storage');
      html = await s3Response.text();
    } else {
      html = await response.text();
    }

    const extracted = extractInvoiceNumberFromHtml(html) ?? invoiceNumber;
    const fileBase = safeInvoiceFileBaseName(extracted ?? '', invoiceId);
    const pdfBlob = await convertInvoiceHtmlToPdfBlob(html);
    const result = await downloadBlob({
      blob: pdfBlob,
      fileName: `${fileBase}.pdf`,
      title: `Invoice ${extracted ?? invoiceId.slice(0, 8)}`,
      shareText: 'Save the invoice PDF to Files or another app.',
      shareDialogTitle: 'Save invoice',
      previewHtmlInBrowser: false,
    });
    return {
      filename: result.fileName,
      saveResult: result.saveResult,
      openedInBrowser: result.openedInBrowser,
    };
  }

  const result = await downloadFromApi({
    path: `/invoices/download/${invoiceId}`,
    fileName: `${baseName}.html`,
    title: `Invoice ${invoiceNumber ?? invoiceId.slice(0, 8)}`,
    shareText: 'Save the invoice to Files, Drive, or another app.',
    shareDialogTitle: 'Save invoice',
    previewHtmlInBrowser: true,
  });

  return {
    filename: result.fileName,
    saveResult: result.saveResult,
    openedInBrowser: result.openedInBrowser,
  };
}

/** Lazy-generate order invoice then download (when list has orderId only). */
export async function ensureAndDownloadOrderInvoice(orderId: string): Promise<{
  filename: string;
  saveResult: DownloadSaveResult;
  openedInBrowser: boolean;
}> {
  const apiBaseUrl = getApiBaseUrl() || '';
  const authHeaders = getAuthHeaders();

  await fetch(`${apiBaseUrl}/orders/${orderId}/invoice/generate`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: '{}',
  }).catch(() => {
    /* may already exist */
  });

  const metaResponse = await fetch(`${apiBaseUrl}/orders/${orderId}/invoice`, {
    headers: authHeaders,
  });
  if (!metaResponse.ok) {
    throw new Error('Invoice not ready. Please try again after the order is delivered.');
  }

  const meta = await metaResponse.json();
  const invoiceId = meta.invoice?.id ?? meta.id;
  if (!invoiceId) {
    throw new Error('Invoice ID not available');
  }

  return downloadSalesInvoiceById(
    String(invoiceId),
    meta.invoice?.invoiceNumber ?? meta.invoice?.invoice_number
  );
}

/** Build CSV string from GSTR-1 export JSON. */
export function gstrExportToCsv(exportData: {
  b2b?: Record<string, string>[];
  b2c?: Record<string, string>[];
  hsn?: Record<string, string | number>[];
}): string {
  const sections: string[] = [];

  const toCsv = (rows: Record<string, unknown>[], title: string) => {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const lines = [
      title,
      headers.join(','),
      ...rows.map((row) =>
        headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')
      ),
    ];
    sections.push(lines.join('\n'));
  };

  toCsv(exportData.b2c ?? [], 'B2C Invoices');
  toCsv(exportData.b2b ?? [], 'B2B Invoices');
  toCsv(exportData.hsn ?? [], 'HSN Summary');

  return sections.join('\n\n');
}

export function downloadGstrCsv(csv: string, month: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `gstr1-export-${month}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
