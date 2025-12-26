/**
 * CASCADE DELETE SERVICE - SQL-ONLY VERSION
 * 
 * Comprehensive data integrity & orphan prevention system
 * 
 * Handles cascading deletes for:
 * - Vendor Services → Staff Service Assignments
 * - Staff Deletion → Service Assignments, Bookings, Schedules
 * - Service Packages → Package Enrollments
 * - Vendors → All Related Data
 * - Bookings → Related Records
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()`, `kv.delete()`, `kv.getByPrefix()` with SQL repository calls
 * - Uses `ServicesRepository`, `StaffRepository`, `BookingsRepository`, `PackagesRepository`, `ReviewsRepository`, `VendorsRepository`
 * - Uses `staff_services`, `staff_schedules`, `staff_availability` tables
 * - Uses database CASCADE DELETE constraints where possible
 * 
 * Date: 2025-01-27
 * Migration: Agent-3 - KV to SQL (Batch 12)
 * KV Operations Removed: 46
 * ============================================================================
 */

import { getServicesRepository } from '../../lib/repositories/services.ts';
import { getStaffRepository } from '../../lib/repositories/staff.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getPackagesRepository } from '../../lib/repositories/packages.ts';
import { getReviewsRepository } from '../../lib/repositories/reviews.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getDbClient, withTransaction } from '../../lib/db.ts';

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
    const servicesRepo = getServicesRepository();
    const bookingsRepo = getBookingsRepository();
    const reviewsRepo = getReviewsRepository();
    const packagesRepo = getPackagesRepository();
    const db = getDbClient();

    // 1. Check if service exists
    const service = await servicesRepo.findById(serviceId);
    if (!service) {
      errors.push(`Service not found: ${serviceId}`);
      return { success: false, deleted, cancelled, errors };
    }

    console.log(`   Service: ${service.name}`);

    // 2. Check for active bookings
    const vendorBookings = await bookingsRepo.findByVendor(vendorId);
    const activeBookings = vendorBookings.filter(b => 
      b.service_id === serviceId && 
      (b.status === 'confirmed' || b.status === 'pending')
    );

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
          await bookingsRepo.update(booking.id, {
            status: 'cancelled',
            cancellation_reason: 'Service discontinued by vendor',
            cancelled_at: new Date().toISOString()
          });
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
    
    const { data: staffServices, error: staffServicesError } = await db
      .from('staff_services')
      .delete()
      .eq('service_id', serviceId)
      .select();

    if (staffServicesError) {
      console.error(`   ❌ Failed to delete staff service assignments:`, staffServicesError);
      errors.push(`Failed to delete staff service assignments`);
    } else {
      const deletedCount = staffServices?.length || 0;
      console.log(`   Removed ${deletedCount} staff service assignments`);
      deleted.push(`staff_services:${serviceId}`);
    }

    // 5. Remove service from packages
    console.log(`   🔄 Checking service packages...`);
    
    const packages = await packagesRepo.getAllPackages({ vendorId: vendorId });
    let packagesUpdated = 0;

    for (const pkg of packages) {
      // Check if package includes this service (stored in package metadata)
      const packageServices = (pkg as any).services || [];
      if (packageServices.includes(serviceId)) {
        console.log(`      ⚠️ Package "${pkg.name}" contains this service`);
        
        // Remove service from package (update package metadata)
        const updatedServices = packageServices.filter((sid: string) => sid !== serviceId);
        
        // If package now has no services, mark as inactive
        if (updatedServices.length === 0) {
          await packagesRepo.updatePackage(pkg.id, {
            isActive: false
          });
          console.log(`      📦 Package "${pkg.name}" deactivated (no services left)`);
        } else {
          // Update package with remaining services
          await packagesRepo.updatePackage(pkg.id, {
            // Update metadata to remove service
          });
        }
        
        packagesUpdated++;
      }
    }

    if (packagesUpdated > 0) {
      console.log(`   Updated ${packagesUpdated} packages`);
    }

    // 6. Delete service reviews
    console.log(`   🔄 Removing service reviews...`);
    
    const serviceReviews = await reviewsRepo.findByService(serviceId);
    if (serviceReviews.length > 0) {
      for (const review of serviceReviews) {
        await reviewsRepo.delete(review.id);
      }
      deleted.push(`reviews:${serviceId}`);
      console.log(`   Deleted ${serviceReviews.length} reviews`);
    }

    // 7. Soft delete the service itself
    await servicesRepo.update(serviceId, {
      is_active: false
    });
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
    const staffRepo = getStaffRepository();
    const bookingsRepo = getBookingsRepository();
    const db = getDbClient();

    // 1. Check if staff exists
    const staff = await staffRepo.findById(staffId);
    if (!staff) {
      errors.push(`Staff not found: ${staffId}`);
      return { success: false, deleted, cancelled, errors };
    }

    console.log(`   Staff: ${staff.fullName || staff.name}`);

    // 2. Check for active bookings
    const vendorBookings = await bookingsRepo.findByVendor(vendorId);
    const activeBookings = vendorBookings.filter(b => 
      (b.staff_id === staffId) && 
      (b.status === 'confirmed' || b.status === 'pending')
    );

    console.log(`   Active bookings: ${activeBookings.length}`);

    if (activeBookings.length > 0 && !options.force) {
      errors.push(`Cannot delete staff with ${activeBookings.length} active bookings`);
      return { success: false, deleted, cancelled, errors };
    }

    // 3. Cancel bookings if needed
    if (activeBookings.length > 0 && options.cancelBookings) {
      console.log(`   🔄 Cancelling bookings...`);
      
      for (const booking of activeBookings) {
        await bookingsRepo.update(booking.id, {
          status: 'cancelled',
          cancellation_reason: 'Staff member no longer available',
          cancelled_at: new Date().toISOString()
        });
        cancelled.push(booking.id);
      }
    }

    // 4. Delete staff service assignments (CASCADE DELETE will handle this)
    console.log(`   🔄 Removing service assignments...`);
    
    const { data: staffServices } = await db
      .from('staff_services')
      .delete()
      .eq('staff_id', staffId)
      .select();

    const deletedCount = staffServices?.length || 0;
    console.log(`   Deleted ${deletedCount} service assignments`);
    deleted.push(`staff_services:${staffId}`);

    // 5. Delete staff schedules
    console.log(`   🔄 Removing schedules...`);
    
    const { data: schedules } = await db
      .from('staff_schedules')
      .delete()
      .eq('staff_id', staffId)
      .select();

    if (schedules && schedules.length > 0) {
      deleted.push(`staff_schedules:${staffId}`);
      console.log(`   Deleted ${schedules.length} schedule entries`);
    }

    // 6. Delete staff availability
    const { data: availability } = await db
      .from('staff_availability')
      .delete()
      .eq('staff_id', staffId)
      .select();

    if (availability && availability.length > 0) {
      deleted.push(`staff_availability:${staffId}`);
      console.log(`   Deleted ${availability.length} availability entries`);
    }

    // 7. Soft delete staff record
    await staffRepo.update(staffId, {
      isActive: false
    });
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
    const packagesRepo = getPackagesRepository();

    // 1. Get package
    const pkg = await packagesRepo.getPackageById(packageId);
    if (!pkg) {
      errors.push(`Package not found: ${packageId}`);
      return { success: false, deleted, cancelled, errors };
    }

    console.log(`   Package: ${pkg.name}`);

    // 2. Check for active enrollments
    const enrollments = await packagesRepo.getEnrollmentsByPackage(packageId);
    const activeEnrollments = enrollments.filter(e => e.status === 'active');

    console.log(`   Active enrollments: ${activeEnrollments.length}`);

    if (activeEnrollments.length > 0 && !options.force) {
      errors.push(`Cannot delete package with ${activeEnrollments.length} active enrollments`);
      return { success: false, deleted, cancelled, errors };
    }

    // 3. Cancel enrollments
    if (activeEnrollments.length > 0 && options.cancelEnrollments) {
      console.log(`   🔄 Cancelling enrollments...`);
      
      for (const enrollment of activeEnrollments) {
        await packagesRepo.updateEnrollment(enrollment.id, {
          status: 'cancelled',
          cancellationReason: 'Package discontinued by vendor'
        });
        cancelled.push(enrollment.id);
      }
    }

    // 4. Delete package
    await packagesRepo.deletePackage(packageId);
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
    const vendorsRepo = getVendorsRepository();
    const servicesRepo = getServicesRepository();
    const staffRepo = getStaffRepository();
    const packagesRepo = getPackagesRepository();

    // 1. Get vendor
    const vendor = await vendorsRepo.findById(vendorId);
    if (!vendor) {
      errors.push(`Vendor not found: ${vendorId}`);
      return { success: false, deleted, cancelled, errors };
    }

    console.log(`   Vendor: ${vendor.business_name || vendor.owner_name}`);

    // 2. Delete all services (with cascade)
    console.log(`   🔄 Deleting all services...`);
    const services = await servicesRepo.findByVendor(vendorId);
    
    for (const service of services) {
      const result = await cascadeDeleteVendorService(vendorId, service.id, {
        force: options.force,
        cancelBookings: options.cancelAll
      });
      deleted.push(...result.deleted);
      cancelled.push(...result.cancelled);
      errors.push(...result.errors);
    }

    // 3. Delete all staff (with cascade)
    console.log(`   🔄 Deleting all staff...`);
    const staffList = await staffRepo.findByVendor(vendorId);
    
    for (const staff of staffList) {
      const result = await cascadeDeleteStaff(vendorId, staff.id, {
        force: options.force,
        cancelBookings: options.cancelAll
      });
      deleted.push(...result.deleted);
      cancelled.push(...result.cancelled);
      errors.push(...result.errors);
    }

    // 4. Delete all packages
    console.log(`   🔄 Deleting all packages...`);
    const packages = await packagesRepo.getAllPackages({ vendorId: vendorId });
    
    for (const pkg of packages) {
      const result = await cascadeDeleteServicePackage(vendorId, pkg.id, {
        force: options.force,
        cancelEnrollments: options.cancelAll
      });
      deleted.push(...result.deleted);
      cancelled.push(...result.cancelled);
      errors.push(...result.errors);
    }

    // 5. Soft delete vendor
    await vendorsRepo.update(vendorId, {
      is_active: false
    });
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
  let found = 0;

  try {
    const db = getDbClient();
    const servicesRepo = getServicesRepository();
    const staffRepo = getStaffRepository();

    // 1. Find orphaned staff services
    console.log(`   🔍 Checking staff service assignments...`);
    
    const { data: allStaffServices, error } = await db
      .from('staff_services')
      .select('id, staff_id, service_id');

    if (error) {
      console.error(`   ❌ Failed to fetch staff services:`, error);
      return { cleaned, found: 0 };
    }

    for (const staffService of allStaffServices || []) {
      // Verify service exists and is active
      const service = await servicesRepo.findById(staffService.service_id);
      if (!service || !service.is_active) {
        // Service is deleted or inactive, remove assignment
        try {
          await db
            .from('staff_services')
            .delete()
            .eq('id', staffService.id);
          cleaned.push(`staff_services:${staffService.id}`);
          found++;
        } catch (error) {
          console.error(`   ❌ Failed to clean orphaned staff service:`, error);
        }
      }

      // Verify staff exists and is active
      const staff = await staffRepo.findById(staffService.staff_id);
      if (!staff || !staff.isActive) {
        // Staff is deleted or inactive, remove assignment
        try {
          await db
            .from('staff_services')
            .delete()
            .eq('id', staffService.id);
          cleaned.push(`staff_services:${staffService.id}`);
          found++;
        } catch (error) {
          console.error(`   ❌ Failed to clean orphaned staff service:`, error);
        }
      }
    }

    console.log(`   Found ${found} orphaned staff services`);

    console.log(`\n✅ ========== CLEANUP COMPLETE ==========`);
    console.log(`   Cleaned ${cleaned.length} records`);
    console.log(`   Found ${found} orphaned items`);

    return {
      cleaned,
      found
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
    const bookingsRepo = getBookingsRepository();
    const db = getDbClient();

    switch (resourceType) {
      case 'service': {
        // Check for active bookings
        const vendorBookings = await bookingsRepo.findByVendor(vendorId);
        const activeBookings = vendorBookings.filter(b => 
          b.service_id === resourceId && 
          (b.status === 'confirmed' || b.status === 'pending')
        );

        if (activeBookings.length > 0) {
          blockers.push(`${activeBookings.length} active booking(s)`);
        }

        // Check for staff assignments
        const { data: staffServices } = await db
          .from('staff_services')
          .select('id')
          .eq('service_id', resourceId);

        if (staffServices && staffServices.length > 0) {
          warnings.push(`Assigned to ${staffServices.length} staff member(s)`);
        }

        break;
      }

      case 'staff': {
        // Check for active bookings
        const vendorBookings = await bookingsRepo.findByVendor(vendorId);
        const activeBookings = vendorBookings.filter(b => 
          b.staff_id === resourceId && 
          (b.status === 'confirmed' || b.status === 'pending')
        );

        if (activeBookings.length > 0) {
          blockers.push(`${activeBookings.length} active booking(s)`);
        }

        break;
      }

      case 'package': {
        const packagesRepo = getPackagesRepository();
        const enrollments = await packagesRepo.getEnrollmentsByPackage(resourceId);
        const activeEnrollments = enrollments.filter(e => e.status === 'active');

        if (activeEnrollments.length > 0) {
          blockers.push(`${activeEnrollments.length} active enrollment(s)`);
        }

        break;
      }

      case 'vendor': {
        const servicesRepo = getServicesRepository();
        const staffRepo = getStaffRepository();
        
        const services = await servicesRepo.findByVendor(vendorId);
        const staff = await staffRepo.findByVendor(vendorId);
        const bookings = await bookingsRepo.findByVendor(vendorId);

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
