"use strict";
/**
 * ============================================================================
 * AWS COGNITO AUTHENTICATION INTEGRATION
 * ============================================================================
 *
 * Integrates AWS Cognito with the OTP-based authentication system
 *
 * Date: 2026-01-02
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrCreateCognitoUser = getOrCreateCognitoUser;
exports.authenticateCognitoUser = authenticateCognitoUser;
exports.verifyCognitoToken = verifyCognitoToken;
const client_cognito_identity_provider_1 = require("@aws-sdk/client-cognito-identity-provider");
const cognitoClient = new client_cognito_identity_provider_1.CognitoIdentityProviderClient({
    region: process.env.AWS_REGION || 'ap-south-1',
});
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || '';
const CLIENT_ID = process.env.COGNITO_CLIENT_ID || '';
/**
 * Create or get Cognito user by phone number
 */
async function getOrCreateCognitoUser(phone, email, userType = 'customer') {
    const username = `phone_${phone}`;
    try {
        // Try to get existing user
        const getUserResponse = await cognitoClient.send(new client_cognito_identity_provider_1.AdminGetUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: username,
        }));
        const attributes = {};
        getUserResponse.UserAttributes?.forEach(attr => {
            if (attr.Name && attr.Value) {
                attributes[attr.Name] = attr.Value;
            }
        });
        return {
            username,
            sub: attributes['sub'] || '',
            phone: attributes['phone_number'] || phone,
            email: attributes['email'],
            attributes,
        };
    }
    catch (error) {
        if (error.name === 'UserNotFoundException') {
            // Create new user
            return await createCognitoUser(phone, email, userType);
        }
        throw error;
    }
}
/**
 * Create new Cognito user
 */
async function createCognitoUser(phone, email, userType = 'customer') {
    const username = `phone_${phone}`;
    const tempPassword = generateTemporaryPassword();
    // Create user
    const createResponse = await cognitoClient.send(new client_cognito_identity_provider_1.AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: username,
        TemporaryPassword: tempPassword,
        UserAttributes: [
            { Name: 'phone_number', Value: phone },
            { Name: 'phone_number_verified', Value: 'true' },
            ...(email ? [{ Name: 'email', Value: email }, { Name: 'email_verified', Value: 'false' }] : []),
            { Name: 'custom:user_type', Value: userType },
        ],
        MessageAction: 'SUPPRESS', // Don't send email/SMS from Cognito
    }));
    // Set permanent password (bypass FORCE_CHANGE_PASSWORD state)
    const permanentPassword = generatePermanentPassword(phone);
    await cognitoClient.send(new client_cognito_identity_provider_1.AdminSetUserPasswordCommand({
        UserPoolId: USER_POOL_ID,
        Username: username,
        Password: permanentPassword,
        Permanent: true,
    }));
    const sub = createResponse.User?.Attributes?.find(attr => attr.Name === 'sub')?.Value || '';
    return {
        username,
        sub,
        phone,
        email,
        attributes: {
            sub,
            phone_number: phone,
            ...(email && { email }),
            'custom:user_type': userType,
        },
    };
}
/**
 * Authenticate user and get tokens
 */
async function authenticateCognitoUser(phone) {
    const username = `phone_${phone}`;
    const password = generatePermanentPassword(phone);
    const authResponse = await cognitoClient.send(new client_cognito_identity_provider_1.AdminInitiateAuthCommand({
        UserPoolId: USER_POOL_ID,
        ClientId: CLIENT_ID,
        AuthFlow: client_cognito_identity_provider_1.AuthFlowType.ADMIN_NO_SRP_AUTH,
        AuthParameters: {
            USERNAME: username,
            PASSWORD: password,
        },
    }));
    if (!authResponse.AuthenticationResult) {
        throw new Error('Authentication failed');
    }
    return {
        accessToken: authResponse.AuthenticationResult.AccessToken || '',
        idToken: authResponse.AuthenticationResult.IdToken || '',
        refreshToken: authResponse.AuthenticationResult.RefreshToken || '',
        expiresIn: authResponse.AuthenticationResult.ExpiresIn || 3600,
    };
}
/**
 * Generate temporary password for initial user creation
 */
function generateTemporaryPassword() {
    const length = 16;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
}
/**
 * Generate consistent permanent password from phone number
 * Uses HMAC to create deterministic but secure password
 */
function generatePermanentPassword(phone) {
    const crypto = require('crypto');
    const secret = process.env.COGNITO_PASSWORD_SECRET || 'warmpawz-default-secret-change-me';
    const hmac = crypto
        .createHmac('sha256', secret)
        .update(phone)
        .digest('hex');
    // Create password that meets Cognito requirements (min 8 chars, uppercase, lowercase, number, special)
    return `Wp${hmac.substring(0, 12)}!@`;
}
/**
 * Verify Cognito JWT token
 */
async function verifyCognitoToken(token) {
    try {
        // In production, verify JWT signature using Cognito public keys
        // For now, we'll decode without verification (implement proper verification in production)
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        return {
            username: payload['cognito:username'] || '',
            sub: payload.sub || '',
            phone: payload.phone_number || '',
            email: payload.email,
            attributes: payload,
        };
    }
    catch (error) {
        console.error('Token verification failed:', error);
        return null;
    }
}
//# sourceMappingURL=cognito-client.js.map