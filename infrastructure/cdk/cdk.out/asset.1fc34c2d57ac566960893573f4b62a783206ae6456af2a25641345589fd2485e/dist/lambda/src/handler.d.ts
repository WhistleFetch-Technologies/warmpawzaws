import { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';
/**
 * ============================================================================
 * ENDPOINT REGISTRATIONS
 * ============================================================================
 *
 * Agent 3: Cognito Integration
 * Date: 2025-01-28
 *
 * All endpoints are registered via the endpoint registry system.
 * Endpoints are converted to Node.js and located in src/endpoints/
 *
 * ❌ NO DENO CODE - All endpoints use Node.js imports only
 * ============================================================================
 */
/**
 * Main Lambda Handler
 * Converts API Gateway events to Hono requests
 */
export declare const handler: (event: APIGatewayProxyEventV2, context: Context) => Promise<APIGatewayProxyResultV2>;
//# sourceMappingURL=handler.d.ts.map