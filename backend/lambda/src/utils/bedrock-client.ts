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
 * Date: 2026-01-07
 * Phase 3: AI Chatbot Integration
 * ============================================================================
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { query } from '../database/rds-connection';

export interface BedrockConfig {
  client: BedrockRuntimeClient;
  modelId: string;
  region: string;
}

/**
 * Get Bedrock client configuration from platform settings
 */
export async function getBedrockConfig(): Promise<BedrockConfig | null> {
  try {
    const settingsResult = await query(
      `SELECT setting_value FROM platform_settings WHERE setting_key = 'aws_config' LIMIT 1`
    );
    
    const awsSettings = settingsResult.rows[0]?.setting_value as any || null;
    
    if (!awsSettings?.bedrock?.enabled) {
      console.warn('AWS Bedrock is not enabled in platform settings');
      return null;
    }
    
    if (!awsSettings.credentials?.accessKeyId || !awsSettings.credentials?.secretAccessKey) {
      throw new Error('AWS credentials not configured');
    }
    
    let modelId = awsSettings.bedrock.modelId || 'us.amazon.nova-lite-v1:0';
    
    // Fix: Remap base Nova ID to US Cross-Region Inference Profile
    if (modelId === 'amazon.nova-lite-v1:0') {
      modelId = 'us.amazon.nova-lite-v1:0';
    }
    
    let region = (awsSettings.bedrock.region || 'ap-south-1').trim();
    
    // Fix: US Inference Profiles are not accessible from ap-south-1
    if (modelId.startsWith('us.') && region === 'ap-south-1') {
      region = 'us-east-1';
    }
    
    const client = new BedrockRuntimeClient({
      region,
      credentials: {
        accessKeyId: String(awsSettings.credentials.accessKeyId).trim(),
        secretAccessKey: String(awsSettings.credentials.secretAccessKey).trim(),
      },
    });
    
    return { client, modelId, region };
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

