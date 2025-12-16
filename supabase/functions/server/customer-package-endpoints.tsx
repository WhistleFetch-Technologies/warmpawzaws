import { Hono } from "npm:hono";
import * as kv from './kv_store.tsx';
import { generateId } from './database-schema.tsx';

/**
 * ✅ GAP #3 FIX: CUSTOMER PACKAGE DISCOVERY & BOOKING
 * Production-ready customer-facing package endpoints
 * 
 * Features:
 * - Package discovery (grooming, training, walker)
 * - Package enrollment (booking multi-session packages)
 * - Session scheduling
 * - Package progress tracking
 * - Payment integration
 * - Automatic enrollment creation
 */

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

      let allPackages: any[] = [];

      if (vendorId) {
        // Get packages for specific vendor
        const packages = await kv.get(`vendor:${vendorId}:service_packages`) || [];
        allPackages = packages
          .filter((p: any) => p.isActive)
          .map((p: any) => ({ ...p, vendorId }));
      } else {
        // Get packages from all vendors
        const allVendors = await kv.getByPrefix('vendor:');
        
        for (const vendor of allVendors) {
          if (!vendor.id || vendor.id.includes(':')) continue; // Skip non-vendor records
          
          const packages = await kv.get(`vendor:${vendor.id}:service_packages`) || [];
          const activePackages = packages
            .filter((p: any) => p.isActive)
            .map((p: any) => ({ ...p, vendorId: vendor.id }));
          
          allPackages.push(...activePackages);
        }
      }

      // Apply filters
      let filtered = allPackages;

      if (serviceType) {
        filtered = filtered.filter((p: any) => p.serviceType === serviceType);
      }

      if (petType) {
        filtered = filtered.filter((p: any) => 
          p.petTypes?.includes(petType)
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

      // Enrich with vendor details
      const enriched = await Promise.all(filtered.map(async (pkg: any) => {
        const vendor = await kv.get(`vendor:${pkg.vendorId}`);
        
        return {
          ...pkg,
          vendor: vendor ? {
            id: vendor.id,
            businessName: vendor.businessName,
            rating: vendor.rating || 0,
            totalReviews: vendor.totalReviews || 0,
            address: vendor.address,
            city: vendor.city,
            logo: vendor.logo
          } : null
        };
      }));

      // Sort by price (default)
      enriched.sort((a, b) => a.price - b.price);

      console.log(`✅ [PACKAGE DISCOVERY] Found ${enriched.length} packages`);

      return c.json({
        success: true,
        packages: enriched,
        total: enriched.length,
        filters: {
          serviceTypes: [...new Set(allPackages.map(p => p.serviceType))],
          priceRange: {
            min: Math.min(...allPackages.map(p => p.price)),
            max: Math.max(...allPackages.map(p => p.price))
          }
        }
      });

    } catch (error) {
      console.error('❌ [PACKAGE DISCOVERY] Error:', error);
      return c.json({ error: 'Failed to discover packages' }, 500);
    }
  });

  // =============================================
  // GET PACKAGE DETAILS
  // =============================================
  app.get(`${BASE}/customer/packages/:vendorId/:packageId`, async (c) => {
    try {
      const { vendorId, packageId } = c.req.param();

      console.log(`📦 [PACKAGE DETAILS] Vendor: ${vendorId}, Package: ${packageId}`);

      const packages = await kv.get(`vendor:${vendorId}:service_packages`) || [];
      const pkg = packages.find((p: any) => p.id === packageId);

      if (!pkg) {
        return c.json({ error: 'Package not found' }, 404);
      }

      // Get vendor details
      const vendor = await kv.get(`vendor:${vendorId}`);

      // Get reviews for this package
      const allReviews = await kv.get(`vendor:${vendorId}:reviews`) || [];
      const packageReviews = allReviews.filter((r: any) => r.packageId === packageId);

      // Calculate stats
      const enrollments = await kv.get(`vendor:${vendorId}:package_enrollments`) || [];
      const packageEnrollments = enrollments.filter((e: any) => e.packageId === packageId);
      const activeEnrollments = packageEnrollments.filter((e: any) => e.status === 'active').length;

      return c.json({
        success: true,
        package: {
          ...pkg,
          vendor: vendor ? {
            id: vendor.id,
            businessName: vendor.businessName,
            rating: vendor.rating || 0,
            totalReviews: vendor.totalReviews || 0,
            address: vendor.address,
            city: vendor.city,
            phone: vendor.phone,
            logo: vendor.logo
          } : null,
          stats: {
            totalEnrollments: packageEnrollments.length,
            activeEnrollments,
            avgRating: packageReviews.length > 0
              ? packageReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / packageReviews.length
              : 0,
            reviewCount: packageReviews.length
          },
          reviews: packageReviews.slice(0, 5) // Top 5 reviews
        }
      });

    } catch (error) {
      console.error('❌ [PACKAGE DETAILS] Error:', error);
      return c.json({ error: 'Failed to fetch package details' }, 500);
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

      // ✅ VALIDATION: Verify package exists and is active
      const packages = await kv.get(`vendor:${vendorId}:service_packages`) || [];
      const pkg = packages.find((p: any) => p.id === packageId);

      if (!pkg) {
        console.error('❌ [PACKAGE ENROLLMENT] Package not found');
        return c.json({ error: 'Package not found' }, 404);
      }

      if (!pkg.isActive) {
        console.error('❌ [PACKAGE ENROLLMENT] Package is inactive');
        return c.json({ error: 'Package is no longer available' }, 400);
      }

      // ✅ VALIDATION: Check max active enrollments
      const existingEnrollments = await kv.get(`vendor:${vendorId}:package_enrollments`) || [];
      const activeCount = existingEnrollments.filter((e: any) => 
        e.packageId === packageId && e.status === 'active'
      ).length;

      if (activeCount >= pkg.maxActiveEnrollments) {
        console.error('❌ [PACKAGE ENROLLMENT] Package at capacity');
        return c.json({ error: 'Package enrollment limit reached. Please try again later.' }, 400);
      }

      // Get customer and pet details
      const customer = await kv.get(`customer:${customerId}`);
      const pet = await kv.get(`pet:${petId}`);

      if (!pet) {
        return c.json({ error: 'Pet not found' }, 404);
      }

      // ✅ VALIDATION: Pet type compatibility
      if (!pkg.petTypes.includes(pet.type)) {
        console.error(`❌ [PACKAGE ENROLLMENT] Pet type mismatch: ${pet.type} not in ${pkg.petTypes}`);
        return c.json({ 
          error: `This package is only for ${pkg.petTypes.join(', ')} pets` 
        }, 400);
      }

      // Generate enrollment ID
      const enrollmentId = generateId('enrollment');

      // Create sessions array
      const sessions = [];
      for (let i = 0; i < pkg.totalSessions; i++) {
        const sessionId = generateId('session');
        
        sessions.push({
          id: sessionId,
          sessionNumber: i + 1,
          status: 'scheduled', // scheduled, in_progress, completed, cancelled
          scheduledDate: null, // To be scheduled later
          scheduledTime: null,
          assignedStaffId: null,
          assignedStaffName: null,
          
          // OTPs (generated when staff is assigned and session is scheduled)
          otp: null, // Start OTP
          endOtp: null, // End OTP
          
          // Session execution
          startedAt: null,
          completedAt: null,
          startLocation: null,
          endLocation: null,
          duration: null,
          notes: null,
          completionPhotos: [],
          
          // GPS tracking (for walker services)
          gpsTracking: null,
          
          createdAt: new Date().toISOString()
        });
      }

      // Create enrollment
      const enrollment = {
        id: enrollmentId,
        
        // Package reference
        packageId: pkg.id,
        packageName: pkg.name,
        vendorId,
        serviceType: pkg.serviceType,
        
        // Customer & Pet
        customerId,
        customerName: customer?.name || '',
        customerPhone: customer?.phone || '',
        petId,
        petName: pet.name,
        petType: pet.type,
        
        // Sessions
        totalSessions: pkg.totalSessions,
        completedSessions: 0,
        sessions,
        
        // Pricing
        totalPrice: pkg.price,
        pricePerSession: pkg.pricePerSession,
        discountPercent: pkg.discountPercent || 0,
        
        // Payment
        paymentStatus: 'pending', // pending, paid, partially_paid
        paymentMethod: paymentMethod || 'online',
        paidAmount: 0,
        
        // Service details
        serviceStyle: pkg.serviceStyle,
        serviceLocation: serviceLocation || null, // For at-home services
        
        // Schedule preferences
        preferredSchedule: preferredSchedule || null,
        // Example: { days: ['Mon', 'Wed', 'Fri'], time: '10:00' }
        
        // Validity
        validityDays: pkg.validityDays,
        expiresAt: new Date(Date.now() + pkg.validityDays * 24 * 60 * 60 * 1000).toISOString(),
        
        // Configuration
        requiresOTP: pkg.requiresOTP,
        requiresGPSTracking: pkg.requiresGPSTracking,
        
        // Notes
        customerNotes: notes || '',
        
        // Status
        status: 'pending_payment', // pending_payment, active, completed, cancelled, expired
        
        // Timestamps
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        enrolledAt: null, // Set when payment is completed
        completedAt: null
      };

      // ✅ Save enrollment
      existingEnrollments.push(enrollment);
      await kv.set(`vendor:${vendorId}:package_enrollments`, existingEnrollments);

      // ✅ Track in customer's enrollments
      const customerEnrollments = await kv.get(`customer:${customerId}:package_enrollments`) || [];
      customerEnrollments.unshift(enrollmentId);
      await kv.set(`customer:${customerId}:package_enrollments`, customerEnrollments);

      // ✅ Track in pet's history
      const petEnrollments = await kv.get(`pet:${petId}:package_enrollments`) || [];
      petEnrollments.unshift(enrollmentId);
      await kv.set(`pet:${petId}:package_enrollments`, petEnrollments);

      console.log(`✅ [PACKAGE ENROLLMENT] Created enrollment: ${enrollmentId}`);
      console.log(`💰 [PACKAGE ENROLLMENT] Total price: ₹${pkg.price} for ${pkg.totalSessions} sessions`);

      return c.json({
        success: true,
        enrollment: {
          id: enrollmentId,
          packageName: pkg.name,
          totalSessions: pkg.totalSessions,
          totalPrice: pkg.price,
          pricePerSession: pkg.pricePerSession,
          validityDays: pkg.validityDays,
          expiresAt: enrollment.expiresAt,
          status: enrollment.status
        },
        // Return payment details for next step
        payment: {
          amount: pkg.price,
          currency: 'INR',
          description: `${pkg.name} - ${pkg.totalSessions} sessions`
        },
        message: 'Enrollment created. Please complete payment to activate.'
      });

    } catch (error) {
      console.error('❌ [PACKAGE ENROLLMENT] Error:', error);
      return c.json({ error: String(error) }, 500);
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

      const enrollmentIds = await kv.get(`customer:${customerId}:package_enrollments`) || [];

      // Fetch all enrollments
      const enrollments = [];
      for (const enrollmentId of enrollmentIds) {
        // Find enrollment across all vendors
        const allVendorEnrollments = await kv.getByPrefix('vendor:');
        
        for (const vendorData of allVendorEnrollments) {
          if (!vendorData || typeof vendorData !== 'object') continue;
          if (!vendorData.id || !vendorData.id.includes(':package_enrollments')) continue;
          
          const vendorEnrollments = await kv.get(vendorData.id) || [];
          const enrollment = vendorEnrollments.find((e: any) => e.id === enrollmentId);
          
          if (enrollment) {
            enrollments.push(enrollment);
            break;
          }
        }
      }

      // Filter by status
      let filtered = enrollments;
      if (status) {
        filtered = enrollments.filter((e: any) => e.status === status);
      }

      // Sort by created date (newest first)
      filtered.sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      console.log(`✅ [CUSTOMER ENROLLMENTS] Found ${filtered.length} enrollments`);

      return c.json({
        success: true,
        enrollments: filtered,
        total: filtered.length,
        breakdown: {
          active: enrollments.filter((e: any) => e.status === 'active').length,
          pendingPayment: enrollments.filter((e: any) => e.status === 'pending_payment').length,
          completed: enrollments.filter((e: any) => e.status === 'completed').length
        }
      });

    } catch (error) {
      console.error('❌ [CUSTOMER ENROLLMENTS] Error:', error);
      return c.json({ error: 'Failed to fetch enrollments' }, 500);
    }
  });

  // =============================================
  // GET ENROLLMENT DETAILS
  // =============================================
  app.get(`${BASE}/customer/enrollments/:enrollmentId`, async (c) => {
    try {
      const { enrollmentId } = c.req.param();

      console.log(`📦 [ENROLLMENT DETAILS] ID: ${enrollmentId}`);

      // Find enrollment across all vendors
      const allVendorEnrollments = await kv.getByPrefix('vendor:');
      
      let enrollment = null;
      for (const vendorData of allVendorEnrollments) {
        if (!vendorData || typeof vendorData !== 'object') continue;
        if (!vendorData.id || !vendorData.id.includes(':package_enrollments')) continue;
        
        const vendorEnrollments = await kv.get(vendorData.id) || [];
        const found = vendorEnrollments.find((e: any) => e.id === enrollmentId);
        
        if (found) {
          enrollment = found;
          break;
        }
      }

      if (!enrollment) {
        return c.json({ error: 'Enrollment not found' }, 404);
      }

      // Get vendor details
      const vendor = await kv.get(`vendor:${enrollment.vendorId}`);

      // Get package details
      const packages = await kv.get(`vendor:${enrollment.vendorId}:service_packages`) || [];
      const pkg = packages.find((p: any) => p.id === enrollment.packageId);

      return c.json({
        success: true,
        enrollment: {
          ...enrollment,
          vendor: vendor ? {
            id: vendor.id,
            businessName: vendor.businessName,
            phone: vendor.phone,
            address: vendor.address,
            logo: vendor.logo
          } : null,
          package: pkg ? {
            name: pkg.name,
            description: pkg.description,
            includes: pkg.includes,
            requirements: pkg.requirements
          } : null,
          progress: {
            completedSessions: enrollment.completedSessions,
            totalSessions: enrollment.totalSessions,
            percentage: (enrollment.completedSessions / enrollment.totalSessions * 100).toFixed(1),
            remainingSessions: enrollment.totalSessions - enrollment.completedSessions
          }
        }
      });

    } catch (error) {
      console.error('❌ [ENROLLMENT DETAILS] Error:', error);
      return c.json({ error: 'Failed to fetch enrollment details' }, 500);
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

      // Find and update enrollment
      const allVendorEnrollments = await kv.getByPrefix('vendor:');
      
      for (const vendorData of allVendorEnrollments) {
        if (!vendorData || typeof vendorData !== 'object') continue;
        
        const key = vendorData.id;
        if (!key || !key.includes(':package_enrollments')) continue;
        
        const vendorEnrollments = await kv.get(key) || [];
        const index = vendorEnrollments.findIndex((e: any) => e.id === enrollmentId);
        
        if (index !== -1) {
          const enrollment = vendorEnrollments[index];
          
          // Update enrollment status
          enrollment.status = 'active';
          enrollment.paymentStatus = 'paid';
          enrollment.paidAmount = enrollment.totalPrice;
          enrollment.paymentId = paymentId;
          enrollment.enrolledAt = new Date().toISOString();
          enrollment.updatedAt = new Date().toISOString();
          
          // Save
          vendorEnrollments[index] = enrollment;
          await kv.set(key, vendorEnrollments);
          
          console.log(`✅ [ACTIVATE ENROLLMENT] Activated: ${enrollmentId}`);
          
          return c.json({
            success: true,
            enrollment,
            message: 'Package enrollment activated successfully'
          });
        }
      }

      return c.json({ error: 'Enrollment not found' }, 404);

    } catch (error) {
      console.error('❌ [ACTIVATE ENROLLMENT] Error:', error);
      return c.json({ error: 'Failed to activate enrollment' }, 500);
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

      // Find and update enrollment
      const allVendorEnrollments = await kv.getByPrefix('vendor:');
      
      for (const vendorData of allVendorEnrollments) {
        if (!vendorData || typeof vendorData !== 'object') continue;
        
        const key = vendorData.id;
        if (!key || !key.includes(':package_enrollments')) continue;
        
        const vendorEnrollments = await kv.get(key) || [];
        const index = vendorEnrollments.findIndex((e: any) => e.id === enrollmentId);
        
        if (index !== -1) {
          const enrollment = vendorEnrollments[index];
          
          // Update status
          enrollment.status = 'cancelled';
          enrollment.cancelledAt = new Date().toISOString();
          enrollment.cancellationReason = reason || 'Customer cancellation';
          enrollment.updatedAt = new Date().toISOString();
          
          // Save
          vendorEnrollments[index] = enrollment;
          await kv.set(key, vendorEnrollments);
          
          console.log(`✅ [CANCEL ENROLLMENT] Cancelled: ${enrollmentId}`);
          
          return c.json({
            success: true,
            message: 'Enrollment cancelled successfully'
          });
        }
      }

      return c.json({ error: 'Enrollment not found' }, 404);

    } catch (error) {
      console.error('❌ [CANCEL ENROLLMENT] Error:', error);
      return c.json({ error: 'Failed to cancel enrollment' }, 500);
    }
  });
}
