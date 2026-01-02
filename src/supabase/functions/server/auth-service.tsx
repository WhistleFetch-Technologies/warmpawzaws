/**
 * ============================================================================
 * AUTHENTICATION & USER STATE MANAGEMENT SERVICE - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ MIGRATED TO SQL: NO KV STORE - All data from SQL
 * ⚠️ NOTE: Cognito integration will be added in a separate phase
 * 
 * Handles user creation, login, session management, and state persistence
 * 
 * KV Operations: 66 → 0
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ Users stored in customers/vendors/staff tables
 * ✅ Sessions stored in sessions table
 * ✅ Tokens stored in access_tokens table
 */

import { 
  User, 
  Session, 
  VendorProfile, 
  CustomerProfile, 
  AdminProfile,
  generateId, 
  createSession 
} from './database-schema';
import { normalizePhone, phonesMatch } from './phone-utils';
import { createVendorId } from "./phone-utils";
import { getCustomersRepository } from '../../../supabase/lib/repositories/customers';
import { getVendorsRepository } from '../../../supabase/lib/repositories/vendors';
import { getStaffRepository } from '../../../supabase/lib/repositories/staff';
import { getSessionsRepository } from '../../../supabase/lib/repositories/sessions';
import { getAccessTokensRepository } from '../../../supabase/lib/repositories/access-tokens';
import { getDbClient, selectQuery } from '../../../supabase/lib/db';

// ============================================
// USER MANAGEMENT
// ============================================

/**
 * Find or create user by phone number
 * This is called on every login attempt
 */
export async function findOrCreateUser(phone: string, role?: 'customer' | 'vendor' | 'admin'): Promise<User> {
  const cleanedPhone = normalizePhone(phone);
  
  console.log(`\n🔍 ========== FIND OR CREATE USER START ==========`);
  console.log(`   Raw phone: ${phone}`);
  console.log(`   Cleaned phone: ${cleanedPhone}`);
  console.log(`   Requested role: ${role}`);
  
  // Determine target role
  const targetRole = role || 'customer';
  
  // Try to find existing user based on role
  let existingUser: User | null = null;
  
  if (targetRole === 'customer') {
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findByPhone(cleanedPhone);
    if (customer) {
      existingUser = {
        userId: customer.id,
        phone: customer.phone,
        role: 'customer',
        name: customer.full_name || '',
        email: customer.email || '',
        isActive: customer.is_active !== false,
        isVerified: true,
        createdAt: customer.created_at,
        lastLoginAt: customer.last_login_at || customer.created_at
      };
    }
  } else if (targetRole === 'vendor') {
    const vendorsRepo = getVendorsRepository();
    const vendors = await vendorsRepo.findAll({ phone: cleanedPhone });
    const vendor = vendors.find(v => v.phone === cleanedPhone);
    if (vendor) {
      existingUser = {
        userId: vendor.id,
        phone: vendor.phone || cleanedPhone,
        role: 'vendor',
        name: vendor.business_name || '',
        email: vendor.email || '',
        isActive: vendor.is_active !== false,
        isVerified: vendor.approval_status === 'approved',
        createdAt: vendor.created_at,
        lastLoginAt: vendor.last_login_at || vendor.created_at
      };
    }
  } else if (targetRole === 'admin') {
    // Admin users - check if exists (admins might be in a separate table or vendors with admin role)
    // For now, check vendors with admin role
    const vendorsRepo = getVendorsRepository();
    const vendors = await vendorsRepo.findAll({ phone: cleanedPhone });
    const adminVendor = vendors.find(v => v.phone === cleanedPhone && (v as any).role === 'admin');
    if (adminVendor) {
      existingUser = {
        userId: adminVendor.id,
        phone: adminVendor.phone || cleanedPhone,
        role: 'admin',
        name: adminVendor.business_name || '',
        email: adminVendor.email || '',
        isActive: adminVendor.is_active !== false,
        isVerified: true,
        createdAt: adminVendor.created_at,
        lastLoginAt: adminVendor.last_login_at || adminVendor.created_at
      };
    }
  }
  
  if (existingUser) {
    console.log(`   ✅ Existing user found: ${existingUser.userId}`);
    
    // ✅ SQL: Update last login
    if (targetRole === 'customer') {
      const customersRepo = getCustomersRepository();
      await customersRepo.update(existingUser.userId, {
        last_login_at: new Date().toISOString()
      });
    } else if (targetRole === 'vendor') {
      const vendorsRepo = getVendorsRepository();
      await vendorsRepo.update(existingUser.userId, {
        last_login_at: new Date().toISOString()
      });
    }
    
    console.log(`========== FIND OR CREATE USER END (existing) ==========\n`);
    return existingUser;
  }
  
  // Create new user
  console.log(`   🆕 No existing user - creating NEW user with role ${targetRole}`);
  
  const userId = generateId('user');
  const now = new Date().toISOString();
  
  if (targetRole === 'customer') {
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.create({
      phone: cleanedPhone,
      customer_id: `cust_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      full_name: ''
    });
    
    existingUser = {
      userId: customer.id,
      phone: customer.phone,
      role: 'customer',
      name: customer.full_name || '',
      email: customer.email || '',
      isActive: true,
      isVerified: true,
      createdAt: customer.created_at,
      lastLoginAt: now
    };
  } else if (targetRole === 'vendor') {
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.create({
      phone: cleanedPhone,
      vendor_id: createVendorId(cleanedPhone),
      business_name: '',
      role_id: 'vendor' // Will be set properly during onboarding
    });
    
    existingUser = {
      userId: vendor.id,
      phone: vendor.phone || cleanedPhone,
      role: 'vendor',
      name: vendor.business_name || '',
      email: vendor.email || '',
      isActive: vendor.is_active !== false,
      isVerified: false,
      createdAt: vendor.created_at,
      lastLoginAt: now
    };
  } else {
    // Admin - create as vendor with admin role for now
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.create({
      phone: cleanedPhone,
      vendor_id: `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      business_name: '',
      role_id: 'admin'
    });
    
    existingUser = {
      userId: vendor.id,
      phone: vendor.phone || cleanedPhone,
      role: 'admin',
      name: vendor.business_name || '',
      email: vendor.email || '',
      isActive: true,
      isVerified: true,
      createdAt: vendor.created_at,
      lastLoginAt: now
    };
  }
  
  console.log(`========== FIND OR CREATE USER END (new user) ==========\n`);
  
  return existingUser!;
}

/**
 * Get user by phone
 */
export async function getUserByPhone(phone: string): Promise<User | null> {
  const cleanedPhone = normalizePhone(phone);
  
  // Try customer first
  const customersRepo = getCustomersRepository();
  const customer = await customersRepo.findByPhone(cleanedPhone);
  if (customer) {
    return {
      userId: customer.id,
      phone: customer.phone,
      role: 'customer',
      name: customer.full_name || '',
      email: customer.email || '',
      isActive: customer.is_active !== false,
      isVerified: true,
      createdAt: customer.created_at,
      lastLoginAt: customer.last_login_at || customer.created_at
    };
  }
  
  // Try vendor
  const vendorsRepo = getVendorsRepository();
  const vendors = await vendorsRepo.findAll({ phone: cleanedPhone });
  const vendor = vendors.find(v => v.phone === cleanedPhone);
  if (vendor) {
    return {
      userId: vendor.id,
      phone: vendor.phone || cleanedPhone,
      role: 'vendor',
      name: vendor.business_name || '',
      email: vendor.email || '',
      isActive: vendor.is_active !== false,
      isVerified: vendor.approval_status === 'approved',
      createdAt: vendor.created_at,
      lastLoginAt: vendor.last_login_at || vendor.created_at
    };
  }
  
  return null;
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  // Try customer first
  const customersRepo = getCustomersRepository();
  try {
    const customer = await customersRepo.findById(userId);
    if (customer) {
      return {
        userId: customer.id,
        phone: customer.phone,
        role: 'customer',
        name: customer.full_name || '',
        email: customer.email || '',
        isActive: customer.is_active !== false,
        isVerified: true,
        createdAt: customer.created_at,
        lastLoginAt: customer.last_login_at || customer.created_at
      };
    }
  } catch (e) {
    // Not a customer, try vendor
  }
  
  // Try vendor
  const vendorsRepo = getVendorsRepository();
  try {
    const vendor = await vendorsRepo.findById(userId) || await vendorsRepo.findByVendorId(userId);
    if (vendor) {
      return {
        userId: vendor.id,
        phone: vendor.phone || '',
        role: 'vendor',
        name: vendor.business_name || '',
        email: vendor.email || '',
        isActive: vendor.is_active !== false,
        isVerified: vendor.approval_status === 'approved',
        createdAt: vendor.created_at,
        lastLoginAt: vendor.last_login_at || vendor.created_at
      };
    }
  } catch (e) {
    // Not a vendor
  }
  
  return null;
}

/**
 * Update user
 */
export async function updateUser(userId: string, updates: Partial<User>): Promise<User> {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }
  
  if (user.role === 'customer') {
    const customersRepo = getCustomersRepository();
    await customersRepo.update(userId, {
      full_name: updates.name || undefined,
      email: updates.email || undefined,
      is_active: updates.isActive
    });
  } else if (user.role === 'vendor') {
    const vendorsRepo = getVendorsRepository();
    await vendorsRepo.update(userId, {
      business_name: updates.name || undefined,
      email: updates.email || undefined,
      is_active: updates.isActive
    });
  }
  
  const updatedUser = await getUserById(userId);
  if (!updatedUser) {
    throw new Error('Failed to update user');
  }
  
  return updatedUser;
}

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * Create a new session for user
 */
export async function createUserSession(userId: string, phone: string, role: string): Promise<Session> {
  const sessionId = generateId('session');
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(); // 48 hours
  
  const token = createSession(userId, role as 'customer' | 'vendor' | 'staff' | 'admin');
  
  // ✅ SQL: Create session
  const sessionsRepo = getSessionsRepository();
  const session = await sessionsRepo.create({
    user_id: userId,
    user_type: role,
    token: token,
    expires_in_days: 2 // 48 hours
  });
  
  const sessionData: Session = {
    sessionId: session.id,
    userId: session.user_id,
    phone: normalizePhone(phone),
    role: role as 'customer' | 'vendor' | 'staff' | 'admin',
    token: session.token,
    createdAt: session.created_at,
    expiresAt: session.expires_at
  };
  
  console.log(`🔑 Session created: ${session.id} for user ${userId}`);
  
  return sessionData;
}

/**
 * Get session by session ID
 */
export async function getSession(sessionId: string): Promise<Session | null> {
  // ✅ SQL: Get session
  const sessionsRepo = getSessionsRepository();
  const session = await sessionsRepo.findById(sessionId);
  
  if (!session || !session.is_active) {
    return null;
  }
  
  // Check if expired
  if (new Date(session.expires_at) < new Date()) {
    console.log(`⏰ Session expired: ${sessionId}`);
    await deleteSession(sessionId);
    return null;
  }
  
  return {
    sessionId: session.id,
    userId: session.user_id,
    phone: '', // Phone not stored in session table
    role: session.user_type as 'customer' | 'vendor' | 'staff' | 'admin',
    token: session.token,
    createdAt: session.created_at,
    expiresAt: session.expires_at
  };
}

/**
 * ✅ SECURITY FIX: Get session by user ID
 */
export async function getSessionByUserId(userId: string): Promise<Session | null> {
  // ✅ SQL: Get latest session for user
  const sessionsRepo = getSessionsRepository();
  const sessions = await sessionsRepo.findByUser(userId, 'customer', { limit: 1 });
  
  if (sessions.length === 0) {
    // Try vendor
    const vendorSessions = await sessionsRepo.findByUser(userId, 'vendor', { limit: 1 });
    if (vendorSessions.length > 0) {
      const session = vendorSessions[0];
      return {
        sessionId: session.id,
        userId: session.user_id,
        phone: '',
        role: session.user_type as 'customer' | 'vendor' | 'staff' | 'admin',
        token: session.token,
        createdAt: session.created_at,
        expiresAt: session.expires_at
      };
    }
    return null;
  }
  
  const session = sessions[0];
  return {
    sessionId: session.id,
    userId: session.user_id,
    phone: '',
    role: session.user_type as 'customer' | 'vendor' | 'staff' | 'admin',
    token: session.token,
    createdAt: session.created_at,
    expiresAt: session.expires_at
  };
}

/**
 * Delete session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  // ✅ SQL: Invalidate session
  const sessionsRepo = getSessionsRepository();
  await sessionsRepo.invalidate(sessionId);
}

// ============================================
// TOKEN MANAGEMENT
// ============================================

/**
 * ✅ SECURITY FIX: Generate access token for authenticated API calls
 * Tokens are stored in SQL and validated on each API call
 */
export async function generateAccessToken(userId: string, phone: string, role: string): Promise<string> {
  const cleanedPhone = normalizePhone(phone);
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).substring(2, 15);
  
  // Create token with user info embedded
  const token = `${userId}_${cleanedPhone}_${timestamp}_${randomPart}`;
  
  // ✅ SQL: Store token
  const expiresAt = new Date(timestamp + (48 * 60 * 60 * 1000)); // 48 hours
  const tokensRepo = getAccessTokensRepository();
  
  await tokensRepo.create({
    token,
    user_id: userId,
    user_type: role,
    phone: cleanedPhone,
    role: role,
    expires_at: expiresAt.toISOString()
  });
  
  console.log(`🔐 Access token created: ${token.substring(0, 20)}... for user ${userId}, expires in 48 hours`);
  
  return token;
}

/**
 * ✅ SECURITY FIX: Validate access token
 * Returns token data if valid, null if invalid/expired
 */
export async function validateAccessToken(token: string): Promise<any | null> {
  if (!token) {
    return null;
  }
  
  // ✅ SQL: Get token data
  const tokensRepo = getAccessTokensRepository();
  const tokenData = await tokensRepo.findByToken(token);
  
  if (!tokenData) {
    console.log(`❌ Invalid token: not found`);
    return null;
  }
  
  // Check if expired
  if (new Date(tokenData.expires_at) < new Date()) {
    console.log(`❌ Token expired: ${token.substring(0, 20)}...`);
    await tokensRepo.invalidate(token);
    return null;
  }
  
  console.log(`✅ Token validated for user ${tokenData.user_id}`);
  return {
    token: tokenData.token,
    userId: tokenData.user_id,
    phone: tokenData.phone,
    role: tokenData.role,
    createdAt: tokenData.created_at,
    expiresAt: tokenData.expires_at
  };
}

/**
 * Delete (invalidate) access token
 */
export async function deleteAccessToken(token: string): Promise<void> {
  // ✅ SQL: Invalidate token
  const tokensRepo = getAccessTokensRepository();
  await tokensRepo.invalidate(token);
  console.log(`🗑️ Token deleted: ${token.substring(0, 20)}...`);
}

// ============================================
// VENDOR STATE MANAGEMENT
// ============================================

/**
 * Get complete vendor state
 * Returns vendor profile + application status
 */
export async function getVendorState(userId: string, phone: string): Promise<{
  user: User;
  vendor: VendorProfile | null;
  application: any | null;
  state: 'new' | 'onboarding' | 'pending' | 'approved' | 'rejected' | 'active';
}> {
  console.log(`\n🔍 ========== GET VENDOR STATE START ==========`);
  console.log(`   Phone: ${phone}`);
  console.log(`   User ID: ${userId}`);
  
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  
  // ✅ SQL: Get vendor by user ID or phone
  const vendorsRepo = getVendorsRepository();
  let vendor = await vendorsRepo.findById(userId) || await vendorsRepo.findByVendorId(userId);
  
  if (!vendor) {
    const cleanedPhone = normalizePhone(phone);
    const vendors = await vendorsRepo.findAll({ phone: cleanedPhone });
    vendor = vendors.find(v => v.phone === cleanedPhone) || null;
  }
  
  let application: any = null;
  let state: any = 'new';
  
  if (vendor) {
    // Application status is in vendor metadata or status field
    const status = vendor.approval_status || (vendor as any).status || 'pending';
    
    if (status === 'approved') {
      state = (vendor as any).setupCompleted ? 'active' : 'approved';
    } else if (status === 'rejected') {
      state = 'rejected';
    } else if (status === 'pending' || status === 'pending_approval') {
      state = 'pending';
    } else {
      state = 'onboarding';
    }
    
    // Convert vendor to VendorProfile format
    const vendorProfile: VendorProfile = {
      vendorId: vendor.id,
      userId: userId,
      phone: vendor.phone || phone,
      businessName: vendor.business_name || '',
      vendorType: vendor.role_id || 'vendor',
      status: status,
      applicationStatus: status, // For backwards compatibility
      isActive: vendor.is_active !== false,
      setupCompleted: (vendor as any).setupCompleted || false
    };
    
    console.log(`   ✅ Vendor state loaded: ${state}`);
    console.log(`========== GET VENDOR STATE END ==========\n`);
    
    return { user, vendor: vendorProfile, application, state };
  }
  
  console.log(`   ❌ NO VENDOR FOUND - State = new`);
  console.log(`========== GET VENDOR STATE END ==========\n`);
  
  return { user, vendor: null, application: null, state: 'new' };
}

/**
 * Create or update vendor profile
 */
export async function saveVendorProfile(profile: VendorProfile): Promise<VendorProfile> {
  // ✅ SQL: Save vendor profile
  const vendorsRepo = getVendorsRepository();
  
  const existingVendor = await vendorsRepo.findById(profile.vendorId) || 
                        await vendorsRepo.findByVendorId(profile.vendorId);
  
  if (existingVendor) {
    await vendorsRepo.update(existingVendor.id, {
      business_name: profile.businessName,
      phone: profile.phone,
      role_id: profile.vendorType,
      is_active: profile.isActive,
      approval_status: profile.status as any
    });
  } else {
    await vendorsRepo.create({
      vendor_id: profile.vendorId,
      business_name: profile.businessName,
      phone: profile.phone,
      role_id: profile.vendorType
    });
  }
  
  console.log(`💾 Vendor profile saved: ${profile.vendorId}`);
  
  return profile;
}

/**
 * Get vendor by user ID
 */
export async function getVendorByUserId(userId: string): Promise<VendorProfile | null> {
  // ✅ SQL: Get vendor
  const vendorsRepo = getVendorsRepository();
  const vendor = await vendorsRepo.findById(userId) || await vendorsRepo.findByVendorId(userId);
  
  if (!vendor) {
    return null;
  }
  
  return {
    vendorId: vendor.id,
    userId: userId,
    phone: vendor.phone || '',
    businessName: vendor.business_name || '',
    vendorType: vendor.role_id || 'vendor',
    status: vendor.approval_status || 'pending',
    applicationStatus: vendor.approval_status || 'pending',
    isActive: vendor.is_active !== false,
    setupCompleted: (vendor as any).setupCompleted || false
  };
}

/**
 * Get vendor by phone
 */
export async function getVendorByPhone(phone: string): Promise<VendorProfile | null> {
  // ✅ SQL: Get vendor by phone
  const vendorsRepo = getVendorsRepository();
  const vendors = await vendorsRepo.findAll({ phone: normalizePhone(phone) });
  const vendor = vendors.find(v => v.phone === normalizePhone(phone));
  
  if (!vendor) {
    return null;
  }
  
  return {
    vendorId: vendor.id,
    userId: vendor.id, // Use vendor ID as user ID for now
    phone: vendor.phone || phone,
    businessName: vendor.business_name || '',
    vendorType: vendor.role_id || 'vendor',
    status: vendor.approval_status || 'pending',
    applicationStatus: vendor.approval_status || 'pending',
    isActive: vendor.is_active !== false,
    setupCompleted: (vendor as any).setupCompleted || false
  };
}

// ============================================
// CUSTOMER STATE MANAGEMENT
// ============================================

/**
 * Get customer state
 */
export async function getCustomerState(userId: string): Promise<{
  user: User;
  customer: CustomerProfile | null;
}> {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  
  // ✅ SQL: Get customer
  const customersRepo = getCustomersRepository();
  const customer = await customersRepo.findById(userId);
  
  const customerProfile: CustomerProfile | null = customer ? {
    customerId: customer.id,
    userId: userId,
    phone: customer.phone,
    name: customer.full_name || '',
    email: customer.email || ''
  } : null;
  
  return { user, customer: customerProfile };
}

/**
 * Create or update customer profile
 */
export async function saveCustomerProfile(profile: CustomerProfile): Promise<CustomerProfile> {
  // ✅ SQL: Save customer profile
  const customersRepo = getCustomersRepository();
  
  const existingCustomer = await customersRepo.findById(profile.customerId);
  if (existingCustomer) {
    await customersRepo.update(profile.customerId, {
      full_name: profile.name,
      email: profile.email,
      phone: profile.phone
    });
  } else {
    await customersRepo.create({
      customer_id: profile.customerId,
      phone: profile.phone,
      full_name: profile.name,
      email: profile.email
    });
  }
  
  console.log(`💾 Customer profile saved: ${profile.customerId}`);
  
  return profile;
}

// ============================================
// ADMIN STATE MANAGEMENT  
// ============================================

/**
 * Get admin state
 */
export async function getAdminState(userId: string): Promise<{
  user: User;
  admin: AdminProfile | null;
}> {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  
  // Admins are vendors with admin role
  const vendorsRepo = getVendorsRepository();
  const vendor = await vendorsRepo.findById(userId);
  
  const adminProfile: AdminProfile | null = (vendor && (vendor as any).role === 'admin') ? {
    adminId: vendor.id,
    userId: userId,
    name: vendor.business_name || ''
  } : null;
  
  return { user, admin: adminProfile };
}

/**
 * Create or update admin profile
 */
export async function saveAdminProfile(profile: AdminProfile): Promise<AdminProfile> {
  // Admins stored as vendors with admin role
  const vendorsRepo = getVendorsRepository();
  const vendor = await vendorsRepo.findById(profile.adminId) || await vendorsRepo.findByVendorId(profile.adminId);
  
  if (vendor) {
    await vendorsRepo.update(vendor.id, {
      business_name: profile.name,
      role_id: 'admin'
    });
  }
  
  console.log(`💾 Admin profile saved: ${profile.adminId}`);
  
  return profile;
}
