import { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';
/**
 * ============================================================================
 * ENDPOINT REGISTRATIONS
 * ============================================================================
 *
 * Agent 2: Lambda Migration Agent
 * Date: 2025-01-27
 *
 * NOTE: Endpoint files currently use Deno imports (npm:hono@4, jsr:)
 * These will be converted to Node.js imports in Week 10-11.
 *
 * For now, endpoint registrations are commented out until Deno conversion.
 * ============================================================================
 */
/**
 * Main Lambda Handler
 * Converts API Gateway events to Hono requests
 */
export declare const handler: (event: APIGatewayProxyEventV2, context: Context) => Promise<APIGatewayProxyResultV2>;
//# sourceMappingURL=handler.d.ts.map