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
export interface CognitoUser {
    username: string;
    sub: string;
    phone: string;
    email?: string;
    attributes: Record<string, string>;
}
export interface CognitoTokens {
    accessToken: string;
    idToken: string;
    refreshToken: string;
    expiresIn: number;
}
/**
 * Create or get Cognito user by phone number
 */
export declare function getOrCreateCognitoUser(phone: string, email?: string, userType?: 'customer' | 'vendor' | 'admin'): Promise<CognitoUser>;
/**
 * Authenticate user and get tokens
 */
export declare function authenticateCognitoUser(phone: string): Promise<CognitoTokens>;
/**
 * Verify Cognito JWT token
 */
export declare function verifyCognitoToken(token: string): Promise<CognitoUser | null>;
//# sourceMappingURL=cognito-client.d.ts.map