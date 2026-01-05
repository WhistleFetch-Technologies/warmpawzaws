"use strict";
/**
 * AWS COGNITO HELPER
 *
 * Provides Cognito integration for authentication
 * Supports Customer, Vendor, and Admin user pools
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendCognitoOTP = sendCognitoOTP;
exports.verifyCognitoOTP = verifyCognitoOTP;
exports.adminLogin = adminLogin;
exports.verifyCognitoToken = verifyCognitoToken;
exports.getCognitoUser = getCognitoUser;
exports.createAdminUser = createAdminUser;
const client_cognito_identity_provider_1 = require("@aws-sdk/client-cognito-identity-provider");
// User pool IDs from environment variables (set by CDK)
const CUSTOMER_USER_POOL_ID = process.env.COGNITO_CUSTOMER_USER_POOL_ID || '';
const VENDOR_USER_POOL_ID = process.env.COGNITO_VENDOR_USER_POOL_ID || '';
const ADMIN_USER_POOL_ID = process.env.COGNITO_ADMIN_USER_POOL_ID || '';
const COGNITO_REGION = process.env.AWS_REGION || 'ap-south-1';
// Client IDs from environment variables
const CUSTOMER_CLIENT_ID = process.env.COGNITO_CUSTOMER_CLIENT_ID || '';
const VENDOR_CLIENT_ID = process.env.COGNITO_VENDOR_CLIENT_ID || '';
const ADMIN_CLIENT_ID = process.env.COGNITO_ADMIN_CLIENT_ID || '';
// Create Cognito client
function getCognitoClient() {
    return new client_cognito_identity_provider_1.CognitoIdentityProviderClient({
        region: COGNITO_REGION,
    });
}
/**
 * Get user pool ID and client ID based on role
 */
function getPoolConfig(role) {
    switch (role) {
        case 'customer':
            return {
                userPoolId: CUSTOMER_USER_POOL_ID,
                clientId: CUSTOMER_CLIENT_ID,
            };
        case 'vendor':
            return {
                userPoolId: VENDOR_USER_POOL_ID,
                clientId: VENDOR_CLIENT_ID,
            };
        case 'admin':
            return {
                userPoolId: ADMIN_USER_POOL_ID,
                clientId: ADMIN_CLIENT_ID,
            };
        default:
            throw new Error(`Invalid role: ${role}`);
    }
}
/**
 * Send OTP via Cognito SMS MFA
 * For Customer and Vendor pools (phone-based auth)
 */
async function sendCognitoOTP(phone, role) {
    const client = getCognitoClient();
    const { userPoolId, clientId } = getPoolConfig(role);
    try {
        // Check if user exists, if not create them
        let username = phone;
        // Try to initiate auth (will create user if doesn't exist with self-signup enabled)
        const initiateCommand = new client_cognito_identity_provider_1.InitiateAuthCommand({
            AuthFlow: client_cognito_identity_provider_1.AuthFlowType.CUSTOM_AUTH,
            ClientId: clientId,
            AuthParameters: {
                USERNAME: username,
            },
        });
        const response = await client.send(initiateCommand);
        if (response.ChallengeName === 'CUSTOM_CHALLENGE') {
            // Respond to custom challenge to trigger SMS
            const challengeCommand = new client_cognito_identity_provider_1.RespondToAuthChallengeCommand({
                ClientId: clientId,
                ChallengeName: 'CUSTOM_CHALLENGE',
                Session: response.Session,
                ChallengeResponses: {
                    USERNAME: username,
                    ANSWER: 'SMS', // Trigger SMS delivery
                },
            });
            const challengeResponse = await client.send(challengeCommand);
            if (challengeResponse.ChallengeName === 'SMS_MFA') {
                return {
                    session: challengeResponse.Session || '',
                    challengeName: 'SMS_MFA',
                };
            }
        }
        // If already in SMS_MFA challenge, return session
        if (response.ChallengeName === 'SMS_MFA' && response.Session) {
            return {
                session: response.Session,
                challengeName: 'SMS_MFA',
            };
        }
        throw new Error('Failed to initiate SMS MFA challenge');
    }
    catch (error) {
        // If user doesn't exist, create them first
        if (error.name === 'UserNotFoundException' || error.name === 'ResourceNotFoundException') {
            // Sign up new user
            const signUpCommand = new client_cognito_identity_provider_1.SignUpCommand({
                ClientId: clientId,
                Username: phone,
                Password: generateTemporaryPassword(),
                UserAttributes: [
                    { Name: 'phone_number', Value: phone },
                ],
            });
            await client.send(signUpCommand);
            // Auto-confirm phone (since autoVerify is enabled in CDK)
            // Retry auth initiation
            return sendCognitoOTP(phone, role);
        }
        console.error('❌ [COGNITO] Error sending OTP:', error);
        throw error;
    }
}
/**
 * Verify OTP via Cognito SMS MFA
 */
async function verifyCognitoOTP(phone, otp, session, role) {
    const client = getCognitoClient();
    const { clientId } = getPoolConfig(role);
    try {
        const command = new client_cognito_identity_provider_1.RespondToAuthChallengeCommand({
            ClientId: clientId,
            ChallengeName: 'SMS_MFA',
            Session: session,
            ChallengeResponses: {
                USERNAME: phone,
                SMS_MFA_CODE: otp,
            },
        });
        const response = await client.send(command);
        if (!response.AuthenticationResult) {
            throw new Error('Authentication failed - no tokens returned');
        }
        return {
            accessToken: response.AuthenticationResult.AccessToken || '',
            idToken: response.AuthenticationResult.IdToken || '',
            refreshToken: response.AuthenticationResult.RefreshToken || '',
            expiresIn: response.AuthenticationResult.ExpiresIn || 3600,
        };
    }
    catch (error) {
        console.error('❌ [COGNITO] Error verifying OTP:', error);
        throw error;
    }
}
/**
 * Admin login with email/password
 */
async function adminLogin(email, password) {
    const client = getCognitoClient();
    const { userPoolId, clientId } = getPoolConfig('admin');
    try {
        const command = new client_cognito_identity_provider_1.AdminInitiateAuthCommand({
            UserPoolId: userPoolId,
            ClientId: clientId,
            AuthFlow: client_cognito_identity_provider_1.AuthFlowType.ADMIN_NO_SRP_AUTH,
            AuthParameters: {
                USERNAME: email,
                PASSWORD: password,
            },
        });
        const response = await client.send(command);
        if (!response.AuthenticationResult) {
            throw new Error('Authentication failed - no tokens returned');
        }
        return {
            accessToken: response.AuthenticationResult.AccessToken || '',
            idToken: response.AuthenticationResult.IdToken || '',
            refreshToken: response.AuthenticationResult.RefreshToken || '',
            expiresIn: response.AuthenticationResult.ExpiresIn || 3600,
        };
    }
    catch (error) {
        console.error('❌ [COGNITO] Error in admin login:', error);
        throw error;
    }
}
/**
 * Verify Cognito JWT token
 * Validates access token or ID token
 */
async function verifyCognitoToken(token, role) {
    const client = getCognitoClient();
    const { userPoolId } = getPoolConfig(role);
    try {
        // Decode JWT to get username (without verification for now)
        // In production, verify JWT signature using Cognito's public keys
        const parts = token.split('.');
        if (parts.length !== 3) {
            return { valid: false };
        }
        // Decode payload (base64url)
        const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))));
        // Check expiration
        if (payload.exp && payload.exp < Date.now() / 1000) {
            return { valid: false };
        }
        // Get user details from Cognito
        const command = new client_cognito_identity_provider_1.AdminGetUserCommand({
            UserPoolId: userPoolId,
            Username: payload.sub || payload['cognito:username'] || '',
        });
        const userResponse = await client.send(command);
        // Convert attributes to object
        const attributes = {};
        userResponse.UserAttributes?.forEach(attr => {
            if (attr.Name && attr.Value) {
                attributes[attr.Name] = attr.Value;
            }
        });
        return {
            valid: true,
            userId: userResponse.Username,
            username: userResponse.Username,
            attributes,
        };
    }
    catch (error) {
        console.error('❌ [COGNITO] Error verifying token:', error);
        return { valid: false };
    }
}
/**
 * Get user by username from Cognito
 */
async function getCognitoUser(username, role) {
    const client = getCognitoClient();
    const { userPoolId } = getPoolConfig(role);
    try {
        const command = new client_cognito_identity_provider_1.AdminGetUserCommand({
            UserPoolId: userPoolId,
            Username: username,
        });
        const response = await client.send(command);
        const attributes = {};
        response.UserAttributes?.forEach(attr => {
            if (attr.Name && attr.Value) {
                attributes[attr.Name] = attr.Value;
            }
        });
        return {
            username: response.Username || '',
            attributes,
            enabled: response.Enabled || false,
            userStatus: response.UserStatus || 'UNKNOWN',
        };
    }
    catch (error) {
        console.error('❌ [COGNITO] Error getting user:', error);
        return null;
    }
}
/**
 * Create admin user (for manual admin creation)
 */
async function createAdminUser(email, password, name) {
    const client = getCognitoClient();
    const { userPoolId } = getPoolConfig('admin');
    try {
        // Create user
        const createCommand = new client_cognito_identity_provider_1.AdminCreateUserCommand({
            UserPoolId: userPoolId,
            Username: email,
            UserAttributes: [
                { Name: 'email', Value: email },
                { Name: 'email_verified', Value: 'true' },
                { Name: 'name', Value: name },
            ],
            MessageAction: 'SUPPRESS', // Don't send welcome email
            TemporaryPassword: password,
        });
        const createResponse = await client.send(createCommand);
        if (!createResponse.User?.Username) {
            throw new Error('Failed to create admin user');
        }
        // Set permanent password
        const setPasswordCommand = new client_cognito_identity_provider_1.AdminSetUserPasswordCommand({
            UserPoolId: userPoolId,
            Username: createResponse.User.Username,
            Password: password,
            Permanent: true,
        });
        await client.send(setPasswordCommand);
        return createResponse.User.Username;
    }
    catch (error) {
        console.error('❌ [COGNITO] Error creating admin user:', error);
        throw error;
    }
}
/**
 * Generate temporary password for new users
 */
function generateTemporaryPassword() {
    // Generate a secure random password
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 16; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}
//# sourceMappingURL=cognito-helper.js.map