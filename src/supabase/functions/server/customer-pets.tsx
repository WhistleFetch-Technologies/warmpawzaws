// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from "hono";
import { 
  getCustomersRepository,
  getPetsRepository
} from "../../../supabase/lib/repositories/index";

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

    // ✅ SQL: Get customer by phone using repository
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findByPhone(cleanPhone);
    
    if (!customer) {
      console.log(`❌ [GET-PETS] Customer not found for phone: ${cleanPhone}`);
      return c.json({ pets: [], message: "Customer not found" });
    }

    const customerId = customer.id;
    console.log(`✅ [GET-PETS] Found customer ID: ${customerId}`);

    // ✅ SQL: Get pets for this customer using repository
    const petsRepo = getPetsRepository();
    const customerPets = await petsRepo.findByCustomer(customerId);

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
