#!/usr/bin/env node
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://warmpawz:warmpawz@localhost:5432/warmpawz';

async function main() {
  let connectionConfig;
  if (DATABASE_URL.includes('rds.amazonaws.com')) {
    const url = new URL(DATABASE_URL.replace('postgresql://', 'https://'));
    connectionConfig = {
      host: url.hostname,
      port: parseInt(url.port || '5432', 10),
      database: url.pathname.slice(1) || 'warmpawz',
      user: url.username,
      password: url.password,
      ssl: { rejectUnauthorized: false }
    };
  } else {
    connectionConfig = { connectionString: DATABASE_URL };
  }

  const pool = new Pool(connectionConfig);
  
  try {
    const client = await pool.connect();
    console.log('📝 Creating test support ticket...');
    
    // First check if we have a customer
    let customerId;
    const customerCheck = await client.query('SELECT id FROM customers LIMIT 1');
    if (customerCheck.rows.length > 0) {
      customerId = customerCheck.rows[0].id;
      console.log('Found existing customer:', customerId);
    } else {
      // Create a test customer
      const newCustomer = await client.query(`
        INSERT INTO customers (id, email, phone, first_name, last_name, full_name, status)
        VALUES (gen_random_uuid(), 'test@example.com', '+919876543210', 'Test', 'Customer', 'Test Customer', 'active')
        RETURNING id
      `);
      customerId = newCustomer.rows[0].id;
      console.log('Created test customer:', customerId);
    }
    
    // Create test support tickets
    const tickets = [
      {
        subject: 'Need help with dog grooming appointment',
        description: 'My dog Max needs a grooming appointment. He is a Golden Retriever and needs a full grooming session including bath, nail trim, and haircut.',
        category: 'booking',
        priority: 'medium',
        source: 'app'
      },
      {
        subject: 'Question about vaccination schedule',
        description: 'I have a 6-month old Labrador puppy. Can you help me understand the vaccination schedule and when the next booster is due?',
        category: 'medical',
        priority: 'high',
        source: 'chat'
      },
      {
        subject: 'Refund request for cancelled service',
        description: 'I had to cancel my pet boarding reservation due to a family emergency. Please process my refund.',
        category: 'refund',
        priority: 'medium',
        source: 'email'
      }
    ];
    
    for (const ticket of tickets) {
      const result = await client.query(`
        INSERT INTO support_tickets (
          id, customer_id, subject, description, category, priority, source, status, created_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'open', NOW()
        )
        RETURNING id, subject
      `, [customerId, ticket.subject, ticket.description, ticket.category, ticket.priority, ticket.source]);
      
      console.log('✅ Created ticket:', result.rows[0].subject);
    }
    
    // Verify
    const count = await client.query('SELECT COUNT(*) FROM support_tickets');
    console.log('');
    console.log('Total tickets now:', count.rows[0].count);
    
    client.release();
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

main();
