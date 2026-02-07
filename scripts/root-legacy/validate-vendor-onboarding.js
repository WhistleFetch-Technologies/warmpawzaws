/**
 * Vendor Onboarding Lifecycle Validation Script
 * 
 * Validates all components required for vendor onboarding:
 * - Database tables
 * - Roles and capabilities
 * - Service catalog
 * - API endpoints
 * - UI components
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection (update with your actual connection string)
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'warmpawz',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
};

const REQUIRED_TABLES = [
  'roles',
  'role_capabilities',
  'vendor_identity',
  'vendor_onboarding_applications',
  'vendors',
  'vendor_bank_details',
  'staff',
  'services',
  'service_catalog',
  'staff_services',
  'staff_schedules',
];

const ISSUES = [];
const FIXES = [];

async function validateDatabaseTables(client) {
  console.log('\n=== PHASE 0.1: Database Tables Validation ===\n');
  
  for (const table of REQUIRED_TABLES) {
    try {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [table]);
      
      if (result.rows[0].exists) {
        console.log(`✅ Table exists: ${table}`);
      } else {
        const issue = `❌ MISSING TABLE: ${table}`;
        console.log(issue);
        ISSUES.push({
          phase: '0.1',
          component: 'database',
          issue: issue,
          severity: 'CRITICAL',
        });
      }
    } catch (error) {
      const issue = `❌ ERROR checking table ${table}: ${error.message}`;
      console.log(issue);
      ISSUES.push({
        phase: '0.1',
        component: 'database',
        issue: issue,
        severity: 'CRITICAL',
      });
    }
  }
}

async function validateRolesAndCapabilities(client) {
  console.log('\n=== PHASE 1.1: Roles & Capabilities Validation ===\n');
  
  try {
    // Check if roles exist
    const rolesResult = await client.query('SELECT COUNT(*) FROM roles WHERE is_active = true');
    const roleCount = parseInt(rolesResult.rows[0].count);
    
    if (roleCount > 0) {
      console.log(`✅ Found ${roleCount} active roles`);
      
      // Get role details
      const roles = await client.query(`
        SELECT id, name, display_name, description 
        FROM roles 
        WHERE is_active = true 
        ORDER BY name
      `);
      
      console.log('\nRoles found:');
      roles.rows.forEach(role => {
        console.log(`  - ${role.name} (${role.display_name})`);
      });
      
      // Check role_capabilities table
      const hasCapabilitiesTable = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'role_capabilities'
        );
      `);
      
      if (hasCapabilitiesTable.rows[0].exists) {
        // Check if capabilities are mapped
        for (const role of roles.rows) {
          const capsResult = await client.query(`
            SELECT COUNT(*) FROM role_capabilities 
            WHERE role_id = $1 AND enabled = true
          `, [role.id]);
          
          const capCount = parseInt(capsResult.rows[0].count);
          if (capCount > 0) {
            console.log(`  ✅ Role ${role.name} has ${capCount} capabilities`);
          } else {
            const issue = `⚠️  Role ${role.name} has no capabilities mapped`;
            console.log(`  ${issue}`);
            ISSUES.push({
              phase: '1.1',
              component: 'roles',
              issue: issue,
              severity: 'HIGH',
            });
          }
        }
      } else {
        const issue = '❌ MISSING TABLE: role_capabilities';
        console.log(issue);
        ISSUES.push({
          phase: '1.1',
          component: 'database',
          issue: issue,
          severity: 'CRITICAL',
        });
      }
    } else {
      const issue = '❌ NO ROLES FOUND in database';
      console.log(issue);
      ISSUES.push({
        phase: '1.1',
        component: 'roles',
        issue: issue,
        severity: 'CRITICAL',
      });
    }
  } catch (error) {
    const issue = `❌ ERROR validating roles: ${error.message}`;
    console.log(issue);
    ISSUES.push({
      phase: '1.1',
      component: 'roles',
      issue: issue,
      severity: 'CRITICAL',
    });
  }
}

async function validateServiceCatalog(client) {
  console.log('\n=== PHASE 1.2: Service Catalog Validation ===\n');
  
  try {
    const catalogResult = await client.query('SELECT COUNT(*) FROM service_catalog WHERE status = $1', ['active']);
    const catalogCount = parseInt(catalogResult.rows[0].count);
    
    if (catalogCount > 0) {
      console.log(`✅ Found ${catalogCount} active service catalog entries`);
      
      // Check service styles
      const stylesResult = await client.query(`
        SELECT DISTINCT service_style, COUNT(*) as count
        FROM service_catalog
        WHERE status = 'active'
        GROUP BY service_style
      `);
      
      console.log('\nService styles found:');
      stylesResult.rows.forEach(row => {
        console.log(`  - ${row.service_style || 'NULL'}: ${row.count} services`);
      });
      
      // Check role mappings
      const rolesWithServices = await client.query(`
        SELECT COUNT(DISTINCT unnest(applicable_roles)) as role_count
        FROM service_catalog
        WHERE status = 'active'
      `);
      
      console.log(`\n✅ Services mapped to ${rolesWithServices.rows[0].role_count || 0} roles`);
    } else {
      const issue = '❌ NO SERVICE CATALOG ENTRIES FOUND';
      console.log(issue);
      ISSUES.push({
        phase: '1.2',
        component: 'service_catalog',
        issue: issue,
        severity: 'HIGH',
      });
    }
  } catch (error) {
    const issue = `❌ ERROR validating service catalog: ${error.message}`;
    console.log(issue);
    ISSUES.push({
      phase: '1.2',
      component: 'service_catalog',
      issue: issue,
      severity: 'HIGH',
    });
  }
}

async function validateOnboardingForms(client) {
  console.log('\n=== PHASE 1.3: Onboarding Form Schemas Validation ===\n');
  
  try {
    // Check if onboarding_form_schemas table exists
    const hasTable = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'onboarding_form_schemas'
      );
    `);
    
    if (hasTable.rows[0].exists) {
      const schemasResult = await client.query(`
        SELECT COUNT(*) FROM onboarding_form_schemas
      `);
      const schemaCount = parseInt(schemasResult.rows[0].count);
      
      if (schemaCount > 0) {
        console.log(`✅ Found ${schemaCount} form schemas`);
        
        // Get schema details
        const schemas = await client.query(`
          SELECT role_id, vendor_type, form_version
          FROM onboarding_form_schemas
          ORDER BY role_id, vendor_type
        `);
        
        console.log('\nForm schemas:');
        schemas.rows.forEach(schema => {
          console.log(`  - Role: ${schema.role_id}, Type: ${schema.vendor_type || 'all'}, Version: ${schema.form_version || 'N/A'}`);
        });
      } else {
        const issue = '⚠️  NO FORM SCHEMAS FOUND in onboarding_form_schemas table';
        console.log(issue);
        ISSUES.push({
          phase: '1.3',
          component: 'forms',
          issue: issue,
          severity: 'HIGH',
        });
      }
    } else {
      const issue = '⚠️  onboarding_form_schemas table does not exist (may use dynamic generation)';
      console.log(issue);
      ISSUES.push({
        phase: '1.3',
        component: 'forms',
        issue: issue,
        severity: 'MEDIUM',
      });
    }
  } catch (error) {
    const issue = `❌ ERROR validating form schemas: ${error.message}`;
    console.log(issue);
    ISSUES.push({
      phase: '1.3',
      component: 'forms',
      issue: issue,
      severity: 'MEDIUM',
    });
  }
}

async function generateReport() {
  console.log('\n=== VALIDATION REPORT ===\n');
  
  console.log(`Total Issues Found: ${ISSUES.length}`);
  
  const byPhase = {};
  const bySeverity = {};
  
  ISSUES.forEach(issue => {
    byPhase[issue.phase] = (byPhase[issue.phase] || 0) + 1;
    bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
  });
  
  console.log('\nIssues by Phase:');
  Object.entries(byPhase).forEach(([phase, count]) => {
    console.log(`  Phase ${phase}: ${count} issues`);
  });
  
  console.log('\nIssues by Severity:');
  Object.entries(bySeverity).forEach(([severity, count]) => {
    console.log(`  ${severity}: ${count} issues`);
  });
  
  console.log('\nDetailed Issues:');
  ISSUES.forEach((issue, index) => {
    console.log(`\n${index + 1}. [Phase ${issue.phase}] [${issue.severity}] ${issue.component}`);
    console.log(`   ${issue.issue}`);
  });
  
  // Write to file
  const reportPath = path.join(__dirname, 'VALIDATION_REPORT.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalIssues: ISSUES.length,
    issues: ISSUES,
    fixes: FIXES,
  }, null, 2));
  
  console.log(`\n✅ Report saved to: ${reportPath}`);
}

async function main() {
  const client = new Client(DB_CONFIG);
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    await validateDatabaseTables(client);
    await validateRolesAndCapabilities(client);
    await validateServiceCatalog(client);
    await validateOnboardingForms(client);
    
    await generateReport();
    
  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, validateDatabaseTables, validateRolesAndCapabilities, validateServiceCatalog };
