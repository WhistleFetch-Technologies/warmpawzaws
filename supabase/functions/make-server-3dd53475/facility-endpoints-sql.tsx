import { Hono } from 'npm:hono';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getDbClient } from '../../lib/db.ts';
import { sendSuccess, sendError } from './response-utils.ts';

const app = new Hono();

/**
 * GET /vendor/facility/:vendorId
 * Get facility information for a vendor
 * ✅ MIGRATED TO SQL: Uses vendors table
 */
app.get('/make-server-3dd53475/vendor/facility/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');

    if (!vendorId) {
      return sendError(c, 'Vendor ID is required', 400);
    }

    // ✅ SQL: Get vendor data
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.resolveVendorId(vendorId).then(id => id ? vendorsRepo.findById(id) : null);
    
    if (!vendor) {
      return sendError(c, 'Vendor not found', 404);
    }

    // ✅ FIX: Extract facility data from vendor record (including facility_data JSONB)
    const client = getDbClient();
    const { data: vendorWithFacility } = await client
      .from('vendors')
      .select('facility_data')
      .eq('id', vendor.id)
      .single();
    
    const facilityDataFromJson = (vendorWithFacility as any)?.facility_data || {};
    const facilityData = {
      description: facilityDataFromJson.description || '',
      address: typeof vendor.address === 'string' ? vendor.address : (vendor.address as any)?.full || '',
      operatingHours: vendor.operating_hours || '',
      amenities: (vendor as any).amenities || [],
      customAmenities: facilityDataFromJson.customAmenities || [],
      photos: facilityDataFromJson.photos || [],
      specializations: (vendor as any).specializations || [],
      city: vendor.city || '',
      state: vendor.state || '',
      pincode: vendor.pincode || '',
      location: vendor.latitude && vendor.longitude ? {
        lat: vendor.latitude,
        lng: vendor.longitude
      } : null
    };

    return sendSuccess(c, { facility: facilityData });

  } catch (error) {
    console.error('Error fetching facility data:', error);
    return sendError(c, 'Failed to fetch facility data', 500);
  }
});

/**
 * PUT /vendor/facility/:vendorId
 * Update facility information for a vendor
 * ✅ MIGRATED TO SQL: Updates vendors table directly
 */
app.put('/make-server-3dd53475/vendor/facility/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const body = await c.req.json();

    if (!vendorId) {
      return sendError(c, 'Vendor ID is required', 400);
    }

    const { 
      centerName,      // ✅ NEW: Center name to update business_name
      description, 
      address, 
      operatingHours, 
      amenities, 
      customAmenities, 
      photos,
      specializations,
      location,    // { lat, lng }
      city,
      state,
      pincode
    } = body;

    // Validate data
    if (!address) {
      return sendError(c, 'Address is required', 400);
    }

    // ✅ SQL: Resolve vendor ID and get existing vendor
    const vendorsRepo = getVendorsRepository();
    const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
    
    if (!resolvedVendorId) {
      return sendError(c, 'Vendor not found', 404);
    }

    const existingVendor = await vendorsRepo.findById(resolvedVendorId);
    if (!existingVendor) {
      return sendError(c, 'Vendor not found', 404);
    }

    // ✅ SQL: Prepare update data
    // ✅ FIX: address is JSONB, so we need to handle it properly
    let addressData: any = existingVendor.address || {};
    if (typeof address === 'string') {
      // If address is a string, convert to JSONB format
      addressData = { full: address };
    } else if (address && typeof address === 'object') {
      // If address is already an object, use it
      addressData = address;
    }
    
    const updateData: any = {
      address: addressData,
      city: city || existingVendor.city,
      state: state || existingVendor.state,
      pincode: pincode || existingVendor.pincode,
      operating_hours: operatingHours || existingVendor.operating_hours,
    };

    // ✅ FIX: Update business_name if centerName is provided
    if (centerName) {
      updateData.business_name = centerName;
    }

    // ✅ FIX: Update latitude/longitude if location is provided
    if (location && location.lat && location.lng) {
      updateData.latitude = location.lat;
      updateData.longitude = location.lng;
    }

    // ✅ SQL: Update vendor record
    const updatedVendor = await vendorsRepo.update(resolvedVendorId, updateData);

    // ✅ SQL: Update amenities and specializations (stored as arrays in vendors table)
    const client = getDbClient();
    const additionalUpdates: any = {};
    
    if (amenities !== undefined) {
      additionalUpdates.amenities = amenities;
    }
    if (specializations !== undefined) {
      additionalUpdates.specializations = specializations;
    }
    
    // ✅ FIX: Store description, photos, customAmenities in facility_data JSONB
    if (description !== undefined || photos !== undefined || customAmenities !== undefined) {
      // Get existing facility_data or initialize empty object
      const { data: existingVendorData } = await client
        .from('vendors')
        .select('facility_data')
        .eq('id', resolvedVendorId)
        .single();
      
      const existingFacilityData = (existingVendorData as any)?.facility_data || {};
      
      // Merge new data with existing
      const updatedFacilityData: any = { ...existingFacilityData };
      
      if (description !== undefined) {
        updatedFacilityData.description = description;
      }
      if (photos !== undefined) {
        updatedFacilityData.photos = photos;
      }
      if (customAmenities !== undefined) {
        updatedFacilityData.customAmenities = customAmenities;
      }
      
      additionalUpdates.facility_data = updatedFacilityData;
    }

    // Update arrays and facility_data if provided
    if (Object.keys(additionalUpdates).length > 0) {
      await client
        .from('vendors')
        .update(additionalUpdates)
        .eq('id', resolvedVendorId);
    }

    console.log(`✅ Updated facility data for vendor: ${resolvedVendorId}`);

    return sendSuccess(c, {
      message: 'Facility information updated successfully',
      vendor: updatedVendor
    });

  } catch (error) {
    console.error('Error updating facility data:', error);
    return sendError(c, `Failed to update facility data: ${String(error)}`, 500);
  }
});

/**
 * GET /customer/facility/:vendorId
 * Get facility information for customers (public view)
 * ✅ MIGRATED TO SQL: Uses vendors, services, and reviews tables
 */
app.get('/make-server-3dd53475/customer/facility/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');

    if (!vendorId) {
      return sendError(c, 'Vendor ID is required', 400);
    }

    // ✅ SQL: Get vendor data
    const vendorsRepo = getVendorsRepository();
    const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
    
    if (!resolvedVendorId) {
      return sendError(c, 'Vendor not found', 404);
    }

    const vendor = await vendorsRepo.findById(resolvedVendorId);
    if (!vendor) {
      return sendError(c, 'Vendor not found', 404);
    }

    // ✅ SQL: Get vendor services
    const client = getDbClient();
    const { data: services } = await client
      .from('vendor_services')
      .select('*')
      .eq('vendor_id', resolvedVendorId)
      .eq('is_enabled', true);

    // ✅ SQL: Get reviews
    const { data: reviews } = await client
      .from('reviews')
      .select('*')
      .eq('vendor_id', resolvedVendorId)
      .order('created_at', { ascending: false })
      .limit(20);

    // Calculate average rating
    let avgRating = 0;
    let totalReviews = 0;
    
    if (reviews && reviews.length > 0) {
      const totalRating = reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
      avgRating = totalRating / reviews.length;
      totalReviews = reviews.length;
    }

    // Extract facility data
    const facilityData = {
      description: (vendor as any).description || '',
      address: typeof vendor.address === 'string' ? vendor.address : (vendor.address as any)?.full || '',
      operatingHours: vendor.operating_hours || '',
      amenities: (vendor as any).amenities || [],
      customAmenities: (vendor as any).customAmenities || [],
      photos: (vendor as any).photos || []
    };

    return sendSuccess(c, {
      vendor: {
        vendorId: vendor.id,
        businessName: vendor.business_name,
        ownerName: vendor.owner_name,
        roleId: vendor.role_id,
        phone: vendor.phone,
        email: vendor.email,
        status: vendor.status
      },
      facility: facilityData,
      services: services || [],
      rating: {
        average: Number(avgRating.toFixed(1)),
        total: totalReviews
      },
      recentReviews: reviews?.slice(0, 5) || []
    });

  } catch (error) {
    console.error('Error fetching facility data for customer:', error);
    return sendError(c, 'Failed to fetch facility data', 500);
  }
});

export default app;

