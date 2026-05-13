/**
 * Seeds a sample pet for a given customer phone, then re-checks the GET endpoint
 * via direct DB read. Run with:  node scripts/seed-pet.js 9399893220
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { Pool } = require('pg');

async function main() {
  const phone = process.argv[2] || '9399893220';
  const petName = process.argv[3] || 'Oreo';

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    const c = await pool.query(
      `SELECT id, phone, full_name FROM customers
       WHERE phone = $1
          OR RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = $2
       LIMIT 1`,
      [phone, phone.slice(-10)]
    );
    if (c.rowCount === 0) {
      console.log('ABORT: customer not found for phone', phone);
      return;
    }
    const customer = c.rows[0];
    console.log('Customer:', customer);

    const existing = await pool.query(
      `SELECT id, name FROM pets WHERE customer_id = $1 AND LOWER(name) = LOWER($2)`,
      [customer.id, petName]
    );
    if (existing.rowCount > 0) {
      console.log('Pet already exists, skipping insert:', existing.rows[0]);
    } else {
      const ins = await pool.query(
        `INSERT INTO pets
           (customer_id, name, species, breed, age_years, age_months, gender, weight_kg, medical_history)
         VALUES ($1, $2, 'dog', 'Labrador', 3, 0, 'male', 22.5, '{}'::jsonb)
         RETURNING id, customer_id, name, species, breed, age_years, gender`,
        [customer.id, petName]
      );
      console.log('Inserted pet:', ins.rows[0]);
    }

    await pool.query(
      `UPDATE customer_profile_completion
         SET pet_profile_completed = true,
             pet_profile_completed_at = COALESCE(pet_profile_completed_at, NOW()),
             updated_at = NOW()
       WHERE customer_id = $1`,
      [customer.id]
    );

    const all = await pool.query(
      `SELECT id, name, species, breed, age_years, gender FROM pets WHERE customer_id = $1
       ORDER BY created_at DESC`,
      [customer.id]
    );
    console.log(`\nAll pets for ${customer.full_name} (${customer.phone}):`);
    console.table(all.rows);
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await pool.end();
  }
}

main();
