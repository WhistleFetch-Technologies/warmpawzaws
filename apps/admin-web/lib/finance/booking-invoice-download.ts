import { getApiBaseUrl, isUatMode } from '@/lib/api-client';

function adminAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (typeof window === 'undefined') return headers;
  const token =
    localStorage.getItem('adminAuthToken') ||
    (() => {
      try {
        const { getCognitoIdToken } = require('@/lib/cognito-auth');
        return getCognitoIdToken();
      } catch {
        return null;
      }
    })();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (isUatMode()) {
    headers['X-UAT-Mode'] = 'true';
    if (token?.startsWith('uat-token-')) headers['X-UAT-Token'] = token;
  }
  return headers;
}

export function extractInvoiceNumberFromHtml(html: string): string | null {
  const fromBody = html.match(/class="invoice-number"[^>]*>([^<]+)/i)?.[1]?.trim();
  if (fromBody) return fromBody;
  const fromTitle = html.match(/<title>\s*Tax Invoice\s*-\s*([^<]+)\s*<\/title>/i)?.[1]?.trim();
  return fromTitle ?? null;
}

export function safeInvoiceFileBaseName(invoiceNumber: string, fallbackId: string): string {
  const raw = invoiceNumber || fallbackId.slice(0, 8);
  return `invoice-${raw}`.replace(/[^\w.-]+/g, '_');
}

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const parsed = JSON.parse(text) as { error?: string };
    if (parsed?.error) return String(parsed.error);
  } catch {
    /* raw */
  }
  return text || `Failed to download invoice (HTTP ${res.status})`;
}

/** Same HTML tax invoice the customer app downloads from GET /bookings/:id/invoice. */
export async function downloadBookingInvoice(bookingId: string): Promise<string> {
  const base = getApiBaseUrl().replace(/\/+$/, '');
  const res = await fetch(`${base}/bookings/${encodeURIComponent(bookingId)}/invoice`, {
    headers: adminAuthHeaders(),
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }

  const contentType = res.headers.get('Content-Type') || '';
  const html = await res.text();
  if (contentType.includes('application/json') || html.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(html) as { error?: string };
      throw new Error(parsed.error || 'Failed to download invoice');
    } catch (e) {
      if (e instanceof SyntaxError) {
        /* HTML that happens to start with a brace */
      } else {
        throw e;
      }
    }
  }

  const invoiceNumber = extractInvoiceNumberFromHtml(html);
  const filename = `${safeInvoiceFileBaseName(invoiceNumber ?? '', bookingId)}.html`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  return filename;
}
