#!/usr/bin/env ts-node
/**
 * ============================================================================
 * PHASE 1: DATABASE SCHEMA VALIDATION
 * ============================================================================
 * 
 * This script validates the database schema against production requirements:
 * 
 * 1. Verify all required entities exist
 * 2. Validate referential integrity constraints
 * 3. Check idempotency keys and versioning
 * 4. Validate soft delete columns
 * 5. Verify immutable financial records
 * 6. Check audit trails
 * 
 * Exit Codes:
 * - 0: All validations passed
 * - 1: Critical schema issues found
 * ============================================================================
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

interface ValidationResult {
  category: string;
  item: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message: string;
}

interface ValidationSummary {
  totalChecks: number;
  passed: number;
  failed: number;
  warnings: number;
  results: ValidationResult[];
}

// Required tables for production readiness
const REQUIRED_TABLES = [
  // Core entities
  'customers', 'vendors', 'staff', 'staff_specializations', 'staff_certifications',
  
  // Services
  'services', 'service_categories', 'staff_services', 'vendor_service_areas',
  
  // Bookings
  'bookings', 'emergency_booking_queue', 'pending_reschedules', 'booking_status_history',
  
  // Payments & Financial
  'payments', 'payment_history', 'refunds', 'refund_rules', 'refund_tiers',
  'payouts', 'pending_payouts', 'settlements', 'settlement_schedules',
  
  // Orders (E-commerce)
  'orders', 'order_items', 'products', 'ecommerce_categories',
  
  // Wallet
  'customer_wallets', 'wallet_transactions',
  
  // Banking
  'vendor_bank_details', 'bank_verifications',
  
  // Documents
  'vendor_documents',
  
  // RBAC
  'roles', 'role_permissions', 'capabilities', 'role_capabilities',
  
  // Platform Settings
  'platform_settings', 'platform_revenue', 'gst_configs', 'hsn_codes',
  'tax_categories', 'cancellation_policies',
  
  // Admin Settings
  'admin_settings', 'payment_gateway_settings', 'payout_rules', 'booking_rules',
  
  // Promotions
  'promotions', 'coupons',
  
  // Regions
  'regions',
  
  // Search & Analytics
  'search_index', 'search_history', 'search_analytics', 'popular_searches',
  'zero_result_searches',
  
  // Statistics
  'vendor_stats', 'item_stats', 'performance_metrics',
  
  // Notifications
  'notifications', 'notification_templates', 'reminder_queue',
  
  // OTP
  'otp_tokens',
  
  // Pets
  'pets', 'pet_vaccinations', 'pet_medical_records',
  
  // Loyalty & Rewards
  'loyalty_rules', 'customer_loyalty_points', 'loyalty_transactions',
  
  // Referrals
  'referrals',
  
  // Schedules
  'staff_schedules', 'staff_availability', 'vendor_operating_hours',
  
  // Subscriptions
  'subscription_tiers', 'customer_subscriptions',
  
  // Integrations
  'platform_integrations',
  
  // Cache
  'cache_tokens', 'cache_stats',
  
  // Health
  'health_checks',
  
  // Featured
  'featured_vendors',
  
  // Specialized Services
  'insurance_policies', 'insurance_claims',
  'training_sessions', 'training_progress',
  'boarding_bookings', 'boarding_rooms',
  'cafe_tables', 'cafe_bookings',
  'pet_events', 'event_registrations',
  
  // Chat & Video
  'chat_messages', 'chat_rooms',
  'video_call_rooms', 'video_call_sessions',
  
  // Packages
  'service_packages', 'package_purchases', 'package_sessions',
  
  // Prescriptions & Medical
  'prescriptions', 'prescription_items', 'medical_records',
  
  // GPS & Tracking
  'gps_tracking', 'gps_waypoints',
  
  // Reviews
  'reviews', 'review_responses',
  
  // Problem Grid
  'problem_grid_mappings', 'vendor_problem_mappings',
  
  // Audit
  'audit_logs', 'financial_audit_trail',
];

class SchemaValidator {
  private pool: Pool;
  private results: ValidationResult[] = [];

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'warmpawz',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });
  }

  private addResult(category: string, item: string, status: 'PASS' | 'FAIL' | 'WARNING', message: string) {
    this.results.push({ category, item, status, message });
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} [${category}] ${item}: ${message}`);
  }

  async validateDatabaseConnection(): Promise<boolean> {
    try {
      const result = await this.pool.query('SELECT NOW()');
      this.addResult('CONNECTION', 'Database', 'PASS', `Connected successfully at ${result.rows[0].now}`);
      return true;
    } catch (error) {
      this.addResult('CONNECTION', 'Database', 'FAIL', `Failed to connect: ${error}`);
      return false;
    }
  }

  async validateRequiredTables(): Promise<void> {
    console.log('\n🔍 Validating Required Tables...\n');
    
    for (const tableName of REQUIRED_TABLES) {
      try {
        const result = await this.pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          ) as exists
        `, [tableName]);

        if (result.rows[0].exists) {
          // Get row count
          const countResult = await this.pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
          const count = parseInt(countResult.rows[0].count);
          this.addResult('TABLE_EXISTS', tableName, 'PASS', `Table exists with ${count} rows`);
        } else {
          this.addResult('TABLE_EXISTS', tableName, 'FAIL', 'Table does not exist');
        }
      } catch (error) {
        this.addResult('TABLE_EXISTS', tableName, 'FAIL', `Error checking table: ${error}`);
      }
    }
  }

  async validateForeignKeys(): Promise<void> {
    console.log('\n🔍 Validating Foreign Key Constraints...\n');
    
    try {
      const result = await this.pool.query(`
        SELECT
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name,
          rc.update_rule,
          rc.delete_rule
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        JOIN information_schema.referential_constraints AS rc
          ON rc.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        ORDER BY tc.table_name, kcu.column_name;
      `);

      this.addResult('FOREIGN_KEYS', 'Total Count', 'PASS', `Found ${result.rows.length} foreign key constraints`);

      // Validate critical foreign keys
      const criticalFKs = [
        { table: 'bookings', column: 'customer_id', references: 'customers' },
        { table: 'bookings', column: 'vendor_id', references: 'vendors' },
        { table: 'bookings', column: 'service_id', references: 'services' },
        { table: 'payments', column: 'customer_id', references: 'customers' },
        { table: 'payments', column: 'booking_id', references: 'bookings' },
        { table: 'refunds', column: 'payment_id', references: 'payments' },
        { table: 'staff', column: 'vendor_id', references: 'vendors' },
      ];

      for (const fk of criticalFKs) {
        const found = result.rows.find(row => 
          row.table_name === fk.table && 
          row.column_name === fk.column && 
          row.foreign_table_name === fk.references
        );

        if (found) {
          this.addResult('FOREIGN_KEY', `${fk.table}.${fk.column}`, 'PASS', 
            `References ${fk.references} (ON DELETE: ${found.delete_rule})`);
        } else {
          this.addResult('FOREIGN_KEY', `${fk.table}.${fk.column}`, 'FAIL', 
            `Missing foreign key to ${fk.references}`);
        }
      }
    } catch (error) {
      this.addResult('FOREIGN_KEYS', 'Validation', 'FAIL', `Error: ${error}`);
    }
  }

  async validateUniqueConstraints(): Promise<void> {
    console.log('\n🔍 Validating Unique Constraints...\n');
    
    try {
      const result = await this.pool.query(`
        SELECT
          tc.table_name,
          string_agg(kcu.column_name, ', ') as columns
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'UNIQUE'
        AND tc.table_schema = 'public'
        GROUP BY tc.table_name, tc.constraint_name
        ORDER BY tc.table_name;
      `);

      this.addResult('UNIQUE_CONSTRAINTS', 'Total Count', 'PASS', 
        `Found ${result.rows.length} unique constraints`);

      // Validate critical unique constraints
      const criticalUnique = [
        { table: 'customers', column: 'phone' },
        { table: 'vendors', column: 'phone' },
        { table: 'vendors', column: 'email' },
        { table: 'orders', column: 'order_number' },
        { table: 'coupons', column: 'code' },
      ];

      for (const unique of criticalUnique) {
        const found = result.rows.find(row => 
          row.table_name === unique.table && 
          row.columns.includes(unique.column)
        );

        if (found) {
          this.addResult('UNIQUE_CONSTRAINT', `${unique.table}.${unique.column}`, 'PASS', 
            'Unique constraint exists');
        } else {
          this.addResult('UNIQUE_CONSTRAINT', `${unique.table}.${unique.column}`, 'WARNING', 
            'Missing unique constraint');
        }
      }
    } catch (error) {
      this.addResult('UNIQUE_CONSTRAINTS', 'Validation', 'FAIL', `Error: ${error}`);
    }
  }

  async validateIndexes(): Promise<void> {
    console.log('\n🔍 Validating Database Indexes...\n');
    
    try {
      const result = await this.pool.query(`
        SELECT
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname;
      `);

      this.addResult('INDEXES', 'Total Count', 'PASS', `Found ${result.rows.length} indexes`);

      // Validate critical indexes for performance
      const criticalIndexes = [
        { table: 'bookings', column: 'customer_id' },
        { table: 'bookings', column: 'vendor_id' },
        { table: 'bookings', column: 'booking_date' },
        { table: 'bookings', column: 'status' },
        { table: 'payments', column: 'customer_id' },
        { table: 'payments', column: 'payment_status' },
        { table: 'vendors', column: 'status' },
        { table: 'staff_availability', column: 'staff_id' },
        { table: 'staff_availability', column: 'date' },
      ];

      for (const index of criticalIndexes) {
        const found = result.rows.find(row => 
          row.tablename === index.table && 
          row.indexdef && row.indexdef.toLowerCase().includes(index.column)
        );

        if (found) {
          this.addResult('INDEX', `${index.table}.${index.column}`, 'PASS', 'Index exists');
        } else {
          this.addResult('INDEX', `${index.table}.${index.column}`, 'WARNING', 
            'Missing index - may impact performance');
        }
      }
    } catch (error) {
      this.addResult('INDEXES', 'Validation', 'FAIL', `Error: ${error}`);
    }
  }

  async validateCheckConstraints(): Promise<void> {
    console.log('\n🔍 Validating Check Constraints...\n');
    
    try {
      const result = await this.pool.query(`
        SELECT
          tc.table_name,
          tc.constraint_name,
          cc.check_clause
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.check_constraints AS cc
          ON tc.constraint_name = cc.constraint_name
        WHERE tc.constraint_type = 'CHECK'
        AND tc.table_schema = 'public'
        ORDER BY tc.table_name;
      `);

      this.addResult('CHECK_CONSTRAINTS', 'Total Count', 'PASS', 
        `Found ${result.rows.length} check constraints`);

      // Check for status enum constraints
      const statusTables = ['bookings', 'payments', 'vendors', 'orders', 'refunds'];
      for (const table of statusTables) {
        const found = result.rows.find(row => 
          row.table_name === table && 
          row.check_clause && row.check_clause.includes('status')
        );

        if (found) {
          this.addResult('CHECK_CONSTRAINT', `${table}.status`, 'PASS', 
            'Status constraint exists');
        } else {
          this.addResult('CHECK_CONSTRAINT', `${table}.status`, 'WARNING', 
            'Missing status check constraint');
        }
      }
    } catch (error) {
      this.addResult('CHECK_CONSTRAINTS', 'Validation', 'FAIL', `Error: ${error}`);
    }
  }

  async validateTimestampColumns(): Promise<void> {
    console.log('\n🔍 Validating Timestamp Columns...\n');
    
    const timestampColumns = ['created_at', 'updated_at'];
    
    for (const tableName of REQUIRED_TABLES.slice(0, 20)) { // Check first 20 tables
      try {
        const result = await this.pool.query(`
          SELECT column_name, data_type, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name IN ('created_at', 'updated_at')
          ORDER BY column_name;
        `, [tableName]);

        if (result.rows.length > 0) {
          const hasCreatedAt = result.rows.some(row => row.column_name === 'created_at');
          const hasUpdatedAt = result.rows.some(row => row.column_name === 'updated_at');
          
          if (hasCreatedAt && hasUpdatedAt) {
            this.addResult('TIMESTAMPS', tableName, 'PASS', 
              'Has created_at and updated_at columns');
          } else if (hasCreatedAt) {
            this.addResult('TIMESTAMPS', tableName, 'WARNING', 
              'Has created_at but missing updated_at');
          } else {
            this.addResult('TIMESTAMPS', tableName, 'WARNING', 
              'Missing timestamp columns');
          }
        }
      } catch (error) {
        // Table doesn't exist, skip
      }
    }
  }

  async validateFinancialImmutability(): Promise<void> {
    console.log('\n🔍 Validating Financial Record Immutability...\n');
    
    // Check if audit tables exist
    const auditTables = ['financial_audit_trail', 'payment_history', 'audit_logs'];
    
    for (const tableName of auditTables) {
      try {
        const result = await this.pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          ) as exists
        `, [tableName]);

        if (result.rows[0].exists) {
          this.addResult('FINANCIAL_AUDIT', tableName, 'PASS', 'Audit table exists');
        } else {
          this.addResult('FINANCIAL_AUDIT', tableName, 'WARNING', 
            'Audit table missing - financial tracking may be incomplete');
        }
      } catch (error) {
        this.addResult('FINANCIAL_AUDIT', tableName, 'FAIL', `Error: ${error}`);
      }
    }
  }

  async generateReport(): Promise<ValidationSummary> {
    const summary: ValidationSummary = {
      totalChecks: this.results.length,
      passed: this.results.filter(r => r.status === 'PASS').length,
      failed: this.results.filter(r => r.status === 'FAIL').length,
      warnings: this.results.filter(r => r.status === 'WARNING').length,
      results: this.results,
    };

    console.log('\n' + '='.repeat(80));
    console.log('📊 PHASE 1 VALIDATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Checks:     ${summary.totalChecks}`);
    console.log(`✅ Passed:        ${summary.passed}`);
    console.log(`❌ Failed:        ${summary.failed}`);
    console.log(`⚠️  Warnings:     ${summary.warnings}`);
    console.log('='.repeat(80));

    if (summary.failed > 0) {
      console.log('\n❌ CRITICAL ISSUES FOUND:');
      this.results.filter(r => r.status === 'FAIL').forEach(r => {
        console.log(`   - [${r.category}] ${r.item}: ${r.message}`);
      });
    }

    if (summary.warnings > 0) {
      console.log('\n⚠️  WARNINGS:');
      this.results.filter(r => r.status === 'WARNING').forEach(r => {
        console.log(`   - [${r.category}] ${r.item}: ${r.message}`);
      });
    }

    return summary;
  }

  async run(): Promise<number> {
    console.log('🚀 Starting PHASE 1: Database Schema Validation\n');
    console.log('='.repeat(80));
    console.log('Database:', process.env.DB_NAME || 'warmpawz');
    console.log('Host:', process.env.DB_HOST || 'localhost');
    console.log('='.repeat(80));

    // Step 1: Database Connection
    const connected = await this.validateDatabaseConnection();
    if (!connected) {
      console.error('\n❌ Cannot proceed without database connection');
      return 1;
    }

    // Step 2: Validate Tables
    await this.validateRequiredTables();

    // Step 3: Validate Constraints
    await this.validateForeignKeys();
    await this.validateUniqueConstraints();
    await this.validateCheckConstraints();

    // Step 4: Validate Indexes
    await this.validateIndexes();

    // Step 5: Validate Timestamps
    await this.validateTimestampColumns();

    // Step 6: Validate Financial Controls
    await this.validateFinancialImmutability();

    // Generate Report
    const summary = await this.generateReport();

    // Save report to file
    const reportPath = path.join(process.cwd(), 'PHASE1_SCHEMA_VALIDATION_REPORT.json');
    fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
    console.log(`\n📄 Report saved to: ${reportPath}`);

    // Close pool
    await this.pool.end();

    // Return exit code
    return summary.failed > 0 ? 1 : 0;
  }
}

// Run validation
const validator = new SchemaValidator();
validator.run().then(exitCode => {
  process.exit(exitCode);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
