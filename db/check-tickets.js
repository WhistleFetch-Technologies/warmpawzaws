#!/usr/bin/env node
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://warmpawz:warmpawz@localhost:5432/warmpawz';

async function main() {
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
    console.log('🔍 Checking support tickets...');
    
    // Check if support_tickets table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'support_tickets'
      );
    `);
    
    console.log('support_tickets table exists:', tableCheck.rows[0].exists);
    
    if (tableCheck.rows[0].exists) {
      const existing = await client.query('SELECT COUNT(*) FROM support_tickets');
      console.log('Existing tickets:', existing.rows[0].count);
      
      if (parseInt(existing.rows[0].count) > 0) {
        const sample = await client.query('SELECT id, subject, status FROM support_tickets LIMIT 3');
        console.log('Sample tickets:', sample.rows);
      }
    }
    
    client.release();
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

main();
