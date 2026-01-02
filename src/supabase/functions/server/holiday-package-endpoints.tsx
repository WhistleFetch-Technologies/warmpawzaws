import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";

/**
 * 🏖️ PET HOLIDAY PACKAGE ENDPOINTS
 * 
 * Complete holiday package management system for pet travel experiences
 * 
 * Features:
 * - Group tours, private tours, family tours
 * - Package CRUD with inclusions/exclusions
 * - Booking management with date selection
 * - Availability tracking
 * - Customer booking history
 */

export function holidayPackageEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

  // ============================================
  // CUSTOMER ENDPOINTS
  // ============================================

  /**
   * GET /holiday-packages
   * Browse all available holiday packages
   */
  app.get(`${BASE_PATH}/holiday-packages`, async (c) => {
    try {
      const { tourType, minPrice, maxPrice, minDuration, maxDuration, destination } = c.req.query();

      console.log('🏖️ Loading holiday packages...');

      const packageIds = await kv.getByPrefix('holiday-package:') || [];
      
      let packages = [];
      for (const item of packageIds) {
        const pkg = item.value || item;
        
        // Apply filters
        if (tourType && pkg.tourType !== tourType) continue;
        if (minPrice && pkg.price < parseInt(minPrice)) continue;
        if (maxPrice && pkg.price > parseInt(maxPrice)) continue;
        if (minDuration && pkg.duration < parseInt(minDuration)) continue;
        if (maxDuration && pkg.duration > parseInt(maxDuration)) continue;
        if (destination && !pkg.destination.toLowerCase().includes(destination.toLowerCase())) continue;
        
        // Only show active packages
        if (pkg.status === 'active') {
          packages.push(pkg);
        }
      }

      // Sort by rating and popularity
      packages.sort((a, b) => {
        const scoreA = (a.rating || 0) * 0.7 + (a.currentBookings || 0) * 0.3;
        const scoreB = (b.rating || 0) * 0.7 + (b.currentBookings || 0) * 0.3;
        return scoreB - scoreA;
      });

      console.log(`✅ Loaded ${packages.length} holiday packages`);

      return sendSuccess(c, { packages, total: packages.length });

    } catch (error) {
      console.error('❌ Error loading holiday packages:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /holiday-packages/:packageId
   * Get detailed package information
   */
  app.get(`${BASE_PATH}/holiday-packages/:packageId`, async (c) => {
    try {
      const { packageId } = c.req.param();

      const pkg = await kv.get(`holiday-package:${packageId}`);
      
      if (!pkg) {
        return sendError(c, 'Package not found', 404);
      }

      return sendSuccess(c, { package: pkg });

    } catch (error) {
      console.error('❌ Error loading package:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /holiday-packages/book
   * Book a holiday package
   */
  app.post(`${BASE_PATH}/holiday-packages/book`, async (c) => {
    try {
      const {
        customerId,
        packageId,
        vendorId,
        packageTitle,
        destination,
        tourType,
        selectedDate,
        numberOfPets,
        numberOfPeople,
        duration,
        totalAmount,
        inclusions,
        petDetails,
        contactInfo
      } = await c.req.json();

      console.log(`🏖️ Booking holiday package ${packageId} for customer ${customerId}`);

      // Validate package exists and is available
      const pkg = await kv.get(`holiday-package:${packageId}`);
      if (!pkg) {
        return sendError(c, 'Package not found', 404);
      }

      if (pkg.status !== 'active') {
        return sendError(c, 'Package is not available', 400);
      }

      // Check availability for selected date
      if (!pkg.availableDates.includes(selectedDate)) {
        return sendError(c, 'Selected date is not available', 400);
      }

      // Check capacity
      const currentBookings = pkg.currentBookings || 0;
      if (tourType === 'group' && currentBookings + numberOfPets > pkg.maxPets) {
        return sendError(c, 'Package is fully booked for this date', 400);
      }

      // Create booking
      const bookingId = `HOLIDAY-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      const booking = {
        id: bookingId,
        type: 'holiday_package',
        customerId,
        packageId,
        vendorId,
        vendorName: pkg.vendorName,
        
        // Package details
        packageTitle,
        destination,
        tourType,
        duration,
        
        // Booking details
        selectedDate,
        numberOfPets,
        numberOfPeople,
        petDetails: petDetails || [],
        contactInfo: contactInfo || {},
        
        // Pricing
        totalAmount,
        inclusions: inclusions || pkg.inclusions,
        
        // Status tracking
        status: 'pending_payment',
        paymentStatus: 'pending',
        bookingDate: new Date().toISOString(),
        
        // Trip status
        tripStatus: 'upcoming',
        checkInDate: null,
        checkOutDate: null,
        
        // Communication
        notifications: [],
        messages: []
      };

      // Save booking
      await kv.set(`booking:${bookingId}`, booking);

      // Add to customer's bookings
      const customerBookings = await kv.get(`customer:${customerId}:bookings`) || [];
      customerBookings.unshift(bookingId);
      await kv.set(`customer:${customerId}:bookings`, customerBookings);

      // Add to vendor's bookings
      const vendorBookings = await kv.get(`vendor:${vendorId}:holiday-bookings`) || [];
      vendorBookings.unshift(bookingId);
      await kv.set(`vendor:${vendorId}:holiday-bookings`, vendorBookings);

      // Update package booking count
      pkg.currentBookings = (pkg.currentBookings || 0) + numberOfPets;
      await kv.set(`holiday-package:${packageId}`, pkg);

      console.log(`✅ Holiday booking created: ${bookingId}`);

      // TODO: Send confirmation notification to customer
      // TODO: Send new booking notification to vendor

      return sendSuccess(c, { booking, message: 'Holiday package booked successfully' });

    } catch (error) {
      console.error('❌ Error booking holiday package:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /customer/:customerId/holiday-bookings
   * Get customer's holiday bookings
   */
  app.get(`${BASE_PATH}/customer/:customerId/holiday-bookings`, async (c) => {
    try {
      const { customerId } = c.req.param();

      const bookingIds = await kv.get(`customer:${customerId}:bookings`) || [];
      
      const bookings = [];
      for (const id of bookingIds) {
        const booking = await kv.get(`booking:${id}`);
        if (booking && booking.type === 'holiday_package') {
          bookings.push(booking);
        }
      }

      return sendSuccess(c, { bookings, total: bookings.length });

    } catch (error) {
      console.error('❌ Error loading holiday bookings:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // VENDOR ENDPOINTS
  // ============================================

  /**
   * POST /vendor/:vendorId/holiday-packages
   * Create a new holiday package
   */
  app.post(`${BASE_PATH}/vendor/:vendorId/holiday-packages`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const {
        title,
        destination,
        description,
        photos,
        tourType,
        duration,
        price,
        pricePerPet,
        inclusions,
        exclusions,
        availableDates,
        maxPets,
        maxPeople,
        petTypes,
        difficulty,
        accommodation,
        meals,
        activities,
        itinerary
      } = await c.req.json();

      console.log(`🏖️ Creating holiday package for vendor ${vendorId}`);

      // Get vendor details
      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      // Create package
      const packageId = `PKG-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      const pkg = {
        id: packageId,
        vendorId,
        vendorName: vendor.businessName || vendor.fullName,
        vendorPhoto: vendor.profilePhoto,
        
        // Package details
        title,
        destination,
        description,
        photos: photos || [],
        tourType, // group | private | family
        duration, // days
        
        // Pricing
        price,
        pricePerPet: pricePerPet || 0,
        
        // Inclusions/Exclusions
        inclusions: inclusions || [],
        exclusions: exclusions || [],
        
        // Availability
        availableDates: availableDates || [],
        maxPets: maxPets || 10,
        maxPeople: maxPeople || 20,
        currentBookings: 0,
        
        // Pet requirements
        petTypes: petTypes || ['dog', 'cat'],
        difficulty: difficulty || 'moderate',
        
        // Details
        accommodation: accommodation || '',
        meals: meals || '',
        activities: activities || [],
        itinerary: itinerary || [],
        
        // Ratings
        rating: 0,
        reviews: 0,
        
        // Status
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save package
      await kv.set(`holiday-package:${packageId}`, pkg);

      // Add to vendor's packages
      const vendorPackages = await kv.get(`vendor:${vendorId}:holiday-packages`) || [];
      vendorPackages.unshift(packageId);
      await kv.set(`vendor:${vendorId}:holiday-packages`, vendorPackages);

      console.log(`✅ Holiday package created: ${packageId}`);

      return sendSuccess(c, { package: pkg, message: 'Package created successfully' });

    } catch (error) {
      console.error('❌ Error creating holiday package:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/holiday-packages
   * Get vendor's holiday packages
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/holiday-packages`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      const packageIds = await kv.get(`vendor:${vendorId}:holiday-packages`) || [];
      
      const packages = [];
      for (const id of packageIds) {
        const pkg = await kv.get(`holiday-package:${id}`);
        if (pkg) {
          packages.push(pkg);
        }
      }

      return sendSuccess(c, { packages, total: packages.length });

    } catch (error) {
      console.error('❌ Error loading vendor packages:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/holiday-packages/:packageId
   * Update holiday package
   */
  app.put(`${BASE_PATH}/vendor/:vendorId/holiday-packages/:packageId`, async (c) => {
    try {
      const { vendorId, packageId } = c.req.param();
      const updates = await c.req.json();

      const pkg = await kv.get(`holiday-package:${packageId}`);
      
      if (!pkg) {
        return sendError(c, 'Package not found', 404);
      }

      if (pkg.vendorId !== vendorId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // Update package
      const updated = {
        ...pkg,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await kv.set(`holiday-package:${packageId}`, updated);

      console.log(`✅ Holiday package updated: ${packageId}`);

      return sendSuccess(c, { package: updated, message: 'Package updated successfully' });

    } catch (error) {
      console.error('❌ Error updating package:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/holiday-bookings
   * Get vendor's holiday bookings
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/holiday-bookings`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { status, date } = c.req.query();

      const bookingIds = await kv.get(`vendor:${vendorId}:holiday-bookings`) || [];
      
      const bookings = [];
      for (const id of bookingIds) {
        const booking = await kv.get(`booking:${id}`);
        if (booking) {
          // Filter by status if provided
          if (status && booking.status !== status) continue;
          
          // Filter by date if provided
          if (date && !booking.selectedDate.startsWith(date)) continue;
          
          bookings.push(booking);
        }
      }

      return sendSuccess(c, { bookings, total: bookings.length });

    } catch (error) {
      console.error('❌ Error loading vendor bookings:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/holiday-bookings/:bookingId/status
   * Update booking status
   */
  app.put(`${BASE_PATH}/vendor/:vendorId/holiday-bookings/:bookingId/status`, async (c) => {
    try {
      const { vendorId, bookingId } = c.req.param();
      const { status, tripStatus, notes } = await c.req.json();

      const booking = await kv.get(`booking:${bookingId}`);
      
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      if (booking.vendorId !== vendorId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // Update booking
      if (status) booking.status = status;
      if (tripStatus) booking.tripStatus = tripStatus;
      if (notes) booking.notes = (booking.notes || '') + '\n' + notes;
      
      booking.updatedAt = new Date().toISOString();

      await kv.set(`booking:${bookingId}`, booking);

      console.log(`✅ Holiday booking updated: ${bookingId}`);

      return sendSuccess(c, { booking, message: 'Booking updated successfully' });

    } catch (error) {
      console.error('❌ Error updating booking:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // ANALYTICS
  // ============================================

  /**
   * GET /vendor/:vendorId/holiday-analytics
   * Get holiday package analytics
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/holiday-analytics`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      const packageIds = await kv.get(`vendor:${vendorId}:holiday-packages`) || [];
      const bookingIds = await kv.get(`vendor:${vendorId}:holiday-bookings`) || [];

      const analytics = {
        totalPackages: packageIds.length,
        activePackages: 0,
        totalBookings: bookingIds.length,
        upcomingTrips: 0,
        completedTrips: 0,
        totalRevenue: 0,
        averageRating: 0,
        popularDestinations: {} as Record<string, number>
      };

      // Analyze packages
      for (const id of packageIds) {
        const pkg = await kv.get(`holiday-package:${id}`);
        if (pkg) {
          if (pkg.status === 'active') analytics.activePackages++;
          analytics.averageRating += pkg.rating || 0;
        }
      }

      if (packageIds.length > 0) {
        analytics.averageRating /= packageIds.length;
      }

      // Analyze bookings
      for (const id of bookingIds) {
        const booking = await kv.get(`booking:${id}`);
        if (booking) {
          if (booking.tripStatus === 'upcoming') analytics.upcomingTrips++;
          if (booking.tripStatus === 'completed') analytics.completedTrips++;
          if (booking.status === 'completed') {
            analytics.totalRevenue += booking.totalAmount || 0;
          }
          
          // Track popular destinations
          if (booking.destination) {
            analytics.popularDestinations[booking.destination] = 
              (analytics.popularDestinations[booking.destination] || 0) + 1;
          }
        }
      }

      return sendSuccess(c, { analytics });

    } catch (error) {
      console.error('❌ Error loading analytics:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Holiday Package Endpoints registered');
}
