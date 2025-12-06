/**
 * Staff Migration Endpoints
 * Migrate old clinic-doctor records to new staff-auth system
 */

import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";

const app = new Hono();

/**
 * POST /admin/migrate/doctors-to-staff
 * Migrate all old doctor records to new staff format
 */
app.post("/admin/migrate/doctors-to-staff", async (c) => {
  try {
    console.log('🔄 Starting doctor → staff migration...');
    
    // Get all old doctor records
    const oldDoctors = await kv.getByPrefix("doctor:");
    console.log(`📋 Found ${oldDoctors.length} old doctor records`);
    
    const results = {
      total: oldDoctors.length,
      migrated: 0,
      skipped: 0,
      errors: []
    };
    
    for (const doctorItem of oldDoctors) {
      try {
        const oldDoctor = doctorItem.value;
        
        // Check if already migrated (has staff record with same phone)
        if (oldDoctor.phone) {
          const allStaff = await kv.getByPrefix("staff:");
          const existingStaff = allStaff.find((s: any) => s.value?.phone === oldDoctor.phone);
          
          if (existingStaff) {
            console.log(`⏭️  Skipping ${oldDoctor.name} - already migrated`);
            results.skipped++;
            continue;
          }
        }
        
        // Create new staff record
        const staffId = `staff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const newStaff = {
          id: staffId,
          vendorId: oldDoctor.clinicId || oldDoctor.vendorId,
          fullName: oldDoctor.name || oldDoctor.fullName,
          phone: oldDoctor.phone || `${Date.now()}`, // Generate temporary if missing
          email: oldDoctor.email || '',
          role: 'doctor',
          roleType: 'clinic_doctor',
          specializations: oldDoctor.specialization || [],
          degree: oldDoctor.qualifications || 'Not specified',
          experience: oldDoctor.experience || 0,
          photo: oldDoctor.profilePhoto || '', // May be empty - needs update
          bio: oldDoctor.about || '',
          consultationFee: oldDoctor.consultationFee || 0,
          
          // Service configuration
          services: [],
          
          // Schedule - default
          availability: {
            monday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
            tuesday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
            wednesday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
            thursday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
            friday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
            saturday: { enabled: true, slots: [{ start: '09:00', end: '12:00' }] },
            sunday: { enabled: false, slots: [] }
          },
          
          // Status
          status: oldDoctor.isActive ? 'active' : 'inactive',
          isActive: oldDoctor.isActive || true,
          
          // Stats - copy from old record
          totalAppointments: oldDoctor.totalAppointments || 0,
          completedAppointments: oldDoctor.completedAppointments || 0,
          totalEarnings: 0,
          rating: oldDoctor.rating || 0,
          reviewCount: oldDoctor.totalReviews || 0,
          
          // Metadata
          createdAt: oldDoctor.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLogin: null,
          
          // Migration marker
          _migratedFrom: doctorItem.key,
          _migrationDate: new Date().toISOString()
        };
        
        // Save new staff record
        await kv.set(`staff:${staffId}`, newStaff);
        
        // Add to vendor's staff list
        const vendorId = newStaff.vendorId;
        if (vendorId) {
          const vendorStaffKey = `vendor:${vendorId}:staff`;
          const vendorStaff = await kv.get(vendorStaffKey) || [];
          if (!vendorStaff.includes(staffId)) {
            vendorStaff.push(staffId);
            await kv.set(vendorStaffKey, vendorStaff);
          }
        }
        
        // Also update bookings to reference staffId
        const bookings = await kv.getByPrefix("booking:");
        for (const bookingItem of bookings) {
          const booking = bookingItem.value;
          if (booking.doctorId === doctorItem.key.split(':')[1]) {
            booking.staffId = staffId;
            await kv.set(bookingItem.key, booking);
          }
        }
        
        console.log(`✅ Migrated: ${oldDoctor.name} → ${staffId}`);
        results.migrated++;
        
      } catch (error) {
        console.error(`❌ Error migrating doctor:`, error);
        results.errors.push({
          doctor: doctorItem.key,
          error: String(error)
        });
      }
    }
    
    console.log('✅ Migration complete:', results);
    
    return c.json({
      success: true,
      message: 'Doctor migration completed',
      results
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return c.json({ 
      success: false,
      error: String(error) 
    }, 500);
  }
});

/**
 * POST /vendor/:vendorId/migrate-doctors
 * Migrate doctors for a specific vendor/clinic
 */
app.post("/vendor/:vendorId/migrate-doctors", async (c) => {
  try {
    const vendorId = c.req.param("vendorId");
    console.log(`🔄 Migrating doctors for vendor: ${vendorId}`);
    
    // Get all doctors for this clinic
    const allDoctors = await kv.getByPrefix("doctor:");
    const vendorDoctors = allDoctors.filter((d: any) => 
      d.value?.clinicId === vendorId || d.value?.vendorId === vendorId
    );
    
    console.log(`📋 Found ${vendorDoctors.length} doctors for this vendor`);
    
    const results = {
      total: vendorDoctors.length,
      migrated: 0,
      skipped: 0
    };
    
    for (const doctorItem of vendorDoctors) {
      const oldDoctor = doctorItem.value;
      
      // Check if already migrated
      if (oldDoctor.phone) {
        const allStaff = await kv.getByPrefix("staff:");
        const existingStaff = allStaff.find((s: any) => s.value?.phone === oldDoctor.phone);
        
        if (existingStaff) {
          results.skipped++;
          continue;
        }
      }
      
      // Create new staff record (same logic as above)
      const staffId = `staff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newStaff = {
        id: staffId,
        vendorId: vendorId,
        fullName: oldDoctor.name || oldDoctor.fullName,
        phone: oldDoctor.phone || `${Date.now()}`,
        email: oldDoctor.email || '',
        role: 'doctor',
        roleType: 'clinic_doctor',
        specializations: oldDoctor.specialization || [],
        degree: oldDoctor.qualifications || 'Not specified',
        experience: oldDoctor.experience || 0,
        photo: oldDoctor.profilePhoto || '',
        bio: oldDoctor.about || '',
        consultationFee: oldDoctor.consultationFee || 0,
        services: [],
        availability: {
          monday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
          tuesday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
          wednesday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
          thursday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
          friday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
          saturday: { enabled: true, slots: [{ start: '09:00', end: '12:00' }] },
          sunday: { enabled: false, slots: [] }
        },
        status: 'active',
        isActive: true,
        totalAppointments: oldDoctor.totalAppointments || 0,
        completedAppointments: oldDoctor.completedAppointments || 0,
        totalEarnings: 0,
        rating: oldDoctor.rating || 0,
        reviewCount: oldDoctor.totalReviews || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLogin: null,
        _migratedFrom: doctorItem.key,
        _migrationDate: new Date().toISOString()
      };
      
      await kv.set(`staff:${staffId}`, newStaff);
      
      // Add to vendor's staff list
      const vendorStaffKey = `vendor:${vendorId}:staff`;
      const vendorStaff = await kv.get(vendorStaffKey) || [];
      if (!vendorStaff.includes(staffId)) {
        vendorStaff.push(staffId);
        await kv.set(vendorStaffKey, vendorStaff);
      }
      
      results.migrated++;
    }
    
    return c.json({
      success: true,
      message: `Migrated ${results.migrated} doctors`,
      results
    });
    
  } catch (error) {
    console.error('❌ Vendor migration failed:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /vendor/:vendorId/check-migration-status
 * Check if vendor's doctors need migration
 */
app.get("/vendor/:vendorId/check-migration-status", async (c) => {
  try {
    const vendorId = c.req.param("vendorId");
    
    // Get old doctors
    const allDoctors = await kv.getByPrefix("doctor:");
    const oldDoctors = allDoctors.filter((d: any) => 
      d.value?.clinicId === vendorId || d.value?.vendorId === vendorId
    );
    
    // Get new staff
    const vendorStaffKey = `vendor:${vendorId}:staff`;
    const staffIds = await kv.get(vendorStaffKey) || [];
    
    const staff = await Promise.all(
      staffIds.map(async (id: string) => await kv.get(`staff:${id}`))
    );
    
    const migratedStaff = staff.filter((s: any) => s?._migratedFrom);
    
    return c.json({
      needsMigration: oldDoctors.length > 0 && staffIds.length === 0,
      oldDoctorCount: oldDoctors.length,
      newStaffCount: staffIds.length,
      migratedCount: migratedStaff.length,
      oldDoctors: oldDoctors.map((d: any) => ({
        id: d.key,
        name: d.value?.name,
        phone: d.value?.phone
      })),
      newStaff: staff.filter((s: any) => s !== null).map((s: any) => ({
        id: s.id,
        name: s.fullName,
        phone: s.phone,
        isMigrated: !!s._migratedFrom
      }))
    });
    
  } catch (error) {
    console.error('❌ Check migration status failed:', error);
    return c.json({ error: String(error) }, 500);
  }
});

export default app;
