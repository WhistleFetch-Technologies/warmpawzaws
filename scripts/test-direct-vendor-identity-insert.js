const { Pool } = require('pg');

async function testDirectInsert() {
  const pool = new Pool({
    host: 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: 'Warmpawz2026',
  });

  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  TESTING DIRECT VENDOR_IDENTITY INSERT');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const testPhone = `9${Math.floor(Math.random() * 1000000000)}`;
    const normalizedPhone = testPhone.length === 10 ? testPhone : `0${testPhone}`;
    
    console.log(`Test Phone: ${normalizedPhone}\n`);

    // Step 1: Check schema
    console.log('1️⃣  Checking schema...\n');
    const schemaCheck = await pool.query(`
      SELECT 
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_identity' AND column_name = 'metadata') as has_metadata
    `);
    console.log(`   has_metadata: ${schemaCheck.rows[0].has_metadata}\n`);

    // Step 2: Try insert without metadata
    console.log('2️⃣  Testing insert WITHOUT metadata...\n');
    try {
      const result1 = await pool.query(
        `INSERT INTO vendor_identity (phone, onboarding_status) VALUES ($1, $2) RETURNING *`,
        [normalizedPhone, 'INIT']
      );
      console.log(`   ✅ SUCCESS: Created vendor_identity ${result1.rows[0].id}\n`);
      
      // Clean up
      await pool.query(`DELETE FROM vendor_identity WHERE id = $1`, [result1.rows[0].id]);
      console.log(`   ✅ Cleaned up test record\n`);
    } catch (e) {
      console.error(`   ❌ ERROR: ${e.message}\n`);
    }

    // Step 3: Try insert WITH metadata
    console.log('3️⃣  Testing insert WITH metadata...\n');
    const testMetadata = {
      referral_code_id: 'test-id',
      referrer_vendor_id: 'test-vendor-id',
      referral_code: 'TESTCODE',
    };
    
    try {
      const result2 = await pool.query(
        `INSERT INTO vendor_identity (phone, onboarding_status, metadata) VALUES ($1, $2, $3::jsonb) RETURNING *`,
        [normalizedPhone, 'INIT', JSON.stringify(testMetadata)]
      );
      console.log(`   ✅ SUCCESS: Created vendor_identity ${result2.rows[0].id}`);
      console.log(`   Metadata: ${JSON.stringify(result2.rows[0].metadata || {})}\n`);
      
      // Clean up
      await pool.query(`DELETE FROM vendor_identity WHERE id = $1`, [result2.rows[0].id]);
      console.log(`   ✅ Cleaned up test record\n`);
    } catch (e) {
      console.error(`   ❌ ERROR: ${e.message}`);
      console.error(`   Error code: ${e.code}`);
      console.error(`   Error detail: ${e.detail}\n`);
    }

    console.log('✅ Direct insert test completed\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

testDirectInsert();
