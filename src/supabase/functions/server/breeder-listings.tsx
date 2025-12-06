import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * Breeder & Adoption Listing Management
 * Handles rich metadata for pets (lineage, KCI, health)
 */
export function registerBreederListings(app: Hono) {

  /**
   * POST /make-server-3dd53475/breeder/listings
   * Create a new pet listing
   */
  app.post("/make-server-3dd53475/breeder/listings", async (c) => {
    try {
      const body = await c.req.json();
      const { 
        vendorId, 
        name, 
        breed, 
        dob, 
        gender, 
        price, 
        color,
        kciRegistered,
        kciNumber,
        sireName,
        damName,
        vaccinationStatus,
        description,
        images,
        videos
      } = body;

      if (!vendorId || !name || !breed || !price) {
        return sendError(c, 'Missing required fields: vendorId, name, breed, price', 400);
      }

      const listingId = `pet_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const listing = {
        id: listingId,
        vendorId,
        type: 'sale', // or adoption
        category: 'dog', // default to dog for now
        name,
        breed,
        dob, // ISO Date
        gender: gender || 'unknown',
        price: Number(price),
        color: color || '',
        
        // Rich Metadata
        kciRegistered: !!kciRegistered,
        kciNumber: kciNumber || null,
        lineage: {
            sire: sireName || null,
            dam: damName || null
        },
        health: {
            vaccinationStatus: vaccinationStatus || 'unknown', // fully_vaccinated, partial, none
            dewormed: true // default assumption or add field
        },
        
        description: description || '',
        images: images || [],
        videos: videos || [],
        
        status: 'available', // available, reserved, sold
        createdAt: new Date().toISOString()
      };

      // Save Listing
      await kv.set(`listing:pet:${listingId}`, listing);
      
      // Index by Vendor
      const vendorListingsKey = `vendor:${vendorId}:listings`;
      const vendorListings = await kv.get(vendorListingsKey) || [];
      vendorListings.push(listingId);
      await kv.set(vendorListingsKey, vendorListings);

      return sendSuccess(c, { listing });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/breeder/listings
   * Search/Filter listings
   */
  app.get("/make-server-3dd53475/breeder/listings", async (c) => {
    try {
      const breed = c.req.query('breed');
      const vendorId = c.req.query('vendorId');
      const maxPrice = Number(c.req.query('maxPrice'));
      
      // In a real DB this would be a SQL query. 
      // In KV, we scan 'listing:pet:*' (slow at scale, acceptable for MVP/Test)
      // Optimization: Use vendor index if vendorId is present
      
      let allListings = [];

      if (vendorId) {
          const ids = await kv.get(`vendor:${vendorId}:listings`) || [];
          for (const id of ids) {
              const l = await kv.get(`listing:pet:${id}`);
              if (l) allListings.push(l);
          }
      } else {
          // Scan all (Mock scan implementation via getByPrefix)
          allListings = await kv.getByPrefix('listing:pet:');
      }

      // Apply Filters
      let filtered = allListings.filter((l: any) => l.status === 'available');

      if (breed) {
          filtered = filtered.filter((l: any) => l.breed?.toLowerCase().includes(breed.toLowerCase()));
      }
      if (maxPrice) {
          filtered = filtered.filter((l: any) => l.price <= maxPrice);
      }

      return sendSuccess(c, { listings: filtered });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/breeder/listings/:id
   */
  app.get("/make-server-3dd53475/breeder/listings/:id", async (c) => {
    try {
      const { id } = c.req.param();
      const listing = await kv.get(`listing:pet:${id}`);
      
      if (!listing) return sendError(c, 'Listing not found', 404);
      
      return sendSuccess(c, { listing });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });
}
