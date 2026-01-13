#!/usr/bin/env node
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: 'warmpawz-dev-cluster.cluster-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
  port: 5432,
  database: 'warmpawz',
  user: 'warmpawz_admin',
  password: 'Warmpawz2026',
  ssl: { rejectUnauthorized: false }
});

async function runFix() {
  try {
    console.log('🔧 Creating missing tables...\n');
    
    const sqlFile = path.join(__dirname, 'create-missing-tables.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    await pool.query(sql);
    
    console.log('✅ Tables created successfully!\n');
    
    // Verify
    const result = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('capabilities', 'role_capabilities', 'gps_tracking', 'insurance_policies')
      ORDER BY table_name
    `);
    
    console.log('📋 Verified tables:');
    result.rows.forEach(row => console.log(`  ✅ ${row.table_name}`));
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

runFix();
