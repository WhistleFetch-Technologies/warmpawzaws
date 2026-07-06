'use client';

import { getApiBaseUrl } from '@/lib/api-client';
import { shouldUseMobileSavePipeline } from '@/lib/capacitor-pdf-save';
import {
  downloadBlob,
  getAuthHeaders,
  getDownloadMessage,
  resolveApiUrl,
  type DownloadSaveResult,
} from '@/lib/download-file';
import {
  convertInvoiceHtmlToPdfBlob,
  extractInvoiceNumberFromHtml,
  safeInvoiceFileBaseName,
} from '@/lib/invoice-html-to-pdf';

export type MealOrderInvoiceSaveResult = DownloadSaveResult;

export function getMealOrderInvoiceDownloadMessage(saveResult: MealOrderInvoiceSaveResult): string {
  return getDownloadMessage(saveResult, 'invoice');
}

async function fetchInvoiceHtml(downloadPath: string, authHeaders: Record<string, string>): Promise<string> {
  const url = resolveApiUrl(downloadPath);
  const response = await fetch(url, { headers: authHeaders });

  if (!response.ok) {
    throw new Error('Failed to download invoice');
  }

  const contentType = (response.headers.get('Content-Type') || '').toLowerCase();

  if (contentType.includes('application/json')) {
    const json = await response.json();
    const presignedUrl = json.downloadUrl ?? json.download_url;
    if (!presignedUrl || typeof presignedUrl !== 'string') {
      throw new Error('Invoice download URL not available');
    }
    const s3Response = await fetch(presignedUrl);
    if (!s3Response.ok) {
      throw new Error('Failed to download invoice from storage');
    }
    return s3Response.text();
  }

  return response.text();
}

export function isMealOrderInvoiceAvailable(order: {
  payment_status?: string | null;
  paymentStatus?: string | null;
  status?: string | null;
}): boolean {
  const ps = String(order.payment_status ?? order.paymentStatus ?? '').toLowerCase();
  if (ps === 'paid' || ps === 'completed') return true;
  if (ps === 'pending' || ps === 'awaiting_payment') return false;
  const status = String(order.status || '').toLowerCase();
  return ['confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'].includes(
    status,
  );
}

export async function downloadMealOrderInvoice(orderId: string): Promise<{
  filename: string;
  saveResult: DownloadSaveResult;
  openedInBrowser: boolean;
}> {
  const apiBaseUrl = getApiBaseUrl() || '';
  const authHeaders = getAuthHeaders();

  const generateResponse = await fetch(`${apiBaseUrl}/meal/orders/${orderId}/invoice/generate`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  if (!generateResponse.ok) {
    let message = 'Failed to generate invoice';
    try {
      const body = await generateResponse.json();
      if (typeof body?.error === 'string' && body.error.trim()) {
        message = body.error;
      }
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }

  const metaResponse = await fetch(`${apiBaseUrl}/meal/orders/${orderId}/invoice`, {
    headers: authHeaders,
  });

  if (!metaResponse.ok) {
    let message = 'Failed to fetch invoice';
    try {
      const body = await metaResponse.json();
      if (typeof body?.error === 'string' && body.error.trim()) {
        message = body.error;
      }
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }

  const meta = await metaResponse.json();
  const downloadPath =
    meta.downloadUrl ??
    meta.download_url ??
    meta.invoice?.downloadUrl ??
    meta.invoice?.download_url;

  if (!downloadPath || typeof downloadPath !== 'string') {
    throw new Error('Invoice not ready. Please try again in a moment.');
  }

  const html = await fetchInvoiceHtml(downloadPath, authHeaders);
  const invoiceNumber =
    extractInvoiceNumberFromHtml(html) ??
    meta.invoice?.invoiceNumber ??
    meta.invoice?.invoice_number;
  const baseName = safeInvoiceFileBaseName(String(invoiceNumber ?? ''), orderId);

  if (shouldUseMobileSavePipeline()) {
    const pdfBlob = await convertInvoiceHtmlToPdfBlob(html);
    const result = await downloadBlob({
      blob: pdfBlob,
      fileName: `${baseName}.pdf`,
      title: `Invoice ${invoiceNumber ?? orderId.slice(0, 8)}`,
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

  const htmlBlob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const result = await downloadBlob({
    blob: htmlBlob,
    fileName: `${baseName}.html`,
    title: `Invoice ${invoiceNumber ?? orderId.slice(0, 8)}`,
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
