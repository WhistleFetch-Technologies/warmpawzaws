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

    // Verify service_categories schema before seeding
    console.log('🔍 Verifying service_categories schema...');
    const schemaCheck = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'service_categories' 
      AND column_name IN ('category_id', 'parent_category_id')
    `);
    
    const hasCategoryId = schemaCheck.rows.some(r => r.column_name === 'category_id');
    const hasParentCategoryId = schemaCheck.rows.some(r => r.column_name === 'parent_category_id');
    
    if (!hasCategoryId || hasParentCategoryId) {
      console.log('⚠️  Schema issue detected - applying fix migration...');
      const fixMigrationFile = path.join(__dirname, 'migrations', '999_fix_service_categories_schema.sql');
      if (fs.existsSync(fixMigrationFile)) {
        const fixSql = fs.readFileSync(fixMigrationFile, 'utf8');
        await client.query(fixSql);
        console.log('✅ Schema fixed');
      } else {
        console.error('❌ Fix migration not found: 999_fix_service_categories_schema.sql');
        throw new Error('Cannot proceed without schema fix');
      }
    } else {
      console.log('✅ Schema verified');
    }
    console.log('');

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

