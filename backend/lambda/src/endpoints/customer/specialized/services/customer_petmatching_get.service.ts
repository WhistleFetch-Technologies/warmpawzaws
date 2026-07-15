import type { Context } from 'hono';
import * as customer_petmatching_getRepo from '../repos/customer_petmatching_get.repo';
import { Hono } from 'hono';
import { isValidUUID } from '../../../../types/entities';

export async function executecustomerPetmatchingGet(c: Context) {
    try {
      const breed = c.req.query('breed');
      const petType = c.req.query('petType') || c.req.query('type');
      const gender = c.req.query('gender');
      const city = c.req.query('city');
      const customerId = c.req.query('customerId');
      const limit = parseInt(c.req.query('limit') || '20', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      // Customer-owned pets (schema: species, age_years, profile_photo_url, medical_history JSONB).
      // Opt out via medical_history.matingAvailable === 'false'.
      let matchQuery = `
        SELECT 
          p.id,
          p.name as pet_name,
          COALESCE(p.species, 'Pet') as pet_type,
          p.breed,
          p.age_years as age,
          p.gender,
          p.profile_photo_url,
          p.medical_history,
          c.id as owner_id,
          c.full_name as owner_name,
          c.city as owner_city
        FROM pets p
        INNER JOIN customers c ON p.customer_id = c.id
        WHERE p.customer_id IS NOT NULL
        AND (COALESCE(p.medical_history->>'matingAvailable', 'true') = 'true')
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (customerId && isValidUUID(customerId)) {
        matchQuery += ` AND c.id != ${paramIndex}::uuid`;
        params.push(customerId);
        paramIndex++;
      }

      if (breed) {
        matchQuery += ` AND p.breed ILIKE ${paramIndex}`;
        params.push(`%${breed}%`);
        paramIndex++;
      }

      if (petType) {
        matchQuery += ` AND LOWER(COALESCE(p.species, '')) = LOWER(${paramIndex})`;
        params.push(petType);
        paramIndex++;
      }

      if (gender) {
        matchQuery += ` AND LOWER(COALESCE(p.gender, '')) = LOWER(${paramIndex})`;
        params.push(gender);
        paramIndex++;
      }

      if (city) {
        matchQuery += ` AND c.city ILIKE ${paramIndex}`;
        params.push(`%${city}%`);
        paramIndex++;
      }

      matchQuery += ` ORDER BY p.created_at DESC NULLS LAST LIMIT ${paramIndex} OFFSET ${paramIndex + 1}`;
      params.push(limit, offset);

      const profiles = await customer_petmatching_getRepo.dbCustomerPetmatchingGet0(matchQuery, params).catch((err) => {
        console.error('[pet-matching] query failed:', err);
        return { rows: [] };
      });

      return c.json({
        success: true,
        profiles: profiles.rows.map((profile: any) => {
          const mh = profile.medical_history || {};
          const photoUrl = profile.profile_photo_url;
          const photos = photoUrl ? [photoUrl] : [];
          const species = String(profile.pet_type || '').toLowerCase();
          return {
            id: profile.id,
            petName: profile.pet_name,
            petType: profile.pet_type,
            breed: profile.breed,
            age: profile.age,
            gender: profile.gender,
            photos,
            description: mh.matchBio || mh.bio || mh.behaviorNotes || null,
            ownerId: profile.owner_id,
            ownerName: profile.owner_name,
            location: profile.owner_city,
            emoji: species === 'dog' ? '🐕' : species === 'cat' ? '🐱' : '🐾',
          };
        }),
        total: profiles.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching pet matching profiles:', error);
      return c.json({ success: true, profiles: [], total: 0 });
    }
}