import { query } from '../../../../database/rds-connection';
import { extractAndVerifyAuthToken } from '../../../../utils/jwt-verification';

export async function selectCustomerIdByPhoneLast10(last10: string): Promise<string | null> {
  const key = last10.replace(/\D/g, '').slice(-10);
  if (!key || key.length < 10) return null;
  const res = await query(
    `SELECT id FROM customers
     WHERE RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = $1
     ORDER BY
       LENGTH(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g')) ASC,
       (profile_completed IS TRUE) DESC,
       updated_at DESC NULLS LAST,
       created_at DESC NULLS LAST
     LIMIT 1`,
    [key]
  );
  const row = (res as any).rows?.[0];
  return row?.id ? String(row.id) : null;
}

/** Exported for package/session routes that must verify `package_purchases.customer_id`. */
export async function resolvePostgresCustomerIdFromAuthHeaders(
  headers: Record<string, string | undefined>
): Promise<string | null> {
  const authRaw = headers['authorization'] || headers['Authorization'];
  const auth = typeof authRaw === 'string' ? authRaw : '';
  const uatModeOn =
    String(headers['x-uat-mode'] || headers['X-UAT-Mode'] || '').toLowerCase() === 'true' ||
    process.env.UAT_MODE === 'true';

  const bearerMatch = auth.match(/^Bearer\s+(.+)$/i);
  const opaqueToken = bearerMatch ? bearerMatch[1].trim() : '';

  if (opaqueToken.startsWith('uat-token-customer-') && uatModeOn) {
    const m = opaqueToken.match(/^uat-token-customer-(\d{10,})-\d+$/);
    if (m) {
      const last10 = m[1].replace(/\D/g, '').slice(-10);
      if (last10.length === 10) {
        const byUat = await selectCustomerIdByPhoneLast10(last10);
        if (byUat) return byUat;
      }
    }
  }

  const normalized: Record<string, string> = {};
  if (auth) normalized.authorization = auth;

  const res = await extractAndVerifyAuthToken(normalized);
  if (!res.valid || !res.payload) return null;
  const groups = (res.payload['cognito:groups'] as string[]) || [];
  const ut = res.payload['custom:user_type'];
  if (!groups.includes('customer') && ut !== 'customer') return null;

  const sub = String(res.payload.sub || '');
  if (sub && /^[0-9a-fA-F-]{36}$/.test(sub)) {
    const chk = await query(`SELECT id FROM customers WHERE id = $1::uuid LIMIT 1`, [sub]);
    if ((chk as any).rows?.[0]) return String((chk as any).rows[0].id);
  }

  const phoneClaim = String(res.payload.phone_number || '').trim();
  const digits = phoneClaim.replace(/\D/g, '');
  if (digits.length >= 10) {
    const id = await selectCustomerIdByPhoneLast10(digits.slice(-10));
    if (id) return id;
  }

  const cname = String(res.payload['cognito:username'] || '');
  const m = cname.match(/^phone_(.+)$/);
  if (m) {
    const d2 = m[1].replace(/\D/g, '');
    if (d2.length >= 10) {
      const id2 = await selectCustomerIdByPhoneLast10(d2.slice(-10));
      if (id2) return id2;
    }
  }

  return null;
}
