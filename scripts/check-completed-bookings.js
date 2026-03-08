/**
 * Check completed instant tele bookings for settlement eligibility
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

const bookingIds = [
  'fcc6828d-9e15-48d1-8dc1-db7818d2254c',
  '6302c280-a8a2-4f40-95ef-270c6511c2a4'
];

async function checkBookings() {
  try {
    console.log('🔍 Checking completed instant tele bookings for settlement eligibility\n');
    console.log('='.repeat(80));

    const result = await pool.query(`
      SELECT 
        b.id,
        b.status,
        b.completed_at,
        b.video_call_ended_at,
        b.settled_at,
        b.total_amount,
        b.created_at,
        b.is_instant_tele,
        v.tier,
        vt.tier_name as matched_tier,
        vt.payout_period_days,
        NOW() - (COALESCE(vt.payout_period_days, 7) * INTERVAL '1 day') as eligibility_cutoff,
        
        -- Check eligibility using actual settlement query logic
        CASE 
          WHEN b.status = 'completed' 
            AND b.completed_at IS NOT NULL 
            AND b.settled_at IS NULL
            AND b.completed_at < (NOW() - (COALESCE(vt.payout_period_days, 7) * INTERVAL '1 day'))
          THEN '✅ ELIGIBLE'
          ELSE '❌ NOT ELIGIBLE'
        END as eligibility,
        
        -- Detailed reason
        CASE 
          WHEN b.status != 'completed' THEN 'Status not completed'
          WHEN b.completed_at IS NULL THEN '❌ completed_at is NULL'
          WHEN b.settled_at IS NOT NULL THEN 'Already settled'
          WHEN b.completed_at >= (NOW() - (COALESCE(vt.payout_period_days, 7) * INTERVAL '1 day')) 
            THEN 'Too recent (not past payout period)'
          ELSE '✅ All conditions met'
        END as reason,
        
        -- Age calculation
        CASE 
          WHEN b.completed_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (NOW() - b.completed_at)) / 86400
          ELSE NULL
        END as days_since_completed

      FROM bookings b
      INNER JOIN vendors v ON b.vendor_id = v.id
      LEFT JOIN vendor_tiers vt ON vt.is_active = true 
        AND (TRIM(LOWER(COALESCE(v.tier, ''))) = TRIM(LOWER(vt.tier_name)))
      WHERE b.id = ANY($1)
      ORDER BY b.created_at DESC
    `, [bookingIds]);

    if (result.rows.length === 0) {
      console.log('❌ No bookings found');
      return;
    }

    console.log(`\nFound ${result.rows.length} booking(s):\n`);

    result.rows.forEach((row, idx) => {
      console.log(`\n${idx + 1}. Booking: ${row.id.substring(0, 8)}...`);
      console.log('   ' + '-'.repeat(76));
      console.log(`   Status: ${row.status}`);
      console.log(`   is_instant_tele: ${row.is_instant_tele}`);
      console.log(`   Amount: ₹${row.total_amount || 0}`);
      console.log(`   Created: ${row.created_at}`);
      console.log(`   completed_at: ${row.completed_at || '❌ NULL'}`);
      console.log(`   video_call_ended_at: ${row.video_call_ended_at || 'NULL'}`);
      console.log(`   settled_at: ${row.settled_at || 'NOT SETTLED'}`);
      console.log(`   Vendor Tier: ${row.tier || 'NULL'}`);
      console.log(`   Matched Tier: ${row.matched_tier || 'NO MATCH'}`);
      console.log(`   Payout Period: ${row.payout_period_days || 7} days`);
      console.log(`   Eligibility Cutoff: ${row.eligibility_cutoff}`);
      if (row.days_since_completed !== null) {
        console.log(`   Days Since Completed: ${Math.round(row.days_since_completed * 10) / 10} days`);
      }
      console.log(`   Eligibility: ${row.eligibility}`);
      console.log(`   Reason: ${row.reason}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('\n📋 Summary:');
    const eligible = result.rows.filter(r => r.eligibility.includes('ELIGIBLE'));
    const notEligible = result.rows.filter(r => r.eligibility.includes('NOT ELIGIBLE'));
    console.log(`   ✅ Eligible: ${eligible.length}`);
    console.log(`   ❌ Not Eligible: ${notEligible.length}`);
    
    if (notEligible.length > 0) {
      console.log('\n❌ Reasons for not being eligible:');
      notEligible.forEach(row => {
        console.log(`   - ${row.id.substring(0, 8)}...: ${row.reason}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

checkBookings();
