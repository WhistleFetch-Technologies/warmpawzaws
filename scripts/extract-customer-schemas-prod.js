/**
 * Extract customer-related table schemas from production RDS and generate SQL files
 * This script queries the PostgreSQL system catalogs to get complete schema information
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REGION = 'ap-south-1';
const CLUSTER_ID = 'warmpawz-prod-cluster';
const SECRET_NAME = 'warmpawz-prod-rds-master-20260207201049162400000001';
const DB_NAME = 'warmpawz';
const SCHEMAS_DIR = path.join(__dirname, '..', 'db', 'schemas');
const CUSTOMER_DIR = path.join(SCHEMAS_DIR, 'customer');

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
    const errorOutput = error.stderr ? error.stderr.toString() : error.message;
    throw new Error(`SQL execution failed: ${errorOutput}`);
  }
}

function parseRecord(record) {
  return record.map(field => {
    if (field.stringValue !== undefined) return field.stringValue;
    if (field.longValue !== undefined) return field.longValue;
    if (field.booleanValue !== undefined) return field.booleanValue;
    if (field.doubleValue !== undefined) return field.doubleValue;
    if (field.isNull) return null;
    return null;
  });
}

async function getCustomerTables() {
  const sql = `
    SELECT 
      schemaname,
      tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND (
        tablename LIKE 'customer%' 
        OR tablename LIKE '%customer%'
        OR tablename = 'customers'
      )
    ORDER BY tablename;
  `;
  
  const result = await executeSQL(sql, true);
  const tables = [];
  
  if (result.records) {
    for (const record of result.records) {
      const row = parseRecord(record);
      tables.push({
        schema: row[0],
        name: row[1]
      });
    }
  }
  
  return tables;
}

async function getTableColumns(tableName) {
  const sql = `
    SELECT 
      c.column_name,
      c.data_type,
      c.character_maximum_length,
      c.numeric_precision,
      c.numeric_scale,
      c.is_nullable,
      c.column_default,
      c.udt_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' 
      AND c.table_name = '${tableName}'
    ORDER BY c.ordinal_position;
  `;
  
  const result = await executeSQL(sql, true);
  const columns = [];
  
  if (result.records) {
    for (const record of result.records) {
      const row = parseRecord(record);
      columns.push({
        name: row[0],
        dataType: row[1],
        maxLength: row[2],
        precision: row[3],
        scale: row[4],
        nullable: row[5] === 'YES',
        defaultValue: row[6],
        udtName: row[7]
      });
    }
  }
  
  return columns;
}

async function getTableConstraints(tableName) {
  const sql = `
    SELECT
      tc.constraint_name,
      tc.constraint_type,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.update_rule,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    LEFT JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    LEFT JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    LEFT JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
      AND rc.constraint_schema = tc.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = '${tableName}'
    ORDER BY tc.constraint_type, tc.constraint_name, kcu.ordinal_position;
  `;
  
  const result = await executeSQL(sql, true);
  const constraints = [];
  const constraintMap = new Map();
  
  if (result.records) {
    for (const record of result.records) {
      const row = parseRecord(record);
      const constraintName = row[0];
      const constraintType = row[1];
      const columnName = row[2];
      const foreignTable = row[3];
      const foreignColumn = row[4];
      const updateRule = row[5];
      const deleteRule = row[6];
      
      if (!constraintMap.has(constraintName)) {
        constraintMap.set(constraintName, {
          name: constraintName,
          type: constraintType,
          columns: [],
          foreignTable: foreignTable,
          foreignColumn: foreignColumn,
          updateRule: updateRule,
          deleteRule: deleteRule
        });
      }
      
      if (columnName) {
        constraintMap.get(constraintName).columns.push(columnName);
      }
    }
  }
  
  return Array.from(constraintMap.values());
}

async function getTableIndexes(tableName) {
  const sql = `
    SELECT
      i.indexname,
      i.indexdef
    FROM pg_indexes i
    WHERE i.schemaname = 'public'
      AND i.tablename = '${tableName}'
    ORDER BY i.indexname;
  `;
  
  const result = await executeSQL(sql, true);
  const indexes = [];
  
  if (result.records) {
    for (const record of result.records) {
      const row = parseRecord(record);
      indexes.push({
        name: row[0],
        definition: row[1],
        fullDefinition: row[1] // Use indexdef as fullDefinition
      });
    }
  }
  
  return indexes;
}

async function getTableComments(tableName) {
  const sql = `
    SELECT
      obj_description('public.${tableName}'::regclass, 'pg_class') as table_comment;
  `;
  
  const result = await executeSQL(sql, true);
  let tableComment = null;
  
  if (result.records && result.records.length > 0) {
    tableComment = parseRecord(result.records[0])[0];
  }
  
  // Get column comments
  const columnCommentsSQL = `
    SELECT
      a.attname as column_name,
      col_description(a.attrelid, a.attnum) as column_comment
    FROM pg_attribute a
    JOIN pg_class c ON a.attrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relname = '${tableName}'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND col_description(a.attrelid, a.attnum) IS NOT NULL
    ORDER BY a.attnum;
  `;
  
  const columnResult = await executeSQL(columnCommentsSQL, true);
  const columnComments = new Map();
  
  if (columnResult.records) {
    for (const record of columnResult.records) {
      const row = parseRecord(record);
      if (row[1]) {
        columnComments.set(row[0], row[1]);
      }
    }
  }
  
  return { tableComment, columnComments };
}

function formatDataType(col) {
  let type = col.udtName || col.dataType;
  
  // Handle special types
  if (type === 'varchar' && col.maxLength) {
    return `VARCHAR(${col.maxLength})`;
  }
  if (type === 'numeric' || type === 'decimal') {
    if (col.precision && col.scale) {
      return `NUMERIC(${col.precision}, ${col.scale})`;
    } else if (col.precision) {
      return `NUMERIC(${col.precision})`;
    }
    return 'NUMERIC';
  }
  if (type === 'character varying') {
    return col.maxLength ? `VARCHAR(${col.maxLength})` : 'TEXT';
  }
  if (type === 'timestamp with time zone') {
    return 'TIMESTAMPTZ';
  }
  if (type === 'timestamp without time zone') {
    return 'TIMESTAMP';
  }
  if (type === 'time without time zone') {
    return 'TIME';
  }
  if (type === 'time with time zone') {
    return 'TIMETZ';
  }
  if (type === 'double precision') {
    return 'DOUBLE PRECISION';
  }
  if (type === 'character') {
    return col.maxLength ? `CHAR(${col.maxLength})` : 'CHAR';
  }
  
  // Map common types
  const typeMap = {
    'text': 'TEXT',
    'integer': 'INTEGER',
    'bigint': 'BIGINT',
    'smallint': 'SMALLINT',
    'boolean': 'BOOLEAN',
    'uuid': 'UUID',
    'jsonb': 'JSONB',
    'json': 'JSON',
    'date': 'DATE',
    'bytea': 'BYTEA',
    'real': 'REAL',
    'money': 'MONEY',
    'inet': 'INET',
    'cidr': 'CIDR',
    'macaddr': 'MACADDR',
    'point': 'POINT',
    'line': 'LINE',
    'lseg': 'LSEG',
    'box': 'BOX',
    'path': 'PATH',
    'polygon': 'POLYGON',
    'circle': 'CIRCLE'
  };
  
  return typeMap[type.toLowerCase()] || type.toUpperCase();
}

function formatDefaultValue(defaultValue) {
  if (!defaultValue) return null;
  
  // Handle function calls
  if (defaultValue.includes('::')) {
    return defaultValue;
  }
  
  // Handle function calls like gen_random_uuid()
  if (defaultValue.includes('(') && defaultValue.includes(')')) {
    return defaultValue;
  }
  
  // Handle quoted strings
  if (defaultValue.startsWith("'") && defaultValue.endsWith("'")) {
    return defaultValue;
  }
  
  // Handle boolean
  if (defaultValue === 'true' || defaultValue === 'false') {
    return defaultValue.toUpperCase();
  }
  
  return defaultValue;
}

function generateCreateTableSQL(tableName, columns, constraints) {
  let sql = `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
  
  const columnDefs = [];
  const primaryKeyCols = [];
  const foreignKeys = [];
  const uniqueConstraints = [];
  const checkConstraints = [];
  
  // Process columns
  for (const col of columns) {
    let def = `    ${col.name} ${formatDataType(col)}`;
    
    if (!col.nullable) {
      def += ' NOT NULL';
    }
    
    if (col.defaultValue) {
      const defaultValue = formatDefaultValue(col.defaultValue);
      def += ` DEFAULT ${defaultValue}`;
    }
    
    columnDefs.push(def);
  }
  
  // Process constraints
  for (const constraint of constraints) {
    if (constraint.type === 'PRIMARY KEY') {
      primaryKeyCols.push(...constraint.columns);
    } else if (constraint.type === 'FOREIGN KEY') {
      foreignKeys.push(constraint);
    } else if (constraint.type === 'UNIQUE') {
      uniqueConstraints.push(constraint);
    } else if (constraint.type === 'CHECK') {
      checkConstraints.push(constraint);
    }
  }
  
  // Add primary key if exists
  if (primaryKeyCols.length > 0) {
    const pkCols = primaryKeyCols.join(', ');
    columnDefs.push(`    PRIMARY KEY (${pkCols})`);
  }
  
  sql += columnDefs.join(',\n');
  sql += '\n);';
  
  return { createTable: sql, foreignKeys, uniqueConstraints, checkConstraints };
}

async function generateSQLFile(tableName, columns, constraints, indexes, comments) {
  const { createTable, foreignKeys, uniqueConstraints, checkConstraints } = generateCreateTableSQL(tableName, columns, constraints);
  
  let sql = `-- ============================================================================\n`;
  sql += `-- ${tableName.toUpperCase()} TABLE - SCHEMA\n`;
  sql += `-- ============================================================================\n`;
  sql += `-- Extracted from production RDS database\n`;
  sql += `-- ============================================================================\n`;
  sql += `\n`;
  
  // Table definition
  sql += `-- ============================================================================\n`;
  sql += `-- TABLE DEFINITION\n`;
  sql += `-- ============================================================================\n`;
  sql += `\n`;
  sql += createTable;
  sql += `\n\n`;
  
  // Add foreign keys
  if (foreignKeys.length > 0) {
    sql += `-- ============================================================================\n`;
    sql += `-- FOREIGN KEY CONSTRAINTS\n`;
    sql += `-- ============================================================================\n`;
    sql += `\n`;
    for (const fk of foreignKeys) {
      const cols = fk.columns.join(', ');
      const onUpdate = fk.updateRule ? ` ON UPDATE ${fk.updateRule}` : '';
      const onDelete = fk.deleteRule ? ` ON DELETE ${fk.deleteRule}` : '';
      sql += `ALTER TABLE ${tableName} ADD CONSTRAINT ${fk.name} FOREIGN KEY (${cols}) REFERENCES ${fk.foreignTable}(${fk.foreignColumn})${onUpdate}${onDelete};\n`;
    }
    sql += `\n`;
  }
  
  // Add unique constraints (if not inline)
  if (uniqueConstraints.length > 0) {
    sql += `-- ============================================================================\n`;
    sql += `-- UNIQUE CONSTRAINTS\n`;
    sql += `-- ============================================================================\n`;
    sql += `\n`;
    for (const uc of uniqueConstraints) {
      const cols = uc.columns.join(', ');
      sql += `ALTER TABLE ${tableName} ADD CONSTRAINT ${uc.name} UNIQUE (${cols});\n`;
    }
    sql += `\n`;
  }
  
  // Add check constraints
  if (checkConstraints.length > 0) {
    sql += `-- ============================================================================\n`;
    sql += `-- CHECK CONSTRAINTS\n`;
    sql += `-- ============================================================================\n`;
    sql += `\n`;
    for (const cc of checkConstraints) {
      // We'll need to get the actual check expression
      sql += `-- ALTER TABLE ${tableName} ADD CONSTRAINT ${cc.name} CHECK (...);\n`;
    }
    sql += `\n`;
  }
  
  // Add indexes
  if (indexes.length > 0) {
    sql += `-- ============================================================================\n`;
    sql += `-- INDEXES\n`;
    sql += `-- ============================================================================\n`;
    sql += `\n`;
    for (const idx of indexes) {
      sql += `${idx.fullDefinition || idx.definition};\n`;
    }
    sql += `\n`;
  }
  
  // Add comments
  if (comments.tableComment || comments.columnComments.size > 0) {
    sql += `-- ============================================================================\n`;
    sql += `-- COMMENTS\n`;
    sql += `-- ============================================================================\n`;
    sql += `\n`;
    if (comments.tableComment) {
      sql += `COMMENT ON TABLE ${tableName} IS '${comments.tableComment.replace(/'/g, "''")}';\n`;
    }
    for (const [colName, colComment] of comments.columnComments.entries()) {
      sql += `COMMENT ON COLUMN ${tableName}.${colName} IS '${colComment.replace(/'/g, "''")}';\n`;
    }
    sql += `\n`;
  }
  
  return sql;
}

async function main() {
  console.log('='.repeat(80));
  console.log('EXTRACTING CUSTOMER-RELATED TABLE SCHEMAS FROM PRODUCTION RDS');
  console.log('='.repeat(80));
  console.log('');
  
  try {
    // Create customer directory
    if (!fs.existsSync(CUSTOMER_DIR)) {
      fs.mkdirSync(CUSTOMER_DIR, { recursive: true });
      console.log(`📁 Created directory: ${CUSTOMER_DIR}`);
    }
    
    // Get all customer-related tables
    console.log('📋 Getting list of customer-related tables...');
    const tables = await getCustomerTables();
    console.log(`   ✅ Found ${tables.length} customer-related tables`);
    
    if (tables.length === 0) {
      console.log('   ⚠️  No customer-related tables found');
      return;
    }
    
    console.log('   Tables:', tables.map(t => t.name).join(', '));
    console.log('');
    
    // Process each table
    for (const table of tables) {
      console.log(`📄 Processing table: ${table.name}`);
      
      try {
        // Get table components
        const columns = await getTableColumns(table.name);
        const constraints = await getTableConstraints(table.name);
        const indexes = await getTableIndexes(table.name);
        const comments = await getTableComments(table.name);
        
        // Generate SQL
        const sql = await generateSQLFile(table.name, columns, constraints, indexes, comments);
        
        // Write file
        const fileName = `${table.name}.sql`;
        const filePath = path.join(CUSTOMER_DIR, fileName);
        fs.writeFileSync(filePath, sql, 'utf8');
        
        console.log(`   ✅ Created: customer/${fileName}`);
        console.log(`      Columns: ${columns.length}, Indexes: ${indexes.length}, Constraints: ${constraints.length}`);
        
      } catch (error) {
        console.error(`   ❌ Error processing ${table.name}: ${error.message}`);
      }
    }
    
    console.log('');
    console.log('='.repeat(80));
    console.log('✅ CUSTOMER SCHEMA EXTRACTION COMPLETE');
    console.log('='.repeat(80));
    console.log('');
    console.log(`📁 Files created in: ${CUSTOMER_DIR}`);
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error('❌ EXTRACTION FAILED');
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
