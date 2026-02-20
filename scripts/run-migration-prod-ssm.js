#!/usr/bin/env node
/**
 * Run Production Migration via AWS Systems Manager Run Command
 * 
 * This script uses SSM Run Command to execute the migration on an EC2 instance
 * in the production VPC. The instance must have:
 * - Systems Manager agent installed
 * - PostgreSQL client (psql) installed
 * - Access to RDS (security group and IAM permissions)
 * 
 * Usage:
 *   ENVIRONMENT=prod node scripts/run-migration-prod-ssm.js 559_add_vendors_specializations_column.sql [instance-id]
 * 
 * If instance-id is not provided, the script will attempt to find one automatically.
 */

const { SSMClient, SendCommandCommand, GetCommandInvocationCommand, ListCommandInvocationsCommand } = require('@aws-sdk/client-ssm');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { EC2Client, DescribeInstancesCommand } = require('@aws-sdk/client-ec2');
const { RDSClient, DescribeDBClustersCommand } = require('@aws-sdk/client-rds');
const fs = require('fs');
const path = require('path');

const ENVIRONMENT = process.env.ENVIRONMENT || 'prod';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const MIGRATION_FILE = process.argv[2];
const INSTANCE_ID = process.argv[3]; // Optional: specific instance ID

const ssmClient = new SSMClient({ region: REGION });
const secretsClient = new SecretsManagerClient({ region: REGION });
const ec2Client = new EC2Client({ region: REGION });
const rdsClient = new RDSClient({ region: REGION });

async function findEC2Instance() {
  console.log('📊 Finding EC2 instance in production VPC...');
  
  const vpcId = 'vpc-02a4893e5e582c4d8'; // Production VPC
  
  try {
    const command = new DescribeInstancesCommand({
      Filters: [
        { Name: 'vpc-id', Values: [vpcId] },
        { Name: 'instance-state-name', Values: ['running'] }
      ]
    });
    
    const response = await ec2Client.send(command);
    
    if (response.Reservations && response.Reservations.length > 0) {
      const instance = response.Reservations[0].Instances[0];
      if (instance) {
        console.log(`✅ Found instance: ${instance.InstanceId}`);
        return instance.InstanceId;
      }
    }
    
    throw new Error('No running EC2 instances found in production VPC');
  } catch (error) {
    console.error('❌ Error finding EC2 instance:', error.message);
    throw error;
  }
}

async function getRDSConnectionInfo() {
  console.log('📊 Getting RDS connection information...');
  
  try {
    const command = new DescribeDBClustersCommand({
      DBClusterIdentifier: 'warmpawz-prod-cluster'
    });
    
    const response = await rdsClient.send(command);
    const cluster = response.DBClusters[0];
    
    return {
      endpoint: cluster.Endpoint,
      port: cluster.Port || 5432,
      database: cluster.DatabaseName || 'warmpawz',
      username: cluster.MasterUsername || 'warmpawz_admin'
    };
  } catch (error) {
    console.error('❌ Error getting RDS info:', error.message);
    throw error;
  }
}

async function getRDSPassword() {
  console.log('🔐 Getting RDS password from Secrets Manager...');
  
  const secretName = 'warmpawz-prod-rds-master-20260207201049162400000001';
  
  try {
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await secretsClient.send(command);
    const secret = JSON.parse(response.SecretString);
    
    return secret.password || secret.Password || secret.secret || secret.Secret;
  } catch (error) {
    console.error('❌ Error getting password:', error.message);
    throw error;
  }
}

async function readMigrationFile() {
  if (!MIGRATION_FILE) {
    throw new Error('Migration file not specified');
  }
  
  const migrationPath = MIGRATION_FILE.startsWith('db/')
    ? path.join(__dirname, '..', MIGRATION_FILE)
    : path.join(__dirname, '..', 'db', 'migrations', MIGRATION_FILE);
  
  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration file not found: ${migrationPath}`);
  }
  
  console.log(`📄 Reading migration file: ${migrationPath}`);
  return fs.readFileSync(migrationPath, 'utf8');
}

async function runMigration() {
  console.log('🚀 Production Migration via Systems Manager');
  console.log('===========================================');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);
  console.log(`Migration: ${MIGRATION_FILE}`);
  console.log('');
  
  // Get instance ID
  const instanceId = INSTANCE_ID || await findEC2Instance();
  console.log(`Using instance: ${instanceId}`);
  console.log('');
  
  // Get RDS connection info
  const rdsInfo = await getRDSConnectionInfo();
  const password = await getRDSPassword();
  
  console.log(`RDS Endpoint: ${rdsInfo.endpoint}`);
  console.log(`Database: ${rdsInfo.database}`);
  console.log(`Username: ${rdsInfo.username}`);
  console.log('');
  
  // Read migration file
  const migrationSQL = await readMigrationFile();
  
  // Create the command to run on the EC2 instance
  // We'll use psql to execute the migration
  const command = [
    'export PGPASSWORD=\'' + password.replace(/'/g, "'\"'\"'") + '\'',
    'psql -h ' + rdsInfo.endpoint + ' -p ' + rdsInfo.port + ' -U ' + rdsInfo.username + ' -d ' + rdsInfo.database + ' << \'SQL_EOF\'',
    migrationSQL,
    'SQL_EOF',
    'echo "Migration completed with exit code: $?"'
  ].join('\n');
  
  console.log('⚙️  Sending command to EC2 instance via Systems Manager...');
  console.log('─────────────────────────────────────────────────────────────');
  
  try {
    const sendCommand = new SendCommandCommand({
      InstanceIds: [instanceId],
      DocumentName: 'AWS-RunShellScript',
      Parameters: {
        commands: [command],
        workingDirectory: ['/tmp']
      },
      TimeoutSeconds: 300
    });
    
    const response = await ssmClient.send(sendCommand);
    const commandId = response.Command.CommandId;
    
    console.log(`✅ Command sent successfully`);
    console.log(`Command ID: ${commandId}`);
    console.log('');
    console.log('⏳ Waiting for command to complete...');
    
    // Poll for command completion
    let status = 'InProgress';
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max
    
    while (status === 'InProgress' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const getCommand = new GetCommandInvocationCommand({
        CommandId: commandId,
        InstanceId: instanceId
      });
      
      const result = await ssmClient.send(getCommand);
      status = result.Status;
      
      if (status === 'InProgress') {
        process.stdout.write('.');
        attempts++;
      } else {
        console.log('');
        console.log(`Command Status: ${status}`);
        console.log('');
        
        if (result.StandardOutputContent) {
          console.log('📋 Output:');
          console.log(result.StandardOutputContent);
        }
        
        if (result.StandardErrorContent) {
          console.log('⚠️  Errors:');
          console.log(result.StandardErrorContent);
        }
        
        if (status === 'Success') {
          console.log('');
          console.log('✅ Migration completed successfully!');
          return;
        } else {
          throw new Error(`Migration failed with status: ${status}`);
        }
      }
    }
    
    if (status === 'InProgress') {
      throw new Error('Command timed out');
    }
    
  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:');
    console.error(error.message);
    process.exit(1);
  }
}

// Run the migration
runMigration().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
