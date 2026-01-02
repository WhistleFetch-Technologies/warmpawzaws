/**
 * Memorial Services Endpoints
 * Handles pet memorial services, cremation, and remembrance options
 */

// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from 'hono';
import { getDbClient } from '../../../supabase/lib/db';

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
    
    // ✅ SQL: Get memorial services
    const db = getDbClient();
    let query = db
      .from('memorial_services')
      .select('*')
      .eq('vendor_id', vendorId);
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data: services } = await query.order('scheduled_date', { ascending: false });
    
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
    
    // ✅ SQL: Get memorial service
    const db = getDbClient();
    const { data: service } = await db
      .from('memorial_services')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('id', serviceId)
      .single();
    
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
    
    // ✅ SQL: Create memorial service
    const db = getDbClient();
    await db
      .from('memorial_services')
      .insert({
        id: serviceId,
        vendor_id: vendorId,
        customer_id: body.customerId,
        customer_name: body.customerName,
        pet_id: body.petId,
        pet_name: body.petName,
        pet_type: body.petType,
        pet_breed: body.petBreed,
        service_type: body.serviceType,
        package_name: body.packageName,
        package_description: body.packageDescription,
        price: body.price,
        cremation_type: body.cremationType,
        ashes_return: body.ashesReturn || false,
        urn_type: body.urnType,
        ceremonies_included: body.ceremoniesIncluded || [],
        memorial_items: body.memorialItems || [],
        status: 'scheduled',
        scheduled_date: body.scheduledDate,
        notes: body.notes,
        special_requests: body.specialRequests,
        created_at: now,
        updated_at: now
      });
    
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
    
    // ✅ SQL: Get and update memorial service
    const db = getDbClient();
    const { data: existing } = await db
      .from('memorial_services')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('id', serviceId)
      .single();
    
    if (!existing) {
      return c.json({ 
        success: false, 
        error: 'Service not found' 
      }, 404);
    }
    
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    // Map body fields to SQL columns
    if (body.customerId) updateData.customer_id = body.customerId;
    if (body.customerName) updateData.customer_name = body.customerName;
    if (body.petId) updateData.pet_id = body.petId;
    if (body.petName) updateData.pet_name = body.petName;
    if (body.petType) updateData.pet_type = body.petType;
    if (body.petBreed) updateData.pet_breed = body.petBreed;
    if (body.serviceType) updateData.service_type = body.serviceType;
    if (body.packageName) updateData.package_name = body.packageName;
    if (body.packageDescription) updateData.package_description = body.packageDescription;
    if (body.price !== undefined) updateData.price = body.price;
    if (body.cremationType) updateData.cremation_type = body.cremationType;
    if (body.ashesReturn !== undefined) updateData.ashes_return = body.ashesReturn;
    if (body.urnType) updateData.urn_type = body.urnType;
    if (body.ceremoniesIncluded) updateData.ceremonies_included = body.ceremoniesIncluded;
    if (body.memorialItems) updateData.memorial_items = body.memorialItems;
    if (body.status) updateData.status = body.status;
    if (body.scheduledDate) updateData.scheduled_date = body.scheduledDate;
    if (body.completedDate) updateData.completed_date = body.completedDate;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.specialRequests) updateData.special_requests = body.specialRequests;
    
    await db
      .from('memorial_services')
      .update(updateData)
      .eq('id', serviceId)
      .eq('vendor_id', vendorId);
    
    const { data: updated } = await db
      .from('memorial_services')
      .select('*')
      .eq('id', serviceId)
      .single();
    
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
    
    // ✅ SQL: Get memorial service
    const db = getDbClient();
    const { data: service } = await db
      .from('memorial_services')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('id', serviceId)
      .single();
    
    if (!service) {
      return c.json({ 
        success: false, 
        error: 'Service not found' 
      }, 404);
    }
    
    const now = new Date().toISOString();
    await db
      .from('memorial_services')
      .update({
        status,
        completed_date: status === 'completed' ? now : service.completed_date,
        updated_at: now
      })
      .eq('id', serviceId)
      .eq('vendor_id', vendorId);
    
    const { data: updated } = await db
      .from('memorial_services')
      .select('*')
      .eq('id', serviceId)
      .single();
    
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
    
    // ✅ SQL: Get memorial tributes
    const db = getDbClient();
    let query = db
      .from('memorial_tributes')
      .select('*')
      .eq('vendor_id', vendorId);
    
    if (isPublic !== undefined) {
      query = query.eq('is_public', isPublic === 'true');
    }
    
    const { data: tributes } = await query.order('date_of_passing', { ascending: false });
    
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
    
    // ✅ SQL: Create memorial tribute
    const db = getDbClient();
    await db
      .from('memorial_tributes')
      .insert({
        id: tributeId,
        vendor_id: vendorId,
        service_id: body.serviceId,
        pet_name: body.petName,
        pet_image: body.petImage,
        date_of_birth: body.dateOfBirth,
        date_of_passing: body.dateOfPassing,
        epitaph: body.epitaph,
        memories: body.memories || [],
        photos: body.photos || [],
        is_public: body.isPublic || false,
        created_at: now,
        updated_at: now
      });
    
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
    
    // ✅ SQL: Get memorial products
    const db = getDbClient();
    let query = db
      .from('memorial_products')
      .select('*')
      .eq('vendor_id', vendorId);
    
    if (type) {
      query = query.eq('type', type);
    }
    
    const { data: products } = await query.order('name', { ascending: true });
    
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
    
    // ✅ SQL: Create memorial product
    const db = getDbClient();
    await db
      .from('memorial_products')
      .insert({
        id: productId,
        vendor_id: vendorId,
        name: body.name,
        type: body.type,
        description: body.description,
        material: body.material,
        size: body.size,
        images: body.images || [],
        price: body.price,
        in_stock: body.inStock !== false,
        customizable: body.customizable || false,
        customization_options: body.customizationOptions,
        created_at: now,
        updated_at: now
      });
    
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
