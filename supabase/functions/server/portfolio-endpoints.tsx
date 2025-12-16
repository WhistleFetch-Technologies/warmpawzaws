/**
 * Portfolio Management Endpoints
 * Handles vendor portfolio (showcase work, past projects, achievements)
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

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
    
    const portfolioItems = await kv.getByPrefix<PortfolioItem>(`portfolio:${vendorId}:`);
    
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
    
    const item = await kv.get<PortfolioItem>(`portfolio:${vendorId}:${itemId}`);
    
    if (!item) {
      return c.json({ 
        success: false, 
        error: 'Portfolio item not found' 
      }, 404);
    }
    
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
    
    await kv.set(`portfolio:${vendorId}:${itemId}`, portfolioItem);
    
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
    
    const existing = await kv.get<PortfolioItem>(`portfolio:${vendorId}:${itemId}`);
    
    if (!existing) {
      return c.json({ 
        success: false, 
        error: 'Portfolio item not found' 
      }, 404);
    }
    
    const updated: PortfolioItem = {
      ...existing,
      ...body,
      id: itemId,
      vendorId,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`portfolio:${vendorId}:${itemId}`, updated);
    
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
    
    await kv.del(`portfolio:${vendorId}:${itemId}`);
    
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
    
    const existing = await kv.get<PortfolioItem>(`portfolio:${vendorId}:${itemId}`);
    
    if (!existing) {
      return c.json({ 
        success: false, 
        error: 'Portfolio item not found' 
      }, 404);
    }
    
    const updated: PortfolioItem = {
      ...existing,
      featured: !existing.featured,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`portfolio:${vendorId}:${itemId}`, updated);
    
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
