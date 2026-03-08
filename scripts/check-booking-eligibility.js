/**
 * Check booking eligibility for settlement
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
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

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'warmpawz',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

const bookingId = process.argv[2] || '3c75c8b4-332c-464a-b12f-d1609f440d9f';

async function checkEligibility() {
  try {
    console.log(`🔍 Checking eligibility for booking: ${bookingId}\n`);
    console.log('='.repeat(80));

    const result = await pool.query(`
      SELECT 
        b.id as booking_id,
        b.status as current_status,
        b.completed_at as current_completed_at,
        b.video_call_ended_at,
        b.settled_at,
        b.total_amount,
        b.created_at,
        v.tier as vendor_tier,
        vt.tier_name as matched_tier,
        vt.payout_period_days,
        
        -- Calculate eligibility cutoff (using video_call_ended_at as potential completed_at)
        COALESCE(b.completed_at, b.video_call_ended_at) as potential_completed_at,
        NOW() - (COALESCE(vt.payout_period_days, 7) * INTERVAL '1 day') as eligibility_cutoff,
        
        -- Check if eligible with current completed_at
        CASE 
          WHEN b.status != 'completed' THEN '❌ Status not completed (current: ' || b.status || ')'
          WHEN b.settled_at IS NOT NULL THEN '✅ Already settled'
          WHEN b.completed_at IS NULL THEN '❌ completed_at is NULL'
          WHEN b.completed_at >= (NOW() - (COALESCE(vt.payout_period_days, 7) * INTERVAL '1 day')) 
            THEN '⏳ Too recent (not past payout period)'
          ELSE '✅ ELIGIBLE FOR SETTLEMENT'
        END as current_eligibility,
        
        -- Check if eligible with video_call_ended_at as completed_at
        CASE 
          WHEN b.status != 'completed' THEN '❌ Status not completed (would need to be "completed")'
          WHEN b.settled_at IS NOT NULL THEN '✅ Already settled'
          WHEN b.video_call_ended_at IS NULL THEN '❌ video_call_ended_at is NULL'
          WHEN b.video_call_ended_at >= (NOW() - (COALESCE(vt.payout_period_days, 7) * INTERVAL '1 day')) 
            THEN '⏳ Too recent (not past payout period)'
          ELSE '✅ WOULD BE ELIGIBLE (if status=completed and completed_at=video_call_ended_at)'
        END as potential_eligibility,
        
        -- Calculate days until eligible (if video_call_ended_at is used)
        CASE 
          WHEN b.video_call_ended_at IS NOT NULL 
            AND b.video_call_ended_at < (NOW() - (COALESCE(vt.payout_period_days, 7) * INTERVAL '1 day'))
          THEN 0
          WHEN b.video_call_ended_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM ((NOW() - (COALESCE(vt.payout_period_days, 7) * INTERVAL '1 day')) - b.video_call_ended_at)) / 86400
          ELSE NULL
        END as days_until_eligible,
        
        -- When it would become eligible
        CASE 
          WHEN b.video_call_ended_at IS NOT NULL
          THEN (b.video_call_ended_at + (COALESCE(vt.payout_period_days, 7) * INTERVAL '1 day'))
          ELSE NULL
        END as becomes_eligible_at

      FROM bookings b
      INNER JOIN vendors v ON b.vendor_id = v.id
      LEFT JOIN vendor_tiers vt ON vt.is_active = true 
        AND (TRIM(LOWER(COALESCE(v.tier, ''))) = TRIM(LOWER(vt.tier_name)))
      WHERE b.id = $1
    `, [bookingId]);

    if (result.rows.length === 0) {
      console.log('❌ Booking not found');
      return;
    }

    const row = result.rows[0];
    
    console.log('\n📊 Booking Details:');
    console.log(`   ID: ${row.booking_id}`);
    console.log(`   Status: ${row.current_status}`);
    console.log(`   Amount: ₹${row.total_amount || 0}`);
    console.log(`   Created: ${row.created_at}`);
    
    console.log('\n📅 Completion Status:');
    console.log(`   completed_at: ${row.current_completed_at || 'NULL'}`);
    console.log(`   video_call_ended_at: ${row.video_call_ended_at || 'NULL'}`);
    console.log(`   settled_at: ${row.settled_at || 'NOT SETTLED'}`);
    
    console.log('\n🏷️ Vendor & Tier:');
    console.log(`   Vendor Tier: ${row.vendor_tier || 'NULL'}`);
    console.log(`   Matched Tier: ${row.matched_tier || 'NO MATCH'}`);
    console.log(`   Payout Period: ${row.payout_period_days || 7} days`);
    
    console.log('\n⏰ Eligibility Timeline:');
    console.log(`   Eligibility Cutoff: ${row.eligibility_cutoff}`);
    console.log(`   Potential completed_at: ${row.potential_completed_at || 'NULL'}`);
    if (row.becomes_eligible_at) {
      console.log(`   Becomes Eligible At: ${row.becomes_eligible_at}`);
    }
    if (row.days_until_eligible !== null) {
      if (row.days_until_eligible <= 0) {
        console.log(`   Days Until Eligible: ✅ ELIGIBLE NOW`);
      } else {
        console.log(`   Days Until Eligible: ${Math.round(row.days_until_eligible * 10) / 10} days`);
      }
    }
    
    console.log('\n✅ Eligibility Results:');
    console.log(`   Current Eligibility: ${row.current_eligibility}`);
    console.log(`   Potential Eligibility: ${row.potential_eligibility}`);
    
    console.log('\n' + '='.repeat(80));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

checkEligibility();
