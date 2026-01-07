/**
 * ============================================================================
 * MAIN LAMBDA HANDLER
 * ============================================================================
 *
 * Entry point for all API Gateway requests
 * Routes requests to appropriate endpoint handlers
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';
/**
 * Main Lambda handler
 */
export declare const handler: (event: APIGatewayProxyEventV2, context: Context) => Promise<APIGatewayProxyResultV2>;
//# sourceMappingURL=index.d.ts.map