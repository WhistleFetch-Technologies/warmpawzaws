/**
 * Check eligibility for the two updated bookings
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
const envPath = path.join(__dirname, '..', '.env.local');
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
} else {
  // Fallback to .env
  const envPath2 = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath2)) {
    const envContent = fs.readFileSync(envPath2, 'utf8');
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
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'warmpawz',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

const bookingIds = [
  'fcc6828d-9e15-48d1-8dc1-db7818d2254c',
  '6302c280-a8a2-4f40-95ef-270c6511c2a4'
];

async function checkEligibility() {
  try {
    console.log('🔍 Checking eligibility for updated bookings\n');
    console.log('='.repeat(80));

    for (const bookingId of bookingIds) {
      console.log(`\n📋 Booking ID: ${bookingId}`);
      console.log('-'.repeat(80));

      const result = await pool.query(`
        SELECT 
          b.id as booking_id,
          b.status as current_status,
          b.completed_at,
          b.video_call_ended_at,
          b.settled_at,
          b.total_amount,
          b.created_at,
          v.tier as vendor_tier,
          vt.tier_name as matched_tier,
          vt.payout_period_days,
          
          -- Eligibility cutoff
          NOW() - (COALESCE(vt.payout_period_days, 7) * INTERVAL '1 day') as eligibility_cutoff,
          
          -- Check if eligible (matches the settlement query logic)
          CASE 
            WHEN b.status != 'completed' THEN '❌ Status not completed'
            WHEN b.settled_at IS NOT NULL THEN '✅ Already settled'
            WHEN b.completed_at IS NULL THEN '❌ completed_at is NULL'
            WHEN b.completed_at >= (NOW() - (COALESCE(vt.payout_period_days, 7) * INTERVAL '1 day')) 
              THEN '⏳ Too recent (not past payout period)'
            ELSE '✅ ELIGIBLE FOR SETTLEMENT'
          END as eligibility_status,
          
          -- Calculate days since completion
          CASE 
            WHEN b.completed_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (NOW() - b.completed_at)) / 86400
            ELSE NULL
          END as days_since_completion,
          
          -- Calculate days until eligible
          CASE 
            WHEN b.completed_at IS NOT NULL
              AND b.completed_at < (NOW() - (COALESCE(vt.payout_period_days, 7) * INTERVAL '1 day'))
            THEN 0
            WHEN b.completed_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM ((NOW() - (COALESCE(vt.payout_period_days, 7) * INTERVAL '1 day')) - b.completed_at)) / 86400
            ELSE NULL
          END as days_until_eligible

        FROM bookings b
        INNER JOIN vendors v ON b.vendor_id = v.id
        LEFT JOIN vendor_tiers vt ON vt.is_active = true 
          AND (TRIM(LOWER(COALESCE(v.tier, ''))) = TRIM(LOWER(vt.tier_name)))
        WHERE b.id = $1
      `, [bookingId]);

      if (result.rows.length === 0) {
        console.log('❌ Booking not found');
        continue;
      }

      const row = result.rows[0];
      
      console.log(`\n📊 Booking Details:`);
      console.log(`   Status: ${row.current_status}`);
      console.log(`   Amount: ₹${row.total_amount || 0}`);
      console.log(`   Created: ${row.created_at}`);
      
      console.log(`\n📅 Completion Status:`);
      console.log(`   completed_at: ${row.completed_at || 'NULL'}`);
      console.log(`   video_call_ended_at: ${row.video_call_ended_at || 'NULL'}`);
      console.log(`   settled_at: ${row.settled_at || 'NOT SETTLED'}`);
      
      console.log(`\n🏷️ Vendor & Tier:`);
      console.log(`   Vendor Tier: ${row.vendor_tier || 'NULL'}`);
      console.log(`   Matched Tier: ${row.matched_tier || 'NO MATCH'}`);
      console.log(`   Payout Period: ${row.payout_period_days || 7} days`);
      
      console.log(`\n⏰ Timeline:`);
      console.log(`   Eligibility Cutoff: ${row.eligibility_cutoff}`);
      if (row.completed_at) {
        console.log(`   Days Since Completion: ${Math.round((row.days_since_completion || 0) * 10) / 10} days`);
      }
      if (row.days_until_eligible !== null) {
        if (row.days_until_eligible <= 0) {
          console.log(`   Days Until Eligible: ✅ ELIGIBLE NOW`);
        } else {
          console.log(`   Days Until Eligible: ${Math.round(row.days_until_eligible * 10) / 10} days`);
        }
      }
      
      console.log(`\n✅ Eligibility Result:`);
      console.log(`   ${row.eligibility_status}`);
      
      // Check if it matches the settlement query
      const settlementCheck = await pool.query(`
        SELECT b.*
        FROM bookings b
        INNER JOIN vendors v ON b.vendor_id = v.id
        LEFT JOIN vendor_tiers vt ON vt.is_active = true 
          AND (TRIM(LOWER(COALESCE(v.tier, ''))) = TRIM(LOWER(vt.tier_name)))
        WHERE b.id = $1
          AND b.status = 'completed'
          AND b.settled_at IS NULL
          AND b.completed_at < (NOW() - (COALESCE(vt.payout_period_days, 7) * INTERVAL '1 day'))
      `, [bookingId]);
      
      if (settlementCheck.rows.length > 0) {
        console.log(`\n🎯 Settlement Query Match: ✅ YES - This booking will be included in settlement calculation`);
      } else {
        console.log(`\n🎯 Settlement Query Match: ❌ NO - This booking will NOT be included`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Check complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

checkEligibility();
