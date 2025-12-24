/**
 * ============================================================================
 * ADOPTION ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Adoption listing management
 * - Application submission and review
 * - Pet adoption workflow
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ Proper error handling
 * ✅ CRUD operations via repositories
 * 
 * Date: 2025-01-27
 * Migration: Phase 2 - Critical Flow Migration
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { sendSuccess, sendError } from './response-utils.ts';
import { getAdoptionRepository } from '../../lib/repositories/adoption.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';

const app = new Hono();

/**
 * GET /vendor/adoption/:vendorId/listings
 * Get all adoption listings for a vendor
 */
app.get('/:vendorId/listings', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const { status } = c.req.query();
    
    // ✅ SQL: Get listings
    const adoptionRepo = getAdoptionRepository();
    const listings = await adoptionRepo.getAllListings({
      vendorId,
      status: status || undefined,
    });
    
    // Sort by featured first (if we add featured field), then by date
    listings.sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    return c.json({
      success: true,
      listings,
      total: listings.length,
      available: listings.filter((l: any) => l.status === 'available').length
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

    if (listing.vendorId !== vendorId) {
      return c.json({
        success: false,
        error: 'Unauthorized'
      }, 403);
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
    
    // ✅ SQL: Verify vendor exists
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.findById(vendorId);
    
    if (!vendor) {
      return c.json({
        success: false,
        error: 'Vendor not found'
      }, 404);
    }

    // ✅ SQL: Create listing
    const adoptionRepo = getAdoptionRepository();
    const listing = await adoptionRepo.createListing({
      vendorId,
      petName: body.petName,
      petType: body.petType,
      breed: body.breed,
      age: body.age,
      ageUnit: body.ageUnit,
      gender: body.gender,
      size: body.size,
      color: body.color,
      description: body.description,
      medicalHistory: body.medicalHistory,
      vaccinationStatus: body.vaccinations ? JSON.stringify(body.vaccinations) : undefined,
      spayedNeutered: body.spayedNeutered,
      specialNeeds: body.specialNeeds,
      photos: body.images || [],
      videos: body.videos || [],
      adoptionFee: body.adoptionFee || 0,
      status: 'available',
      locationCity: body.locationCity,
      locationState: body.locationState,
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone,
      requirements: body.requirements || {},
    });
    
    return c.json({
      success: true,
      listing,
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
    
    // ✅ SQL: Get listing
    const adoptionRepo = getAdoptionRepository();
    const listing = await adoptionRepo.getListingById(listingId);
    
    if (!listing) {
      return c.json({
        success: false,
        error: 'Listing not found'
      }, 404);
    }

    if (listing.vendorId !== vendorId) {
      return c.json({
        success: false,
        error: 'Unauthorized'
      }, 403);
    }

    // ✅ SQL: Update listing
    const updated = await adoptionRepo.updateListing(listingId, {
      petName: body.petName,
      description: body.description,
      status: body.status,
      adoptionFee: body.adoptionFee,
      photos: body.images,
      ...body,
    });
    
    if (!updated) {
      return c.json({
        success: false,
        error: 'Failed to update listing'
      }, 500);
    }
    
    return c.json({
      success: true,
      listing: updated,
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
    
    // ✅ SQL: Get listing
    const adoptionRepo = getAdoptionRepository();
    const listing = await adoptionRepo.getListingById(listingId);
    
    if (!listing) {
      return c.json({
        success: false,
        error: 'Listing not found'
      }, 404);
    }

    if (listing.vendorId !== vendorId) {
      return c.json({
        success: false,
        error: 'Unauthorized'
      }, 403);
    }

    // ✅ SQL: Update listing status to withdrawn
    const updated = await adoptionRepo.updateListing(listingId, {
      status: 'withdrawn',
    });
    
    if (!updated) {
      return c.json({
        success: false,
        error: 'Failed to delete listing'
      }, 500);
    }
    
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
 * GET /vendor/adoption/:vendorId/listings/:listingId/applications
 * Get applications for a listing
 */
app.get('/:vendorId/listings/:listingId/applications', async (c) => {
  try {
    const { vendorId, listingId } = c.req.param();
    
    // ✅ SQL: Verify listing belongs to vendor
    const adoptionRepo = getAdoptionRepository();
    const listing = await adoptionRepo.getListingById(listingId);
    
    if (!listing || listing.vendorId !== vendorId) {
      return c.json({
        success: false,
        error: 'Listing not found or unauthorized'
      }, 404);
    }

    // ✅ SQL: Get applications
    const applications = await adoptionRepo.getListingApplications(listingId);
    
    return c.json({
      success: true,
      applications,
      total: applications.length
    });
  } catch (error) {
    console.error('Error fetching applications:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch applications',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /vendor/adoption/:vendorId/listings/:listingId/applications/:applicationId/review
 * Review an adoption application
 */
app.post('/:vendorId/listings/:listingId/applications/:applicationId/review', async (c) => {
  try {
    const { vendorId, listingId, applicationId } = c.req.param();
    const body = await c.req.json();
    const { status, rejectionReason, reviewedBy } = body;
    
    // ✅ SQL: Verify listing belongs to vendor
    const adoptionRepo = getAdoptionRepository();
    const listing = await adoptionRepo.getListingById(listingId);
    
    if (!listing || listing.vendorId !== vendorId) {
      return c.json({
        success: false,
        error: 'Listing not found or unauthorized'
      }, 404);
    }

    // ✅ SQL: Get application
    const application = await adoptionRepo.getApplicationById(applicationId);
    
    if (!application || application.listingId !== listingId) {
      return c.json({
        success: false,
        error: 'Application not found'
      }, 404);
    }

    // ✅ SQL: Update application
    const updated = await adoptionRepo.updateApplication(applicationId, {
      status: status as any,
      reviewedBy: reviewedBy || vendorId,
      reviewedAt: new Date().toISOString(),
      rejectionReason: status === 'rejected' ? rejectionReason : undefined,
      approvedAt: status === 'approved' ? new Date().toISOString() : undefined,
    });
    
    if (!updated) {
      return c.json({
        success: false,
        error: 'Failed to update application'
      }, 500);
    }

    // If approved, update listing status
    if (status === 'approved') {
      await adoptionRepo.updateListing(listingId, {
        status: 'adopted',
        adoptedAt: new Date().toISOString(),
      });
    }
    
    return c.json({
      success: true,
      application: updated,
      message: 'Application reviewed successfully'
    });
  } catch (error) {
    console.error('Error reviewing application:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to review application',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /customer/adoption/:listingId/apply
 * Submit adoption application (customer endpoint)
 */
app.post('/customer/:listingId/apply', async (c) => {
  try {
    const { listingId } = c.req.param();
    const body = await c.req.json();
    const { customerId, applicantName, applicantEmail, applicantPhone } = body;
    
    if (!customerId || !applicantName || !applicantEmail || !applicantPhone) {
      return c.json({
        success: false,
        error: 'Missing required fields'
      }, 400);
    }

    // ✅ SQL: Get listing
    const adoptionRepo = getAdoptionRepository();
    const listing = await adoptionRepo.getListingById(listingId);
    
    if (!listing) {
      return c.json({
        success: false,
        error: 'Listing not found'
      }, 404);
    }

    if (listing.status !== 'available') {
      return c.json({
        success: false,
        error: 'This pet is no longer available for adoption'
      }, 400);
    }

    // ✅ SQL: Create application
    const application = await adoptionRepo.createApplication({
      listingId,
      customerId,
      applicantName,
      applicantEmail,
      applicantPhone,
      applicantAddress: body.address?.street ? JSON.stringify(body.address) : undefined,
      applicationMessage: body.motivation,
      previousPetExperience: body.experienceInfo?.hadPetsBefore ? JSON.stringify(body.experienceInfo) : undefined,
      currentPets: body.experienceInfo?.currentPets ? JSON.stringify(body.experienceInfo.currentPets) : undefined,
      livingSituation: body.householdInfo?.type,
      homeOwnership: body.householdInfo?.owned ? 'owned' : 'rented',
      yardSpace: body.householdInfo?.hasYard ? 'yes' : 'no',
      workSchedule: body.workSchedule,
      status: 'pending',
    });
    
    return c.json({
      success: true,
      application,
      message: 'Adoption application submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting application:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to submit application',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /customer/adoption/applications/:customerId
 * Get customer's adoption applications
 */
app.get('/customer/applications/:customerId', async (c) => {
  try {
    const { customerId } = c.req.param();
    
    // ✅ SQL: Get customer applications
    const adoptionRepo = getAdoptionRepository();
    const applications = await adoptionRepo.getCustomerApplications(customerId);
    
    return c.json({
      success: true,
      applications,
      total: applications.length
    });
  } catch (error) {
    console.error('Error fetching customer applications:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch applications',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;

