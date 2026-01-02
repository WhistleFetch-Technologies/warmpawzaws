/**
 * AUTHENTICATION ENDPOINTS
 * 
 * Complete auth flow for all three portals
 */

// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
// ✅ COGNITO MIGRATION: AWS SNS OTP replaced with Cognito SMS MFA
import { Hono } from 'hono';
import * as authService from './auth-service';
import { generateId } from './database-schema';
// ✅ SQL: Replace KV with SQL repositories
import { 
  getOtpRepository,
  getPlatformSettingsRepository,
  getVendorsRepository,
  getCustomersRepository
} from '../../../supabase/lib/repositories/index';
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { sendSuccess, sendError } from './response-utils';
import { sendCognitoOTP, verifyCognitoOTP } from './cognito-auth-helper';

export function registerAuthEndpoints(app: Hono) {
  
  // ============================================
  // OTP SERVICE (COGNITO SMS MFA)
  // ============================================
  app.post("/make-server-3dd53475/auth/send-otp", async (c) => {
    try {
      const { phone, role = 'customer' } = await c.req.json();
      
      if (!phone) {
        return sendError(c, 'Phone number required', 400);
      }

      // Validate role
      if (!['customer', 'vendor'].includes(role)) {
        return sendError(c, 'Invalid role. Must be customer or vendor', 400);
      }
      
      console.log(`🔐 [AUTH] Sending Cognito OTP for ${phone} (${role})`);
      
      // ✅ COGNITO: Send OTP via Cognito SMS MFA
      try {
        const cognitoResult = await sendCognitoOTP(phone, role as 'customer' | 'vendor');
        
        if (cognitoResult.success) {
          console.log('✅ [AUTH] Cognito OTP sent successfully');
          
          // Store session in OTP repository for verification (temporary, expires with OTP)
          const otpRepo = getOtpRepository();
          await otpRepo.create({
            phone,
            otp_code: cognitoResult.session, // Store Cognito session instead of OTP
            otp_type: `cognito_${role}_login`,
            expires_in_minutes: 10, // Cognito sessions are typically longer
            max_attempts: 3,
          });
          
          return sendSuccess(c, {
            session: cognitoResult.session,
            challengeName: cognitoResult.challengeName,
          }, 'OTP sent via Cognito SMS');
        } else {
          throw new Error('Failed to send Cognito OTP');
        }
      } catch (cognitoError: any) {
        console.error('❌ [AUTH] Cognito OTP failed:', cognitoError);
        
        // Fallback to SNS if Cognito is not configured
        console.log('⚠️ [AUTH] Falling back to AWS SNS...');
        
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        const otpRepo = getOtpRepository();
        await otpRepo.create({
          phone,
          otp_code: otp,
          otp_type: 'login',
          expires_in_minutes: 5,
          max_attempts: 3,
        });

        const platformSettingsRepo = getPlatformSettingsRepository();
        const awsSettingsData = await platformSettingsRepo.getAWSSettings();
        const awsSettings = awsSettingsData ? {
          sns: awsSettingsData.sns_config || {},
          credentials: awsSettingsData.credentials || {},
        } : null;
        
        if (awsSettings?.sns?.enabled && awsSettings?.credentials?.accessKeyId) {
          try {
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
            console.log('✅ [AUTH] SMS sent successfully via SNS (fallback)');
            return sendSuccess(c, {}, 'OTP sent via SMS');
          } catch (err) {
            console.error('❌ [AUTH] SNS fallback also failed:', err);
          }
        }
        
        // Final fallback - mock mode
        console.log('⚠️ [AUTH] All OTP methods failed. Using mock mode.');
        return sendSuccess(c, { debug_otp: otp }, 'OTP sent (Mock Mode - Cognito not configured)');
      }
      
    } catch (error) {
      console.error('❌ [AUTH] Send OTP error:', error);
      return sendError(c, error instanceof Error ? error.message : 'Failed to send OTP', 500);
    }
  });

  // ============================================
  // DIAGNOSTIC ENDPOINT - SHOW ALL VENDOR DATA
  // ============================================
  
  app.get("/make-server-3dd53475/auth/diagnostic/all-vendors", async (c) => {
    try {
      // ✅ SQL: Get ALL vendor-related data from SQL repositories
      const vendorsRepo = getVendorsRepository();
      const allVendors = await vendorsRepo.findAll({});
      
      // Transform to match expected format
      const vendorVendors = allVendors.map((v: any) => ({
        id: v.id || v.vendor_id,
        phone: v.phone,
        ownerName: v.owner_name || v.full_name,
        businessName: v.business_name,
        email: v.email,
        status: v.status
      }));
      
      return sendSuccess(c, {
        data: {
          users: [], // Users are managed separately via auth-service
          vendorProfiles: vendorVendors, // Same as vendors
          vendorVendors: vendorVendors,
          applications: [] // Applications should be in separate table if needed
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
        
        // ✅ SQL: Debug vendor lookup using SQL repository
        if (!vendorState.vendor) {
          console.log(`❌ NO VENDOR FOUND - Checking database...`);
          const vendorsRepo = getVendorsRepository();
          const allVendors = await vendorsRepo.findAll({});
          console.log(`📋 Total vendors in database: ${allVendors.length}`);
          
          if (allVendors.length > 0) {
            console.log(`📋 First 5 vendors:`);
            allVendors.slice(0, 5).forEach((v: any, idx: number) => {
              console.log(`   ${idx + 1}. ID: ${v.id}, Phone: ${v.phone}, Name: ${v.business_name || v.owner_name}, Status: ${v.status}`);
            });
            
            // Check if any match the login phone
            const matchingVendor = allVendors.find((v: any) => v.phone === phone || v.phone === user.phone);
            if (matchingVendor) {
              console.log(`⚠️ FOUND MATCHING VENDOR BUT NOT RETURNED BY getVendorState:`, {
                id: matchingVendor.id,
                phone: matchingVendor.phone,
                status: matchingVendor.status
              });
            }
          }
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
      
      // ✅ SQL: Debug vendor lookup using SQL repository
      if ((user.role === 'vendor' || portal === 'vendor') && currentState === 'new') {
        const vendorsRepo = getVendorsRepository();
        const allVendors = await vendorsRepo.findAll({});
        
        const debugInfo = {
          searchedPhone: user.phone,
          vendorProfileCount: allVendors.length,
          vendorVendorCount: allVendors.length,
          vendorProfiles: allVendors.map((p: any) => ({
            id: p.id,
            phone: p.phone,
            ownerName: p.owner_name || p.full_name,
            email: p.email
          })),
          vendorVendors: allVendors.map((v: any) => ({
            id: v.id || v.vendor_id,
            phone: v.phone,
            ownerName: v.owner_name || v.full_name,
            email: v.email
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
      
    } catch (error) {
      console.error('❌ Login error:', error);
      return sendError(c, error, 500);
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
   * Debug endpoint to check vendor migration status
   */
  app.get("/make-server-3dd53475/auth/debug/vendor/:phone", async (c) => {
    try {
      const { phone } = c.req.param();
      const cleanedPhone = phone.replace(/[^0-9]/g, '');
      
      console.log(`🔍 DEBUG: Checking vendor with phone ${cleanedPhone}`);
      
      // ✅ SQL: Check all possible locations using SQL repositories
      const results: any = {
        phone: cleanedPhone,
        timestamp: new Date().toISOString(),
        checks: {}
      };
      
      // 1-2. Users are managed via auth-service (SQL-based)
      try {
        const user = await authService.getUserByPhone(cleanedPhone);
        results.checks.userByPhone = { found: !!user, data: user };
        results.checks.allUsers = { total: 0, found: !!user, data: user };
      } catch (e) {
        results.checks.userByPhone = { error: String(e) };
        results.checks.allUsers = { error: String(e) };
      }
      
      // 3-5. Check vendors using SQL repository
      try {
        const vendorsRepo = getVendorsRepository();
        const vendorByPhone = await vendorsRepo.findByPhone(cleanedPhone);
        const allVendors = await vendorsRepo.findAll({});
        const matchingVendor = allVendors.find((v: any) => v.phone && v.phone.replace(/[^0-9]/g, '') === cleanedPhone);
        
        results.checks.vendorByPhone = { found: !!vendorByPhone, data: vendorByPhone };
        results.checks.oldProfiles = {
          total: allVendors.length,
          found: !!matchingVendor,
          data: matchingVendor,
          allProfiles: allVendors.map((p: any) => ({ phone: p.phone, fullName: p.business_name || p.owner_name, id: p.id }))
        };
        results.checks.allVendors = {
          total: allVendors.length,
          found: !!matchingVendor,
          data: matchingVendor,
          allVendors: allVendors.map((v: any) => ({ phone: v.phone, ownerName: v.owner_name, id: v.id || v.vendor_id }))
        };
      } catch (e) {
        results.checks.vendorByPhone = { error: String(e) };
        results.checks.oldProfiles = { error: String(e) };
        results.checks.allVendors = { error: String(e) };
      }
      
      // 6. Applications should be in separate table if needed
      results.checks.applications = {
        total: 0,
        found: false,
        data: null,
        note: 'Applications should be stored in applications table'
      };
      
      return sendSuccess(c, results);
      
    } catch (error) {
      console.error('❌ Debug error:', error);
      return sendError(c, error, 500, { stack: error.stack });
    }
  });
  
  /**
   * POST /auth/admin/fix-vendor-indexes
   * MIGRATION TOOL: Create missing phone indexes for existing vendors
   */
  app.post("/make-server-3dd53475/auth/admin/fix-vendor-indexes", async (c) => {
    try {
      console.log('🔧 MIGRATION: Vendor phone indexes are now handled by SQL database indexes');
      
      // ✅ SQL: Phone indexes are automatically handled by database unique constraints
      // No need for manual KV indexes - database handles this via phone column
      const vendorsRepo = getVendorsRepository();
      const allVendors = await vendorsRepo.findAll({});
      
      console.log(`✅ Found ${allVendors.length} vendors in database`);
      console.log(`✅ Phone lookups are handled by database indexes (no manual index needed)`);
      
      return sendSuccess(c, {
        stats: {
          total: allVendors.length,
          fixed: 0,
          skipped: allVendors.length,
          note: 'Phone indexes are handled automatically by database'
        },
        fixed: []
      }, 'Vendor phone lookups use database indexes');
      
    } catch (error) {
      console.error('❌ Migration error:', error);
      return sendError(c, error, 500);
    }
  });
  
  console.log('✅ Auth endpoints registered');
}