'use client';

import { downloadFromApi, getDownloadMessage, type DownloadSaveResult } from '@/lib/download-file';

export type BookingInvoiceSaveResult = DownloadSaveResult;

export function getBookingInvoiceDownloadMessage(saveResult: BookingInvoiceSaveResult): string {
  return getDownloadMessage(saveResult, 'invoice');
}

export async function downloadBookingInvoice(bookingId: string): Promise<{
  filename: string;
  saveResult: DownloadSaveResult;
  openedInBrowser: boolean;
}> {
  const result = await downloadFromApi({
    path: `/bookings/${bookingId}/invoice`,
    title: `Invoice — ${bookingId.slice(0, 8)}`,
    shareText: 'Save the invoice to Files, Drive, or another app.',
    shareDialogTitle: 'Save invoice',
    previewHtmlInBrowser: false,
  });

  return {
    filename: result.fileName,
    saveResult: result.saveResult,
    openedInBrowser: result.openedInBrowser,
  };
}
