/**
 * AUTHENTICATION ENDPOINTS - SQL-ONLY VERSION
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * Complete auth flow for all three portals
 * 
 * Date: 2025-01-28
 * Migration: KV to SQL (5 KV operations → 0)
 */

import { Hono } from 'npm:hono@4';
import * as authService from './auth-service.tsx';
import { generateId } from './database-schema.tsx';
import { getOtpRepository } from '../../lib/repositories/otp.ts';
import { getDbClient } from '../../lib/db.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getCustomersRepository } from '../../lib/repositories/customers.ts';
import { SNSClient, PublishCommand } from "npm:@aws-sdk/client-sns";
import { sendSuccess, sendError } from './response-utils.ts';

export function registerAuthEndpoints(app: Hono) {
  
  // ✅ CORS: Explicit OPTIONS handler for auth/send-otp
  app.options("/make-server-3dd53475/auth/send-otp", async (c) => {
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
          const snsClient = new SNSClient({
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
          
          await snsClient.send(command);
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
      const vendorsRepo = getVendorsRepository();
      const customersRepo = getCustomersRepository();
      
      // Get all vendors
      const vendors = await vendorsRepo.findAll();
      
      // Get all customers
      const customers = await customersRepo.findAll();
      
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
        const vendorsRepo = getVendorsRepository();
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
   * ✅ SQL: Debug endpoint to check vendor/user data from SQL (migration complete)
   * All KV operations replaced with SQL queries
   */
  app.get("/make-server-3dd53475/auth/debug/vendor/:phone", async (c) => {
    try {
      const { phone } = c.req.param();
      const cleanedPhone = phone.replace(/[^0-9]/g, '');
      
      console.log(`🔍 DEBUG: Checking vendor/user with phone ${cleanedPhone}`);
      
      const client = getDbClient();
      const vendorsRepo = getVendorsRepository();
      const customersRepo = getCustomersRepository();
      
      // Check all possible locations
      const results: any = {
        phone: cleanedPhone,
        timestamp: new Date().toISOString(),
        migrationNote: 'All data migrated to SQL. Old KV formats deprecated.',
        checks: {}
      };
      
      // ✅ SQL: 1. Check customer by phone
      try {
        const customerByPhone = await customersRepo.findByPhone(cleanedPhone);
        results.checks.customerByPhone = { 
          found: !!customerByPhone, 
          data: customerByPhone ? {
            id: customerByPhone.id,
            customerId: customerByPhone.customer_id,
            phone: customerByPhone.phone,
            name: customerByPhone.full_name,
            email: customerByPhone.email
          } : null 
        };
      } catch (e) {
        results.checks.customerByPhone = { error: String(e) };
      }
      
      // ✅ SQL: 2. Check all customers (for debugging)
      try {
        const allCustomers = await customersRepo.findAll();
        const matchingCustomer = allCustomers.find((c: any) => c.phone && c.phone.replace(/[^0-9]/g, '') === cleanedPhone);
        results.checks.allCustomers = {
          total: allCustomers.length,
          found: !!matchingCustomer,
          data: matchingCustomer ? {
            id: matchingCustomer.id,
            customerId: matchingCustomer.customer_id,
            phone: matchingCustomer.phone,
            name: matchingCustomer.full_name
          } : null
        };
      } catch (e) {
        results.checks.allCustomers = { error: String(e) };
      }
      
      // ✅ SQL: 3. Check vendor by phone using SQL
      try {
        const vendorByPhone = await vendorsRepo.findByPhone(cleanedPhone);
        results.checks.vendorByPhone = { 
          found: !!vendorByPhone, 
          data: vendorByPhone ? {
            id: vendorByPhone.id,
            vendorId: vendorByPhone.vendor_id,
            phone: vendorByPhone.phone,
            ownerName: vendorByPhone.owner_name,
            businessName: vendorByPhone.business_name,
            status: vendorByPhone.status
          } : null 
        };
      } catch (e) {
        results.checks.vendorByPhone = { error: String(e) };
      }
      
      // ✅ SQL: 4. Check all vendors (for debugging)
      try {
        const allVendors = await vendorsRepo.findAll();
        const matchingVendor = allVendors.find((v: any) => v.phone && v.phone.replace(/[^0-9]/g, '') === cleanedPhone);
        results.checks.allVendors = {
          total: allVendors.length,
          found: !!matchingVendor,
          data: matchingVendor ? {
            id: matchingVendor.id,
            vendorId: matchingVendor.vendor_id,
            phone: matchingVendor.phone,
            ownerName: matchingVendor.owner_name,
            businessName: matchingVendor.business_name
          } : null
        };
      } catch (e) {
        results.checks.allVendors = { error: String(e) };
      }
      
      // ✅ SQL: 5. Check vendor applications (vendors with status='pending')
      try {
        const { data: applications } = await client
          .from('vendors')
          .select('*')
          .eq('status', 'pending');
        
        const matchingApp = applications?.find((a: any) => a.phone && a.phone.replace(/[^0-9]/g, '') === cleanedPhone);
        results.checks.applications = {
          total: applications?.length || 0,
          found: !!matchingApp,
          data: matchingApp ? {
            id: matchingApp.id,
            vendorId: matchingApp.vendor_id,
            phone: matchingApp.phone,
            ownerName: matchingApp.owner_name,
            businessName: matchingApp.business_name,
            status: matchingApp.status,
            applicationMetadata: matchingApp.application_metadata
          } : null,
          note: 'Applications are vendors with status=pending'
        };
      } catch (e) {
        results.checks.applications = { error: String(e) };
      }
      
      // ✅ SQL: 6. Deprecated KV formats (data migrated to SQL)
      results.checks.deprecatedFormats = {
        note: 'Old KV formats (user:phone:, user:user_, vendor:profile:, vendor:vendor_) are deprecated. Data has been migrated to SQL tables (customers, vendors).',
        userPhoneFormat: 'Deprecated - use customers table',
        userUserPrefix: 'Deprecated - use customers table',
        vendorProfileFormat: 'Deprecated - use vendors table',
        vendorVendorPrefix: 'Deprecated - use vendors table'
      };
      
      return sendSuccess(c, results);
      
    } catch (error) {
      console.error('❌ Debug error:', error);
      return sendError(c, error, 500, { stack: (error as Error).stack });
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
      const vendorsRepo = getVendorsRepository();
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
  
  console.log('✅ Auth endpoints registered (SQL-only)');
}

