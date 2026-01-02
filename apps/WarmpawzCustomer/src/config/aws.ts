/**
 * AWS Configuration for Customer App
 * Migrated from Supabase to AWS API Gateway
 * 
 * Uses environment variables for configuration:
 * - AWS_API_GATEWAY_URL: Base URL for API Gateway (e.g., https://xxx.execute-api.ap-south-1.amazonaws.com)
 * 
 * For React Native, set these in:
 * - iOS: Info.plist or via react-native-config
 * - Android: build.gradle or via react-native-config
 * - Or use react-native-config package for .env files
 */

// Get API Gateway URL from environment variable
// Fallback to placeholder for development (should be set in production)
const AWS_API_GATEWAY_URL = process.env.AWS_API_GATEWAY_URL || 
  process.env.EXPO_PUBLIC_API_GATEWAY_URL ||
  'https://api.warmpawz.com'; // Placeholder - MUST be set in production

// API Base URL with Lambda function path
export const API_BASE_URL = `${AWS_API_GATEWAY_URL}/make-server-3dd53475`;

// Validate configuration in development
if (__DEV__ && AWS_API_GATEWAY_URL === 'https://api.warmpawz.com') {
  console.warn('⚠️ AWS_API_GATEWAY_URL is using placeholder. Set environment variable for production.');
}

// Export for use in API service
export { AWS_API_GATEWAY_URL };

