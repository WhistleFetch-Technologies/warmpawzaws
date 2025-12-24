/**
 * ============================================================================
 * PET PROFILE PUBLISHING ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Complete pet profile publishing system for breeders & adoption centers
 * 
 * Features:
 * - Breeder profile publishing
 * - Pet listing with lineage
 * - Vaccination status display
 * - Nature/temperament information
 * - KCI registration display
 * - Photo gallery
 * - Adoption center profiles
 * - Sire/Dam information
 * - Health certificates
 * - Availability management
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with repository calls
 * - All data now comes from SQL tables
 * 
 * Date: 2025-01-27
 * Migration: Phase 6 - Complete KV to SQL Migration
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getPetProfilePublishingRepository } from "../../lib/repositories/pet-profile-publishing.ts";

// Calculate age from date of birth
function calculateAge(dob: string): { months: number; displayText: string } {
  const birthDate = new Date(dob);
  const today = new Date();
  
  const years = today.getFullYear() - birthDate.getFullYear();
  const months = today.getMonth() - birthDate.getMonth();
  
  const totalMonths = years * 12 + months;
  
  let displayText = '';
  if (years > 0) {
    displayText = `${years} year${years > 1 ? 's' : ''}`;
    if (months > 0) {
      displayText += ` ${months} month${months > 1 ? 's' : ''}`;
    }
  } else {
    displayText = `${totalMonths} month${totalMonths !== 1 ? 's' : ''}`;
  }
  
  return { months: totalMonths, displayText };
}

export function petProfilePublishingEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const repo = getPetProfilePublishingRepository();

  /**
   * POST /breeder/publish-profile
   * Publish breeder profile
   */
  app.post(`${BASE_PATH}/breeder/publish-profile`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        vendorId,
        businessName,
        ownerName,
        licenseNumber,
        kciRegistration,
        yearsInBusiness,
        specializedBreeds,
        location,
        contact,
        certifications = [],
        gallery = [],
        description,
        facilities = []
      } = body;

      if (!vendorId || !businessName || !ownerName || !location || !contact) {
        return sendError(c, 'Missing required fields', 400);
      }

      const breederId = `BREEDER-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // ✅ SQL: Create breeder profile
      const profile = await repo.createBreederProfile({
        breeder_id: breederId,
        vendor_id: vendorId,
        business_name: businessName,
        owner_name: ownerName,
        license_number: licenseNumber,
        kci_registration: kciRegistration,
        years_in_business: yearsInBusiness || 0,
        specialized_breeds: specializedBreeds || [],
        location,
        contact,
        certifications,
        gallery,
        description: description || '',
        facilities: facilities || [],
        is_verified: false,
        is_published: true
      });

      console.log(`✅ Breeder profile published: ${breederId}`);

      // Transform to match original interface
      const profileResponse = {
        breederId: profile.breeder_id,
        vendorId: profile.vendor_id,
        businessName: profile.business_name,
        ownerName: profile.owner_name,
        licenseNumber: profile.license_number,
        kciRegistration: profile.kci_registration,
        yearsInBusiness: profile.years_in_business,
        specializedBreeds: profile.specialized_breeds,
        location: profile.location,
        contact: profile.contact,
        certifications: profile.certifications,
        gallery: profile.gallery,
        rating: profile.rating,
        totalSales: profile.total_sales,
        description: profile.description,
        facilities: profile.facilities,
        isVerified: profile.is_verified,
        isPublished: profile.is_published,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at
      };

      return sendSuccess(c, { profile: profileResponse }, 'Breeder profile published successfully');

    } catch (error) {
      console.error('❌ Error publishing breeder profile:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /breeder/publish-pet
   * Publish pet listing
   */
  app.post(`${BASE_PATH}/breeder/publish-pet`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        breederId,
        petType,
        breed,
        gender,
        dateOfBirth,
        price,
        lineage,
        health,
        temperament,
        registration,
        media,
        location,
        deliveryOptions,
        name,
        color,
        negotiable = false
      } = body;

      if (!breederId || !petType || !breed || !gender || !dateOfBirth || !price) {
        return sendError(c, 'Missing required fields', 400);
      }

      // ✅ SQL: Get breeder profile
      const breederProfile = await repo.getBreederProfileByBreederId(breederId);
      
      if (!breederProfile) {
        return sendError(c, 'Breeder profile not found', 404);
      }

      const listingId = `PET-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const age = calculateAge(dateOfBirth);

      // ✅ SQL: Create pet listing
      const listing = await repo.createPetListing({
        listing_id: listingId,
        breeder_id: breederId,
        breeder_name: breederProfile.business_name,
        pet_type: petType,
        breed: breed,
        name: name,
        gender: gender,
        date_of_birth: dateOfBirth,
        age_months: age.months,
        age_display_text: age.displayText,
        color: color || '',
        price: price,
        negotiable: negotiable,
        lineage: lineage || {
          sire: { name: '', breed: '' },
          dam: { name: '', breed: '' }
        },
        health: health || {
          vaccinationStatus: 'not_started',
          vaccinations: [],
          dewormed: false
        },
        temperament: temperament || {
          energyLevel: 'medium',
          friendliness: 3,
          trainability: 3,
          socialWithPets: true,
          socialWithKids: true,
          barking: 'moderate',
          description: '',
          traits: []
        },
        registration: registration || {
          kciRegistered: false,
          microchipped: false
        },
        media: media || { photos: [] },
        location: location || breederProfile.location,
        delivery_options: deliveryOptions || {
          pickup: true,
          shipping: false,
          handDelivery: false
        },
        is_published: true,
        is_featured: false
      });

      console.log(`✅ Pet listing published: ${listingId}`);

      // Transform to match original interface
      const listingResponse = {
        listingId: listing.listing_id,
        breederId: listing.breeder_id,
        breederName: listing.breeder_name,
        petType: listing.pet_type,
        breed: listing.breed,
        name: listing.name,
        gender: listing.gender,
        dateOfBirth: listing.date_of_birth,
        age: { months: listing.age_months, displayText: listing.age_display_text },
        color: listing.color,
        price: listing.price,
        negotiable: listing.negotiable,
        lineage: listing.lineage,
        health: listing.health,
        temperament: listing.temperament,
        registration: listing.registration,
        media: listing.media,
        availability: listing.availability,
        readyToLeave: listing.ready_to_leave,
        location: listing.location,
        deliveryOptions: listing.delivery_options,
        viewCount: listing.view_count,
        inquiryCount: listing.inquiry_count,
        isPublished: listing.is_published,
        isFeatured: listing.is_featured,
        createdAt: listing.created_at,
        updatedAt: listing.updated_at
      };

      return sendSuccess(c, { listing: listingResponse }, 'Pet listing published successfully');

    } catch (error) {
      console.error('❌ Error publishing pet listing:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /breeder/catalog
   * Browse breeder catalog
   */
  app.get(`${BASE_PATH}/breeder/catalog`, async (c) => {
    try {
      const breed = c.req.query('breed');
      const city = c.req.query('city');
      const minPrice = parseFloat(c.req.query('minPrice') || '0');
      const maxPrice = parseFloat(c.req.query('maxPrice') || '999999999');
      const petType = c.req.query('petType');

      // ✅ SQL: Get pet listings with filters
      const listings = await repo.getPetListings({
        breed: breed || undefined,
        city: city || undefined,
        minPrice: minPrice,
        maxPrice: maxPrice,
        petType: petType || undefined
      });

      // Transform to match original interface
      const listingsResponse = listings.map((l: any) => ({
        listingId: l.listing_id,
        breederId: l.breeder_id,
        breederName: l.breeder_name,
        petType: l.pet_type,
        breed: l.breed,
        name: l.name,
        gender: l.gender,
        dateOfBirth: l.date_of_birth,
        age: { months: l.age_months, displayText: l.age_display_text },
        color: l.color,
        price: l.price,
        negotiable: l.negotiable,
        lineage: l.lineage,
        health: l.health,
        temperament: l.temperament,
        registration: l.registration,
        media: l.media,
        availability: l.availability,
        readyToLeave: l.ready_to_leave,
        location: l.location,
        deliveryOptions: l.delivery_options,
        viewCount: l.view_count,
        inquiryCount: l.inquiry_count,
        isPublished: l.is_published,
        isFeatured: l.is_featured,
        createdAt: l.created_at,
        updatedAt: l.updated_at
      }));

      return sendSuccess(c, {
        count: listingsResponse.length,
        listings: listingsResponse
      });

    } catch (error) {
      console.error('❌ Error fetching catalog:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /pet/listing/:listingId
   * Get pet listing details
   */
  app.get(`${BASE_PATH}/pet/listing/:listingId`, async (c) => {
    try {
      const { listingId } = c.req.param();

      // ✅ SQL: Get listing
      const listing = await repo.getPetListingByListingId(listingId);
      
      if (!listing) {
        return sendError(c, 'Listing not found', 404);
      }

      // ✅ SQL: Increment view count
      const updatedListing = await repo.updatePetListing(listingId, {
        view_count: (listing.view_count || 0) + 1
      });

      // ✅ SQL: Get breeder profile
      const breeder = await repo.getBreederProfileByBreederId(listing.breeder_id);

      // Transform listing
      const listingResponse = {
        listingId: updatedListing.listing_id,
        breederId: updatedListing.breeder_id,
        breederName: updatedListing.breeder_name,
        petType: updatedListing.pet_type,
        breed: updatedListing.breed,
        name: updatedListing.name,
        gender: updatedListing.gender,
        dateOfBirth: updatedListing.date_of_birth,
        age: { months: updatedListing.age_months, displayText: updatedListing.age_display_text },
        color: updatedListing.color,
        price: updatedListing.price,
        negotiable: updatedListing.negotiable,
        lineage: updatedListing.lineage,
        health: updatedListing.health,
        temperament: updatedListing.temperament,
        registration: updatedListing.registration,
        media: updatedListing.media,
        availability: updatedListing.availability,
        readyToLeave: updatedListing.ready_to_leave,
        location: updatedListing.location,
        deliveryOptions: updatedListing.delivery_options,
        viewCount: updatedListing.view_count,
        inquiryCount: updatedListing.inquiry_count,
        isPublished: updatedListing.is_published,
        isFeatured: updatedListing.is_featured,
        createdAt: updatedListing.created_at,
        updatedAt: updatedListing.updated_at
      };

      // Transform breeder
      const breederResponse = breeder ? {
        breederId: breeder.breeder_id,
        businessName: breeder.business_name,
        rating: breeder.rating,
        totalSales: breeder.total_sales,
        yearsInBusiness: breeder.years_in_business,
        location: breeder.location,
        contact: breeder.contact,
        isVerified: breeder.is_verified
      } : null;

      return sendSuccess(c, {
        listing: listingResponse,
        breeder: breederResponse
      });

    } catch (error) {
      console.error('❌ Error fetching listing:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /adoption-center/publish-profile
   * Publish adoption center profile
   */
  app.post(`${BASE_PATH}/adoption-center/publish-profile`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        vendorId,
        centerName,
        registrationNumber,
        type,
        yearsActive,
        location,
        contact,
        capacity,
        currentAnimals,
        animalTypes,
        services,
        adoptionProcess,
        volunteerProgram = false,
        donationAccepted = false,
        gallery = [],
        successStories = []
      } = body;

      if (!vendorId || !centerName || !type || !location || !contact) {
        return sendError(c, 'Missing required fields', 400);
      }

      const centerId = `ADOPTION-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // ✅ SQL: Create adoption center profile
      const profile = await repo.createAdoptionCenterProfile({
        center_id: centerId,
        vendor_id: vendorId,
        center_name: centerName,
        registration_number: registrationNumber,
        type: type,
        years_active: yearsActive || 0,
        location: location,
        contact: contact,
        capacity: capacity || 50,
        current_animals: currentAnimals || 0,
        animal_types: animalTypes || [],
        services: services || [],
        adoption_process: adoptionProcess || {
          steps: [],
          fees: { application: 0, adoption: 0, vaccination: 0 },
          requirements: []
        },
        volunteer_program: volunteerProgram,
        donation_accepted: donationAccepted,
        gallery: gallery,
        success_stories: successStories,
        is_verified: false,
        is_published: true
      });

      console.log(`✅ Adoption center profile published: ${centerId}`);

      // Transform to match original interface
      const profileResponse = {
        centerId: profile.center_id,
        vendorId: profile.vendor_id,
        centerName: profile.center_name,
        registrationNumber: profile.registration_number,
        type: profile.type,
        yearsActive: profile.years_active,
        location: profile.location,
        contact: profile.contact,
        capacity: profile.capacity,
        currentAnimals: profile.current_animals,
        animalTypes: profile.animal_types,
        services: profile.services,
        adoptionProcess: profile.adoption_process,
        volunteerProgram: profile.volunteer_program,
        donationAccepted: profile.donation_accepted,
        gallery: profile.gallery,
        successStories: profile.success_stories,
        rating: profile.rating,
        totalAdoptions: profile.total_adoptions,
        isVerified: profile.is_verified,
        isPublished: profile.is_published,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at
      };

      return sendSuccess(c, { profile: profileResponse }, 'Adoption center profile published successfully');

    } catch (error) {
      console.error('❌ Error publishing adoption center:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /adoption-center/all
   * Get all adoption centers
   */
  app.get(`${BASE_PATH}/adoption-center/all`, async (c) => {
    try {
      const city = c.req.query('city');
      const type = c.req.query('type');

      // ✅ SQL: Get adoption centers
      const centers = await repo.getAdoptionCenters({
        city: city || undefined,
        type: type || undefined
      });

      // Transform to match original interface
      const centersResponse = centers.map((c: any) => ({
        centerId: c.center_id,
        vendorId: c.vendor_id,
        centerName: c.center_name,
        registrationNumber: c.registration_number,
        type: c.type,
        yearsActive: c.years_active,
        location: c.location,
        contact: c.contact,
        capacity: c.capacity,
        currentAnimals: c.current_animals,
        animalTypes: c.animal_types,
        services: c.services,
        adoptionProcess: c.adoption_process,
        volunteerProgram: c.volunteer_program,
        donationAccepted: c.donation_accepted,
        gallery: c.gallery,
        successStories: c.success_stories,
        rating: c.rating,
        totalAdoptions: c.total_adoptions,
        isVerified: c.is_verified,
        isPublished: c.is_published,
        createdAt: c.created_at,
        updatedAt: c.updated_at
      }));

      return sendSuccess(c, {
        count: centersResponse.length,
        centers: centersResponse
      });

    } catch (error) {
      console.error('❌ Error fetching adoption centers:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /pet/listing/:listingId/inquiry
   * Record inquiry for a listing
   */
  app.post(`${BASE_PATH}/pet/listing/:listingId/inquiry`, async (c) => {
    try {
      const { listingId } = c.req.param();
      const body = await c.req.json();
      const { customerId, customerName, customerPhone, message } = body;

      // ✅ SQL: Get listing
      const listing = await repo.getPetListingByListingId(listingId);
      
      if (!listing) {
        return sendError(c, 'Listing not found', 404);
      }

      // ✅ SQL: Increment inquiry count
      await repo.updatePetListing(listingId, {
        inquiry_count: (listing.inquiry_count || 0) + 1
      });

      const inquiryId = `INQ-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // ✅ SQL: Create inquiry
      const inquiry = await repo.createPetInquiry({
        inquiry_id: inquiryId,
        listing_id: listingId,
        customer_id: customerId,
        customer_name: customerName,
        customer_phone: customerPhone,
        message: message || '',
        status: 'pending'
      });

      console.log(`✅ Inquiry recorded: ${inquiryId}`);

      // Transform to match original interface
      const inquiryResponse = {
        inquiryId: inquiry.inquiry_id,
        listingId: inquiry.listing_id,
        customerId: inquiry.customer_id,
        customerName: inquiry.customer_name,
        customerPhone: inquiry.customer_phone,
        customerEmail: inquiry.customer_email,
        message: inquiry.message,
        status: inquiry.status,
        createdAt: inquiry.created_at
      };

      return sendSuccess(c, { inquiry: inquiryResponse }, 'Inquiry sent successfully');

    } catch (error) {
      console.error('❌ Error recording inquiry:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /pet/listing/:listingId/update-availability
   * Update pet availability
   */
  app.post(`${BASE_PATH}/pet/listing/:listingId/update-availability`, async (c) => {
    try {
      const { listingId } = c.req.param();
      const body = await c.req.json();
      const { availability } = body;

      const validStatuses = ['available', 'reserved', 'sold'];
      
      if (!availability || !validStatuses.includes(availability)) {
        return sendError(c, 'Invalid availability status', 400);
      }

      // ✅ SQL: Get listing
      const listing = await repo.getPetListingByListingId(listingId);
      
      if (!listing) {
        return sendError(c, 'Listing not found', 404);
      }

      // ✅ SQL: Update availability
      const updatedListing = await repo.updatePetListing(listingId, {
        availability: availability
      });

      console.log(`✅ Listing ${listingId} availability updated to: ${availability}`);

      return sendSuccess(c, {
        listingId,
        availability
      }, 'Availability updated successfully');

    } catch (error) {
      console.error('❌ Error updating availability:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Pet Profile Publishing Endpoints (SQL) registered');
}

