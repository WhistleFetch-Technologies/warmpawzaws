import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";

/**
 * 🐾 PET PROFILE PUBLISHING ENDPOINTS
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
 */

interface BreederProfile {
  breederId: string;
  vendorId: string;
  businessName: string;
  ownerName: string;
  licenseNumber?: string;
  kciRegistration?: string;
  yearsInBusiness: number;
  specializedBreeds: string[];
  location: {
    city: string;
    state: string;
    country: string;
  };
  contact: {
    phone: string;
    email: string;
    whatsapp?: string;
  };
  certifications: Array<{
    certificationId: string;
    name: string;
    issuedBy: string;
    issuedDate: string;
    expiryDate?: string;
    documentUrl?: string;
  }>;
  gallery: Array<{
    photoId: string;
    url: string;
    caption?: string;
    uploadedAt: string;
  }>;
  rating: number;
  totalSales: number;
  description: string;
  facilities: string[];
  isVerified: boolean;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PetListing {
  listingId: string;
  breederId: string;
  breederName: string;
  petType: 'dog' | 'cat' | 'bird' | 'other';
  breed: string;
  subBreed?: string;
  name?: string;
  gender: 'male' | 'female';
  dateOfBirth: string;
  age: {
    months: number;
    displayText: string;
  };
  color: string;
  markings?: string;
  price: number;
  negotiable: boolean;
  
  // Lineage Information
  lineage: {
    sire: {
      name: string;
      breed: string;
      kciNumber?: string;
      photo?: string;
      achievements?: string[];
    };
    dam: {
      name: string;
      breed: string;
      kciNumber?: string;
      photo?: string;
      achievements?: string[];
    };
    pedigreeUrl?: string;
  };

  // Health Information
  health: {
    vaccinationStatus: 'complete' | 'partial' | 'not_started';
    vaccinations: Array<{
      vaccineName: string;
      dateGiven: string;
      nextDue?: string;
      certificateUrl?: string;
    }>;
    dewormed: boolean;
    dewormingDate?: string;
    healthCertificate?: string;
    geneticTests?: Array<{
      testName: string;
      result: string;
      datePerformed: string;
      reportUrl?: string;
    }>;
    knownAllergies?: string[];
    medicalHistory?: string;
  };

  // Temperament & Nature
  temperament: {
    energyLevel: 'low' | 'medium' | 'high' | 'very_high';
    friendliness: number; // 1-5
    trainability: number; // 1-5
    socialWithPets: boolean;
    socialWithKids: boolean;
    barking: 'quiet' | 'moderate' | 'vocal';
    description: string;
    traits: string[]; // e.g., "Playful", "Calm", "Alert"
  };

  // Registration & Documents
  registration: {
    kciRegistered: boolean;
    kciNumber?: string;
    registrationCertificate?: string;
    microchipped: boolean;
    microchipNumber?: string;
    otherRegistrations?: string[];
  };

  // Media
  media: {
    photos: Array<{
      photoId: string;
      url: string;
      caption?: string;
      isPrimary: boolean;
    }>;
    videos?: Array<{
      videoId: string;
      url: string;
      caption?: string;
    }>;
  };

  // Additional Info
  availability: 'available' | 'reserved' | 'sold';
  readyToLeave: boolean;
  readyDate?: string;
  location: {
    city: string;
    state: string;
  };
  deliveryOptions: {
    pickup: boolean;
    shipping: boolean;
    handDelivery: boolean;
  };
  viewCount: number;
  inquiryCount: number;
  isPublished: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AdoptionCenterProfile {
  centerId: string;
  vendorId: string;
  centerName: string;
  registrationNumber?: string;
  type: 'shelter' | 'rescue' | 'ngo' | 'government';
  yearsActive: number;
  location: {
    address: string;
    city: string;
    state: string;
    pincode: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  contact: {
    phone: string;
    email: string;
    website?: string;
    socialMedia?: {
      facebook?: string;
      instagram?: string;
    };
  };
  capacity: number;
  currentAnimals: number;
  animalTypes: string[];
  services: string[]; // e.g., "Medical care", "Rehabilitation", "Training"
  adoptionProcess: {
    steps: string[];
    fees: {
      application: number;
      adoption: number;
      vaccination: number;
    };
    requirements: string[];
  };
  volunteerProgram: boolean;
  donationAccepted: boolean;
  gallery: Array<{
    photoId: string;
    url: string;
    caption?: string;
  }>;
  successStories: Array<{
    storyId: string;
    petName: string;
    beforePhoto: string;
    afterPhoto: string;
    description: string;
    adoptionDate: string;
  }>;
  rating: number;
  totalAdoptions: number;
  isVerified: boolean;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

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

export function petProfilePublishingEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

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

      const profile: BreederProfile = {
        breederId,
        vendorId,
        businessName,
        ownerName,
        licenseNumber,
        kciRegistration,
        yearsInBusiness: yearsInBusiness || 0,
        specializedBreeds: specializedBreeds || [],
        location,
        contact,
        certifications,
        gallery,
        rating: 5.0,
        totalSales: 0,
        description: description || '',
        facilities,
        isVerified: false,
        isPublished: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`breeder:profile:${breederId}`, profile);

      console.log(`✅ Breeder profile published: ${breederId}`);

      return sendSuccess(c, { profile }, 'Breeder profile published successfully');

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

      // Get breeder profile
      const breederProfile = await kv.get(`breeder:profile:${breederId}`);
      
      if (!breederProfile) {
        return sendError(c, 'Breeder profile not found', 404);
      }

      const listingId = `PET-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const age = calculateAge(dateOfBirth);

      const listing: PetListing = {
        listingId,
        breederId,
        breederName: breederProfile.businessName,
        petType,
        breed,
        name,
        gender,
        dateOfBirth,
        age,
        color: color || '',
        price,
        negotiable,
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
        availability: 'available',
        readyToLeave: true,
        location: location || breederProfile.location,
        deliveryOptions: deliveryOptions || {
          pickup: true,
          shipping: false,
          handDelivery: false
        },
        viewCount: 0,
        inquiryCount: 0,
        isPublished: true,
        isFeatured: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`pet:listing:${listingId}`, listing);

      console.log(`✅ Pet listing published: ${listingId}`);

      return sendSuccess(c, { listing }, 'Pet listing published successfully');

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

      const allListings = await kv.getByPrefix('pet:listing:') || [];
      
      let listings = allListings
        .map((item: any) => item.value || item)
        .filter((listing: any) => 
          listing.isPublished && 
          listing.availability === 'available'
        );

      if (breed) {
        listings = listings.filter((l: any) => 
          l.breed.toLowerCase().includes(breed.toLowerCase())
        );
      }

      if (city) {
        listings = listings.filter((l: any) => 
          l.location.city.toLowerCase() === city.toLowerCase()
        );
      }

      if (petType) {
        listings = listings.filter((l: any) => l.petType === petType);
      }

      listings = listings.filter((l: any) => 
        l.price >= minPrice && l.price <= maxPrice
      );

      // Sort featured first, then by newest
      listings.sort((a: any, b: any) => {
        if (a.isFeatured !== b.isFeatured) {
          return b.isFeatured ? 1 : -1;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      return sendSuccess(c, {
        count: listings.length,
        listings
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

      const listing = await kv.get(`pet:listing:${listingId}`);
      
      if (!listing) {
        return sendError(c, 'Listing not found', 404);
      }

      // Increment view count
      listing.viewCount = (listing.viewCount || 0) + 1;
      listing.updatedAt = new Date().toISOString();
      await kv.set(`pet:listing:${listingId}`, listing);

      // Get breeder profile
      const breeder = await kv.get(`breeder:profile:${listing.breederId}`);

      return sendSuccess(c, {
        listing,
        breeder: breeder ? {
          breederId: breeder.breederId,
          businessName: breeder.businessName,
          rating: breeder.rating,
          totalSales: breeder.totalSales,
          yearsInBusiness: breeder.yearsInBusiness,
          location: breeder.location,
          contact: breeder.contact,
          isVerified: breeder.isVerified
        } : null
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

      const profile: AdoptionCenterProfile = {
        centerId,
        vendorId,
        centerName,
        registrationNumber,
        type,
        yearsActive: yearsActive || 0,
        location,
        contact,
        capacity: capacity || 50,
        currentAnimals: currentAnimals || 0,
        animalTypes: animalTypes || [],
        services: services || [],
        adoptionProcess: adoptionProcess || {
          steps: [],
          fees: { application: 0, adoption: 0, vaccination: 0 },
          requirements: []
        },
        volunteerProgram,
        donationAccepted,
        gallery,
        successStories,
        rating: 5.0,
        totalAdoptions: 0,
        isVerified: false,
        isPublished: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`adoption:center:${centerId}`, profile);

      console.log(`✅ Adoption center profile published: ${centerId}`);

      return sendSuccess(c, { profile }, 'Adoption center profile published successfully');

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

      const allCenters = await kv.getByPrefix('adoption:center:') || [];
      
      let centers = allCenters
        .map((item: any) => item.value || item)
        .filter((center: any) => center.isPublished);

      if (city) {
        centers = centers.filter((c: any) => 
          c.location.city.toLowerCase() === city.toLowerCase()
        );
      }

      if (type) {
        centers = centers.filter((c: any) => c.type === type);
      }

      centers.sort((a: any, b: any) => b.rating - a.rating);

      return sendSuccess(c, {
        count: centers.length,
        centers
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

      const listing = await kv.get(`pet:listing:${listingId}`);
      
      if (!listing) {
        return sendError(c, 'Listing not found', 404);
      }

      listing.inquiryCount = (listing.inquiryCount || 0) + 1;
      await kv.set(`pet:listing:${listingId}`, listing);

      const inquiryId = `INQ-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const inquiry = {
        inquiryId,
        listingId,
        breederId: listing.breederId,
        customerId,
        customerName,
        customerPhone,
        message: message || '',
        status: 'new',
        createdAt: new Date().toISOString()
      };

      await kv.set(`pet:inquiry:${inquiryId}`, inquiry);

      console.log(`✅ Inquiry recorded: ${inquiryId}`);

      return sendSuccess(c, { inquiry }, 'Inquiry sent successfully');

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

      const listing = await kv.get(`pet:listing:${listingId}`);
      
      if (!listing) {
        return sendError(c, 'Listing not found', 404);
      }

      listing.availability = availability;
      listing.updatedAt = new Date().toISOString();

      await kv.set(`pet:listing:${listingId}`, listing);

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

  console.log('✅ Pet Profile Publishing Endpoints registered');
}
