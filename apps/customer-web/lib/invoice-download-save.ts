'use client';

export type { DownloadSaveResult as InvoiceSaveResult } from '@/lib/download-file';
export {
  getAuthHeaders,
  blobFromDownloadResponse as blobFromInvoiceResponse,
  resolveFilenameFromResponse as resolveInvoiceFilename,
  downloadBlob as saveInvoiceBlob,
  getDownloadMessage,
} from '@/lib/download-file';

import { getDownloadMessage, type DownloadSaveResult } from '@/lib/download-file';

export function getInvoiceDownloadMessage(saveResult: DownloadSaveResult): string {
  return getDownloadMessage(saveResult, 'invoice');
}
