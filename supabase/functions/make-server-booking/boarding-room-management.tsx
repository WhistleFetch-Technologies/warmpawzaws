/**
 * ============================================================================
 * BOARDING ROOM MANAGEMENT - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Room type CRUD
 * - Day/Night pricing
 * - Amenities configuration
 * - What's included/not included
 * - Photo & video storage (Supabase Storage)
 * - Availability management
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ Storage operations use Supabase Storage (not KV)
 * ✅ Proper error handling
 * ✅ CRUD operations via repositories
 * 
 * Date: 2025-01-27
 * Migration: Phase 2 - Critical Flow Migration
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getBoardingRoomsRepository } from "../../lib/repositories/boarding-rooms.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";

export function registerBoardingRoomManagement(app: Hono) {
  const BASE = '/make-server-3dd53475';

  // Initialize Supabase client for storage
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Ensure boarding media bucket exists
  const BUCKET_NAME = 'make-3dd53475-boarding-media';
  
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

  // Initialize bucket on startup
  ensureBucket().catch(console.error);

  const boardingRepo = getBoardingRoomsRepository();
  const vendorsRepo = getVendorsRepository();

  // =============================================
  // GET ALL ROOM TYPES FOR A VENDOR
  // =============================================
  app.get(`${BASE}/vendor/:vendorId/boarding/rooms`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      console.log(`[BOARDING] Fetching rooms for vendor: ${vendorId}`);

      // ✅ SQL: Verify vendor
      const vendor = await vendorsRepo.findById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // ✅ SQL: Get all room types
      const rooms = await boardingRepo.findByVendor(vendorId);

      // Refresh signed URLs for photos/videos (1 hour expiry)
      const roomsWithUrls = await Promise.all(rooms.map(async (room: any) => {
        const refreshedPhotos = await Promise.all(
          (room.photos || []).map(async (path: string) => {
            const { data } = await supabase.storage
              .from(BUCKET_NAME)
              .createSignedUrl(path, 3600);
            return data?.signedUrl || path;
          })
        );

        const refreshedVideos = await Promise.all(
          (room.videos || []).map(async (path: string) => {
            const { data } = await supabase.storage
              .from(BUCKET_NAME)
              .createSignedUrl(path, 3600);
            return data?.signedUrl || path;
          })
        );

        return {
          ...room,
          photoUrls: refreshedPhotos,
          videoUrls: refreshedVideos
        };
      }));

      return c.json({
        success: true,
        rooms: roomsWithUrls,
        totalRooms: rooms.length,
        vendor: {
          id: vendor.id,
          businessName: vendor.business_name
        }
      });

    } catch (error) {
      console.error('[BOARDING] Error:', error);
      return c.json({ error: 'Failed to fetch rooms' }, 500);
    }
  });

  // =============================================
  // CREATE NEW ROOM TYPE
  // =============================================
  app.post(`${BASE}/vendor/:vendorId/boarding/rooms`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();

      console.log(`[BOARDING] Creating room for vendor: ${vendorId}`);

      // Validate required fields
      if (!body.name || !body.dayPrice || !body.nightPrice) {
        return c.json({ 
          error: 'Room name, day price, and night price are required' 
        }, 400);
      }

      // ✅ SQL: Check for duplicate name
      const existingRooms = await boardingRepo.findByVendor(vendorId);
      const duplicate = existingRooms.find((r: any) => 
        r.name.toLowerCase() === body.name.toLowerCase()
      );

      if (duplicate) {
        return c.json({ 
          error: 'A room with this name already exists' 
        }, 400);
      }

      // ✅ SQL: Create new room
      const newRoom = await boardingRepo.create({
        vendorId,
        name: body.name,
        description: body.description || '',
        dayPrice: parseFloat(body.dayPrice),
        nightPrice: parseFloat(body.nightPrice),
        capacity: body.capacity || 1,
        petTypes: body.petTypes || ['dog', 'cat'],
        amenities: body.amenities || [],
        included: body.included || [],
        notIncluded: body.notIncluded || [],
        photos: body.photos || [],
        videos: body.videos || [],
        size: body.size || '',
        features: body.features || '',
        rules: body.rules || '',
        isActive: body.isActive !== undefined ? body.isActive : true,
        totalUnits: body.totalUnits || 1,
      });

      console.log(`✅ [BOARDING] Created room: ${newRoom.id}`);

      return c.json({
        success: true,
        room: newRoom,
        message: 'Room created successfully'
      });

    } catch (error) {
      console.error('[BOARDING] Error:', error);
      return c.json({ error: 'Failed to create room' }, 500);
    }
  });

  // =============================================
  // UPDATE ROOM TYPE
  // =============================================
  app.put(`${BASE}/vendor/:vendorId/boarding/rooms/:roomId`, async (c) => {
    try {
      const { vendorId, roomId } = c.req.param();
      const body = await c.req.json();

      console.log(`[BOARDING] Updating room: ${roomId}`);

      // ✅ SQL: Get room
      const room = await boardingRepo.findById(roomId);

      if (!room) {
        return c.json({ error: 'Room not found' }, 404);
      }

      if (room.vendorId !== vendorId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }

      // ✅ SQL: Update room
      const updated = await boardingRepo.update(roomId, {
        name: body.name,
        description: body.description,
        dayPrice: body.dayPrice,
        nightPrice: body.nightPrice,
        capacity: body.capacity,
        petTypes: body.petTypes,
        amenities: body.amenities,
        included: body.included,
        notIncluded: body.notIncluded,
        photos: body.photos,
        videos: body.videos,
        size: body.size,
        features: body.features,
        rules: body.rules,
        isActive: body.isActive,
        totalUnits: body.totalUnits,
      });

      if (!updated) {
        return c.json({ error: 'Failed to update room' }, 500);
      }

      console.log(`✅ [BOARDING] Updated room: ${roomId}`);

      return c.json({
        success: true,
        room: updated,
        message: 'Room updated successfully'
      });

    } catch (error) {
      console.error('[BOARDING] Error:', error);
      return c.json({ error: 'Failed to update room' }, 500);
    }
  });

  // =============================================
  // DELETE ROOM TYPE
  // =============================================
  app.delete(`${BASE}/vendor/:vendorId/boarding/rooms/:roomId`, async (c) => {
    try {
      const { vendorId, roomId } = c.req.param();

      console.log(`[BOARDING] Deleting room: ${roomId}`);

      // ✅ SQL: Get room
      const room = await boardingRepo.findById(roomId);

      if (!room) {
        return c.json({ error: 'Room not found' }, 404);
      }

      if (room.vendorId !== vendorId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }

      // Delete photos from storage
      for (const photoPath of room.photos || []) {
        await supabase.storage.from(BUCKET_NAME).remove([photoPath]);
      }

      // Delete videos from storage
      for (const videoPath of room.videos || []) {
        await supabase.storage.from(BUCKET_NAME).remove([videoPath]);
      }

      // ✅ SQL: Soft delete room (set is_active to false)
      await boardingRepo.delete(roomId);

      console.log(`✅ [BOARDING] Deleted room: ${roomId}`);

      return c.json({
        success: true,
        message: 'Room deleted successfully'
      });

    } catch (error) {
      console.error('[BOARDING] Error:', error);
      return c.json({ error: 'Failed to delete room' }, 500);
    }
  });

  // =============================================
  // UPLOAD PHOTO/VIDEO
  // =============================================
  app.post(`${BASE}/vendor/:vendorId/boarding/rooms/:roomId/media`, async (c) => {
    try {
      const { vendorId, roomId } = c.req.param();
      const formData = await c.req.formData();
      const file = formData.get('file') as File;
      const mediaType = formData.get('type') as string; // 'photo' or 'video'

      if (!file) {
        return c.json({ error: 'No file provided' }, 400);
      }

      // Validate file type
      const isPhoto = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      if (!isPhoto && !isVideo) {
        return c.json({ error: 'Invalid file type' }, 400);
      }

      // Validate file size (50MB max)
      if (file.size > 52428800) {
        return c.json({ error: 'File size exceeds 50MB limit' }, 400);
      }

      // ✅ SQL: Get room
      const room = await boardingRepo.findById(roomId);

      if (!room) {
        return c.json({ error: 'Room not found' }, 404);
      }

      if (room.vendorId !== vendorId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }

      // Generate storage path
      const fileExt = file.name.split('.').pop();
      const fileName = `${vendorId}/${roomId}/${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const fileBuffer = await file.arrayBuffer();
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, fileBuffer, {
          contentType: file.type,
          upsert: false
        });

      if (error) {
        console.error('[BOARDING] Upload error:', error);
        return c.json({ error: 'Failed to upload file' }, 500);
      }

      // ✅ SQL: Update room with new media path
      const updatedPhotos = isPhoto ? [...(room.photos || []), fileName] : room.photos;
      const updatedVideos = isVideo ? [...(room.videos || []), fileName] : room.videos;

      const updated = await boardingRepo.update(roomId, {
        photos: updatedPhotos,
        videos: updatedVideos,
      });

      if (!updated) {
        return c.json({ error: 'Failed to update room' }, 500);
      }

      // Generate signed URL for immediate use
      const { data: urlData } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(fileName, 3600);

      console.log(`✅ [BOARDING] Uploaded ${mediaType}: ${fileName}`);

      return c.json({
        success: true,
        filePath: fileName,
        url: urlData?.signedUrl,
        message: 'File uploaded successfully'
      });

    } catch (error) {
      console.error('[BOARDING] Error:', error);
      return c.json({ error: 'Failed to upload file' }, 500);
    }
  });

  // =============================================
  // DELETE PHOTO/VIDEO
  // =============================================
  app.delete(`${BASE}/vendor/:vendorId/boarding/rooms/:roomId/media`, async (c) => {
    try {
      const { vendorId, roomId } = c.req.param();
      const { filePath, mediaType } = await c.req.json();

      if (!filePath || !mediaType) {
        return c.json({ error: 'File path and media type are required' }, 400);
      }

      // ✅ SQL: Get room
      const room = await boardingRepo.findById(roomId);

      if (!room) {
        return c.json({ error: 'Room not found' }, 404);
      }

      if (room.vendorId !== vendorId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }

      // Delete from storage
      await supabase.storage.from(BUCKET_NAME).remove([filePath]);

      // ✅ SQL: Update room to remove media path
      const updatedPhotos = mediaType === 'photo' 
        ? room.photos.filter((p: string) => p !== filePath)
        : room.photos;
      const updatedVideos = mediaType === 'video'
        ? room.videos.filter((v: string) => v !== filePath)
        : room.videos;

      const updated = await boardingRepo.update(roomId, {
        photos: updatedPhotos,
        videos: updatedVideos,
      });

      if (!updated) {
        return c.json({ error: 'Failed to update room' }, 500);
      }

      return c.json({
        success: true,
        message: 'File deleted successfully'
      });

    } catch (error) {
      console.error('[BOARDING] Error:', error);
      return c.json({ error: 'Failed to delete file' }, 500);
    }
  });

  // =============================================
  // GET CUSTOMER-FACING ROOMS (Public)
  // =============================================
  app.get(`${BASE}/public/vendor/:vendorId/boarding/rooms`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      // ✅ SQL: Get active rooms
      const rooms = await boardingRepo.findByVendor(vendorId, { isActive: true });
      
      // Refresh URLs
      const roomsWithUrls = await Promise.all(rooms.map(async (room: any) => {
        const photoUrls = await Promise.all(
          (room.photos || []).map(async (path: string) => {
            const { data } = await supabase.storage
              .from(BUCKET_NAME)
              .createSignedUrl(path, 3600);
            return data?.signedUrl || null;
          })
        );

        const videoUrls = await Promise.all(
          (room.videos || []).map(async (path: string) => {
            const { data } = await supabase.storage
              .from(BUCKET_NAME)
              .createSignedUrl(path, 3600);
            return data?.signedUrl || null;
          })
        );

        return {
          id: room.id,
          name: room.name,
          description: room.description,
          dayPrice: room.dayPrice,
          nightPrice: room.nightPrice,
          capacity: room.capacity,
          petTypes: room.petTypes,
          amenities: room.amenities,
          included: room.included,
          notIncluded: room.notIncluded,
          photoUrls: photoUrls.filter(Boolean),
          videoUrls: videoUrls.filter(Boolean),
          size: room.size,
          features: room.features,
          rules: room.rules,
          totalUnits: room.totalUnits
        };
      }));

      return c.json({
        success: true,
        rooms: roomsWithUrls
      });

    } catch (error) {
      console.error('[BOARDING] Error:', error);
      return c.json({ error: 'Failed to fetch rooms' }, 500);
    }
  });

  console.log('✅ Boarding Room Management (SQL) registered');
}

