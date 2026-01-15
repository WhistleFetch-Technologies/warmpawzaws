const { Pool } = require('pg');
const fs = require('fs');
const { execSync } = require('child_process');

async function runMigration() {
  console.log('🚀 Running cafe_tables migration on AWS RDS...\n');
  
  const region = 'ap-south-1';
  const environment = 'dev';
  
  // Get RDS endpoint
  const rdsEndpoint = execSync(`aws rds describe-db-clusters --db-cluster-identifier warmpawz-${environment}-cluster --region ${region} --query 'DBClusters[0].Endpoint' --output text`, { encoding: 'utf-8' }).trim();
  const rdsPort = execSync(`aws rds describe-db-clusters --db-cluster-identifier warmpawz-${environment}-cluster --region ${region} --query 'DBClusters[0].Port' --output text`, { encoding: 'utf-8' }).trim();
  const rdsDatabase = execSync(`aws rds describe-db-clusters --db-cluster-identifier warmpawz-${environment}-cluster --region ${region} --query 'DBClusters[0].DatabaseName' --output text`, { encoding: 'utf-8' }).trim();
  const rdsUsername = execSync(`aws rds describe-db-clusters --db-cluster-identifier warmpawz-${environment}-cluster --region ${region} --query 'DBClusters[0].MasterUsername' --output text`, { encoding: 'utf-8' }).trim();
  
  console.log('RDS Endpoint:', rdsEndpoint);
  
  // Get secret
  const secretName = execSync(`aws secretsmanager list-secrets --region ${region} --query "SecretList[?contains(Name, 'rds-master')].Name" --output text | head -1`, { encoding: 'utf-8', shell: '/bin/bash' }).trim();
  
  const secretValue = execSync(`aws secretsmanager get-secret-value --secret-id "${secretName}" --region ${region} --query 'SecretString' --output text`, { encoding: 'utf-8' }).trim();
  const secret = JSON.parse(secretValue);
  
  const pool = new Pool({
    host: rdsEndpoint,
    port: parseInt(rdsPort),
    database: rdsDatabase,
    user: rdsUsername,
    password: secret.password,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    // Check if table exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'cafe_tables'
      );
    `);
    
    if (tableExists.rows[0].exists) {
      console.log('✅ cafe_tables already exists!');
    } else {
      console.log('📦 Creating cafe_tables...');
      const sql = fs.readFileSync('/Users/ketan/Documents/warmpawzecodev/db/migrations/017_cafe_tables_table.sql', 'utf-8');
      await pool.query(sql);
      console.log('✅ cafe_tables created successfully!');
    }
    
    // Verify table
    const result = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'cafe_tables' ORDER BY ordinal_position");
    console.log('\n📋 cafe_tables columns:');
    result.rows.forEach(row => console.log(`  - ${row.column_name}: ${row.data_type}`));
    
    // Also create sample tables for the cafe
    console.log('\n🪑 Creating sample tables for Pawsome Pet Cafe...');
    const vendorId = '2ec801f1-875b-4e06-8662-ad2da046bb50';
    
    // Check if tables already exist
    const existingTables = await pool.query('SELECT COUNT(*) as count FROM cafe_tables WHERE vendor_id = $1', [vendorId]);
    
    if (parseInt(existingTables.rows[0].count) > 0) {
      console.log('✅ Tables already exist for this cafe');
    } else {
      // Insert sample tables
      await pool.query(`
        INSERT INTO cafe_tables (vendor_id, table_number, name, capacity, section, location, is_outdoor, amenities, status)
        VALUES 
          ($1, 'T1', 'Window Seat', 2, 'Indoor', 'Window', false, '["pet_cushion", "water_bowl"]'::jsonb, 'available'),
          ($1, 'T2', 'Cozy Corner', 4, 'Indoor', 'Corner', false, '["pet_bed", "treat_bowl"]'::jsonb, 'available'),
          ($1, 'T3', 'Garden View', 4, 'Indoor', 'Window', false, '["pet_cushion", "water_bowl", "pet_toys"]'::jsonb, 'available'),
          ($1, 'T4', 'Patio Table', 6, 'Outdoor', 'Patio', true, '["shade", "pet_play_area"]'::jsonb, 'available'),
          ($1, 'T5', 'Private Booth', 2, 'Indoor', 'Private', false, '["pet_bed", "privacy_screen"]'::jsonb, 'available')
      `, [vendorId]);
      console.log('✅ Created 5 sample tables for Pawsome Pet Cafe!');
    }
    
    // List tables
    const tables = await pool.query('SELECT table_number, name, capacity, section, status FROM cafe_tables WHERE vendor_id = $1 ORDER BY table_number', [vendorId]);
    console.log('\n📋 Cafe Tables:');
    tables.rows.forEach(row => console.log(`  - ${row.table_number} (${row.name}): ${row.capacity} pax, ${row.section}, ${row.status}`));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
