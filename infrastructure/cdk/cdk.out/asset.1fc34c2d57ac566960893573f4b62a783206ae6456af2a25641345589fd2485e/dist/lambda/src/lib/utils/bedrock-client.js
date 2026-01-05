"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBedrockConfig = getBedrockConfig;
exports.invokeBedrock = invokeBedrock;
const client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
const node_http_handler_1 = require("@smithy/node-http-handler");
const db_1 = require("../db");
/**
 * Get Bedrock client configuration from platform settings
 */
async function getBedrockConfig() {
    try {
        const pool = await (0, db_1.getDbClient)();
        const settingsResult = await pool.query("SELECT setting_value FROM platform_settings WHERE setting_key = 'aws_config' LIMIT 1");
        const awsSettings = settingsResult.rows[0]?.setting_value || null;
        if (!awsSettings?.bedrock?.enabled) {
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
        const client = new client_bedrock_runtime_1.BedrockRuntimeClient({
            region,
            credentials: {
                accessKeyId: String(awsSettings.credentials.accessKeyId).trim(),
                secretAccessKey: String(awsSettings.credentials.secretAccessKey).trim(),
            },
            requestHandler: new node_http_handler_1.NodeHttpHandler({
                connectionTimeout: 5000,
                requestTimeout: 30000,
            }),
        });
        return { client, modelId, region };
    }
    catch (error) {
        console.error('Error getting Bedrock config:', error);
        return null;
    }
}
/**
 * Invoke Bedrock model
 */
async function invokeBedrock(prompt, systemPrompt, options = {}) {
    const config = await getBedrockConfig();
    if (!config) {
        throw new Error('AWS Bedrock is not enabled. Please configure it in Admin Portal → Platform Settings → AWS → AI');
    }
    const payload = {
        messages: [
            {
                role: 'user',
                content: [{ text: prompt }],
            },
        ],
        inferenceConfig: {
            max_new_tokens: options.maxTokens || 1024,
            temperature: options.temperature ?? 0.5,
            top_p: options.topP ?? 0.9,
        },
    };
    if (systemPrompt) {
        payload.system = [{ text: systemPrompt }];
    }
    // Adjust payload for Claude models
    if (config.modelId.includes('claude-3')) {
        payload.anthropic_version = 'bedrock-2023-05-31';
        payload.max_tokens = options.maxTokens || 1024;
        delete payload.inferenceConfig;
    }
    const command = new client_bedrock_runtime_1.InvokeModelCommand({
        modelId: config.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload),
    });
    const response = await config.client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    // Extract completion text
    if (responseBody.output?.message?.content) {
        return responseBody.output.message.content.map((c) => c.text).join('');
    }
    else if (responseBody.content) {
        return responseBody.content.map((c) => c.text).join('');
    }
    else {
        throw new Error('Unexpected Bedrock response format');
    }
}
//# sourceMappingURL=bedrock-client.js.map