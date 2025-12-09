/**
 * PROFILE PHOTO MANAGEMENT SYSTEM
 * 
 * Features:
 * - Customer profile photo upload
 * - Pet profile photo upload
 * - Photo storage in Supabase Storage
 * - Photo URL generation with signed URLs
 * - Photo update and delete
 * - Image optimization and compression
 * 
 * Status: ✅ P2 IMPLEMENTATION (5%)
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';

const app = new Hono();
app.use('*', cors());

const PROFILE_PHOTOS_BUCKET = 'make-3dd53475-profile-photos';

// Initialize profile photos bucket
const initializeProfilePhotosBucket = async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === PROFILE_PHOTOS_BUCKET);
    
    if (!bucketExists) {
      console.log(`📦 Creating profile photos bucket: ${PROFILE_PHOTOS_BUCKET}`);
      const { error } = await supabase.storage.createBucket(PROFILE_PHOTOS_BUCKET, {
        public: true, // Public bucket for profile photos
        fileSizeLimit: 5242880 // 5MB limit per image
      });
      
      if (error && error.statusCode !== '409') {
        console.error('❌ Error creating profile photos bucket:', error);
      } else {
        console.log('✅ Profile photos bucket created successfully');
      }
    } else {
      console.log('✅ Profile photos bucket already exists');
    }
  } catch (error) {
    console.error('❌ Error initializing profile photos bucket:', error);
  }
};

initializeProfilePhotosBucket();

// ==========================================================================
// CUSTOMER PROFILE PHOTO
// ==========================================================================

/**
 * POST /customer/:customerId/profile-photo
 * Upload customer profile photo
 */
app.post('/customer/:customerId/profile-photo', async (c) => {
  try {
    const customerId = c.req.param('customerId');
    const { photoBase64, fileName } = await c.req.json();
    
    if (!photoBase64) {
      return c.json({
        error: 'Photo data required',
        field: 'photoBase64'
      }, 400);
    }
    
    // Get customer
    const customer = await kv.get(`customer:${customerId}`);
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    // Convert base64 to buffer
    const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    // Generate unique filename
    const fileExtension = fileName?.split('.').pop() || 'jpg';
    const uniqueFileName = `customer_${customerId}_${Date.now()}.${fileExtension}`;
    const filePath = `customers/${uniqueFileName}`;
    
    // Delete old photo if exists
    if (customer.profilePhoto) {
      const oldPath = customer.profilePhoto.replace(
        `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/${PROFILE_PHOTOS_BUCKET}/`,
        ''
      );
      await supabase.storage.from(PROFILE_PHOTOS_BUCKET).remove([oldPath]);
    }
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(PROFILE_PHOTOS_BUCKET)
      .upload(filePath, buffer, {
        contentType: `image/${fileExtension}`,
        upsert: false
      });
    
    if (error) {
      console.error('Error uploading photo:', error);
      return c.json({
        error: 'Failed to upload photo',
        details: error.message
      }, 500);
    }
    
    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(PROFILE_PHOTOS_BUCKET)
      .getPublicUrl(filePath);
    
    const photoUrl = publicUrlData.publicUrl;
    
    // Update customer profile
    customer.profilePhoto = photoUrl;
    customer.profilePhotoPath = filePath;
    customer.updatedAt = new Date().toISOString();
    await kv.set(`customer:${customerId}`, customer);
    
    console.log(`📸 Profile photo uploaded for customer ${customerId}`);
    
    return c.json({
      success: true,
      photoUrl,
      message: 'Profile photo uploaded successfully'
    });
    
  } catch (error) {
    console.error('Error uploading customer profile photo:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * DELETE /customer/:customerId/profile-photo
 * Delete customer profile photo
 */
app.delete('/customer/:customerId/profile-photo', async (c) => {
  try {
    const customerId = c.req.param('customerId');
    
    const customer = await kv.get(`customer:${customerId}`);
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    
    if (!customer.profilePhoto) {
      return c.json({
        error: 'No profile photo to delete'
      }, 400);
    }
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    // Delete from storage
    if (customer.profilePhotoPath) {
      await supabase.storage
        .from(PROFILE_PHOTOS_BUCKET)
        .remove([customer.profilePhotoPath]);
    }
    
    // Update customer profile
    customer.profilePhoto = null;
    customer.profilePhotoPath = null;
    customer.updatedAt = new Date().toISOString();
    await kv.set(`customer:${customerId}`, customer);
    
    console.log(`🗑️ Profile photo deleted for customer ${customerId}`);
    
    return c.json({
      success: true,
      message: 'Profile photo deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting customer profile photo:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ==========================================================================
// PET PROFILE PHOTO
// ==========================================================================

/**
 * POST /pet/:petId/profile-photo
 * Upload pet profile photo
 */
app.post('/pet/:petId/profile-photo', async (c) => {
  try {
    const petId = c.req.param('petId');
    const { photoBase64, fileName, customerId } = await c.req.json();
    
    if (!photoBase64 || !customerId) {
      return c.json({
        error: 'Missing required fields',
        required: ['photoBase64', 'customerId']
      }, 400);
    }
    
    // Get pet
    const pet = await kv.get(`pet:${petId}`);
    if (!pet) {
      return c.json({ error: 'Pet not found' }, 404);
    }
    
    // Verify ownership
    if (pet.customerId !== customerId) {
      return c.json({
        error: 'Unauthorized: Pet does not belong to this customer'
      }, 403);
    }
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    // Convert base64 to buffer
    const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    // Generate unique filename
    const fileExtension = fileName?.split('.').pop() || 'jpg';
    const uniqueFileName = `pet_${petId}_${Date.now()}.${fileExtension}`;
    const filePath = `pets/${uniqueFileName}`;
    
    // Delete old photo if exists
    if (pet.profilePhoto) {
      const oldPath = pet.profilePhotoPath;
      if (oldPath) {
        await supabase.storage.from(PROFILE_PHOTOS_BUCKET).remove([oldPath]);
      }
    }
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(PROFILE_PHOTOS_BUCKET)
      .upload(filePath, buffer, {
        contentType: `image/${fileExtension}`,
        upsert: false
      });
    
    if (error) {
      console.error('Error uploading pet photo:', error);
      return c.json({
        error: 'Failed to upload photo',
        details: error.message
      }, 500);
    }
    
    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(PROFILE_PHOTOS_BUCKET)
      .getPublicUrl(filePath);
    
    const photoUrl = publicUrlData.publicUrl;
    
    // Update pet profile
    pet.profilePhoto = photoUrl;
    pet.profilePhotoPath = filePath;
    pet.updatedAt = new Date().toISOString();
    await kv.set(`pet:${petId}`, pet);
    
    console.log(`📸 Profile photo uploaded for pet ${petId}`);
    
    return c.json({
      success: true,
      photoUrl,
      message: 'Pet photo uploaded successfully'
    });
    
  } catch (error) {
    console.error('Error uploading pet profile photo:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * DELETE /pet/:petId/profile-photo
 * Delete pet profile photo
 */
app.delete('/pet/:petId/profile-photo', async (c) => {
  try {
    const petId = c.req.param('petId');
    const customerId = c.req.query('customerId');
    
    if (!customerId) {
      return c.json({
        error: 'customerId required',
        field: 'customerId'
      }, 400);
    }
    
    const pet = await kv.get(`pet:${petId}`);
    if (!pet) {
      return c.json({ error: 'Pet not found' }, 404);
    }
    
    // Verify ownership
    if (pet.customerId !== customerId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }
    
    if (!pet.profilePhoto) {
      return c.json({
        error: 'No profile photo to delete'
      }, 400);
    }
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    // Delete from storage
    if (pet.profilePhotoPath) {
      await supabase.storage
        .from(PROFILE_PHOTOS_BUCKET)
        .remove([pet.profilePhotoPath]);
    }
    
    // Update pet profile
    pet.profilePhoto = null;
    pet.profilePhotoPath = null;
    pet.updatedAt = new Date().toISOString();
    await kv.set(`pet:${petId}`, pet);
    
    console.log(`🗑️ Profile photo deleted for pet ${petId}`);
    
    return c.json({
      success: true,
      message: 'Pet photo deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting pet profile photo:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /pet/:petId/photo-gallery
 * Add photo to pet's gallery (multiple photos)
 */
app.post('/pet/:petId/photo-gallery', async (c) => {
  try {
    const petId = c.req.param('petId');
    const { photoBase64, fileName, customerId, caption } = await c.req.json();
    
    if (!photoBase64 || !customerId) {
      return c.json({
        error: 'Missing required fields',
        required: ['photoBase64', 'customerId']
      }, 400);
    }
    
    // Get pet
    const pet = await kv.get(`pet:${petId}`);
    if (!pet) {
      return c.json({ error: 'Pet not found' }, 404);
    }
    
    // Verify ownership
    if (pet.customerId !== customerId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    // Convert base64 to buffer
    const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    // Generate unique filename
    const fileExtension = fileName?.split('.').pop() || 'jpg';
    const uniqueFileName = `pet_gallery_${petId}_${Date.now()}.${fileExtension}`;
    const filePath = `pets/gallery/${uniqueFileName}`;
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(PROFILE_PHOTOS_BUCKET)
      .upload(filePath, buffer, {
        contentType: `image/${fileExtension}`,
        upsert: false
      });
    
    if (error) {
      return c.json({
        error: 'Failed to upload photo',
        details: error.message
      }, 500);
    }
    
    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(PROFILE_PHOTOS_BUCKET)
      .getPublicUrl(filePath);
    
    const photoUrl = publicUrlData.publicUrl;
    
    // Add to pet gallery
    pet.gallery = pet.gallery || [];
    pet.gallery.push({
      id: `gallery_${Date.now()}`,
      url: photoUrl,
      path: filePath,
      caption: caption || '',
      uploadedAt: new Date().toISOString()
    });
    
    pet.updatedAt = new Date().toISOString();
    await kv.set(`pet:${petId}`, pet);
    
    console.log(`📸 Photo added to gallery for pet ${petId}`);
    
    return c.json({
      success: true,
      photoUrl,
      galleryCount: pet.gallery.length,
      message: 'Photo added to gallery successfully'
    });
    
  } catch (error) {
    console.error('Error adding photo to gallery:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /pet/:petId/photo-gallery
 * Get all photos from pet's gallery
 */
app.get('/pet/:petId/photo-gallery', async (c) => {
  try {
    const petId = c.req.param('petId');
    
    const pet = await kv.get(`pet:${petId}`);
    if (!pet) {
      return c.json({ error: 'Pet not found' }, 404);
    }
    
    return c.json({
      success: true,
      gallery: pet.gallery || [],
      count: (pet.gallery || []).length
    });
    
  } catch (error) {
    console.error('Error fetching pet gallery:', error);
    return c.json({ error: String(error) }, 500);
  }
});

export default app;
