/**
 * AUTHENTICATION ENDPOINTS
 * 
 * Complete auth flow for all three portals
 */

import { Hono } from 'npm:hono';
import * as authService from './auth-service.tsx';
import { generateId } from './database-schema.tsx';
import * as kv from './kv_store.tsx';
import { SNSClient, PublishCommand } from "npm:@aws-sdk/client-sns";
import { sendSuccess, sendError } from './response-utils.ts';

export function registerAuthEndpoints(app: Hono) {
  
  // ============================================
  // OTP SERVICE (SNS)
  // ============================================
  app.post("/make-server-3dd53475/auth/send-otp", async (c) => {
    try {
      const { phone } = await c.req.json();
      const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit OTP
      
      console.log(`🔐 [AUTH] Generating OTP for ${phone}: ${otp}`);
      
      // 1. Store OTP in KV (expires in 5 mins)
      // We store it with a prefix to verify later
      await kv.set(`otp:${phone}`, { code: otp, expiresAt: Date.now() + 5 * 60 * 1000 });

      // 2. Fetch AWS Settings
      const awsSettings = await kv.get('admin:settings:aws');
      
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
      // Get ALL vendor-related data
      const users = await kv.getByPrefix('user:');
      const vendorProfiles = await kv.getByPrefix('vendor:profile:');
      const vendorVendors = await kv.getByPrefix('vendor:vendor_');
      const vendorApplications = await kv.getByPrefix('vendor:application:');
      
      return sendSuccess(c, {
        data: {
          users: users.map((u: any) => ({
            userId: u.userId,
            phone: u.phone,
            role: u.role,
            name: u.name,
            email: u.email
          })),
          vendorProfiles: vendorProfiles.map((vp: any) => ({
            id: vp.id,
            phone: vp.phone,
            ownerName: vp.ownerName,
            businessName: vp.businessName,
            email: vp.email,
            status: vp.status
          })),
          vendorVendors: vendorVendors.map((vv: any) => ({
            id: vv.id || vv.vendorId,
            phone: vv.phone,
            ownerName: vv.ownerName,
            businessName: vv.businessName,
            email: vv.email,
            status: vv.status
          })),
          applications: vendorApplications.map((va: any) => ({
            applicationId: va.applicationId,
            vendorId: va.vendorId,
            phone: va.phone,
            status: va.status,
            submittedAt: va.submittedAt
          }))
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
        
        // DEBUG: If no vendor found, let's check what's in the database
        if (!vendorState.vendor) {
          console.log(`❌ NO VENDOR FOUND - Checking database...`);
          const allVendors = await kv.getByPrefix('vendor:vendor_');
          console.log(`📋 Total vendors in database: ${allVendors.length}`);
          
          if (allVendors.length > 0) {
            console.log(`📋 First 5 vendors:`);
            allVendors.slice(0, 5).forEach((v: any, idx: number) => {
              console.log(`   ${idx + 1}. ID: ${v.id}, Phone: ${v.phone}, Name: ${v.fullName}, Status: ${v.status}`);
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
          expiresAt: session.expiresAt
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
      
      // DEBUG: If state is "new" for vendor, add debug information
      if ((user.role === 'vendor' || portal === 'vendor') && currentState === 'new') {
        const kv = await import('./kv_store.tsx');
        
        // Get all vendor profiles for debugging
        const vendorProfileEntries = await kv.getByPrefix('vendor:profile:');
        const vendorVendorEntries = await kv.getByPrefix('vendor:vendor_');
        
        const debugInfo = {
          searchedPhone: user.phone,
          vendorProfileCount: vendorProfileEntries.length,
          vendorVendorCount: vendorVendorEntries.length,
          vendorProfiles: vendorProfileEntries.map((p: any) => ({
            id: p.id,
            phone: p.phone,
            ownerName: p.ownerName || p.fullName,
            email: p.email
          })),
          vendorVendors: vendorVendorEntries.map((v: any) => ({
            id: v.id || v.vendorId,
            phone: v.phone,
            ownerName: v.ownerName || v.fullName,
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
      
      // Import KV directly to bypass any potential issues
      const kvModule = await import('./kv_store.tsx');
      
      // Check all possible locations
      const results: any = {
        phone: cleanedPhone,
        timestamp: new Date().toISOString(),
        checks: {}
      };
      
      // 1. Check user:phone: format
      try {
        const userByPhone = await kvModule.get(`user:phone:${cleanedPhone}`);
        results.checks.userByPhone = { found: !!userByPhone, data: userByPhone };
      } catch (e) {
        results.checks.userByPhone = { error: String(e) };
      }
      
      // 2. Check all user: keys
      try {
        const allUsers = await kvModule.getByPrefix('user:user_');
        const matchingUser = allUsers.find((u: any) => u.phone && u.phone.replace(/[^0-9]/g, '') === cleanedPhone);
        results.checks.allUsers = {
          total: allUsers.length,
          found: !!matchingUser,
          data: matchingUser
        };
      } catch (e) {
        results.checks.allUsers = { error: String(e) };
      }
      
      // 3. Check vendor:phone: format
      try {
        const vendorByPhone = await kvModule.get(`vendor:phone:${cleanedPhone}`);
        results.checks.vendorByPhone = { found: !!vendorByPhone, data: vendorByPhone };
      } catch (e) {
        results.checks.vendorByPhone = { error: String(e) };
      }
      
      // 4. Check vendor:profile: format (old format)
      try {
        const oldProfiles = await kvModule.getByPrefix('vendor:profile:');
        const matchingProfile = oldProfiles.find((p: any) => p.phone && p.phone.replace(/[^0-9]/g, '') === cleanedPhone);
        results.checks.oldProfiles = {
          total: oldProfiles.length,
          found: !!matchingProfile,
          data: matchingProfile,
          allProfiles: oldProfiles.map((p: any) => ({ phone: p.phone, fullName: p.fullName, id: p.id }))
        };
      } catch (e) {
        results.checks.oldProfiles = { error: String(e) };
      }
      
      // 5. Check vendor:vendor_ format
      try {
        const allVendors = await kvModule.getByPrefix('vendor:vendor_');
        const matchingVendor = allVendors.find((v: any) => v.phone && v.phone.replace(/[^0-9]/g, '') === cleanedPhone);
        results.checks.allVendors = {
          total: allVendors.length,
          found: !!matchingVendor,
          data: matchingVendor,
          allVendors: allVendors.map((v: any) => ({ phone: v.phone, ownerName: v.ownerName, id: v.id || v.vendorId }))
        };
      } catch (e) {
        results.checks.allVendors = { error: String(e) };
      }
      
      // 6. Check application: keys
      try {
        const allApplications = await kvModule.getByPrefix('application:');
        const matchingApp = allApplications.find((a: any) => a.phone && a.phone.replace(/[^0-9]/g, '') === cleanedPhone);
        results.checks.applications = {
          total: allApplications.length,
          found: !!matchingApp,
          data: matchingApp
        };
      } catch (e) {
        results.checks.applications = { error: String(e) };
      }
      
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
      console.log('🔧 MIGRATION: Fixing vendor indexes...');
      
      // Get all vendors
      const allVendors = await kv.getByPrefix('vendor:vendor_');
      console.log(`Found ${allVendors.length} vendors to process`);
      
      let fixed = 0;
      let skipped = 0;
      const results: any[] = [];
      
      for (const vendor of allVendors) {
        const vendorId = vendor.id || vendor.vendorId;
        const phone = vendor.phone;
        
        if (!phone) {
          console.log(`⚠️ Vendor ${vendorId} has no phone number`);
          skipped++;
          continue;
        }
        
        // Clean phone
        const cleanedPhone = phone.replace(/[^0-9]/g, '');
        
        // Check if index already exists
        const existingIndex = await kv.get(`vendor:phone:${cleanedPhone}`);
        
        if (existingIndex) {
          console.log(`✓ Vendor ${vendorId} already has phone index`);
          skipped++;
        } else {
          // Create phone index
          await kv.set(`vendor:phone:${cleanedPhone}`, vendorId);
          console.log(`✅ Created phone index: vendor:phone:${cleanedPhone} → ${vendorId}`);
          fixed++;
          
          results.push({
            vendorId,
            phone: cleanedPhone,
            fullName: vendor.fullName || vendor.ownerName,
            status: vendor.status
          });
        }
      }
      
      console.log(`✅ Migration complete: ${fixed} fixed, ${skipped} skipped`);
      
      return sendSuccess(c, {
        stats: {
          total: allVendors.length,
          fixed,
          skipped
        },
        fixed: results
      }, 'Vendor indexes fixed');
      
    } catch (error) {
      console.error('❌ Migration error:', error);
      return sendError(c, error, 500);
    }
  });
  
  console.log('✅ Auth endpoints registered');
}
