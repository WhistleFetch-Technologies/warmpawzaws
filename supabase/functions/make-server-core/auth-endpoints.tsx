/**
 * AUTHENTICATION ENDPOINTS
 * 
 * Complete auth flow for all three portals
 */

import { Hono } from 'npm:hono@4';
import * as authService from './auth-service.tsx';
import { generateId } from './database-schema.tsx';
import { getOtpRepository } from '../../lib/repositories/otp.ts';
import { getDbClient } from '../../lib/db.ts';
import { SNSClient, PublishCommand } from "npm:@aws-sdk/client-sns";
import { sendSuccess, sendError } from '../_shared/response-utils.ts';

export function registerAuthEndpoints(app: Hono) {
  
  // ✅ CORS: Explicit OPTIONS handler for auth/send-otp
  app.options("/make-server-core/auth/send-otp", async (c) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    c.header('Access-Control-Max-Age', '86400');
    return c.text('', 204);
  });
  
  // ============================================
  // OTP SERVICE (SNS)
  // ============================================
  app.post("/make-server-3dd53475/auth/send-otp", async (c) => {
    try {
      const { phone } = await c.req.json();
      const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit OTP
      
      console.log(`🔐 [AUTH] Generating OTP for ${phone}: ${otp}`);
      
      // ✅ SQL: Store OTP using repository
      await getOtpRepository().create({
        phone,
        otp_code: otp,
        otp_type: 'login',
        expires_in_minutes: 5,
        max_attempts: 3,
      });

      // ✅ SQL: Fetch AWS Settings from platform_settings table
      const client = getDbClient();
      const { data: awsSettingsData } = await client
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'admin:settings:aws')
        .maybeSingle();
      
      const awsSettings = awsSettingsData?.setting_value || null;
      
      if (awsSettings?.sns?.enabled && awsSettings?.credentials?.accessKeyId) {
        try {
          console.log('📨 [AUTH] Sending SMS via AWS SNS...');
          const client = new SNSClient({
            region: awsSettings.sns.region || 'ap-south-1',
            credentials: {
              accessKeyId: awsSettings.credentials.accessKeyId,
              secretAccessKey: awsSettings.credentials.secretAccessKey
            }
          });
          
          const command = new PublishCommand({
            PhoneNumber: phone,
            Message: `Your Warmpawz verification code is: ${otp}. Valid for 5 minutes.`,
            MessageAttributes: {
              'AWS.SNS.SMS.SMSType': {
                DataType: 'String',
                StringValue: 'Transactional'
              }
            }
          });
          
          await client.send(command);
          console.log('✅ [AUTH] SMS sent successfully via SNS');
          return sendSuccess(c, {}, 'OTP sent via SMS');
          
        } catch (err) {
          console.error('❌ [AUTH] SNS failed, falling back to mock:', err);
        }
      }
      
      // Fallback / Mock
      console.log('⚠️ [AUTH] SNS disabled or failed. OTP logged to console only.');
      return sendSuccess(c, { debug_otp: otp }, 'OTP sent (Mock Mode)');
      
    } catch (error) {
      console.error('❌ [AUTH] Send OTP error:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // DIAGNOSTIC ENDPOINT - SHOW ALL VENDOR DATA
  // ============================================
  
  app.get("/make-server-3dd53475/auth/diagnostic/all-vendors", async (c) => {
    try {
      // ✅ SQL: Get ALL vendor-related data from SQL tables
      const client = getDbClient();
      const vendorsRepo = await import('../../lib/repositories/vendors.ts').then(m => m.getVendorsRepository());
      const customersRepo = await import('../../lib/repositories/customers.ts').then(m => m.getCustomersRepository());
      
      // Get all vendors
      const { data: vendors } = await client
        .from('vendors')
        .select('*')
        .order('created_at', { ascending: false });
      
      // Get all customers
      const { data: customers } = await client
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });
      
      return sendSuccess(c, {
        data: {
          vendors: (vendors || []).map((v: any) => ({
            id: v.id,
            vendorId: v.vendor_id,
            phone: v.phone,
            ownerName: v.owner_name,
            businessName: v.business_name,
            email: v.email,
            status: v.status,
            approvalStatus: v.approval_status
          })),
          customers: (customers || []).map((c: any) => ({
            id: c.id,
            customerId: c.customer_id,
            phone: c.phone,
            name: c.full_name,
            email: c.email
          })),
          summary: {
            totalVendors: vendors?.length || 0,
            totalCustomers: customers?.length || 0,
            activeVendors: vendors?.filter((v: any) => v.status === 'active').length || 0,
            approvedVendors: vendors?.filter((v: any) => v.approval_status === 'approved').length || 0
          }
        }
      });
    } catch (error) {
      console.error('❌ Diagnostic error:', error);
      return sendError(c, error, 500);
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
    return c.text('', 204);
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
        return sendError(c, 'Phone number required', 400);
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
      let profileData: any = null;
      let currentState: any = 'new';
      
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
        
      } else if (user.role === 'customer' || portal === 'customer') {
        const customerState = await authService.getCustomerState(user.userId);
        profileData = customerState.customer;
        currentState = customerState.customer ? 'active' : 'new';
      } else if (user.role === 'admin' || portal === 'admin') {
        const adminState = await authService.getAdminState(user.userId);
        profileData = adminState.admin;
        currentState = adminState.admin ? 'active' : 'new';
      }
      
      const response: any = {
        session: {
          sessionId: session.sessionId,
          userId: session.userId,
          phone: session.phone,
          role: session.role,
          expiresAt: session.expiresAt,
          accessToken: accessToken  // ✅ SECURITY FIX: Include access token
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
      } else if ((user.role === 'vendor' || portal === 'vendor') && currentState === 'new') {
        // For new vendors, we might not have a vendor record yet, but we can use userId as fallback
        response.vendorId = null; // Will be created on application submission
      }
      
      // ✅ SQL: DEBUG: If state is "new" for vendor, add debug information
      if ((user.role === 'vendor' || portal === 'vendor') && currentState === 'new') {
        // ✅ SQL: Get vendor data from SQL for debugging
        const vendorsRepo = await import('../../lib/repositories/vendors.ts').then(m => m.getVendorsRepository());
        const allVendors = await vendorsRepo.findAll();
        
        const debugInfo = {
          searchedPhone: user.phone,
          vendorCount: allVendors.length,
          vendors: allVendors.map((v: any) => ({
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
      
      return sendSuccess(c, response);
      
    } catch (error: any) {
      console.error('❌ Login error:', error);
      const errorMessage = error?.message || String(error) || 'Unknown error';
      const errorStack = error?.stack || '';
      console.error('❌ Login error details:', { errorMessage, errorStack });
      return sendError(c, `Login failed: ${errorMessage}`, 500);
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
        return sendError(c, 'Session ID required', 400, { valid: false });
      }
      
      const session = await authService.getSession(sessionId);
      
      if (!session) {
        return sendError(c, 'Invalid or expired session', 401, { valid: false });
      }
      
      const user = await authService.getUserById(session.userId);
      
      if (!user) {
        return sendError(c, 'User not found', 404, { valid: false });
      }
      
      // Get current state
      let profileData: any = null;
      let currentState: any = 'new';
      
      if (user.role === 'vendor') {
        const vendorState = await authService.getVendorState(user.userId, user.phone);
        profileData = vendorState.vendor;
        currentState = vendorState.state;
      } else if (user.role === 'customer') {
        const customerState = await authService.getCustomerState(user.userId);
        profileData = customerState.customer;
        currentState = customerState.customer ? 'active' : 'new';
      } else if (user.role === 'admin') {
        const adminState = await authService.getAdminState(user.userId);
        profileData = adminState.admin;
        currentState = adminState.admin ? 'active' : 'new';
      }
      
      return sendSuccess(c, {
        valid: true,
        session,
        user,
        profile: profileData,
        state: currentState
      });
      
    } catch (error) {
      console.error('❌ Session verification error:', error);
      return sendError(c, error, 500, { valid: false });
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
      
      return sendSuccess(c, {});
      
    } catch (error) {
      console.error('❌ Logout error:', error);
      return sendError(c, error, 500);
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
        return sendError(c, 'User not found', 404);
      }
      
      let state: any = { user };
      
      if (user.role === 'vendor') {
        const vendorState = await authService.getVendorState(user.userId, user.phone);
        state = { ...state, ...vendorState };
      } else if (user.role === 'customer') {
        const customerState = await authService.getCustomerState(user.userId);
        state = { ...state, ...customerState };
      } else if (user.role === 'admin') {
        const adminState = await authService.getAdminState(user.userId);
        state = { ...state, ...adminState };
      }
      
      return sendSuccess(c, state);
      
    } catch (error) {
      console.error('❌ State query error:', error);
      return sendError(c, error, 500);
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
        return sendSuccess(c, { exists: false, user: null });
      }
      
      // Get profile based on role
      let profile: any = null;
      let state: any = 'new';
      
      if (user.role === 'vendor') {
        const vendorState = await authService.getVendorState(user.userId, user.phone);
        profile = vendorState.vendor;
        state = vendorState.state;
      } else if (user.role === 'customer') {
        const customerState = await authService.getCustomerState(user.userId);
        profile = customerState.customer;
        state = customerState.customer ? 'active' : 'new';
      } else if (user.role === 'admin') {
        const adminState = await authService.getAdminState(user.userId);
        profile = adminState.admin;
        state = adminState.admin ? 'active' : 'new';
      }
      
      return sendSuccess(c, {
        exists: true,
        user,
        profile,
        state
      });
      
    } catch (error) {
      console.error('❌ User lookup error:', error);
      return sendError(c, error, 500);
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
        return sendError(c, 'User ID required', 400);
      }
      
      const updatedUser = await authService.updateUser(userId, updates);
      
      return sendSuccess(c, { user: updatedUser });
      
    } catch (error) {
      console.error('❌ User update error:', error);
      return sendError(c, error, 500);
    }
  });
  
  /**
   * GET /auth/debug/vendor/:phone
   * Debug endpoint to check vendor migration status (SQL-only)
   * ✅ MIGRATED: Removed all KV dependencies, uses SQL repositories only
   */
  app.get("/make-server-3dd53475/auth/debug/vendor/:phone", async (c) => {
    try {
      const { phone } = c.req.param();
      const cleanedPhone = phone.replace(/[^0-9]/g, '');
      
      console.log(`🔍 DEBUG: Checking vendor with phone ${cleanedPhone} (SQL-only)`);
      
      // Check SQL sources only
      const results: any = {
        phone: cleanedPhone,
        timestamp: new Date().toISOString(),
        migration_status: 'sql-only',
        checks: {}
      };
      
      // ✅ SQL: Check vendor by phone using SQL
      try {
        const { getVendorsRepository } = await import('../../lib/repositories/vendors.ts');
        const vendorsRepo = getVendorsRepository();
        const vendorByPhone = await vendorsRepo.findByPhone(cleanedPhone);
        results.checks.vendorByPhone = { 
          found: !!vendorByPhone, 
          data: vendorByPhone ? {
            id: vendorByPhone.id,
            vendor_id: vendorByPhone.vendor_id,
            phone: vendorByPhone.phone,
            business_name: vendorByPhone.business_name,
            full_name: vendorByPhone.full_name,
            role_id: vendorByPhone.role_id,
            status: vendorByPhone.status,
            is_active: vendorByPhone.is_active
          } : null 
        };
      } catch (e) {
        results.checks.vendorByPhone = { error: String(e) };
      }
      
      // ✅ SQL: Check customers by phone
      try {
        const { getCustomersRepository } = await import('../../lib/repositories/customers.ts');
        const customersRepo = getCustomersRepository();
        const customerByPhone = await customersRepo.findByPhone(cleanedPhone);
        results.checks.customerByPhone = { 
          found: !!customerByPhone, 
          data: customerByPhone ? {
            id: customerByPhone.id,
            phone: customerByPhone.phone,
            full_name: customerByPhone.full_name,
            email: customerByPhone.email
          } : null 
        };
      } catch (e) {
        results.checks.customerByPhone = { error: String(e) };
      }
      
      // ✅ SQL: Check admin profiles by phone
      try {
        const { getAdminProfilesRepository } = await import('../../lib/repositories/admin-profiles.ts');
        const adminRepo = getAdminProfilesRepository();
        const adminByPhone = await adminRepo.findByPhone(cleanedPhone);
        results.checks.adminByPhone = { 
          found: !!adminByPhone, 
          data: adminByPhone ? {
            id: adminByPhone.id,
            phone: adminByPhone.phone,
            full_name: adminByPhone.full_name,
            email: adminByPhone.email,
            role: adminByPhone.role
          } : null 
        };
      } catch (e) {
        results.checks.adminByPhone = { error: String(e) };
      }
      
      // ✅ SQL: Check sessions by phone
      try {
        const { getSessionsRepository } = await import('../../lib/repositories/sessions.ts');
        const sessionsRepo = getSessionsRepository();
        // Find active sessions for this phone
        const client = getDbClient();
        const { data: sessions } = await client
          .from('sessions')
          .select('*')
          .eq('phone', cleanedPhone)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(5);
        results.checks.activeSessions = { 
          found: sessions && sessions.length > 0, 
          count: sessions?.length || 0,
          sessions: sessions || []
        };
      } catch (e) {
        results.checks.activeSessions = { error: String(e) };
      }
      
      return sendSuccess(c, results);
      
    } catch (error) {
      console.error('❌ Debug error:', error);
      return sendError(c, error, 500, { 
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
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
      const vendorsRepo = await import('../../lib/repositories/vendors.ts').then(m => m.getVendorsRepository());
      const allVendors = await vendorsRepo.findAll();
      console.log(`Found ${allVendors.length} vendors in SQL`);
      
      let withPhone = 0;
      let withoutPhone = 0;
      const results: any[] = [];
      
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
        } else {
          withoutPhone++;
        }
      }
      
      console.log(`✅ Verification complete: ${withPhone} with phone, ${withoutPhone} without phone`);
      
      return sendSuccess(c, {
        message: 'Phone indexing is now SQL-based. All vendors with phone numbers are automatically indexed.',
        stats: {
          total: allVendors.length,
          withPhone,
          withoutPhone
        },
        vendors: results
      }, 'Vendor phone indexes verified');
      
    } catch (error) {
      console.error('❌ Verification error:', error);
      return sendError(c, error, 500);
    }
  });
  
  console.log('✅ Auth endpoints registered');
}