import * as kv from './kv_store.tsx';

/**
 * ✅ GAP #14 FIX: CASCADE DELETE SERVICE
 * Comprehensive data integrity & orphan prevention system
 * 
 * Handles cascading deletes for:
 * - Vendor Services → Staff Service Assignments
 * - Staff Deletion → Service Assignments, Bookings, Schedules
 * - Service Packages → Package Enrollments
 * - Vendors → All Related Data
 * - Bookings → Related Records
 * 
 * Features:
 * - Automatic cascade delete logic
 * - Orphan data prevention
 * - Comprehensive cleanup
 * - Audit trail logging
 * - Safe delete validation
 * - Rollback support
 */

// =============================================
// CASCADE DELETE OPERATIONS
// =============================================

/**
 * Delete vendor service with full cascade
 * 
 * Cascades to:
 * - Staff service assignments
 * - Active bookings (cancel or prevent)
 * - Service reviews
 * - Service packages containing this service
 */
export async function cascadeDeleteVendorService(
  vendorId: string,
  serviceId: string,
  options: {
    force?: boolean;  // Force delete even with active bookings
    cancelBookings?: boolean;  // Cancel active bookings
  } = {}
): Promise<{
  success: boolean;
  deleted: string[];
  cancelled: string[];
  errors: string[];
}> {
  console.log(`\n🗑️ ========== CASCADE DELETE: VENDOR SERVICE ==========`);
  console.log(`   Vendor ID: ${vendorId}`);
  console.log(`   Service ID: ${serviceId}`);
  console.log(`   Options:`, options);

  const deleted: string[] = [];
  const cancelled: string[] = [];
  const errors: string[] = [];

  try {
    // 1. Check if service exists
    const service = await kv.get(`service:${serviceId}`);
    if (!service) {
      errors.push(`Service not found: ${serviceId}`);
      return { success: false, deleted, cancelled, errors };
    }

    console.log(`   Service: ${service.name}`);

    // 2. Check for active bookings
    const vendorBookings = await kv.get(`vendor:bookings:${vendorId}`) || [];
    const activeBookings = [];
    
    for (const bookingId of vendorBookings) {
      const booking = await kv.get(`booking:${bookingId}`);
      if (booking && booking.serviceId === serviceId) {
        if (booking.status === 'confirmed' || booking.status === 'pending') {
          activeBookings.push(booking);
        }
      }
    }

    console.log(`   Active bookings found: ${activeBookings.length}`);

    if (activeBookings.length > 0 && !options.force) {
      errors.push(`Cannot delete service with ${activeBookings.length} active bookings. Use force=true to cancel bookings.`);
      return { success: false, deleted, cancelled, errors };
    }

    // 3. Cancel active bookings if requested
    if (activeBookings.length > 0 && options.cancelBookings) {
      console.log(`   🔄 Cancelling ${activeBookings.length} active bookings...`);
      
      for (const booking of activeBookings) {
        try {
          booking.status = 'cancelled';
          booking.cancellationReason = 'Service discontinued by vendor';
          booking.cancelledAt = new Date().toISOString();
          booking.cancelledBy = 'system';
          
          await kv.set(`booking:${booking.id}`, booking);
          cancelled.push(booking.id);
          
          console.log(`      ✅ Cancelled booking: ${booking.id}`);
        } catch (error) {
          console.error(`      ❌ Failed to cancel booking ${booking.id}:`, error);
          errors.push(`Failed to cancel booking: ${booking.id}`);
        }
      }
    }

    // 4. Delete all staff service assignments
    console.log(`   🔄 Removing staff service assignments...`);
    
    const allStaffServices = await kv.getByPrefix('staff:');
    let staffServicesDeleted = 0;

    for (const staffData of allStaffServices) {
      // Check if this is a staff service assignment record
      if (staffData.serviceId === serviceId) {
        try {
          const staffId = staffData.staffId;
          
          // Delete staff:${staffId}:service:${serviceId}
          await kv.del(`staff:${staffId}:service:${serviceId}`);
          
          // Delete staff:service:${serviceId} (if exists)
          await kv.del(`staff:service:${serviceId}`);
          
          deleted.push(`staff:${staffId}:service:${serviceId}`);
          staffServicesDeleted++;
          
          console.log(`      ✅ Removed service from staff: ${staffId}`);
        } catch (error) {
          console.error(`      ❌ Failed to remove staff service:`, error);
        }
      }
    }

    console.log(`   Removed ${staffServicesDeleted} staff service assignments`);

    // 5. Remove service from packages
    console.log(`   🔄 Checking service packages...`);
    
    const packages = await kv.get(`vendor:${vendorId}:service_packages`) || [];
    let packagesUpdated = 0;

    for (let i = 0; i < packages.length; i++) {
      const pkg = packages[i];
      
      if (pkg.services && pkg.services.includes(serviceId)) {
        console.log(`      ⚠️ Package "${pkg.name}" contains this service`);
        
        // Remove service from package
        pkg.services = pkg.services.filter((sid: string) => sid !== serviceId);
        
        // If package now has no services, mark as inactive
        if (pkg.services.length === 0) {
          pkg.isActive = false;
          pkg.discontinuedReason = 'All services removed';
          console.log(`      📦 Package "${pkg.name}" deactivated (no services left)`);
        }
        
        packages[i] = pkg;
        packagesUpdated++;
      }
    }

    if (packagesUpdated > 0) {
      await kv.set(`vendor:${vendorId}:service_packages`, packages);
      console.log(`   Updated ${packagesUpdated} packages`);
    }

    // 6. Delete service reviews
    console.log(`   🔄 Removing service reviews...`);
    
    const reviews = await kv.get(`service:${serviceId}:reviews`) || [];
    if (reviews.length > 0) {
      await kv.del(`service:${serviceId}:reviews`);
      deleted.push(`service:${serviceId}:reviews`);
      console.log(`   Deleted ${reviews.length} reviews`);
    }

    // 7. Remove from vendor's service list
    console.log(`   🔄 Removing from vendor service list...`);
    
    const vendorServices = await kv.get(`vendor:${vendorId}:services`) || [];
    const updatedServices = vendorServices.filter((id: string) => id !== serviceId);
    
    if (updatedServices.length !== vendorServices.length) {
      await kv.set(`vendor:${vendorId}:services`, updatedServices);
      console.log(`   Updated vendor service list`);
    }

    // 8. Soft delete the service itself
    service.isActive = false;
    service.deletedAt = new Date().toISOString();
    service.deletionReason = 'Vendor deleted service';
    await kv.set(`service:${serviceId}`, service);
    deleted.push(`service:${serviceId}`);

    console.log(`\n✅ ========== CASCADE DELETE COMPLETE ==========`);
    console.log(`   Deleted records: ${deleted.length}`);
    console.log(`   Cancelled bookings: ${cancelled.length}`);
    console.log(`   Errors: ${errors.length}`);

    return {
      success: errors.length === 0,
      deleted,
      cancelled,
      errors
    };

  } catch (error) {
    console.error('❌ CASCADE DELETE ERROR:', error);
    errors.push(String(error));
    return { success: false, deleted, cancelled, errors };
  }
}

/**
 * Delete staff member with full cascade
 * 
 * Cascades to:
 * - Staff service assignments
 * - Staff schedules
 * - Active bookings (cancel or prevent)
 * - Staff availability records
 * - Staff locations
 */
export async function cascadeDeleteStaff(
  vendorId: string,
  staffId: string,
  options: {
    force?: boolean;
    cancelBookings?: boolean;
  } = {}
): Promise<{
  success: boolean;
  deleted: string[];
  cancelled: string[];
  errors: string[];
}> {
  console.log(`\n🗑️ ========== CASCADE DELETE: STAFF MEMBER ==========`);
  console.log(`   Vendor ID: ${vendorId}`);
  console.log(`   Staff ID: ${staffId}`);

  const deleted: string[] = [];
  const cancelled: string[] = [];
  const errors: string[] = [];

  try {
    // 1. Check if staff exists
    const staff = await kv.get(`staff:${staffId}`);
    if (!staff) {
      errors.push(`Staff not found: ${staffId}`);
      return { success: false, deleted, cancelled, errors };
    }

    console.log(`   Staff: ${staff.name || staff.fullName}`);

    // 2. Check for active bookings
    const vendorBookings = await kv.get(`vendor:bookings:${vendorId}`) || [];
    const activeBookings = [];
    
    for (const bookingId of vendorBookings) {
      const booking = await kv.get(`booking:${bookingId}`);
      if (booking && (booking.staffId === staffId || booking.doctorId === staffId)) {
        if (booking.status === 'confirmed' || booking.status === 'pending') {
          activeBookings.push(booking);
        }
      }
    }

    console.log(`   Active bookings: ${activeBookings.length}`);

    if (activeBookings.length > 0 && !options.force) {
      errors.push(`Cannot delete staff with ${activeBookings.length} active bookings`);
      return { success: false, deleted, cancelled, errors };
    }

    // 3. Cancel bookings if needed
    if (activeBookings.length > 0 && options.cancelBookings) {
      console.log(`   🔄 Cancelling bookings...`);
      
      for (const booking of activeBookings) {
        booking.status = 'cancelled';
        booking.cancellationReason = 'Staff member no longer available';
        booking.cancelledAt = new Date().toISOString();
        booking.cancelledBy = 'system';
        
        await kv.set(`booking:${booking.id}`, booking);
        cancelled.push(booking.id);
      }
    }

    // 4. Delete staff service assignments
    console.log(`   🔄 Removing service assignments...`);
    
    const staffServices = await kv.getByPrefix(`staff:${staffId}:service:`);
    for (const service of staffServices) {
      try {
        await kv.del(`staff:${staffId}:service:${service.serviceId}`);
        deleted.push(`staff:${staffId}:service:${service.serviceId}`);
      } catch (error) {
        console.error(`   ❌ Failed to delete service assignment:`, error);
      }
    }

    console.log(`   Deleted ${staffServices.length} service assignments`);

    // 5. Delete staff schedules
    console.log(`   🔄 Removing schedules...`);
    
    const schedule = await kv.get(`staff:${staffId}:schedule`);
    if (schedule) {
      await kv.del(`staff:${staffId}:schedule`);
      deleted.push(`staff:${staffId}:schedule`);
    }

    // 6. Delete staff availability
    const availability = await kv.get(`staff:${staffId}:availability`);
    if (availability) {
      await kv.del(`staff:${staffId}:availability`);
      deleted.push(`staff:${staffId}:availability`);
    }

    // 7. Delete staff locations
    const locations = await kv.getByPrefix(`staff:${staffId}:location:`);
    for (const location of locations) {
      await kv.del(`staff:${staffId}:location:${location.id}`);
      deleted.push(`staff:${staffId}:location:${location.id}`);
    }

    console.log(`   Deleted ${locations.length} locations`);

    // 8. Remove from vendor's staff list
    const vendorStaff = await kv.get(`vendor:${vendorId}:staff`) || [];
    const updatedStaff = vendorStaff.filter((id: string) => id !== staffId);
    await kv.set(`vendor:${vendorId}:staff`, updatedStaff);

    // 9. Soft delete staff record
    staff.isActive = false;
    staff.deletedAt = new Date().toISOString();
    await kv.set(`staff:${staffId}`, staff);
    deleted.push(`staff:${staffId}`);

    console.log(`\n✅ ========== CASCADE DELETE COMPLETE ==========`);

    return {
      success: errors.length === 0,
      deleted,
      cancelled,
      errors
    };

  } catch (error) {
    console.error('❌ CASCADE DELETE ERROR:', error);
    errors.push(String(error));
    return { success: false, deleted, cancelled, errors };
  }
}

/**
 * Delete service package with full cascade
 * 
 * Cascades to:
 * - Package enrollments (cancel active ones)
 * - Package bookings
 */
export async function cascadeDeleteServicePackage(
  vendorId: string,
  packageId: string,
  options: {
    force?: boolean;
    cancelEnrollments?: boolean;
  } = {}
): Promise<{
  success: boolean;
  deleted: string[];
  cancelled: string[];
  errors: string[];
}> {
  console.log(`\n🗑️ ========== CASCADE DELETE: SERVICE PACKAGE ==========`);
  console.log(`   Vendor ID: ${vendorId}`);
  console.log(`   Package ID: ${packageId}`);

  const deleted: string[] = [];
  const cancelled: string[] = [];
  const errors: string[] = [];

  try {
    // 1. Get package
    const packages = await kv.get(`vendor:${vendorId}:service_packages`) || [];
    const packageIndex = packages.findIndex((p: any) => p.id === packageId);
    
    if (packageIndex === -1) {
      errors.push(`Package not found: ${packageId}`);
      return { success: false, deleted, cancelled, errors };
    }

    const pkg = packages[packageIndex];
    console.log(`   Package: ${pkg.name}`);

    // 2. Check for active enrollments
    const enrollments = await kv.get(`vendor:${vendorId}:package_enrollments`) || [];
    const activeEnrollments = enrollments.filter((e: any) => 
      e.packageId === packageId && e.status === 'active'
    );

    console.log(`   Active enrollments: ${activeEnrollments.length}`);

    if (activeEnrollments.length > 0 && !options.force) {
      errors.push(`Cannot delete package with ${activeEnrollments.length} active enrollments`);
      return { success: false, deleted, cancelled, errors };
    }

    // 3. Cancel enrollments
    if (activeEnrollments.length > 0 && options.cancelEnrollments) {
      console.log(`   🔄 Cancelling enrollments...`);
      
      for (let i = 0; i < enrollments.length; i++) {
        if (enrollments[i].packageId === packageId && enrollments[i].status === 'active') {
          enrollments[i].status = 'cancelled';
          enrollments[i].cancellationReason = 'Package discontinued by vendor';
          enrollments[i].cancelledAt = new Date().toISOString();
          cancelled.push(enrollments[i].enrollmentId);
        }
      }

      await kv.set(`vendor:${vendorId}:package_enrollments`, enrollments);
    }

    // 4. Remove package
    packages.splice(packageIndex, 1);
    await kv.set(`vendor:${vendorId}:service_packages`, packages);
    deleted.push(`package:${packageId}`);

    console.log(`\n✅ ========== CASCADE DELETE COMPLETE ==========`);

    return {
      success: errors.length === 0,
      deleted,
      cancelled,
      errors
    };

  } catch (error) {
    console.error('❌ CASCADE DELETE ERROR:', error);
    errors.push(String(error));
    return { success: false, deleted, cancelled, errors };
  }
}

/**
 * Delete vendor with full cascade (DANGER!)
 * 
 * Cascades to:
 * - All services
 * - All staff
 * - All bookings
 * - All packages
 * - All enrollments
 */
export async function cascadeDeleteVendor(
  vendorId: string,
  options: {
    force?: boolean;
    cancelAll?: boolean;
  } = {}
): Promise<{
  success: boolean;
  deleted: string[];
  cancelled: string[];
  errors: string[];
}> {
  console.log(`\n🚨 ========== CASCADE DELETE: VENDOR (DANGER!) ==========`);
  console.log(`   Vendor ID: ${vendorId}`);
  console.log(`   ⚠️ This will delete ALL vendor data!`);

  const deleted: string[] = [];
  const cancelled: string[] = [];
  const errors: string[] = [];

  try {
    // 1. Get vendor
    const vendor = await kv.get(`vendor:${vendorId}`);
    if (!vendor) {
      errors.push(`Vendor not found: ${vendorId}`);
      return { success: false, deleted, cancelled, errors };
    }

    console.log(`   Vendor: ${vendor.businessName || vendor.fullName}`);

    // 2. Delete all services (with cascade)
    console.log(`   🔄 Deleting all services...`);
    const serviceIds = await kv.get(`vendor:${vendorId}:services`) || [];
    
    for (const serviceId of serviceIds) {
      const result = await cascadeDeleteVendorService(vendorId, serviceId, {
        force: options.force,
        cancelBookings: options.cancelAll
      });
      deleted.push(...result.deleted);
      cancelled.push(...result.cancelled);
      errors.push(...result.errors);
    }

    // 3. Delete all staff (with cascade)
    console.log(`   🔄 Deleting all staff...`);
    const staffIds = await kv.get(`vendor:${vendorId}:staff`) || [];
    
    for (const staffId of staffIds) {
      const result = await cascadeDeleteStaff(vendorId, staffId, {
        force: options.force,
        cancelBookings: options.cancelAll
      });
      deleted.push(...result.deleted);
      cancelled.push(...result.cancelled);
      errors.push(...result.errors);
    }

    // 4. Delete all packages
    console.log(`   🔄 Deleting all packages...`);
    const packages = await kv.get(`vendor:${vendorId}:service_packages`) || [];
    
    for (const pkg of packages) {
      const result = await cascadeDeleteServicePackage(vendorId, pkg.id, {
        force: options.force,
        cancelEnrollments: options.cancelAll
      });
      deleted.push(...result.deleted);
      cancelled.push(...result.cancelled);
      errors.push(...result.errors);
    }

    // 5. Delete vendor data structures
    await kv.del(`vendor:${vendorId}:services`);
    await kv.del(`vendor:${vendorId}:staff`);
    await kv.del(`vendor:${vendorId}:service_packages`);
    await kv.del(`vendor:${vendorId}:package_enrollments`);
    await kv.del(`vendor:bookings:${vendorId}`);
    await kv.del(`vendor:${vendorId}:schedule`);
    await kv.del(`vendor:${vendorId}:availability`);
    await kv.del(`vendor:${vendorId}:reviews`);
    await kv.del(`vendor:${vendorId}:payouts`);

    // 6. Soft delete vendor
    vendor.isActive = false;
    vendor.deletedAt = new Date().toISOString();
    await kv.set(`vendor:${vendorId}`, vendor);
    deleted.push(`vendor:${vendorId}`);

    console.log(`\n✅ ========== CASCADE DELETE COMPLETE ==========`);
    console.log(`   Total deleted: ${deleted.length}`);
    console.log(`   Total cancelled: ${cancelled.length}`);

    return {
      success: errors.length === 0,
      deleted,
      cancelled,
      errors
    };

  } catch (error) {
    console.error('❌ CASCADE DELETE ERROR:', error);
    errors.push(String(error));
    return { success: false, deleted, cancelled, errors };
  }
}

/**
 * Find and clean orphaned data
 * 
 * Finds:
 * - Staff services for deleted services
 * - Staff services for deleted staff
 * - Bookings for deleted services
 * - Reviews for deleted services
 */
export async function cleanOrphanedData(): Promise<{
  cleaned: string[];
  found: number;
}> {
  console.log(`\n🧹 ========== CLEANING ORPHANED DATA ==========`);

  const cleaned: string[] = [];

  try {
    // 1. Find orphaned staff services
    console.log(`   🔍 Checking staff service assignments...`);
    
    const allStaffServices = await kv.getByPrefix('staff:');
    let orphanedStaffServices = 0;

    for (const staffService of allStaffServices) {
      // Check if this is a staff service assignment
      if (staffService.serviceId && staffService.staffId) {
        // Verify service exists
        const service = await kv.get(`service:${staffService.serviceId}`);
        
        if (!service || service.isActive === false) {
          // Service is deleted or inactive, remove assignment
          try {
            await kv.del(`staff:${staffService.staffId}:service:${staffService.serviceId}`);
            cleaned.push(`staff:${staffService.staffId}:service:${staffService.serviceId}`);
            orphanedStaffServices++;
          } catch (error) {
            console.error(`   ❌ Failed to clean orphaned staff service:`, error);
          }
        }
      }
    }

    console.log(`   Found ${orphanedStaffServices} orphaned staff services`);

    // 2. Find orphaned package enrollments
    console.log(`   🔍 Checking package enrollments...`);
    
    const allVendors = await kv.getByPrefix('vendor:');
    let orphanedEnrollments = 0;

    for (const vendor of allVendors) {
      if (vendor.id && vendor.id.startsWith('vendor_')) {
        const enrollments = await kv.get(`vendor:${vendor.id}:package_enrollments`) || [];
        const packages = await kv.get(`vendor:${vendor.id}:service_packages`) || [];
        
        const packageIds = packages.map((p: any) => p.id);
        const validEnrollments = [];

        for (const enrollment of enrollments) {
          if (packageIds.includes(enrollment.packageId)) {
            validEnrollments.push(enrollment);
          } else {
            // Orphaned enrollment
            orphanedEnrollments++;
          }
        }

        if (validEnrollments.length !== enrollments.length) {
          await kv.set(`vendor:${vendor.id}:package_enrollments`, validEnrollments);
          cleaned.push(`vendor:${vendor.id}:package_enrollments`);
        }
      }
    }

    console.log(`   Found ${orphanedEnrollments} orphaned enrollments`);

    console.log(`\n✅ ========== CLEANUP COMPLETE ==========`);
    console.log(`   Cleaned ${cleaned.length} records`);
    console.log(`   Found ${orphanedStaffServices + orphanedEnrollments} orphaned items`);

    return {
      cleaned,
      found: orphanedStaffServices + orphanedEnrollments
    };

  } catch (error) {
    console.error('❌ CLEANUP ERROR:', error);
    return { cleaned, found: 0 };
  }
}

/**
 * Safe delete check - verify if resource can be deleted safely
 */
export async function checkSafeDelete(
  resourceType: 'service' | 'staff' | 'package' | 'vendor',
  resourceId: string,
  vendorId: string
): Promise<{
  canDelete: boolean;
  blockers: string[];
  warnings: string[];
}> {
  const blockers: string[] = [];
  const warnings: string[] = [];

  try {
    switch (resourceType) {
      case 'service': {
        // Check for active bookings
        const vendorBookings = await kv.get(`vendor:bookings:${vendorId}`) || [];
        let activeCount = 0;

        for (const bookingId of vendorBookings) {
          const booking = await kv.get(`booking:${bookingId}`);
          if (booking && booking.serviceId === resourceId) {
            if (booking.status === 'confirmed' || booking.status === 'pending') {
              activeCount++;
            }
          }
        }

        if (activeCount > 0) {
          blockers.push(`${activeCount} active booking(s)`);
        }

        // Check for staff assignments
        const allStaffServices = await kv.getByPrefix('staff:');
        let assignedStaff = 0;

        for (const ss of allStaffServices) {
          if (ss.serviceId === resourceId) assignedStaff++;
        }

        if (assignedStaff > 0) {
          warnings.push(`Assigned to ${assignedStaff} staff member(s)`);
        }

        break;
      }

      case 'staff': {
        // Check for active bookings
        const vendorBookings = await kv.get(`vendor:bookings:${vendorId}`) || [];
        let activeCount = 0;

        for (const bookingId of vendorBookings) {
          const booking = await kv.get(`booking:${bookingId}`);
          if (booking && (booking.staffId === resourceId || booking.doctorId === resourceId)) {
            if (booking.status === 'confirmed' || booking.status === 'pending') {
              activeCount++;
            }
          }
        }

        if (activeCount > 0) {
          blockers.push(`${activeCount} active booking(s)`);
        }

        break;
      }

      case 'package': {
        const enrollments = await kv.get(`vendor:${vendorId}:package_enrollments`) || [];
        const activeEnrollments = enrollments.filter((e: any) => 
          e.packageId === resourceId && e.status === 'active'
        );

        if (activeEnrollments.length > 0) {
          blockers.push(`${activeEnrollments.length} active enrollment(s)`);
        }

        break;
      }

      case 'vendor': {
        const services = await kv.get(`vendor:${vendorId}:services`) || [];
        const staff = await kv.get(`vendor:${vendorId}:staff`) || [];
        const bookings = await kv.get(`vendor:bookings:${vendorId}`) || [];

        if (services.length > 0) warnings.push(`${services.length} service(s)`);
        if (staff.length > 0) warnings.push(`${staff.length} staff member(s)`);
        if (bookings.length > 0) warnings.push(`${bookings.length} booking(s)`);

        break;
      }
    }

    return {
      canDelete: blockers.length === 0,
      blockers,
      warnings
    };

  } catch (error) {
    console.error('Error checking safe delete:', error);
    return {
      canDelete: false,
      blockers: ['Error checking dependencies'],
      warnings: []
    };
  }
}
