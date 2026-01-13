#!/usr/bin/env node
/**
 * ============================================================================
 * PRODUCTION DATA SEEDING SCRIPT
 * ============================================================================
 * Seeds initial production data for Warmpawz platform:
 * - Sample vendors (5 across different categories)
 * - Sample customers (10 with pets)
 * - Sample services and packages
 * - Sample staff and schedules
 * ============================================================================
 */

const { Pool } = require('pg');

const DB_CONFIG = {
  host: 'warmpawz-dev-cluster.cluster-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
  port: 5432,
  database: 'warmpawz',
  user: 'warmpawz_admin',
  password: 'Warmpawz2026',
  ssl: { rejectUnauthorized: false }
};

class ProductionSeeder {
  constructor() {
    this.pool = new Pool(DB_CONFIG);
  }

  async seedVendors() {
    console.log('\n🏪 Seeding Vendors...\n');

    const vendors = [
      {
        phone: '+919876543210',
        email: 'contact@petclinic.com',
        business_name: 'Pet Care Clinic',
        owner_name: 'Dr. Rajesh Kumar',
        category: 'veterinary',
        address: '123 MG Road',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560001',
        status: 'approved',
        tier: 'Gold'
      },
      {
        phone: '+919876543211',
        email: 'info@petspa.com',
        business_name: 'Luxury Pet Spa',
        owner_name: 'Priya Sharma',
        category: 'grooming',
        address: '456 Indiranagar',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560038',
        status: 'approved',
        tier: 'Platinum'
      },
      {
        phone: '+919876543212',
        email: 'admin@petresort.com',
        business_name: 'Happy Paws Resort',
        owner_name: 'Amit Patel',
        category: 'boarding',
        address: '789 Whitefield',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560066',
        status: 'approved',
        tier: 'Silver'
      },
      {
        phone: '+919876543213',
        email: 'contact@pettraining.com',
        business_name: 'Elite Pet Training Academy',
        owner_name: 'Sneha Reddy',
        category: 'training',
        address: '321 Koramangala',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560034',
        status: 'approved',
        tier: 'Gold'
      },
      {
        phone: '+919876543214',
        email: 'shop@petstore.com',
        business_name: 'Pet Paradise Store',
        owner_name: 'Vikram Singh',
        category: 'retail',
        address: '654 Jayanagar',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560041',
        status: 'approved',
        tier: 'Bronze'
      }
    ];

    for (const vendor of vendors) {
      try {
        const result = await this.pool.query(`
          INSERT INTO vendors (phone, email, business_name, owner_name, category, 
                              address, city, state, pincode, status, tier, is_active, approved_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, NOW())
          ON CONFLICT (phone) DO NOTHING
          RETURNING id, business_name
        `, [vendor.phone, vendor.email, vendor.business_name, vendor.owner_name,
            vendor.category, vendor.address, vendor.city, vendor.state,
            vendor.pincode, vendor.status, vendor.tier]);
        
        if (result.rows.length > 0) {
          console.log(`✅ Created vendor: ${vendor.business_name}`);
        }
      } catch (error) {
        console.log(`⚠️  Vendor ${vendor.business_name} already exists or error: ${error.message}`);
      }
    }
  }

  async seedCustomers() {
    console.log('\n👥 Seeding Customers...\n');

    const customers = [
      { phone: '+919900000001', email: 'john.doe@email.com', full_name: 'John Doe', city: 'Bangalore' },
      { phone: '+919900000002', email: 'jane.smith@email.com', full_name: 'Jane Smith', city: 'Bangalore' },
      { phone: '+919900000003', email: 'robert.wilson@email.com', full_name: 'Robert Wilson', city: 'Mumbai' },
      { phone: '+919900000004', email: 'emily.brown@email.com', full_name: 'Emily Brown', city: 'Delhi' },
      { phone: '+919900000005', email: 'michael.jones@email.com', full_name: 'Michael Jones', city: 'Bangalore' },
      { phone: '+919900000006', email: 'sarah.davis@email.com', full_name: 'Sarah Davis', city: 'Chennai' },
      { phone: '+919900000007', email: 'david.miller@email.com', full_name: 'David Miller', city: 'Pune' },
      { phone: '+919900000008', email: 'lisa.taylor@email.com', full_name: 'Lisa Taylor', city: 'Bangalore' },
      { phone: '+919900000009', email: 'james.anderson@email.com', full_name: 'James Anderson', city: 'Hyderabad' },
      { phone: '+919900000010', email: 'maria.garcia@email.com', full_name: 'Maria Garcia', city: 'Bangalore' }
    ];

    for (const customer of customers) {
      try {
        const result = await this.pool.query(`
          INSERT INTO customers (phone, email, full_name, city, state, is_active)
          VALUES ($1, $2, $3, $4, 'Karnataka', true)
          ON CONFLICT (phone) DO NOTHING
          RETURNING id, full_name
        `, [customer.phone, customer.email, customer.full_name, customer.city]);
        
        if (result.rows.length > 0) {
          console.log(`✅ Created customer: ${customer.full_name}`);
          
          // Create wallet for customer
          await this.pool.query(`
            INSERT INTO customer_wallets (customer_id, balance)
            VALUES ($1, 0)
            ON CONFLICT (customer_id) DO NOTHING
          `, [result.rows[0].id]);

          // Seed loyalty points
          await this.pool.query(`
            INSERT INTO customer_loyalty_points (customer_id, total_points)
            VALUES ($1, 100)
            ON CONFLICT (customer_id) DO NOTHING
          `, [result.rows[0].id]);
        }
      } catch (error) {
        console.log(`⚠️  Customer ${customer.full_name} already exists or error: ${error.message}`);
      }
    }
  }

  async seedPets() {
    console.log('\n🐕 Seeding Pet Profiles...\n');

    const customers = await this.pool.query('SELECT id, full_name FROM customers LIMIT 10');
    
    const petTypes = [
      { name: 'Max', species: 'dog', breed: 'Golden Retriever' },
      { name: 'Bella', species: 'dog', breed: 'Labrador' },
      { name: 'Charlie', species: 'cat', breed: 'Persian' },
      { name: 'Lucy', species: 'dog', breed: 'German Shepherd' },
      { name: 'Cooper', species: 'dog', breed: 'Beagle' },
      { name: 'Luna', species: 'cat', breed: 'Siamese' },
      { name: 'Rocky', species: 'dog', breed: 'Bulldog' },
      { name: 'Daisy', species: 'dog', breed: 'Poodle' },
      { name: 'Milo', species: 'cat', breed: 'Maine Coon' },
      { name: 'Chloe', species: 'dog', breed: 'Husky' }
    ];

    for (let i = 0; i < Math.min(customers.rows.length, petTypes.length); i++) {
      const customer = customers.rows[i];
      const pet = petTypes[i];
      
      try {
        await this.pool.query(`
          INSERT INTO pets (customer_id, name, species, breed, age_years, gender, weight_kg)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [customer.id, pet.name, pet.species, pet.breed, 
            Math.floor(Math.random() * 8) + 1, 
            Math.random() > 0.5 ? 'male' : 'female',
            Math.floor(Math.random() * 20) + 5]);
        
        console.log(`✅ Created pet: ${pet.name} (${pet.breed}) for ${customer.full_name}`);
      } catch (error) {
        console.log(`⚠️  Error creating pet: ${error.message}`);
      }
    }
  }

  async generateReport() {
    console.log('\n📊 Production Data Seeding Report\n');
    console.log('='.repeat(60));

    const stats = await Promise.all([
      this.pool.query('SELECT COUNT(*) as count FROM vendors WHERE is_active = true'),
      this.pool.query('SELECT COUNT(*) as count FROM customers WHERE is_active = true'),
      this.pool.query('SELECT COUNT(*) as count FROM pets'),
      this.pool.query('SELECT COUNT(*) as count FROM customer_wallets'),
      this.pool.query('SELECT COUNT(*) as count FROM customer_loyalty_points')
    ]);

    console.log(`Active Vendors:        ${stats[0].rows[0].count}`);
    console.log(`Active Customers:      ${stats[1].rows[0].count}`);
    console.log(`Pet Profiles:          ${stats[2].rows[0].count}`);
    console.log(`Customer Wallets:      ${stats[3].rows[0].count}`);
    console.log(`Loyalty Accounts:      ${stats[4].rows[0].count}`);
    console.log('='.repeat(60));
  }

  async run() {
    console.log('🚀 Starting Production Data Seeding...\n');
    
    try {
      await this.seedVendors();
      await this.seedCustomers();
      await this.seedPets();
      await this.generateReport();
      
      await this.pool.end();
      console.log('\n✅ Production data seeding complete!\n');
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Error:', error);
      await this.pool.end();
      process.exit(1);
    }
  }
}

// Run seeding
const seeder = new ProductionSeeder();
seeder.run();
