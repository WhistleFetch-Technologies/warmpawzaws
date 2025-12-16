import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * 🏖️ HOLIDAY PACKAGE SYSTEM
 * 
 * Phase 7B: Critical Services Implementation
 * Business Rule 13 Compliance: Pet Holiday Packages
 * 
 * Features:
 * - Holiday package creation
 * - Package browsing and filtering
 * - Package booking
 * - Group tour management
 * - Availability management
 * - Vendor dashboard
 */

interface HolidayPackage {
  packageId: string;
  vendorId: string;
  packageName: string;
  description: string;
  destination: string;
  destinationImage?: string;
  packageType: 'beach' | 'mountain' | 'city' | 'wildlife' | 'adventure' | 'luxury';
  duration: {
    days: number;
    nights: number;
  };
  pricing: {
    basePrice: number;
    pricePerPet: number;
    pricePerAdult: number;
    pricePerChild: number;
    currency: string;
  };
  inclusions: string[];
  exclusions: string[];
  isGroupTour: boolean;
  minGroupSize?: number;
  maxGroupSize?: number;
  availableDates: Array<{
    startDate: string;
    endDate: string;
    availableSlots: number;
    bookedSlots: number;
  }>;
  itinerary: Array<{
    day: number;
    title: string;
    description: string;
    activities: string[];
  }>;
  requirements: {
    minAge?: number;
    maxAge?: number;
    petRequirements?: string[];
    healthRequirements?: string[];
  };
  cancellationPolicy: string;
  refundPolicy: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface HolidayBooking {
  bookingId: string;
  packageId: string;
  customerId: string;
  vendorId: string;
  selectedStartDate: string;
  selectedEndDate: string;
  travelers: {
    adults: number;
    children: number;
    pets: Array<{
      petId: string;
      petName: string;
      breed: string;
    }>;
  };
  pricing: {
    basePrice: number;
    petCharges: number;
    adultCharges: number;
    childCharges: number;
    totalAmount: number;
  };
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'refunded';
  isGroupTour: boolean;
  groupMembers?: Array<{
    name: string;
    contactNumber: string;
    email: string;
  }>;
  specialRequests?: string;
  dietaryRequirements?: string;
  medicalConditions?: string;
  createdAt: string;
  updatedAt: string;
}

export function holidayPackageSystemEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

  // ========================================
  // HOLIDAY PACKAGE MANAGEMENT
  // ========================================

  // Create holiday package
  app.post(`${BASE_PATH}/holiday-packages/create`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        vendorId,
        packageName,
        description,
        destination,
        packageType,
        duration,
        pricing,
        inclusions = [],
        exclusions = [],
        isGroupTour = false,
        minGroupSize,
        maxGroupSize,
        availableDates = [],
        itinerary = [],
        requirements = {},
        cancellationPolicy,
        refundPolicy
      } = body;

      if (!vendorId || !packageName || !destination || !packageType || !duration || !pricing) {
        return sendError(c, 'Required fields missing', 400);
      }

      const packageId = `holiday_pkg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const holidayPackage: HolidayPackage = {
        packageId,
        vendorId,
        packageName,
        description,
        destination,
        packageType,
        duration,
        pricing: {
          ...pricing,
          currency: pricing.currency || 'INR'
        },
        inclusions,
        exclusions,
        isGroupTour,
        minGroupSize,
        maxGroupSize,
        availableDates,
        itinerary,
        requirements,
        cancellationPolicy: cancellationPolicy || 'Standard cancellation policy applies',
        refundPolicy: refundPolicy || 'Refund available up to 7 days before departure',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`holiday_package_${packageId}`, holidayPackage);

      // Store in vendor's packages list
      const vendorPackages = await kv.get(`vendor_holiday_packages_${vendorId}`) || [];
      vendorPackages.push(packageId);
      await kv.set(`vendor_holiday_packages_${vendorId}`, vendorPackages);

      console.log(`✅ Holiday package created: ${packageId}`);

      return sendSuccess(c, { package: holidayPackage }, 'Holiday package created successfully');
    } catch (error) {
      console.error('Error creating holiday package:', error);
      return sendError(c, error, 500);
    }
  });
  
  // ALIAS: POST /holiday/package/create (QA Requirement)
  app.post(`${BASE_PATH}/holiday/package/create`, async (c) => {
      // Reuse logic or redirect internally? 
      // Hono doesn't support internal redirect easily, so we duplicate logic or extract helper.
      // For simplicity in this edit, I'll just call the same logic via a shared helper if possible, 
      // or just re-implement cleanly.
      
      try {
          const body = await c.req.json();
          // Map input if necessary, or assume same structure
          const { vendorId, name, type, duration, price } = body; 
          
          // Basic validation for "QA" style input
          if (!vendorId || !name) return sendError(c, 'Vendor ID and Name required', 400);
          
          const packageId = `holiday_pkg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const holidayPackage: any = {
              packageId,
              vendorId,
              packageName: name,
              packageType: type || 'custom',
              duration: duration || { days: 1, nights: 0 },
              pricing: { basePrice: price || 0, currency: 'INR' },
              availableDates: [],
              isActive: true,
              createdAt: new Date().toISOString()
          };
          
          await kv.set(`holiday_package_${packageId}`, holidayPackage);
          return sendSuccess(c, { packageId, message: 'Package created (QA Alias)' });
      } catch (e) {
          return sendError(c, e, 500);
      }
  });

  // ALIAS: POST /holiday/package/configure-dates (QA Requirement)
  app.post(`${BASE_PATH}/holiday/package/configure-dates`, async (c) => {
      try {
          const { packageId, dates } = await c.req.json();
          if (!packageId || !dates) return sendError(c, 'Package ID and Dates required', 400);
          
          const pkg = await kv.get(`holiday_package_${packageId}`);
          if (!pkg) return sendError(c, 'Package not found', 404);
          
          pkg.availableDates = dates; // Expect array of {startDate, endDate, slots}
          pkg.updatedAt = new Date().toISOString();
          
          await kv.set(`holiday_package_${packageId}`, pkg);
          return sendSuccess(c, { message: 'Dates configured' });
      } catch (e) {
          return sendError(c, e, 500);
      }
  });
  
  // ALIAS: PUT /holiday/package/:packageId (QA Requirement)
  app.put(`${BASE_PATH}/holiday/package/:packageId`, async (c) => {
     try {
         const packageId = c.req.param('packageId');
         const updates = await c.req.json();
         const pkg = await kv.get(`holiday_package_${packageId}`);
         if (!pkg) return sendError(c, 'Package not found', 404);
         
         const updated = { ...pkg, ...updates, updatedAt: new Date().toISOString() };
         await kv.set(`holiday_package_${packageId}`, updated);
         return sendSuccess(c, { package: updated });
     } catch (e) {
         return sendError(c, e, 500);
     }
  });

  // List all holiday packages
  app.get(`${BASE_PATH}/holiday-packages/list`, async (c) => {
    try {
      const packageType = c.req.query('type');
      const destination = c.req.query('destination');
      const minPrice = c.req.query('minPrice');
      const maxPrice = c.req.query('maxPrice');

      const allPackages = await kv.getByPrefix('holiday_package_');
      
      let packages = allPackages
        .map((item: any) => item.value || item)
        .filter((pkg: any) => pkg.isActive);

      // Apply filters
      if (packageType) {
        packages = packages.filter((pkg: any) => pkg.packageType === packageType);
      }

      if (destination) {
        packages = packages.filter((pkg: any) => 
          pkg.destination.toLowerCase().includes(destination.toLowerCase())
        );
      }

      if (minPrice) {
        packages = packages.filter((pkg: any) => pkg.pricing.basePrice >= parseFloat(minPrice));
      }

      if (maxPrice) {
        packages = packages.filter((pkg: any) => pkg.pricing.basePrice <= parseFloat(maxPrice));
      }

      return sendSuccess(c, { packages, count: packages.length });
    } catch (error) {
      console.error('Error listing packages:', error);
      return sendError(c, error, 500);
    }
  });

  // Get package details
  app.get(`${BASE_PATH}/holiday-packages/:packageId`, async (c) => {
    try {
      const packageId = c.req.param('packageId');

      const holidayPackage = await kv.get(`holiday_package_${packageId}`);

      if (!holidayPackage) {
        return sendError(c, 'Holiday package not found', 404);
      }

      return sendSuccess(c, { package: holidayPackage });
    } catch (error) {
      console.error('Error getting package:', error);
      return sendError(c, error, 500);
    }
  });

  // Update holiday package
  app.put(`${BASE_PATH}/holiday-packages/:packageId`, async (c) => {
    try {
      const packageId = c.req.param('packageId');
      const updates = await c.req.json();

      const holidayPackage = await kv.get(`holiday_package_${packageId}`);

      if (!holidayPackage) {
        return sendError(c, 'Holiday package not found', 404);
      }

      const updated: HolidayPackage = {
        ...holidayPackage,
        ...updates,
        packageId, // Prevent ID change
        updatedAt: new Date().toISOString()
      };

      await kv.set(`holiday_package_${packageId}`, updated);

      console.log(`✅ Holiday package ${packageId} updated`);

      return sendSuccess(c, { package: updated }, 'Package updated successfully');
    } catch (error) {
      console.error('Error updating package:', error);
      return sendError(c, error, 500);
    }
  });

  // Delete (deactivate) holiday package
  app.delete(`${BASE_PATH}/holiday-packages/:packageId`, async (c) => {
    try {
      const packageId = c.req.param('packageId');

      const holidayPackage = await kv.get(`holiday_package_${packageId}`);

      if (!holidayPackage) {
        return sendError(c, 'Holiday package not found', 404);
      }

      // Deactivate instead of deleting
      const updated: HolidayPackage = {
        ...holidayPackage,
        isActive: false,
        updatedAt: new Date().toISOString()
      };

      await kv.set(`holiday_package_${packageId}`, updated);

      console.log(`✅ Holiday package ${packageId} deactivated`);

      return sendSuccess(c, {}, 'Package deactivated successfully');
    } catch (error) {
      console.error('Error deleting package:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // HOLIDAY BOOKING
  // ========================================

  // Book holiday package
  app.post(`${BASE_PATH}/holiday-packages/:packageId/book`, async (c) => {
    try {
      const packageId = c.req.param('packageId');
      const body = await c.req.json();
      const {
        customerId,
        selectedStartDate,
        selectedEndDate,
        travelers,
        groupMembers,
        specialRequests,
        dietaryRequirements,
        medicalConditions
      } = body;

      if (!customerId || !selectedStartDate || !selectedEndDate || !travelers) {
        return sendError(c, 'Required fields missing', 400);
      }

      const holidayPackage = await kv.get(`holiday_package_${packageId}`);

      if (!holidayPackage) {
        return sendError(c, 'Holiday package not found', 404);
      }

      // Calculate pricing
      const basePrice = holidayPackage.pricing.basePrice;
      const petCharges = (travelers.pets?.length || 0) * holidayPackage.pricing.pricePerPet;
      const adultCharges = (travelers.adults || 0) * holidayPackage.pricing.pricePerAdult;
      const childCharges = (travelers.children || 0) * holidayPackage.pricing.pricePerChild;
      const totalAmount = basePrice + petCharges + adultCharges + childCharges;

      const bookingId = `holiday_booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const booking: HolidayBooking = {
        bookingId,
        packageId,
        customerId,
        vendorId: holidayPackage.vendorId,
        selectedStartDate,
        selectedEndDate,
        travelers,
        pricing: {
          basePrice,
          petCharges,
          adultCharges,
          childCharges,
          totalAmount
        },
        status: 'pending',
        paymentStatus: 'pending',
        isGroupTour: holidayPackage.isGroupTour,
        groupMembers,
        specialRequests,
        dietaryRequirements,
        medicalConditions,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`holiday_booking_${bookingId}`, booking);

      // Store in customer's bookings
      const customerBookings = await kv.get(`customer_holiday_bookings_${customerId}`) || [];
      customerBookings.push(bookingId);
      await kv.set(`customer_holiday_bookings_${customerId}`, customerBookings);

      // Store in vendor's bookings
      const vendorBookings = await kv.get(`vendor_holiday_bookings_${holidayPackage.vendorId}`) || [];
      vendorBookings.push(bookingId);
      await kv.set(`vendor_holiday_bookings_${holidayPackage.vendorId}`, vendorBookings);

      // Update package availability
      if (holidayPackage.availableDates && holidayPackage.availableDates.length > 0) {
        const dateIndex = holidayPackage.availableDates.findIndex(
          (d: any) => d.startDate === selectedStartDate && d.endDate === selectedEndDate
        );

        if (dateIndex !== -1) {
          holidayPackage.availableDates[dateIndex].bookedSlots += 1;
          await kv.set(`holiday_package_${packageId}`, holidayPackage);
        }
      }

      console.log(`✅ Holiday booking created: ${bookingId}`);

      return sendSuccess(c, { booking }, 'Booking created successfully');
    } catch (error) {
      console.error('Error creating booking:', error);
      return sendError(c, error, 500);
    }
  });

  // Check package availability
  app.get(`${BASE_PATH}/holiday-packages/:packageId/availability`, async (c) => {
    try {
      const packageId = c.req.param('packageId');
      const startDate = c.req.query('startDate');
      const endDate = c.req.query('endDate');

      const holidayPackage = await kv.get(`holiday_package_${packageId}`);

      if (!holidayPackage) {
        return sendError(c, 'Holiday package not found', 404);
      }

      let availability = { isAvailable: true, availableSlots: 0 };

      if (startDate && endDate && holidayPackage.availableDates) {
        const dateSlot = holidayPackage.availableDates.find(
          (d: any) => d.startDate === startDate && d.endDate === endDate
        );

        if (dateSlot) {
          availability.availableSlots = dateSlot.availableSlots - dateSlot.bookedSlots;
          availability.isAvailable = availability.availableSlots > 0;
        } else {
          availability.isAvailable = false;
        }
      }

      return sendSuccess(c, { availability });
    } catch (error) {
      console.error('Error checking availability:', error);
      return sendError(c, error, 500);
    }
  });

  // Get booking details
  app.get(`${BASE_PATH}/holiday-packages/bookings/:bookingId`, async (c) => {
    try {
      const bookingId = c.req.param('bookingId');

      const booking = await kv.get(`holiday_booking_${bookingId}`);

      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // Also get package details
      const holidayPackage = await kv.get(`holiday_package_${booking.packageId}`);

      return sendSuccess(c, { booking, package: holidayPackage });
    } catch (error) {
      console.error('Error getting booking:', error);
      return sendError(c, error, 500);
    }
  });

  // Update booking status
  app.put(`${BASE_PATH}/holiday-packages/bookings/:bookingId/status`, async (c) => {
    try {
      const bookingId = c.req.param('bookingId');
      const { status, paymentStatus } = await c.req.json();

      const booking = await kv.get(`holiday_booking_${bookingId}`);

      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      const updated: HolidayBooking = {
        ...booking,
        status: status || booking.status,
        paymentStatus: paymentStatus || booking.paymentStatus,
        updatedAt: new Date().toISOString()
      };

      await kv.set(`holiday_booking_${bookingId}`, updated);

      console.log(`✅ Booking ${bookingId} status updated to: ${status}`);

      return sendSuccess(c, { booking: updated }, 'Booking status updated successfully');
    } catch (error) {
      console.error('Error updating booking status:', error);
      return sendError(c, error, 500);
    }
  });

  // Get vendor's holiday packages
  app.get(`${BASE_PATH}/vendor/:vendorId/holiday-packages`, async (c) => {
    try {
      const vendorId = c.req.param('vendorId');

      const packageIds = await kv.get(`vendor_holiday_packages_${vendorId}`) || [];

      const packages = await Promise.all(
        packageIds.map((id: string) => kv.get(`holiday_package_${id}`))
      );

      return sendSuccess(c, { packages: packages.filter(Boolean) });
    } catch (error) {
      console.error('Error getting vendor packages:', error);
      return sendError(c, error, 500);
    }
  });

  // Get vendor's holiday bookings
  app.get(`${BASE_PATH}/vendor/:vendorId/holiday-bookings`, async (c) => {
    try {
      const vendorId = c.req.param('vendorId');

      const bookingIds = await kv.get(`vendor_holiday_bookings_${vendorId}`) || [];

      const bookings = await Promise.all(
        bookingIds.map((id: string) => kv.get(`holiday_booking_${id}`))
      );

      return sendSuccess(c, { bookings: bookings.filter(Boolean) });
    } catch (error) {
      console.error('Error getting vendor bookings:', error);
      return sendError(c, error, 500);
    }
  });

  // Get customer's holiday bookings
  app.get(`${BASE_PATH}/customer/:customerId/holiday-bookings`, async (c) => {
    try {
      const customerId = c.req.param('customerId');

      const bookingIds = await kv.get(`customer_holiday_bookings_${customerId}`) || [];

      const bookings = await Promise.all(
        bookingIds.map((id: string) => kv.get(`holiday_booking_${id}`))
      );

      return sendSuccess(c, { bookings: bookings.filter(Boolean) });
    } catch (error) {
      console.error('Error getting customer bookings:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Holiday Package System endpoints registered');
}
