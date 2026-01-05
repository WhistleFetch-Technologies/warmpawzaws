"use strict";
/**
 * AUTHENTICATION ENDPOINTS
 *
 * Complete auth flow for all three portals
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
exports.registerAuthEndpoints = registerAuthEndpoints;
const authService = __importStar(require("./auth-service"));
const otp_1 = require("../lib/repositories/otp");
const vendors_1 = require("../lib/repositories/vendors");
const customers_1 = require("../lib/repositories/customers");
const db_1 = require("../lib/db");
const client_sns_1 = require("@aws-sdk/client-sns");
const response_utils_1 = require("./response-utils");
// ✅ FIXED: Use Lambda Cognito helper (correct path)
const cognitoHelper = __importStar(require("../cognito/cognito-helper"));
function registerAuthEndpoints(app) {
    // ✅ CORS: Explicit OPTIONS handler for auth/send-otp
    app.options("/make-server-3dd53475/auth/send-otp", async (c) => {
        c.header('Access-Control-Allow-Origin', '*');
        c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
        c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
        c.header('Access-Control-Max-Age', '86400');
        return new Response(null, { status: 204, headers: c.res.headers });
    });
    // ============================================
    // OTP SERVICE (COGNITO SMS MFA)
    // ============================================
    app.post("/make-server-3dd53475/auth/send-otp", async (c) => {
        try {
            const { phone, role = 'customer' } = await c.req.json();
            if (!phone) {
                return (0, response_utils_1.sendError)(c, 'Phone number required', 400);
            }
            // Validate role
            if (role !== 'customer' && role !== 'vendor') {
                return (0, response_utils_1.sendError)(c, 'Invalid role. Must be customer or vendor', 400);
            }
            console.log(`🔐 [AUTH] Sending OTP via Cognito SMS MFA for ${phone} (${role})`);
            try {
                // Use Cognito SMS MFA to send OTP
                const cognitoResponse = await cognitoHelper.sendCognitoOTP(phone, role);
                console.log('✅ [AUTH] Cognito SMS MFA challenge initiated');
                // Store session for OTP verification
                // Note: Cognito handles OTP generation and SMS delivery
                await (0, otp_1.getOtpRepository)().create({
                    phone,
                    otp_code: 'COGNITO_MFA', // Placeholder - actual OTP is handled by Cognito
                    otp_type: 'login',
                    expires_in_minutes: 5,
                    max_attempts: 3,
                    // Note: metadata not in CreateOtpInput - storing session/challenge separately if needed
                });
                return (0, response_utils_1.sendSuccess)(c, {
                    session: cognitoResponse.session,
                    challengeName: cognitoResponse.challengeName,
                    message: 'OTP sent via Cognito SMS MFA',
                });
            }
            catch (cognitoError) {
                console.error('❌ [AUTH] Cognito SMS MFA failed:', cognitoError);
                // Fallback to legacy SNS if Cognito fails
                console.log('⚠️ [AUTH] Falling back to legacy SNS...');
                const otp = Math.floor(100000 + Math.random() * 900000).toString();
                // Store OTP using repository
                await (0, otp_1.getOtpRepository)().create({
                    phone,
                    otp_code: otp,
                    otp_type: 'login',
                    expires_in_minutes: 5,
                    max_attempts: 3,
                });
                // Fetch AWS Settings from platform_settings table (AWS RDS: Use raw SQL)
                // executeRaw already imported at top
                const awsSettingsRecords = await (0, db_1.executeRaw)('SELECT setting_value FROM platform_settings WHERE setting_key = $1', ['admin:settings:aws']);
                const awsSettings = awsSettingsRecords.length > 0 ? awsSettingsRecords[0].setting_value : null;
                if (awsSettings?.sns?.enabled && awsSettings?.credentials?.accessKeyId) {
                    try {
                        console.log('📨 [AUTH] Sending SMS via AWS SNS (fallback)...');
                        const snsClient = new client_sns_1.SNSClient({
                            region: awsSettings.sns.region || 'ap-south-1',
                            credentials: {
                                accessKeyId: awsSettings.credentials.accessKeyId,
                                secretAccessKey: awsSettings.credentials.secretAccessKey
                            }
                        });
                        const command = new client_sns_1.PublishCommand({
                            PhoneNumber: phone,
                            Message: `Your Warmpawz verification code is: ${otp}. Valid for 5 minutes.`,
                            MessageAttributes: {
                                'AWS.SNS.SMS.SMSType': {
                                    DataType: 'String',
                                    StringValue: 'Transactional'
                                }
                            }
                        });
                        await snsClient.send(command);
                        console.log('✅ [AUTH] SMS sent successfully via SNS (fallback)');
                        return (0, response_utils_1.sendSuccess)(c, { debug_otp: otp }, 'OTP sent via SMS (fallback mode)');
                    }
                    catch (err) {
                        console.error('❌ [AUTH] SNS fallback also failed:', err);
                    }
                }
                // Final fallback - mock mode
                console.log('⚠️ [AUTH] All SMS methods failed. OTP logged to console only.');
                return (0, response_utils_1.sendSuccess)(c, { debug_otp: otp }, 'OTP sent (Mock Mode)');
            }
        }
        catch (error) {
            console.error('❌ [AUTH] Send OTP error:', error);
            return (0, response_utils_1.sendError)(c, error instanceof Error ? error : new Error(String(error)), 500);
        }
    });
    // ============================================
    // COGNITO OTP VERIFICATION
    // ============================================
    app.post("/make-server-3dd53475/auth/verify-otp-cognito", async (c) => {
        try {
            const { phone, otp, session, role = 'customer' } = await c.req.json();
            if (!phone || !otp || !session) {
                return (0, response_utils_1.sendError)(c, 'Phone, OTP, and session are required', 400);
            }
            if (role !== 'customer' && role !== 'vendor') {
                return (0, response_utils_1.sendError)(c, 'Invalid role. Must be customer or vendor', 400);
            }
            console.log(`🔐 [AUTH] Verifying OTP via Cognito for ${phone} (${role})`);
            try {
                // Verify OTP with Cognito
                const tokens = await cognitoHelper.verifyCognitoOTP(phone, otp, session, role);
                console.log('✅ [AUTH] Cognito OTP verified successfully');
                // Find or create user in our system
                const user = await authService.findOrCreateUser(phone, role);
                // Create session
                const userSession = await authService.createUserSession(user.userId, user.phone, user.role);
                // Generate access token
                const accessToken = await authService.generateAccessToken(user.userId, user.phone, user.role);
                // Get role-specific state
                let profileData = null;
                let currentState = 'new';
                if (role === 'vendor') {
                    const vendorState = await authService.getVendorState(user.userId, user.phone);
                    profileData = vendorState.vendor;
                    currentState = vendorState.state;
                }
                else if (role === 'customer') {
                    const customerState = await authService.getCustomerState(user.userId);
                    profileData = customerState.customer;
                    currentState = customerState.customer ? 'active' : 'new';
                }
                return (0, response_utils_1.sendSuccess)(c, {
                    session: {
                        sessionId: userSession.sessionId,
                        userId: userSession.userId,
                        phone: userSession.phone,
                        role: userSession.role,
                        expiresAt: userSession.expiresAt,
                        accessToken: accessToken,
                        cognitoTokens: {
                            accessToken: tokens.accessToken,
                            idToken: tokens.idToken,
                            refreshToken: tokens.refreshToken,
                            expiresIn: tokens.expiresIn,
                        },
                    },
                    user: {
                        userId: user.userId,
                        phone: user.phone,
                        role: user.role,
                        name: user.name,
                        email: user.email,
                        isActive: user.isActive,
                    },
                    profile: profileData,
                    state: currentState,
                });
            }
            catch (cognitoError) {
                console.error('❌ [AUTH] Cognito OTP verification failed:', cognitoError);
                return (0, response_utils_1.sendError)(c, `OTP verification failed: ${cognitoError.message}`, 400);
            }
        }
        catch (error) {
            console.error('❌ [AUTH] Verify OTP error:', error);
            return (0, response_utils_1.sendError)(c, error instanceof Error ? error : new Error(String(error)), 500);
        }
    });
    // ============================================
    // ADMIN LOGIN (COGNITO)
    // ============================================
    app.post("/make-server-3dd53475/auth/admin/login", async (c) => {
        try {
            const { email, password } = await c.req.json();
            if (!email || !password) {
                return (0, response_utils_1.sendError)(c, 'Email and password required', 400);
            }
            console.log(`🔐 [AUTH] Admin login attempt for ${email}`);
            try {
                // Use Cognito for admin authentication
                const tokens = await cognitoHelper.adminLogin(email, password);
                console.log('✅ [AUTH] Admin Cognito login successful');
                // Get or create admin user in our system
                // Note: Admin users should be pre-created in Cognito
                const cognitoUser = await cognitoHelper.getCognitoUser(email, 'admin');
                if (!cognitoUser) {
                    return (0, response_utils_1.sendError)(c, 'Admin user not found in Cognito', 404);
                }
                // Find or create user in our system
                const phone = cognitoUser.attributes['phone_number'] || cognitoUser.attributes['phoneNumber'] || '';
                const user = await authService.findOrCreateUser(phone || email, 'admin');
                // Create session
                const session = await authService.createUserSession(user.userId, user.phone || email, user.role);
                // Generate access token
                const accessToken = await authService.generateAccessToken(user.userId, user.phone || email, user.role);
                // Get admin state
                const adminState = await authService.getAdminState(user.userId);
                return (0, response_utils_1.sendSuccess)(c, {
                    session: {
                        sessionId: session.sessionId,
                        userId: session.userId,
                        phone: session.phone,
                        role: session.role,
                        expiresAt: session.expiresAt,
                        accessToken: accessToken,
                        cognitoTokens: {
                            accessToken: tokens.accessToken,
                            idToken: tokens.idToken,
                            refreshToken: tokens.refreshToken,
                            expiresIn: tokens.expiresIn,
                        },
                    },
                    user: {
                        userId: user.userId,
                        phone: user.phone || email,
                        role: user.role,
                        name: cognitoUser.attributes['name'] || user.name,
                        email: email,
                        isActive: user.isActive,
                    },
                    profile: adminState.admin,
                    state: adminState.admin ? 'active' : 'new',
                });
            }
            catch (cognitoError) {
                console.error('❌ [AUTH] Admin Cognito login failed:', cognitoError);
                // Check for specific error types
                if (cognitoError.name === 'NotAuthorizedException') {
                    return (0, response_utils_1.sendError)(c, 'Invalid email or password', 401);
                }
                if (cognitoError.name === 'UserNotFoundException') {
                    return (0, response_utils_1.sendError)(c, 'Admin user not found', 404);
                }
                return (0, response_utils_1.sendError)(c, `Login failed: ${cognitoError.message}`, 500);
            }
        }
        catch (error) {
            console.error('❌ [AUTH] Admin login error:', error);
            return (0, response_utils_1.sendError)(c, error instanceof Error ? error : new Error(String(error)), 500);
        }
    });
    // ============================================
    // DIAGNOSTIC ENDPOINT - SHOW ALL VENDOR DATA
    // ============================================
    app.get("/make-server-3dd53475/auth/diagnostic/all-vendors", async (c) => {
        try {
            // ✅ SQL: Get ALL vendor-related data from SQL tables
            // executeRaw already imported at top
            const vendorsRepo = (0, vendors_1.getVendorsRepository)();
            const customersRepo = (0, customers_1.getCustomersRepository)();
            // Get all vendors (AWS RDS: Use raw SQL)
            const vendors = await (0, db_1.executeRaw)('SELECT * FROM vendors ORDER BY created_at DESC');
            // Get all customers (AWS RDS: Use raw SQL)
            const customers = await (0, db_1.executeRaw)('SELECT * FROM customers ORDER BY created_at DESC');
            return (0, response_utils_1.sendSuccess)(c, {
                data: {
                    vendors: (vendors || []).map((v) => ({
                        id: v.id,
                        vendorId: v.vendor_id,
                        phone: v.phone,
                        ownerName: v.owner_name,
                        businessName: v.business_name,
                        email: v.email,
                        status: v.status,
                        approvalStatus: v.approval_status
                    })),
                    customers: (customers || []).map((c) => ({
                        id: c.id,
                        customerId: c.customer_id,
                        phone: c.phone,
                        name: c.full_name,
                        email: c.email
                    })),
                    summary: {
                        totalVendors: vendors?.length || 0,
                        totalCustomers: customers?.length || 0,
                        activeVendors: vendors?.filter((v) => v.status === 'active').length || 0,
                        approvedVendors: vendors?.filter((v) => v.approval_status === 'approved').length || 0
                    }
                }
            });
        }
        catch (error) {
            console.error('❌ Diagnostic error:', error);
            return (0, response_utils_1.sendError)(c, error instanceof Error ? error : new Error(String(error)), 500);
        }
    });
    // ============================================
    // LOGIN / AUTHENTICATION
    // ============================================
    // ✅ CORS: Explicit OPTIONS handler for auth/login
    app.options("/make-server-3dd53475/auth/login", async (c) => {
        c.header('Access-Control-Allow-Origin', '*');
        c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
        c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
        c.header('Access-Control-Max-Age', '86400');
        return new Response(null, { status: 204, headers: c.res.headers });
    });
    /**
     * POST /auth/login
     * Universal login endpoint for all portals
     *
     * Body: { phone, portal: 'customer' | 'vendor' | 'admin' }
     * Returns: { session, user, profile, state }
     */
    app.post("/make-server-3dd53475/auth/login", async (c) => {
        try {
            const { phone, portal } = await c.req.json();
            if (!phone) {
                return (0, response_utils_1.sendError)(c, 'Phone number required', 400);
            }
            console.log(`\n🔐 ========== LOGIN REQUEST START ==========`);
            console.log(`📞 Phone: ${phone}`);
            console.log(`🚪 Portal: ${portal}`);
            console.log(`⏰ Time: ${new Date().toISOString()}`);
            // Find or create user
            const user = await authService.findOrCreateUser(phone, portal);
            console.log(`✅ User resolved:`, {
                userId: user.userId,
                role: user.role,
                phone: user.phone,
                name: user.name
            });
            // Create session
            const session = await authService.createUserSession(user.userId, user.phone, user.role);
            // ✅ SECURITY FIX: Generate access token for authenticated API calls
            const accessToken = await authService.generateAccessToken(user.userId, user.phone, user.role);
            console.log(`🔐 Generated access token for user ${user.userId}`);
            // Get role-specific state
            let profileData = null;
            let currentState = 'new';
            if (user.role === 'vendor' || portal === 'vendor') {
                console.log(`🔍 Getting vendor state for userId: ${user.userId}, phone: ${user.phone}`);
                const vendorState = await authService.getVendorState(user.userId, user.phone);
                profileData = vendorState.vendor;
                currentState = vendorState.state;
                console.log(`👤 Vendor state result:`, {
                    hasVendor: !!vendorState.vendor,
                    vendorId: vendorState.vendor?.id || vendorState.vendor?.vendorId,
                    vendorStatus: vendorState.vendor?.status,
                    vendorApplicationStatus: vendorState.vendor?.applicationStatus,
                    setupCompleted: vendorState.vendor?.setupCompleted,
                    hasApplication: !!vendorState.application,
                    state: currentState
                });
                // DEBUG: If no vendor found, log for debugging (removed KV usage)
                if (!vendorState.vendor) {
                    console.log(`❌ NO VENDOR FOUND for phone: ${phone}, userId: ${user.userId}`);
                }
            }
            else if (user.role === 'customer' || portal === 'customer') {
                const customerState = await authService.getCustomerState(user.userId);
                profileData = customerState.customer;
                currentState = customerState.customer ? 'active' : 'new';
            }
            else if (user.role === 'admin' || portal === 'admin') {
                const adminState = await authService.getAdminState(user.userId);
                profileData = adminState.admin;
                currentState = adminState.admin ? 'active' : 'new';
            }
            const response = {
                session: {
                    sessionId: session.sessionId,
                    userId: session.userId,
                    phone: session.phone,
                    role: session.role,
                    expiresAt: session.expiresAt,
                    accessToken: accessToken // ✅ SECURITY FIX: Include access token
                },
                user: {
                    userId: user.userId,
                    phone: user.phone,
                    role: user.role,
                    name: user.name,
                    email: user.email,
                    isActive: user.isActive
                },
                profile: profileData,
                state: currentState
            };
            // ✅ FIX: Include vendorId in response for new vendors
            if ((user.role === 'vendor' || portal === 'vendor') && profileData) {
                response.vendorId = profileData.id || profileData.vendorId;
            }
            else if ((user.role === 'vendor' || portal === 'vendor') && currentState === 'new') {
                // For new vendors, we might not have a vendor record yet, but we can use userId as fallback
                response.vendorId = null; // Will be created on application submission
            }
            // ✅ SQL: DEBUG: If state is "new" for vendor, add debug information
            if ((user.role === 'vendor' || portal === 'vendor') && currentState === 'new') {
                // ✅ SQL: Get vendor data from SQL for debugging
                const vendorsRepo = await Promise.resolve().then(() => __importStar(require('../lib/repositories/vendors'))).then(m => m.getVendorsRepository());
                const allVendors = await vendorsRepo.findAllActive();
                const debugInfo = {
                    searchedPhone: user.phone,
                    vendorCount: allVendors.length,
                    vendors: allVendors.map((v) => ({
                        id: v.id,
                        phone: v.phone,
                        ownerName: v.owner_name,
                        email: v.email,
                        user_id: v.user_id
                    }))
                };
                console.log('🐛 DEBUG INFO for new vendor:', debugInfo);
                // Attach debug info to response
                response.debug = debugInfo;
            }
            console.log(`📤 Sending response:`, {
                hasProfile: !!profileData,
                profileId: profileData?.id || profileData?.vendorId,
                state: currentState
            });
            return (0, response_utils_1.sendSuccess)(c, response);
        }
        catch (error) {
            console.error('❌ Login error:', error);
            const errorMessage = error?.message || String(error) || 'Unknown error';
            const errorStack = error?.stack || '';
            console.error('❌ Login error details:', { errorMessage, errorStack });
            return (0, response_utils_1.sendError)(c, `Login failed: ${errorMessage}`, 500);
        }
    });
    /**
     * POST /auth/verify-session
     * Verify and refresh session
     *
     * Body: { sessionId }
     * Returns: { valid, session, user, profile, state }
     */
    app.post("/make-server-3dd53475/auth/verify-session", async (c) => {
        try {
            const { sessionId } = await c.req.json();
            if (!sessionId) {
                return (0, response_utils_1.sendError)(c, 'Session ID required', 400, { valid: false });
            }
            const session = await authService.getSession(sessionId);
            if (!session) {
                return (0, response_utils_1.sendError)(c, 'Invalid or expired session', 401, { valid: false });
            }
            const user = await authService.getUserById(session.userId);
            if (!user) {
                return (0, response_utils_1.sendError)(c, 'User not found', 404, { valid: false });
            }
            // Get current state
            let profileData = null;
            let currentState = 'new';
            if (user.role === 'vendor') {
                const vendorState = await authService.getVendorState(user.userId, user.phone);
                profileData = vendorState.vendor;
                currentState = vendorState.state;
            }
            else if (user.role === 'customer') {
                const customerState = await authService.getCustomerState(user.userId);
                profileData = customerState.customer;
                currentState = customerState.customer ? 'active' : 'new';
            }
            else if (user.role === 'admin') {
                const adminState = await authService.getAdminState(user.userId);
                profileData = adminState.admin;
                currentState = adminState.admin ? 'active' : 'new';
            }
            return (0, response_utils_1.sendSuccess)(c, {
                valid: true,
                session,
                user,
                profile: profileData,
                state: currentState
            });
        }
        catch (error) {
            console.error('❌ Session verification error:', error);
            return (0, response_utils_1.sendError)(c, error instanceof Error ? error : new Error(String(error)), 500, { valid: false });
        }
    });
    /**
     * POST /auth/logout
     * Logout user and invalidate session
     */
    app.post("/make-server-3dd53475/auth/logout", async (c) => {
        try {
            const { sessionId } = await c.req.json();
            if (sessionId) {
                await authService.deleteSession(sessionId);
                console.log(`👋 User logged out: ${sessionId}`);
            }
            return (0, response_utils_1.sendSuccess)(c, {});
        }
        catch (error) {
            console.error('❌ Logout error:', error);
            return (0, response_utils_1.sendError)(c, error instanceof Error ? error : new Error(String(error)), 500);
        }
    });
    // ============================================
    // USER STATE QUERIES
    // ============================================
    /**
     * GET /auth/state/:userId
     * Get complete user state (for debugging/admin)
     */
    app.get("/make-server-3dd53475/auth/state/:userId", async (c) => {
        try {
            const { userId } = c.req.param();
            const user = await authService.getUserById(userId);
            if (!user) {
                return (0, response_utils_1.sendError)(c, 'User not found', 404);
            }
            let state = { user };
            if (user.role === 'vendor') {
                const vendorState = await authService.getVendorState(user.userId, user.phone);
                state = { ...state, ...vendorState };
            }
            else if (user.role === 'customer') {
                const customerState = await authService.getCustomerState(user.userId);
                state = { ...state, ...customerState };
            }
            else if (user.role === 'admin') {
                const adminState = await authService.getAdminState(user.userId);
                state = { ...state, ...adminState };
            }
            return (0, response_utils_1.sendSuccess)(c, state);
        }
        catch (error) {
            console.error('❌ State query error:', error);
            return (0, response_utils_1.sendError)(c, error instanceof Error ? error : new Error(String(error)), 500);
        }
    });
    /**
     * GET /auth/user/phone/:phone
     * Find user by phone number
     */
    app.get("/make-server-3dd53475/auth/user/phone/:phone", async (c) => {
        try {
            const { phone } = c.req.param();
            const user = await authService.getUserByPhone(phone);
            if (!user) {
                return (0, response_utils_1.sendSuccess)(c, { exists: false, user: null });
            }
            // Get profile based on role
            let profile = null;
            let state = 'new';
            if (user.role === 'vendor') {
                const vendorState = await authService.getVendorState(user.userId, user.phone);
                profile = vendorState.vendor;
                state = vendorState.state;
            }
            else if (user.role === 'customer') {
                const customerState = await authService.getCustomerState(user.userId);
                profile = customerState.customer;
                state = customerState.customer ? 'active' : 'new';
            }
            else if (user.role === 'admin') {
                const adminState = await authService.getAdminState(user.userId);
                profile = adminState.admin;
                state = adminState.admin ? 'active' : 'new';
            }
            return (0, response_utils_1.sendSuccess)(c, {
                exists: true,
                user,
                profile,
                state
            });
        }
        catch (error) {
            console.error('❌ User lookup error:', error);
            return (0, response_utils_1.sendError)(c, error instanceof Error ? error : new Error(String(error)), 500);
        }
    });
    /**
     * POST /auth/user/update
     * Update user information
     */
    app.post("/make-server-3dd53475/auth/user/update", async (c) => {
        try {
            const { userId, updates } = await c.req.json();
            if (!userId) {
                return (0, response_utils_1.sendError)(c, 'User ID required', 400);
            }
            const updatedUser = await authService.updateUser(userId, updates);
            return (0, response_utils_1.sendSuccess)(c, { user: updatedUser });
        }
        catch (error) {
            console.error('❌ User update error:', error);
            return (0, response_utils_1.sendError)(c, error instanceof Error ? error : new Error(String(error)), 500);
        }
    });
    /**
     * GET /auth/debug/vendor/:phone
     * ✅ SQL: Debug endpoint to check vendor migration status (SQL-only)
     */
    app.get("/make-server-3dd53475/auth/debug/vendor/:phone", async (c) => {
        try {
            const { phone } = c.req.param();
            const cleanedPhone = phone.replace(/[^0-9]/g, '');
            console.log(`🔍 DEBUG: Checking vendor with phone ${cleanedPhone}`);
            const { getVendorsRepository } = await Promise.resolve().then(() => __importStar(require('../lib/repositories/vendors')));
            const { getCustomersRepository } = await Promise.resolve().then(() => __importStar(require('../lib/repositories/customers')));
            const vendorsRepo = getVendorsRepository();
            const customersRepo = getCustomersRepository();
            // Check all possible locations (SQL-only)
            const results = {
                phone: cleanedPhone,
                timestamp: new Date().toISOString(),
                checks: {}
            };
            // ✅ SQL: 1. Check customer by phone
            try {
                const customerByPhone = await customersRepo.findByPhone(cleanedPhone);
                results.checks.customerByPhone = { found: !!customerByPhone, data: customerByPhone };
            }
            catch (e) {
                results.checks.customerByPhone = { error: String(e) };
            }
            // ✅ SQL: 2. Check vendor by phone
            try {
                const vendorByPhone = await vendorsRepo.findByPhone(cleanedPhone);
                results.checks.vendorByPhone = { found: !!vendorByPhone, data: vendorByPhone };
            }
            catch (e) {
                results.checks.vendorByPhone = { error: String(e) };
            }
            // ✅ SQL: 3. Check users table (if exists) (AWS RDS: Use raw SQL)
            try {
                const userRecords = await (0, db_1.executeRaw)('SELECT * FROM users WHERE phone = $1', [cleanedPhone]);
                const userRecord = userRecords.length > 0 ? userRecords[0] : null;
                results.checks.userRecord = { found: !!userRecord, data: userRecord };
            }
            catch (e) {
                results.checks.userRecord = { error: String(e) };
            }
            // ✅ SQL: 4. Check all vendors (for comparison)
            try {
                const allVendors = await vendorsRepo.findAllActive({ limit: 1000 });
                const matchingVendor = allVendors.find((v) => v.phone && v.phone.replace(/[^0-9]/g, '') === cleanedPhone);
                results.checks.allVendors = {
                    total: allVendors.length,
                    found: !!matchingVendor,
                    data: matchingVendor,
                    sample: allVendors.slice(0, 5).map((v) => ({ phone: v.phone, ownerName: v.owner_name, id: v.id }))
                };
            }
            catch (e) {
                results.checks.allVendors = { error: String(e) };
            }
            // ✅ SQL: 5. Check vendor applications (if table exists) (AWS RDS: Use raw SQL)
            try {
                const applications = await (0, db_1.executeRaw)('SELECT * FROM vendor_applications WHERE phone = $1 LIMIT 10', [cleanedPhone]);
                results.checks.applications = {
                    total: applications?.length || 0,
                    found: (applications?.length || 0) > 0,
                    data: applications
                };
            }
            catch (e) {
                // Table might not exist, that's okay
                results.checks.applications = { error: 'Table vendor_applications not found or error: ' + String(e) };
            }
            return (0, response_utils_1.sendSuccess)(c, results);
        }
        catch (error) {
            console.error('❌ Debug error:', error);
            return (0, response_utils_1.sendError)(c, error instanceof Error ? error : new Error(String(error)), 500, { stack: error.stack });
        }
    });
    /**
     * POST /auth/admin/fix-vendor-indexes
     * ✅ SQL: MIGRATION TOOL - No longer needed as phone indexing is SQL-based
     * This endpoint is kept for backward compatibility but now just verifies SQL indexes
     */
    app.post("/make-server-3dd53475/auth/admin/fix-vendor-indexes", async (c) => {
        try {
            console.log('🔧 MIGRATION: Verifying SQL phone indexes...');
            // ✅ SQL: Get all vendors from SQL
            const vendorsRepo = await Promise.resolve().then(() => __importStar(require('../lib/repositories/vendors'))).then(m => m.getVendorsRepository());
            const allVendors = await vendorsRepo.findAll();
            console.log(`Found ${allVendors.length} vendors in SQL`);
            let withPhone = 0;
            let withoutPhone = 0;
            const results = [];
            for (const vendor of allVendors) {
                if (vendor.phone) {
                    withPhone++;
                    results.push({
                        vendorId: vendor.id,
                        phone: vendor.phone,
                        ownerName: vendor.owner_name,
                        businessName: vendor.business_name,
                        status: vendor.status
                    });
                }
                else {
                    withoutPhone++;
                }
            }
            console.log(`✅ Verification complete: ${withPhone} with phone, ${withoutPhone} without phone`);
            return (0, response_utils_1.sendSuccess)(c, {
                message: 'Phone indexing is now SQL-based. All vendors with phone numbers are automatically indexed.',
                stats: {
                    total: allVendors.length,
                    withPhone,
                    withoutPhone
                },
                vendors: results
            }, 'Vendor phone indexes verified');
        }
        catch (error) {
            console.error('❌ Verification error:', error);
            return (0, response_utils_1.sendError)(c, error instanceof Error ? error : new Error(String(error)), 500);
        }
    });
    console.log('✅ Auth endpoints registered');
}
//# sourceMappingURL=auth-endpoints.js.map