/**
 * Verify vendors schema matches production RDS
 * Queries production RDS to get all columns and compares with schema file
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const REGION = 'ap-south-1';
const ENVIRONMENT = 'prod';
const CLUSTER_ID = 'warmpawz-prod-cluster';
const SECRET_NAME = 'warmpawz-prod-rds-master-20260207201049162400000001';
const DB_NAME = 'warmpawz';

// Cache cluster and secret info
let clusterArn = null;
let secretArn = null;

async function getClusterInfo() {
  if (clusterArn && secretArn) {
    return { clusterArn, secretArn };
  }
  
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

async function executeSQL(sql, expectResult = false) {
  try {
    const { clusterArn: resourceArn, secretArn: secret } = await getClusterInfo();
    
    const tmpFile = path.join(__dirname, `_tmp_stmt_${Date.now()}.sql`);
    fs.writeFileSync(tmpFile, sql, 'utf8');
    
    try {
      const result = execSync(
        `aws rds-data execute-statement --resource-arn "${resourceArn}" --secret-arn "${secret}" --database "${DB_NAME}" --sql file://${tmpFile.replace(/\\/g, '/')} --region ${REGION} --output json`,
        { encoding: 'utf8', stdio: expectResult ? ['pipe', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'] }
      );
      
      return expectResult ? JSON.parse(result) : { success: true };
    } finally {
      try {
        fs.unlinkSync(tmpFile);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  } catch (error) {
    throw error;
  }
}

async function getProductionColumns() {
  const sql = `
    SELECT 
      column_name,
      data_type,
      character_maximum_length,
      numeric_precision,
      numeric_scale,
      is_nullable,
      column_default,
      ordinal_position
    FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'vendors'
    ORDER BY ordinal_position;
  `;
  
  const result = await executeSQL(sql, true);
  
  if (!result.records || result.records.length === 0) {
    return [];
  }
  
  return result.records.map(record => {
    const col = {
      name: record[0].stringValue,
      dataType: record[1].stringValue,
      maxLength: record[2]?.longValue || null,
      numericPrecision: record[3]?.longValue || null,
      numericScale: record[4]?.longValue || null,
      nullable: record[5].stringValue === 'YES',
      defaultValue: record[6]?.stringValue || null,
      position: record[7].longValue
    };
    
    // Build data type string
    let typeStr = col.dataType;
    if (col.maxLength) {
      typeStr += `(${col.maxLength})`;
    } else if (col.numericPrecision !== null) {
      if (col.numericScale !== null) {
        typeStr += `(${col.numericPrecision},${col.numericScale})`;
      } else {
        typeStr += `(${col.numericPrecision})`;
      }
    }
    
    return {
      ...col,
      typeString: typeStr
    };
  });
}

async function main() {
  console.log('='.repeat(80));
  console.log('VERIFYING vendors SCHEMA AGAINST PRODUCTION RDS');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Get columns from production
    console.log('📋 Querying production RDS for vendors columns...');
    const prodColumns = await getProductionColumns();
    
    if (prodColumns.length === 0) {
      console.log('   ❌ No columns found in production (table may not exist)');
      process.exit(1);
    }
    
    console.log(`   ✅ Found ${prodColumns.length} columns in production`);
    console.log('');
    
    // Read schema file
    const schemaFile = path.join(__dirname, '..', 'db', 'schemas', 'vendor', 'vendor.sql');
    const schemaContent = fs.readFileSync(schemaFile, 'utf8');
    
    console.log('📋 Analyzing schema file...');
    console.log(`   File: ${schemaFile}`);
    console.log('');
    
    // Extract column names from schema file (simple approach - look for column definitions)
    const schemaColumns = [];
    const lines = schemaContent.split('\n');
    let inTableDef = false;
    let braceDepth = 0;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Detect start of table definition
      if (trimmed.includes('CREATE TABLE') && trimmed.includes('vendors')) {
        inTableDef = true;
        continue;
      }
      
      if (!inTableDef) continue;
      
      // Track braces
      const openBraces = (line.match(/\(/g) || []).length;
      const closeBraces = (line.match(/\)/g) || []).length;
      braceDepth += openBraces - closeBraces;
      
      // Detect end of table definition
      if (trimmed.startsWith(')') && braceDepth <= 0) {
        break;
      }
      
      // Skip comments and constraints
      if (trimmed.startsWith('--') || 
          trimmed.startsWith('CONSTRAINT') ||
          trimmed.startsWith('CHECK') ||
          braceDepth > 0) {
        continue;
      }
      
      // Extract column definitions
      // Match patterns like: column_name TYPE, or column_name TYPE DEFAULT value,
      const colMatch = trimmed.match(/^\s*([a-z_]+)\s+([A-Z]+(?:\([^)]+\))?(?: WITH TIME ZONE)?)/i);
      if (colMatch) {
        const colName = colMatch[1].toLowerCase();
        // Skip constraint keywords
        if (!['constraint', 'primary', 'foreign', 'check', 'unique'].includes(colName)) {
          schemaColumns.push(colName);
        }
      }
    }
    
    console.log(`   Found ${schemaColumns.length} columns in schema file`);
    console.log(`   Columns: ${schemaColumns.slice(0, 10).join(', ')}${schemaColumns.length > 10 ? '...' : ''}`);
    console.log('');
    
    // Compare
    console.log('📋 Comparing production columns with schema file...');
    console.log('');
    
    const prodColumnNames = prodColumns.map(c => c.name.toLowerCase());
    const missingInSchema = [];
    const missingInProd = [];
    
    // Check what's in production but not in schema
    for (const prodCol of prodColumns) {
      if (!schemaColumns.includes(prodCol.name.toLowerCase())) {
        missingInSchema.push(prodCol);
      }
    }
    
    // Check what's in schema but not in production
    for (const schemaCol of schemaColumns) {
      if (!prodColumnNames.includes(schemaCol)) {
        missingInProd.push(schemaCol);
      }
    }
    
    // Display results
    console.log('='.repeat(80));
    console.log('COMPARISON RESULTS');
    console.log('='.repeat(80));
    console.log('');
    console.log(`Production columns: ${prodColumns.length}`);
    console.log(`Schema file columns: ${schemaColumns.length}`);
    console.log('');
    
    if (missingInSchema.length > 0) {
      console.log('❌ COLUMNS IN PRODUCTION BUT MISSING IN SCHEMA FILE:');
      console.log('');
      missingInSchema.forEach(col => {
        console.log(`   - ${col.name} (${col.typeString}, nullable: ${col.nullable}, default: ${col.defaultValue || 'none'})`);
      });
      console.log('');
    } else {
      console.log('✅ All production columns exist in schema file');
      console.log('');
    }
    
    if (missingInProd.length > 0) {
      console.log('⚠️  COLUMNS IN SCHEMA FILE BUT NOT IN PRODUCTION:');
      console.log('');
      missingInProd.forEach(col => {
        console.log(`   - ${col}`);
      });
      console.log('');
    }
    
    // Display all production columns for reference
    console.log('='.repeat(80));
    console.log('ALL PRODUCTION COLUMNS (for reference)');
    console.log('='.repeat(80));
    console.log('');
    prodColumns.forEach(col => {
      const inSchema = schemaColumns.includes(col.name.toLowerCase()) ? '✅' : '❌';
      const defaultStr = col.defaultValue ? col.defaultValue.substring(0, 40) : 'none';
      console.log(`   ${inSchema} ${col.name.padEnd(35)} ${col.typeString.padEnd(25)} nullable: ${col.nullable.toString().padEnd(5)} default: ${defaultStr}`);
    });
    console.log('');
    
    if (missingInSchema.length > 0) {
      console.log('='.repeat(80));
      console.log('RECOMMENDATION');
      console.log('='.repeat(80));
      console.log('');
      console.log('The following columns need to be added to the schema file:');
      console.log('');
      missingInSchema.forEach(col => {
        let colDef = `    ${col.name} ${col.typeString.toUpperCase()}`;
        if (!col.nullable) {
          colDef += ' NOT NULL';
        }
        if (col.defaultValue) {
          colDef += ` DEFAULT ${col.defaultValue}`;
        }
        colDef += ',';
        console.log(colDef);
      });
      console.log('');
    } else {
      console.log('='.repeat(80));
      console.log('✅ SCHEMA FILE MATCHES PRODUCTION DATABASE!');
      console.log('='.repeat(80));
      console.log('');
    }

  } catch (error) {
    console.error('');
    console.error('❌ VERIFICATION FAILED');
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
