#!/usr/bin/env node
/**
 * Seed Sample Support Tickets on AWS RDS
 * Creates sample support tickets for testing the Support CRM UI
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function seedSupportTickets() {
  console.log('🌱 Seeding Sample Support Tickets - AWS RDS');
  console.log('============================================');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);
  console.log('');

  const { execSync } = require('child_process');
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;

  console.log('📊 Getting RDS cluster information...');
  
  let endpoint, port, dbName, username;
  
  try {
    endpoint = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text`,
      { encoding: 'utf8' }
    ).trim();

    port = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Port' --output text`,
      { encoding: 'utf8' }
    ).trim() || '5432';

    dbName = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].DatabaseName' --output text`,
      { encoding: 'utf8' }
    ).trim() || 'warmpawz';

    username = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].MasterUsername' --output text`,
      { encoding: 'utf8' }
    ).trim() || 'warmpawz_admin';
  } catch (err) {
    console.error('❌ ERROR: Failed to get RDS cluster info:', err.message);
    process.exit(1);
  }

  console.log(`   Endpoint: ${endpoint}:${port}/${dbName}`);

  // Get password from Secrets Manager
  console.log('🔐 Getting credentials...');
  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  
  let password;
  try {
    const secretValue = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );
    const secret = JSON.parse(secretValue.SecretString);
    password = secret.password || secret.Password;
  } catch (err) {
    console.error('❌ ERROR: Could not get password:', err.message);
    process.exit(1);
  }

  console.log('✅ Credentials retrieved');

  // Connect to database
  const pool = new Pool({
    host: endpoint,
    port: parseInt(port, 10),
    database: dbName,
    user: username,
    password: password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });

  try {
    await pool.query('SELECT 1');
    console.log('✅ Connected to database');
    console.log('');

    // Get a sample customer ID if available
    const customerResult = await pool.query(`SELECT id FROM customers LIMIT 1`);
    const customerId = customerResult.rows[0]?.id || null;
    console.log(`   Sample customer ID: ${customerId || 'none found'}`);

    // Generate ticket numbers based on current date
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    // Sample tickets
    const tickets = [
      {
        ticket_number: `TKT-${dateStr}-001`,
        subject: 'Unable to complete booking payment',
        message: 'I tried to book a grooming service but the payment keeps failing. I have sufficient balance in my account. Please help.',
        category: 'billing',
        priority: 'high',
        status: 'open',
        source: 'customer',
        customer_name: 'Rahul Sharma',
        customer_email: 'rahul.sharma@example.com',
        customer_phone: '+919876543210',
        hours_ago: 2,
      },
      {
        ticket_number: `TKT-${dateStr}-002`,
        subject: 'Request for service cancellation and refund',
        message: 'I need to cancel my upcoming vet appointment scheduled for tomorrow. My pet recovered and we no longer need the consultation. Please process the refund.',
        category: 'service',
        priority: 'medium',
        status: 'in_progress',
        source: 'customer',
        customer_name: 'Priya Patel',
        customer_email: 'priya.patel@example.com',
        customer_phone: '+919898765432',
        hours_ago: 24,
      },
      {
        ticket_number: `TKT-${dateStr}-003`,
        subject: 'Vendor did not show up for home service',
        message: 'I had booked a home pet grooming service for today at 10 AM but the vendor never showed up. I waited for 2 hours. This is very disappointing service.',
        category: 'service',
        priority: 'urgent',
        status: 'open',
        source: 'customer',
        customer_name: 'Amit Kumar',
        customer_email: 'amit.kumar@example.com',
        customer_phone: '+919876123456',
        hours_ago: 0.5,
      },
      {
        ticket_number: `TKT-${dateStr}-004`,
        subject: 'Question about vaccination schedule',
        message: 'I recently adopted a puppy and want to know the recommended vaccination schedule. Can you provide guidance on which vaccinations are needed and when?',
        category: 'general',
        priority: 'low',
        status: 'resolved',
        source: 'customer',
        customer_name: 'Sneha Reddy',
        customer_email: 'sneha.reddy@example.com',
        customer_phone: '+919845678901',
        hours_ago: 72,
      },
    ];

    console.log('🎫 Creating sample support tickets...');
    
    const ticketIds = [];
    for (const ticket of tickets) {
      const createdAt = new Date(Date.now() - ticket.hours_ago * 60 * 60 * 1000);
      
      // Check if ticket already exists
      const existing = await pool.query(
        `SELECT id FROM support_tickets WHERE ticket_number = $1`,
        [ticket.ticket_number]
      );
      
      if (existing.rows.length > 0) {
        console.log(`   ⚠️ Ticket ${ticket.ticket_number} already exists, skipping`);
        ticketIds.push(existing.rows[0].id);
        continue;
      }

      const result = await pool.query(`
        INSERT INTO support_tickets (
          ticket_number, subject, message, category, priority, status, source,
          customer_id, customer_name, customer_email, customer_phone,
          created_at, updated_at, last_updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12, $12)
        RETURNING id
      `, [
        ticket.ticket_number,
        ticket.subject,
        ticket.message,
        ticket.category,
        ticket.priority,
        ticket.status,
        ticket.source,
        customerId,
        ticket.customer_name,
        ticket.customer_email,
        ticket.customer_phone,
        createdAt,
      ]);
      
      ticketIds.push(result.rows[0].id);
      console.log(`   ✅ Created ticket: ${ticket.ticket_number} (${ticket.status})`);
    }

    // Add sample responses for the in-progress ticket (ticket 2)
    console.log('');
    console.log('💬 Adding sample responses...');
    
    const ticket2Id = ticketIds[1];
    if (ticket2Id) {
      const responses = [
        {
          message: 'Hello Priya, thank you for reaching out. I understand you need to cancel your upcoming appointment. I am processing your cancellation request now. The refund will be initiated within 24 hours.',
          responder_type: 'agent',
          responder_name: 'Support Agent',
          hours_ago: 5,
        },
        {
          message: 'Thank you for the quick response. How long will it take for the refund to reflect in my account?',
          responder_type: 'customer',
          responder_name: 'Priya Patel',
          hours_ago: 4,
        },
        {
          message: 'The refund typically takes 5-7 business days to reflect in your original payment method. You will receive an email confirmation once the refund is processed.',
          responder_type: 'agent',
          responder_name: 'Support Agent',
          hours_ago: 3,
        },
      ];

      for (const resp of responses) {
        const respCreatedAt = new Date(Date.now() - resp.hours_ago * 60 * 60 * 1000);
        await pool.query(`
          INSERT INTO support_ticket_responses (
            ticket_id, message, responder_type, responder_name, is_internal, created_at
          ) VALUES ($1, $2, $3, $4, false, $5)
          ON CONFLICT DO NOTHING
        `, [ticket2Id, resp.message, resp.responder_type, resp.responder_name, respCreatedAt]);
      }
      console.log(`   ✅ Added 3 responses to ticket ${tickets[1].ticket_number}`);
    }

    // Add sample responses for the resolved ticket (ticket 4)
    const ticket4Id = ticketIds[3];
    if (ticket4Id) {
      const responses = [
        {
          message: `Hello Sneha, congratulations on your new puppy! Here is the recommended vaccination schedule:
        
1. 6-8 weeks: First DHPP (Distemper, Hepatitis, Parvovirus, Parainfluenza)
2. 10-12 weeks: Second DHPP + Bordetella
3. 14-16 weeks: Third DHPP + Rabies
4. 12-16 months: Booster shots

I recommend scheduling a vet consultation through our app to get a personalized vaccination plan for your puppy. Would you like me to help you book an appointment?`,
          responder_type: 'agent',
          responder_name: 'Support Agent',
          hours_ago: 48,
        },
        {
          message: 'This is very helpful! Thank you so much for the detailed information. I will book an appointment through the app.',
          responder_type: 'customer',
          responder_name: 'Sneha Reddy',
          hours_ago: 36,
        },
        {
          message: 'You are welcome! I am marking this ticket as resolved. Feel free to create a new ticket if you have any more questions. Take care of your puppy!',
          responder_type: 'agent',
          responder_name: 'Support Agent',
          hours_ago: 24,
        },
      ];

      for (const resp of responses) {
        const respCreatedAt = new Date(Date.now() - resp.hours_ago * 60 * 60 * 1000);
        await pool.query(`
          INSERT INTO support_ticket_responses (
            ticket_id, message, responder_type, responder_name, is_internal, created_at
          ) VALUES ($1, $2, $3, $4, false, $5)
          ON CONFLICT DO NOTHING
        `, [ticket4Id, resp.message, resp.responder_type, resp.responder_name, respCreatedAt]);
      }
      console.log(`   ✅ Added 3 responses to ticket ${tickets[3].ticket_number}`);
    }

    // Show summary
    console.log('');
    console.log('🔍 Verifying seeded data...');
    const summary = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM support_tickets 
      GROUP BY status 
      ORDER BY status
    `);
    
    console.log('   Tickets by status:');
    for (const row of summary.rows) {
      console.log(`     - ${row.status}: ${row.count}`);
    }

    const responseCount = await pool.query(`
      SELECT COUNT(*) as count FROM support_ticket_responses
    `);
    console.log(`   Total responses: ${responseCount.rows[0].count}`);

    console.log('');
    console.log('✅ Sample Support Tickets Seeded Successfully!');
    console.log('');
    console.log('You can now:');
    console.log('1. Open the Support CRM page in the admin dashboard');
    console.log('2. View and interact with the sample tickets');
    console.log('3. Test reply, assign, escalate, and other actions');

  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedSupportTickets().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
