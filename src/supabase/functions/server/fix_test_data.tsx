import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";

export function registerTestDataFix(app: Hono) {
  
  /**
   * POST /make-server-3dd53475/fix/seed-test-data
   * Seeds the specific test customer and pet IDs required by the frontend tests
   */
  app.post("/make-server-3dd53475/fix/seed-test-data", async (c) => {
    try {
      console.log('🌱 Seeding missing test data...');
      
      // 1. Seed Customer: customer_demo_9998887776
      const customerId = 'customer_demo_9998887776';
      const customer = {
        id: customerId,
        phone: '9998887776',
        name: 'Demo User',
        firstName: 'Demo',
        lastName: 'User',
        email: 'demo@example.com',
        address: '123 Test St, Demo City',
        coordinates: { lat: 12.9716, lng: 77.5946 },
        onboardingComplete: true,
        onboardingStep: 'complete',
        notificationsEnabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        petIds: ['test_pet_123']
      };
      
      await kv.set(`customer:${customerId}`, customer);
      await kv.set(`customer:phone:9998887776`, customerId);
      console.log(`✅ Created customer: ${customerId}`);
      
      // 2. Seed Pet: test_pet_123
      const petId = 'test_pet_123';
      const pet = {
        id: petId,
        customerId: customerId,
        name: 'Buddy',
        species: 'dog',
        type: 'Dog',
        breed: 'Golden Retriever',
        age: 3,
        gender: 'male',
        weight: 25,
        photos: [],
        vaccinated: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(`pet:${petId}`, pet);
      await kv.set(`customer:${customerId}:pets`, [petId]);
      console.log(`✅ Created pet: ${petId}`);
      
      // 3. Seed other missing pets if any (from logs)
      // pet_-2417315605127079089_0
      // pet_1764620714941_7vmntz
      // pet_1764620761515_xoav7i
      
      // We'll just ensure the main test pet is there.
      
      return c.json({
        success: true,
        message: 'Test data seeded successfully',
        customer,
        pet
      });
      
    } catch (error) {
      console.error('Error seeding test data:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
}

// Self-executing function to seed immediately when imported
export async function seedTestDataNow() {
  try {
    const customerId = 'customer_demo_9998887776';
    const existing = await kv.get(`customer:${customerId}`);
    
    if (!existing) {
      console.log('🚀 [AUTO-SEED] Creating missing test data...');
      
      const customer = {
        id: customerId,
        phone: '9998887776',
        name: 'Demo User',
        firstName: 'Demo',
        lastName: 'User',
        email: 'demo@example.com',
        address: '123 Test St, Demo City',
        coordinates: { lat: 12.9716, lng: 77.5946 },
        onboardingComplete: true,
        onboardingStep: 'complete',
        notificationsEnabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        petIds: ['test_pet_123']
      };
      
      const petId = 'test_pet_123';
      const pet = {
        id: petId,
        customerId: customerId,
        name: 'Buddy',
        species: 'dog',
        type: 'Dog',
        breed: 'Golden Retriever',
        age: 3,
        gender: 'male',
        weight: 25,
        photos: [],
        vaccinated: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(`customer:${customerId}`, customer);
      await kv.set(`customer:phone:9998887776`, customerId);
      await kv.set(`pet:${petId}`, pet);
      await kv.set(`customer:${customerId}:pets`, [petId]);
      
      // 4. Seed Test Vendor for Payments E2E
      const vendorId = 'test_vendor_123';
      const existingVendor = await kv.get(`vendor:${vendorId}`);
      if (!existingVendor) {
         const vendor = {
            id: vendorId,
            name: 'Test Vendor',
            email: 'vendor@test.com',
            phone: '9876543210',
            tierId: 'tier_1',
            status: 'approved',
            createdAt: new Date().toISOString()
         };
         await kv.set(`vendor:${vendorId}`, vendor);
         console.log(`✅ [AUTO-SEED] Created test vendor: ${vendorId}`);
      }
      
      // 5. Seed Payment Tier if missing
      const tiers = await kv.get('payment:tiers') || [];
      const hasTier1 = tiers.some((t: any) => t.id === 'tier_1');
      if (!hasTier1) {
        const tier1 = {
          id: 'tier_1',
          name: 'Tier 1',
          displayName: 'Basic Tier',
          description: 'Standard commission for new vendors',
          commissionRate: 15,
          payoutPeriod: 3,
          features: ['Basic Analytics', 'Standard Support'],
          isDefault: true,
          isActive: true
        };
        tiers.push(tier1);
        await kv.set('payment:tiers', tiers);
        console.log('✅ [AUTO-SEED] Created tier_1');
      }

      console.log('✅ [AUTO-SEED] Test data created.');
    }
  } catch (err) {
    console.error('Error in auto-seed:', err);
  }
}
