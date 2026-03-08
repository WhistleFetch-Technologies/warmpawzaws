/**
 * ============================================================================
 * AWS SECRETS MANAGER UTILITY
 * ============================================================================
 * 
 * Utility functions for retrieving secrets from AWS Secrets Manager
 * 
 * Date: 2025-01-02
 * ============================================================================
 */

import { SecretsManagerClient, GetSecretValueCommand, PutSecretValueCommand, CreateSecretCommand, DescribeSecretCommand } from '@aws-sdk/client-secrets-manager';

const secretsClient = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});

const STAGE_RAW = process.env.ENVIRONMENT || process.env.STAGE || process.env.NODE_ENV || 'dev';
const STAGE = STAGE_RAW === 'production' ? 'prod' : STAGE_RAW === 'development' ? 'dev' : STAGE_RAW;


export async function getSecret(secretName: string): Promise<string | null> {
  try {
    const fullSecretName = `warmpawz/${STAGE}/${secretName}`;
    
    const command = new GetSecretValueCommand({ SecretId: fullSecretName });
    const response = await secretsClient.send(command);

    if (!response.SecretString) {
      console.warn(`[SECRETS] Secret ${fullSecretName} exists but has no value`);
      return null;
    }

    return response.SecretString;
  } catch (error: any) {
    if (error.name === 'ResourceNotFoundException') {
      console.warn(`[SECRETS] Secret warmpawz/${STAGE}/${secretName} not found`);
      return null;
    }
    console.error(`[SECRETS] Error fetching secret ${secretName}:`, error);
    throw error;
  }
}

export async function getSecretJson<T = any>(secretName: string): Promise<T | null> {
  const secretString = await getSecret(secretName);
  if (!secretString) {
    return null;
  }

  try {
    return JSON.parse(secretString) as T;
  } catch (error) {
    console.error(`[SECRETS] Error parsing JSON secret ${secretName}:`, error);
    throw new Error(`Failed to parse secret ${secretName} as JSON`);
  }
}


export async function putSecret(secretName: string, secretValue: string, description?: string): Promise<void> {
  const fullSecretName = `warmpawz/${STAGE}/${secretName}`;

  try {
    // Check if secret exists
    const describeCommand = new DescribeSecretCommand({ SecretId: fullSecretName });
    try {
      await secretsClient.send(describeCommand);
      // Secret exists, update it
      const updateCommand = new PutSecretValueCommand({
        SecretId: fullSecretName,
        SecretString: secretValue,
      });
      await secretsClient.send(updateCommand);
      console.log(`[SECRETS] Updated secret ${fullSecretName}`);
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        // Secret doesn't exist, create it
        const createCommand = new CreateSecretCommand({
          Name: fullSecretName,
          SecretString: secretValue,
          Description: description || `Warmpawz ${STAGE} ${secretName}`,
        });
        await secretsClient.send(createCommand);
        console.log(`[SECRETS] Created secret ${fullSecretName}`);
      } else {
        throw error;
      }
    }
  } catch (error: any) {
    console.error(`[SECRETS] Error storing secret ${secretName}:`, error);
    throw error;
  }
}


export async function putSecretJson(secretName: string, secretValue: any, description?: string): Promise<void> {
  const secretString = JSON.stringify(secretValue);
  await putSecret(secretName, secretString, description);
}
