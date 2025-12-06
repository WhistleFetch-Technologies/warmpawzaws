/**
 * AUTHENTICATION & USER STATE MANAGEMENT SERVICE
 * 
 * Handles user creation, login, session management, and state persistence
 */

import * as kv from './kv_store.tsx';
import { 
  User, 
  Session, 
  VendorProfile, 
  CustomerProfile, 
  AdminProfile,
  generateId, 
  createSession 
} from './database-schema.tsx';
import { normalizePhone, phonesMatch } from './phone-utils.tsx';

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
  
  // Try to find existing user
  const existingUser = await kv.get(`user:phone:${cleanedPhone}`);
  
  if (existingUser) {
    console.log(`   ✅ Existing user found: ${existingUser.userId}`);
    console.log(`========== FIND OR CREATE USER END (existing) ==========\n`);
    
    // Update last login
    existingUser.lastLoginAt = new Date().toISOString();
    await kv.set(`user:phone:${cleanedPhone}`, existingUser);
    await kv.set(`user:id:${existingUser.userId}`, existingUser);
    
    return existingUser;
  }
  
  // MIGRATION: Check for old vendor profiles before creating new user
  console.log(`   📋 No existing user - checking for OLD vendor profiles to migrate...`);
  
  // Check old vendor profile format: vendor:profile:*
  const oldVendorProfiles = await kv.getByPrefix('vendor:profile:');
  console.log(`   Found ${oldVendorProfiles.length} vendor:profile: entries`);
  
  let oldVendor = null;
  
  for (const profile of oldVendorProfiles) {
    const profileCleanedPhone = profile.phone ? normalizePhone(profile.phone) : null;
    console.log(`      Profile ${profile.id}: phone=${profile.phone} → cleaned=${profileCleanedPhone}`);
    
    if (profile.phone && phonesMatch(profileCleanedPhone, cleanedPhone)) {
      oldVendor = profile;
      console.log(`   🔄 MATCH! Found OLD vendor profile to migrate: ${profile.id}`);
      break;
    }
  }
  
  // If old vendor found, migrate to new system
  if (oldVendor && role === 'vendor') {
    console.log(`   🔄 MIGRATING old vendor to new auth system...`);
    
    const userId = generateId('user');
    const now = new Date().toISOString();
    
    // Create user for old vendor
    const newUser: User = {
      userId,
      phone: cleanedPhone,
      role: 'vendor',
      name: oldVendor.fullName || oldVendor.ownerName,
      email: oldVendor.email,
      isActive: true,
      isVerified: true,
      createdAt: oldVendor.createdAt || now,
      lastLoginAt: now
    };
    
    // Save user
    await kv.set(`user:phone:${cleanedPhone}`, newUser);
    await kv.set(`user:id:${userId}`, newUser);
    
    console.log(`   ✅ Created user for migrated vendor: ${userId}`);
    
    // Update old vendor profile to include userId
    oldVendor.userId = userId;
    oldVendor.updatedAt = now;
    
    // Save updated vendor profile with userId
    const vendorId = oldVendor.id || oldVendor.vendorId;
    await kv.set(`vendor:${vendorId}`, oldVendor);
    
    // Create vendor indexes if they don't exist
    await kv.set(`vendor:user:${userId}`, vendorId);
    await kv.set(`vendor:phone:${cleanedPhone}`, vendorId);
    
    console.log(`   ✅ Migrated vendor profile: ${vendorId} → user: ${userId}`);
    console.log(`   ✅ Created indexes: vendor:user:${userId} and vendor:phone:${cleanedPhone}`);
    console.log(`========== FIND OR CREATE USER END (migrated) ==========\n`);
    
    return newUser;
  }
  
  if (oldVendor && role !== 'vendor') {
    console.log(`   ⚠️ Found old vendor but role mismatch: requested=${role}, found=vendor`);
  }
  
  // Create new user
  const userId = generateId('user');
  const now = new Date().toISOString();
  
  const newUser: User = {
    userId,
    phone: cleanedPhone,
    role: role || 'customer', // Default to customer if not specified
    isActive: true,
    isVerified: true, // Auto-verify for now (OTP would be here)
    createdAt: now,
    lastLoginAt: now
  };
  
  console.log(`   🆕 Creating NEW user: ${userId} with role ${newUser.role}`);
  
  // Store in multiple indexes
  await kv.set(`user:phone:${cleanedPhone}`, newUser);
  await kv.set(`user:id:${userId}`, newUser);
  
  console.log(`========== FIND OR CREATE USER END (new user) ==========\n`);
  
  return newUser;
}

/**
 * Get user by phone
 */
export async function getUserByPhone(phone: string): Promise<User | null> {
  const cleanedPhone = normalizePhone(phone);
  return await kv.get(`user:phone:${cleanedPhone}`);
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  return await kv.get(`user:id:${userId}`);
}

/**
 * Update user
 */
export async function updateUser(userId: string, updates: Partial<User>): Promise<User> {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }
  
  const updatedUser = { ...user, ...updates };
  
  await kv.set(`user:phone:${user.phone}`, updatedUser);
  await kv.set(`user:id:${userId}`, updatedUser);
  
  return updatedUser;
}

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * Create a new session for user
 */
export async function createUserSession(userId: string, phone: string, role: string): Promise<Session> {
  const session = createSession(userId, phone, role);
  
  // Store session
  await kv.set(`session:${session.sessionId}`, session);
  await kv.set(`session:user:${userId}`, session.sessionId);
  await kv.set(`session:phone:${normalizePhone(phone)}`, session.sessionId);
  
  console.log(`🔑 Session created: ${session.sessionId} for user ${userId}`);
  
  return session;
}

/**
 * Get session by session ID
 */
export async function getSession(sessionId: string): Promise<Session | null> {
  const session = await kv.get(`session:${sessionId}`);
  
  if (!session) {
    return null;
  }
  
  // Check if expired
  if (new Date(session.expiresAt) < new Date()) {
    console.log(`⏰ Session expired: ${sessionId}`);
    await deleteSession(sessionId);
    return null;
  }
  
  return session;
}

/**
 * Get session by user ID
 */
export async function getSessionByUserId(userId: string): Promise<Session | null> {
  const sessionId = await kv.get(`session:user:${userId}`);
  if (!sessionId) return null;
  
  return getSession(sessionId);
}

/**
 * Delete session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const session = await kv.get(`session:${sessionId}`);
  
  if (session) {
    await kv.del(`session:${sessionId}`);
    await kv.del(`session:user:${session.userId}`);
    await kv.del(`session:phone:${session.phone}`);
  }
}

// ============================================
// VENDOR STATE MANAGEMENT
// ============================================

import { createVendorId } from "./phone-utils.tsx";

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
  
  // Find vendor profile by userId first
  let vendorId = await kv.get(`vendor:user:${userId}`);
  console.log(`   Step 1 - Check vendor:user:${userId} → ${vendorId || 'NOT FOUND'}`);
  
  let vendor: VendorProfile | null = null;
  let application: any = null;
  let state: any = 'new';
  
  // If not found by userId, try by phone (for old vendor profiles)
  if (!vendorId) {
    console.log(`   Step 2 - Checking by phone...`);
    const cleanedPhone = normalizePhone(phone);
    console.log(`   Cleaned phone: ${cleanedPhone}`);
    
    vendorId = await kv.get(`vendor:phone:${cleanedPhone}`);
    console.log(`   Check vendor:phone:${cleanedPhone} → ${vendorId || 'NOT FOUND'}`);

    // ⚠️ FAST PATH FIX: Check vendor:${createVendorId(phone)} directly
    if (!vendorId) {
       const directVendorId = createVendorId(cleanedPhone);
       const directVendor = await kv.get(`vendor:${directVendorId}`);
       if (directVendor) {
         console.log(`   ✅ FAST PATH MATCH! Found vendor directly at vendor:${directVendorId}`);
         vendor = directVendor;
         vendorId = directVendorId;
         
         // Self-heal indexes
         await kv.set(`vendor:user:${userId}`, vendorId);
         await kv.set(`vendor:phone:${cleanedPhone}`, vendorId);
         // Also ensure the vendor record has the userId
         if (!vendor.userId || vendor.userId !== userId) {
            vendor.userId = userId;
            await kv.set(`vendor:${vendorId}`, vendor);
         }
       }
    }
    
    // Also check old format vendor:profile:*
    if (!vendorId) {
      console.log(`   Step 3 - Checking old vendor:profile: format...`);
      const oldProfiles = await kv.getByPrefix('vendor:profile:');
      console.log(`   Found ${oldProfiles.length} old profiles total`);
      
      for (const profile of oldProfiles) {
        const profileCleanedPhone = profile.phone ? normalizePhone(profile.phone) : null;
        console.log(`      Profile ${profile.id}: phone=${profile.phone} → cleaned=${profileCleanedPhone}`);
        
        if (profile.phone && phonesMatch(profileCleanedPhone, cleanedPhone)) {
          vendor = profile;
          vendorId = profile.id;
          console.log(`   ✅ MATCH! Found old vendor profile: ${vendorId}`);
          
          // Link to user
          await kv.set(`vendor:user:${userId}`, vendorId);
          await kv.set(`vendor:phone:${cleanedPhone}`, vendorId);
          console.log(`   Created indexes for future lookups`);
          
          break;
        }
      }
      
      // Also check vendor:vendor_ format
      if (!vendorId) {
        console.log(`   Step 4 - Checking vendor:vendor_ format...`);
        const allVendors = await kv.getByPrefix('vendor:vendor_');
        console.log(`   Found ${allVendors.length} vendor:vendor_ entries total`);
        
        for (const v of allVendors) {
          const vCleanedPhone = v.phone ? normalizePhone(v.phone) : null;
          console.log(`      Vendor ${v.id || v.vendorId}: phone=${v.phone} → cleaned=${vCleanedPhone}`);
          
          if (v.phone && phonesMatch(vCleanedPhone, cleanedPhone)) {
            vendor = v;
            vendorId = v.id || v.vendorId;
            console.log(`   ✅ MATCH! Found vendor:vendor_ entry: ${vendorId}`);
            
            // 🔧 CRITICAL FIX: Update vendor record with userId if missing
            if (!v.userId || v.userId !== userId) {
              console.log(`   🔧 FIXING: Vendor userId mismatch or missing!`);
              console.log(`      Current userId in vendor: ${v.userId || 'MISSING'}`);
              console.log(`      Correct userId from login: ${userId}`);
              
              v.userId = userId;
              v.updatedAt = new Date().toISOString();
              await kv.set(`vendor:${vendorId}`, v);
              console.log(`   ✅ Updated vendor record with correct userId`);
            }
            
            // Link to user (this will OVERWRITE any wrong index!)
            await kv.set(`vendor:user:${userId}`, vendorId);
            await kv.set(`vendor:phone:${cleanedPhone}`, vendorId);
            console.log(`   Created indexes for future lookups`);
            
            break;
          }
        }
      }
    }
  }
  
  if (vendorId && !vendor) {
    console.log(`   Step 5 - Loading vendor by ID: ${vendorId}`);
    vendor = await kv.get(`vendor:${vendorId}`);
    console.log(`   Vendor loaded: ${vendor ? 'YES' : 'NO'}`);
  }
  
  if (vendor) {
    console.log(`   ✅ Vendor state loaded:`, {
      vendorId: vendor.vendorId || vendor.id,
      status: vendor.status, // NEW FIELD
      applicationStatus: vendor.applicationStatus, // OLD FIELD (backwards compatibility)
      hasApplication: !!vendor.applicationId,
      setupCompleted: vendor.setupCompleted
    });
    
    // Load application if exists
    if (vendor.applicationId) {
      application = await kv.get(`application:${vendor.applicationId}`);
      
      // Determine state based on application status
      if (application) {
        if (application.status === 'approved') {
          state = vendor.setupCompleted ? 'active' : 'approved';
        } else if (application.status === 'rejected') {
          state = 'rejected';
        } else {
          state = 'pending';
        }
      } else {
        state = 'onboarding';
      }
    } else if (vendor.status || vendor.applicationStatus) {
      // CRITICAL FIX: Check BOTH new field (status) and old field (applicationStatus)
      // New vendor onboarding uses 'status', old vendors use 'applicationStatus'
      const vendorStatus = vendor.status || vendor.applicationStatus;
      
      console.log(`   📊 Vendor status field: ${vendorStatus} (from ${vendor.status ? 'vendor.status' : 'vendor.applicationStatus'})`);
      
      if (vendorStatus === 'approved') {
        state = vendor.setupCompleted ? 'active' : 'approved';
        console.log(`   ✅ Vendor approved - setup completed: ${vendor.setupCompleted} → state: ${state}`);
      } else if (vendorStatus === 'rejected') {
        state = 'rejected';
        console.log(`   ❌ Vendor rejected → state: ${state}`);
      } else if (vendorStatus === 'pending' || vendorStatus === 'pending_approval' || vendorStatus === 'under_review') {
        state = 'pending';
        console.log(`   ⏳ Vendor pending approval → state: ${state}`);
      } else {
        state = 'onboarding';
        console.log(`   🔄 Vendor in onboarding → state: ${state}`);
      }
    } else {
      state = 'onboarding';
      console.log(`   🔄 No status found - default to onboarding`);
    }
  } else {
    console.log(`   ❌ NO VENDOR FOUND - State = new`);
  }
  
  console.log(`   📊 Final state: ${state}`);
  console.log(`========== GET VENDOR STATE END ==========\n`);
  
  return { user, vendor, application, state };
}

/**
 * Create or update vendor profile
 */
export async function saveVendorProfile(profile: VendorProfile): Promise<VendorProfile> {
  // Store vendor profile
  await kv.set(`vendor:${profile.vendorId}`, profile);
  
  // Create indexes
  await kv.set(`vendor:user:${profile.userId}`, profile.vendorId);
  await kv.set(`vendor:phone:${profile.phone}`, profile.vendorId);
  
  // Add to type index
  const typeKey = `vendor:type:${profile.vendorType}`;
  const vendorsOfType = await kv.get(typeKey) || [];
  if (!vendorsOfType.includes(profile.vendorId)) {
    vendorsOfType.push(profile.vendorId);
    await kv.set(typeKey, vendorsOfType);
  }
  
  // Add to active index if active
  if (profile.isActive) {
    const activeVendors = await kv.get('vendor:active') || [];
    if (!activeVendors.includes(profile.vendorId)) {
      activeVendors.push(profile.vendorId);
      await kv.set('vendor:active', activeVendors);
    }
  }
  
  console.log(`💾 Vendor profile saved: ${profile.vendorId}`);
  
  return profile;
}

/**
 * Get vendor by user ID
 */
export async function getVendorByUserId(userId: string): Promise<VendorProfile | null> {
  const vendorId = await kv.get(`vendor:user:${userId}`);
  if (!vendorId) return null;
  
  return await kv.get(`vendor:${vendorId}`);
}

/**
 * Get vendor by phone
 */
export async function getVendorByPhone(phone: string): Promise<VendorProfile | null> {
  const vendorId = await kv.get(`vendor:phone:${normalizePhone(phone)}`);
  if (!vendorId) return null;
  
  return await kv.get(`vendor:${vendorId}`);
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
  
  const customerId = await kv.get(`customer:user:${userId}`);
  let customer: CustomerProfile | null = null;
  
  if (customerId) {
    customer = await kv.get(`customer:${customerId}`);
  }
  
  return { user, customer };
}

/**
 * Create or update customer profile
 */
export async function saveCustomerProfile(profile: CustomerProfile): Promise<CustomerProfile> {
  await kv.set(`customer:${profile.customerId}`, profile);
  await kv.set(`customer:user:${profile.userId}`, profile.customerId);
  await kv.set(`customer:phone:${profile.phone}`, profile.customerId);
  
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
  
  const adminId = await kv.get(`admin:user:${userId}`);
  let admin: AdminProfile | null = null;
  
  if (adminId) {
    admin = await kv.get(`admin:${adminId}`);
  }
  
  return { user, admin };
}

/**
 * Create or update admin profile
 */
export async function saveAdminProfile(profile: AdminProfile): Promise<AdminProfile> {
  await kv.set(`admin:${profile.adminId}`, profile);
  await kv.set(`admin:user:${profile.userId}`, profile.adminId);
  
  console.log(`💾 Admin profile saved: ${profile.adminId}`);
  
  return profile;
}