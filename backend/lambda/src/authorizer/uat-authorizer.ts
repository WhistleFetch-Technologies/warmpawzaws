/**
 * Lambda Authorizer for API Gateway
 * Supports both Cognito JWT tokens and UAT mode tokens
 */

import { APIGatewayRequestAuthorizerEvent, APIGatewayAuthorizerResult, Context } from 'aws-lambda';
import { verifyCognitoToken } from '../utils/jwt-verification';

/**
 * Generate IAM policy for API Gateway
 */
function generatePolicy(
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string,
  context?: Record<string, any>
): APIGatewayAuthorizerResult {
  const policy: APIGatewayAuthorizerResult = {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    },
  };

  if (context) {
    policy.context = context;
  }

  return policy;
}

/**
 * Lambda Authorizer Handler
 * 
 * Supports:
 * 1. Cognito JWT tokens (normal authentication)
 * 2. UAT mode tokens (development/testing)
 */
export const authorizer = async (
  event: APIGatewayRequestAuthorizerEvent,
  context: Context
): Promise<APIGatewayAuthorizerResult> => {
  console.log('🔐 Authorizer invoked:', {
    method: event.httpMethod,
    path: event.path,
    headers: Object.keys(event.headers || {}),
  });

  try {
    // Get authorization header
    const authHeader = event.headers?.Authorization || 
                       event.headers?.authorization ||
                       event.multiValueHeaders?.Authorization?.[0] ||
                       event.multiValueHeaders?.authorization?.[0];

    // Get UAT mode header
    const uatMode = event.headers?.['X-UAT-Mode'] === 'true' ||
                    event.headers?.['x-uat-mode'] === 'true' ||
                    event.multiValueHeaders?.['X-UAT-Mode']?.[0] === 'true' ||
                    event.multiValueHeaders?.['x-uat-mode']?.[0] === 'true';

    const uatToken = event.headers?.['X-UAT-Token'] ||
                     event.headers?.['x-uat-token'] ||
                     event.multiValueHeaders?.['X-UAT-Token']?.[0] ||
                     event.multiValueHeaders?.['x-uat-token']?.[0];

    // UAT Mode: Allow requests with valid UAT token
    if (uatMode && uatToken && uatToken.startsWith('uat-token-')) {
      console.log('🔧 [UAT Mode] Allowing request with UAT token');
      
      // Extract token from Authorization header if present, otherwise use UAT token
      const token = authHeader?.replace(/^Bearer /i, '') || uatToken;
      
      return generatePolicy(
        'uat-admin-user',
        'Allow',
        event.methodArn,
        {
          userId: 'uat-admin-user',
          email: 'admin@warmpawz.com',
          userType: 'admin',
          uatMode: 'true',
          token: token,
        }
      );
    }

    // Normal Mode: Validate Cognito JWT token
    if (!authHeader) {
      console.log('❌ No authorization header');
      return generatePolicy('user', 'Deny', event.methodArn);
    }

    // Extract token from "Bearer <token>"
    const tokenMatch = authHeader.match(/^Bearer (.+)$/i);
    if (!tokenMatch) {
      console.log('❌ Invalid authorization format');
      return generatePolicy('user', 'Deny', event.methodArn);
    }

    const token = tokenMatch[1];

    // Verify Cognito JWT token
    const payload = await verifyCognitoToken(token);
    if (!payload) {
      console.log('❌ Invalid or expired Cognito token');
      return generatePolicy('user', 'Deny', event.methodArn);
    }

    // Extract user info from token
    const userId = payload.sub || (payload as any)['cognito:username'] || 'unknown';
    const email = payload.email || (payload as any)['cognito:email'] || '';
    const cognitoGroups = (payload as any)['cognito:groups'] || [];
    const userType = (payload as any)['custom:user_type'] || (Array.isArray(cognitoGroups) ? cognitoGroups[0] : '') || '';

    console.log('✅ Valid Cognito token:', { userId, email, userType });

    return generatePolicy(
      userId,
      'Allow',
      event.methodArn,
      {
        userId,
        email,
        userType,
        sub: payload.sub,
      }
    );
  } catch (error) {
    console.error('❌ Authorizer error:', error);
    return generatePolicy('user', 'Deny', event.methodArn);
  }
};

