#!/usr/bin/env node
/**
 * ============================================================================
 * SEED STAFF & SCHEDULES
 * ============================================================================
 * Adds staff members and their schedules for all vendors
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

class StaffSeeder {
  constructor() {
    this.pool = new Pool(DB_CONFIG);
  }

  async seedStaff() {
    console.log('\n👨‍⚕️ Seeding Staff Members...\n');

    // Get all vendors
    const vendorsResult = await this.pool.query('SELECT id, business_name, category FROM vendors ORDER BY created_at');
    const vendors = vendorsResult.rows;

    const staffTemplates = {
      'veterinary': [
        { name: 'Dr. Sharma', phone: '+919111111111', role: 'Veterinarian', experience: 8 },
        { name: 'Dr. Patel', phone: '+919111111112', role: 'Veterinarian', experience: 5 },
        { name: 'Nurse Kumar', phone: '+919111111113', role: 'Veterinary Nurse', experience: 3 }
      ],
      'grooming': [
        { name: 'Raj Groomer', phone: '+919111111114', role: 'Senior Groomer', experience: 6 },
        { name: 'Priya Stylist', phone: '+919111111115', role: 'Pet Stylist', experience: 4 }
      ],
      'boarding': [
        { name: 'Amit Caretaker', phone: '+919111111116', role: 'Pet Caretaker', experience: 5 },
        { name: 'Sneha Handler', phone: '+919111111117', role: 'Pet Handler', experience: 3 }
      ],
      'training': [
        { name: 'Vikram Trainer', phone: '+919111111118', role: 'Senior Trainer', experience: 7 },
        { name: 'Anita Coach', phone: '+919111111119', role: 'Behavior Coach', experience: 4 }
      ],
      'retail': [
        { name: 'Rahul Manager', phone: '+919111111120', role: 'Store Manager', experience: 5 },
        { name: 'Neha Sales', phone: '+919111111121', role: 'Sales Associate', experience: 2 }
      ]
    };

    for (const vendor of vendors) {
      const staffList = staffTemplates[vendor.category] || staffTemplates['retail'];
      
      for (const staff of staffList) {
        try {
          const result = await this.pool.query(`
            INSERT INTO staff (vendor_id, name, phone, email, role, experience_years, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, true)
            ON CONFLICT (vendor_id, phone) DO NOTHING
            RETURNING id, name
          `, [vendor.id, staff.name, staff.phone, 
              `${staff.name.toLowerCase().replace(/\s+/g, '.')}@${vendor.business_name.toLowerCase().replace(/\s+/g, '')}.com`,
              staff.role, staff.experience]);
          
          if (result.rows.length > 0) {
            const staffId = result.rows[0].id;
            console.log(`✅ Added ${staff.name} (${staff.role}) to ${vendor.business_name}`);
            
            // Add schedule for this staff member (Mon-Fri, 9 AM - 6 PM)
            for (let day = 1; day <= 5; day++) {
              await this.pool.query(`
                INSERT INTO staff_schedules (staff_id, day_of_week, start_time, end_time, is_available)
                VALUES ($1, $2, '09:00', '18:00', true)
                ON CONFLICT (staff_id, day_of_week, start_time) DO NOTHING
              `, [staffId, day]);
            }
            
            // Add availability for next 7 days
            for (let i = 0; i < 7; i++) {
              const date = new Date();
              date.setDate(date.getDate() + i);
              const dateStr = date.toISOString().split('T')[0];
              
              await this.pool.query(`
                INSERT INTO staff_availability (staff_id, date, start_time, end_time, is_available)
                VALUES ($1, $2, '09:00', '18:00', true)
                ON CONFLICT (staff_id, date, start_time) DO NOTHING
              `, [staffId, dateStr]);
            }
          }
        } catch (error) {
          console.log(`⚠️  Error adding ${staff.name}: ${error.message}`);
        }
      }
    }
  }

  async generateReport() {
    console.log('\n📊 Staff Seeding Report\n');
    console.log('='.repeat(60));

    const stats = await Promise.all([
      this.pool.query('SELECT COUNT(*) as count FROM staff WHERE is_active = true'),
      this.pool.query('SELECT COUNT(*) as count FROM staff_schedules'),
      this.pool.query('SELECT COUNT(*) as count FROM staff_availability'),
      this.pool.query('SELECT v.business_name, COUNT(s.id) as staff_count FROM vendors v LEFT JOIN staff s ON v.id = s.vendor_id GROUP BY v.id, v.business_name ORDER BY v.business_name')
    ]);

    console.log(`Total Staff Members:    ${stats[0].rows[0].count}`);
    console.log(`Total Schedules:        ${stats[1].rows[0].count}`);
    console.log(`Total Availability:     ${stats[2].rows[0].count}`);
    console.log('\nStaff per Vendor:');
    stats[3].rows.forEach(row => {
      console.log(`  ${row.business_name}: ${row.staff_count} staff`);
    });
    console.log('='.repeat(60));
  }

  async run() {
    console.log('🚀 Starting Staff & Schedule Seeding...\n');
    
    try {
      await this.seedStaff();
      await this.generateReport();
      
      await this.pool.end();
      console.log('\n✅ Staff seeding complete!\n');
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Error:', error);
      await this.pool.end();
      process.exit(1);
    }
  }
}

// Run seeding
const seeder = new StaffSeeder();
seeder.run();
