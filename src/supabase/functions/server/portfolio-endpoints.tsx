/**
 * Portfolio Management Endpoints
 * Handles vendor portfolio (showcase work, past projects, achievements)
 */

// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from 'hono';
import { getDbClient } from '../../../supabase/lib/db';

const app = new Hono();

// Portfolio item structure
interface PortfolioItem {
  id: string;
  vendorId: string;
  title: string;
  description: string;
  category: string; // 'grooming', 'training', 'medical', 'event', etc.
  images: string[];
  tags: string[];
  petType?: string;
  petBreed?: string;
  completedDate: string;
  featured: boolean;
  clientTestimonial?: string;
  clientName?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /vendor/portfolio/:vendorId
 * Get all portfolio items for a vendor
 */
app.get('/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    
    // ✅ SQL: Get portfolio items from vendor_portfolio table
    const db = getDbClient();
    const { data: portfolioItemsData, error } = await db
      .from('vendor_portfolio')
      .select('*')
      .eq('vendor_id', vendorId)
      .order('featured', { ascending: false })
      .order('completed_date', { ascending: false });
    
    if (error) {
      console.error('Error fetching portfolio:', error);
      return c.json({ success: false, error: 'Failed to fetch portfolio' }, 500);
    }
    
    const portfolioItems = (portfolioItemsData || []).map((item: any) => ({
      id: item.id,
      vendorId: item.vendor_id,
      title: item.title,
      description: item.description,
      category: item.category,
      images: item.images || [],
      tags: item.tags || [],
      petType: item.pet_type,
      petBreed: item.pet_breed,
      completedDate: item.completed_date,
      featured: item.featured || false,
      clientTestimonial: item.client_testimonial,
      clientName: item.client_name,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    })) as PortfolioItem[];
    
    // Sort by featured first, then by date
    portfolioItems.sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime();
    });
    
    return c.json({
      success: true,
      portfolioItems,
      total: portfolioItems.length
    });
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch portfolio',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /vendor/portfolio/:vendorId/:itemId
 * Get a specific portfolio item
 */
app.get('/:vendorId/:itemId', async (c) => {
  try {
    const { vendorId, itemId } = c.req.param();
    
    // ✅ SQL: Get portfolio item from vendor_portfolio table
    const db = getDbClient();
    const { data: itemData, error } = await db
      .from('vendor_portfolio')
      .select('*')
      .eq('id', itemId)
      .eq('vendor_id', vendorId)
      .single();
    
    if (error || !itemData) {
      return c.json({ 
        success: false, 
        error: 'Portfolio item not found' 
      }, 404);
    }
    
    const item: PortfolioItem = {
      id: itemData.id,
      vendorId: itemData.vendor_id,
      title: itemData.title,
      description: itemData.description,
      category: itemData.category,
      images: itemData.images || [],
      tags: itemData.tags || [],
      petType: itemData.pet_type,
      petBreed: itemData.pet_breed,
      completedDate: itemData.completed_date,
      featured: itemData.featured || false,
      clientTestimonial: itemData.client_testimonial,
      clientName: itemData.client_name,
      createdAt: itemData.created_at,
      updatedAt: itemData.updated_at
    };
    
    return c.json({
      success: true,
      item
    });
  } catch (error) {
    console.error('Error fetching portfolio item:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch portfolio item',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /vendor/portfolio/:vendorId
 * Create a new portfolio item
 */
app.post('/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const body = await c.req.json();
    
    const itemId = `portfolio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const portfolioItem: PortfolioItem = {
      id: itemId,
      vendorId,
      title: body.title,
      description: body.description,
      category: body.category,
      images: body.images || [],
      tags: body.tags || [],
      petType: body.petType,
      petBreed: body.petBreed,
      completedDate: body.completedDate || now,
      featured: body.featured || false,
      clientTestimonial: body.clientTestimonial,
      clientName: body.clientName,
      createdAt: now,
      updatedAt: now
    };
    
    // ✅ SQL: Insert portfolio item into vendor_portfolio table
    const db = getDbClient();
    const { error } = await db
      .from('vendor_portfolio')
      .insert({
        id: itemId,
        vendor_id: vendorId,
        title: portfolioItem.title,
        description: portfolioItem.description,
        category: portfolioItem.category,
        images: portfolioItem.images || [],
        tags: portfolioItem.tags || [],
        pet_type: portfolioItem.petType,
        pet_breed: portfolioItem.petBreed,
        completed_date: portfolioItem.completedDate,
        featured: portfolioItem.featured || false,
        client_testimonial: portfolioItem.clientTestimonial,
        client_name: portfolioItem.clientName,
        created_at: portfolioItem.createdAt,
        updated_at: portfolioItem.updatedAt
      });
    
    if (error) {
      console.error('Error creating portfolio item:', error);
      return c.json({ 
        success: false, 
        error: 'Failed to create portfolio item',
        details: error.message
      }, 500);
    }
    
    return c.json({
      success: true,
      item: portfolioItem,
      message: 'Portfolio item created successfully'
    });
  } catch (error) {
    console.error('Error creating portfolio item:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to create portfolio item',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * PUT /vendor/portfolio/:vendorId/:itemId
 * Update a portfolio item
 */
app.put('/:vendorId/:itemId', async (c) => {
  try {
    const { vendorId, itemId } = c.req.param();
    const body = await c.req.json();
    
    // ✅ SQL: Update portfolio item in vendor_portfolio table
    const db = getDbClient();
    const { data: existing, error: fetchError } = await db
      .from('vendor_portfolio')
      .select('*')
      .eq('id', itemId)
      .eq('vendor_id', vendorId)
      .single();
    
    if (fetchError || !existing) {
      return c.json({ 
        success: false, 
        error: 'Portfolio item not found' 
      }, 404);
    }
    
    const { error } = await db
      .from('vendor_portfolio')
      .update({
        title: body.title || existing.title,
        description: body.description !== undefined ? body.description : existing.description,
        category: body.category || existing.category,
        images: body.images !== undefined ? body.images : existing.images,
        tags: body.tags !== undefined ? body.tags : existing.tags,
        pet_type: body.petType !== undefined ? body.petType : existing.pet_type,
        pet_breed: body.petBreed !== undefined ? body.petBreed : existing.pet_breed,
        completed_date: body.completedDate || existing.completed_date,
        featured: body.featured !== undefined ? body.featured : existing.featured,
        client_testimonial: body.clientTestimonial !== undefined ? body.clientTestimonial : existing.client_testimonial,
        client_name: body.clientName !== undefined ? body.clientName : existing.client_name,
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId)
      .eq('vendor_id', vendorId);
    
    if (error) {
      console.error('Error updating portfolio item:', error);
      return c.json({ 
        success: false, 
        error: 'Failed to update portfolio item',
        details: error.message
      }, 500);
    }
    
    const updated: PortfolioItem = {
      id: itemId,
      vendorId,
      title: body.title || existing.title,
      description: body.description !== undefined ? body.description : existing.description,
      category: body.category || existing.category,
      images: body.images !== undefined ? body.images : existing.images,
      tags: body.tags !== undefined ? body.tags : existing.tags,
      petType: body.petType !== undefined ? body.petType : existing.pet_type,
      petBreed: body.petBreed !== undefined ? body.petBreed : existing.pet_breed,
      completedDate: body.completedDate || existing.completed_date,
      featured: body.featured !== undefined ? body.featured : existing.featured,
      clientTestimonial: body.clientTestimonial !== undefined ? body.clientTestimonial : existing.client_testimonial,
      clientName: body.clientName !== undefined ? body.clientName : existing.client_name,
      updatedAt: new Date().toISOString(),
      createdAt: existing.created_at
    };
    
    return c.json({
      success: true,
      item: updated,
      message: 'Portfolio item updated successfully'
    });
  } catch (error) {
    console.error('Error updating portfolio item:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to update portfolio item',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * DELETE /vendor/portfolio/:vendorId/:itemId
 * Delete a portfolio item
 */
app.delete('/:vendorId/:itemId', async (c) => {
  try {
    const { vendorId, itemId } = c.req.param();
    
    // ✅ SQL: Delete portfolio item from vendor_portfolio table
    const db = getDbClient();
    const { error } = await db
      .from('vendor_portfolio')
      .delete()
      .eq('id', itemId)
      .eq('vendor_id', vendorId);
    
    if (error) {
      console.error('Error deleting portfolio item:', error);
      return c.json({ 
        success: false, 
        error: 'Failed to delete portfolio item',
        details: error.message
      }, 500);
    }
    
    return c.json({
      success: true,
      message: 'Portfolio item deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting portfolio item:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to delete portfolio item',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /vendor/portfolio/:vendorId/:itemId/toggle-featured
 * Toggle featured status of a portfolio item
 */
app.post('/:vendorId/:itemId/toggle-featured', async (c) => {
  try {
    const { vendorId, itemId } = c.req.param();
    
    // ✅ SQL: Toggle featured status in vendor_portfolio table
    const db = getDbClient();
    const { data: existing, error: fetchError } = await db
      .from('vendor_portfolio')
      .select('*')
      .eq('id', itemId)
      .eq('vendor_id', vendorId)
      .single();
    
    if (fetchError || !existing) {
      return c.json({ 
        success: false, 
        error: 'Portfolio item not found' 
      }, 404);
    }
    
    const newFeaturedStatus = !existing.featured;
    
    const { error: updateError } = await db
      .from('vendor_portfolio')
      .update({
        featured: newFeaturedStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId)
      .eq('vendor_id', vendorId);
    
    if (updateError) {
      console.error('Error toggling featured status:', updateError);
      return c.json({ 
        success: false, 
        error: 'Failed to toggle featured status',
        details: updateError.message
      }, 500);
    }
    
    const updated: PortfolioItem = {
      id: existing.id,
      vendorId: existing.vendor_id,
      title: existing.title,
      description: existing.description,
      category: existing.category,
      images: existing.images || [],
      tags: existing.tags || [],
      petType: existing.pet_type,
      petBreed: existing.pet_breed,
      completedDate: existing.completed_date,
      featured: newFeaturedStatus,
      clientTestimonial: existing.client_testimonial,
      clientName: existing.client_name,
      updatedAt: new Date().toISOString(),
      createdAt: existing.created_at
    };
    
    return c.json({
      success: true,
      item: updated,
      message: `Portfolio item ${updated.featured ? 'featured' : 'unfeatured'} successfully`
    });
  } catch (error) {
    console.error('Error toggling featured status:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to toggle featured status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;
