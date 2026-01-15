#!/usr/bin/env node
/**
 * Verify Care Plans Migration
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://warmpawz:warmpawz@localhost:5432/warmpawz';

async function verify() {
  console.log('🔍 Verifying care plan tables...');
  
  let connectionConfig;
  if (DATABASE_URL.includes('rds.amazonaws.com')) {
    const url = new URL(DATABASE_URL.replace('postgresql://', 'https://'));
    connectionConfig = {
      host: url.hostname,
      port: parseInt(url.port || '5432', 10),
      database: url.pathname.slice(1) || 'warmpawz',
      user: url.username,
      password: url.password,
      ssl: { rejectUnauthorized: false }
    };
  } else {
    connectionConfig = { connectionString: DATABASE_URL };
  }

  const pool = new Pool(connectionConfig);

  try {
    const client = await pool.connect();
    
    // Check tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%care_plan%'
      ORDER BY table_name
    `);
    
    console.log('');
    console.log('✅ Care Plan Tables:');
    if (tables.rows.length === 0) {
      console.log('   (none found)');
    } else {
      tables.rows.forEach(r => console.log('   - ' + r.table_name));
    }
    
    // Check templates count
    try {
      const templates = await client.query('SELECT COUNT(*) as count FROM care_plan_templates');
      console.log('');
      console.log('✅ Templates seeded:', templates.rows[0].count);
    } catch (e) {
      console.log('');
      console.log('⚠️  care_plan_templates table not found');
    }
    
    client.release();
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

verify();
