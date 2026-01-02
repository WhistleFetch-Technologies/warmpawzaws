// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
// ✅ S3 MIGRATION: Supabase Storage replaced with AWS S3
import { Hono } from "hono";
import { generateId } from './database-schema';
import { getS3Helper, uploadToS3 } from '../../../supabase/lib/storage/s3-helper';
import { getVendorsRepository, getBoardingRoomsRepository } from '../../../supabase/lib/repositories/index';
import { getDbClient } from '../../../supabase/lib/db';

/**
 * BOARDING & RESORT ROOM MANAGEMENT
 * Production-ready endpoints for managing boarding rooms/kennels
 * 
 * Features:
 * - Room type CRUD
 * - Day/Night pricing
 * - Amenities configuration
 * - What's included/not included
 * - Photo & video storage (Supabase Storage)
 * - Availability management
 */

export function registerBoardingRoomManagement(app: Hono) {
  const BASE = '/make-server-3dd53475';

  // S3 bucket is configured via PlatformSettingsRepository

  // =============================================
  // GET ALL ROOM TYPES FOR A VENDOR
  // =============================================
  app.get(`${BASE}/vendor/:vendorId/boarding/rooms`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      console.log(`[BOARDING] Fetching rooms for vendor: ${vendorId}`);

      // ✅ SQL: Verify vendor
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // ✅ SQL: Get all room types
      const boardingRoomsRepo = getBoardingRoomsRepository();
      const rooms = await boardingRoomsRepo.findByVendor(vendorId);

      // ✅ S3: Refresh signed URLs for photos/videos (1 hour expiry)
      const s3 = getS3Helper();
      const roomsWithUrls = await Promise.all(rooms.map(async (room: any) => {
        const refreshedPhotos = await Promise.all(
          (room.photos || []).map(async (path: string) => {
            try {
              const signedUrl = await s3.getSignedUrl(path, 3600);
              return signedUrl;
            } catch (err) {
              console.warn('Warning: Could not get signed URL for photo', path);
              return path;
            }
          })
        );

        const refreshedVideos = await Promise.all(
          (room.videos || []).map(async (path: string) => {
            try {
              const signedUrl = await s3.getSignedUrl(path, 3600);
              return signedUrl;
            } catch (err) {
              console.warn('Warning: Could not get signed URL for video', path);
              return path;
            }
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
          businessName: vendor.businessName
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
      const boardingRoomsRepo = getBoardingRoomsRepository();
      const existingRooms = await boardingRoomsRepo.findByVendor(vendorId);
      const duplicate = existingRooms.find((r: any) => 
        r.name?.toLowerCase() === body.name.toLowerCase()
      );

      if (duplicate) {
        return c.json({ 
          error: 'A room with this name already exists' 
        }, 400);
      }

      // ✅ SQL: Create new room
      const roomId = generateId('room');
      const newRoom = await boardingRoomsRepo.create({
        id: roomId,
        vendor_id: vendorId,
        name: body.name,
        description: body.description || '',
        day_price: parseFloat(body.dayPrice),
        night_price: parseFloat(body.nightPrice),
        capacity: body.capacity || 1,
        pet_types: body.petTypes || ['dog', 'cat'],
        amenities: body.amenities || [],
        included: body.included || [],
        not_included: body.notIncluded || [],
        photos: body.photos || [],
        videos: body.videos || [],
        size: body.size || '',
        features: body.features || '',
        rules: body.rules || '',
        is_active: body.isActive !== undefined ? body.isActive : true,
        total_units: body.totalUnits || 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      console.log(`✅ [BOARDING] Created room: ${roomId}`);

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

      // ✅ SQL: Update room
      const boardingRoomsRepo = getBoardingRoomsRepository();
      const existingRoom = await boardingRoomsRepo.findById(roomId);

      if (!existingRoom) {
        return c.json({ error: 'Room not found' }, 404);
      }

      const updatedRoom = await boardingRoomsRepo.update(roomId, {
        name: body.name || existingRoom.name,
        description: body.description !== undefined ? body.description : existingRoom.description,
        day_price: body.dayPrice !== undefined ? parseFloat(body.dayPrice) : existingRoom.day_price,
        night_price: body.nightPrice !== undefined ? parseFloat(body.nightPrice) : existingRoom.night_price,
        capacity: body.capacity !== undefined ? body.capacity : existingRoom.capacity,
        pet_types: body.petTypes !== undefined ? body.petTypes : existingRoom.pet_types,
        amenities: body.amenities !== undefined ? body.amenities : existingRoom.amenities,
        included: body.included !== undefined ? body.included : existingRoom.included,
        not_included: body.notIncluded !== undefined ? body.notIncluded : existingRoom.not_included,
        photos: body.photos !== undefined ? body.photos : existingRoom.photos,
        videos: body.videos !== undefined ? body.videos : existingRoom.videos,
        size: body.size !== undefined ? body.size : existingRoom.size,
        features: body.features !== undefined ? body.features : existingRoom.features,
        rules: body.rules !== undefined ? body.rules : existingRoom.rules,
        is_active: body.isActive !== undefined ? body.isActive : existingRoom.is_active,
        total_units: body.totalUnits !== undefined ? body.totalUnits : existingRoom.total_units,
        updated_at: new Date().toISOString()
      });

      console.log(`✅ [BOARDING] Updated room: ${roomId}`);

      return c.json({
        success: true,
        room: updatedRoom,
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
      const boardingRoomsRepo = getBoardingRoomsRepository();
      const room = await boardingRoomsRepo.findById(roomId);

      if (!room) {
        return c.json({ error: 'Room not found' }, 404);
      }

      // ✅ S3: Delete photos and videos from storage
      const s3 = getS3Helper();
      for (const photoPath of room.photos || []) {
        try {
          await s3.deleteFile(photoPath);
        } catch (err) {
          console.warn('Warning: Could not delete photo', photoPath);
        }
      }

      for (const videoPath of room.videos || []) {
        try {
          await s3.deleteFile(videoPath);
        } catch (err) {
          console.warn('Warning: Could not delete video', videoPath);
        }
      }

      // ✅ SQL: Delete room
      await boardingRoomsRepo.delete(roomId);

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

      // ✅ S3: Generate storage path and upload
      const fileExt = file.name.split('.').pop() || (isPhoto ? 'jpg' : 'mp4');
      const s3Key = `boarding/${vendorId}/${roomId}/${Date.now()}.${fileExt}`;

      // ✅ S3: Upload to S3
      const s3 = getS3Helper();
      const uploadResult = await uploadToS3(
        file,
        `boarding/${vendorId}/${roomId}`,
        `${Date.now()}.${fileExt}`,
        {
          contentType: file.type,
          acl: 'private',
        }
      );

      // ✅ SQL: Update room record
      const boardingRoomsRepo = getBoardingRoomsRepository();
      const room = await boardingRoomsRepo.findById(roomId);

      if (!room) {
        return c.json({ error: 'Room not found' }, 404);
      }

      const updatedPhotos = isPhoto ? [...(room.photos || []), s3Key] : room.photos;
      const updatedVideos = isVideo ? [...(room.videos || []), s3Key] : room.videos;

      await boardingRoomsRepo.update(roomId, {
        photos: updatedPhotos,
        videos: updatedVideos,
        updated_at: new Date().toISOString()
      });

      console.log(`✅ [BOARDING] Uploaded ${mediaType}: ${s3Key}`);

      return c.json({
        success: true,
        filePath: s3Key,
        key: s3Key,
        url: uploadResult.signedUrl || uploadResult.url,
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

      // ✅ S3: Delete from storage
      const s3 = getS3Helper();
      try {
        await s3.deleteFile(filePath);
      } catch (err) {
        console.warn('Warning: Could not delete file', filePath);
      }

      // ✅ SQL: Update room record
      const boardingRoomsRepo = getBoardingRoomsRepository();
      const room = await boardingRoomsRepo.findById(roomId);

      if (!room) {
        return c.json({ error: 'Room not found' }, 404);
      }

      const updatedPhotos = mediaType === 'photo' 
        ? (room.photos || []).filter((p: string) => p !== filePath)
        : room.photos;
      const updatedVideos = mediaType === 'video'
        ? (room.videos || []).filter((v: string) => v !== filePath)
        : room.videos;

      await boardingRoomsRepo.update(roomId, {
        photos: updatedPhotos,
        videos: updatedVideos,
        updated_at: new Date().toISOString()
      });

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
      const boardingRoomsRepo = getBoardingRoomsRepository();
      const allRooms = await boardingRoomsRepo.findByVendor(vendorId);
      
      // Filter only active rooms
      const activeRooms = allRooms.filter((r: any) => r.is_active !== false);

      // ✅ S3: Refresh URLs
      const s3 = getS3Helper();
      const roomsWithUrls = await Promise.all(activeRooms.map(async (room: any) => {
        const photoUrls = await Promise.all(
          (room.photos || []).map(async (path: string) => {
            try {
              const signedUrl = await s3.getSignedUrl(path, 3600);
              return signedUrl;
            } catch (err) {
              return null;
            }
          })
        );

        const videoUrls = await Promise.all(
          (room.videos || []).map(async (path: string) => {
            try {
              const signedUrl = await s3.getSignedUrl(path, 3600);
              return signedUrl;
            } catch (err) {
              return null;
            }
          })
        );

        return {
          id: room.id,
          name: room.name,
          description: room.description,
          dayPrice: room.day_price || room.dayPrice,
          nightPrice: room.night_price || room.nightPrice,
          capacity: room.capacity,
          petTypes: room.pet_types || room.petTypes,
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
}
