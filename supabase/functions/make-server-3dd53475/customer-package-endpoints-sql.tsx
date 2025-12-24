/**
 * ============================================================================
 * CUSTOMER PACKAGE ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Package discovery (grooming, training, walker)
 * - Package enrollment (booking multi-session packages)
 * - Session scheduling
 * - Package progress tracking
 * - Payment integration
 * - Automatic enrollment creation
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ No loose strings - use constants where applicable
 * ✅ Proper error handling
 * ✅ CRUD operations via repositories
 * 
 * Date: 2025-01-27
 * Migration: Phase 2 - Critical Flow Migration
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { generateId } from './database-schema.tsx';
import { sendSuccess, sendError } from './response-utils.ts';
import { getPackagesRepository } from "../../lib/repositories/packages.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";
import { getPetsRepository } from "../../lib/repositories/pets.ts";
import { getReviewsRepository } from "../../lib/repositories/reviews.ts";

export function registerCustomerPackageEndpoints(app: Hono) {
  const BASE = '/make-server-3dd53475';

  // =============================================
  // DISCOVER PACKAGES (Customer Discovery)
  // =============================================
  app.get(`${BASE}/customer/packages/discover`, async (c) => {
    try {
      const serviceType = c.req.query('serviceType'); // 'grooming', 'training', 'walker'
      const vendorId = c.req.query('vendorId');
      const petType = c.req.query('petType'); // 'dog', 'cat'
      const minPrice = c.req.query('minPrice');
      const maxPrice = c.req.query('maxPrice');
      const serviceStyle = c.req.query('serviceStyle'); // 'home', 'center', 'both'

      console.log(`📦 [PACKAGE DISCOVERY] Type: ${serviceType}, Vendor: ${vendorId || 'all'}`);

      // ✅ SQL: Get all packages
      const packagesRepo = getPackagesRepository();
      const allPackages = await packagesRepo.getAllPackages({
        vendorId: vendorId || undefined,
        serviceType: serviceType || undefined,
        isActive: true,
      });

      // Apply filters
      let filtered = allPackages;

      if (petType) {
        filtered = filtered.filter((p: any) => 
          (p.petTypes || []).includes(petType)
        );
      }

      if (minPrice) {
        filtered = filtered.filter((p: any) => p.price >= parseFloat(minPrice));
      }

      if (maxPrice) {
        filtered = filtered.filter((p: any) => p.price <= parseFloat(maxPrice));
      }

      if (serviceStyle) {
        filtered = filtered.filter((p: any) => 
          p.serviceStyle === serviceStyle || p.serviceStyle === 'both'
        );
      }

      // ✅ SQL: Enrich with vendor details
      const vendorsRepo = getVendorsRepository();
      const enriched = await Promise.all(filtered.map(async (pkg: any) => {
        const vendor = await vendorsRepo.findById(pkg.vendorId);
        
        return {
          ...pkg,
          vendor: vendor ? {
            id: vendor.id,
            businessName: vendor.business_name,
            rating: 0, // Can be calculated from reviews
            totalReviews: 0, // Can be calculated from reviews
            address: vendor.address,
            city: vendor.city,
            logo: null, // Add if vendor has logo field
          } : null
        };
      }));

      // Sort by price (default)
      enriched.sort((a, b) => a.price - b.price);

      console.log(`✅ [PACKAGE DISCOVERY] Found ${enriched.length} packages`);

      return sendSuccess(c, {
        packages: enriched,
        total: enriched.length,
        filters: {
          serviceTypes: [...new Set(allPackages.map(p => p.serviceType))],
          priceRange: allPackages.length > 0 ? {
            min: Math.min(...allPackages.map(p => p.price)),
            max: Math.max(...allPackages.map(p => p.price))
          } : { min: 0, max: 0 }
        }
      });

    } catch (error) {
      console.error('❌ [PACKAGE DISCOVERY] Error:', error);
      return sendError(c, 'Failed to discover packages', 500);
    }
  });

  // =============================================
  // GET PACKAGE DETAILS
  // =============================================
  app.get(`${BASE}/customer/packages/:vendorId/:packageId`, async (c) => {
    try {
      const { vendorId, packageId } = c.req.param();

      console.log(`📦 [PACKAGE DETAILS] Vendor: ${vendorId}, Package: ${packageId}`);

      // ✅ SQL: Get package
      const packagesRepo = getPackagesRepository();
      const pkg = await packagesRepo.getPackageById(packageId);

      if (!pkg || pkg.vendorId !== vendorId) {
        return sendError(c, 'Package not found', 404);
      }

      // ✅ SQL: Get vendor details
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(vendorId);

      // ✅ SQL: Get reviews for this package
      const reviewsRepo = getReviewsRepository();
      const allReviews = await reviewsRepo.findByVendor(vendorId);
      const packageReviews = allReviews.filter((r: any) => r.service_id === packageId); // Assuming service_id links to package

      // ✅ SQL: Get enrollment stats
      const vendorEnrollments = await packagesRepo.getVendorEnrollments(vendorId);
      const packageEnrollments = vendorEnrollments.filter((e: any) => e.packageId === packageId);
      const activeEnrollments = packageEnrollments.filter((e: any) => e.status === 'active').length;

      return sendSuccess(c, {
        package: {
          ...pkg,
          vendor: vendor ? {
            id: vendor.id,
            businessName: vendor.business_name,
            rating: 0, // Calculate from reviews
            totalReviews: allReviews.length,
            address: vendor.address,
            city: vendor.city,
            phone: vendor.phone,
            logo: null,
          } : null,
          stats: {
            totalEnrollments: packageEnrollments.length,
            activeEnrollments,
            avgRating: packageReviews.length > 0
              ? packageReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / packageReviews.length
              : 0,
            reviewCount: packageReviews.length
          },
          reviews: packageReviews.slice(0, 5).map((r: any) => ({
            rating: r.rating,
            comment: r.comment,
            createdAt: r.created_at
          }))
        }
      });

    } catch (error) {
      console.error('❌ [PACKAGE DETAILS] Error:', error);
      return sendError(c, 'Failed to fetch package details', 500);
    }
  });

  // =============================================
  // ENROLL IN PACKAGE (Book Package)
  // =============================================
  app.post(`${BASE}/customer/packages/enroll`, async (c) => {
    try {
      const body = await c.req.json();
      const { 
        customerId, 
        petId, 
        vendorId, 
        packageId, 
        preferredSchedule,
        serviceLocation,
        notes,
        paymentMethod
      } = body;

      console.log(`📦 [PACKAGE ENROLLMENT] Customer: ${customerId}, Package: ${packageId}`);

      // ✅ SQL: Verify package exists and is active
      const packagesRepo = getPackagesRepository();
      const pkg = await packagesRepo.getPackageById(packageId);

      if (!pkg) {
        console.error('❌ [PACKAGE ENROLLMENT] Package not found');
        return sendError(c, 'Package not found', 404);
      }

      if (!pkg.isActive) {
        console.error('❌ [PACKAGE ENROLLMENT] Package is inactive');
        return sendError(c, 'Package is no longer available', 400);
      }

      // ✅ SQL: Check max active enrollments
      const vendorEnrollments = await packagesRepo.getVendorEnrollments(vendorId);
      const activeCount = vendorEnrollments.filter((e: any) => 
        e.packageId === packageId && e.status === 'active'
      ).length;

      if (activeCount >= (pkg.maxActiveEnrollments || 50)) {
        console.error('❌ [PACKAGE ENROLLMENT] Package at capacity');
        return sendError(c, 'Package enrollment limit reached. Please try again later.', 400);
      }

      // ✅ SQL: Get customer and pet details
      const customersRepo = getCustomersRepository();
      const customer = await customersRepo.findById(customerId);
      
      const petsRepo = getPetsRepository();
      const pet = await petsRepo.findById(petId);

      if (!pet) {
        return sendError(c, 'Pet not found', 404);
      }

      // ✅ VALIDATION: Pet type compatibility
      if (!(pkg.petTypes || []).includes(pet.species)) {
        console.error(`❌ [PACKAGE ENROLLMENT] Pet type mismatch: ${pet.species} not in ${pkg.petTypes}`);
        return sendError(c, `This package is only for ${(pkg.petTypes || []).join(', ')} pets`, 400);
      }

      // Create sessions array
      const sessions = [];
      for (let i = 0; i < pkg.totalSessions; i++) {
        sessions.push({
          sessionNumber: i + 1,
          status: 'scheduled',
          scheduledDate: null,
          scheduledTime: null,
          assignedStaffId: null,
          otp: null,
          endOtp: null,
          startedAt: null,
          completedAt: null,
          duration: null,
          notes: null,
        });
      }

      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (pkg.validityDays || 90));

      // ✅ SQL: Create enrollment
      const enrollment = await packagesRepo.createEnrollment({
        packageId: pkg.id,
        vendorId,
        customerId,
        petId,
        packageName: pkg.name,
        serviceType: pkg.serviceType,
        totalSessions: pkg.totalSessions,
        sessionsUsed: 0,
        sessionsRemaining: pkg.totalSessions,
        status: 'pending_payment',
        expiresAt: expiresAt.toISOString(),
        requiresOtp: pkg.requiresOtp,
        sessions: sessions,
        notes: JSON.stringify({
          preferredSchedule,
          serviceLocation,
          customerNotes: notes,
          paymentMethod: paymentMethod || 'online',
        }),
      });

      console.log(`✅ [PACKAGE ENROLLMENT] Created enrollment: ${enrollment.id}`);
      console.log(`💰 [PACKAGE ENROLLMENT] Total price: ₹${pkg.price} for ${pkg.totalSessions} sessions`);

      return sendSuccess(c, {
        enrollment: {
          id: enrollment.id,
          packageName: pkg.name,
          totalSessions: pkg.totalSessions,
          totalPrice: pkg.price,
          pricePerSession: pkg.pricePerSession || (pkg.price / pkg.totalSessions),
          validityDays: pkg.validityDays,
          expiresAt: enrollment.expiresAt,
          status: enrollment.status
        },
        payment: {
          amount: pkg.price,
          currency: 'INR',
          description: `${pkg.name} - ${pkg.totalSessions} sessions`
        }
      }, 'Enrollment created. Please complete payment to activate.');

    } catch (error) {
      console.error('❌ [PACKAGE ENROLLMENT] Error:', error);
      return sendError(c, String(error), 500);
    }
  });

  // =============================================
  // GET CUSTOMER ENROLLMENTS
  // =============================================
  app.get(`${BASE}/customer/:customerId/package-enrollments`, async (c) => {
    try {
      const { customerId } = c.req.param();
      const status = c.req.query('status'); // active, completed, pending_payment

      console.log(`📦 [CUSTOMER ENROLLMENTS] Customer: ${customerId}`);

      // ✅ SQL: Get customer enrollments
      const packagesRepo = getPackagesRepository();
      const enrollments = await packagesRepo.getCustomerEnrollments(customerId, status || undefined);

      // Sort by created date (newest first)
      enrollments.sort((a: any, b: any) => 
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );

      console.log(`✅ [CUSTOMER ENROLLMENTS] Found ${enrollments.length} enrollments`);

      return sendSuccess(c, {
        enrollments,
        total: enrollments.length,
        breakdown: {
          active: enrollments.filter((e: any) => e.status === 'active').length,
          pendingPayment: enrollments.filter((e: any) => e.status === 'pending_payment').length,
          completed: enrollments.filter((e: any) => e.status === 'completed').length
        }
      });

    } catch (error) {
      console.error('❌ [CUSTOMER ENROLLMENTS] Error:', error);
      return sendError(c, 'Failed to fetch enrollments', 500);
    }
  });

  // =============================================
  // GET ENROLLMENT DETAILS
  // =============================================
  app.get(`${BASE}/customer/enrollments/:enrollmentId`, async (c) => {
    try {
      const { enrollmentId } = c.req.param();

      console.log(`📦 [ENROLLMENT DETAILS] ID: ${enrollmentId}`);

      // ✅ SQL: Get enrollment
      const packagesRepo = getPackagesRepository();
      const enrollment = await packagesRepo.getEnrollmentById(enrollmentId);

      if (!enrollment) {
        return sendError(c, 'Enrollment not found', 404);
      }

      // ✅ SQL: Get vendor details
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(enrollment.vendorId);

      // ✅ SQL: Get package details
      const pkg = await packagesRepo.getPackageById(enrollment.packageId);

      const enrollmentNotes = enrollment.notes ? JSON.parse(enrollment.notes) : {};

      return sendSuccess(c, {
        enrollment: {
          ...enrollment,
          vendor: vendor ? {
            id: vendor.id,
            businessName: vendor.business_name,
            phone: vendor.phone,
            address: vendor.address,
            logo: null,
          } : null,
          package: pkg ? {
            name: pkg.name,
            description: pkg.description,
            includes: pkg.includes,
            requirements: pkg.requirements
          } : null,
          progress: {
            completedSessions: enrollment.sessionsUsed || 0,
            totalSessions: enrollment.totalSessions,
            percentage: ((enrollment.sessionsUsed || 0) / enrollment.totalSessions * 100).toFixed(1),
            remainingSessions: enrollment.totalSessions - (enrollment.sessionsUsed || 0)
          },
          preferredSchedule: enrollmentNotes.preferredSchedule,
          serviceLocation: enrollmentNotes.serviceLocation,
        }
      });

    } catch (error) {
      console.error('❌ [ENROLLMENT DETAILS] Error:', error);
      return sendError(c, 'Failed to fetch enrollment details', 500);
    }
  });

  // =============================================
  // ACTIVATE ENROLLMENT (After Payment)
  // =============================================
  app.post(`${BASE}/customer/enrollments/:enrollmentId/activate`, async (c) => {
    try {
      const { enrollmentId } = c.req.param();
      const { paymentId } = await c.req.json();

      console.log(`✅ [ACTIVATE ENROLLMENT] ID: ${enrollmentId}, Payment: ${paymentId}`);

      // ✅ SQL: Get enrollment
      const packagesRepo = getPackagesRepository();
      const enrollment = await packagesRepo.getEnrollmentById(enrollmentId);

      if (!enrollment) {
        return sendError(c, 'Enrollment not found', 404);
      }

      // ✅ SQL: Update enrollment status
      const updated = await packagesRepo.updateEnrollment(enrollmentId, {
        status: 'active',
        notes: JSON.stringify({
          ...(enrollment.notes ? JSON.parse(enrollment.notes) : {}),
          paymentId,
          enrolledAt: new Date().toISOString(),
        }),
      });

      if (!updated) {
        return sendError(c, 'Failed to activate enrollment', 500);
      }

      console.log(`✅ [ACTIVATE ENROLLMENT] Activated: ${enrollmentId}`);

      return sendSuccess(c, {
        enrollment: updated,
      }, 'Package enrollment activated successfully');

    } catch (error) {
      console.error('❌ [ACTIVATE ENROLLMENT] Error:', error);
      return sendError(c, 'Failed to activate enrollment', 500);
    }
  });

  // =============================================
  // CANCEL ENROLLMENT
  // =============================================
  app.post(`${BASE}/customer/enrollments/:enrollmentId/cancel`, async (c) => {
    try {
      const { enrollmentId } = c.req.param();
      const { reason } = await c.req.json();

      console.log(`❌ [CANCEL ENROLLMENT] ID: ${enrollmentId}`);

      // ✅ SQL: Get enrollment
      const packagesRepo = getPackagesRepository();
      const enrollment = await packagesRepo.getEnrollmentById(enrollmentId);

      if (!enrollment) {
        return sendError(c, 'Enrollment not found', 404);
      }

      // ✅ SQL: Update enrollment status
      const updated = await packagesRepo.updateEnrollment(enrollmentId, {
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        cancellationReason: reason || 'Customer cancellation',
      });

      if (!updated) {
        return sendError(c, 'Failed to cancel enrollment', 500);
      }

      console.log(`✅ [CANCEL ENROLLMENT] Cancelled: ${enrollmentId}`);

      return sendSuccess(c, {}, 'Enrollment cancelled successfully');

    } catch (error) {
      console.error('❌ [CANCEL ENROLLMENT] Error:', error);
      return sendError(c, 'Failed to cancel enrollment', 500);
    }
  });
}

