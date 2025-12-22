import { Hono } from "npm:hono@4";
import * as kv from "./kv_store.tsx";

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

    // Get customer ID from phone
    const customerId = await kv.get(`customer:phone:${cleanPhone}`);
    
    if (!customerId) {
      console.log(`❌ [GET-PETS] Customer not found for phone: ${cleanPhone}`);
      return c.json({ pets: [], message: "Customer not found" });
    }

    console.log(`✅ [GET-PETS] Found customer ID: ${customerId}`);

    // Get all pets for this customer
    const allPets = await kv.getByPrefix("pet:");
    const customerPets = allPets.filter((pet: any) => {
      return pet.ownerId === customerId || pet.ownerPhone === cleanPhone;
    });

    console.log(`✅ [GET-PETS] Found ${customerPets.length} pets for customer`);

    return c.json({
      pets: customerPets,
      count: customerPets.length
    });

  } catch (error) {
    console.error("❌ [GET-PETS] Error:", error);
    return c.json({ error: "Failed to fetch pets", pets: [] }, 500);
  }
});

export { customerPetsRoutes };
