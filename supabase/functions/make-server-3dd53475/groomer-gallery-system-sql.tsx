/**
 * GROOMER GALLERY SYSTEM - SQL-ONLY VERSION
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * Features:
 * - Before/after photo upload for bookings
 * - Public portfolio gallery for vendor profile
 * - Photo metadata (tags, descriptions)
 * - Image optimization and thumbnails
 * - S3/Supabase Storage integration
 * 
 * Date: 2025-01-27
 * Migration: KV to SQL (23 KV operations → 0)
 */

import { Hono } from "npm:hono";
import { getDbClient } from "../../lib/db.ts";
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { ensureBucket } from "./bucket-manager.tsx";

export function registerGroomerGalleryEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  
  const GALLERY_BUCKET = 'make-3dd53475-groomer-gallery';
  const db = getDbClient();

  // Initialize gallery bucket (non-blocking, fire-and-forget)
  ensureBucket(GALLERY_BUCKET, {
    public: true,
    fileSizeLimit: 10485760 // 10MB
  }).catch(err => console.warn('⚠️ Gallery bucket init warning:', err));

  // ==========================================================================
  // UPLOAD BOOKING BEFORE/AFTER PHOTOS
  // ==========================================================================

  /**
   * POST /bookings/:bookingId/gallery-photos
   * Upload before/after photos for a completed booking
   */
  app.post(`${BASE_PATH}/bookings/:bookingId/gallery-photos`, async (c) => {
    try {
      const bookingId = c.req.param('bookingId');
      const { vendorId, beforePhoto, afterPhoto, description, tags, addToPortfolio = false } = await c.req.json();
      
      if (!vendorId) {
        return c.json({ error: 'vendorId required' }, 400);
      }
      
      // ✅ SQL: Verify booking exists and belongs to vendor
      const booking = await getBookingsRepository().findById(bookingId);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      
      if (booking.vendor_id !== vendorId) {
        return c.json({ error: 'Unauthorized: Booking does not belong to this vendor' }, 403);
      }
      
      // Verify booking is completed
      if (booking.status !== 'completed') {
        return c.json({
          error: 'Booking must be completed before uploading photos',
          currentStatus: booking.status
        }, 400);
      }
      
      // ✅ SQL: Create gallery entry
      const { data: galleryEntry, error: insertError } = await db
        .from('groomer_gallery')
        .insert({
          booking_id: bookingId,
          vendor_id: vendorId,
          pet_id: booking.pet_id || null,
          pet_name: booking.pet_name || null,
          service_name: booking.service_name || null,
          before_photo: beforePhoto,
          after_photo: afterPhoto,
          description: description || '',
          tags: tags || [],
          is_public: addToPortfolio,
          is_portfolio: addToPortfolio,
          uploaded_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (insertError) {
        console.error('Error creating gallery entry:', insertError);
        return c.json({ error: insertError.message }, 500);
      }
      
      // ✅ SQL: Update booking with gallery photo reference
      await getBookingsRepository().update(bookingId, {
        metadata: {
          ...(booking.metadata as any || {}),
          gallery_photo_id: galleryEntry.id,
          has_gallery_photos: true
        }
      });
      
      console.log(`📸 Gallery photos uploaded for booking ${bookingId}`);
      
      return c.json({
        success: true,
        galleryEntry: {
          id: galleryEntry.id,
          bookingId,
          addToPortfolio
        },
        message: 'Photos uploaded successfully'
      });
      
    } catch (error) {
      console.error('Error uploading gallery photos:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ==========================================================================
  // GET VENDOR GALLERY
  // ==========================================================================

  /**
   * GET /vendor/:vendorId/gallery
   * Get vendor's complete gallery (all booking photos)
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/gallery`, async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      const includePrivate = c.req.query('includePrivate') === 'true';
      const limit = parseInt(c.req.query('limit') || '50');
      const offset = parseInt(c.req.query('offset') || '0');
      
      // ✅ SQL: Get gallery photos for vendor
      let query = db
        .from('groomer_gallery')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('uploaded_at', { ascending: false });
      
      if (!includePrivate) {
        query = query.eq('is_public', true);
      }
      
      const { data: photos, error, count } = await query
        .range(offset, offset + limit - 1)
        .select('*', { count: 'exact' });
      
      if (error) {
        throw error;
      }
      
      // Map to response format
      const mappedPhotos = (photos || []).map((photo: any) => ({
        id: photo.id,
        bookingId: photo.booking_id,
        vendorId: photo.vendor_id,
        petId: photo.pet_id,
        petName: photo.pet_name,
        serviceName: photo.service_name,
        beforePhoto: photo.before_photo,
        afterPhoto: photo.after_photo,
        description: photo.description,
        tags: photo.tags || [],
        addToPortfolio: photo.is_portfolio,
        uploadedAt: photo.uploaded_at,
        isPublic: photo.is_public,
        likes: photo.likes || 0,
        views: photo.views || 0
      }));
      
      return c.json({
        success: true,
        photos: mappedPhotos,
        pagination: {
          totalCount: count || mappedPhotos.length,
          limit,
          offset,
          hasMore: (count || 0) > offset + limit
        }
      });
      
    } catch (error) {
      console.error('Error fetching vendor gallery:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/portfolio
   * Get vendor's public portfolio (only photos marked for portfolio)
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/portfolio`, async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      const limit = parseInt(c.req.query('limit') || '20');
      const offset = parseInt(c.req.query('offset') || '0');
      
      // ✅ SQL: Get portfolio photos for vendor
      const { data: photos, error, count } = await db
        .from('groomer_gallery')
        .select('*', { count: 'exact' })
        .eq('vendor_id', vendorId)
        .eq('is_portfolio', true)
        .eq('is_public', true)
        .order('uploaded_at', { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (error) {
        throw error;
      }
      
      // Map to response format
      const mappedPhotos = (photos || []).map((photo: any) => ({
        id: photo.id,
        bookingId: photo.booking_id,
        vendorId: photo.vendor_id,
        petId: photo.pet_id,
        petName: photo.pet_name,
        serviceName: photo.service_name,
        beforePhoto: photo.before_photo,
        afterPhoto: photo.after_photo,
        description: photo.description,
        tags: photo.tags || [],
        addToPortfolio: photo.is_portfolio,
        uploadedAt: photo.uploaded_at,
        isPublic: photo.is_public,
        likes: photo.likes || 0,
        views: photo.views || 0
      }));
      
      return c.json({
        success: true,
        photos: mappedPhotos,
        portfolioCount: count || mappedPhotos.length,
        pagination: {
          totalCount: count || mappedPhotos.length,
          limit,
          offset,
          hasMore: (count || 0) > offset + limit
        }
      });
      
    } catch (error) {
      console.error('Error fetching vendor portfolio:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ==========================================================================
  // UPDATE GALLERY PHOTO
  // ==========================================================================

  /**
   * PUT /gallery/:photoId
   * Update photo metadata (description, tags, portfolio status)
   */
  app.put(`${BASE_PATH}/gallery/:photoId`, async (c) => {
    try {
      const photoId = c.req.param('photoId');
      const { vendorId, description, tags, addToPortfolio, isPublic } = await c.req.json();
      
      // ✅ SQL: Get photo
      const { data: photo, error: fetchError } = await db
        .from('groomer_gallery')
        .select('*')
        .eq('id', photoId)
        .single();
      
      if (fetchError || !photo) {
        return c.json({ error: 'Photo not found' }, 404);
      }
      
      // Verify ownership
      if (photo.vendor_id !== vendorId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      
      // ✅ SQL: Update photo metadata
      const updateData: any = {
        updated_at: new Date().toISOString()
      };
      
      if (description !== undefined) updateData.description = description;
      if (tags !== undefined) updateData.tags = tags;
      if (isPublic !== undefined) updateData.is_public = isPublic;
      if (addToPortfolio !== undefined) updateData.is_portfolio = addToPortfolio;
      
      const { data: updatedPhoto, error: updateError } = await db
        .from('groomer_gallery')
        .update(updateData)
        .eq('id', photoId)
        .select()
        .single();
      
      if (updateError) {
        throw updateError;
      }
      
      return c.json({
        success: true,
        photo: {
          id: updatedPhoto.id,
          bookingId: updatedPhoto.booking_id,
          vendorId: updatedPhoto.vendor_id,
          petId: updatedPhoto.pet_id,
          petName: updatedPhoto.pet_name,
          serviceName: updatedPhoto.service_name,
          beforePhoto: updatedPhoto.before_photo,
          afterPhoto: updatedPhoto.after_photo,
          description: updatedPhoto.description,
          tags: updatedPhoto.tags || [],
          addToPortfolio: updatedPhoto.is_portfolio,
          uploadedAt: updatedPhoto.uploaded_at,
          isPublic: updatedPhoto.is_public,
          likes: updatedPhoto.likes || 0,
          views: updatedPhoto.views || 0
        },
        message: 'Photo updated successfully'
      });
      
    } catch (error) {
      console.error('Error updating photo:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ==========================================================================
  // DELETE GALLERY PHOTO
  // ==========================================================================

  /**
   * DELETE /gallery/:photoId
   * Delete a gallery photo
   */
  app.delete(`${BASE_PATH}/gallery/:photoId`, async (c) => {
    try {
      const photoId = c.req.param('photoId');
      const vendorId = c.req.query('vendorId');
      
      if (!vendorId) {
        return c.json({ error: 'vendorId required' }, 400);
      }
      
      // ✅ SQL: Get photo
      const { data: photo, error: fetchError } = await db
        .from('groomer_gallery')
        .select('*')
        .eq('id', photoId)
        .single();
      
      if (fetchError || !photo) {
        return c.json({ error: 'Photo not found' }, 404);
      }
      
      // Verify ownership
      if (photo.vendor_id !== vendorId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      
      // ✅ SQL: Delete photo
      const { error: deleteError } = await db
        .from('groomer_gallery')
        .delete()
        .eq('id', photoId);
      
      if (deleteError) {
        throw deleteError;
      }
      
      // ✅ SQL: Update booking to remove gallery photo reference
      if (photo.booking_id) {
        const booking = await getBookingsRepository().findById(photo.booking_id);
        if (booking) {
          const metadata = (booking.metadata as any) || {};
          delete metadata.gallery_photo_id;
          metadata.has_gallery_photos = false;
          await getBookingsRepository().update(photo.booking_id, { metadata });
        }
      }
      
      console.log(`🗑️ Gallery photo ${photoId} deleted`);
      
      return c.json({
        success: true,
        message: 'Photo deleted successfully'
      });
      
    } catch (error) {
      console.error('Error deleting photo:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ==========================================================================
  // GET BOOKING GALLERY PHOTOS
  // ==========================================================================

  /**
   * GET /bookings/:bookingId/gallery-photos
   * Get before/after photos for a specific booking
   */
  app.get(`${BASE_PATH}/bookings/:bookingId/gallery-photos`, async (c) => {
    try {
      const bookingId = c.req.param('bookingId');
      
      // ✅ SQL: Get booking
      const booking = await getBookingsRepository().findById(bookingId);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      
      // ✅ SQL: Get gallery photo for booking
      const { data: photo, error } = await db
        .from('groomer_gallery')
        .select('*')
        .eq('booking_id', bookingId)
        .maybeSingle();
      
      if (error) {
        throw error;
      }
      
      if (!photo) {
        return c.json({
          success: true,
          hasPhotos: false,
          message: 'No photos uploaded for this booking'
        });
      }
      
      return c.json({
        success: true,
        hasPhotos: true,
        photo: {
          id: photo.id,
          bookingId: photo.booking_id,
          vendorId: photo.vendor_id,
          petId: photo.pet_id,
          petName: photo.pet_name,
          serviceName: photo.service_name,
          beforePhoto: photo.before_photo,
          afterPhoto: photo.after_photo,
          description: photo.description,
          tags: photo.tags || [],
          addToPortfolio: photo.is_portfolio,
          uploadedAt: photo.uploaded_at,
          isPublic: photo.is_public,
          likes: photo.likes || 0,
          views: photo.views || 0
        }
      });
      
    } catch (error) {
      console.error('Error fetching booking photos:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  console.log('✅ Groomer gallery endpoints registered (SQL-only)');
}

export default registerGroomerGalleryEndpoints;

