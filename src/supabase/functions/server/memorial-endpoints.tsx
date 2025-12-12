/**
 * Memorial Services Endpoints
 * Handles pet memorial services, cremation, and remembrance options
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const app = new Hono();

// Memorial Service structure
interface MemorialService {
  id: string;
  vendorId: string;
  customerId: string;
  customerName: string;
  petId?: string;
  petName: string;
  petType: string;
  petBreed?: string;
  serviceType: 'cremation' | 'burial' | 'memorial_ceremony' | 'urn_selection' | 'pawprint' | 'photo_frame' | 'remembrance_box';
  packageName: string;
  packageDescription: string;
  price: number;
  cremationType?: 'private' | 'communal' | 'partitioned';
  ashesReturn: boolean;
  urnType?: string;
  ceremoniesIncluded: string[];
  memorialItems: {
    type: string;
    description: string;
    quantity: number;
  }[];
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  scheduledDate: string;
  completedDate?: string;
  notes?: string;
  specialRequests?: string;
  createdAt: string;
  updatedAt: string;
}

// Memorial Tribute structure
interface MemorialTribute {
  id: string;
  vendorId: string;
  serviceId: string;
  petName: string;
  petImage?: string;
  dateOfBirth?: string;
  dateOfPassing: string;
  epitaph: string;
  memories: {
    text: string;
    author: string;
    date: string;
  }[];
  photos: string[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

// Memorial Product structure
interface MemorialProduct {
  id: string;
  vendorId: string;
  name: string;
  type: 'urn' | 'casket' | 'photo_frame' | 'jewelry' | 'pawprint_kit' | 'memorial_stone' | 'other';
  description: string;
  material: string;
  size: string;
  images: string[];
  price: number;
  inStock: boolean;
  customizable: boolean;
  customizationOptions?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /vendor/memorial/:vendorId/services
 * Get all memorial services for a vendor
 */
app.get('/:vendorId/services', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const { status } = c.req.query();
    
    let services = await kv.getByPrefix<MemorialService>(`memorial:service:${vendorId}:`);
    
    // Filter by status if specified
    if (status) {
      services = services.filter(s => s.status === status);
    }
    
    // Sort by date (most recent first)
    services.sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime());
    
    return c.json({
      success: true,
      services,
      total: services.length,
      scheduled: services.filter(s => s.status === 'scheduled').length
    });
  } catch (error) {
    console.error('Error fetching memorial services:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch memorial services',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /vendor/memorial/:vendorId/services/:serviceId
 * Get a specific memorial service
 */
app.get('/:vendorId/services/:serviceId', async (c) => {
  try {
    const { vendorId, serviceId } = c.req.param();
    
    const service = await kv.get<MemorialService>(`memorial:service:${vendorId}:${serviceId}`);
    
    if (!service) {
      return c.json({ 
        success: false, 
        error: 'Service not found' 
      }, 404);
    }
    
    return c.json({
      success: true,
      service
    });
  } catch (error) {
    console.error('Error fetching memorial service:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch memorial service',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /vendor/memorial/:vendorId/services
 * Create a new memorial service
 */
app.post('/:vendorId/services', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const body = await c.req.json();
    
    const serviceId = `service-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const service: MemorialService = {
      id: serviceId,
      vendorId,
      customerId: body.customerId,
      customerName: body.customerName,
      petId: body.petId,
      petName: body.petName,
      petType: body.petType,
      petBreed: body.petBreed,
      serviceType: body.serviceType,
      packageName: body.packageName,
      packageDescription: body.packageDescription,
      price: body.price,
      cremationType: body.cremationType,
      ashesReturn: body.ashesReturn || false,
      urnType: body.urnType,
      ceremoniesIncluded: body.ceremoniesIncluded || [],
      memorialItems: body.memorialItems || [],
      status: 'scheduled',
      scheduledDate: body.scheduledDate,
      notes: body.notes,
      specialRequests: body.specialRequests,
      createdAt: now,
      updatedAt: now
    };
    
    await kv.set(`memorial:service:${vendorId}:${serviceId}`, service);
    
    return c.json({
      success: true,
      service,
      message: 'Memorial service created successfully'
    });
  } catch (error) {
    console.error('Error creating memorial service:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to create memorial service',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * PUT /vendor/memorial/:vendorId/services/:serviceId
 * Update a memorial service
 */
app.put('/:vendorId/services/:serviceId', async (c) => {
  try {
    const { vendorId, serviceId } = c.req.param();
    const body = await c.req.json();
    
    const existing = await kv.get<MemorialService>(`memorial:service:${vendorId}:${serviceId}`);
    
    if (!existing) {
      return c.json({ 
        success: false, 
        error: 'Service not found' 
      }, 404);
    }
    
    const updated: MemorialService = {
      ...existing,
      ...body,
      id: serviceId,
      vendorId,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`memorial:service:${vendorId}:${serviceId}`, updated);
    
    return c.json({
      success: true,
      service: updated,
      message: 'Memorial service updated successfully'
    });
  } catch (error) {
    console.error('Error updating memorial service:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to update memorial service',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /vendor/memorial/:vendorId/services/:serviceId/status
 * Update service status
 */
app.post('/:vendorId/services/:serviceId/status', async (c) => {
  try {
    const { vendorId, serviceId } = c.req.param();
    const { status } = await c.req.json();
    
    const service = await kv.get<MemorialService>(`memorial:service:${vendorId}:${serviceId}`);
    
    if (!service) {
      return c.json({ 
        success: false, 
        error: 'Service not found' 
      }, 404);
    }
    
    const now = new Date().toISOString();
    const updated: MemorialService = {
      ...service,
      status,
      completedDate: status === 'completed' ? now : service.completedDate,
      updatedAt: now
    };
    
    await kv.set(`memorial:service:${vendorId}:${serviceId}`, updated);
    
    return c.json({
      success: true,
      service: updated,
      message: 'Service status updated successfully'
    });
  } catch (error) {
    console.error('Error updating service status:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to update service status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /vendor/memorial/:vendorId/tributes
 * Get all memorial tributes
 */
app.get('/:vendorId/tributes', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const { isPublic } = c.req.query();
    
    let tributes = await kv.getByPrefix<MemorialTribute>(`memorial:tribute:${vendorId}:`);
    
    // Filter by public status if specified
    if (isPublic !== undefined) {
      tributes = tributes.filter(t => t.isPublic === (isPublic === 'true'));
    }
    
    // Sort by date (most recent first)
    tributes.sort((a, b) => new Date(b.dateOfPassing).getTime() - new Date(a.dateOfPassing).getTime());
    
    return c.json({
      success: true,
      tributes,
      total: tributes.length
    });
  } catch (error) {
    console.error('Error fetching memorial tributes:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch memorial tributes',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /vendor/memorial/:vendorId/tributes
 * Create a new memorial tribute
 */
app.post('/:vendorId/tributes', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const body = await c.req.json();
    
    const tributeId = `tribute-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const tribute: MemorialTribute = {
      id: tributeId,
      vendorId,
      serviceId: body.serviceId,
      petName: body.petName,
      petImage: body.petImage,
      dateOfBirth: body.dateOfBirth,
      dateOfPassing: body.dateOfPassing,
      epitaph: body.epitaph,
      memories: body.memories || [],
      photos: body.photos || [],
      isPublic: body.isPublic || false,
      createdAt: now,
      updatedAt: now
    };
    
    await kv.set(`memorial:tribute:${vendorId}:${tributeId}`, tribute);
    
    return c.json({
      success: true,
      tribute,
      message: 'Memorial tribute created successfully'
    });
  } catch (error) {
    console.error('Error creating memorial tribute:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to create memorial tribute',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /vendor/memorial/:vendorId/products
 * Get all memorial products
 */
app.get('/:vendorId/products', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const { type } = c.req.query();
    
    let products = await kv.getByPrefix<MemorialProduct>(`memorial:product:${vendorId}:`);
    
    // Filter by type if specified
    if (type) {
      products = products.filter(p => p.type === type);
    }
    
    // Sort by name
    products.sort((a, b) => a.name.localeCompare(b.name));
    
    return c.json({
      success: true,
      products,
      total: products.length,
      inStock: products.filter(p => p.inStock).length
    });
  } catch (error) {
    console.error('Error fetching memorial products:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch memorial products',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /vendor/memorial/:vendorId/products
 * Create a new memorial product
 */
app.post('/:vendorId/products', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const body = await c.req.json();
    
    const productId = `product-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const product: MemorialProduct = {
      id: productId,
      vendorId,
      name: body.name,
      type: body.type,
      description: body.description,
      material: body.material,
      size: body.size,
      images: body.images || [],
      price: body.price,
      inStock: body.inStock !== false,
      customizable: body.customizable || false,
      customizationOptions: body.customizationOptions,
      createdAt: now,
      updatedAt: now
    };
    
    await kv.set(`memorial:product:${vendorId}:${productId}`, product);
    
    return c.json({
      success: true,
      product,
      message: 'Memorial product created successfully'
    });
  } catch (error) {
    console.error('Error creating memorial product:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to create memorial product',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;
