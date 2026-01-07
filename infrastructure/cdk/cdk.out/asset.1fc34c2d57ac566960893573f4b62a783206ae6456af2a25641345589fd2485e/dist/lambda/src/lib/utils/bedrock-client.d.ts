/**
 * ============================================================================
 * AWS BEDROCK CLIENT UTILITY
 * ============================================================================
 *
 * Centralized Bedrock client for AI features
 * - AI Chatbot
 * - Medical report summarization
 * - Content generation
 *
 * Date: 2025-01-28
 * ============================================================================
 */
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
export interface BedrockConfig {
    client: BedrockRuntimeClient;
    modelId: string;
    region: string;
}
/**
 * Get Bedrock client configuration from platform settings
 */
export declare function getBedrockConfig(): Promise<BedrockConfig | null>;
/**
 * Invoke Bedrock model
 */
export declare function invokeBedrock(prompt: string, systemPrompt?: string, options?: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
}): Promise<string>;
//# sourceMappingURL=bedrock-client.d.ts.map