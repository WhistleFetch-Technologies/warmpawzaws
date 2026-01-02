/**
 * AWS Configuration for Vendor App
 * Migrated from Supabase to AWS API Gateway
 * Phase 4 Week 10 - API Configuration Migration
 * 
 * ✅ COMPLETE: All Supabase references removed
 * ✅ All endpoints now use API Gateway directly
 */

// AWS API Gateway URL
// Supports environment-specific configuration via environment variables
// Production: Set AWS_API_GATEWAY_URL environment variable
// Development: Falls back to default API URL
export const AWS_API_GATEWAY_URL = process.env.AWS_API_GATEWAY_URL || 
  'https://api.warmpawz.com'; // Default API URL - override with environment variable for production

// ✅ FIXED: Removed Supabase function path (/make-server-3dd53475)
// API Gateway routes are registered directly at root level
export const API_BASE_URL = AWS_API_GATEWAY_URL;

// WebSocket URL for real-time updates (if using API Gateway WebSocket API)
// For HTTP-based real-time, use polling or SSE instead
export const WS_BASE_URL = process.env.WS_BASE_URL || 
  AWS_API_GATEWAY_URL.replace('https://', 'wss://').replace('http://', 'ws://');

// Note: Authentication will be migrated to Cognito in Week 11
// For now, keep token-based auth using AsyncStorage
// The publicAnonKey is no longer needed for AWS API Gateway
// Session tokens will be managed via AsyncStorage until Cognito migration

