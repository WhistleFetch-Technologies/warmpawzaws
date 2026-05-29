/**

 * Resolve vendors.id used for vendor_earnings / settlements.

 * After OTP login localStorage often holds vendor_identity.id while ledger rows use vendors.id.

 */

import { apiClient } from './api-client';

const SESSION_KEY = '_warmpawz_ledger_vendor_id';

export async function resolveLedgerVendorId(
  fallbackVendorId: string,
  options?: { forceProfileRefresh?: boolean }
): Promise<string> {
  const trimmed = (fallbackVendorId || '').trim();
  if (!trimmed) return trimmed;

  if (options?.forceProfileRefresh) {
    clearLedgerVendorIdCache();
  } else if (typeof window !== 'undefined') {
    const cached = sessionStorage.getItem(SESSION_KEY);
    if (cached && VENDOR_UUID_RE.test(cached)) return cached;
  }



  try {

    const res = (await apiClient.get(`/vendor/${trimmed}/profile`)) as {

      vendor?: { id?: string };

      data?: { vendor?: { id?: string } };

      canonicalVendorId?: string;

    };

    const canonical =

      res?.canonicalVendorId ||

      res?.vendor?.id ||

      res?.data?.vendor?.id ||

      trimmed;



    if (typeof window !== 'undefined' && canonical && VENDOR_UUID_RE.test(canonical)) {

      sessionStorage.setItem(SESSION_KEY, canonical);

      if (canonical !== trimmed) {

        localStorage.setItem('vendorId', canonical);

        try {

          const raw = localStorage.getItem('vendorData');

          if (raw) {

            const parsed = JSON.parse(raw) as Record<string, unknown>;

            parsed.id = canonical;

            localStorage.setItem('vendorData', JSON.stringify(parsed));

          }

        } catch {

          /* ignore */

        }

      }

    }

    return canonical || trimmed;

  } catch {

    return trimmed;

  }

}



const VENDOR_UUID_RE =

  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;



export function clearLedgerVendorIdCache(): void {

  if (typeof window !== 'undefined') {

    sessionStorage.removeItem(SESSION_KEY);

  }

}


