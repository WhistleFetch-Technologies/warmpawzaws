/**
 * Run all migrations on dev RDS
 * This script runs all migration files in order using RDS Data API
 * 
 * Usage: node scripts/run-all-migrations-dev.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ENVIRONMENT = 'dev';
const REGION = 'ap-south-1';
const CLUSTER_ID = 'warmpawz-dev-cluster';
const SECRET_NAME = 'warmpawz-dev-rds-master-20260106164510791100000002';
const DB_NAME = 'warmpawz';
const MIGRATIONS_DIR = path.join(__dirname, '..', 'db', 'migrations');

// Cache cluster and secret info
let clusterArn = null;
let secretArn = null;

async function getClusterInfo() {
  if (clusterArn && secretArn) {
    return { clusterArn, secretArn };
  }
  
  console.log('📊 Getting RDS cluster information...');
  const clusterInfo = JSON.parse(execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${CLUSTER_ID} --region ${REGION} --output json`,
    { encoding: 'utf8' }
  ));
  
  if (!clusterInfo.DBClusters || clusterInfo.DBClusters.length === 0) {
    throw new Error(`RDS cluster not found: ${CLUSTER_ID}`);
  }
  
  const cluster = clusterInfo.DBClusters[0];
  clusterArn = cluster.DBClusterArn;
  
  if (!cluster.HttpEndpointEnabled) {
    throw new Error('RDS Data API is not enabled on this cluster');
  }
  
  const secretInfo = JSON.parse(execSync(
    `aws secretsmanager describe-secret --secret-id "${SECRET_NAME}" --region ${REGION} --output json`,
    { encoding: 'utf8' }
  ));
  secretArn = secretInfo.ARN;
  
  return { clusterArn, secretArn };
}

function getAllMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }
  
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(file => file.endsWith('.sql') && !file.includes('README'))
    .map(file => ({
      name: file,
      path: path.join(MIGRATIONS_DIR, file),
      number: extractMigrationNumber(file)
    }))
    .filter(file => file.number !== null)
    .sort((a, b) => {
      // Sort by migration number
      if (a.number !== b.number) {
        return a.number - b.number;
      }
      // If same number, sort alphabetically
      return a.name.localeCompare(b.name);
    });
  
  return files;
}

function extractMigrationNumber(filename) {
  // Extract number from filename like "001_initial_schema.sql" or "536_cancellation_refund_policy_business_rules.sql"
  const match = filename.match(/^(\d+)_/);
  return match ? parseInt(match[1], 10) : null;
}

async function runMigration(migrationFile) {
  const { clusterArn: resourceArn, secretArn: secret } = await getClusterInfo();
  
  const migrationSQL = fs.readFileSync(migrationFile.path, 'utf8');
  
  // Strip comments and split into statements
  const stripped = migrationSQL
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  
  const statements = stripped
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 10);
  
  if (statements.length === 0) {
    return { success: true, skipped: true, reason: 'No statements found' };
  }
  
  let successCount = 0;
  let errorCount = 0;
  const errors = [];
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    
    // Skip empty statements
    if (!statement || statement.length < 10) continue;
    
    // Write statement to temp file
    const tmpFile = path.join(__dirname, `_tmp_stmt_${Date.now()}_${i}.sql`);
    fs.writeFileSync(tmpFile, statement + ';', 'utf8');
    
    try {
      execSync(
        `aws rds-data execute-statement --resource-arn "${resourceArn}" --secret-arn "${secret}" --database "${DB_NAME}" --sql file://${tmpFile.replace(/\\/g, '/')} --region ${REGION} --output json`,
        { encoding: 'utf8', stdio: 'pipe' }
      );
      successCount++;
    } catch (error) {
      const errorOutput = error.stderr ? error.stderr.toString() : error.message || '';
      
      // Check if it's a "already exists" error (which is OK for idempotent migrations)
      if (errorOutput.includes('already exists') || 
          errorOutput.includes('duplicate') ||
          (errorOutput.includes('does not exist') && !errorOutput.includes('ERROR')) ||
          errorOutput.includes('IF NOT EXISTS')) {
        successCount++; // Count as success since it's idempotent
      } else {
        errorCount++;
        errors.push({
          statement: i + 1,
          error: errorOutput.substring(0, 200) // Truncate long errors
        });
      }
    } finally {
      // Clean up temp file
      try {
        fs.unlinkSync(tmpFile);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
  
  return {
    success: errorCount === 0,
    successCount,
    errorCount,
    errors,
    totalStatements: statements.length
  };
}

async function main() {
  console.log('='.repeat(80));
  console.log('RUNNING ALL MIGRATIONS ON DEV RDS');
  console.log('='.repeat(80));
  console.log('');
  
  try {
    await getClusterInfo();
    console.log('✅ Cluster connection verified');
    console.log(`   ARN: ${clusterArn}`);
    console.log(`   Database: ${DB_NAME}`);
    console.log('');
    
    const migrationFiles = getAllMigrationFiles();
    console.log(`📁 Found ${migrationFiles.length} migration files`);
    console.log('');
    
    let totalSuccess = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    const failedMigrations = [];
    
    for (let i = 0; i < migrationFiles.length; i++) {
      const migration = migrationFiles[i];
      const progress = `[${i + 1}/${migrationFiles.length}]`;
      
      console.log(`${progress} Running: ${migration.name}...`);
      
      try {
        const result = await runMigration(migration);
        
        if (result.skipped) {
          console.log(`   ⏭️  Skipped: ${result.reason}`);
          totalSkipped++;
        } else if (result.success) {
          console.log(`   ✅ Success: ${result.successCount}/${result.totalStatements} statements executed`);
          totalSuccess++;
        } else {
          console.log(`   ⚠️  Partial success: ${result.successCount}/${result.totalStatements} statements succeeded, ${result.errorCount} failed`);
          if (result.errors.length > 0) {
            console.log(`   Errors:`);
            result.errors.forEach(err => {
              console.log(`      - Statement ${err.statement}: ${err.error.substring(0, 100)}`);
            });
          }
          totalFailed++;
          failedMigrations.push({
            file: migration.name,
            errors: result.errors
          });
        }
      } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
        totalFailed++;
        failedMigrations.push({
          file: migration.name,
          errors: [{ error: error.message }]
        });
      }
      
      console.log('');
      
      // Small delay between migrations to avoid rate limiting
      if (i < migrationFiles.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Summary
    console.log('='.repeat(80));
    console.log('MIGRATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total migrations: ${migrationFiles.length}`);
    console.log(`✅ Successful: ${totalSuccess}`);
    console.log(`⏭️  Skipped: ${totalSkipped}`);
    console.log(`❌ Failed: ${totalFailed}`);
    console.log('');
    
    if (failedMigrations.length > 0) {
      console.log('Failed migrations:');
      failedMigrations.forEach(failed => {
        console.log(`   - ${failed.file}`);
      });
      console.log('');
      console.log('⚠️  Some migrations failed. Review errors above.');
      process.exit(1);
    } else {
      console.log('✅ ALL MIGRATIONS COMPLETED SUCCESSFULLY');
      console.log('');
    }
    
  } catch (error) {
    console.error('');
    console.error('❌ FATAL ERROR');
    console.error('='.repeat(80));
    console.error(error.message);
    if (error.stderr) {
      console.error('STDERR:', error.stderr.toString());
    }
    console.error('');
    process.exit(1);
  }
}

main();
