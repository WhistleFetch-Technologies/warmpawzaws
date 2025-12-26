/**
 * CUSTOMER PETS ROUTES - SQL-ONLY VERSION
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * Date: 2025-01-27
 * Migration: KV to SQL (2 KV operations → 0)
 * Endpoints: 1
 */

import { Hono } from "npm:hono@4";
import { getDbClient } from '../../lib/db.ts';
import { getCustomersRepository } from '../../lib/repositories/customers.ts';
import { getPetsRepository } from '../../lib/repositories/pets.ts';

const customerPetsRoutes = new Hono();

/**
 * GET /customer/pets/:phone
 * Get all pets for a customer by phone number
 */
customerPetsRoutes.get("/:phone", async (c) => {
  try {
    const phone = c.req.param("phone");
    const cleanPhone = phone.replace(/[^0-9]/g, "");

    console.log(`\n📞 [GET-PETS] Fetching pets for phone: ${cleanPhone}`);

    // ✅ SQL: Get customer by phone
    const customer = await getCustomersRepository().findByPhone(cleanPhone);
    
    if (!customer) {
      console.log(`❌ [GET-PETS] Customer not found for phone: ${cleanPhone}`);
      return c.json({ pets: [], message: "Customer not found" });
    }

    console.log(`✅ [GET-PETS] Found customer ID: ${customer.id}`);

    // ✅ SQL: Get all pets for this customer
    const pets = await getPetsRepository().findByCustomer(customer.id);

    console.log(`✅ [GET-PETS] Found ${pets.length} pets for customer`);

    return c.json({
      pets: pets.map((pet: any) => ({
        id: pet.id,
        name: pet.name,
        type: pet.type,
        breed: pet.breed,
        age: pet.age,
        gender: pet.gender,
        photo: pet.photo,
        ownerId: pet.owner_id,
        ownerPhone: customer.phone
      })),
      count: pets.length
    });

  } catch (error) {
    console.error("❌ [GET-PETS] Error:", error);
    return c.json({ error: "Failed to fetch pets", pets: [] }, 500);
  }
});

console.log('✅ Customer pets routes registered (SQL-only)');

export { customerPetsRoutes };
