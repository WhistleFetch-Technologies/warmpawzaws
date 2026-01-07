/**
 * AWS Configuration for Customer App
 * Migrated from Supabase to AWS API Gateway
 * 
 * ✅ FIXED: Removed Supabase function path (/make-server-3dd53475)
 * ✅ API Gateway routes are registered directly at root level
 * 
 * Uses environment variables for configuration:
 * - AWS_API_GATEWAY_URL: Base URL for API Gateway
 * 
 * For React Native, set these in:
 * - iOS: Info.plist or via react-native-config
 * - Android: build.gradle or via react-native-config
 * - Or use react-native-config package for .env files
 */

// Get API Gateway URL from environment variable
// Priority: ENV VAR > DEV fallback > PROD fallback
const AWS_API_GATEWAY_URL = process.env.AWS_API_GATEWAY_URL || 
  process.env.EXPO_PUBLIC_API_GATEWAY_URL ||
  (__DEV__ ? 'https://dev.api.warmpawz.com' : 'https://api.warmpawz.com');

// ✅ FIXED: API Base URL - NO Supabase path, direct API Gateway access
export const API_BASE_URL = AWS_API_GATEWAY_URL;

// Validate configuration in development
if (__DEV__) {
  console.log('🔧 [DEV] API Gateway URL:', AWS_API_GATEWAY_URL);
}

// Export for use in API service
export { AWS_API_GATEWAY_URL };

