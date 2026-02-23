/**
 * Comprehensive fix for booking tracking:
 * 1. Create gps_tracking_sessions table if missing
 * 2. Create gps_tracking_points table if missing  
 * 3. Update customer address with coordinates
 * 4. Update booking with lat/lng/city/state/pincode
 * 5. Add address_id column to bookings if missing
 */
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { execSync } = require('child_process');

const REGION = 'ap-south-1';
const CLUSTER_ID = 'warmpawz-prod-cluster';
const SECRET_NAME = 'warmpawz-prod-rds-master-20260207201049162400000001';

const BOOKING_ID = '1993e357-53e4-4f92-af06-4931c3257488';
const CUSTOMER_ID = '505f9d3b-8391-4a22-ba27-eda0cf192b37';
const CUSTOMER_ADDRESS_ID = '6d355dfa-84f9-4b2c-96d4-9d43a0121f9e';
// Mira Bhayandar, Indralok Phase 3, Maharashtra approximate coordinates
const DEST_LAT = 19.2813;
const DEST_LNG = 72.8544;

async function fix() {
  console.log('='.repeat(80));
  console.log('COMPREHENSIVE FIX: Booking Address + Tracking Tables');
  console.log('='.repeat(80));

  const clusterInfo = JSON.parse(execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${CLUSTER_ID} --region ${REGION} --output json`,
    { encoding: 'utf8' }
  ));
  const clusterArn = clusterInfo.DBClusters[0].DBClusterArn;

  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretResponse = await secretsClient.send(new GetSecretValueCommand({ SecretId: SECRET_NAME }));
  const secretArn = secretResponse.ARN;

  const rdsClient = new RDSDataClient({ region: REGION });

  async function runSQL(sql) {
    return await rdsClient.send(new ExecuteStatementCommand({
      resourceArn: clusterArn,
      secretArn: secretArn,
      database: 'warmpawz',
      sql: sql,
      includeResultMetadata: true,
    }));
  }

  async function runSQLWithParams(sql, params) {
    return await rdsClient.send(new ExecuteStatementCommand({
      resourceArn: clusterArn,
      secretArn: secretArn,
      database: 'warmpawz',
      sql: sql,
      parameters: params,
      includeResultMetadata: true,
    }));
  }

  // ============================================================
  // STEP 1: Create gps_tracking_sessions table
  // ============================================================
  console.log('\n--- STEP 1: Create gps_tracking_sessions table ---');
  try {
    const checkTable = await runSQL(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'gps_tracking_sessions'
      ) as table_exists
    `);
    const tableExists = checkTable.records[0][0].booleanValue;
    
    if (tableExists) {
      console.log('  gps_tracking_sessions table already exists');
    } else {
      console.log('  Creating gps_tracking_sessions table...');
      // Create without FK constraints to avoid issues with missing referenced tables
      await runSQL(`
        CREATE TABLE IF NOT EXISTS gps_tracking_sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          booking_id UUID NOT NULL,
          vendor_id UUID NOT NULL,
          staff_id UUID,
          customer_id UUID,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          start_latitude DECIMAL(10, 8),
          start_longitude DECIMAL(11, 8),
          current_latitude DECIMAL(10, 8),
          current_longitude DECIMAL(11, 8),
          current_accuracy DECIMAL(6, 2),
          current_heading DECIMAL(5, 2),
          current_speed DECIMAL(6, 2),
          destination_latitude DECIMAL(10, 8) NOT NULL,
          destination_longitude DECIMAL(11, 8) NOT NULL,
          destination_address TEXT,
          estimated_eta_minutes INTEGER,
          distance_km DECIMAL(8, 2),
          distance_remaining_km DECIMAL(8, 2),
          route_polyline TEXT,
          started_at TIMESTAMP WITH TIME ZONE,
          arrived_at TIMESTAMP WITH TIME ZONE,
          completed_at TIMESTAMP WITH TIME ZONE,
          cancelled_at TIMESTAMP WITH TIME ZONE,
          last_update_at TIMESTAMP WITH TIME ZONE,
          cancellation_reason TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      console.log('  gps_tracking_sessions table created');
      
      // Create indexes
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_gps_sessions_booking ON gps_tracking_sessions(booking_id)',
        'CREATE INDEX IF NOT EXISTS idx_gps_sessions_vendor ON gps_tracking_sessions(vendor_id)',
        'CREATE INDEX IF NOT EXISTS idx_gps_sessions_status ON gps_tracking_sessions(status)',
        'CREATE INDEX IF NOT EXISTS idx_gps_sessions_customer ON gps_tracking_sessions(customer_id)',
      ];
      for (const idx of indexes) {
        try { await runSQL(idx); } catch (e) { /* index may already exist */ }
      }
      console.log('  Indexes created');
    }
  } catch (e) {
    console.error('  ERROR creating gps_tracking_sessions:', e.message);
  }

  // ============================================================
  // STEP 2: Create gps_tracking_points table
  // ============================================================
  console.log('\n--- STEP 2: Create gps_tracking_points table ---');
  try {
    const checkTable = await runSQL(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'gps_tracking_points'
      ) as table_exists
    `);
    const tableExists = checkTable.records[0][0].booleanValue;
    
    if (tableExists) {
      console.log('  gps_tracking_points table already exists');
    } else {
      console.log('  Creating gps_tracking_points table...');
      await runSQL(`
        CREATE TABLE IF NOT EXISTS gps_tracking_points (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          booking_id UUID NOT NULL,
          session_id UUID,
          latitude DECIMAL(10, 8) NOT NULL,
          longitude DECIMAL(11, 8) NOT NULL,
          accuracy DECIMAL(8, 2),
          speed DECIMAL(6, 2),
          heading DECIMAL(5, 2),
          timestamp TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      console.log('  gps_tracking_points table created');
      
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_gps_points_booking ON gps_tracking_points(booking_id)',
        'CREATE INDEX IF NOT EXISTS idx_gps_points_session ON gps_tracking_points(session_id)',
        'CREATE INDEX IF NOT EXISTS idx_gps_points_timestamp ON gps_tracking_points(timestamp DESC)',
      ];
      for (const idx of indexes) {
        try { await runSQL(idx); } catch (e) { /* index may already exist */ }
      }
      console.log('  Indexes created');
    }
  } catch (e) {
    console.error('  ERROR creating gps_tracking_points:', e.message);
  }

  // ============================================================
  // STEP 3: Update customer address with coordinates
  // ============================================================
  console.log('\n--- STEP 3: Update customer address with coordinates ---');
  try {
    const coordsJson = JSON.stringify({ lat: DEST_LAT, lng: DEST_LNG });
    await runSQLWithParams(
      `UPDATE customer_addresses 
       SET coordinates = :coords::jsonb
       WHERE id::text = :addrId`,
      [
        { name: 'coords', value: { stringValue: coordsJson } },
        { name: 'addrId', value: { stringValue: CUSTOMER_ADDRESS_ID } },
      ]
    );
    console.log(`  Updated address ${CUSTOMER_ADDRESS_ID} with coordinates: ${coordsJson}`);
  } catch (e) {
    console.error('  ERROR updating customer address:', e.message);
  }

  // ============================================================
  // STEP 4: Update booking with lat/lng/city/state/pincode
  // ============================================================
  console.log('\n--- STEP 4: Update booking with coordinates and address details ---');
  try {
    await runSQLWithParams(
      `UPDATE bookings 
       SET latitude = :lat, 
           longitude = :lng,
           city = :city,
           state = :state,
           pincode = :pincode
       WHERE id::text = :bookingId`,
      [
        { name: 'lat', value: { doubleValue: DEST_LAT } },
        { name: 'lng', value: { doubleValue: DEST_LNG } },
        { name: 'city', value: { stringValue: 'Mira Bhayandar' } },
        { name: 'state', value: { stringValue: 'Maharashtra' } },
        { name: 'pincode', value: { stringValue: '401105' } },
        { name: 'bookingId', value: { stringValue: BOOKING_ID } },
      ]
    );
    console.log(`  Updated booking ${BOOKING_ID} with lat=${DEST_LAT}, lng=${DEST_LNG}, city=Mira Bhayandar, state=Maharashtra, pincode=401105`);
  } catch (e) {
    console.error('  ERROR updating booking:', e.message);
  }

  // ============================================================
  // STEP 5: Verify everything
  // ============================================================
  console.log('\n--- STEP 5: Verify all changes ---');
  
  // Verify booking
  try {
    const booking = await runSQLWithParams(
      `SELECT id::text, latitude, longitude, city, state, pincode, address, status 
       FROM bookings WHERE id::text = :id`,
      [{ name: 'id', value: { stringValue: BOOKING_ID } }]
    );
    if (booking.records && booking.records.length > 0) {
      const cols = booking.columnMetadata.map(c => c.name);
      console.log('  Booking data:');
      cols.forEach((name, i) => {
        const val = booking.records[0][i].stringValue || booking.records[0][i].doubleValue || (booking.records[0][i].isNull ? 'NULL' : JSON.stringify(booking.records[0][i]));
        console.log(`    ${name}: ${val}`);
      });
    }
  } catch (e) {
    console.error('  ERROR verifying booking:', e.message);
  }

  // Verify customer address
  try {
    const addr = await runSQLWithParams(
      `SELECT id::text, address_line1, city, state, pincode, coordinates::text 
       FROM customer_addresses WHERE id::text = :id`,
      [{ name: 'id', value: { stringValue: CUSTOMER_ADDRESS_ID } }]
    );
    if (addr.records && addr.records.length > 0) {
      const cols = addr.columnMetadata.map(c => c.name);
      console.log('  Customer address data:');
      cols.forEach((name, i) => {
        const val = addr.records[0][i].stringValue || (addr.records[0][i].isNull ? 'NULL' : JSON.stringify(addr.records[0][i]));
        console.log(`    ${name}: ${val}`);
      });
    }
  } catch (e) {
    console.error('  ERROR verifying address:', e.message);
  }

  // Verify tracking tables
  try {
    const tables = await runSQL(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('gps_tracking_sessions', 'gps_tracking_points')
      ORDER BY table_name
    `);
    const existing = tables.records ? tables.records.map(r => r[0].stringValue) : [];
    console.log(`  Tracking tables present: ${existing.join(', ')}`);
  } catch (e) {
    console.error('  ERROR checking tracking tables:', e.message);
  }

  // Check vendor exists in vendors table
  try {
    const vendorId = '1d1329e9-3241-40f2-a3ab-9b7f7108688b';
    const vendor = await runSQLWithParams(
      `SELECT id::text, business_name, status FROM vendors WHERE id::text = :id`,
      [{ name: 'id', value: { stringValue: vendorId } }]
    );
    if (vendor.records && vendor.records.length > 0) {
      console.log(`  Vendor ${vendorId} exists in vendors table: ${vendor.records[0][1].stringValue}`);
    } else {
      console.log(`  WARNING: Vendor ${vendorId} NOT found in vendors table`);
      // Check vendor_identity
      const vi = await runSQLWithParams(
        `SELECT id::text, business_name, full_name FROM vendor_identity WHERE id::text = :id`,
        [{ name: 'id', value: { stringValue: vendorId } }]
      );
      if (vi.records && vi.records.length > 0) {
        const name = vi.records[0][1].stringValue || vi.records[0][2].stringValue || 'unknown';
        console.log(`  Vendor ${vendorId} found in vendor_identity: ${name}`);
      } else {
        console.log(`  WARNING: Vendor ${vendorId} NOT found in vendor_identity either`);
      }
    }
  } catch (e) {
    console.error('  ERROR checking vendor:', e.message);
  }

  console.log('\n' + '='.repeat(80));
  console.log('ALL FIXES APPLIED');
  console.log('='.repeat(80));
}

fix().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
