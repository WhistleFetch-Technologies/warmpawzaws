import { query, insert } from '../database/rds-connection';

/** Vendor roles that always get a separate end-session OTP for at-home visits. */
const DEDICATED_END_OTP_VENDOR_ROLE_SLUGS = new Set([
  'pet_walker',
  'walker',
  'dog_walker',
  'walker_solo',
  'walking',
  'pet_sitter',
  'sitter',
  'sitter_solo',
  'pet_sitter_solo',
  'pet_sitter_saas',
]);

function serviceLooksLikeDogWalk(serviceCategory: string, serviceName: string): boolean {
  const c = (serviceCategory || '').toLowerCase().trim();
  const n = (serviceName || '').toLowerCase();
  if (['walker', 'walking', 'dog_walking'].includes(c)) return true;
  // e.g. catalog "Walking & Exercise", "Dog Walking", display categories with spaces
  if (c.includes('walk')) return true;
  if (n.includes('walk') || n.includes('walking')) return true;
  return false;
}

/**
 * At-home bookings that should use otp_tokens + completion_otp for session end
 * (not the same code as bookings.otp_code).
 * Uses vendor role and/or catalog service name/category so dog walkers still match
 * when role rows are inactive or mis-synced.
 */
export async function bookingUsesDedicatedEndSessionOtp(bookingId: string): Promise<boolean> {
  // bookings.service_id is usually vendor_services.id — resolve name/category like customer booking APIs
  const res = await query(
    `SELECT b.service_style,
            b.service_type,
            LOWER(TRIM(COALESCE(r.name, ''))) AS role_slug,
            LOWER(TRIM(COALESCE(br_svc.br_category, s.category, ''))) AS svc_cat,
            LOWER(COALESCE(br_svc.br_name, s.name, '')) AS svc_name
     FROM bookings b
     LEFT JOIN vendors v ON v.id = b.vendor_id
     LEFT JOIN roles r ON r.id = v.role_id
     LEFT JOIN LATERAL (
       SELECT
         COALESCE(sc.service_name, s_direct.name, vp.service_name) AS br_name,
         COALESCE(sc.category_name, s_direct.category::text, vp.category::text) AS br_category
       FROM vendor_services vp
       LEFT JOIN service_catalog sc ON sc.id = COALESCE(vp.service_id, b.service_id)
       LEFT JOIN services s_direct ON s_direct.id = COALESCE(vp.service_id, b.service_id) AND sc.id IS NULL
       WHERE vp.vendor_id = b.vendor_id
         AND (vp.service_id = b.service_id OR vp.id = b.service_id)
       ORDER BY
         CASE WHEN vp.service_id = b.service_id THEN 0 WHEN vp.id = b.service_id THEN 1 ELSE 2 END,
         vp.updated_at DESC NULLS LAST
       LIMIT 1
     ) br_svc ON true
     LEFT JOIN services s ON s.id = b.service_id
     WHERE b.id = $1
     LIMIT 1`,
    [bookingId]
  ).catch(() => ({ rows: [] }));

  const row = (res as any).rows?.[0];
  if (!row) return false;

  const atHome = row.service_style === 'at_home' || row.service_type === 'at_home';
  if (!atHome) return false;

  const slug = String(row.role_slug || '');
  if (slug && DEDICATED_END_OTP_VENDOR_ROLE_SLUGS.has(slug)) return true;

  return serviceLooksLikeDogWalk(String(row.svc_cat || ''), String(row.svc_name || ''));
}

/**
 * After start OTP is verified, create a dedicated end-session OTP (otp_tokens + bookings.completion_otp)
 * for roles that complete with a different code than bookings.otp_code.
 */
export async function ensureDedicatedEndSessionOtp(bookingId: string): Promise<void> {
  const bid = String(bookingId);
  const existing = await query(
    `SELECT id FROM otp_tokens
     WHERE metadata->>'bookingId' = $1
       AND metadata->>'action' = 'end'
       AND is_used = false
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY created_at DESC
     LIMIT 1`,
    [bid]
  ).catch(() => ({ rows: [] }));
  if ((existing as any).rows?.length) return;

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  await insert('otp_tokens', {
    phone: null,
    otp_code: otp,
    otp_type: 'booking_end',
    expires_in_minutes: 1440,
    max_attempts: 5,
    metadata: { bookingId: bid, action: 'end' },
  });
  await query(`UPDATE bookings SET completion_otp = $1, updated_at = NOW() WHERE id = $2`, [otp, bid]).catch((e: any) =>
    console.warn('[END-SESSION-OTP] completion_otp update skipped:', e?.message)
  );
}
