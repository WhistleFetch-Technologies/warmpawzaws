-- ============================================================================
-- SUPPORT TICKETS SAMPLE DATA
-- ============================================================================
-- This seed file creates sample support tickets for testing the Support CRM
-- Run this after the main migrations are complete
-- ============================================================================

-- Get existing customer and vendor IDs (or create sample ones if needed)
DO $$
DECLARE
    sample_customer_id UUID;
    sample_vendor_id UUID;
    ticket1_id UUID;
    ticket2_id UUID;
    ticket3_id UUID;
    ticket4_id UUID;
BEGIN
    -- Try to get an existing customer
    SELECT id INTO sample_customer_id FROM customers LIMIT 1;
    
    -- Try to get an existing vendor
    SELECT id INTO sample_vendor_id FROM vendors WHERE onboarding_status = 'approved' LIMIT 1;
    
    -- Generate UUIDs for tickets
    ticket1_id := gen_random_uuid();
    ticket2_id := gen_random_uuid();
    ticket3_id := gen_random_uuid();
    ticket4_id := gen_random_uuid();
    
    -- Insert sample support tickets
    INSERT INTO support_tickets (
        id, ticket_number, subject, message, description, category, priority, status,
        customer_id, customer_name, customer_email, customer_phone,
        source, created_at, updated_at
    ) VALUES
    (
        ticket1_id,
        'TKT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-001',
        'Unable to complete booking payment',
        'I tried to book a grooming service but the payment keeps failing. I have sufficient balance in my account. Please help.',
        'Payment failure during booking checkout',
        'billing',
        'high',
        'open',
        sample_customer_id,
        'Rahul Sharma',
        'rahul.sharma@example.com',
        '+919876543210',
        'customer',
        NOW() - INTERVAL '2 hours',
        NOW() - INTERVAL '2 hours'
    ),
    (
        ticket2_id,
        'TKT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-002',
        'Request for service cancellation and refund',
        'I need to cancel my upcoming vet appointment scheduled for tomorrow. My pet recovered and we no longer need the consultation. Please process the refund.',
        'Service cancellation and refund request',
        'service',
        'medium',
        'in_progress',
        sample_customer_id,
        'Priya Patel',
        'priya.patel@example.com',
        '+919898765432',
        'customer',
        NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '6 hours'
    ),
    (
        ticket3_id,
        'TKT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-003',
        'Vendor did not show up for home service',
        'I had booked a home pet grooming service for today at 10 AM but the vendor never showed up. I waited for 2 hours. This is very disappointing service.',
        'Missed appointment complaint',
        'service',
        'urgent',
        'open',
        sample_customer_id,
        'Amit Kumar',
        'amit.kumar@example.com',
        '+919876123456',
        'customer',
        NOW() - INTERVAL '30 minutes',
        NOW() - INTERVAL '30 minutes'
    ),
    (
        ticket4_id,
        'TKT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-004',
        'Question about vaccination schedule',
        'I recently adopted a puppy and want to know the recommended vaccination schedule. Can you provide guidance on which vaccinations are needed and when?',
        'General inquiry about pet vaccinations',
        'general',
        'low',
        'resolved',
        sample_customer_id,
        'Sneha Reddy',
        'sneha.reddy@example.com',
        '+919845678901',
        'customer',
        NOW() - INTERVAL '3 days',
        NOW() - INTERVAL '1 day'
    )
    ON CONFLICT (ticket_number) DO NOTHING;
    
    -- Insert sample responses for the in-progress ticket
    INSERT INTO support_ticket_responses (
        id, ticket_id, responder_id, responder_type, message, is_internal, created_at
    ) VALUES
    (
        gen_random_uuid(),
        ticket2_id,
        NULL,
        'agent',
        'Hello Priya, thank you for reaching out. I understand you need to cancel your upcoming appointment. I am processing your cancellation request now. The refund will be initiated within 24 hours.',
        false,
        NOW() - INTERVAL '5 hours'
    ),
    (
        gen_random_uuid(),
        ticket2_id,
        NULL,
        'customer',
        'Thank you for the quick response. How long will it take for the refund to reflect in my account?',
        false,
        NOW() - INTERVAL '4 hours'
    ),
    (
        gen_random_uuid(),
        ticket2_id,
        NULL,
        'agent',
        'The refund typically takes 5-7 business days to reflect in your original payment method. You will receive an email confirmation once the refund is processed.',
        false,
        NOW() - INTERVAL '3 hours'
    )
    ON CONFLICT DO NOTHING;
    
    -- Insert response for the resolved ticket
    INSERT INTO support_ticket_responses (
        id, ticket_id, responder_id, responder_type, message, is_internal, created_at
    ) VALUES
    (
        gen_random_uuid(),
        ticket4_id,
        NULL,
        'agent',
        'Hello Sneha, congratulations on your new puppy! Here is the recommended vaccination schedule:
        
1. 6-8 weeks: First DHPP (Distemper, Hepatitis, Parvovirus, Parainfluenza)
2. 10-12 weeks: Second DHPP + Bordetella
3. 14-16 weeks: Third DHPP + Rabies
4. 12-16 months: Booster shots

I recommend scheduling a vet consultation through our app to get a personalized vaccination plan for your puppy. Would you like me to help you book an appointment?',
        false,
        NOW() - INTERVAL '2 days'
    ),
    (
        gen_random_uuid(),
        ticket4_id,
        NULL,
        'customer',
        'This is very helpful! Thank you so much for the detailed information. I will book an appointment through the app.',
        false,
        NOW() - INTERVAL '1 day' - INTERVAL '12 hours'
    ),
    (
        gen_random_uuid(),
        ticket4_id,
        NULL,
        'agent',
        'You are welcome! I am marking this ticket as resolved. Feel free to create a new ticket if you have any more questions. Take care of your puppy!',
        false,
        NOW() - INTERVAL '1 day'
    )
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Sample support tickets created successfully!';
    RAISE NOTICE 'Ticket 1 (Open - High Priority): %', ticket1_id;
    RAISE NOTICE 'Ticket 2 (In Progress - Medium Priority): %', ticket2_id;
    RAISE NOTICE 'Ticket 3 (Open - Urgent Priority): %', ticket3_id;
    RAISE NOTICE 'Ticket 4 (Resolved - Low Priority): %', ticket4_id;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error creating sample tickets: %', SQLERRM;
END $$;

-- Verify the data was inserted
SELECT 
    ticket_number,
    subject,
    category,
    priority,
    status,
    customer_name,
    created_at
FROM support_tickets 
ORDER BY created_at DESC 
LIMIT 10;
