import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { normalizePhone } from "./phone-utils.tsx";

/**
 * Standalone function to run the fix
 */
export async function fixStaffUsersNow() {
  try {
    console.log('\n🔧 ===== STARTING SELF-HEALING: STAFF USERS =====');
    
    // 1. Get all staff records
    const allStaff = await kv.getByPrefix('staff:');
    
    // Filter for actual staff objects (not indexes)
    const staffRecords = allStaff.filter((s: any) => 
      s && typeof s === 'object' && s.id && s.id.startsWith('staff_') && s.phone
    );
    
    console.log(`📋 Found ${staffRecords.length} staff records to check`);
    
    let fixedCount = 0;
    
    for (const staff of staffRecords) {
      try {
        const phone = staff.phone;
        const normalizedPhone = normalizePhone(phone);
        const staffId = staff.id;
        
        let updated = false;
        
        // CHECK 1: User Record (for Login)
        const userKey = `user:phone:${normalizedPhone}`;
        const existingUser = await kv.get(userKey);
        
        if (!existingUser) {
          const userId = `user_${normalizedPhone}`;
          const userRecord = {
            id: userId,
            userId: userId,
            phone: normalizedPhone,
            role: 'staff',
            roleType: staff.roleType || 'staff',
            name: staff.fullName,
            vendorId: staff.vendorId,
            staffId: staffId,
            createdAt: staff.createdAt,
            updatedAt: new Date().toISOString(),
            isFixed: true
          };
          
          await kv.set(userKey, userRecord);
          console.log(`      ✅ Created missing user record: ${userKey}`);
          updated = true;
        } else if (existingUser.role !== 'staff') {
            existingUser.role = 'staff';
            existingUser.staffId = staffId;
            await kv.set(userKey, existingUser);
            console.log(`      ✅ Updated existing user role to 'staff': ${userKey}`);
            updated = true;
        }
        
        // CHECK 2: Staff Phone Index (for lookup)
        const indexKey = `staff:phone:${normalizedPhone}`;
        const existingIndex = await kv.get(indexKey);
        
        if (!existingIndex || existingIndex !== staffId) {
          await kv.set(indexKey, staffId);
          console.log(`      ✅ Fixed staff phone index: ${indexKey}`);
          updated = true;
        }
        
        if (updated) fixedCount++;
        
      } catch (err) {
        console.error(`      ❌ Error processing staff ${staff.id}:`, err);
      }
    }
    
    console.log(`🎉 ===== SELF-HEALING COMPLETE: Fixed ${fixedCount} staff users =====\n`);
    return fixedCount;
    
  } catch (error) {
    console.error('❌ Fatal error in staff user fix:', error);
    return 0;
  }
}

export function registerStaffUserFix(app: Hono) {
  /**
   * POST /fix/staff-users
   * Manual trigger
   */
  app.post("/make-server-3dd53475/fix/staff-users", async (c) => {
    const count = await fixStaffUsersNow();
    return c.json({ success: true, fixed: count });
  });
}

