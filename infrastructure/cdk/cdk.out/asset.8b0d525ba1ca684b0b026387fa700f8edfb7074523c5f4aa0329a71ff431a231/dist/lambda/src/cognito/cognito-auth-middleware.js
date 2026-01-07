"use strict";
/**
 * COGNITO AUTHENTICATION MIDDLEWARE (Lambda Version)
 *
 * Validates Cognito JWT tokens for protected routes in AWS Lambda
 * Replaces Supabase Auth validation
 *
 * Database: Aurora RDS PostgreSQL (via RDS Proxy)
 * Compute: AWS Lambda (Node.js 20.x)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCognitoAuth = validateCognitoAuth;
exports.requireCognitoAuth = requireCognitoAuth;
exports.requireAdminCognitoAuth = requireAdminCognitoAuth;
exports.optionalCognitoAuth = optionalCognitoAuth;
exports.getAuthenticatedUser = getAuthenticatedUser;
const response_utils_1 = require("../endpoints/response-utils");
const cognitoHelper = __importStar(require("./cognito-helper"));
/**
 * Extract role from token or request context
 */
function extractRole(c) {
    // Try to get role from header
    const roleHeader = c.req.header('X-User-Role');
    if (roleHeader && ['customer', 'vendor', 'admin'].includes(roleHeader)) {
        return roleHeader;
    }
    // Try to get from token claims (if available)
    const tokenData = c.get('tokenData');
    if (tokenData?.role) {
        return tokenData.role;
    }
    // Default to customer if no role specified
    return null;
}
/**
 * Validate Cognito JWT token from Authorization header
 * Returns token data if valid, null otherwise
 */
async function validateCognitoAuth(c) {
    try {
        const authHeader = c.req.header('Authorization');
        if (!authHeader) {
            return { valid: false };
        }
        // Extract bearer token
        const token = authHeader.replace('Bearer ', '').trim();
        if (!token) {
            return { valid: false };
        }
        // Extract role from context or header
        const role = extractRole(c);
        if (!role) {
            // Try to infer role from token claims
            // Decode JWT to check claims
            const parts = token.split('.');
            if (parts.length === 3) {
                try {
                    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
                    // Check if token has custom:role claim
                    if (payload['custom:role']) {
                        const tokenRole = payload['custom:role'];
                        if (['customer', 'vendor', 'admin'].includes(tokenRole)) {
                            return await validateCognitoAuthWithRole(c, token, tokenRole);
                        }
                    }
                }
                catch (e) {
                    // Invalid JWT format
                }
            }
            // Default to admin for backward compatibility
            return await validateCognitoAuthWithRole(c, token, 'admin');
        }
        return await validateCognitoAuthWithRole(c, token, role);
    }
    catch (error) {
        console.error('[COGNITO-AUTH] Error validating token:', error);
        return { valid: false };
    }
}
/**
 * Validate Cognito token with specific role
 */
async function validateCognitoAuthWithRole(c, token, role) {
    try {
        const verification = await cognitoHelper.verifyCognitoToken(token, role);
        if (!verification.valid) {
            return { valid: false };
        }
        // Store token data in context for use in handlers
        c.set('tokenData', {
            userId: verification.userId,
            username: verification.username,
            role,
            attributes: verification.attributes,
        });
        return {
            valid: true,
            userId: verification.userId,
            username: verification.username,
            role,
            attributes: verification.attributes,
        };
    }
    catch (error) {
        console.error('[COGNITO-AUTH] Error validating token with role:', error);
        return { valid: false };
    }
}
/**
 * Middleware to require authentication for protected routes
 */
async function requireCognitoAuth(c, next) {
    const authResult = await validateCognitoAuth(c);
    if (!authResult.valid) {
        return (0, response_utils_1.sendError)(c, 'Authentication required. Supply valid Cognito token in Authorization header', 401);
    }
    await next();
}
/**
 * Middleware to require admin authentication
 */
async function requireAdminCognitoAuth(c, next) {
    const authResult = await validateCognitoAuth(c);
    if (!authResult.valid) {
        return (0, response_utils_1.sendError)(c, 'Authentication required. Supply valid Cognito admin token', 401);
    }
    if (authResult.role !== 'admin') {
        return (0, response_utils_1.sendError)(c, 'Admin access required', 403);
    }
    await next();
}
/**
 * Optional auth - sets auth status but doesn't fail if missing
 */
async function optionalCognitoAuth(c, next) {
    const authResult = await validateCognitoAuth(c);
    c.set('isAuthenticated', authResult.valid);
    c.set('authData', authResult);
    await next();
}
/**
 * Get authenticated user from context
 */
function getAuthenticatedUser(c) {
    const tokenData = c.get('tokenData');
    if (!tokenData) {
        return null;
    }
    return {
        userId: tokenData.userId,
        username: tokenData.username,
        role: tokenData.role,
        attributes: tokenData.attributes,
    };
}
//# sourceMappingURL=cognito-auth-middleware.js.map