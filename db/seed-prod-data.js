#!/usr/bin/env node
/**
 * Seed Production Data Script
 * Seeds the database with production-safe base data
 * 
 * Usage: node db/seed-prod-data.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database URL from environment or default
const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL or SUPABASE_DB_URL environment variable is required');
  process.exit(1);
}

async function seedProdData() {
  console.log('🌱 Seeding Production Data');
  console.log('='.repeat(60));
  console.log(`🔌 Database: ${DATABASE_URL.replace(/:[^:@]+@/, ':***@')}`);
  console.log('');
  console.log('⚠️  Production mode - only seeding essential configuration data');
  console.log('');

  const pool = new Pool({ 
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : undefined
  });

  try {
    const client = await pool.connect();
    console.log('✅ Connected to database');
    console.log('');

    // Seed roles - essential for RBAC
    const rolesFile = path.join(__dirname, 'migrations', '047_seed_roles.sql');
    if (fs.existsSync(rolesFile)) {
      console.log('⚙️  Seeding roles...');
      const rolesSql = fs.readFileSync(rolesFile, 'utf8');
      await client.query(rolesSql);
      console.log('✅ Roles seeded');
    }

    // Seed service catalog - essential for service bookings
    const serviceCatalogFile = path.join(__dirname, 'migrations', '048_seed_service_catalog.sql');
    if (fs.existsSync(serviceCatalogFile)) {
      console.log('⚙️  Seeding service catalog...');
      const catalogSql = fs.readFileSync(serviceCatalogFile, 'utf8');
      await client.query(catalogSql);
      console.log('✅ Service catalog seeded');
    }

    client.release();
    
    console.log('');
    console.log('✅ Production data seeded successfully!');
    console.log('ℹ️  Only essential configuration data was seeded');
    
  } catch (error) {
    console.error('');
    console.error('❌ Seeding failed:');
    console.error(error.message);
    
    if (error.message.includes('duplicate key') || error.message.includes('already exists')) {
      console.log('');
      console.log('ℹ️  Note: Some data may already exist. This is typically safe to ignore.');
      // Don't exit with error for duplicate data
    } else {
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

// Seed data
seedProdData();

