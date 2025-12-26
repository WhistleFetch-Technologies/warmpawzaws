/**
 * Portfolio Management Endpoints - SQL VERSION
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * Handles vendor portfolio (showcase work, past projects, achievements)
 * 
 * Date: 2025-01-27
 * Migration: KV to SQL (3 KV operations → 0)
 */

import { Hono } from 'npm:hono';
import { getDbClient } from '../../lib/db.ts';
import { sendSuccess, sendError } from './response-utils.ts';

const app = new Hono();
const db = getDbClient();

// Portfolio item structure
interface PortfolioItem {
  id: string;
  vendorId: string;
  title: string;
  description: string;
  category: string;
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
 * GET /make-server-3dd53475/vendor/portfolio/:vendorId
 * Get all portfolio items for a vendor
 */
app.get('/make-server-3dd53475/vendor/portfolio/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    
    // ✅ SQL: Get portfolio items from vendor_portfolio table
    const { data: portfolioItems, error } = await db
      .from('vendor_portfolio')
      .select('*')
      .eq('vendor_id', vendorId)
      .order('featured', { ascending: false })
      .order('completed_date', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    // Map database rows to PortfolioItem format
    const mappedItems: PortfolioItem[] = (portfolioItems || []).map((item: any) => ({
      id: item.id,
      vendorId: item.vendor_id,
      title: item.title,
      description: item.description || '',
      category: item.category,
      images: item.images || [],
      tags: item.tags || [],
      petType: item.pet_type || undefined,
      petBreed: item.pet_breed || undefined,
      completedDate: item.completed_date,
      featured: item.featured || false,
      clientTestimonial: item.client_testimonial || undefined,
      clientName: item.client_name || undefined,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }));
    
    // Sort by featured first, then by date
    mappedItems.sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime();
    });
    
    return sendSuccess(c, {
      portfolioItems: mappedItems,
      total: mappedItems.length
    });
  } catch (error) {
    console.error('[PORTFOLIO-SQL] Error fetching portfolio:', error);
    return sendError(c, error, 500);
  }
});

/**
 * GET /make-server-3dd53475/vendor/portfolio/:vendorId/:itemId
 * Get a specific portfolio item
 */
app.get('/make-server-3dd53475/vendor/portfolio/:vendorId/:itemId', async (c) => {
  try {
    const { vendorId, itemId } = c.req.param();
    
    // ✅ SQL: Get portfolio item from vendor_portfolio table
    const { data: item, error } = await db
      .from('vendor_portfolio')
      .select('*')
      .eq('id', itemId)
      .eq('vendor_id', vendorId)
      .single();
    
    if (error || !item) {
      return sendError(c, 'Portfolio item not found', 404);
    }
    
    // Map database row to PortfolioItem format
    const mappedItem: PortfolioItem = {
      id: item.id,
      vendorId: item.vendor_id,
      title: item.title,
      description: item.description || '',
      category: item.category,
      images: item.images || [],
      tags: item.tags || [],
      petType: item.pet_type || undefined,
      petBreed: item.pet_breed || undefined,
      completedDate: item.completed_date,
      featured: item.featured || false,
      clientTestimonial: item.client_testimonial || undefined,
      clientName: item.client_name || undefined,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    };
    
    return sendSuccess(c, { item: mappedItem });
  } catch (error) {
    console.error('[PORTFOLIO-SQL] Error fetching portfolio item:', error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /make-server-3dd53475/vendor/portfolio/:vendorId
 * Create a new portfolio item
 */
app.post('/make-server-3dd53475/vendor/portfolio/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const body = await c.req.json();
    
    const now = new Date().toISOString();
    
    // ✅ SQL: Insert portfolio item into vendor_portfolio table
    const { data: portfolioItem, error } = await db
      .from('vendor_portfolio')
      .insert({
        vendor_id: vendorId,
        title: body.title,
        description: body.description || null,
        category: body.category,
        images: body.images || [],
        tags: body.tags || [],
        pet_type: body.petType || null,
        pet_breed: body.petBreed || null,
        completed_date: body.completedDate || new Date().toISOString().split('T')[0],
        featured: body.featured || false,
        client_testimonial: body.clientTestimonial || null,
        client_name: body.clientName || null
      })
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    // Map database row to PortfolioItem format
    const mappedItem: PortfolioItem = {
      id: portfolioItem.id,
      vendorId: portfolioItem.vendor_id,
      title: portfolioItem.title,
      description: portfolioItem.description || '',
      category: portfolioItem.category,
      images: portfolioItem.images || [],
      tags: portfolioItem.tags || [],
      petType: portfolioItem.pet_type || undefined,
      petBreed: portfolioItem.pet_breed || undefined,
      completedDate: portfolioItem.completed_date,
      featured: portfolioItem.featured || false,
      clientTestimonial: portfolioItem.client_testimonial || undefined,
      clientName: portfolioItem.client_name || undefined,
      createdAt: portfolioItem.created_at,
      updatedAt: portfolioItem.updated_at
    };
    
    return sendSuccess(c, {
      item: mappedItem,
      message: 'Portfolio item created successfully'
    });
  } catch (error) {
    console.error('[PORTFOLIO-SQL] Error creating portfolio item:', error);
    return sendError(c, error, 500);
  }
});

/**
 * PUT /make-server-3dd53475/vendor/portfolio/:vendorId/:itemId
 * Update a portfolio item
 */
app.put('/make-server-3dd53475/vendor/portfolio/:vendorId/:itemId', async (c) => {
  try {
    const { vendorId, itemId } = c.req.param();
    const body = await c.req.json();
    
    // ✅ SQL: Update portfolio item in vendor_portfolio table
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.images !== undefined) updateData.images = body.images;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.petType !== undefined) updateData.pet_type = body.petType;
    if (body.petBreed !== undefined) updateData.pet_breed = body.petBreed;
    if (body.completedDate !== undefined) updateData.completed_date = body.completedDate;
    if (body.featured !== undefined) updateData.featured = body.featured;
    if (body.clientTestimonial !== undefined) updateData.client_testimonial = body.clientTestimonial;
    if (body.clientName !== undefined) updateData.client_name = body.clientName;
    
    const { data: updated, error } = await db
      .from('vendor_portfolio')
      .update(updateData)
      .eq('id', itemId)
      .eq('vendor_id', vendorId)
      .select()
      .single();
    
    if (error || !updated) {
      return sendError(c, 'Portfolio item not found', 404);
    }
    
    // Map database row to PortfolioItem format
    const mappedItem: PortfolioItem = {
      id: updated.id,
      vendorId: updated.vendor_id,
      title: updated.title,
      description: updated.description || '',
      category: updated.category,
      images: updated.images || [],
      tags: updated.tags || [],
      petType: updated.pet_type || undefined,
      petBreed: updated.pet_breed || undefined,
      completedDate: updated.completed_date,
      featured: updated.featured || false,
      clientTestimonial: updated.client_testimonial || undefined,
      clientName: updated.client_name || undefined,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at
    };
    
    return sendSuccess(c, {
      item: mappedItem,
      message: 'Portfolio item updated successfully'
    });
  } catch (error) {
    console.error('[PORTFOLIO-SQL] Error updating portfolio item:', error);
    return sendError(c, error, 500);
  }
});

/**
 * DELETE /make-server-3dd53475/vendor/portfolio/:vendorId/:itemId
 * Delete a portfolio item
 */
app.delete('/make-server-3dd53475/vendor/portfolio/:vendorId/:itemId', async (c) => {
  try {
    const { vendorId, itemId } = c.req.param();
    
    // ✅ SQL: Delete portfolio item from vendor_portfolio table
    const { error } = await db
      .from('vendor_portfolio')
      .delete()
      .eq('id', itemId)
      .eq('vendor_id', vendorId);
    
    if (error) {
      throw error;
    }
    
    return sendSuccess(c, {
      message: 'Portfolio item deleted successfully'
    });
  } catch (error) {
    console.error('[PORTFOLIO-SQL] Error deleting portfolio item:', error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /make-server-3dd53475/vendor/portfolio/:vendorId/:itemId/toggle-featured
 * Toggle featured status of a portfolio item
 */
app.post('/make-server-3dd53475/vendor/portfolio/:vendorId/:itemId/toggle-featured', async (c) => {
  try {
    const { vendorId, itemId } = c.req.param();
    
    // ✅ SQL: Get current portfolio item
    const { data: existing, error: fetchError } = await db
      .from('vendor_portfolio')
      .select('featured')
      .eq('id', itemId)
      .eq('vendor_id', vendorId)
      .single();
    
    if (fetchError || !existing) {
      return sendError(c, 'Portfolio item not found', 404);
    }
    
    // ✅ SQL: Toggle featured status
    const { data: updated, error } = await db
      .from('vendor_portfolio')
      .update({
        featured: !existing.featured,
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId)
      .eq('vendor_id', vendorId)
      .select()
      .single();
    
    if (error || !updated) {
      throw error;
    }
    
    // Map database row to PortfolioItem format
    const mappedItem: PortfolioItem = {
      id: updated.id,
      vendorId: updated.vendor_id,
      title: updated.title,
      description: updated.description || '',
      category: updated.category,
      images: updated.images || [],
      tags: updated.tags || [],
      petType: updated.pet_type || undefined,
      petBreed: updated.pet_breed || undefined,
      completedDate: updated.completed_date,
      featured: updated.featured || false,
      clientTestimonial: updated.client_testimonial || undefined,
      clientName: updated.client_name || undefined,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at
    };
    
    return sendSuccess(c, {
      item: mappedItem,
      message: `Portfolio item ${updated.featured ? 'featured' : 'unfeatured'} successfully`
    });
  } catch (error) {
    console.error('[PORTFOLIO-SQL] Error toggling featured status:', error);
    return sendError(c, error, 500);
  }
});

console.log('✅ Portfolio endpoints registered (SQL-only)');

export default app;

