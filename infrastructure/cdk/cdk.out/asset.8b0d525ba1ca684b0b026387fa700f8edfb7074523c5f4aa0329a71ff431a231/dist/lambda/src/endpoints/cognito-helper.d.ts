/**
 * AWS COGNITO HELPER
 *
 * Provides Cognito integration for authentication
 * Supports Customer, Vendor, and Admin user pools
 */
/**
 * Send OTP via Cognito SMS MFA
 * For Customer and Vendor pools (phone-based auth)
 */
export declare function sendCognitoOTP(phone: string, role: 'customer' | 'vendor'): Promise<{
    session: string;
    challengeName: string;
}>;
/**
 * Verify OTP via Cognito SMS MFA
 */
export declare function verifyCognitoOTP(phone: string, otp: string, session: string, role: 'customer' | 'vendor'): Promise<{
    accessToken: string;
    idToken: string;
    refreshToken: string;
    expiresIn: number;
}>;
/**
 * Admin login with email/password
 */
export declare function adminLogin(email: string, password: string): Promise<{
    accessToken: string;
    idToken: string;
    refreshToken: string;
    expiresIn: number;
}>;
/**
 * Verify Cognito JWT token
 * Validates access token or ID token
 */
export declare function verifyCognitoToken(token: string, role: 'customer' | 'vendor' | 'admin'): Promise<{
    valid: boolean;
    userId?: string;
    username?: string;
    attributes?: Record<string, string>;
}>;
/**
 * Get user by username from Cognito
 */
export declare function getCognitoUser(username: string, role: 'customer' | 'vendor' | 'admin'): Promise<{
    username: string;
    attributes: Record<string, string>;
    enabled: boolean;
    userStatus: string;
} | null>;
/**
 * Create admin user (for manual admin creation)
 */
export declare function createAdminUser(email: string, password: string, name: string): Promise<string>;
//# sourceMappingURL=cognito-helper.d.ts.map