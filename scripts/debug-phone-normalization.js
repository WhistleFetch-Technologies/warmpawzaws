const { Pool } = require('pg');

async function debugPhoneNormalization() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  DEBUGGING PHONE NORMALIZATION');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Check recent vendor_identity records
    const recentIdentities = await pool.query(
      `SELECT id, phone, onboarding_status, metadata, created_at
       FROM vendor_identity 
       ORDER BY created_at DESC 
       LIMIT 10`
    );

    console.log(`Found ${recentIdentities.rows.length} recent vendor_identity records:\n`);
    recentIdentities.rows.forEach((vi, i) => {
      console.log(`${i + 1}. ID: ${vi.id}`);
      console.log(`   Phone: "${vi.phone}" (length: ${vi.phone?.length || 0})`);
      console.log(`   Status: ${vi.onboarding_status}`);
      console.log(`   Created: ${new Date(vi.created_at).toLocaleString()}`);
      
      let metadata = vi.metadata;
      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata);
        } catch (e) {
          metadata = {};
        }
      }
      const hasReferral = !!(metadata.referral_code_id || metadata.referral_code);
      console.log(`   Has Referral: ${hasReferral ? 'YES' : 'NO'}`);
      console.log('');
    });

    // Test phone normalization
    console.log('Testing phone normalization:\n');
    const testPhones = [
      '+919073599276',
      '9073599276',
      '09073599276',
    ];

    testPhones.forEach(testPhone => {
      const normalized = (() => {
        const raw = String(testPhone || '').trim();
        const digits = raw.replace(/\D/g, '');
        if (digits.length === 10) return `+91${digits}`;
        if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
        if (raw.startsWith('+')) return raw;
        return digits ? `+${digits}` : raw;
      })();
      
      console.log(`   Input: "${testPhone}" -> Normalized: "${normalized}"`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

debugPhoneNormalization();
