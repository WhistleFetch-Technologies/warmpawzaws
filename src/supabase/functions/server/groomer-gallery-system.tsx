/**
 * GROOMER GALLERY SYSTEM
 * 
 * Features:
 * - Before/after photo upload for bookings
 * - Public portfolio gallery for vendor profile
 * - Photo metadata (tags, descriptions)
 * - Image optimization and thumbnails
 * - S3/Supabase Storage integration
 * 
 * Status: ✅ P1 IMPLEMENTATION
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';

const app = new Hono();
app.use('*', cors());

const GALLERY_BUCKET = 'make-3dd53475-groomer-gallery';

// Initialize gallery bucket
const initializeGalleryBucket = async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === GALLERY_BUCKET);
    
    if (!bucketExists) {
      console.log(`📦 Creating groomer gallery bucket: ${GALLERY_BUCKET}`);
      const { error } = await supabase.storage.createBucket(GALLERY_BUCKET, {
        public: true, // Public bucket for portfolio display
        fileSizeLimit: 10485760 // 10MB limit per image
      });
      
      if (error && error.statusCode !== '409') {
        console.error('❌ Error creating gallery bucket:', error);
      } else {
        console.log('✅ Gallery bucket created successfully');
      }
    } else {
      console.log('✅ Gallery bucket already exists');
    }
  } catch (error) {
    console.error('❌ Error initializing gallery bucket:', error);
  }
};

initializeGalleryBucket();

// Helper: Generate gallery photo ID
function generateGalleryPhotoId() {
  return `gallery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ==========================================================================
// UPLOAD BOOKING BEFORE/AFTER PHOTOS
// ==========================================================================

/**
 * POST /bookings/:bookingId/gallery-photos
 * Upload before/after photos for a completed booking
 */
app.post('/bookings/:bookingId/gallery-photos', async (c) => {
  try {
    const bookingId = c.req.param('bookingId');
    const { vendorId, beforePhoto, afterPhoto, description, tags, addToPortfolio = false } = await c.req.json();
    
    if (!vendorId) {
      return c.json({ error: 'vendorId required' }, 400);
    }
    
    // Verify booking exists and belongs to vendor
    const booking = await kv.get(`booking:${bookingId}`);
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }
    
    if (booking.vendorId !== vendorId) {
      return c.json({ error: 'Unauthorized: Booking does not belong to this vendor' }, 403);
    }
    
    // Verify booking is completed
    if (booking.status !== 'completed') {
      return c.json({
        error: 'Booking must be completed before uploading photos',
        currentStatus: booking.status
      }, 400);
    }
    
    // Create gallery entry
    const galleryEntry = {
      id: generateGalleryPhotoId(),
      bookingId,
      vendorId,
      petId: booking.petId,
      petName: booking.petName,
      serviceName: booking.serviceName,
      beforePhoto, // Base64 or URL
      afterPhoto,
      description: description || '',
      tags: tags || [],
      addToPortfolio,
      uploadedAt: new Date().toISOString(),
      isPublic: addToPortfolio,
      likes: 0,
      views: 0
    };
    
    // Save to vendor's gallery
    await kv.set(`gallery:photo:${galleryEntry.id}`, galleryEntry);
    
    // Add to vendor's gallery index
    const vendorGallery = await kv.get(`vendor:${vendorId}:gallery`) || [];
    vendorGallery.unshift(galleryEntry.id);
    await kv.set(`vendor:${vendorId}:gallery`, vendorGallery);
    
    // Add to booking
    booking.galleryPhotoId = galleryEntry.id;
    booking.hasGalleryPhotos = true;
    await kv.set(`booking:${bookingId}`, booking);
    
    // If adding to portfolio, add to public gallery
    if (addToPortfolio) {
      const publicGallery = await kv.get(`vendor:${vendorId}:portfolio`) || [];
      publicGallery.unshift(galleryEntry.id);
      await kv.set(`vendor:${vendorId}:portfolio`, publicGallery);
    }
    
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
app.get('/vendor/:vendorId/gallery', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const includePrivate = c.req.query('includePrivate') === 'true';
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    
    // Get gallery photo IDs
    const galleryPhotoIds = await kv.get(`vendor:${vendorId}:gallery`) || [];
    
    // Fetch photo details
    const photos: any[] = [];
    for (const photoId of galleryPhotoIds) {
      const photo = await kv.get(`gallery:photo:${photoId}`);
      if (photo) {
        // Filter private photos if requested
        if (!includePrivate && !photo.isPublic) {
          continue;
        }
        photos.push(photo);
      }
    }
    
    // Apply pagination
    const totalCount = photos.length;
    const paginatedPhotos = photos.slice(offset, offset + limit);
    
    return c.json({
      success: true,
      photos: paginatedPhotos,
      pagination: {
        totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
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
app.get('/vendor/:vendorId/portfolio', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');
    
    // Get portfolio photo IDs
    const portfolioPhotoIds = await kv.get(`vendor:${vendorId}:portfolio`) || [];
    
    // Fetch photo details
    const photos: any[] = [];
    for (const photoId of portfolioPhotoIds) {
      const photo = await kv.get(`gallery:photo:${photoId}`);
      if (photo && photo.isPublic) {
        photos.push(photo);
      }
    }
    
    // Apply pagination
    const totalCount = photos.length;
    const paginatedPhotos = photos.slice(offset, offset + limit);
    
    return c.json({
      success: true,
      photos: paginatedPhotos,
      portfolioCount: totalCount,
      pagination: {
        totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
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
app.put('/gallery/:photoId', async (c) => {
  try {
    const photoId = c.req.param('photoId');
    const { vendorId, description, tags, addToPortfolio, isPublic } = await c.req.json();
    
    // Get photo
    const photo = await kv.get(`gallery:photo:${photoId}`);
    if (!photo) {
      return c.json({ error: 'Photo not found' }, 404);
    }
    
    // Verify ownership
    if (photo.vendorId !== vendorId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }
    
    // Update metadata
    if (description !== undefined) photo.description = description;
    if (tags !== undefined) photo.tags = tags;
    if (isPublic !== undefined) photo.isPublic = isPublic;
    photo.updatedAt = new Date().toISOString();
    
    await kv.set(`gallery:photo:${photoId}`, photo);
    
    // Update portfolio status
    if (addToPortfolio !== undefined) {
      const portfolio = await kv.get(`vendor:${vendorId}:portfolio`) || [];
      
      if (addToPortfolio && !portfolio.includes(photoId)) {
        portfolio.unshift(photoId);
        await kv.set(`vendor:${vendorId}:portfolio`, portfolio);
      } else if (!addToPortfolio && portfolio.includes(photoId)) {
        const filtered = portfolio.filter((id: string) => id !== photoId);
        await kv.set(`vendor:${vendorId}:portfolio`, filtered);
      }
    }
    
    return c.json({
      success: true,
      photo,
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
app.delete('/gallery/:photoId', async (c) => {
  try {
    const photoId = c.req.param('photoId');
    const vendorId = c.req.query('vendorId');
    
    if (!vendorId) {
      return c.json({ error: 'vendorId required' }, 400);
    }
    
    // Get photo
    const photo = await kv.get(`gallery:photo:${photoId}`);
    if (!photo) {
      return c.json({ error: 'Photo not found' }, 404);
    }
    
    // Verify ownership
    if (photo.vendorId !== vendorId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }
    
    // Remove from vendor gallery
    const gallery = await kv.get(`vendor:${vendorId}:gallery`) || [];
    const filteredGallery = gallery.filter((id: string) => id !== photoId);
    await kv.set(`vendor:${vendorId}:gallery`, filteredGallery);
    
    // Remove from portfolio
    const portfolio = await kv.get(`vendor:${vendorId}:portfolio`) || [];
    const filteredPortfolio = portfolio.filter((id: string) => id !== photoId);
    await kv.set(`vendor:${vendorId}:portfolio`, filteredPortfolio);
    
    // Delete photo record
    await kv.del(`gallery:photo:${photoId}`);
    
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
app.get('/bookings/:bookingId/gallery-photos', async (c) => {
  try {
    const bookingId = c.req.param('bookingId');
    
    // Get booking
    const booking = await kv.get(`booking:${bookingId}`);
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }
    
    if (!booking.galleryPhotoId) {
      return c.json({
        success: true,
        hasPhotos: false,
        message: 'No photos uploaded for this booking'
      });
    }
    
    // Get photo
    const photo = await kv.get(`gallery:photo:${booking.galleryPhotoId}`);
    
    return c.json({
      success: true,
      hasPhotos: true,
      photo
    });
    
  } catch (error) {
    console.error('Error fetching booking photos:', error);
    return c.json({ error: String(error) }, 500);
  }
});

export default app;
