/**
 * ============================================================================
 * ADVANCED SEARCH ENGINE - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Fuzzy search implementation using Fuse.js for:
 * - Vendor search (typo-tolerant, fuzzy matching)
 * - Product search (e-commerce)
 * - Staff search (doctors, trainers, etc.)
 * - Universal search (searches everything)
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.getByPrefix()` with SQL queries
 * - Uses `VendorsRepository`, `StaffRepository`, `ProductsRepository`
 * - Uses `vendors`, `staff`, `products`, `services` tables
 * 
 * Date: 2025-01-28
 * Migration: Batch 16 - KV to SQL (11 KV operations removed)
 * ============================================================================
 */

import Fuse from 'npm:fuse.js@7.0.0';
import { Hono } from 'npm:hono';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getStaffRepository } from '../../lib/repositories/staff.ts';
import { getProductsRepository } from '../../lib/repositories/products.ts';
import { getServicesRepository } from '../../lib/repositories/services.ts';
import { getDbClient } from '../../lib/db.ts';

const BASE_PATH = '/make-server-3dd53475';
const app = new Hono();
const db = getDbClient();
const vendorsRepo = getVendorsRepository();
const staffRepo = getStaffRepository();
const productsRepo = getProductsRepository();
const servicesRepo = getServicesRepository();

// ============================================
// SEARCH CONFIGURATION
// ============================================

const vendorSearchConfig = {
  keys: [
    { name: 'businessName', weight: 0.4 },
    { name: 'description', weight: 0.2 },
    { name: 'services', weight: 0.2 },
    { name: 'specializations', weight: 0.1 },
    { name: 'city', weight: 0.05 },
    { name: 'tags', weight: 0.05 }
  ],
  threshold: 0.4,
  distance: 100,
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 2,
  ignoreLocation: true
};

const productSearchConfig = {
  keys: [
    { name: 'name', weight: 0.5 },
    { name: 'description', weight: 0.2 },
    { name: 'category', weight: 0.15 },
    { name: 'brand', weight: 0.1 },
    { name: 'tags', weight: 0.05 }
  ],
  threshold: 0.35,
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 2
};

const staffSearchConfig = {
  keys: [
    { name: 'fullName', weight: 0.4 },
    { name: 'specializations', weight: 0.3 },
    { name: 'degree', weight: 0.2 },
    { name: 'vendorBusinessName', weight: 0.1 }
  ],
  threshold: 0.4,
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 2
};

// ============================================
// HELPER: Calculate Distance
// ============================================

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// ============================================
// UNIVERSAL SEARCH
// ============================================

/**
 * Universal search - searches vendors, products, staff, services
 * POST /advanced-search/universal
 */
app.post(`${BASE_PATH}/advanced-search/universal`, async (c) => {
  try {
    const { query = '', type, location, radius = 10, limit = 50 } = await c.req.json();

    if (!query || query.trim().length < 2) {
      return c.json({ success: false, error: 'Query must be at least 2 characters' }, 400);
    }

    console.log(`🔍 [UNIVERSAL-SEARCH] Searching for: "${query}" (type: ${type || 'all'})`);

    const results: any[] = [];
    const searchVendors = !type || type === 'vendor' || type === 'all';
    const searchStaff = !type || type === 'staff' || type === 'all';
    const searchProducts = !type || type === 'product' || type === 'all';

    // 1. ✅ SQL: Search Vendors
    if (searchVendors) {
      const { data: vendors } = await db
        .from('vendors')
        .select('*')
        .eq('is_active', true)
        .eq('status', 'approved');

      const vendorData = (vendors || []).map((v: any) => ({
        id: v.id,
        vendorId: v.id,
        businessName: v.business_name,
        description: v.description || '',
        services: v.metadata?.services || [],
        specializations: v.specializations || [],
        city: v.address?.city || '',
        tags: v.metadata?.tags || [],
        location: {
          lat: v.latitude,
          lng: v.longitude
        },
        rating: v.rating || 0
      }));

      const fuse = new Fuse(vendorData, vendorSearchConfig);
      const matches = fuse.search(query);
      results.push(...matches.map((m: any) => ({ ...m.item, _score: m.score, _type: 'vendor' })));
    }

    // 2. ✅ SQL: Search Staff
    if (searchStaff) {
      const { data: staff } = await db
        .from('staff')
        .select('*, vendors!inner(*)')
        .eq('is_active', true);

      const staffData = (staff || []).map((s: any) => ({
        id: s.id,
        staffId: s.id,
        fullName: s.name || s.full_name,
        specializations: s.specializations || [],
        degree: s.qualifications?.join(', ') || '',
        vendorBusinessName: s.vendors?.business_name || '',
        rating: s.rating || 0
      }));

      const fuse = new Fuse(staffData, staffSearchConfig);
      const matches = fuse.search(query);
      results.push(...matches.map((m: any) => ({ ...m.item, _score: m.score, _type: 'staff' })));
    }

    // 3. ✅ SQL: Search Products
    if (searchProducts) {
      const { data: products } = await db
        .from('products')
        .select('*')
        .eq('is_active', true)
        .eq('status', 'active');

      const productData = (products || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        category: p.category || '',
        brand: p.brand || '',
        tags: p.metadata?.tags || [],
        price: p.price,
        rating: p.rating || 0
      }));

      const fuse = new Fuse(productData, productSearchConfig);
      const matches = fuse.search(query);
      results.push(...matches.map((m: any) => ({ ...m.item, _score: m.score, _type: 'product' })));
    }

    // Location-based filtering
    if (location && location.lat && location.lng) {
      results.forEach((item: any) => {
        if (item.location && item.location.lat && item.location.lng) {
          item.distance = calculateDistance(
            location.lat,
            location.lng,
            item.location.lat,
            item.location.lng
          );
        }
      });

      // Filter by radius
      const inRadius = results.filter((item: any) => !item.distance || item.distance <= radius);
      results.splice(0, results.length, ...inRadius);
    }

    // Sort by score
    results.sort((a: any, b: any) => (a._score || 1) - (b._score || 1));

    const paginated = results.slice(0, parseInt(limit as string));

    return c.json({
      success: true,
      results: paginated,
      total: results.length
    });
  } catch (error) {
    console.error('❌ Universal search error:', error);
    return c.json({ success: false, error: 'Search failed' }, 500);
  }
});

/**
 * Advanced vendor search with fuzzy matching and filters
 * POST /advanced-search/vendors
 */
app.post(`${BASE_PATH}/advanced-search/vendors`, async (c) => {
  try {
    const {
      query = '',
      location,
      radius = 10,
      serviceType,
      serviceStyle,
      minRating = 0,
      priceRange,
      sortBy = 'relevance',
      limit = 50
    } = await c.req.json();

    // ✅ SQL: Get all approved vendors
    let queryBuilder = db
      .from('vendors')
      .select('*')
      .eq('is_active', true)
      .eq('status', 'approved');

    const { data: vendorsData } = await queryBuilder;
    let vendors = (vendorsData || []).map((v: any) => ({
      id: v.id,
      businessName: v.business_name,
      description: v.description || '',
      services: v.metadata?.services || [],
      specializations: v.specializations || [],
      serviceStyle: v.metadata?.serviceStyle || 'both',
      rating: v.rating || 0,
      priceRange: v.price_range,
      location: {
        lat: v.latitude,
        lng: v.longitude
      },
      city: v.address?.city || ''
    }));

    // Apply filters
    if (serviceType) {
      vendors = vendors.filter((v: any) => v.services && v.services.includes(serviceType));
    }

    if (serviceStyle) {
      vendors = vendors.filter((v: any) => v.serviceStyle === serviceStyle || v.serviceStyle === 'both');
    }

    if (minRating > 0) {
      vendors = vendors.filter((v: any) => v.rating >= minRating);
    }

    if (priceRange) {
      vendors = vendors.filter((v: any) => v.priceRange === priceRange);
    }

    // Location-based filtering
    if (location && location.lat && location.lng) {
      vendors = vendors.map((v: any) => {
        if (v.location && v.location.lat && v.location.lng) {
          v.distance = calculateDistance(
            location.lat,
            location.lng,
            v.location.lat,
            v.location.lng
          );
        }
        return v;
      }).filter((v: any) => !v.distance || v.distance <= radius);
    }

    let results = vendors;

    // Fuzzy search if query provided
    if (query && query.trim().length >= 2) {
      const fuse = new Fuse(vendors, vendorSearchConfig);
      const searchResults = fuse.search(query);
      results = searchResults.map((r: any) => ({
        ...r.item,
        searchScore: r.score,
        matches: r.matches
      }));
    }

    // Sorting
    switch (sortBy) {
      case 'rating':
        results.sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'distance':
        if (location) {
          results.sort((a: any, b: any) => (a.distance || Infinity) - (b.distance || Infinity));
        }
        break;
      case 'relevance':
      default:
        results.sort((a: any, b: any) => (a.searchScore || 1) - (b.searchScore || 1));
        break;
    }

    const paginated = results.slice(0, parseInt(limit as string));

    return c.json({
      success: true,
      results: paginated,
      total: results.length
    });
  } catch (error) {
    console.error('❌ Vendor search error:', error);
    return c.json({ success: false, error: 'Search failed' }, 500);
  }
});

console.log('✅ Advanced Search Engine (SQL-only) registered');

export default app;

