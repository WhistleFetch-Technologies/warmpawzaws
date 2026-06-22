'use client';

import { getApiBaseUrl } from '@/lib/api-client';
import { shouldUseMobileSavePipeline } from '@/lib/capacitor-pdf-save';
import {
  downloadBlob,
  getAuthHeaders,
  getDownloadMessage,
  type DownloadSaveResult,
} from '@/lib/download-file';
import {
  convertInvoiceHtmlToPdfBlob,
  extractInvoiceNumberFromHtml,
  safeInvoiceFileBaseName,
} from '@/lib/invoice-html-to-pdf';

export type BookingInvoiceSaveResult = DownloadSaveResult;

export function getBookingInvoiceDownloadMessage(saveResult: BookingInvoiceSaveResult): string {
  return getDownloadMessage(saveResult, 'invoice');
}

/**
 * Booking invoices are HTML from the API. On mobile we convert to PDF before share/save
 * so Files/Preview opens them reliably (raw .html is awkward on iOS/Android).
 */
export async function downloadBookingInvoice(bookingId: string): Promise<{
  filename: string;
  saveResult: DownloadSaveResult;
  openedInBrowser: boolean;
}> {
  const apiBaseUrl = getApiBaseUrl() || '';
  const response = await fetch(`${apiBaseUrl}/bookings/${bookingId}/invoice`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to download invoice');
  }

  const html = await response.text();
  const invoiceNumber = extractInvoiceNumberFromHtml(html);
  const baseName = safeInvoiceFileBaseName(invoiceNumber ?? '', bookingId);

  if (shouldUseMobileSavePipeline()) {
    const pdfBlob = await convertInvoiceHtmlToPdfBlob(html);
    const result = await downloadBlob({
      blob: pdfBlob,
      fileName: `${baseName}.pdf`,
      title: `Invoice ${invoiceNumber ?? bookingId.slice(0, 8)}`,
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
    title: `Invoice ${invoiceNumber ?? bookingId.slice(0, 8)}`,
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
