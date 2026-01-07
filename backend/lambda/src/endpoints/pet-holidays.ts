/**
 * ============================================================================
 * PET HOLIDAYS ENDPOINTS
 * ============================================================================
 * 
 * Handles pet holiday packages:
 * - List holiday packages
 * - Get package details
 * - Create packages (vendor)
 * - Book holidays
 * 
 * Date: 2026-01-07
 * ============================================================================
 */

import { Hono } from 'hono';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query } from '../database/rds-connection';

// ============================================================================
// GET /holidays/packages - List holiday packages
// ============================================================================

class GetHolidayPackagesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const vendorId = context.event.queryStringParameters?.vendorId;
      const destination = context.event.queryStringParameters?.destination;
      const duration = context.event.queryStringParameters?.duration;
      const limit = parseInt(context.event.queryStringParameters?.limit || '50', 10);
      const offset = parseInt(context.event.queryStringParameters?.offset || '0', 10);

      let packagesQuery = `
        SELECT 
          hp.*,
          v.business_name as vendor_name,
          v.city as vendor_city,
          v.rating as vendor_rating,
          COUNT(b.id) as booking_count
        FROM holiday_packages hp
        LEFT JOIN vendors v ON hp.vendor_id = v.id
        LEFT JOIN bookings b ON hp.id = b.package_id AND b.status != 'cancelled'
        WHERE hp.is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (vendorId) {
        packagesQuery += ` AND hp.vendor_id = $${paramIndex++}`;
        params.push(vendorId);
      }

      if (destination) {
        packagesQuery += ` AND hp.destination ILIKE $${paramIndex++}`;
        params.push(`%${destination}%`);
      }

      if (duration) {
        packagesQuery += ` AND hp.duration_days = $${paramIndex++}`;
        params.push(parseInt(duration, 10));
      }

      packagesQuery += ` GROUP BY hp.id, v.business_name, v.city, v.rating`;
      packagesQuery += ` ORDER BY hp.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const packages = await query(packagesQuery, params);

      return this.success({
        packages: packages.rows,
        pagination: {
          limit,
          offset,
          total: packages.rows.length
        }
      });
    } catch (error: any) {
      console.error('Error fetching holiday packages:', error);
      return this.error(error.message || 'Failed to fetch holiday packages', 500);
    }
  }
}

// ============================================================================
// GET /holidays/packages/:id - Get package details
// ============================================================================

class GetHolidayPackageDetailsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const packageId = context.event.pathParameters?.id;

      if (!packageId) {
        return this.error('Package ID is required', 400);
      }

      // Get package details
      const packageData = await query(`
        SELECT 
          hp.*,
          v.business_name as vendor_name,
          v.city as vendor_city,
          v.rating as vendor_rating,
          v.phone as vendor_phone,
          v.email as vendor_email,
          v.address as vendor_address
        FROM holiday_packages hp
        LEFT JOIN vendors v ON hp.vendor_id = v.id
        WHERE hp.id = $1
      `, [packageId]);

      if (packageData.rows.length === 0) {
        return this.error('Package not found', 404);
      }

      // Get inclusions and exclusions (stored as JSON)
      const packageInfo = packageData.rows[0];
      const inclusions = typeof packageInfo.inclusions === 'string' 
        ? JSON.parse(packageInfo.inclusions) 
        : packageInfo.inclusions || [];
      const exclusions = typeof packageInfo.exclusions === 'string'
        ? JSON.parse(packageInfo.exclusions)
        : packageInfo.exclusions || [];
      const itinerary = typeof packageInfo.itinerary === 'string'
        ? JSON.parse(packageInfo.itinerary)
        : packageInfo.itinerary || [];

      return this.success({
        package: {
          ...packageInfo,
          inclusions,
          exclusions,
          itinerary
        }
      });
    } catch (error: any) {
      console.error('Error fetching package details:', error);
      return this.error(error.message || 'Failed to fetch package details', 500);
    }
  }
}

// ============================================================================
// GET /vendor/:id/holiday-packages - Get vendor's holiday packages
// ============================================================================

class GetVendorHolidayPackagesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const vendorId = context.event.pathParameters?.id || 
                      context.event.pathParameters?.vendorId ||
                      context.userId;

      if (!vendorId) {
        return this.error('Vendor ID is required', 400);
      }

      const packages = await query(`
        SELECT 
          hp.*,
          COUNT(b.id) as booking_count,
          SUM(b.total_amount) FILTER (WHERE b.status != 'cancelled') as total_revenue
        FROM holiday_packages hp
        LEFT JOIN bookings b ON hp.id = b.package_id
        WHERE hp.vendor_id = $1
        GROUP BY hp.id
        ORDER BY hp.created_at DESC
      `, [vendorId]);

      return this.success({
        packages: packages.rows,
        count: packages.rows.length
      });
    } catch (error: any) {
      console.error('Error fetching vendor holiday packages:', error);
      return this.error(error.message || 'Failed to fetch holiday packages', 500);
    }
  }
}

// ============================================================================
// POST /vendor/:id/holiday-packages - Create holiday package (vendor only)
// ============================================================================

class CreateHolidayPackageHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const vendorId = context.event.pathParameters?.id || 
                      context.event.pathParameters?.vendorId ||
                      context.userId;
      const body = this.parseBody(context.event);
      const {
        title,
        destination,
        duration_days,
        price,
        group_size,
        tour_type,
        inclusions,
        exclusions,
        itinerary,
        applicable_dates,
        images,
        description
      } = body;

      if (!vendorId) {
        return this.error('Vendor ID is required', 400);
      }

      if (!title || !destination || !duration_days || !price) {
        return this.error('Title, destination, duration, and price are required', 400);
      }

      // Create package
      const newPackage = await query(`
        INSERT INTO holiday_packages (
          vendor_id,
          title,
          destination,
          duration_days,
          price,
          group_size,
          tour_type,
          inclusions,
          exclusions,
          itinerary,
          applicable_dates,
          images,
          description,
          is_active,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true, NOW())
        RETURNING *
      `, [
        vendorId,
        title,
        destination,
        duration_days,
        price,
        group_size || 1,
        tour_type || 'group',
        inclusions ? JSON.stringify(inclusions) : null,
        exclusions ? JSON.stringify(exclusions) : null,
        itinerary ? JSON.stringify(itinerary) : null,
        applicable_dates ? JSON.stringify(applicable_dates) : null,
        images ? JSON.stringify(images) : null,
        description || null
      ]);

      return this.success({
        package: newPackage.rows[0],
        message: 'Holiday package created successfully'
      });
    } catch (error: any) {
      console.error('Error creating holiday package:', error);
      return this.error(error.message || 'Failed to create holiday package', 500);
    }
  }
}

// ============================================================================
// POST /holidays/bookings - Book a holiday
// ============================================================================

class BookHolidayHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const customerId = context.userId;
      const body = this.parseBody(context.event);
      const {
        packageId,
        travelDate,
        numberOfPets,
        petIds,
        specialRequests
      } = body;

      if (!customerId) {
        return this.error('Customer ID is required', 401);
      }

      if (!packageId || !travelDate || !numberOfPets) {
        return this.error('Package ID, travel date, and number of pets are required', 400);
      }

      // Get package details
      const packageData = await query(`
        SELECT * FROM holiday_packages
        WHERE id = $1 AND is_active = true
      `, [packageId]);

      if (packageData.rows.length === 0) {
        return this.error('Package not found or inactive', 404);
      }

      const packageInfo = packageData.rows[0];

      // Check if date is applicable
      if (packageInfo.applicable_dates) {
        const applicableDates = typeof packageInfo.applicable_dates === 'string'
          ? JSON.parse(packageInfo.applicable_dates)
          : packageInfo.applicable_dates;
        
        const travelDateObj = new Date(travelDate);
        const isApplicable = applicableDates.some((dateRange: any) => {
          const start = new Date(dateRange.start);
          const end = new Date(dateRange.end);
          return travelDateObj >= start && travelDateObj <= end;
        });

        if (!isApplicable) {
          return this.error('Travel date is not applicable for this package', 400);
        }
      }

      // Calculate total amount
      const totalAmount = packageInfo.price * numberOfPets;

      // Create booking
      const booking = await query(`
        INSERT INTO bookings (
          customer_id,
          vendor_id,
          package_id,
          service_type,
          booking_date,
          travel_date,
          number_of_pets,
          total_amount,
          status,
          special_requests,
          created_at
        ) VALUES ($1, $2, $3, 'pet_holiday', CURRENT_DATE, $4, $5, $6, 'pending', $7, NOW())
        RETURNING *
      `, [
        customerId,
        packageInfo.vendor_id,
        packageId,
        travelDate,
        numberOfPets,
        totalAmount,
        specialRequests || null
      ]);

      return this.success({
        booking: booking.rows[0],
        message: 'Holiday booking created successfully'
      });
    } catch (error: any) {
      console.error('Error booking holiday:', error);
      return this.error(error.message || 'Failed to book holiday', 500);
    }
  }
}

// ============================================================================
// REGISTER ENDPOINTS
// ============================================================================

export function registerPetHolidaysEndpoints(app: Hono) {
  const getPackagesHandler = new GetHolidayPackagesHandler();
  const getDetailsHandler = new GetHolidayPackageDetailsHandler();
  const getVendorPackagesHandler = new GetVendorHolidayPackagesHandler();
  const createPackageHandler = new CreateHolidayPackageHandler();
  const bookHolidayHandler = new BookHolidayHandler();

  app.get('/holidays/packages', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await getPackagesHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/holidays/packages/:id', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await getDetailsHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/vendor/:id/holiday-packages', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await getVendorPackagesHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/vendor/:id/holiday-packages', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await createPackageHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/holidays/bookings', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await bookHolidayHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}

// Helper to convert Hono request to API Gateway event (for compatibility)
function createApiGatewayEvent(req: any): any {
  return {
    pathParameters: req.param ? Object.fromEntries(Object.entries(req.param())) : {},
    queryStringParameters: req.query ? Object.fromEntries(Object.entries(req.query())) : {},
    body: req.body ? JSON.stringify(req.body) : null,
    headers: req.header ? Object.fromEntries(Object.entries(req.header())) : {},
    requestContext: {
      authorizer: {
        claims: {
          sub: req.header?.('x-user-id') || 'test-user'
        }
      }
    }
  };
}

function createLambdaContext(): any {
  return {};
}

