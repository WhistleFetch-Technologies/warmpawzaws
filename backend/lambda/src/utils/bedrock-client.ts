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

/** Claude v2 / Instant use Text Completions on Bedrock, not the Messages API. */
function isLegacyAnthropicCompletionModel(modelId: string): boolean {
  const id = modelId.toLowerCase();
  return id.includes('claude-v2') || id.includes('claude-instant') || id.includes('claude-v1');
}

/** Amazon Nova (Lite/Pro/Micro) InvokeModel uses messages + inferenceConfig, not Titan-style inputText. */
function isAmazonNovaModel(modelId: string): boolean {
  const id = modelId.toLowerCase();
  return id.includes('nova') || id.includes('amazon.nova');
}

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
    // Admin UI saves AWS (including Bedrock) under admin:settings:aws (GET/POST /admin/settings/aws).
    // Legacy key aws_config is still supported as fallback.
    const settingsResult = await query(
      `SELECT COALESCE(
         (SELECT setting_value FROM platform_settings WHERE setting_key = 'admin:settings:aws' LIMIT 1),
         (SELECT setting_value FROM platform_settings WHERE setting_key = 'aws_config' LIMIT 1)
       ) AS setting_value`
    );

    let raw = settingsResult.rows[0]?.setting_value as unknown;
    if (raw == null) {
      console.warn('[Bedrock] No admin:settings:aws / aws_config row; Bedrock disabled');
      return null;
    }
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        console.warn('[Bedrock] AWS settings value is not valid JSON');
        return null;
      }
    }

    const awsSettings = raw as Record<string, any>;

    if (!awsSettings?.bedrock?.enabled) {
      console.warn('[Bedrock] bedrock.enabled is false in platform settings');
      return null;
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

    const accessKeyId = String(awsSettings.credentials?.accessKeyId || '').trim();
    const secretAccessKey = String(awsSettings.credentials?.secretAccessKey || '').trim();
    const hasStaticCredentials =
      accessKeyId.length > 0 && secretAccessKey.length > 0;

    // Lambda / ECS: use execution task role when keys are not stored in DB (recommended).
    // Static IAM user keys still supported when both are set in admin AWS settings.
    const client = hasStaticCredentials
      ? new BedrockRuntimeClient({
          region,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        })
      : new BedrockRuntimeClient({ region });

    if (!hasStaticCredentials) {
      console.info('[Bedrock] Using default AWS credential chain (e.g. Lambda execution role) for region', region);
    }

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
    // Determine model format based on modelId (each family has a different InvokeModel JSON schema).
    let body: any;

    if (isLegacyAnthropicCompletionModel(modelId)) {
      const humanText = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
      const formattedPrompt = `\n\nHuman: ${humanText}\n\nAssistant:`;
      body = {
        prompt: formattedPrompt,
        max_tokens_to_sample: maxTokens,
        temperature,
        top_p: topP,
      };
    } else if (isAmazonNovaModel(modelId)) {
      body = {
        schemaVersion: 'messages-v1',
        messages: [{ role: 'user', content: [{ text: prompt }] }],
        ...(systemPrompt ? { system: [{ text: systemPrompt }] } : {}),
        inferenceConfig: {
          maxTokens,
          temperature,
          topP,
        },
      };
    } else if (modelId.toLowerCase().includes('titan')) {
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
    } else if (modelId.includes('claude') || modelId.includes('anthropic')) {
      // Claude 3+ Messages API on Bedrock
      body = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: maxTokens,
        temperature,
        top_p: topP,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: prompt }],
          },
        ],
      };
    } else {
      body = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: maxTokens,
        temperature,
        top_p: topP,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: prompt }],
          },
        ],
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

    if (isLegacyAnthropicCompletionModel(modelId)) {
      if (typeof responseBody.completion === 'string') {
        return responseBody.completion;
      }
    } else if (isAmazonNovaModel(modelId)) {
      const blocks = responseBody.output?.message?.content;
      if (Array.isArray(blocks)) {
        const textBlock = blocks.find((b: any) => typeof b?.text === 'string');
        if (textBlock?.text) {
          return textBlock.text;
        }
      }
    } else if (modelId.toLowerCase().includes('titan')) {
      if (responseBody.results && responseBody.results.length > 0 && responseBody.results[0].outputText) {
        return responseBody.results[0].outputText;
      }
    } else {
      if (responseBody.content && responseBody.content.length > 0) {
        const first = responseBody.content[0];
        if (typeof first?.text === 'string') {
          return first.text;
        }
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

