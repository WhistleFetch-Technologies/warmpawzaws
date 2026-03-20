#!/usr/bin/env node
/**
 * Seed Development Data Script
 * Seeds the database with development test data
 * 
 * Usage: node db/seed-dev-data.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database URL from environment or default

if (!DATABASE_URL) {
  process.exit(1);
}

async function seedDevData() {
  console.log('🌱 Seeding Development Data');
  console.log('='.repeat(60));
  console.log(`🔌 Database: ${DATABASE_URL.replace(/:[^:@]+@/, ':***@')}`);
  console.log('');

  const pool = new Pool({ 
    connectionString: DATABASE_URL,
  });

  try {
    const client = await pool.connect();
    console.log('✅ Connected to database');
    console.log('');

    // Seed roles if migration exists
    const rolesFile = path.join(__dirname, 'migrations', '047_seed_roles.sql');
    if (fs.existsSync(rolesFile)) {
      console.log('⚙️  Seeding roles...');
      const rolesSql = fs.readFileSync(rolesFile, 'utf8');
      await client.query(rolesSql);
      console.log('✅ Roles seeded');
    }

    // Seed service catalog if migration exists
    const serviceCatalogFile = path.join(__dirname, 'migrations', '048_seed_service_catalog.sql');
    if (fs.existsSync(serviceCatalogFile)) {
      console.log('⚙️  Seeding service catalog...');
      const catalogSql = fs.readFileSync(serviceCatalogFile, 'utf8');
      await client.query(catalogSql);
      console.log('✅ Service catalog seeded');
    }

    // Seed onboarding role configs if migration exists
    const onboardingConfigFile = path.join(__dirname, 'migrations', '050_seed_onboarding_role_configs.sql');
    if (fs.existsSync(onboardingConfigFile)) {
      console.log('⚙️  Seeding onboarding role configs...');
      const onboardingSql = fs.readFileSync(onboardingConfigFile, 'utf8');
      await client.query(onboardingSql);
      console.log('✅ Onboarding role configs seeded');
    }

    // Seed role permissions if migration exists
    const rolePermissionsFile = path.join(__dirname, 'migrations', '051_seed_role_permissions.sql');
    if (fs.existsSync(rolePermissionsFile)) {
      console.log('⚙️  Seeding role permissions...');
      const permissionsSql = fs.readFileSync(rolePermissionsFile, 'utf8');
      await client.query(permissionsSql);
      console.log('✅ Role permissions seeded');
    }

    client.release();
    
    console.log('');
    console.log('✅ Development data seeded successfully!');
    
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
seedDevData();

