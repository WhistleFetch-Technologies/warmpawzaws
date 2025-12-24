import { Hono } from "npm:hono";
import * as kv from './kv_store.tsx';
import { generateId } from './database-schema.tsx';
import { createClient } from 'npm:@supabase/supabase-js@2';

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

  // =============================================
  // GET ALL ROOM TYPES FOR A VENDOR
  // =============================================
  app.get(`${BASE}/vendor/:vendorId/boarding/rooms`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      console.log(`[BOARDING] Fetching rooms for vendor: ${vendorId}`);

      // Verify vendor
      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Get all room types
      const rooms = await kv.get(`vendor:${vendorId}:boarding_rooms`) || [];

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

      // Get existing rooms
      const rooms = await kv.get(`vendor:${vendorId}:boarding_rooms`) || [];

      // Check for duplicate name
      const duplicate = rooms.find((r: any) => 
        r.name.toLowerCase() === body.name.toLowerCase()
      );

      if (duplicate) {
        return c.json({ 
          error: 'A room with this name already exists' 
        }, 400);
      }

      // Create new room
      const roomId = generateId('room');
      const newRoom = {
        id: roomId,
        vendorId,
        name: body.name,
        description: body.description || '',
        
        // Pricing
        dayPrice: parseFloat(body.dayPrice),
        nightPrice: parseFloat(body.nightPrice),
        
        // Capacity
        capacity: body.capacity || 1,
        petTypes: body.petTypes || ['dog', 'cat'], // which pets allowed
        
        // Amenities
        amenities: body.amenities || [],
        
        // What's included/not included
        included: body.included || [],
        notIncluded: body.notIncluded || [],
        
        // Media (storage paths)
        photos: body.photos || [],
        videos: body.videos || [],
        
        // Additional info
        size: body.size || '', // e.g., "10ft x 8ft"
        features: body.features || '', // additional features
        rules: body.rules || '', // house rules
        
        // Availability
        isActive: body.isActive !== undefined ? body.isActive : true,
        totalUnits: body.totalUnits || 1, // how many of this room type exist
        
        // Metadata
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      rooms.push(newRoom);
      await kv.set(`vendor:${vendorId}:boarding_rooms`, rooms);

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

      const rooms = await kv.get(`vendor:${vendorId}:boarding_rooms`) || [];
      const index = rooms.findIndex((r: any) => r.id === roomId);

      if (index === -1) {
        return c.json({ error: 'Room not found' }, 404);
      }

      // Update room
      rooms[index] = {
        ...rooms[index],
        ...body,
        id: roomId, // prevent ID change
        vendorId, // prevent vendor change
        updatedAt: new Date().toISOString()
      };

      await kv.set(`vendor:${vendorId}:boarding_rooms`, rooms);

      console.log(`✅ [BOARDING] Updated room: ${roomId}`);

      return c.json({
        success: true,
        room: rooms[index],
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

      const rooms = await kv.get(`vendor:${vendorId}:boarding_rooms`) || [];
      const room = rooms.find((r: any) => r.id === roomId);

      if (!room) {
        return c.json({ error: 'Room not found' }, 404);
      }

      // Delete photos from storage
      for (const photoPath of room.photos || []) {
        await supabase.storage.from(BUCKET_NAME).remove([photoPath]);
      }

      // Delete videos from storage
      for (const videoPath of room.videos || []) {
        await supabase.storage.from(BUCKET_NAME).remove([videoPath]);
      }

      // Remove room from list
      const filtered = rooms.filter((r: any) => r.id !== roomId);
      await kv.set(`vendor:${vendorId}:boarding_rooms`, filtered);

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

      // Update room record
      const rooms = await kv.get(`vendor:${vendorId}:boarding_rooms`) || [];
      const index = rooms.findIndex((r: any) => r.id === roomId);

      if (index === -1) {
        return c.json({ error: 'Room not found' }, 404);
      }

      if (isPhoto) {
        rooms[index].photos = [...(rooms[index].photos || []), fileName];
      } else {
        rooms[index].videos = [...(rooms[index].videos || []), fileName];
      }

      rooms[index].updatedAt = new Date().toISOString();
      await kv.set(`vendor:${vendorId}:boarding_rooms`, rooms);

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

      // Delete from storage
      await supabase.storage.from(BUCKET_NAME).remove([filePath]);

      // Update room record
      const rooms = await kv.get(`vendor:${vendorId}:boarding_rooms`) || [];
      const index = rooms.findIndex((r: any) => r.id === roomId);

      if (index === -1) {
        return c.json({ error: 'Room not found' }, 404);
      }

      if (mediaType === 'photo') {
        rooms[index].photos = rooms[index].photos.filter((p: string) => p !== filePath);
      } else {
        rooms[index].videos = rooms[index].videos.filter((v: string) => v !== filePath);
      }

      rooms[index].updatedAt = new Date().toISOString();
      await kv.set(`vendor:${vendorId}:boarding_rooms`, rooms);

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

      const rooms = await kv.get(`vendor:${vendorId}:boarding_rooms`) || [];
      
      // Filter only active rooms
      const activeRooms = rooms.filter((r: any) => r.isActive);

      // Refresh URLs
      const roomsWithUrls = await Promise.all(activeRooms.map(async (room: any) => {
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
}
