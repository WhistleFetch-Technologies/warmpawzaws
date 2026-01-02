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

// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
// ✅ S3 MIGRATION: Supabase Storage replaced with AWS S3
import { Hono } from "hono";
import { getS3Helper, uploadToS3 } from '../../../supabase/lib/storage/s3-helper';
import {
  getCustomersRepository,
  getPetsRepository
} from '../../../supabase/lib/repositories/index';

export function registerProfilePhotoEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  
  // S3 bucket is configured via PlatformSettingsRepository
  
  // ==========================================================================
  // CUSTOMER PROFILE PHOTO
  // ==========================================================================

  /**
   * POST /customer/:customerId/profile-photo
   * Upload customer profile photo
   */
  app.post(`${BASE_PATH}/customer/:customerId/profile-photo`, async (c) => {
    try {
      const customerId = c.req.param('customerId');
      const { photoBase64, fileName } = await c.req.json();
      
      if (!photoBase64) {
        return c.json({
          error: 'Photo data required',
          field: 'photoBase64'
        }, 400);
      }
      
      // ✅ SQL: Get customer
      const customersRepo = getCustomersRepository();
      const customer = await customersRepo.findById(customerId);
      if (!customer) {
        return c.json({ error: 'Customer not found' }, 404);
      }
      
      // ✅ S3: Convert base64 to buffer
      const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      
      // Generate unique filename
      const fileExtension = fileName?.split('.').pop() || 'jpg';
      const uniqueFileName = `customer_${customerId}_${Date.now()}.${fileExtension}`;
      const s3Key = `profile-photos/customers/${uniqueFileName}`;
      
      // ✅ S3: Delete old photo if exists
      const oldPhotoPath = customer.profile_photo_path || customer.profilePhotoPath;
      if (oldPhotoPath) {
        const s3 = getS3Helper();
        try {
          await s3.deleteFile(oldPhotoPath);
        } catch (err) {
          console.warn('Warning: Could not delete old photo:', err);
        }
      }
      
      // ✅ S3: Upload to S3
      const s3 = getS3Helper();
      const uploadResult = await s3.uploadFile(s3Key, buffer, {
        contentType: `image/${fileExtension}`,
        acl: 'public-read', // Profile photos should be public
      });
      
      const photoUrl = uploadResult.signedUrl || uploadResult.url;
      
      // ✅ SQL: Update customer profile
      await customersRepo.update(customerId, {
        profile_photo_url: photoUrl,
        profile_photo_path: s3Key,
        updated_at: new Date().toISOString()
      });
      
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
  app.delete(`${BASE_PATH}/customer/:customerId/profile-photo`, async (c) => {
    try {
      const customerId = c.req.param('customerId');
      
      // ✅ SQL: Get customer
      const customersRepo = getCustomersRepository();
      const customer = await customersRepo.findById(customerId);
      if (!customer) {
        return c.json({ error: 'Customer not found' }, 404);
      }
      
      const photoPath = customer.profile_photo_path || customer.profilePhotoPath;
      if (!photoPath && !customer.profile_photo_url && !customer.profilePhoto) {
        return c.json({
          error: 'No profile photo to delete'
        }, 400);
      }
      
      // ✅ S3: Delete from S3
      if (photoPath) {
        const s3 = getS3Helper();
        try {
          await s3.deleteFile(photoPath);
        } catch (err) {
          console.warn('Warning: Could not delete customer photo from S3:', err);
        }
      }
      
      // ✅ SQL: Update customer profile
      await customersRepo.update(customerId, {
        profile_photo_url: null,
        profile_photo_path: null,
        updated_at: new Date().toISOString()
      });
      
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
  app.post(`${BASE_PATH}/pet/:petId/profile-photo`, async (c) => {
    try {
      const petId = c.req.param('petId');
      const { photoBase64, fileName, customerId } = await c.req.json();
      
      if (!photoBase64 || !customerId) {
        return c.json({
          error: 'Missing required fields',
          required: ['photoBase64', 'customerId']
        }, 400);
      }
      
      // ✅ SQL: Get pet
      const petsRepo = getPetsRepository();
      const pet = await petsRepo.findById(petId);
      if (!pet) {
        return c.json({ error: 'Pet not found' }, 404);
      }
      
      // Verify ownership
      const petCustomerId = pet.customer_id || pet.customerId;
      if (petCustomerId !== customerId) {
        return c.json({
          error: 'Unauthorized: Pet does not belong to this customer'
        }, 403);
      }
      
      // ✅ S3: Convert base64 to buffer
      const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      
      // Generate unique filename
      const fileExtension = fileName?.split('.').pop() || 'jpg';
      const uniqueFileName = `pet_${petId}_${Date.now()}.${fileExtension}`;
      const s3Key = `profile-photos/pets/${uniqueFileName}`;
      
      // ✅ S3: Delete old photo if exists
      const oldPetPhotoPath = pet.profile_photo_path || pet.profilePhotoPath;
      if (oldPetPhotoPath) {
        const s3 = getS3Helper();
        try {
          await s3.deleteFile(oldPetPhotoPath);
        } catch (err) {
          console.warn('Warning: Could not delete old pet photo:', err);
        }
      }
      
      // ✅ S3: Upload to S3
      const s3 = getS3Helper();
      const uploadResult = await s3.uploadFile(s3Key, buffer, {
        contentType: `image/${fileExtension}`,
        acl: 'public-read',
      });
      
      const photoUrl = uploadResult.signedUrl || uploadResult.url;
      
      // ✅ SQL: Update pet profile
      await petsRepo.update(petId, {
        profile_photo_url: photoUrl,
        profile_photo_path: s3Key,
        updated_at: new Date().toISOString()
      });
      
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
  app.delete(`${BASE_PATH}/pet/:petId/profile-photo`, async (c) => {
    try {
      const petId = c.req.param('petId');
      const customerId = c.req.query('customerId');
      
      if (!customerId) {
        return c.json({
          error: 'customerId required',
          field: 'customerId'
        }, 400);
      }
      
      // ✅ SQL: Get pet
      const petsRepo = getPetsRepository();
      const pet = await petsRepo.findById(petId);
      if (!pet) {
        return c.json({ error: 'Pet not found' }, 404);
      }
      
      // Verify ownership
      const petCustomerId = pet.customer_id || pet.customerId;
      if (petCustomerId !== customerId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      
      const photoPath = pet.profile_photo_path || pet.profilePhotoPath;
      if (!photoPath && !pet.profile_photo_url && !pet.profilePhoto) {
        return c.json({
          error: 'No profile photo to delete'
        }, 400);
      }
      
      // ✅ S3: Delete from S3
      if (photoPath) {
        const s3 = getS3Helper();
        try {
          await s3.deleteFile(photoPath);
        } catch (err) {
          console.warn('Warning: Could not delete pet photo from S3:', err);
        }
      }
      
      // ✅ SQL: Update pet profile
      await petsRepo.update(petId, {
        profile_photo_url: null,
        profile_photo_path: null,
        updated_at: new Date().toISOString()
      });
      
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
  app.post(`${BASE_PATH}/pet/:petId/photo-gallery`, async (c) => {
    try {
      const petId = c.req.param('petId');
      const { photoBase64, fileName, customerId, caption } = await c.req.json();
      
      if (!photoBase64 || !customerId) {
        return c.json({
          error: 'Missing required fields',
          required: ['photoBase64', 'customerId']
        }, 400);
      }
      
      // ✅ SQL: Get pet
      const petsRepo = getPetsRepository();
      const pet = await petsRepo.findById(petId);
      if (!pet) {
        return c.json({ error: 'Pet not found' }, 404);
      }
      
      // Verify ownership
      const petCustomerId = pet.customer_id || pet.customerId;
      if (petCustomerId !== customerId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      
      // ✅ S3: Convert base64 to buffer
      const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      
      // Generate unique filename
      const fileExtension = fileName?.split('.').pop() || 'jpg';
      const uniqueFileName = `pet_gallery_${petId}_${Date.now()}.${fileExtension}`;
      const s3Key = `profile-photos/pets/gallery/${uniqueFileName}`;
      
      // ✅ S3: Upload to S3
      const s3 = getS3Helper();
      const uploadResult = await s3.uploadFile(s3Key, buffer, {
        contentType: `image/${fileExtension}`,
        acl: 'public-read',
      });
      
      const photoUrl = uploadResult.signedUrl || uploadResult.url;
      
      // ✅ SQL: Add to pet gallery
      const currentGallery = pet.gallery || pet.photo_gallery || [];
      const updatedGallery = [
        ...currentGallery,
        {
          id: `gallery_${Date.now()}`,
          url: photoUrl,
          path: s3Key,
          caption: caption || '',
          uploadedAt: new Date().toISOString()
        }
      ];
      
      await petsRepo.update(petId, {
        photo_gallery: updatedGallery,
        gallery: updatedGallery, // Backward compatibility
        updated_at: new Date().toISOString()
      });
      
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
  app.get(`${BASE_PATH}/pet/:petId/photo-gallery`, async (c) => {
    try {
      const petId = c.req.param('petId');
      
      // ✅ SQL: Get pet
      const petsRepo = getPetsRepository();
      const pet = await petsRepo.findById(petId);
      if (!pet) {
        return c.json({ error: 'Pet not found' }, 404);
      }
      
      const gallery = pet.gallery || pet.photo_gallery || [];
      
      return c.json({
        success: true,
        gallery,
        count: gallery.length
      });
      
    } catch (error) {
      console.error('Error fetching pet gallery:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
}

export default registerProfilePhotoEndpoints;