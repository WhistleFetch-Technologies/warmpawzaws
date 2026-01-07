/**
 * AUTHENTICATION & USER STATE MANAGEMENT SERVICE
 *
 * Handles user creation, login, session management, and state persistence
 *
 * ✅ MIGRATED: All user/vendor/customer lookups now use SQL repositories
 * ❌ NO KV imports allowed for user data
 */
import { User, Session, VendorProfile, CustomerProfile, AdminProfile } from './database-schema';
/**
 * Find or create user by phone number
 * ✅ MIGRATED: Uses SQL repositories instead of KV
 * This is called on every login attempt
 */
export declare function findOrCreateUser(phone: string, role?: 'customer' | 'vendor' | 'admin'): Promise<User>;
/**
 * Get user by phone
 * ✅ MIGRATED: Uses SQL repositories
 */
export declare function getUserByPhone(phone: string): Promise<User | null>;
/**
 * Get user by ID
 * ✅ MIGRATED: Uses SQL repositories
 * ✅ FIX: Also searches by phone if user_id lookup fails (for existing vendors without user_id)
 */
export declare function getUserById(userId: string, phone?: string): Promise<User | null>;
/**
 * Update user
 * ✅ MIGRATED: Uses SQL repositories
 */
export declare function updateUser(userId: string, updates: Partial<User>): Promise<User>;
/**
 * Create a new session for user
 * ✅ MIGRATED TO SQL: Uses SessionsRepository instead of KV
 */
export declare function createUserSession(userId: string, phone: string, role: string): Promise<Session>;
/**
 * Get session by session ID
 * ✅ MIGRATED TO SQL: Uses SessionsRepository instead of KV
 */
export declare function getSession(sessionId: string): Promise<Session | null>;
/**
 * ✅ SECURITY FIX: Get session by user ID
 * ✅ MIGRATED TO SQL: Uses SessionsRepository instead of KV
 */
export declare function getSessionByUserId(userId: string): Promise<Session | null>;
/**
 * Delete session
 * ✅ MIGRATED TO SQL: Uses SessionsRepository instead of KV
 */
export declare function deleteSession(sessionId: string): Promise<void>;
/**
 * ✅ SECURITY FIX: Generate access token for authenticated API calls
 * ✅ MIGRATED TO SQL: Tokens are stored in SQL and validated on each API call
 *
 * Token format: {userId}_{phone}_{timestamp}_{random}
 */
export declare function generateAccessToken(userId: string, phone: string, role: string): Promise<string>;
/**
 * ✅ SECURITY FIX: Validate access token
 * ✅ MIGRATED TO SQL: Returns token data if valid, null if invalid/expired
 */
export declare function validateAccessToken(token: string): Promise<any | null>;
/**
 * Delete (invalidate) access token
 * ✅ MIGRATED TO SQL: Uses AccessTokensRepository instead of KV
 */
export declare function deleteAccessToken(token: string): Promise<void>;
/**
 * Get complete vendor state
 * ✅ MIGRATED: Uses SQL repositories exclusively
 * Returns vendor profile + application status
 */
export declare function getVendorState(userId: string, phone: string): Promise<{
    user: User;
    vendor: VendorProfile | null;
    application: any | null;
    state: 'new' | 'onboarding' | 'pending' | 'approved' | 'rejected' | 'active';
}>;
/**
 * Create or update vendor profile
 * ✅ MIGRATED: Uses SQL repository
 */
export declare function saveVendorProfile(profile: VendorProfile): Promise<VendorProfile>;
/**
 * Get vendor by user ID
 * ✅ MIGRATED: Uses SQL repository
 */
export declare function getVendorByUserId(userId: string): Promise<VendorProfile | null>;
/**
 * Get vendor by phone
 * ✅ MIGRATED: Uses SQL repository
 */
export declare function getVendorByPhone(phone: string): Promise<VendorProfile | null>;
/**
 * Get customer state
 * ✅ MIGRATED: Uses SQL repository
 */
export declare function getCustomerState(userId: string): Promise<{
    user: User;
    customer: CustomerProfile | null;
}>;
/**
 * Create or update customer profile
 * ✅ MIGRATED: Uses SQL repository
 */
export declare function saveCustomerProfile(profile: CustomerProfile): Promise<CustomerProfile>;
/**
 * Get admin state
 * ✅ MIGRATED TO SQL: Uses AdminProfilesRepository instead of KV
 */
export declare function getAdminState(userId: string): Promise<{
    user: User;
    admin: AdminProfile | null;
}>;
/**
 * Create or update admin profile
 * ✅ MIGRATED TO SQL: Uses AdminProfilesRepository instead of KV
 */
export declare function saveAdminProfile(profile: AdminProfile): Promise<AdminProfile>;
//# sourceMappingURL=auth-service.d.ts.map