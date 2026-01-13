#!/usr/bin/env node
/**
 * ============================================================================
 * SEED SERVICES & PACKAGES
 * ============================================================================
 * Adds services and packages for all vendors
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

class ServiceSeeder {
  constructor() {
    this.pool = new Pool(DB_CONFIG);
  }

  async seedServices() {
    console.log('\n🛍️ Seeding Services...\n');

    const vendors = await this.pool.query(`
      SELECT id, business_name, category FROM vendors 
      WHERE is_active = true 
      ORDER BY created_at
    `);

    const serviceTemplates = {
      'veterinary': [
        { name: 'General Consultation', price: 500, duration: 30, description: 'Professional veterinary consultation' },
        { name: 'Vaccination', price: 800, duration: 20, description: 'Pet vaccination service' },
        { name: 'Health Checkup', price: 1000, duration: 45, description: 'Complete health examination' },
        { name: 'Dental Cleaning', price: 1500, duration: 60, description: 'Professional dental care' },
        { name: 'Surgery Consultation', price: 2000, duration: 60, description: 'Surgical assessment' }
      ],
      'grooming': [
        { name: 'Basic Bath', price: 600, duration: 45, description: 'Basic bathing service' },
        { name: 'Full Grooming', price: 1200, duration: 90, description: 'Bath, haircut, nail trim' },
        { name: 'Deluxe Spa', price: 2000, duration: 120, description: 'Complete spa treatment' },
        { name: 'Nail Trimming', price: 300, duration: 15, description: 'Nail trim and filing' }
      ],
      'boarding': [
        { name: 'Daycare - Half Day', price: 400, duration: 240, description: 'Half day pet care' },
        { name: 'Daycare - Full Day', price: 700, duration: 480, description: 'Full day pet care' },
        { name: 'Overnight Boarding', price: 1200, duration: 1440, description: 'Overnight stay with care' },
        { name: 'Weekly Boarding', price: 7000, duration: 10080, description: '7 days boarding' }
      ],
      'training': [
        { name: 'Basic Obedience', price: 2000, duration: 60, description: 'Basic commands training' },
        { name: 'Advanced Training', price: 3500, duration: 90, description: 'Advanced obedience' },
        { name: 'Behavior Correction', price: 3000, duration: 60, description: 'Behavior modification' },
        { name: 'Puppy Training', price: 2500, duration: 60, description: 'Puppy socialization' }
      ],
      'retail': [
        { name: 'Premium Dog Food (5kg)', price: 1500, duration: 0, description: 'High quality dog food' },
        { name: 'Cat Food (3kg)', price: 1200, duration: 0, description: 'Nutritious cat food' },
        { name: 'Pet Toys Bundle', price: 500, duration: 0, description: 'Assorted pet toys' },
        { name: 'Pet Accessories', price: 800, duration: 0, description: 'Collars, leashes, bowls' }
      ]
    };

    for (const vendor of vendors.rows) {
      const services = serviceTemplates[vendor.category] || serviceTemplates['retail'];
      
      for (const service of services) {
        try {
          const result = await this.pool.query(`
            INSERT INTO services (vendor_id, name, description, category, price, duration_minutes, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, true)
            RETURNING id, name
          `, [vendor.id, service.name, service.description, vendor.category, service.price, service.duration]);
          
          console.log(`✅ Added "${service.name}" for ${vendor.business_name}`);
        } catch (error) {
          if (error.message.includes('duplicate')) {
            console.log(`⚠️  Service "${service.name}" already exists for ${vendor.business_name}`);
          } else {
            console.log(`⚠️  Error adding service: ${error.message}`);
          }
        }
      }
    }
  }

  async seedPackages() {
    console.log('\n📦 Seeding Service Packages...\n');

    const vendors = await this.pool.query(`
      SELECT v.id as vendor_id, v.business_name, s.id as service_id, s.name as service_name, s.price
      FROM vendors v
      JOIN services s ON v.id = s.vendor_id
      WHERE v.is_active = true
      ORDER BY v.id, s.created_at
    `);

    // Group services by vendor
    const vendorServices = {};
    vendors.rows.forEach(row => {
      if (!vendorServices[row.vendor_id]) {
        vendorServices[row.vendor_id] = {
          business_name: row.business_name,
          services: []
        };
      }
      vendorServices[row.vendor_id].services.push({
        id: row.service_id,
        name: row.service_name,
        price: parseFloat(row.price)
      });
    });

    // Create packages for vendors with multiple services
    for (const [vendorId, data] of Object.entries(vendorServices)) {
      if (data.services.length >= 2) {
        const totalPrice = data.services.reduce((sum, s) => sum + s.price, 0);
        const discountedPrice = totalPrice * 0.85; // 15% discount

        try {
          await this.pool.query(`
            INSERT INTO service_packages (vendor_id, name, description, price, discount_percentage, sessions_count, validity_days, is_active)
            VALUES ($1, $2, $3, $4, 15, $5, 90, true)
          `, [
            vendorId,
            `${data.business_name} - Complete Package`,
            `All services bundle with 15% discount`,
            discountedPrice,
            data.services.length
          ]);
          
          console.log(`✅ Created package for ${data.business_name} (${data.services.length} services, ₹${discountedPrice.toFixed(0)})`);
        } catch (error) {
          console.log(`⚠️  Error creating package: ${error.message}`);
        }
      }
    }
  }

  async generateReport() {
    console.log('\n📊 Services Seeding Report\n');
    console.log('='.repeat(60));

    const stats = await Promise.all([
      this.pool.query('SELECT COUNT(*) as count FROM services WHERE is_active = true'),
      this.pool.query('SELECT COUNT(*) as count FROM service_packages WHERE is_active = true'),
      this.pool.query(`
        SELECT v.business_name, COUNT(s.id) as service_count, COALESCE(SUM(s.price), 0) as total_value
        FROM vendors v
        LEFT JOIN services s ON v.id = s.vendor_id
        GROUP BY v.id, v.business_name
        ORDER BY service_count DESC
      `)
    ]);

    console.log(`Total Services:         ${stats[0].rows[0].count}`);
    console.log(`Total Packages:         ${stats[1].rows[0].count}`);
    console.log('\nServices per Vendor:');
    stats[2].rows.forEach(row => {
      console.log(`  ${row.business_name}: ${row.service_count} services (₹${parseFloat(row.total_value).toFixed(0)})`);
    });
    console.log('='.repeat(60));
  }

  async run() {
    console.log('🚀 Starting Services & Packages Seeding...\n');
    
    try {
      await this.seedServices();
      await this.seedPackages();
      await this.generateReport();
      
      await this.pool.end();
      console.log('\n✅ Services seeding complete!\n');
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Error:', error);
      await this.pool.end();
      process.exit(1);
    }
  }
}

// Run seeding
const seeder = new ServiceSeeder();
seeder.run();
