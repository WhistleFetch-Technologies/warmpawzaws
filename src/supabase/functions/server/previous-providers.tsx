import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

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

export function previousProvidersEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

  // ========================================
  // GET PREVIOUS PROVIDERS
  // ========================================
  app.get(`${BASE_PATH}/home-services/providers/previous/:customerId`, async (c) => {
    try {
      const customerId = c.req.param('customerId');

      // Get all service history for customer
      const historyData = await kv.getByPrefix(`service_history_${customerId}_`);
      
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

        // Check if favorited
        const favoriteKey = `favorite_provider_${customerId}_${providerId}`;
        const isFavorite = await kv.get(favoriteKey);

        providers.push({
          providerId: data.providerId,
          providerName: data.providerName,
          serviceType: data.serviceType,
          lastServiceDate: data.lastServiceDate,
          totalServices: data.totalServices,
          rating: Math.round(avgRating * 10) / 10,
          isFavorite: !!isFavorite,
        });
      }

      // Sort by last service date (most recent first)
      providers.sort((a, b) => 
        new Date(b.lastServiceDate).getTime() - new Date(a.lastServiceDate).getTime()
      );

      console.log(`✅ Retrieved ${providers.length} previous providers for customer ${customerId}`);

      return sendSuccess(c, { providers });
    } catch (error) {
      console.error('Error getting previous providers:', error);
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

      const favoriteKey = `favorite_provider_${customerId}_${providerId}`;
      
      await kv.set(favoriteKey, {
        customerId,
        providerId,
        favoritedAt: new Date().toISOString(),
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

      const favoriteKey = `favorite_provider_${customerId}_${providerId}`;
      await kv.del(favoriteKey);

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

      const historyData = await kv.getByPrefix(`service_history_${customerId}_`);
      
      const history = historyData
        .map((item: any) => item.value || item)
        .sort((a: any, b: any) => 
          new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime()
        )
        .slice(0, limit);

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

      await kv.set(`service_history_${customerId}_${historyId}`, history);

      console.log(`✅ Service recorded for customer ${customerId} with provider ${providerId}`);

      return sendSuccess(c, { history }, 'Service history recorded');
    } catch (error) {
      console.error('Error recording service:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Previous Providers endpoints registered');
}
