/**
 * UNIVERSAL PROBLEM DISCOVERY - ALL VENDOR TYPES - SQL-ONLY VERSION
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * Single endpoint that works for ALL vendors dynamically
 * 
 * Date: 2025-01-27
 * Migration: KV to SQL (2 KV operations → 0)
 * Endpoints: 1
 */

import { Hono } from 'npm:hono';
import { getDbClient } from '../../lib/db.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getStaffRepository } from '../../lib/repositories/staff.ts';
import { getServicesRepository } from '../../lib/repositories/services.ts';
import { getSchedulingRepository } from '../../lib/repositories/scheduling.ts';

const app = new Hono();

/**
 * GET /make-server-3dd53475/customer/problem-discovery
 * 
 * Universal problem discovery endpoint for ALL vendor types
 * Works with: veterinarian, groomer, trainer, walker, behaviourist, boarding_center
 */
app.get('/make-server-3dd53475/customer/problem-discovery', async (c) => {
  try {
    const problemGridId = c.req.query('problemGridId');
    const roleId = c.req.query('roleId'); // DYNAMIC - passed from client
    const feeMin = parseInt(c.req.query('feeMin') || '0');
    const feeMax = parseInt(c.req.query('feeMax') || '999999');
    const sortBy = c.req.query('sortBy') || 'rating';
    
    // Customer location for distance
    const customerLat = parseFloat(c.req.query('lat') || '0');
    const customerLon = parseFloat(c.req.query('lon') || '0');
    
    console.log('\n🔍 ===== UNIVERSAL PROBLEM DISCOVERY =====');
    console.log(`📋 Problem Grid: ${problemGridId}`);
    console.log(`🏷️  Role: ${roleId}`);
    console.log(`📍 Customer Location: ${customerLat}, ${customerLon}`);
    
    if (!problemGridId) {
      return c.json({
        success: false,
        error: 'Missing required parameter: problemGridId'
      }, 400);
    }
    
    if (!roleId) {
      return c.json({
        success: false,
        error: 'Missing required parameter: roleId'
      }, 400);
    }
    
    // STEP 1: Get problem grid configuration from static catalog
    // ✅ SQL: Get problem grid from platform_settings
    const db = getDbClient();
    const { data: problemGridData } = await db
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', `problem_grid:${problemGridId}`)
      .single();
    
    const problemGrid = problemGridData?.setting_value as any;
    
    if (!problemGrid) {
      console.log('❌ Problem grid not found in catalog');
      return c.json({
        success: false,
        error: 'Problem grid not found'
      }, 404);
    }
    
    console.log(`✅ Problem Grid: "${problemGrid.displayName}"`);
    console.log(`   Mapped SubCategories: [${problemGrid.mappedSubCategories?.join(', ') || 'none'}]`);
    
    const requiredSubCategories = problemGrid.mappedSubCategories || [];
    
    if (requiredSubCategories.length === 0) {
      console.log('⚠️  No subcategories mapped for this problem grid');
      return c.json({
        success: true,
        specialists: [],
        totalCount: 0,
        message: 'No specialists available for this problem'
      });
    }
    
    // STEP 2: Get all vendors (UNIVERSAL LOGIC)
    // ✅ SQL: Get all approved vendors
    const allVendors = await getVendorsRepository().findAll({ status: 'approved' });
    console.log(`📊 Total vendors: ${allVendors.length}`);

    // Filter approved vendors for the specific role
    let vendors = allVendors.filter((v: any) => {
      const isApproved = v.status === 'approved';
      const isActive = v.is_active !== false;
      
      // Dynamic role matching
      let roleMatches = false;
      const vendorRole = v.role_id || v.role || '';
      
      // Normalize role IDs for comparison
      const normalizedVendorRole = vendorRole.toLowerCase().replace('role_', '');
      const normalizedSearchRole = roleId.toLowerCase().replace('role_', '');
      
      if (normalizedVendorRole === normalizedSearchRole) {
        roleMatches = true;
      }
      
      // Alternative role names matching
      const roleAliases: Record<string, string[]> = {
        'veterinarian': ['vet', 'veterinary', 'doctor'],
        'groomer': ['grooming', 'pet_groomer'],
        'trainer': ['training', 'dog_trainer'],
        'walker': ['dog_walker', 'pet_walker'],
        'behaviourist': ['behaviorist', 'behavior'],
        'boarding_center': ['boarding', 'pet_boarding']
      };
      
      const aliases = roleAliases[normalizedSearchRole] || [];
      if (aliases.some(alias => normalizedVendorRole.includes(alias))) {
        roleMatches = true;
      }
      
      return isApproved && isActive && roleMatches;
    });
    
    console.log(`✅ Filtered to ${vendors.length} vendors for role: ${roleId}`);
    
    // STEP 3: Match vendors by subcategories
    const matchingSpecialists: any[] = [];
    
    for (const vendor of vendors) {
      // ✅ SQL: Get vendor services
      const services = await getServicesRepository().findByVendor(vendor.id);
      
      // Check if vendor has services matching required subcategories
      const matchingServices = services.filter((service: any) => {
        const serviceCategory = (service.category || '').toLowerCase();
        return requiredSubCategories.some((subCat: string) => 
          serviceCategory.includes(subCat.toLowerCase())
        );
      });
      
      if (matchingServices.length > 0) {
        // ✅ SQL: Get staff for this vendor
        const staffMembers = await getStaffRepository().findByVendorId(vendor.id);
        
        matchingSpecialists.push({
          vendorId: vendor.id,
          vendorName: vendor.business_name,
          role: roleId,
          services: matchingServices.map((s: any) => ({
            id: s.id,
            name: s.name,
            category: s.category,
            price: s.price
          })),
          staff: staffMembers.map((staff: any) => ({
            id: staff.id,
            name: staff.fullName,
            specialization: staff.specialization
          })),
          location: {
            latitude: vendor.latitude,
            longitude: vendor.longitude,
            address: vendor.address,
            city: vendor.city
          },
          rating: vendor.average_rating || 0,
          reviewCount: vendor.total_reviews || 0,
          distance: customerLat && customerLon && vendor.latitude && vendor.longitude
            ? calculateDistance(customerLat, customerLon, vendor.latitude, vendor.longitude)
            : null
        });
      }
    }
    
    // Filter by fee range
    let filteredSpecialists = matchingSpecialists.filter((specialist: any) => {
      const minPrice = Math.min(...specialist.services.map((s: any) => s.price || 0));
      return minPrice >= feeMin && minPrice <= feeMax;
    });
    
    // Filter by distance if location provided
    if (customerLat && customerLon) {
      const maxDistance = parseFloat(c.req.query('maxDistance') || '50');
      filteredSpecialists = filteredSpecialists.filter((s: any) => 
        s.distance !== null && s.distance <= maxDistance
      );
    }
    
    // Sort results
    if (sortBy === 'rating') {
      filteredSpecialists.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === 'distance') {
      filteredSpecialists.sort((a, b) => (a.distance || 999) - (b.distance || 999));
    } else if (sortBy === 'price') {
      filteredSpecialists.sort((a, b) => {
        const aPrice = Math.min(...a.services.map((s: any) => s.price || 0));
        const bPrice = Math.min(...b.services.map((s: any) => s.price || 0));
        return aPrice - bPrice;
      });
    }
    
    console.log(`✅ Found ${filteredSpecialists.length} matching specialists`);
    
    return c.json({
      success: true,
      specialists: filteredSpecialists,
      totalCount: filteredSpecialists.length,
      problemGrid: {
        id: problemGridId,
        displayName: problemGrid.displayName
      },
      filters: {
        roleId,
        feeRange: { min: feeMin, max: feeMax },
        sortBy,
        location: customerLat && customerLon ? { lat: customerLat, lon: customerLon } : null
      }
    });
    
  } catch (error) {
    console.error('❌ [PROBLEM-DISCOVERY] Error:', error);
    return c.json({
      success: false,
      error: 'Failed to discover specialists',
      details: String(error)
    }, 500);
  }
});

// Helper: Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

console.log('✅ Universal problem discovery endpoints registered (SQL-only)');

export default app;

