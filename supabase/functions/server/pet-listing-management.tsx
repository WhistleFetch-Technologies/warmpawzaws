import { Hono } from "npm:hono";
import * as kv from './kv_store.tsx';
import { generateId } from './database-schema.tsx';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * PET LISTING MANAGEMENT (BREEDERS & ADOPTION)
 * Production-ready endpoints for managing pet/puppy listings
 * 
 * Features:
 * - Pet listing CRUD
 * - Breeder vs NGO/Shelter modes
 * - Photo & video storage (mandatory)
 * - Lineage tracking (breeders)
 * - Adoption fee vs Purchase price
 * - Vaccination status
 * - Behavior profiles
 * - "What to expect" sections
 */

export function registerPetListingManagement(app: Hono) {
  const BASE = '/make-server-3dd53475';

  // Initialize Supabase client for storage
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Ensure pet listing media bucket exists
  const BUCKET_NAME = 'make-3dd53475-pet-listings';
  
  async function ensureBucket() {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some(b => b.name === BUCKET_NAME);
    
    if (!exists) {
      await supabase.storage.createBucket(BUCKET_NAME, {
        public: false,
        fileSizeLimit: 52428800 // 50MB
      });
      console.log(`✅ Created bucket: ${BUCKET_NAME}`);
    }
  }

  ensureBucket().catch(console.error);

  // =============================================
  // GET ALL PET LISTINGS FOR A VENDOR
  // =============================================
  app.get(`${BASE}/vendor/:vendorId/pet-listings`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      console.log(`[PET LISTINGS] Fetching listings for vendor: ${vendorId}`);

      // Verify vendor
      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Get all listings
      const listings = await kv.get(`vendor:${vendorId}:pet_listings`) || [];

      // Refresh signed URLs
      const listingsWithUrls = await Promise.all(listings.map(async (listing: any) => {
        const photoUrls = await Promise.all(
          (listing.photos || []).map(async (path: string) => {
            const { data } = await supabase.storage
              .from(BUCKET_NAME)
              .createSignedUrl(path, 3600);
            return data?.signedUrl || path;
          })
        );

        const videoUrls = await Promise.all(
          (listing.videos || []).map(async (path: string) => {
            const { data } = await supabase.storage
              .from(BUCKET_NAME)
              .createSignedUrl(path, 3600);
            return data?.signedUrl || path;
          })
        );

        return {
          ...listing,
          photoUrls,
          videoUrls
        };
      }));

      return c.json({
        success: true,
        listings: listingsWithUrls,
        totalListings: listings.length,
        vendor: {
          id: vendor.id,
          businessName: vendor.businessName,
          roleId: vendor.roleId
        }
      });

    } catch (error) {
      console.error('[PET LISTINGS] Error:', error);
      return c.json({ error: 'Failed to fetch listings' }, 500);
    }
  });

  // =============================================
  // CREATE NEW PET LISTING
  // =============================================
  app.post(`${BASE}/vendor/:vendorId/pet-listings`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();

      console.log(`[PET LISTINGS] Creating listing for vendor: ${vendorId}`);

      // Get vendor to determine type (breeder vs NGO/shelter)
      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const isBreeder = vendor.roleId === 'breeder';
      const isNGO = vendor.roleId === 'ngo' || vendor.roleId === 'shelter';

      // Validate required fields
      if (!body.breed || !body.age || !body.gender) {
        return c.json({ 
          error: 'Breed, age, and gender are required' 
        }, 400);
      }

      // Photos and videos are mandatory
      if (!body.photos || body.photos.length === 0) {
        return c.json({ 
          error: 'At least one photo is required' 
        }, 400);
      }

      if (!body.videos || body.videos.length === 0) {
        return c.json({ 
          error: 'At least one video is required' 
        }, 400);
      }

      // Breeder-specific validation
      if (isBreeder && !body.price) {
        return c.json({ 
          error: 'Price is required for breeder listings' 
        }, 400);
      }

      // Get existing listings
      const listings = await kv.get(`vendor:${vendorId}:pet_listings`) || [];

      // Create new listing
      const listingId = generateId('pet');
      const newListing = {
        id: listingId,
        vendorId,
        vendorType: isBreeder ? 'breeder' : isNGO ? 'ngo' : 'other',
        
        // Basic info
        name: body.name || `${body.breed} - ${body.age}`,
        breed: body.breed,
        age: body.age, // e.g., "2 months", "6 months"
        dateOfBirth: body.dateOfBirth || null, // Optional exact DOB
        gender: body.gender, // 'male', 'female'
        color: body.color || '',
        
        // Media (mandatory)
        photos: body.photos, // array of storage paths
        videos: body.videos, // array of storage paths
        
        // Health & Behavior
        vaccinationStatus: body.vaccinationStatus || 'unknown', // 'complete', 'partial', 'none', 'unknown'
        vaccinationDetails: body.vaccinationDetails || '',
        dewormed: body.dewormed || false,
        healthCertificate: body.healthCertificate || false,
        behavior: body.behavior || [], // array: ['friendly', 'playful', 'calm', 'energetic']
        temperament: body.temperament || '',
        goodWith: body.goodWith || [], // ['kids', 'other_dogs', 'cats']
        
        // Pricing
        price: isBreeder ? parseFloat(body.price || 0) : 0,
        adoptionFee: isNGO ? parseFloat(body.adoptionFee || 0) : 0,
        isFreeAdoption: isNGO && (body.isFreeAdoption || false),
        negotiable: body.negotiable || false,
        
        // Breeder-specific fields
        lineage: isBreeder ? {
          sire: body.lineage?.sire || '', // father's lineage
          dam: body.lineage?.dam || '', // mother's lineage
          pedigree: body.lineage?.pedigree || false,
          kenelClubRegistered: body.lineage?.kenelClubRegistered || false,
          registrationNumber: body.lineage?.registrationNumber || ''
        } : null,
        litterInfo: isBreeder ? {
          litterDate: body.litterInfo?.litterDate || '',
          totalPuppies: body.litterInfo?.totalPuppies || 0,
          availablePuppies: body.litterInfo?.availablePuppies || 0
        } : null,
        
        // NGO/Shelter-specific fields
        rescueStory: isNGO ? body.rescueStory || '' : '',
        rescueDate: isNGO ? body.rescueDate || '' : '',
        spayedNeutered: isNGO ? body.spayedNeutered || false : false,
        
        // What to expect
        whatToExpect: body.whatToExpect || '',
        specialNeeds: body.specialNeeds || '',
        dietaryRequirements: body.dietaryRequirements || '',
        exerciseNeeds: body.exerciseNeeds || '', // 'low', 'medium', 'high'
        
        // Additional info
        description: body.description || '',
        location: body.location || '',
        availableFrom: body.availableFrom || new Date().toISOString(),
        
        // Status
        status: body.status || 'available', // 'available', 'reserved', 'sold', 'adopted'
        isActive: body.isActive !== undefined ? body.isActive : true,
        isFeatured: body.isFeatured || false,
        
        // Metadata
        views: 0,
        inquiries: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      listings.push(newListing);
      await kv.set(`vendor:${vendorId}:pet_listings`, listings);

      console.log(`✅ [PET LISTINGS] Created listing: ${listingId}`);

      return c.json({
        success: true,
        listing: newListing,
        message: 'Pet listing created successfully'
      });

    } catch (error) {
      console.error('[PET LISTINGS] Error:', error);
      return c.json({ error: 'Failed to create listing' }, 500);
    }
  });

  // =============================================
  // UPDATE PET LISTING
  // =============================================
  app.put(`${BASE}/vendor/:vendorId/pet-listings/:listingId`, async (c) => {
    try {
      const { vendorId, listingId } = c.req.param();
      const body = await c.req.json();

      console.log(`[PET LISTINGS] Updating listing: ${listingId}`);

      const listings = await kv.get(`vendor:${vendorId}:pet_listings`) || [];
      const index = listings.findIndex((l: any) => l.id === listingId);

      if (index === -1) {
        return c.json({ error: 'Listing not found' }, 404);
      }

      // Update listing
      listings[index] = {
        ...listings[index],
        ...body,
        id: listingId, // prevent ID change
        vendorId, // prevent vendor change
        updatedAt: new Date().toISOString()
      };

      await kv.set(`vendor:${vendorId}:pet_listings`, listings);

      console.log(`✅ [PET LISTINGS] Updated listing: ${listingId}`);

      return c.json({
        success: true,
        listing: listings[index],
        message: 'Listing updated successfully'
      });

    } catch (error) {
      console.error('[PET LISTINGS] Error:', error);
      return c.json({ error: 'Failed to update listing' }, 500);
    }
  });

  // =============================================
  // DELETE PET LISTING
  // =============================================
  app.delete(`${BASE}/vendor/:vendorId/pet-listings/:listingId`, async (c) => {
    try {
      const { vendorId, listingId } = c.req.param();

      console.log(`[PET LISTINGS] Deleting listing: ${listingId}`);

      const listings = await kv.get(`vendor:${vendorId}:pet_listings`) || [];
      const listing = listings.find((l: any) => l.id === listingId);

      if (!listing) {
        return c.json({ error: 'Listing not found' }, 404);
      }

      // Delete photos
      for (const photoPath of listing.photos || []) {
        await supabase.storage.from(BUCKET_NAME).remove([photoPath]);
      }

      // Delete videos
      for (const videoPath of listing.videos || []) {
        await supabase.storage.from(BUCKET_NAME).remove([videoPath]);
      }

      // Remove listing
      const filtered = listings.filter((l: any) => l.id !== listingId);
      await kv.set(`vendor:${vendorId}:pet_listings`, filtered);

      console.log(`✅ [PET LISTINGS] Deleted listing: ${listingId}`);

      return c.json({
        success: true,
        message: 'Listing deleted successfully'
      });

    } catch (error) {
      console.error('[PET LISTINGS] Error:', error);
      return c.json({ error: 'Failed to delete listing' }, 500);
    }
  });

  // =============================================
  // UPLOAD PHOTO/VIDEO
  // =============================================
  app.post(`${BASE}/vendor/:vendorId/pet-listings/media/upload`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const formData = await c.req.formData();
      const file = formData.get('file') as File;
      const listingId = formData.get('listingId') as string;

      if (!file) {
        return c.json({ error: 'No file provided' }, 400);
      }

      // Validate file type
      const isPhoto = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      if (!isPhoto && !isVideo) {
        return c.json({ error: 'Invalid file type' }, 400);
      }

      // Validate size
      if (file.size > 52428800) {
        return c.json({ error: 'File size exceeds 50MB limit' }, 400);
      }

      // Generate storage path
      const fileExt = file.name.split('.').pop();
      const fileName = `${vendorId}/${listingId || 'temp'}/${Date.now()}.${fileExt}`;

      // Upload
      const fileBuffer = await file.arrayBuffer();
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, fileBuffer, {
          contentType: file.type,
          upsert: false
        });

      if (error) {
        console.error('[PET LISTINGS] Upload error:', error);
        return c.json({ error: 'Failed to upload file' }, 500);
      }

      // If listingId provided, update listing
      if (listingId) {
        const listings = await kv.get(`vendor:${vendorId}:pet_listings`) || [];
        const index = listings.findIndex((l: any) => l.id === listingId);

        if (index !== -1) {
          if (isPhoto) {
            listings[index].photos = [...(listings[index].photos || []), fileName];
          } else {
            listings[index].videos = [...(listings[index].videos || []), fileName];
          }
          listings[index].updatedAt = new Date().toISOString();
          await kv.set(`vendor:${vendorId}:pet_listings`, listings);
        }
      }

      // Generate signed URL
      const { data: urlData } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(fileName, 3600);

      console.log(`✅ [PET LISTINGS] Uploaded media: ${fileName}`);

      return c.json({
        success: true,
        filePath: fileName,
        url: urlData?.signedUrl,
        type: isPhoto ? 'photo' : 'video',
        message: 'File uploaded successfully'
      });

    } catch (error) {
      console.error('[PET LISTINGS] Error:', error);
      return c.json({ error: 'Failed to upload file' }, 500);
    }
  });

  // =============================================
  // DELETE PHOTO/VIDEO
  // =============================================
  app.delete(`${BASE}/vendor/:vendorId/pet-listings/:listingId/media`, async (c) => {
    try {
      const { vendorId, listingId } = c.req.param();
      const { filePath, mediaType } = await c.req.json();

      if (!filePath) {
        return c.json({ error: 'File path is required' }, 400);
      }

      // Delete from storage
      await supabase.storage.from(BUCKET_NAME).remove([filePath]);

      // Update listing
      const listings = await kv.get(`vendor:${vendorId}:pet_listings`) || [];
      const index = listings.findIndex((l: any) => l.id === listingId);

      if (index !== -1) {
        if (mediaType === 'photo') {
          listings[index].photos = listings[index].photos.filter((p: string) => p !== filePath);
        } else {
          listings[index].videos = listings[index].videos.filter((v: string) => v !== filePath);
        }
        listings[index].updatedAt = new Date().toISOString();
        await kv.set(`vendor:${vendorId}:pet_listings`, listings);
      }

      return c.json({
        success: true,
        message: 'File deleted successfully'
      });

    } catch (error) {
      console.error('[PET LISTINGS] Error:', error);
      return c.json({ error: 'Failed to delete file' }, 500);
    }
  });

  // =============================================
  // GET PUBLIC LISTINGS (Customer-facing)
  // =============================================
  app.get(`${BASE}/public/pet-listings`, async (c) => {
    try {
      const vendorType = c.req.query('vendorType'); // 'breeder', 'ngo', 'all'
      const breed = c.req.query('breed');
      const minPrice = c.req.query('minPrice');
      const maxPrice = c.req.query('maxPrice');

      // Get all vendors with pet listings
      const allVendors = await kv.getByPrefix('vendor:');
      let allListings: any[] = [];

      for (const vendor of allVendors) {
        const listings = await kv.get(`vendor:${vendor.id}:pet_listings`) || [];
        const activeListings = listings.filter((l: any) => l.isActive && l.status === 'available');
        
        allListings = [
          ...allListings,
          ...activeListings.map((l: any) => ({
            ...l,
            vendorName: vendor.businessName,
            vendorPhone: vendor.phone,
            vendorLocation: vendor.address
          }))
        ];
      }

      // Apply filters
      let filtered = allListings;

      if (vendorType && vendorType !== 'all') {
        filtered = filtered.filter(l => l.vendorType === vendorType);
      }

      if (breed) {
        filtered = filtered.filter(l => 
          l.breed.toLowerCase().includes(breed.toLowerCase())
        );
      }

      if (minPrice) {
        filtered = filtered.filter(l => 
          (l.price || l.adoptionFee) >= parseFloat(minPrice)
        );
      }

      if (maxPrice) {
        filtered = filtered.filter(l => 
          (l.price || l.adoptionFee) <= parseFloat(maxPrice)
        );
      }

      // Refresh URLs
      const listingsWithUrls = await Promise.all(filtered.map(async (listing: any) => {
        const photoUrls = await Promise.all(
          (listing.photos || []).slice(0, 3).map(async (path: string) => {
            const { data } = await supabase.storage
              .from(BUCKET_NAME)
              .createSignedUrl(path, 3600);
            return data?.signedUrl || null;
          })
        );

        const videoUrls = await Promise.all(
          (listing.videos || []).slice(0, 1).map(async (path: string) => {
            const { data } = await supabase.storage
              .from(BUCKET_NAME)
              .createSignedUrl(path, 3600);
            return data?.signedUrl || null;
          })
        );

        return {
          ...listing,
          photoUrls: photoUrls.filter(Boolean),
          videoUrls: videoUrls.filter(Boolean)
        };
      }));

      return c.json({
        success: true,
        listings: listingsWithUrls,
        total: listingsWithUrls.length
      });

    } catch (error) {
      console.error('[PET LISTINGS] Error:', error);
      return c.json({ error: 'Failed to fetch listings' }, 500);
    }
  });

  // =============================================
  // INCREMENT VIEW COUNT
  // =============================================
  app.post(`${BASE}/public/pet-listings/:listingId/view`, async (c) => {
    try {
      const { listingId } = c.req.param();

      // Find listing across all vendors
      const allVendors = await kv.getByPrefix('vendor:');
      
      for (const vendor of allVendors) {
        const listings = await kv.get(`vendor:${vendor.id}:pet_listings`) || [];
        const index = listings.findIndex((l: any) => l.id === listingId);

        if (index !== -1) {
          listings[index].views = (listings[index].views || 0) + 1;
          await kv.set(`vendor:${vendor.id}:pet_listings`, listings);
          
          return c.json({
            success: true,
            views: listings[index].views
          });
        }
      }

      return c.json({ error: 'Listing not found' }, 404);

    } catch (error) {
      console.error('[PET LISTINGS] Error:', error);
      return c.json({ error: 'Failed to increment view' }, 500);
    }
  });
}
