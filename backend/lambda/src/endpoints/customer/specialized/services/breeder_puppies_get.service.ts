import type { Context } from 'hono';
import * as breeder_puppies_getRepo from '../repos/breeder_puppies_get.repo';
import { Hono } from 'hono';
import { isValidUUID } from '../../../../types/entities';

export async function executebreederPuppiesGet(c: Context) {
    try {
      const breed = c.req.query('breed');
      const petType = c.req.query('petType') || 'dog';
      const vendorId = c.req.query('vendorId');
      const city = c.req.query('city');
      const priceMin = c.req.query('priceMin');
      const priceMax = c.req.query('priceMax');
      const limit = parseInt(c.req.query('limit') || '20', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      let puppyQuery = `
        SELECT 
          p.*,
          v.business_name as breeder_name,
          v.city as breeder_city,
          v.phone as breeder_phone,
          v.is_certified,
          COALESCE((SELECT AVG(rating) FROM reviews WHERE vendor_id = v.id), 0) as breeder_rating,
          COALESCE((SELECT COUNT(*) FROM pets WHERE vendor_id = v.id AND status = 'sold'), 0) as puppies_sold
        FROM pets p
        INNER JOIN vendors v ON p.vendor_id = v.id
        INNER JOIN roles r ON v.role_id = r.id
        WHERE p.listing_type = 'breeding'
        AND p.status = 'available'
        AND v.status = 'approved'
        AND v.is_active = true
        AND r.name IN ('breeder', 'pet_breeder')
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (vendorId) {
        puppyQuery += ` AND p.vendor_id = ${paramIndex}`;
        params.push(vendorId);
        paramIndex++;
      }

      if (breed) {
        puppyQuery += ` AND p.breed ILIKE ${paramIndex}`;
        params.push(`%${breed}%`);
        paramIndex++;
      }

      if (petType) {
        puppyQuery += ` AND LOWER(p.pet_type) = LOWER(${paramIndex})`;
        params.push(petType);
        paramIndex++;
      }

      if (city) {
        puppyQuery += ` AND v.city ILIKE ${paramIndex}`;
        params.push(`%${city}%`);
        paramIndex++;
      }

      if (priceMin) {
        puppyQuery += ` AND p.price >= ${paramIndex}`;
        params.push(parseFloat(priceMin));
        paramIndex++;
      }

      if (priceMax) {
        puppyQuery += ` AND p.price <= ${paramIndex}`;
        params.push(parseFloat(priceMax));
        paramIndex++;
      }

      puppyQuery += ` ORDER BY p.featured DESC NULLS LAST, v.is_certified DESC NULLS LAST, p.created_at DESC LIMIT ${paramIndex} OFFSET ${paramIndex + 1}`;
      params.push(limit, offset);

      const puppies = await breeder_puppies_getRepo.dbBreederPuppiesGet0(puppyQuery, params).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        puppies: puppies.rows.map((puppy: any) => ({
          id: puppy.id,
          name: puppy.name,
          petType: puppy.pet_type,
          breed: puppy.breed,
          age: puppy.age,
          ageUnit: puppy.age_unit || 'weeks',
          gender: puppy.gender,
          color: puppy.color,
          price: puppy.price || puppy.adoption_fee,
          photos: typeof puppy.photos === 'string' ? JSON.parse(puppy.photos) : puppy.photos || [],
          vaccinated: puppy.vaccination_status === 'complete',
          pedigree: puppy.pedigree,
          kciRegistered: puppy.kci_registered,
          breeder: {
            id: puppy.vendor_id,
            name: puppy.breeder_name,
            city: puppy.breeder_city,
            phone: puppy.breeder_phone,
            isCertified: puppy.is_certified,
            rating: parseFloat(puppy.breeder_rating || '0').toFixed(1),
            puppiesSold: parseInt(puppy.puppies_sold || '0', 10),
          },
        })),
        total: puppies.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching breeder puppies:', error);
      return c.json({ error: error.message }, 500);
    }
}