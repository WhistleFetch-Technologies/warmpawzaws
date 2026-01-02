import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";

/**
 * 👥 PREVIOUS PROVIDERS SYSTEM
 * 
 * Phase 7C: Home Services Enhancement - Rule 2 Implementation
 * 
 * Features:
 * - Track customer's previous service providers
 * - Favorite providers management
 * - Service history tracking
 * - Quick rebooking from history
 */

interface PreviousProvider {
  providerId: string;
  providerName: string;
  serviceType: string;
  lastServiceDate: string;
  totalServices: number;
  rating: number;
  isFavorite: boolean;
  location?: { lat: number; lng: number };
  distance?: number;
  photo?: string;
}

interface ServiceHistory {
  historyId: string;
  customerId: string;
  providerId: string;
  providerName: string;
  serviceType: string;
  serviceDate: string;
  rating?: number;
  feedback?: string;
}

export function previousProvidersEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";

  // ========================================
  // GET PREVIOUS PROVIDERS
  // ========================================
  app.get(`${BASE_PATH}/home-services/providers/previous/:customerId`, async (c) => {
    try {
      const customerId = c.req.param('customerId');

      // ✅ SQL: Get all service history for customer
      const db = getDbClient();
      const { data: historyData } = await db
        .from('service_history')
        .select('*')
        .eq('customer_id', customerId);
      
      if (!historyData || historyData.length === 0) {
        return sendSuccess(c, { providers: [] });
      }

      // Group by provider and calculate stats
      const providerMap = new Map<string, any>();

      for (const item of historyData) {
        const history = item.value || item;
        
        if (!providerMap.has(history.providerId)) {
          providerMap.set(history.providerId, {
            providerId: history.providerId,
            providerName: history.providerName,
            serviceType: history.serviceType,
            lastServiceDate: history.serviceDate,
            totalServices: 0,
            rating: 0,
            isFavorite: false,
            ratings: [],
          });
        }

        const provider = providerMap.get(history.providerId);
        provider.totalServices += 1;
        
        if (history.rating) {
          provider.ratings.push(history.rating);
        }

        // Update last service date if more recent
        if (new Date(history.serviceDate) > new Date(provider.lastServiceDate)) {
          provider.lastServiceDate = history.serviceDate;
        }
      }

      // Calculate average ratings and check favorites
      const providers: PreviousProvider[] = [];
      
      for (const [providerId, data] of providerMap.entries()) {
        const avgRating = data.ratings.length > 0
          ? data.ratings.reduce((sum: number, r: number) => sum + r, 0) / data.ratings.length
          : 0;

        // ✅ SQL: Check if favorited
        const { data: favorite } = await db
          .from('favorite_providers')
          .select('*')
          .eq('customer_id', customerId)
          .eq('provider_id', providerId)
          .single();
        const isFavorite = !!favorite;

        // ✅ SQL: Get provider details for location
        const vendorsRepo = getVendorsRepository();
        const vendor = await vendorsRepo.findById(providerId);

        providers.push({
          providerId: data.providerId,
          providerName: data.providerName,
          serviceType: data.serviceType,
          lastServiceDate: data.lastServiceDate,
          totalServices: data.totalServices,
          rating: avgRating,
          isFavorite: !!isFavorite,
          location: vendor?.location || null,
          distance: 0, // Will be calculated on client side based on current location
          photo: vendor?.photo || null,
        });
      }

      // Sort by last service date (most recent first)
      providers.sort((a, b) => 
        new Date(b.lastServiceDate).getTime() - new Date(a.lastServiceDate).getTime()
      );

      return sendSuccess(c, { providers, total: providers.length });

    } catch (error) {
      console.error('❌ Error fetching previous providers:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // GET CUSTOMER PREVIOUS PROVIDERS (Alternative endpoint)
  // ========================================
  app.get(`${BASE_PATH}/customer/:customerId/previous-providers`, async (c) => {
    try {
      const { customerId } = c.req.param();
      const serviceType = c.req.query('serviceType');

      console.log(`👥 Fetching previous providers for customer: ${customerId}`);

      // ✅ SQL: Get customer's completed bookings
      const bookingsRepo = getBookingsRepository();
      const bookings = await bookingsRepo.findByCustomer(customerId);

      if (bookings.length === 0) {
        return sendSuccess(c, { providers: [], total: 0 });
      }

      const providerMap = new Map<string, any>();

      // Process each booking
      for (const booking of bookings) {
        if (!booking || booking.status !== 'completed') continue;
        if (serviceType && booking.service_type !== serviceType) continue;

        const providerId = booking.vendor_id || booking.vendorId;
        
        if (!providerMap.has(providerId)) {
          // ✅ SQL: Get vendor details
          const vendorsRepo = getVendorsRepository();
          const vendor = await vendorsRepo.findById(providerId);
          
          providerMap.set(providerId, {
            providerId,
            providerName: vendor?.businessName || vendor?.name || 'Unknown Provider',
            serviceType: booking.serviceType,
            lastServiceDate: booking.scheduledDate,
            totalServices: 0,
            rating: 0,
            isFavorite: false,
            ratings: [],
            photo: vendor?.photo || null,
            location: vendor?.location || null,
          });
        }

        const provider = providerMap.get(providerId);
        provider.totalServices += 1;

        // Update last service date if more recent
        if (new Date(booking.scheduledDate) > new Date(provider.lastServiceDate)) {
          provider.lastServiceDate = booking.scheduledDate;
        }

        // ✅ SQL: Get rating if exists
        const reviewsRepo = getReviewsRepository();
        const review = await reviewsRepo.findByBooking(booking.id);
        if (review && review.rating) {
          provider.ratings.push(review.rating);
        }
      }

      // Calculate average ratings and finalize
      const providers: PreviousProvider[] = [];
      
      for (const [providerId, data] of providerMap.entries()) {
        const avgRating = data.ratings.length > 0
          ? data.ratings.reduce((sum: number, r: number) => sum + r, 0) / data.ratings.length
          : 0;

        // ✅ SQL: Check if favorited
        const { data: favorite } = await db
          .from('favorite_providers')
          .select('*')
          .eq('customer_id', customerId)
          .eq('provider_id', providerId)
          .single();
        const isFavorite = !!favorite;

        providers.push({
          providerId: data.providerId,
          providerName: data.providerName,
          serviceType: data.serviceType,
          lastServiceDate: data.lastServiceDate,
          totalServices: data.totalServices,
          rating: avgRating,
          isFavorite: !!isFavorite,
          location: data.location,
          distance: 0,
        });
      }

      // Sort by total services and last service date
      providers.sort((a, b) => {
        if (b.totalServices !== a.totalServices) {
          return b.totalServices - a.totalServices;
        }
        return new Date(b.lastServiceDate).getTime() - new Date(a.lastServiceDate).getTime();
      });

      console.log(`✅ Found ${providers.length} previous providers`);

      return sendSuccess(c, { providers, total: providers.length });

    } catch (error) {
      console.error('❌ Error fetching previous providers:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // ADD/REMOVE FAVORITE PROVIDER
  // ========================================
  app.post(`${BASE_PATH}/home-services/providers/favorite`, async (c) => {
    try {
      const { customerId, providerId } = await c.req.json();

      if (!customerId || !providerId) {
        return sendError(c, 'customerId and providerId are required', 400);
      }

      // ✅ SQL: Add favorite provider
      const db = getDbClient();
      await db.from('favorite_providers').upsert({
        customer_id: customerId,
        provider_id: providerId,
        favorited_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      console.log(`✅ Provider ${providerId} added to favorites for customer ${customerId}`);

      return sendSuccess(c, {}, 'Provider added to favorites');
    } catch (error) {
      console.error('Error adding favorite:', error);
      return sendError(c, error, 500);
    }
  });

  app.delete(`${BASE_PATH}/home-services/providers/favorite/:customerId/:providerId`, async (c) => {
    try {
      const customerId = c.req.param('customerId');
      const providerId = c.req.param('providerId');

      // ✅ SQL: Remove favorite provider
      const db = getDbClient();
      await db
        .from('favorite_providers')
        .delete()
        .eq('customer_id', customerId)
        .eq('provider_id', providerId);

      console.log(`✅ Provider ${providerId} removed from favorites for customer ${customerId}`);

      return sendSuccess(c, {}, 'Provider removed from favorites');
    } catch (error) {
      console.error('Error removing favorite:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // GET SERVICE HISTORY
  // ========================================
  app.get(`${BASE_PATH}/home-services/providers/history/:customerId`, async (c) => {
    try {
      const customerId = c.req.param('customerId');
      const limit = parseInt(c.req.query('limit') || '50');

      // ✅ SQL: Get service history
      const db = getDbClient();
      const { data: historyData } = await db
        .from('service_history')
        .select('*')
        .eq('customer_id', customerId)
        .order('service_date', { ascending: false })
        .limit(limit);
      
      const history = historyData || [];

      return sendSuccess(c, { history, count: history.length });
    } catch (error) {
      console.error('Error getting service history:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // RECORD SERVICE COMPLETION (Internal use)
  // ========================================
  app.post(`${BASE_PATH}/home-services/providers/record-service`, async (c) => {
    try {
      const {
        customerId,
        providerId,
        providerName,
        serviceType,
        serviceDate,
        rating,
        feedback,
      } = await c.req.json();

      if (!customerId || !providerId || !serviceType) {
        return sendError(c, 'Required fields missing', 400);
      }

      const historyId = `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const history: ServiceHistory = {
        historyId,
        customerId,
        providerId,
        providerName,
        serviceType,
        serviceDate: serviceDate || new Date().toISOString(),
        rating,
        feedback,
      };

      // ✅ SQL: Store service history
      const db = getDbClient();
      await db.from('service_history').insert({
        id: historyId,
        customer_id: customerId,
        provider_id: providerId,
        provider_name: providerName,
        service_type: serviceType,
        service_date: serviceDate || new Date().toISOString(),
        rating: rating || null,
        feedback: feedback || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      console.log(`✅ Service recorded for customer ${customerId} with provider ${providerId}`);

      return sendSuccess(c, { history }, 'Service history recorded');
    } catch (error) {
      console.error('Error recording service:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Previous Providers endpoints registered');
}