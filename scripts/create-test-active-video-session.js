/**
 * Create a test active video call session for testing TeleTracker
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
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
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'warmpawz',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

const customerPhone = process.argv[2] || '9326977987';

async function createTestSession() {
  try {
    console.log(`\n🔧 Creating test active video call session for: ${customerPhone}\n`);

    // Get customer
    const customerResult = await pool.query(
      `SELECT id, full_name FROM customers WHERE phone = $1`,
      [customerPhone]
    );

    if (customerResult.rows.length === 0) {
      console.log('❌ Customer not found');
      return;
    }

    const customer = customerResult.rows[0];
    console.log(`✅ Customer: ${customer.full_name} (${customer.id})\n`);

    // Get a recent booking for this customer (or create one)
    const bookingResult = await pool.query(`
      SELECT b.id, b.vendor_id, b.service_id, b.pet_id, v.business_name, svc.name as service_name
      FROM bookings b
      LEFT JOIN vendors v ON b.vendor_id = v.id
      LEFT JOIN services svc ON b.service_id = svc.id
      WHERE b.customer_id = $1
        AND b.is_instant_tele = true
        AND b.status IN ('confirmed', 'in_progress')
      ORDER BY b.created_at DESC
      LIMIT 1
    `, [customer.id]);

    let bookingId;
    if (bookingResult.rows.length === 0) {
      console.log('⚠️  No suitable booking found. Creating a test booking...\n');
      
      // Get a vendor
      const vendorResult = await pool.query(
        `SELECT id, business_name FROM vendors LIMIT 1`
      );
      
      if (vendorResult.rows.length === 0) {
        console.log('❌ No vendors found in database');
        return;
      }

      const vendor = vendorResult.rows[0];
      
      // Get a service
      const serviceResult = await pool.query(
        `SELECT id, name FROM services WHERE name ILIKE '%tele%' LIMIT 1`
      );
      
      const serviceId = serviceResult.rows.length > 0 ? serviceResult.rows[0].id : null;
      
      // Get a pet
      const petResult = await pool.query(
        `SELECT id FROM pets WHERE customer_id = $1 LIMIT 1`,
        [customer.id]
      );
      
      const petId = petResult.rows.length > 0 ? petResult.rows[0].id : null;

      // Create test booking
      const newBookingResult = await pool.query(`
        INSERT INTO bookings (
          customer_id, vendor_id, service_id, pet_id,
          booking_date, booking_time, status, service_type,
          total_amount, is_instant_tele, payment_status
        ) VALUES ($1, $2, $3, $4, CURRENT_DATE, CURRENT_TIME, 'confirmed', 'tele', 699.00, true, 'paid')
        RETURNING id
      `, [customer.id, vendor.id, serviceId, petId]);

      bookingId = newBookingResult.rows[0].id;
      console.log(`✅ Created test booking: ${bookingId}\n`);
    } else {
      bookingId = bookingResult.rows[0].id;
      console.log(`✅ Using existing booking: ${bookingId}`);
      console.log(`   Vendor: ${bookingResult.rows[0].business_name}`);
      console.log(`   Service: ${bookingResult.rows[0].service_name}\n`);
    }

    // Check if session already exists
    const existingSession = await pool.query(`
      SELECT id, status FROM video_call_sessions WHERE booking_id = $1
    `, [bookingId]);

    if (existingSession.rows.length > 0) {
      const session = existingSession.rows[0];
      console.log(`⚠️  Session already exists: ${session.id} (status: ${session.status})`);
      
      // Update to active if not already
      if (session.status !== 'active' && session.status !== 'waiting') {
        await pool.query(`
          UPDATE video_call_sessions
          SET status = 'active', started_at = NOW(), ended_at = NULL
          WHERE id = $1
        `, [session.id]);
        console.log(`✅ Updated session to active status\n`);
      } else {
        console.log(`✅ Session is already active\n`);
      }
      
      // Also ensure booking is not completed
      await pool.query(`
        UPDATE bookings
        SET status = 'confirmed', completed_at = NULL
        WHERE id = $1 AND status = 'completed'
      `, [bookingId]);
      
      return;
    }

    // Create new active session
    const sessionResult = await pool.query(`
      INSERT INTO video_call_sessions (
        booking_id,
        meeting_id,
        status,
        started_at,
        customer_attendee_id,
        vendor_attendee_id
      ) VALUES (
        $1,
        'test-meeting-' || gen_random_uuid()::text,
        'active',
        NOW(),
        'test-customer-attendee-' || gen_random_uuid()::text,
        'test-vendor-attendee-' || gen_random_uuid()::text
      )
      RETURNING id, meeting_id, status
    `, [bookingId]);

    const session = sessionResult.rows[0];
    console.log(`✅ Created active video call session:`);
    console.log(`   Session ID: ${session.id}`);
    console.log(`   Meeting ID: ${session.meeting_id}`);
    console.log(`   Status: ${session.status}`);
    console.log(`   Booking ID: ${bookingId}\n`);
    
    console.log(`🎯 Test the endpoint:`);
    console.log(`   http://localhost:3000/video-call/customer/${customer.id}/active\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

createTestSession();
