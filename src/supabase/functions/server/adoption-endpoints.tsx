/**
 * Adoption Management Endpoints
 * Handles pet adoption listings, applications, and process management
 * 
 * ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
 */

import { Hono } from 'hono';
import { getAdoptionRepository } from '../../../supabase/lib/repositories/adoption';
import { getDbClient } from '../../../supabase/lib/db';

const app = new Hono();

// Adoption Listing structure
interface AdoptionListing {
  id: string;
  vendorId: string;
  petName: string;
  petType: 'dog' | 'cat' | 'bird' | 'rabbit' | 'other';
  breed: string;
  age: string;
  gender: 'male' | 'female';
  size: 'small' | 'medium' | 'large';
  color: string;
  description: string;
  images: string[];
  medicalHistory: string;
  vaccinations: {
    name: string;
    date: string;
    nextDue?: string;
  }[];
  spayedNeutered: boolean;
  temperament: string[];
  goodWith: {
    children: boolean;
    dogs: boolean;
    cats: boolean;
  };
  specialNeeds?: string;
  adoptionFee: number;
  status: 'available' | 'pending' | 'adopted' | 'unavailable';
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

// Adoption Application structure
interface AdoptionApplication {
  id: string;
  listingId: string;
  vendorId: string;
  petName: string;
  applicantId: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  householdInfo: {
    type: 'house' | 'apartment' | 'condo' | 'other';
    owned: boolean;
    landlordPermission?: boolean;
    hasYard: boolean;
    fenced: boolean;
  };
  experienceInfo: {
    hadPetsBefore: boolean;
    currentPets: {
      type: string;
      name: string;
      age: string;
    }[];
    veterinarian?: {
      name: string;
      phone: string;
    };
  };
  motivation: string;
  preparedness: string;
  references: {
    name: string;
    relationship: string;
    phone: string;
  }[];
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'withdrawn';
  notes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  submittedAt: string;
  updatedAt: string;
}

/**
 * GET /vendor/adoption/:vendorId/listings
 * Get all adoption listings for a vendor
 */
app.get('/:vendorId/listings', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const { status } = c.req.query();
    
    // ✅ SQL: Get vendor listings
    const adoptionRepo = getAdoptionRepository();
    let allListings = await adoptionRepo.getAllListings();
    let listings = allListings.filter((l: any) => l.vendorId === vendorId || l.vendor_id === vendorId);
    
    // Filter by status if specified
    if (status) {
      listings = listings.filter(l => l.status === status);
    }
    
    // Sort by featured first, then by date
    listings.sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    return c.json({
      success: true,
      listings,
      total: listings.length,
      available: listings.filter(l => l.status === 'available').length
    });
  } catch (error) {
    console.error('Error fetching adoption listings:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch adoption listings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /vendor/adoption/:vendorId/listings/:listingId
 * Get a specific adoption listing
 */
app.get('/:vendorId/listings/:listingId', async (c) => {
  try {
    const { vendorId, listingId } = c.req.param();
    
    // ✅ SQL: Get listing
    const adoptionRepo = getAdoptionRepository();
    const listing = await adoptionRepo.getListingById(listingId);
    
    if (!listing) {
      return c.json({ 
        success: false, 
        error: 'Listing not found' 
      }, 404);
    }
    
    return c.json({
      success: true,
      listing
    });
  } catch (error) {
    console.error('Error fetching adoption listing:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch adoption listing',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /vendor/adoption/:vendorId/listings
 * Create a new adoption listing
 */
app.post('/:vendorId/listings', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const body = await c.req.json();
    
    const listingId = `listing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const listing: AdoptionListing = {
      id: listingId,
      vendorId,
      petName: body.petName,
      petType: body.petType,
      breed: body.breed,
      age: body.age,
      gender: body.gender,
      size: body.size,
      color: body.color,
      description: body.description,
      images: body.images || [],
      medicalHistory: body.medicalHistory || '',
      vaccinations: body.vaccinations || [],
      spayedNeutered: body.spayedNeutered || false,
      temperament: body.temperament || [],
      goodWith: body.goodWith || { children: false, dogs: false, cats: false },
      specialNeeds: body.specialNeeds,
      adoptionFee: body.adoptionFee || 0,
      status: 'available',
      featured: body.featured || false,
      createdAt: now,
      updatedAt: now
    };
    
    // ✅ SQL: Create listing
    const createdListing = await adoptionRepo.createListing({
      listingId: listingId,
      vendorId: vendorId,
      petName: listing.petName,
      petType: listing.petType,
      breed: listing.breed,
      age: listing.age ? parseInt(String(listing.age)) : undefined,
      gender: listing.gender,
      size: listing.size,
      color: listing.color,
      description: listing.description,
      photos: listing.images || [],
      videos: listing.videos || [],
      medicalHistory: listing.medicalHistory,
      spayedNeutered: listing.spayedNeutered,
      adoptionFee: listing.adoptionFee || 0,
      status: listing.status || 'available'
    });
    
    return c.json({
      success: true,
      listing: createdListing,
      message: 'Adoption listing created successfully'
    });
  } catch (error) {
    console.error('Error creating adoption listing:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to create adoption listing',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * PUT /vendor/adoption/:vendorId/listings/:listingId
 * Update an adoption listing
 */
app.put('/:vendorId/listings/:listingId', async (c) => {
  try {
    const { vendorId, listingId } = c.req.param();
    const body = await c.req.json();
    
    // ✅ SQL: Get existing listing
    const existing = await adoptionRepo.getListingById(listingId);
    
    if (!existing) {
      return c.json({ 
        success: false, 
        error: 'Listing not found' 
      }, 404);
    }
    
    // ✅ SQL: Update listing
    const updatedListing = await adoptionRepo.updateListing(listingId, {
      ...body,
      updatedAt: new Date().toISOString()
    });
    
    return c.json({
      success: true,
      listing: updatedListing || updated,
      message: 'Adoption listing updated successfully'
    });
  } catch (error) {
    console.error('Error updating adoption listing:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to update adoption listing',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * DELETE /vendor/adoption/:vendorId/listings/:listingId
 * Delete an adoption listing
 */
app.delete('/:vendorId/listings/:listingId', async (c) => {
  try {
    const { vendorId, listingId } = c.req.param();
    
    // ✅ SQL: Delete listing (mark as withdrawn)
    await adoptionRepo.updateListing(listingId, { status: 'withdrawn' });
    
    return c.json({
      success: true,
      message: 'Adoption listing deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting adoption listing:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to delete adoption listing',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /vendor/adoption/:vendorId/applications
 * Get all adoption applications for a vendor
 */
app.get('/:vendorId/applications', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const { status } = c.req.query();
    
    // ✅ SQL: Get vendor applications (filter by listing vendor_id)
    const adoptionRepo = getAdoptionRepository();
    const allListings = await adoptionRepo.getAllListings();
    const vendorListingIds = allListings
      .filter((l: any) => l.vendorId === vendorId || l.vendor_id === vendorId)
      .map((l: any) => l.listingId || l.listing_id);
    
    let applications: any[] = [];
    for (const listingId of vendorListingIds) {
      const listingApps = await adoptionRepo.getListingApplications(listingId);
      applications.push(...listingApps);
    }
    
    // Filter by status if specified
    if (status) {
      applications = applications.filter(a => a.status === status);
    }
    
    // Sort by date (most recent first)
    applications.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    
    return c.json({
      success: true,
      applications,
      total: applications.length,
      pending: applications.filter(a => a.status === 'pending' || a.status === 'under_review').length
    });
  } catch (error) {
    console.error('Error fetching adoption applications:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch adoption applications',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /vendor/adoption/:vendorId/applications/:applicationId
 * Get a specific adoption application
 */
app.get('/:vendorId/applications/:applicationId', async (c) => {
  try {
    const { vendorId, applicationId } = c.req.param();
    
    // ✅ SQL: Get application
    const application = await adoptionRepo.getApplicationById(applicationId);
    
    if (!application) {
      return c.json({ 
        success: false, 
        error: 'Application not found' 
      }, 404);
    }
    
    return c.json({
      success: true,
      application
    });
  } catch (error) {
    console.error('Error fetching adoption application:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch adoption application',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /vendor/adoption/:vendorId/applications/:applicationId/review
 * Review an adoption application (approve/reject)
 */
app.post('/:vendorId/applications/:applicationId/review', async (c) => {
  try {
    const { vendorId, applicationId } = c.req.param();
    const { status, reviewedBy, notes, rejectionReason } = await c.req.json();
    
    // ✅ SQL: Get application
    const application = await adoptionRepo.getApplicationById(applicationId);
    
    if (!application) {
      return c.json({ 
        success: false, 
        error: 'Application not found' 
      }, 404);
    }
    
    const now = new Date().toISOString();
    const updated: AdoptionApplication = {
      ...application,
      status,
      reviewedBy,
      reviewedAt: now,
      notes,
      rejectionReason,
      updatedAt: now
    };
    
    // ✅ SQL: Update application
    const updateData = {
      status,
      reviewedBy,
      reviewedAt: now,
      notes,
      rejectionReason,
      updatedAt: now,
      ...(status === 'approved' && { approvedAt: now })
    };
    await adoptionRepo.updateApplication(applicationId, updateData);
    
    // If approved, update listing status
    if (status === 'approved') {
      // ✅ SQL: Get listing
      const listing = await adoptionRepo.getListingById(application.listingId);
      if (listing) {
        listing.status = 'pending';
        listing.updatedAt = now;
        // ✅ SQL: Update listing status
        await adoptionRepo.updateListing(application.listingId, { 
          status: 'pending', 
          applicationCount: (listing.applicationCount || 0) + 1 
        });
      }
    }
    
    return c.json({
      success: true,
      application: updated,
      message: `Application ${status === 'approved' ? 'approved' : 'rejected'} successfully`
    });
  } catch (error) {
    console.error('Error reviewing adoption application:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to review adoption application',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /vendor/adoption/:vendorId/listings/:listingId/mark-adopted
 * Mark a pet as adopted
 */
app.post('/:vendorId/listings/:listingId/mark-adopted', async (c) => {
  try {
    const { vendorId, listingId } = c.req.param();
    const { adoptedBy } = await c.req.json();
    
    // ✅ SQL: Get listing
    const adoptionRepo = getAdoptionRepository();
    const listing = await adoptionRepo.getListingById(listingId);
    
    if (!listing) {
      return c.json({ 
        success: false, 
        error: 'Listing not found' 
      }, 404);
    }
    
    const updated: AdoptionListing = {
      ...listing,
      status: 'adopted',
      updatedAt: new Date().toISOString()
    };
    
    // ✅ SQL: Update listing
    const updatedListing = await adoptionRepo.updateListing(listingId, {
      status: 'adopted',
      adoptedAt: new Date().toISOString()
    });
    
    return c.json({
      success: true,
      listing: updatedListing || existing,
      message: 'Pet marked as adopted successfully'
    });
  } catch (error) {
    console.error('Error marking pet as adopted:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to mark pet as adopted',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;
