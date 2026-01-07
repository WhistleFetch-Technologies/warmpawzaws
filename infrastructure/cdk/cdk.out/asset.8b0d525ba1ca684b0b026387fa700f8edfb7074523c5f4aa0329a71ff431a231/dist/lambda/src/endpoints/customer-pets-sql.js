"use strict";
/**
 * CUSTOMER PETS ROUTES - SQL-ONLY VERSION
 *
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 *
 * Date: 2025-01-27
 * Migration: KV to SQL (2 KV operations → 0)
 * Endpoints: 1
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCustomerPetsRoutes = registerCustomerPetsRoutes;
const customers_1 = require("../lib/repositories/customers");
const pets_1 = require("../lib/repositories/pets");
function registerCustomerPetsRoutes(app) {
    /**
     * GET /customer/pets/:phone
     * Get all pets for a customer by phone number
     */
    app.get("/customer/pets/:phone", async (c) => {
        try {
            const phone = c.req.param("phone");
            const cleanPhone = phone.replace(/[^0-9]/g, "");
            console.log(`\n📞 [GET-PETS] Fetching pets for phone: ${cleanPhone}`);
            // ✅ SQL: Get customer by phone
            const customer = await (0, customers_1.getCustomersRepository)().findByPhone(cleanPhone);
            if (!customer) {
                console.log(`❌ [GET-PETS] Customer not found for phone: ${cleanPhone}`);
                return c.json({ pets: [], message: "Customer not found" });
            }
            console.log(`✅ [GET-PETS] Found customer ID: ${customer.id}`);
            // ✅ SQL: Get all pets for this customer
            const pets = await (0, pets_1.getPetsRepository)().findByCustomer(customer.id);
            console.log(`✅ [GET-PETS] Found ${pets.length} pets for customer`);
            return c.json({
                pets: pets.map((pet) => ({
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
        }
        catch (error) {
            console.error("❌ [GET-PETS] Error:", error);
            return c.json({ error: "Failed to fetch pets", pets: [] }, 500);
        }
    });
    console.log('✅ Customer pets routes registered (SQL-only)');
}
//# sourceMappingURL=customer-pets-sql.js.map