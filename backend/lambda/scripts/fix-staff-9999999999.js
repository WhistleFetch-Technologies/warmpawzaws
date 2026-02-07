/**
 * Fix staff member 9999999999
 */
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function fixStaff() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      INSERT INTO vendor_identity (
        phone, user_type, onboarding_status, vendor_id, selected_role_id, 
        vendor_type, full_name, business_name, email, metadata
      )
      SELECT DISTINCT ON (s.phone)
        s.phone, 'staff', 'ACTIVATED', s.vendor_id::uuid, r.id as selected_role_id,
        COALESCE(vi_vendor.vendor_type, 'business') as vendor_type,
        s.name as full_name,
        COALESCE(v.business_name, s.name) as business_name,
        s.email,
        jsonb_build_object('staff_id', s.id, 'created_via', 'staff_fix_script') as metadata
      FROM staff s
      LEFT JOIN roles r ON (
        (r.name = s.role OR r.display_name = s.role OR 
         LOWER(r.name) = LOWER(s.role) OR LOWER(r.display_name) = LOWER(s.role))
        AND r.is_active = true
      )
      LEFT JOIN vendor_identity vi_vendor ON (
        vi_vendor.vendor_id = s.vendor_id::uuid 
        AND (vi_vendor.user_type IS NULL OR vi_vendor.user_type = 'vendor')
      )
      LEFT JOIN vendors v ON v.id = s.vendor_id::uuid
      WHERE s.phone = '9999999999' AND s.is_active = true
      ORDER BY s.phone, s.created_at DESC
      ON CONFLICT (phone) DO UPDATE SET
        user_type = 'staff',
        onboarding_status = 'ACTIVATED',
        vendor_id = EXCLUDED.vendor_id,
        selected_role_id = EXCLUDED.selected_role_id,
        vendor_type = EXCLUDED.vendor_type,
        full_name = EXCLUDED.full_name,
        business_name = EXCLUDED.business_name,
        email = EXCLUDED.email,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING *
    `);
    console.log('✅ Fixed staff 9999999999:', JSON.stringify(result.rows, null, 2));
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

fixStaff();
