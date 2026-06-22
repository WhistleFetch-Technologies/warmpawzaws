'use client';

import { getApiBaseUrl } from '@/lib/api-client';
import {
  downloadFromApi,
  getAuthHeaders,
  getDownloadMessage,
  type DownloadSaveResult,
} from '@/lib/download-file';

export type OrderInvoiceSaveResult = DownloadSaveResult;

export function getOrderInvoiceDownloadMessage(saveResult: OrderInvoiceSaveResult): string {
  return getDownloadMessage(saveResult, 'invoice');
}

export async function downloadOrderInvoice(orderId: string): Promise<{
  filename: string;
  saveResult: DownloadSaveResult;
  openedInBrowser: boolean;
}> {
  const apiBaseUrl = getApiBaseUrl() || '';
  const authHeaders = getAuthHeaders();

  await fetch(`${apiBaseUrl}/orders/${orderId}/invoice/generate`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
    body: '{}',
  }).catch(() => {
    /* invoice may already exist */
  });

  const metaResponse = await fetch(`${apiBaseUrl}/orders/${orderId}/invoice`, {
    headers: authHeaders,
  });

  if (!metaResponse.ok) {
    throw new Error('Failed to fetch invoice');
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

  const result = await downloadFromApi({
    path: downloadPath,
    title: `Invoice — ${orderId.slice(0, 8)}`,
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
