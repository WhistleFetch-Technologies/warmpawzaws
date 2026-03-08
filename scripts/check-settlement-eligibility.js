/**
 * Diagnostic script to check settlement eligibility for vendor
 * Run: node scripts/check-settlement-eligibility.js
 */

// Load environment variables from .env file
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'warmpawz',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

const vendorId = '85f2435f-4507-420e-b859-fc1571100682';

async function runDiagnostics() {
  try {
    console.log('🔍 Settlement Eligibility Diagnostics\n');
    console.log('='.repeat(60));

    // 1. Check vendor_tiers for 'Basic' tier
    console.log('\n1️⃣ Checking vendor_tiers for "Basic" tier:');
    const tierResult = await pool.query(`
      SELECT tier_name, tier_level, payout_period_days, is_active, commission_rate
      FROM vendor_tiers 
      WHERE LOWER(tier_name) = 'basic'
    `);
    
    if (tierResult.rows.length === 0) {
      console.log('❌ No "Basic" tier found in vendor_tiers table');
    } else {
      console.log('✅ Found Basic tier:');
      tierResult.rows.forEach(row => {
        console.log(`   - Name: ${row.tier_name}, Period: ${row.payout_period_days} days, Active: ${row.is_active}, Commission: ${row.commission_rate}%`);
      });
    }

    // 2. Check vendor details
    console.log('\n2️⃣ Checking vendor details:');
    const vendorResult = await pool.query(`
      SELECT id, business_name, tier, commission_percentage
      FROM vendors 
      WHERE id = $1
    `, [vendorId]);
    
    if (vendorResult.rows.length === 0) {
      console.log(`❌ Vendor ${vendorId} not found`);
      return;
    }
    
    const vendor = vendorResult.rows[0];
    console.log(`✅ Vendor: ${vendor.business_name || vendor.id}`);
    console.log(`   - Tier: ${vendor.tier || 'NULL'}`);
    console.log(`   - Commission: ${vendor.commission_percentage || 'NULL'}%`);

    // 3. Check bookings status
    console.log('\n3️⃣ Checking bookings for this vendor:');
    const bookingsResult = await pool.query(`
      SELECT 
        id,
        status,
        completed_at,
        settled_at,
        total_amount,
        created_at,
        CASE 
          WHEN status != 'completed' THEN 'Status not completed'
          WHEN completed_at IS NULL THEN 'completed_at is NULL'
          WHEN settled_at IS NOT NULL THEN 'Already settled'
          ELSE 'Eligible'
        END as eligibility_status
      FROM bookings 
      WHERE vendor_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [vendorId]);

    console.log(`Found ${bookingsResult.rows.length} recent bookings:`);
    bookingsResult.rows.forEach((booking, idx) => {
      console.log(`\n   Booking ${idx + 1}: ${booking.id.substring(0, 8)}...`);
      console.log(`   - Status: ${booking.status}`);
      console.log(`   - Amount: ₹${booking.total_amount || 0}`);
      console.log(`   - Created: ${booking.created_at}`);
      console.log(`   - Completed: ${booking.completed_at || 'NULL'}`);
      console.log(`   - Settled: ${booking.settled_at || 'NOT SETTLED'}`);
      console.log(`   - Eligibility: ${booking.eligibility_status}`);
    });

    // 4. Check if bookings would match the settlement query
    console.log('\n4️⃣ Simulating settlement eligibility query:');
    const eligibleResult = await pool.query(`
      SELECT 
        b.id,
        b.status,
        b.completed_at,
        b.settled_at,
        b.total_amount,
        v.tier,
        vt.tier_name as matched_tier,
        vt.payout_period_days,
        NOW() - (COALESCE(vt.payout_period_days, 7) * INTERVAL '1 day') as eligibility_cutoff,
        CASE 
          WHEN b.status != 'completed' THEN '❌ Status not completed'
          WHEN b.settled_at IS NOT NULL THEN '✅ Already settled'
          WHEN b.completed_at IS NULL THEN '❌ completed_at is NULL'
          WHEN b.completed_at >= (NOW() - (COALESCE(vt.payout_period_days, 7) * INTERVAL '1 day')) 
            THEN '⏳ Too recent (not past payout period)'
          ELSE '✅ ELIGIBLE FOR SETTLEMENT'
        END as reason
      FROM bookings b
      INNER JOIN vendors v ON b.vendor_id = v.id
      LEFT JOIN vendor_tiers vt ON vt.is_active = true 
        AND (TRIM(LOWER(COALESCE(v.tier, ''))) = TRIM(LOWER(vt.tier_name)))
      WHERE b.vendor_id = $1
      ORDER BY b.created_at DESC
      LIMIT 10
    `, [vendorId]);

    if (eligibleResult.rows.length === 0) {
      console.log('❌ No bookings found for this vendor');
    } else {
      console.log(`\nFound ${eligibleResult.rows.length} bookings:`);
      eligibleResult.rows.forEach((row, idx) => {
        console.log(`\n   Booking ${idx + 1}:`);
        console.log(`   - ID: ${row.id.substring(0, 8)}...`);
        console.log(`   - Status: ${row.status}`);
        console.log(`   - Vendor Tier: ${row.tier || 'NULL'}`);
        console.log(`   - Matched Tier: ${row.matched_tier || 'NO MATCH'}`);
        console.log(`   - Payout Period: ${row.payout_period_days || 7} days`);
        console.log(`   - Completed At: ${row.completed_at || 'NULL'}`);
        console.log(`   - Eligibility Cutoff: ${row.eligibility_cutoff}`);
        console.log(`   - Result: ${row.reason}`);
      });
    }

    // 5. Count eligible bookings
    console.log('\n5️⃣ Counting eligible bookings (actual settlement query):');
    const countResult = await pool.query(`
      SELECT COUNT(*) as eligible_count
      FROM bookings b
      INNER JOIN vendors v ON b.vendor_id = v.id
      LEFT JOIN vendor_tiers vt ON vt.is_active = true 
        AND (TRIM(LOWER(COALESCE(v.tier, ''))) = TRIM(LOWER(vt.tier_name)))
      WHERE b.vendor_id = $1
        AND b.status = 'completed'
        AND b.settled_at IS NULL
        AND b.completed_at IS NOT NULL
        AND b.completed_at < (NOW() - (COALESCE(vt.payout_period_days, 7) * INTERVAL '1 day'))
    `, [vendorId]);

    console.log(`✅ Eligible bookings: ${countResult.rows[0].eligible_count}`);

    console.log('\n' + '='.repeat(60));
    console.log('\n📋 Summary:');
    console.log(`   - Vendor has tier: ${vendor.tier || 'NULL'}`);
    console.log(`   - Basic tier exists: ${tierResult.rows.length > 0 ? 'YES' : 'NO'}`);
    console.log(`   - Total bookings checked: ${bookingsResult.rows.length}`);
    console.log(`   - Eligible for settlement: ${countResult.rows[0].eligible_count}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

runDiagnostics();
