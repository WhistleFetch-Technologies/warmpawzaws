#!/usr/bin/env node
/**
 * Helper script to find the correct DB Secret ARN
 * This will list all secrets in Secrets Manager to help you find the right one
 */

const { SecretsManagerClient, ListSecretsCommand } = require('@aws-sdk/client-secrets-manager');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const secretsClient = new SecretsManagerClient({ region: REGION });

async function findDbSecret() {
  console.log(`🔍 Searching for database secrets in region: ${REGION}\n`);

  try {
    const command = new ListSecretsCommand({});
    const response = await secretsClient.send(command);

    if (!response.SecretList || response.SecretList.length === 0) {
      console.log('❌ No secrets found in Secrets Manager.');
      return;
    }

    console.log(`✅ Found ${response.SecretList.length} secret(s):\n`);
    console.log('═'.repeat(100));

    // Filter for database-related secrets
    const dbSecrets = response.SecretList.filter(secret => 
      secret.Name?.toLowerCase().includes('db') ||
      secret.Name?.toLowerCase().includes('database') ||
      secret.Name?.toLowerCase().includes('rds') ||
      secret.Description?.toLowerCase().includes('db') ||
      secret.Description?.toLowerCase().includes('database')
    );

    if (dbSecrets.length > 0) {
      console.log('\n📋 Database-related secrets:\n');
      dbSecrets.forEach((secret, index) => {
        console.log(`${index + 1}. ${secret.Name}`);
        console.log(`   ARN: ${secret.ARN}`);
        if (secret.Description) {
          console.log(`   Description: ${secret.Description}`);
        }
        console.log('');
      });
    }

    console.log('\n📋 All secrets:\n');
    response.SecretList.forEach((secret, index) => {
      console.log(`${index + 1}. ${secret.Name}`);
      console.log(`   ARN: ${secret.ARN}`);
      if (secret.Description) {
        console.log(`   Description: ${secret.Description}`);
      }
      console.log('');
    });

    // Look for warmpawz-specific secrets
    const warmpawzSecrets = response.SecretList.filter(secret => 
      secret.Name?.toLowerCase().includes('warmpawz')
    );

    if (warmpawzSecrets.length > 0) {
      console.log('\n🎯 Warmpawz-related secrets (most likely candidates):\n');
      warmpawzSecrets.forEach((secret, index) => {
        console.log(`${index + 1}. ${secret.Name}`);
        console.log(`   ARN: ${secret.ARN}`);
        console.log(`   ✅ Use this ARN in your script: ${secret.ARN}`);
        if (secret.Description) {
          console.log(`   Description: ${secret.Description}`);
        }
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Error listing secrets:', error.message);
    console.error('\n💡 Make sure you have:');
    console.error('   1. AWS credentials configured');
    console.error('   2. Proper IAM permissions to access Secrets Manager');
    console.error('   3. Correct AWS region set');
  }
}

findDbSecret();
