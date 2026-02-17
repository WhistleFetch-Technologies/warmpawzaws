/**
 * ============================================================================
 * AWS BEDROCK CLIENT UTILITY
 * ============================================================================
 *
 * Handles AWS Bedrock integration for AI features:
 * - Chat completions
 * - Symptoms checker
 * - Smart booking assist
 * - Customer support
 *
 * Config source order: 1) AWS Secrets Manager (warmpawz/{stage}/bedrock), 2) platform_settings.
 *
 * Date: 2026-01-07
 * Phase 3: AI Chatbot Integration
 * ============================================================================
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { query } from '../database/rds-connection';
import { getSecretJson } from './secrets-manager';

export interface BedrockConfig {
  client: BedrockRuntimeClient;
  modelId: string;
  region: string;
}

interface BedrockSecretShape {
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  modelId?: string;
  enabled?: boolean;
}

const DEFAULT_BEDROCK_REGION = 'ap-south-1';
const DEFAULT_BEDROCK_MODEL = 'amazon.nova-lite-v1:0';

function buildClient(region: string, modelId: string, credentials?: { accessKeyId: string; secretAccessKey: string }): BedrockConfig {
  const finalRegion = region.trim();
  const client = new BedrockRuntimeClient({
    region: finalRegion,
    ...(credentials
      ? { credentials: { accessKeyId: credentials.accessKeyId.trim(), secretAccessKey: credentials.secretAccessKey.trim() } }
      : {}),
  });
  return { client, modelId, region: finalRegion };
}

/**
 * Get Bedrock client configuration.
 * 1) Try AWS Secrets Manager secret warmpawz/{stage}/bedrock (JSON: accessKeyId, secretAccessKey, region?, modelId?).
 * 2) Fall back to platform_settings (aws_config) for backwards compatibility.
 */
export async function getBedrockConfig(): Promise<BedrockConfig | null> {
  try {
    // 1) AWS Secrets Manager (preferred). Use ap-south-1 by default; supports IAM role (no keys) or explicit credentials.
    const secret = await getSecretJson<BedrockSecretShape>('bedrock');
    if (secret && secret.enabled !== false) {
      const region = (secret.region || DEFAULT_BEDROCK_REGION).trim();
      const modelId = (secret.modelId || DEFAULT_BEDROCK_MODEL).trim();
      const hasCredentials = !!(secret.accessKeyId && secret.secretAccessKey);
      if (hasCredentials) {
        console.log('[BEDROCK] Using config from AWS Secrets Manager (credentials)');
        return buildClient(region, modelId, { accessKeyId: secret.accessKeyId!, secretAccessKey: secret.secretAccessKey! });
      }
      console.log('[BEDROCK] Using config from AWS Secrets Manager (IAM role), region=', region, 'model=', modelId);
      return buildClient(region, modelId);
    }

    // 2) Platform settings (DB)
    const settingsResult = await query(
      `SELECT setting_value FROM platform_settings WHERE setting_key = 'aws_config' LIMIT 1`
    );
    const awsSettings = settingsResult.rows[0]?.setting_value as any || null;

    if (!awsSettings?.bedrock?.enabled) {
      console.warn('AWS Bedrock is not enabled in platform settings');
      return null;
    }

    if (!awsSettings.credentials?.accessKeyId || !awsSettings.credentials?.secretAccessKey) {
      console.warn('AWS Bedrock credentials not set in platform settings');
      return null;
    }

    const modelId = (awsSettings.bedrock.modelId || DEFAULT_BEDROCK_MODEL).trim();
    const region = (awsSettings.bedrock.region || DEFAULT_BEDROCK_REGION).trim();

    console.log('[BEDROCK] Using config from platform_settings');
    return buildClient(region, modelId, {
      accessKeyId: awsSettings.credentials.accessKeyId,
      secretAccessKey: awsSettings.credentials.secretAccessKey,
    });
  } catch (error: any) {
    console.error('Error getting Bedrock config:', error);
    return null;
  }
}

/**
 * Invoke Bedrock model
 */
export async function invokeBedrock(
  prompt: string,
  systemPrompt?: string,
  options: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
  } = {}
): Promise<string> {
  const config = await getBedrockConfig();
  
  if (!config) {
    throw new Error('Bedrock is not configured or enabled');
  }
  
  const { client, modelId } = config;
  const { maxTokens = 1024, temperature = 0.5, topP = 0.9 } = options;
  
  try {
    // Determine model format based on modelId
    let body: any;
    
    if (modelId.includes('claude') || modelId.includes('anthropic')) {
      // Claude format
      const messages: any[] = [];
      
      if (systemPrompt) {
        messages.push({
          role: 'system',
          content: systemPrompt,
        });
      }
      
      messages.push({
        role: 'user',
        content: prompt,
      });
      
      body = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: maxTokens,
        temperature,
        top_p: topP,
        messages,
      };
    } else if (modelId.includes('nova') || modelId.includes('amazon')) {
      // Amazon Nova/Titan format
      const inputText = systemPrompt 
        ? `System: ${systemPrompt}\n\nHuman: ${prompt}\n\nAssistant:`
        : `Human: ${prompt}\n\nAssistant:`;
      
      body = {
        inputText,
        textGenerationConfig: {
          maxTokenCount: maxTokens,
          temperature,
          topP: topP,
        },
      };
    } else {
      // Default to Claude format
      const messages: any[] = [];
      
      if (systemPrompt) {
        messages.push({
          role: 'system',
          content: systemPrompt,
        });
      }
      
      messages.push({
        role: 'user',
        content: prompt,
      });
      
      body = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: maxTokens,
        temperature,
        top_p: topP,
        messages,
      };
    }
    
    const command = new InvokeModelCommand({
      modelId,
      body: JSON.stringify(body),
      contentType: 'application/json',
      accept: 'application/json',
    });
    
    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    // Extract text from response based on model type
    if (modelId.includes('nova') || modelId.includes('amazon')) {
      // Amazon Nova/Titan format
      if (responseBody.results && responseBody.results.length > 0) {
        return responseBody.results[0].outputText;
      }
    } else {
      // Claude format
      if (responseBody.content && responseBody.content.length > 0) {
        return responseBody.content[0].text;
      }
    }
    
    throw new Error('Invalid response format from Bedrock');
  } catch (error: any) {
    console.error('Error invoking Bedrock:', error);
    throw new Error(`Bedrock invocation failed: ${error.message}`);
  }
}

/**
 * Invoke Bedrock with streaming (for real-time chat)
 */
export async function* invokeBedrockStream(
  prompt: string,
  systemPrompt?: string,
  options: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
  } = {}
): AsyncGenerator<string, void, unknown> {
  const config = await getBedrockConfig();
  
  if (!config) {
    throw new Error('Bedrock is not configured or enabled');
  }
  
  // For now, return non-streaming response
  // TODO: Implement streaming with InvokeModelWithResponseStreamCommand
  const response = await invokeBedrock(prompt, systemPrompt, options);
  yield response;
}

