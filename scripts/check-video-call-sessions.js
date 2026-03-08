/**
 * Check active video call sessions for a customer
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
  password: process.env.DB_PASSWORD || 'postgres',
});

const customerPhone = process.argv[2] || '9326977987';

async function checkVideoCallSessions() {
  try {
    console.log(`\n🔍 Checking video call sessions for customer phone: ${customerPhone}\n`);

    // First, get customer ID from phone
    const customerResult = await pool.query(
      `SELECT id, phone, full_name FROM customers WHERE phone = $1`,
      [customerPhone]
    );

    if (customerResult.rows.length === 0) {
      console.log('❌ Customer not found with phone:', customerPhone);
      return;
    }

    const customer = customerResult.rows[0];
    console.log(`✅ Customer found: ${customer.full_name} (ID: ${customer.id})\n`);

    // Check active video call sessions
    const sessionsQuery = `
      SELECT 
        vcs.id as session_id,
        vcs.booking_id,
        vcs.meeting_id,
        vcs.status,
        vcs.started_at,
        b.customer_id,
        b.vendor_id,
        b.status as booking_status,
        b.completed_at,
        b.video_call_ended_at,
        v.business_name as vendor_name,
        svc.name as service_name,
        p.name as pet_name,
        c.full_name as customer_name
      FROM video_call_sessions vcs
      JOIN bookings b ON vcs.booking_id = b.id
      LEFT JOIN vendors v ON b.vendor_id = v.id
      LEFT JOIN services svc ON b.service_id = svc.id
      LEFT JOIN pets p ON b.pet_id = p.id
      LEFT JOIN customers c ON b.customer_id = c.id
      WHERE b.customer_id = $1
        AND vcs.status IN ('active', 'waiting')
        AND b.status != 'completed'
      ORDER BY vcs.started_at DESC
      LIMIT 10
    `;

    const sessionsResult = await pool.query(sessionsQuery, [customer.id]);
    const sessions = sessionsResult.rows;

    console.log(`📹 Active Video Call Sessions: ${sessions.length}\n`);

    if (sessions.length === 0) {
      console.log('❌ No active video call sessions found\n');
      
      // Check recent completed sessions
      const completedQuery = `
        SELECT 
          vcs.id as session_id,
          vcs.booking_id,
          vcs.meeting_id,
          vcs.status,
          vcs.started_at,
          b.status as booking_status,
          b.completed_at,
          b.video_call_ended_at,
          v.business_name as vendor_name,
          svc.name as service_name
        FROM video_call_sessions vcs
        JOIN bookings b ON vcs.booking_id = b.id
        LEFT JOIN vendors v ON b.vendor_id = v.id
        LEFT JOIN services svc ON b.service_id = svc.id
        WHERE b.customer_id = $1
        ORDER BY vcs.started_at DESC
        LIMIT 5
      `;
      
      const completedResult = await pool.query(completedQuery, [customer.id]);
      console.log(`\n📋 Recent Video Call Sessions (all statuses): ${completedResult.rows.length}\n`);
      completedResult.rows.forEach((session, idx) => {
        console.log(`${idx + 1}. Session: ${session.session_id}`);
        console.log(`   Booking: ${session.booking_id}`);
        console.log(`   Status: ${session.status} (Booking: ${session.booking_status})`);
        console.log(`   Vendor: ${session.vendor_name}`);
        console.log(`   Service: ${session.service_name}`);
        console.log(`   Started: ${session.started_at}`);
        console.log(`   Completed: ${session.completed_at || 'N/A'}`);
        console.log(`   Video Ended: ${session.video_call_ended_at || 'N/A'}`);
        console.log('');
      });
    } else {
      sessions.forEach((session, idx) => {
        console.log(`${idx + 1}. Session: ${session.session_id}`);
        console.log(`   Booking: ${session.booking_id}`);
        console.log(`   Meeting: ${session.meeting_id}`);
        console.log(`   Status: ${session.status}`);
        console.log(`   Booking Status: ${session.booking_status}`);
        console.log(`   Vendor: ${session.vendor_name}`);
        console.log(`   Service: ${session.service_name}`);
        console.log(`   Pet: ${session.pet_name || 'N/A'}`);
        console.log(`   Started: ${session.started_at}`);
        console.log('');
      });
    }

    // Check bookings marked as completed
    const completedBookingsQuery = `
      SELECT 
        b.id,
        b.status,
        b.completed_at,
        b.video_call_ended_at,
        b.is_instant_tele,
        v.business_name as vendor_name,
        svc.name as service_name
      FROM bookings b
      LEFT JOIN vendors v ON b.vendor_id = v.id
      LEFT JOIN services svc ON b.service_id = svc.id
      WHERE b.customer_id = $1
        AND b.status = 'completed'
        AND b.is_instant_tele = true
      ORDER BY b.completed_at DESC
      LIMIT 10
    `;

    const completedBookingsResult = await pool.query(completedBookingsQuery, [customer.id]);
    console.log(`\n✅ Completed Instant Tele Bookings: ${completedBookingsResult.rows.length}\n`);
    
    if (completedBookingsResult.rows.length > 0) {
      completedBookingsResult.rows.forEach((booking, idx) => {
        console.log(`${idx + 1}. Booking: ${booking.id}`);
        console.log(`   Status: ${booking.status}`);
        console.log(`   Completed At: ${booking.completed_at || 'NULL'}`);
        console.log(`   Video Ended: ${booking.video_call_ended_at || 'NULL'}`);
        console.log(`   Vendor: ${booking.vendor_name}`);
        console.log(`   Service: ${booking.service_name}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

checkVideoCallSessions();
