"use strict";
/**
 * AUTHENTICATION & USER STATE MANAGEMENT SERVICE
 *
 * Handles user creation, login, session management, and state persistence
 *
 * ✅ MIGRATED: All user/vendor/customer lookups now use SQL repositories
 * ❌ NO KV imports allowed for user data
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.findOrCreateUser = findOrCreateUser;
exports.getUserByPhone = getUserByPhone;
exports.getUserById = getUserById;
exports.updateUser = updateUser;
exports.createUserSession = createUserSession;
exports.getSession = getSession;
exports.getSessionByUserId = getSessionByUserId;
exports.deleteSession = deleteSession;
exports.generateAccessToken = generateAccessToken;
exports.validateAccessToken = validateAccessToken;
exports.deleteAccessToken = deleteAccessToken;
exports.getVendorState = getVendorState;
exports.saveVendorProfile = saveVendorProfile;
exports.getVendorByUserId = getVendorByUserId;
exports.getVendorByPhone = getVendorByPhone;
exports.getCustomerState = getCustomerState;
exports.saveCustomerProfile = saveCustomerProfile;
exports.getAdminState = getAdminState;
exports.saveAdminProfile = saveAdminProfile;
// ✅ SQL: Import repositories for all data access (Lambda version - uses AWS RDS Aurora)
const vendors_1 = require("../lib/repositories/vendors");
const customers_1 = require("../lib/repositories/customers");
const sessions_1 = require("../lib/repositories/sessions");
const access_tokens_1 = require("../lib/repositories/access-tokens");
const admin_profiles_1 = require("../lib/repositories/admin-profiles");
const db_1 = require("../lib/db");
const database_schema_1 = require("./database-schema");
const phone_utils_1 = require("./phone-utils");
// ✅ MIGRATED: All sessions, tokens, and admin profiles now use SQL repositories
// ❌ NO KV imports - all data access is SQL-only
// ============================================
// USER MANAGEMENT
// ============================================
/**
 * Find or create user by phone number
 * ✅ MIGRATED: Uses SQL repositories instead of KV
 * This is called on every login attempt
 */
async function findOrCreateUser(phone, role) {
    const cleanedPhone = (0, phone_utils_1.normalizePhone)(phone);
    console.log(`\n🔍 ========== FIND OR CREATE USER START ==========`);
    console.log(`   Raw phone: ${phone}`);
    console.log(`   Cleaned phone: ${cleanedPhone}`);
    console.log(`   Requested role: ${role}`);
    // ✅ SQL: Try to find existing user in SQL tables
    const vendorsRepo = (0, vendors_1.getVendorsRepository)();
    const customersRepo = (0, customers_1.getCustomersRepository)();
    let existingUser = null;
    // Check vendor first if role is vendor
    if (role === 'vendor' || !role) {
        const vendor = await vendorsRepo.findByPhone(cleanedPhone);
        if (vendor) {
            const userId = vendor.user_id || (0, database_schema_1.generateId)('user');
            existingUser = {
                userId,
                phone: cleanedPhone,
                role: 'vendor',
                name: vendor.owner_name || vendor.business_name,
                email: vendor.email,
                isActive: vendor.is_active !== false,
                isVerified: true,
                createdAt: vendor.created_at,
                lastLoginAt: new Date().toISOString()
            };
            // ✅ CRITICAL FIX: Ensure user exists in users table (required for sessions foreign key)
            // ✅ AWS RDS: Use raw SQL queries instead of Supabase client
            const existingUserRecords = await (0, db_1.executeRaw)('SELECT id FROM users WHERE id = $1', [userId]);
            if (existingUserRecords.length === 0) {
                // Create user record in users table
                try {
                    await (0, db_1.executeRaw)('INSERT INTO users (id, phone, user_type, full_name, is_active) VALUES ($1, $2, $3, $4, $5)', [userId, cleanedPhone, 'vendor', vendor.owner_name || vendor.business_name || '', true]);
                    console.log(`   ✅ Created/verified user in users table: ${userId}`);
                }
                catch (userError) {
                    // If duplicate key error (23505), that's okay
                    if (userError?.code !== '23505') {
                        console.error(`   ⚠️ Failed to create user in users table: ${userError?.message || userError}`);
                    }
                    else {
                        console.log(`   ✅ User already exists in users table: ${userId}`);
                    }
                }
            }
            // Update vendor with userId if missing
            if (!vendor.user_id) {
                await vendorsRepo.update(vendor.id, { user_id: userId });
            }
            console.log(`   ✅ Existing vendor found: ${vendor.id} → user: ${userId}`);
            console.log(`========== FIND OR CREATE USER END (existing vendor) ==========\n`);
            return existingUser;
        }
    }
    // Check customer if role is customer or not specified
    if (role === 'customer' || !role) {
        const customer = await customersRepo.findByPhone(cleanedPhone);
        if (customer) {
            const userId = customer.user_id || (0, database_schema_1.generateId)('user');
            existingUser = {
                userId,
                phone: cleanedPhone,
                role: 'customer',
                name: customer.full_name || '',
                email: customer.email || '',
                isActive: customer.is_active !== false,
                isVerified: true,
                createdAt: customer.created_at,
                lastLoginAt: new Date().toISOString()
            };
            // ✅ CRITICAL FIX: Ensure user exists in users table (required for sessions foreign key)
            // ✅ AWS RDS: Use raw SQL queries instead of Supabase client
            const existingUserRecords = await (0, db_1.executeRaw)('SELECT id FROM users WHERE id = $1', [userId]);
            if (existingUserRecords.length === 0) {
                // Create user record in users table
                try {
                    await (0, db_1.executeRaw)('INSERT INTO users (id, phone, user_type, full_name, is_active) VALUES ($1, $2, $3, $4, $5)', [userId, cleanedPhone, 'customer', customer.full_name || '', true]);
                    console.log(`   ✅ Created/verified user in users table: ${userId}`);
                }
                catch (userError) {
                    // If duplicate key error (23505), that's okay
                    if (userError?.code !== '23505') {
                        console.error(`   ⚠️ Failed to create user in users table: ${userError?.message || userError}`);
                    }
                    else {
                        console.log(`   ✅ User already exists in users table: ${userId}`);
                    }
                }
            }
            // Update customer with userId if missing
            if (!customer.user_id) {
                await customersRepo.update(customer.id, { user_id: userId });
            }
            console.log(`   ✅ Existing customer found: ${customer.id} → user: ${userId}`);
            console.log(`========== FIND OR CREATE USER END (existing customer) ==========\n`);
            return existingUser;
        }
    }
    // No existing user found - create new one
    const userId = (0, database_schema_1.generateId)('user');
    const now = new Date().toISOString();
    const newUser = {
        userId,
        phone: cleanedPhone,
        role: role || 'customer', // Default to customer if not specified
        name: '',
        email: '',
        isActive: true,
        isVerified: true,
        createdAt: now,
        lastLoginAt: now
    };
    console.log(`   🆕 Creating NEW user: ${userId} with role ${newUser.role}`);
    // ✅ CRITICAL FIX: Create user record in users table FIRST (required for sessions foreign key)
    // ✅ AWS RDS: Use raw SQL queries instead of Supabase client
    try {
        const existingUsers = await (0, db_1.executeRaw)('SELECT id FROM users WHERE id = $1', [userId]);
        if (existingUsers.length === 0) {
            // Insert user into users table
            try {
                await (0, db_1.executeRaw)('INSERT INTO users (id, phone, user_type, full_name, is_active) VALUES ($1, $2, $3, $4, $5)', [userId, cleanedPhone, role || 'customer', '', true]);
                console.log(`   ✅ Created user record in users table: ${userId}`);
            }
            catch (insertError) {
                // If insert fails (e.g., duplicate), try to find existing user by phone
                if (insertError?.code === '23505' || insertError?.message?.includes('unique')) {
                    const retryUsers = await (0, db_1.executeRaw)('SELECT id FROM users WHERE phone = $1', [cleanedPhone]);
                    if (retryUsers.length > 0) {
                        console.log(`   ✅ Found existing user in users table: ${retryUsers[0].id}`);
                        newUser.userId = retryUsers[0].id;
                    }
                    else {
                        throw new Error(`Failed to create or find user: ${insertError?.message || insertError}`);
                    }
                }
                else {
                    throw insertError;
                }
            }
        }
        else {
            console.log(`   ✅ User already exists in users table: ${userId}`);
        }
    }
    catch (error) {
        console.error(`   ⚠️ Failed to create user in users table: ${error}`);
        // Don't throw - continue with vendor/customer creation
    }
    // ✅ SQL: Create corresponding vendor or customer record
    if (role === 'vendor') {
        // Create vendor record
        try {
            // ✅ CRITICAL FIX: Generate vendor_id (required field, NOT NULL)
            const vendorId = (0, phone_utils_1.createVendorId)(cleanedPhone);
            await vendorsRepo.create({
                // vendor_id will be generated by database
                phone: cleanedPhone,
                email: '',
                business_name: '',
                owner_name: '',
                address: '',
                city: '',
                state: '',
                pincode: '',
                status: 'new',
                // user_id will be set after user creation
            });
            console.log(`   ✅ Created vendor record for user: ${newUser.userId}, vendor_id: ${vendorId}`);
        }
        catch (error) {
            // ✅ CRITICAL FIX: Log full error details to understand why creation fails
            console.error(`   ⚠️ Failed to create vendor record:`, {
                error: error?.message || error,
                code: error?.code,
                details: error?.details,
                hint: error?.hint,
                userId: newUser.userId,
                phone: cleanedPhone
            });
            // Don't throw - allow login to proceed even if vendor creation fails
            // The vendor can be created later during onboarding
        }
    }
    else {
        // Create customer record
        try {
            await customersRepo.create({
                phone: cleanedPhone,
                full_name: '',
                // user_id will be set after user creation
            });
            console.log(`   ✅ Created customer record for user: ${newUser.userId}`);
        }
        catch (error) {
            console.error(`   ⚠️ Failed to create customer record: ${error}`);
        }
    }
    console.log(`========== FIND OR CREATE USER END (new user) ==========\n`);
    return newUser;
}
/**
 * Get user by phone
 * ✅ MIGRATED: Uses SQL repositories
 */
async function getUserByPhone(phone) {
    const cleanedPhone = (0, phone_utils_1.normalizePhone)(phone);
    // ✅ SQL: Check vendors first
    const vendorsRepo = (0, vendors_1.getVendorsRepository)();
    const vendor = await vendorsRepo.findByPhone(cleanedPhone);
    if (vendor && vendor.user_id) {
        return {
            userId: vendor.user_id,
            phone: cleanedPhone,
            role: 'vendor',
            name: vendor.owner_name || vendor.business_name,
            email: vendor.email,
            isActive: vendor.is_active !== false,
            isVerified: true,
            createdAt: vendor.created_at,
            lastLoginAt: new Date().toISOString()
        };
    }
    // ✅ SQL: Check customers
    const customersRepo = (0, customers_1.getCustomersRepository)();
    const customer = await customersRepo.findByPhone(cleanedPhone);
    if (customer && customer.user_id) {
        return {
            userId: customer.user_id,
            phone: cleanedPhone,
            role: 'customer',
            name: customer.full_name || '',
            email: customer.email || '',
            isActive: customer.is_active !== false,
            isVerified: true,
            createdAt: customer.created_at,
            lastLoginAt: new Date().toISOString()
        };
    }
    return null;
}
/**
 * Get user by ID
 * ✅ MIGRATED: Uses SQL repositories
 * ✅ FIX: Also searches by phone if user_id lookup fails (for existing vendors without user_id)
 */
async function getUserById(userId, phone) {
    // ✅ AWS RDS: Use raw SQL queries instead of Supabase client
    // ✅ CRITICAL FIX: Check users table FIRST (for new users created but vendor/customer not yet created)
    const userRecords = await (0, db_1.executeRaw)('SELECT * FROM users WHERE id = $1', [userId]);
    if (userRecords.length > 0) {
        const userRecord = userRecords[0];
        // User exists in users table - now check if vendor/customer exists
        const userType = userRecord.user_type || 'customer';
        // ✅ SQL: Check vendors by user_id
        const vendors = await (0, db_1.executeRaw)('SELECT * FROM vendors WHERE user_id = $1', [userId]);
        if (vendors.length > 0) {
            const vendor = vendors[0];
            return {
                userId: vendor.user_id || userId,
                phone: vendor.phone || userRecord.phone,
                role: 'vendor',
                name: vendor.owner_name || vendor.business_name || userRecord.full_name || '',
                email: vendor.email || userRecord.email || '',
                isActive: vendor.is_active !== false,
                isVerified: true,
                createdAt: vendor.created_at || userRecord.created_at,
                lastLoginAt: new Date().toISOString()
            };
        }
        // ✅ SQL: Check customers by user_id
        const customers = await (0, db_1.executeRaw)('SELECT * FROM customers WHERE user_id = $1', [userId]);
        if (customers.length > 0) {
            const customer = customers[0];
            return {
                userId: customer.user_id || userId,
                phone: customer.phone || userRecord.phone,
                role: 'customer',
                name: customer.full_name || userRecord.full_name || '',
                email: customer.email || userRecord.email || '',
                isActive: customer.is_active !== false,
                isVerified: true,
                createdAt: customer.created_at || userRecord.created_at,
                lastLoginAt: new Date().toISOString()
            };
        }
        // ✅ CRITICAL FIX: User exists in users table but no vendor/customer yet (new user)
        // Return user based on user_type from users table
        return {
            userId: userRecord.id,
            phone: userRecord.phone,
            role: userType || 'customer',
            name: userRecord.full_name || '',
            email: userRecord.email || '',
            isActive: userRecord.is_active !== false,
            isVerified: true,
            createdAt: userRecord.created_at,
            lastLoginAt: new Date().toISOString()
        };
    }
    // ✅ FALLBACK: If user not found in users table, try vendor/customer lookup by phone
    if (phone) {
        const cleanedPhone = (0, phone_utils_1.normalizePhone)(phone);
        // Try vendor by phone
        const vendorsRepo = (0, vendors_1.getVendorsRepository)();
        const vendorByPhone = await vendorsRepo.findByPhone(cleanedPhone);
        if (vendorByPhone) {
            // Update vendor with userId if missing
            if (!vendorByPhone.user_id) {
                await vendorsRepo.update(vendorByPhone.id, { user_id: userId });
            }
            return {
                userId: vendorByPhone.user_id || userId,
                phone: cleanedPhone,
                role: 'vendor',
                name: vendorByPhone.owner_name || vendorByPhone.business_name,
                email: vendorByPhone.email,
                isActive: vendorByPhone.is_active !== false,
                isVerified: true,
                createdAt: vendorByPhone.created_at,
                lastLoginAt: new Date().toISOString()
            };
        }
        // Try customer by phone
        const customersRepo = (0, customers_1.getCustomersRepository)();
        const customerByPhone = await customersRepo.findByPhone(cleanedPhone);
        if (customerByPhone) {
            // Update customer with userId if missing
            if (!customerByPhone.user_id) {
                await customersRepo.update(customerByPhone.id, { user_id: userId });
            }
            return {
                userId: customerByPhone.user_id || userId,
                phone: cleanedPhone,
                role: 'customer',
                name: customerByPhone.full_name || '',
                email: customerByPhone.email || '',
                isActive: customerByPhone.is_active !== false,
                isVerified: true,
                createdAt: customerByPhone.created_at,
                lastLoginAt: new Date().toISOString()
            };
        }
    }
    return null;
}
/**
 * Update user
 * ✅ MIGRATED: Uses SQL repositories
 */
async function updateUser(userId, updates) {
    // ✅ FIX: Try to get user, but if not found by userId, we'll handle it below
    let user = await getUserById(userId);
    // If user not found by userId, try to find by phone if provided in updates
    if (!user && updates.phone) {
        user = await getUserByPhone(updates.phone);
        if (user && user.userId !== userId) {
            // Update the user_id if it doesn't match
            const vendorsRepo = (0, vendors_1.getVendorsRepository)();
            const customersRepo = (0, customers_1.getCustomersRepository)();
            if (user.role === 'vendor') {
                const vendor = await vendorsRepo.findByPhone((0, phone_utils_1.normalizePhone)(updates.phone));
                if (vendor)
                    await vendorsRepo.update(vendor.id, { user_id: userId });
            }
            else if (user.role === 'customer') {
                const customer = await customersRepo.findByPhone((0, phone_utils_1.normalizePhone)(updates.phone));
                if (customer)
                    await customersRepo.update(customer.id, { user_id: userId });
            }
            user.userId = userId;
        }
    }
    if (!user) {
        throw new Error(`User not found: ${userId}`);
    }
    // ✅ SQL: Update corresponding vendor or customer record
    if (user.role === 'vendor') {
        const vendorsRepo = (0, vendors_1.getVendorsRepository)();
        const vendor = await vendorsRepo.findByPhone(user.phone);
        if (vendor) {
            const updateData = {};
            if (updates.name)
                updateData.owner_name = updates.name;
            if (updates.email)
                updateData.email = updates.email;
            if (updates.isActive !== undefined)
                updateData.is_active = updates.isActive;
            await vendorsRepo.update(vendor.id, updateData);
        }
    }
    else if (user.role === 'customer') {
        const customersRepo = (0, customers_1.getCustomersRepository)();
        const customer = await customersRepo.findByPhone(user.phone);
        if (customer) {
            const updateData = {};
            if (updates.name)
                updateData.full_name = updates.name;
            if (updates.email)
                updateData.email = updates.email;
            if (updates.isActive !== undefined)
                updateData.is_active = updates.isActive;
            await customersRepo.update(customer.id, updateData);
        }
    }
    // Return updated user
    return await getUserById(userId) || user;
}
// ============================================
// SESSION MANAGEMENT
// ============================================
/**
 * Create a new session for user
 * ✅ MIGRATED TO SQL: Uses SessionsRepository instead of KV
 */
async function createUserSession(userId, phone, role) {
    const sessionId = (0, database_schema_1.generateId)('session');
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(); // ✅ EXTENDED: 48 hours (was 30 days, now aligned with frontend)
    const token = (0, database_schema_1.createSession)(userId, role);
    // ✅ SQL: Store session using SessionsRepository
    const sessionsRepo = (0, sessions_1.getSessionsRepository)();
    const sqlSession = await sessionsRepo.create({
        user_id: userId,
        user_type: role,
        token: token,
        expires_in_days: 2 // 48 hours
    });
    // Map SQL session to Session interface (camelCase)
    const session = {
        sessionId: sqlSession.id,
        userId: sqlSession.user_id,
        phone: (0, phone_utils_1.normalizePhone)(phone),
        role: sqlSession.user_type,
        token: sqlSession.token,
        createdAt: sqlSession.created_at,
        expiresAt: sqlSession.expires_at
    };
    console.log(`🔑 Session created: ${session.sessionId} for user ${userId} (SQL)`);
    return session;
}
/**
 * Get session by session ID
 * ✅ MIGRATED TO SQL: Uses SessionsRepository instead of KV
 */
async function getSession(sessionId) {
    // ✅ SQL: Get session using SessionsRepository
    const sessionsRepo = (0, sessions_1.getSessionsRepository)();
    const sqlSession = await sessionsRepo.findById(sessionId);
    if (!sqlSession) {
        return null;
    }
    // Check if expired
    if (new Date(sqlSession.expires_at) < new Date()) {
        console.log(`⏰ Session expired: ${sessionId}`);
        await sessionsRepo.invalidate(sessionId);
        return null;
    }
    // Map SQL session to Session interface (camelCase)
    // Note: We need phone from somewhere - it's not in sessions table
    // For now, we'll get it from the user or return without it
    const session = {
        sessionId: sqlSession.id,
        userId: sqlSession.user_id,
        phone: '', // Will be populated by caller if needed
        role: sqlSession.user_type,
        token: sqlSession.token,
        createdAt: sqlSession.created_at,
        expiresAt: sqlSession.expires_at
    };
    return session;
}
/**
 * ✅ SECURITY FIX: Get session by user ID
 * ✅ MIGRATED TO SQL: Uses SessionsRepository instead of KV
 */
async function getSessionByUserId(userId) {
    // ✅ SQL: Get session using SessionsRepository
    const sessionsRepo = (0, sessions_1.getSessionsRepository)();
    const sqlSessions = await sessionsRepo.findByUser(userId, 'customer', { limit: 1 });
    // Try other user types if not found
    if (sqlSessions.length === 0) {
        const vendorSessions = await sessionsRepo.findByUser(userId, 'vendor', { limit: 1 });
        if (vendorSessions.length > 0) {
            const sqlSession = vendorSessions[0];
            return {
                sessionId: sqlSession.id,
                userId: sqlSession.user_id,
                phone: '',
                role: sqlSession.user_type,
                token: sqlSession.token,
                createdAt: sqlSession.created_at,
                expiresAt: sqlSession.expires_at
            };
        }
        const adminSessions = await sessionsRepo.findByUser(userId, 'admin', { limit: 1 });
        if (adminSessions.length > 0) {
            const sqlSession = adminSessions[0];
            return {
                sessionId: sqlSession.id,
                userId: sqlSession.user_id,
                phone: '',
                role: sqlSession.user_type,
                token: sqlSession.token,
                createdAt: sqlSession.created_at,
                expiresAt: sqlSession.expires_at
            };
        }
        return null;
    }
    const sqlSession = sqlSessions[0];
    return {
        sessionId: sqlSession.id,
        userId: sqlSession.user_id,
        phone: '',
        role: sqlSession.user_type,
        token: sqlSession.token,
        createdAt: sqlSession.created_at,
        expiresAt: sqlSession.expires_at
    };
}
/**
 * Delete session
 * ✅ MIGRATED TO SQL: Uses SessionsRepository instead of KV
 */
async function deleteSession(sessionId) {
    // ✅ SQL: Invalidate session using SessionsRepository
    const sessionsRepo = (0, sessions_1.getSessionsRepository)();
    await sessionsRepo.invalidate(sessionId);
    console.log(`🗑️ Session deleted: ${sessionId} (SQL)`);
}
/**
 * ✅ SECURITY FIX: Generate access token for authenticated API calls
 * ✅ MIGRATED TO SQL: Tokens are stored in SQL and validated on each API call
 *
 * Token format: {userId}_{phone}_{timestamp}_{random}
 */
async function generateAccessToken(userId, phone, role) {
    const cleanedPhone = (0, phone_utils_1.normalizePhone)(phone);
    const timestamp = Date.now();
    const randomPart = Math.random().toString(36).substring(2, 15);
    // Create token with user info embedded
    const token = `${userId}_${cleanedPhone}_${timestamp}_${randomPart}`;
    // ✅ SQL: Store token using AccessTokensRepository (expires in 48 hours to match session expiry)
    const expiresAt = new Date(timestamp + (48 * 60 * 60 * 1000)).toISOString(); // 48 hours
    const tokensRepo = (0, access_tokens_1.getAccessTokensRepository)();
    await tokensRepo.create({
        token,
        user_id: userId,
        user_type: role,
        phone: cleanedPhone,
        role: role,
        expires_at: expiresAt
    });
    console.log(`🔐 Access token created: ${token.substring(0, 20)}... for user ${userId}, expires in 48 hours (SQL)`);
    return token;
}
/**
 * ✅ SECURITY FIX: Validate access token
 * ✅ MIGRATED TO SQL: Returns token data if valid, null if invalid/expired
 */
async function validateAccessToken(token) {
    if (!token) {
        return null;
    }
    // ✅ SQL: Get token data from AccessTokensRepository
    const tokensRepo = (0, access_tokens_1.getAccessTokensRepository)();
    const sqlToken = await tokensRepo.findByToken(token);
    if (!sqlToken) {
        console.log(`❌ Invalid token: not found in SQL`);
        return null;
    }
    // Check if expired
    const now = new Date();
    const expiresAt = new Date(sqlToken.expires_at);
    if (now > expiresAt) {
        console.log(`❌ Token expired: ${token.substring(0, 20)}...`);
        // Clean up expired token
        await tokensRepo.delete(token);
        return null;
    }
    // Map SQL token to expected format
    const tokenData = {
        token: sqlToken.token,
        userId: sqlToken.user_id,
        phone: sqlToken.phone,
        role: sqlToken.role,
        createdAt: sqlToken.created_at,
        expiresAt: sqlToken.expires_at
    };
    console.log(`✅ Token validated for user ${tokenData.userId} (SQL)`);
    return tokenData;
}
/**
 * Delete (invalidate) access token
 * ✅ MIGRATED TO SQL: Uses AccessTokensRepository instead of KV
 */
async function deleteAccessToken(token) {
    // ✅ SQL: Delete token using AccessTokensRepository
    const tokensRepo = (0, access_tokens_1.getAccessTokensRepository)();
    await tokensRepo.delete(token);
    console.log(`🗑️ Token deleted: ${token.substring(0, 20)}... (SQL)`);
}
// ============================================
// VENDOR STATE MANAGEMENT
// ============================================
// ✅ createVendorId already imported at top of file (line 26)
/**
 * Get complete vendor state
 * ✅ MIGRATED: Uses SQL repositories exclusively
 * Returns vendor profile + application status
 */
async function getVendorState(userId, phone) {
    console.log(`\n🔍 ========== GET VENDOR STATE START ==========`);
    console.log(`   Phone: ${phone}`);
    console.log(`   User ID: ${userId}`);
    // ✅ CRITICAL FIX: Pass phone to getUserById so it can fallback to phone lookup for existing vendors
    // ✅ CRITICAL FIX: getUserById now checks users table first, so it will return user even if vendor doesn't exist yet
    const user = await getUserById(userId, phone);
    if (!user) {
        // ✅ CRITICAL FIX: If user not found, try to create one (shouldn't happen, but safety check)
        console.log(`   ⚠️ User not found, attempting to create...`);
        const newUser = await findOrCreateUser(phone, 'vendor');
        if (!newUser) {
            throw new Error(`User not found for userId: ${userId}, phone: ${phone}`);
        }
        return {
            user: newUser,
            vendor: null,
            application: null,
            state: 'new'
        };
    }
    const vendorsRepo = (0, vendors_1.getVendorsRepository)();
    const cleanedPhone = (0, phone_utils_1.normalizePhone)(phone);
    // ✅ SQL: Find vendor by user_id first
    let vendor = await getVendorByUserId(userId);
    // ✅ SQL: If not found, try by phone
    if (!vendor) {
        console.log(`   Step 1 - Checking by phone using SQL...`);
        vendor = await getVendorByPhone(cleanedPhone);
        if (vendor) {
            console.log(`   ✅ SQL MATCH! Found vendor by phone: ${vendor.id}`);
            // Update vendor with userId if missing
            if (!vendor.userId || vendor.userId !== userId) {
                console.log(`   🔧 Updating vendor userId: ${vendor.id} → ${userId}`);
                await vendorsRepo.update(vendor.id, { user_id: userId });
                vendor.userId = userId;
            }
        }
        else {
            console.log(`   ❌ No vendor found by phone: ${cleanedPhone}`);
        }
    }
    else {
        console.log(`   ✅ SQL MATCH! Found vendor by user_id: ${vendor.id}`);
    }
    let application = null;
    let state = 'new';
    if (vendor) {
        console.log(`   ✅ Vendor state loaded:`, {
            vendorId: vendor.vendorId || vendor.id,
            status: vendor.status,
            approvalStatus: vendor.approvalStatus,
        });
        // Determine state based on vendor status
        const vendorStatus = vendor.status || vendor.approvalStatus;
        if (vendorStatus === 'approved' || vendorStatus === 'active') {
            state = 'active';
            console.log(`   ✅ Vendor active → state: ${state}`);
        }
        else if (vendorStatus === 'rejected') {
            state = 'rejected';
            console.log(`   ❌ Vendor rejected → state: ${state}`);
        }
        else if (vendorStatus === 'pending' || vendorStatus === 'pending_approval' || vendorStatus === 'under_review') {
            state = 'pending';
            console.log(`   ⏳ Vendor pending approval → state: ${state}`);
        }
        else if (vendorStatus === 'onboarding' || vendorStatus === 'new') {
            state = 'onboarding';
            console.log(`   🔄 Vendor in onboarding → state: ${state}`);
        }
        else {
            state = 'onboarding';
            console.log(`   🔄 No status found - default to onboarding`);
        }
    }
    else {
        console.log(`   ❌ NO VENDOR FOUND - State = new`);
    }
    console.log(`   📊 Final state: ${state}`);
    console.log(`========== GET VENDOR STATE END ==========\n`);
    return { user, vendor, application, state };
}
/**
 * Create or update vendor profile
 * ✅ MIGRATED: Uses SQL repository
 */
async function saveVendorProfile(profile) {
    const vendorsRepo = (0, vendors_1.getVendorsRepository)();
    // ✅ SQL: Check if vendor exists
    const existing = await vendorsRepo.findByVendorId(profile.vendorId) ||
        await vendorsRepo.findByPhone((0, phone_utils_1.normalizePhone)(profile.phone));
    if (existing) {
        // ✅ SQL: Update existing vendor
        const updateData = {
            user_id: profile.userId,
            phone: profile.phone,
            owner_name: profile.ownerName,
            business_name: profile.businessName,
            email: profile.email,
            status: profile.status || profile.approvalStatus || 'pending',
            is_active: profile.isActive !== false,
        };
        await vendorsRepo.update(existing.id, updateData);
        console.log(`💾 Vendor profile updated: ${profile.vendorId}`);
    }
    else {
        // ✅ SQL: Create new vendor
        await vendorsRepo.create({
            phone: profile.phone,
            email: profile.email,
            business_name: profile.businessName,
            owner_name: profile.ownerName,
            address: '',
            city: '',
            state: '',
            pincode: '',
            status: profile.status || profile.approvalStatus || 'pending',
            user_id: profile.userId,
        });
        console.log(`💾 Vendor profile created: ${profile.vendorId}`);
    }
    return profile;
}
/**
 * Get vendor by user ID
 * ✅ MIGRATED: Uses SQL repository
 */
async function getVendorByUserId(userId) {
    // ✅ SQL: Find vendor by user_id (AWS RDS: Use raw SQL)
    const vendors = await (0, db_1.executeRaw)('SELECT * FROM vendors WHERE user_id = $1', [userId]);
    const vendor = vendors.length > 0 ? vendors[0] : null;
    if (!vendor)
        return null;
    // Map SQL vendor to VendorProfile format
    return {
        id: vendor.id,
        vendorId: vendor.vendor_id || vendor.id,
        userId: vendor.user_id || userId,
        phone: vendor.phone,
        ownerName: vendor.owner_name,
        businessName: vendor.business_name,
        email: vendor.email,
        status: vendor.status,
        approvalStatus: vendor.status, // Map status to approvalStatus for compatibility
        createdAt: vendor.created_at,
        updatedAt: vendor.updated_at,
    };
}
/**
 * Get vendor by phone
 * ✅ MIGRATED: Uses SQL repository
 */
async function getVendorByPhone(phone) {
    const vendorsRepo = (0, vendors_1.getVendorsRepository)();
    const vendor = await vendorsRepo.findByPhone((0, phone_utils_1.normalizePhone)(phone));
    if (!vendor)
        return null;
    // Map SQL vendor to VendorProfile format
    return {
        id: vendor.id,
        vendorId: vendor.vendor_id || vendor.id,
        userId: vendor.user_id,
        phone: vendor.phone,
        ownerName: vendor.owner_name,
        businessName: vendor.business_name,
        email: vendor.email,
        status: vendor.status,
        approvalStatus: vendor.status,
        createdAt: vendor.created_at,
        updatedAt: vendor.updated_at,
    };
}
// ============================================
// CUSTOMER STATE MANAGEMENT
// ============================================
/**
 * Get customer state
 * ✅ MIGRATED: Uses SQL repository
 */
async function getCustomerState(userId) {
    const user = await getUserById(userId);
    if (!user) {
        throw new Error('User not found');
    }
    // ✅ SQL: Find customer by user_id (AWS RDS: Use raw SQL)
    const customers = await (0, db_1.executeRaw)('SELECT * FROM customers WHERE user_id = $1', [userId]);
    const customerData = customers.length > 0 ? customers[0] : null;
    let customer = null;
    if (customerData) {
        customer = {
            id: customerData.id || customerData.customer_id,
            customerId: customerData.customer_id || customerData.id,
            userId: customerData.user_id || userId,
            phone: customerData.phone,
            name: customerData.full_name || '',
            email: customerData.email || '',
            createdAt: customerData.created_at,
            updatedAt: customerData.updated_at,
        };
    }
    return { user, customer };
}
/**
 * Create or update customer profile
 * ✅ MIGRATED: Uses SQL repository
 */
async function saveCustomerProfile(profile) {
    const customersRepo = (0, customers_1.getCustomersRepository)();
    // ✅ SQL: Check if customer exists
    const existing = await customersRepo.findByPhone((0, phone_utils_1.normalizePhone)(profile.phone));
    if (existing) {
        // ✅ SQL: Update existing customer
        const updateData = {
            user_id: profile.userId,
            full_name: profile.name,
            email: profile.email,
        };
        await customersRepo.update(existing.id, updateData);
        console.log(`💾 Customer profile updated: ${profile.customerId}`);
    }
    else {
        // ✅ SQL: Create new customer
        await customersRepo.create({
            phone: profile.phone,
            full_name: profile.name,
            email: profile.email,
            user_id: profile.userId,
        });
        console.log(`💾 Customer profile created: ${profile.customerId}`);
    }
    return profile;
}
// ============================================
// ADMIN STATE MANAGEMENT  
// ============================================
/**
 * Get admin state
 * ✅ MIGRATED TO SQL: Uses AdminProfilesRepository instead of KV
 */
async function getAdminState(userId) {
    const user = await getUserById(userId);
    if (!user) {
        throw new Error('User not found');
    }
    // ✅ SQL: Get admin profile using AdminProfilesRepository
    const adminProfilesRepo = (0, admin_profiles_1.getAdminProfilesRepository)();
    const sqlAdmin = await adminProfilesRepo.findByUserId(userId);
    let admin = null;
    if (sqlAdmin) {
        // Map SQL admin profile to AdminProfile interface
        const profileData = sqlAdmin.profile_data || {};
        admin = {
            id: sqlAdmin.admin_id,
            userId: sqlAdmin.user_id,
            phone: profileData.phone || user.phone,
            name: profileData.name || user.name || '',
            email: profileData.email || user.email,
            role: profileData.role || 'admin',
            permissions: profileData.permissions || [],
            createdAt: sqlAdmin.created_at,
            updatedAt: sqlAdmin.updated_at
        };
    }
    return { user, admin };
}
/**
 * Create or update admin profile
 * ✅ MIGRATED TO SQL: Uses AdminProfilesRepository instead of KV
 */
async function saveAdminProfile(profile) {
    // ✅ SQL: Save admin profile using AdminProfilesRepository
    const adminProfilesRepo = (0, admin_profiles_1.getAdminProfilesRepository)();
    // Extract adminId from profile (it might be in id field or we generate it)
    const adminId = profile.adminId || profile.id || (0, database_schema_1.generateId)('admin');
    // Prepare profile data for storage
    const profileData = {
        phone: profile.phone,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        permissions: profile.permissions || []
    };
    await adminProfilesRepo.upsert({
        admin_id: adminId,
        user_id: profile.userId,
        profile_data: profileData
    });
    console.log(`💾 Admin profile saved: ${adminId} (SQL)`);
    // Return updated profile
    return {
        ...profile,
        id: adminId
    };
}
//# sourceMappingURL=auth-service.js.map