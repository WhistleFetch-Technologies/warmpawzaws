/**
 * ============================================================================
 * PROFILE PHOTO MANAGEMENT - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Customer profile photo upload/delete
 * - Pet profile photo upload/delete
 * - Photo gallery management for pets
 * - Supabase Storage integration
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()` with SQL queries
 * - Uses `customers` table (preferences JSONB for photo URL)
 * - Uses `pets` table (profile_photo_url field)
 * - Uses `CustomersRepository` and `PetsRepository`
 * 
 * Date: 2025-01-28
 * Migration: Batch 13 - KV to SQL (11 KV operations removed)
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { getCustomersRepository } from '../../lib/repositories/customers.ts';
import { getPetsRepository } from '../../lib/repositories/pets.ts';

const PROFILE_PHOTOS_BUCKET = 'make-3dd53475-profile-photos';

export function registerProfilePhotoEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  
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
      const currentPhotoUrl = customer.preferences?.profile_photo_url;
      if (currentPhotoUrl) {
        try {
          const oldPath = currentPhotoUrl.split('/').pop() || '';
          await supabase.storage.from(PROFILE_PHOTOS_BUCKET).remove([`customers/${oldPath}`]);
        } catch (e) {
          console.warn('Could not delete old photo:', e);
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
      
      // ✅ SQL: Update customer profile
      const updatedPreferences = {
        ...(customer.preferences || {}),
        profile_photo_url: photoUrl,
        profile_photo_path: filePath
      };
      
      await customersRepo.update(customerId, {
        preferences: updatedPreferences
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
      
      const currentPhotoUrl = customer.preferences?.profile_photo_url;
      if (!currentPhotoUrl) {
        return c.json({
          error: 'No profile photo to delete'
        }, 400);
      }
      
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      
      // Delete from storage
      const photoPath = customer.preferences?.profile_photo_path;
      if (photoPath) {
        await supabase.storage
          .from(PROFILE_PHOTOS_BUCKET)
          .remove([photoPath]);
      }
      
      // ✅ SQL: Update customer profile
      const updatedPreferences = {
        ...(customer.preferences || {}),
        profile_photo_url: null,
        profile_photo_path: null
      };
      
      await customersRepo.update(customerId, {
        preferences: updatedPreferences
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
      if (pet.customer_id !== customerId) {
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
      if (pet.photo_url) {
        try {
          const oldPath = pet.photo_url.split('/').pop() || '';
          await supabase.storage.from(PROFILE_PHOTOS_BUCKET).remove([`pets/${oldPath}`]);
        } catch (e) {
          console.warn('Could not delete old photo:', e);
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
      
      // ✅ SQL: Update pet profile
      await petsRepo.update(petId, {
        photo_url: photoUrl
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
      if (pet.customer_id !== customerId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      
      if (!pet.photo_url) {
        return c.json({
          error: 'No profile photo to delete'
        }, 400);
      }
      
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      
      // Delete from storage
      try {
        const photoPath = pet.photo_url.split('/').pop() || '';
        await supabase.storage
          .from(PROFILE_PHOTOS_BUCKET)
          .remove([`pets/${photoPath}`]);
      } catch (e) {
        console.warn('Could not delete photo from storage:', e);
      }
      
      // ✅ SQL: Update pet profile
      await petsRepo.update(petId, {
        photo_url: null
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
}

export default registerProfilePhotoEndpoints;

