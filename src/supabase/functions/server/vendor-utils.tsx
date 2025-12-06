/**
 * Vendor Utilities
 * 
 * CRITICAL: These utilities ensure database consistency for vendor records.
 * ALWAYS use saveVendor() instead of kv.set() directly to ensure indexes are created.
 */

import * as kv from './kv_store.tsx';

/**
 * Save vendor with automatic index creation
 * 
 * This is the ONLY function that should be used to save vendor records.
 * It ensures all necessary indexes are created automatically.
 * 
 * INDEXES CREATED:
 * 1. vendor:phone:{phone} → vendorId (for login lookup)
 * 2. vendor:user:{userId} → vendorId (for auth lookup)
 * 3. vendor:email:{email} → vendorId (for email lookup, optional)
 * 
 * @param vendorData - Complete vendor object with id, phone, and optionally userId/email
 * @returns Promise<void>
 */
export async function saveVendor(vendorData: any): Promise<void> {
  const vendorId = vendorData.id;
  
  if (!vendorId) {
    throw new Error('❌ saveVendor: vendorData.id is required');
  }
  
  if (!vendorId.startsWith('vendor_')) {
    throw new Error(`❌ saveVendor: vendorId must start with 'vendor_', got: ${vendorId}`);
  }
  
  console.log(`💾 Saving vendor: ${vendorId}`);
  
  // 1. Save main vendor record
  await kv.set(`vendor:${vendorId}`, vendorData);
  console.log(`   ✅ Main record saved: vendor:${vendorId}`);
  
  // 2. Create phone index (REQUIRED for login)
  if (vendorData.phone) {
    const { normalizePhone } = await import('./phone-utils.tsx');
    const cleanPhone = normalizePhone(vendorData.phone);
    await kv.set(`vendor:phone:${cleanPhone}`, vendorId);
    console.log(`   ✅ Phone index created: vendor:phone:${cleanPhone} → ${vendorId}`);
  } else {
    console.warn(`   ⚠️ No phone number - phone index not created`);
  }
  
  // 3. Create user index (REQUIRED for auth)
  if (vendorData.userId) {
    await kv.set(`vendor:user:${vendorData.userId}`, vendorId);
    console.log(`   ✅ User index created: vendor:user:${vendorData.userId} → ${vendorId}`);
  } else {
    console.warn(`   ⚠️ No userId - user index not created`);
  }
  
  // 4. Create email index (OPTIONAL - for future use)
  if (vendorData.email) {
    const cleanEmail = vendorData.email.toLowerCase().trim();
    await kv.set(`vendor:email:${cleanEmail}`, vendorId);
    console.log(`   ✅ Email index created: vendor:email:${cleanEmail} → ${vendorId}`);
  }
  
  console.log(`✅ Vendor saved with all indexes: ${vendorId}`);
}

/**
 * Update vendor with automatic index management
 * 
 * Updates vendor record and handles index changes if phone/email/userId changed.
 * 
 * @param vendorId - Vendor ID
 * @param updates - Partial vendor data to update
 * @returns Promise<any> - Updated vendor object
 */
export async function updateVendor(vendorId: string, updates: any): Promise<any> {
  console.log(`🔄 Updating vendor: ${vendorId}`);
  
  // Get existing vendor
  const existingVendor = await kv.get(`vendor:${vendorId}`);
  
  if (!existingVendor) {
    throw new Error(`❌ Vendor not found: ${vendorId}`);
  }
  
  // Merge updates
  const updatedVendor = {
    ...existingVendor,
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  // Check if phone changed - need to update phone index
  if (updates.phone && updates.phone !== existingVendor.phone) {
    const { normalizePhone } = await import('./phone-utils.tsx');
    
    // Delete old phone index
    if (existingVendor.phone) {
      const oldPhone = normalizePhone(existingVendor.phone);
      await kv.del(`vendor:phone:${oldPhone}`);
      console.log(`   🗑️ Deleted old phone index: vendor:phone:${oldPhone}`);
    }
    
    // Create new phone index
    const newPhone = normalizePhone(updates.phone);
    await kv.set(`vendor:phone:${newPhone}`, vendorId);
    console.log(`   ✅ Created new phone index: vendor:phone:${newPhone}`);
  }
  
  // Check if userId changed - need to update user index
  if (updates.userId && updates.userId !== existingVendor.userId) {
    // Delete old user index
    if (existingVendor.userId) {
      await kv.del(`vendor:user:${existingVendor.userId}`);
      console.log(`   🗑️ Deleted old user index: vendor:user:${existingVendor.userId}`);
    }
    
    // Create new user index
    await kv.set(`vendor:user:${updates.userId}`, vendorId);
    console.log(`   ✅ Created new user index: vendor:user:${updates.userId}`);
  }
  
  // Check if email changed - need to update email index
  if (updates.email && updates.email !== existingVendor.email) {
    // Delete old email index
    if (existingVendor.email) {
      const oldEmail = existingVendor.email.toLowerCase().trim();
      await kv.del(`vendor:email:${oldEmail}`);
      console.log(`   🗑️ Deleted old email index: vendor:email:${oldEmail}`);
    }
    
    // Create new email index
    const newEmail = updates.email.toLowerCase().trim();
    await kv.set(`vendor:email:${newEmail}`, vendorId);
    console.log(`   ✅ Created new email index: vendor:email:${newEmail}`);
  }
  
  // Save updated vendor
  await kv.set(`vendor:${vendorId}`, updatedVendor);
  console.log(`✅ Vendor updated: ${vendorId}`);
  
  return updatedVendor;
}

/**
 * Get vendor by ID
 * 
 * @param vendorId - Vendor ID
 * @returns Promise<any | null> - Vendor object or null
 */
export async function getVendor(vendorId: string): Promise<any | null> {
  return await kv.get(`vendor:${vendorId}`);
}

/**
 * Get vendor by phone number
 * 
 * @param phone - Phone number (will be normalized)
 * @returns Promise<any | null> - Vendor object or null
 */
export async function getVendorByPhone(phone: string): Promise<any | null> {
  const { normalizePhone } = await import('./phone-utils.tsx');
  const cleanPhone = normalizePhone(phone);
  const vendorId = await kv.get(`vendor:phone:${cleanPhone}`);
  
  if (!vendorId) {
    return null;
  }
  
  return await kv.get(`vendor:${vendorId}`);
}

/**
 * Get vendor by user ID
 * 
 * @param userId - User ID from Supabase Auth
 * @returns Promise<any | null> - Vendor object or null
 */
export async function getVendorByUserId(userId: string): Promise<any | null> {
  const vendorId = await kv.get(`vendor:user:${userId}`);
  
  if (!vendorId) {
    return null;
  }
  
  return await kv.get(`vendor:${vendorId}`);
}

/**
 * Get vendor by email
 * 
 * @param email - Email address
 * @returns Promise<any | null> - Vendor object or null
 */
export async function getVendorByEmail(email: string): Promise<any | null> {
  const cleanEmail = email.toLowerCase().trim();
  const vendorId = await kv.get(`vendor:email:${cleanEmail}`);
  
  if (!vendorId) {
    return null;
  }
  
  return await kv.get(`vendor:${vendorId}`);
}

/**
 * Delete vendor and all indexes
 * 
 * @param vendorId - Vendor ID
 * @returns Promise<void>
 */
export async function deleteVendor(vendorId: string): Promise<void> {
  const vendor = await getVendor(vendorId);
  
  if (!vendor) {
    console.warn(`⚠️ Vendor not found for deletion: ${vendorId}`);
    return;
  }
  
  // Delete indexes
  if (vendor.phone) {
    const { normalizePhone } = await import('./phone-utils.tsx');
    const cleanPhone = normalizePhone(vendor.phone);
    await kv.del(`vendor:phone:${cleanPhone}`);
    console.log(`   🗑️ Deleted phone index: vendor:phone:${cleanPhone}`);
  }
  
  if (vendor.userId) {
    await kv.del(`vendor:user:${vendor.userId}`);
    console.log(`   🗑️ Deleted user index: vendor:user:${vendor.userId}`);
  }
  
  if (vendor.email) {
    const cleanEmail = vendor.email.toLowerCase().trim();
    await kv.del(`vendor:email:${cleanEmail}`);
    console.log(`   🗑️ Deleted email index: vendor:email:${cleanEmail}`);
  }
  
  // Delete main record
  await kv.del(`vendor:${vendorId}`);
  console.log(`🗑️ Vendor deleted: ${vendorId}`);
}

/**
 * Ensure indexes exist for a vendor (idempotent)
 * 
 * This can be called at any time to ensure indexes are created.
 * Safe to run multiple times.
 * 
 * @param vendorId - Vendor ID
 * @returns Promise<{ created: string[], existed: string[] }>
 */
export async function ensureVendorIndexes(vendorId: string): Promise<{ created: string[], existed: string[] }> {
  const vendor = await getVendor(vendorId);
  
  if (!vendor) {
    throw new Error(`❌ Vendor not found: ${vendorId}`);
  }
  
  const created: string[] = [];
  const existed: string[] = [];
  
  // Phone index
  if (vendor.phone) {
    const { normalizePhone } = await import('./phone-utils.tsx');
    const cleanPhone = normalizePhone(vendor.phone);
    const phoneIndexKey = `vendor:phone:${cleanPhone}`;
    const existingPhoneIndex = await kv.get(phoneIndexKey);
    
    if (!existingPhoneIndex) {
      await kv.set(phoneIndexKey, vendorId);
      created.push(phoneIndexKey);
    } else {
      existed.push(phoneIndexKey);
    }
  }
  
  // User index
  if (vendor.userId) {
    const userIndexKey = `vendor:user:${vendor.userId}`;
    const existingUserIndex = await kv.get(userIndexKey);
    
    if (!existingUserIndex) {
      await kv.set(userIndexKey, vendorId);
      created.push(userIndexKey);
    } else {
      existed.push(userIndexKey);
    }
  }
  
  // Email index
  if (vendor.email) {
    const cleanEmail = vendor.email.toLowerCase().trim();
    const emailIndexKey = `vendor:email:${cleanEmail}`;
    const existingEmailIndex = await kv.get(emailIndexKey);
    
    if (!existingEmailIndex) {
      await kv.set(emailIndexKey, vendorId);
      created.push(emailIndexKey);
    } else {
      existed.push(emailIndexKey);
    }
  }
  
  return { created, existed };
}
