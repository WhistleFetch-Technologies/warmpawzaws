import { getApiBaseUrl } from '@/lib/api-client';

function resolveInvoiceFilename(
  bookingId: string,
  contentType: string,
  contentDisposition: string
): string {
  const dispositionMatch = contentDisposition.match(/filename[*]?=(?:UTF-8''|")?([^";\n]+)"?/i);
  let filename = dispositionMatch?.[1]?.trim();
  if (filename) {
    try {
      filename = decodeURIComponent(filename);
    } catch {
      /* keep raw */
    }
    return filename;
  }

  const isPdf = contentType.includes('application/pdf');
  const shortId = bookingId.slice(0, 8);
  return isPdf ? `invoice-${shortId}.pdf` : `invoice-${shortId}.html`;
}

/**
 * Booking invoices are generated as HTML by the API (not PDF).
 * Opens HTML in a new tab and downloads with the correct extension.
 */
export async function downloadBookingInvoice(bookingId: string): Promise<{
  openedInBrowser: boolean;
  filename: string;
}> {
  const apiBaseUrl = getApiBaseUrl() || '';
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('authToken') || localStorage.getItem('cognitoIdToken')
      : null;

  const response = await fetch(`${apiBaseUrl}/bookings/${bookingId}/invoice`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error('Failed to download invoice');
  }

  const contentType = (response.headers.get('Content-Type') || '').toLowerCase();
  const contentDisposition = response.headers.get('Content-Disposition') || '';
  const filename = resolveInvoiceFilename(bookingId, contentType, contentDisposition);
  const isPdf = contentType.includes('application/pdf');
  const isHtml =
    contentType.includes('text/html') ||
    filename.endsWith('.html') ||
    (!isPdf && !contentType.includes('application/json'));

  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);

  let openedInBrowser = false;
  if (isHtml) {
    const opened = window.open(blobUrl, '_blank', 'noopener,noreferrer');
    openedInBrowser = Boolean(opened);
  }

  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);

  return { openedInBrowser, filename };
}
