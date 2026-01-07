"use strict";
/**
 * ============================================================================
 * JWT TOKEN VERIFICATION UTILITIES
 * ============================================================================
 *
 * Implements proper JWT signature verification for Cognito tokens
 *
 * Date: 2026-01-03
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyCognitoToken = verifyCognitoToken;
exports.verifyAccessToken = verifyAccessToken;
exports.verifyIdToken = verifyIdToken;
exports.decodeTokenUnsafe = decodeTokenUnsafe;
exports.isTokenExpired = isTokenExpired;
exports.getUserIdFromToken = getUserIdFromToken;
exports.getUserTypeFromToken = getUserTypeFromToken;
exports.extractAndVerifyAuthToken = extractAndVerifyAuthToken;
const jose_1 = require("jose");
// Cache for Cognito public keys
const jwksCache = new Map();
/**
 * Get JWKS URI for Cognito user pool
 */
function getJwksUri(userPoolId, region = 'ap-south-1') {
    return `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;
}
/**
 * Get or create JWKS client for a user pool
 */
function getJwksClient(userPoolId, region = 'ap-south-1') {
    const cacheKey = `${region}:${userPoolId}`;
    if (!jwksCache.has(cacheKey)) {
        const jwksUri = getJwksUri(userPoolId, region);
        jwksCache.set(cacheKey, (0, jose_1.createRemoteJWKSet)(new URL(jwksUri)));
    }
    return jwksCache.get(cacheKey);
}
/**
 * Verify Cognito JWT token with signature validation
 */
async function verifyCognitoToken(token, userPoolId, clientId, region = 'ap-south-1') {
    try {
        // Use environment variables if not provided
        userPoolId = userPoolId || process.env.COGNITO_USER_POOL_ID;
        clientId = clientId || process.env.COGNITO_CLIENT_ID;
        if (!userPoolId) {
            console.error('[JWT] COGNITO_USER_POOL_ID not configured');
            return null;
        }
        // Get JWKS client
        const JWKS = getJwksClient(userPoolId, region);
        // Verify token signature and claims
        const { payload } = await (0, jose_1.jwtVerify)(token, JWKS, {
            issuer: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
            audience: clientId, // Optional: verify audience if client ID provided
        });
        return payload;
    }
    catch (error) {
        console.error('[JWT] Token verification failed:', error.message);
        return null;
    }
}
/**
 * Verify access token
 */
async function verifyAccessToken(accessToken) {
    return verifyCognitoToken(accessToken);
}
/**
 * Verify ID token
 */
async function verifyIdToken(idToken) {
    return verifyCognitoToken(idToken);
}
/**
 * Extract user info from token without verification (for non-critical operations)
 */
function decodeTokenUnsafe(token) {
    try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        return payload;
    }
    catch (error) {
        console.error('[JWT] Token decode failed:', error);
        return null;
    }
}
/**
 * Check if token is expired
 */
function isTokenExpired(token) {
    try {
        const payload = decodeTokenUnsafe(token);
        if (!payload || !payload.exp)
            return true;
        const now = Math.floor(Date.now() / 1000);
        return payload.exp < now;
    }
    catch (error) {
        return true;
    }
}
/**
 * Extract user ID from token (with verification)
 */
async function getUserIdFromToken(token) {
    const payload = await verifyCognitoToken(token);
    return payload?.sub || null;
}
/**
 * Extract user type from token (with verification)
 */
async function getUserTypeFromToken(token) {
    const payload = await verifyCognitoToken(token);
    return payload?.['custom:user_type'] || null;
}
/**
 * Middleware helper to extract and verify auth token from headers
 */
async function extractAndVerifyAuthToken(headers) {
    const authHeader = headers['authorization'] || headers['Authorization'];
    if (!authHeader) {
        return { valid: false, error: 'No authorization header' };
    }
    // Extract token from "Bearer <token>"
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) {
        return { valid: false, error: 'Invalid authorization format' };
    }
    const token = match[1];
    // Check expiry first (fast)
    if (isTokenExpired(token)) {
        return { valid: false, error: 'Token expired' };
    }
    // Verify signature (slower)
    const payload = await verifyCognitoToken(token);
    if (!payload) {
        return { valid: false, error: 'Invalid token signature' };
    }
    return { valid: true, payload };
}
//# sourceMappingURL=jwt-verification.js.map