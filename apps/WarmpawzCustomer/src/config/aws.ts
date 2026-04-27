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

// API Gateway URLs — kept in code as the resolvable defaults. Never use vanity DNS
// (e.g. *.api.warmpawz.com) here unless those records actually exist; release builds
// crash silently when fallbacks resolve to nothing.
//   Dev  HTTP API: z0b3obweb6.execute-api.ap-south-1.amazonaws.com
//   Prod HTTP API: mss9sa4y01.execute-api.ap-south-1.amazonaws.com
const DEV_AWS_API_GATEWAY_URL = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const PROD_AWS_API_GATEWAY_URL = 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com';

// Customer-web hosts that the native app links into (video consultations,
// prescription deep links, etc). Prefer the canonical custom domain so links
// remain stable when CloudFront IDs change.
//   Dev  customer-web: d2aoyjj8ine0wk.cloudfront.net
//   Prod customer-web: customer.warmpawz.com  (CNAME -> dg69gqp2frh39.cloudfront.net)
const DEV_CUSTOMER_WEB_BASE_URL = 'https://d2aoyjj8ine0wk.cloudfront.net';
const PROD_CUSTOMER_WEB_BASE_URL = 'https://customer.warmpawz.com';

// Get API Gateway URL — env override wins; otherwise pick by build mode.
const AWS_API_GATEWAY_URL =
  process.env.AWS_API_GATEWAY_URL ||
  process.env.EXPO_PUBLIC_API_GATEWAY_URL ||
  (__DEV__ ? DEV_AWS_API_GATEWAY_URL : PROD_AWS_API_GATEWAY_URL);

// ✅ FIXED: API Base URL - NO Supabase path, direct API Gateway access
export const API_BASE_URL = AWS_API_GATEWAY_URL;

// Web app base URL for embedded/redirected video calls + share/deep links.
export const CUSTOMER_WEB_BASE_URL =
  process.env.CUSTOMER_WEB_BASE_URL ||
  process.env.EXPO_PUBLIC_CUSTOMER_WEB_BASE_URL ||
  (__DEV__ ? DEV_CUSTOMER_WEB_BASE_URL : PROD_CUSTOMER_WEB_BASE_URL);

// Validate configuration in development
if (__DEV__) {
  console.log('🔧 [DEV] API Gateway URL:', AWS_API_GATEWAY_URL);
  console.log('🔧 [DEV] Customer Web URL:', CUSTOMER_WEB_BASE_URL);
}

// Export for use in API service
export { AWS_API_GATEWAY_URL };
