import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createNotificationHelper } from './notification-system.tsx';

const app = new Hono();

/**
 * GET /make-server-3dd53475/prescription/booking/:bookingId
 * Get prescription for a booking
 */
app.get('/make-server-3dd53475/prescription/booking/:bookingId', async (c) => {
  try {
    const { bookingId } = c.req.param();
    
    console.log(`📋 [PRESCRIPTION] Fetching prescription for booking: ${bookingId}`);
    
    const prescription = await kv.get(`prescription:booking:${bookingId}`);
    
    if (!prescription) {
      console.log(`ℹ️  [PRESCRIPTION] No prescription found for booking: ${bookingId}`);
      return c.json({ error: 'Prescription not found' }, 404);
    }
    
    console.log(`✅ [PRESCRIPTION] Found prescription for booking: ${bookingId}`);
    
    return c.json({
      success: true,
      prescription
    });
    
  } catch (error) {
    console.error('❌ [PRESCRIPTION] Error fetching prescription:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /make-server-3dd53475/prescription/create
 * Create prescription/service notes after booking completion
 */
app.post('/make-server-3dd53475/prescription/create', async (c) => {
  try {
    const body = await c.req.json();
    const {
      bookingId,
      vendorPhone,
      diagnosis,
      observations,
      medications,
      productsUsed,
      testsRecommended,
      generalNotes,
      recommendations,
      nextFollowUpDate,
      followUpReason,
      vitals,
      attachments
    } = body;
    
    console.log(`📝 [PRESCRIPTION-CREATE] Creating prescription for booking: ${bookingId}`);
    
    // Get booking details
    const booking = await kv.get(`booking:${bookingId}`);
    if (!booking) {
      console.error(`❌ [PRESCRIPTION-CREATE] Booking not found: ${bookingId}`);
      return c.json({ error: 'Booking not found' }, 404);
    }
    
    // Verify vendor owns this booking
    if (booking.vendorPhone !== vendorPhone) {
      console.error(`❌ [PRESCRIPTION-CREATE] Vendor mismatch. Expected: ${booking.vendorPhone}, Got: ${vendorPhone}`);
      return c.json({ error: 'Unauthorized' }, 403);
    }
    
    // Check if booking is completed
    if (booking.status !== 'completed') {
      console.error(`❌ [PRESCRIPTION-CREATE] Booking not completed. Status: ${booking.status}`);
      return c.json({ error: 'Booking must be completed before adding prescription' }, 400);
    }
    
    // Create prescription object
    const prescriptionId = `prescription_${Date.now()}`;
    const prescription = {
      id: prescriptionId,
      bookingId: bookingId,
      
      // Pet & Vendor info from booking
      petId: booking.petId,
      petName: booking.petName,
      vendorId: booking.vendorId,
      vendorName: booking.vendorName,
      vendorType: booking.vendorType,
      vendorPhone: booking.vendorPhone,
      customerPhone: booking.customerPhone,
      serviceType: booking.serviceType,
      serviceName: booking.serviceName,
      
      // Medical details
      diagnosis: diagnosis || '',
      observations: observations || '',
      medications: medications || [],
      productsUsed: productsUsed || [],
      testsRecommended: testsRecommended || [],
      generalNotes: generalNotes || '',
      recommendations: recommendations || '',
      nextFollowUpDate: nextFollowUpDate || null,
      followUpReason: followUpReason || '',
      vitals: vitals || null,
      attachments: attachments || [],
      
      // Timestamps
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Save prescription
    await kv.set(`prescription:booking:${bookingId}`, prescription);
    console.log(`✅ [PRESCRIPTION-CREATE] Saved to: prescription:booking:${bookingId}`);
    
    // Also save by prescription ID
    await kv.set(`prescription:${prescriptionId}`, prescription);
    console.log(`✅ [PRESCRIPTION-CREATE] Saved to: prescription:${prescriptionId}`);
    
    // Add to pet's medical history
    const petPrescriptionsKey = `pet:${booking.petId}:prescriptions`;
    const petPrescriptions = await kv.get(petPrescriptionsKey) || [];
    petPrescriptions.unshift(prescriptionId);
    await kv.set(petPrescriptionsKey, petPrescriptions);
    console.log(`✅ [PRESCRIPTION-CREATE] Added to pet medical history: ${petPrescriptionsKey}`);
    
    // Add to vendor's prescription list
    const vendorPrescriptionsKey = `vendor:${booking.vendorId}:prescriptions`;
    const vendorPrescriptions = await kv.get(vendorPrescriptionsKey) || [];
    vendorPrescriptions.unshift(prescriptionId);
    await kv.set(vendorPrescriptionsKey, vendorPrescriptions);
    console.log(`✅ [PRESCRIPTION-CREATE] Added to vendor list: ${vendorPrescriptionsKey}`);
    
    // ✅ NOTIFICATION: Prescription Uploaded
    try {
      const customer = await kv.get(`customer:${booking.customerId}`);
      
      await createNotificationHelper(kv, {
        recipientId: booking.customerId,
        recipientType: 'customer',
        type: 'prescription_uploaded',
        category: 'bookings',
        title: 'Prescription Uploaded',
        message: `Your prescription has been uploaded for ${booking.serviceName}. You can now order medicines from nearby pharmacies.`,
        recipientEmail: customer?.email,
        recipientPhone: booking.customerPhone || customer?.phone,
        channels: { email: false, sms: true, inApp: true, push: false },
        data: { prescriptionId, bookingId, serviceName: booking.serviceName, vendorName: booking.vendorName },
        priority: 'medium'
      });

      console.log(`📱 [NOTIFICATION] Prescription uploaded notification sent to customer`);
    } catch (notifError) {
      console.error(`⚠️ [NOTIFICATION] Failed to send prescription uploaded notification:`, notifError);
      // Don't fail the request if notification fails
    }
    
    // ✅ SEND PRESCRIPTION TO CUSTOMER VIA CHAT
    try {
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const prescriptionMessage = {
        id: messageId,
        bookingId: bookingId,
        senderPhone: vendorPhone,
        senderName: booking.vendorName,
        senderType: 'vendor',
        message: 'Prescription has been added to your consultation',
        messageType: 'prescription',
        prescriptionId: prescriptionId,
        timestamp: new Date().toISOString(),
        read: false
      };
      
      // Add to chat messages
      const messagesKey = `chat:booking:${bookingId}:messages`;
      const messages = await kv.get(messagesKey) || [];
      messages.push(prescriptionMessage);
      await kv.set(messagesKey, messages);
      
      // Update last activity
      await kv.set(`chat:booking:${bookingId}:lastActivity`, new Date().toISOString());
      
      // Create notification for customer
      const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const notification = {
        type: 'prescription_received',
        title: 'Prescription Received',
        message: `Dr. ${booking.vendorName} has added your prescription for ${booking.petName}`,
        bookingId: bookingId,
        prescriptionId: prescriptionId,
        messageId: messageId,
        createdAt: new Date().toISOString(),
        read: false
      };
      
      await kv.set(`notification:${notificationId}`, notification);
      
      // Add to customer's notifications
      const cleanCustomerPhone = booking.customerPhone.replace(/[^0-9]/g, '');
      const customerNotifications = await kv.get(`customer:${cleanCustomerPhone}:notifications`) || [];
      customerNotifications.unshift(notificationId);
      await kv.set(`customer:${cleanCustomerPhone}:notifications`, customerNotifications);
      
      console.log(`✅ [PRESCRIPTION-CREATE] Prescription sent to customer via chat: ${messageId}`);
    } catch (chatError) {
      console.error('⚠️  [PRESCRIPTION-CREATE] Error sending prescription via chat:', chatError);
      // Don't fail the prescription creation if chat fails
    }
    
    console.log(`✅ [PRESCRIPTION-CREATE] Prescription created successfully: ${prescriptionId}`);
    
    return c.json({
      success: true,
      prescriptionId,
      prescription
    });
    
  } catch (error) {
    console.error('❌ [PRESCRIPTION-CREATE] Error creating prescription:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * PUT /make-server-3dd53475/prescription/update/:prescriptionId
 * Update existing prescription
 */
app.put('/make-server-3dd53475/prescription/update/:prescriptionId', async (c) => {
  try {
    const { prescriptionId } = c.req.param();
    const updates = await c.req.json();
    
    console.log(`✏️  [PRESCRIPTION-UPDATE] Updating prescription: ${prescriptionId}`);
    
    const prescription = await kv.get(`prescription:${prescriptionId}`);
    if (!prescription) {
      return c.json({ error: 'Prescription not found' }, 404);
    }
    
    // Update fields
    const updatedPrescription = {
      ...prescription,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    // Save updates
    await kv.set(`prescription:${prescriptionId}`, updatedPrescription);
    await kv.set(`prescription:booking:${prescription.bookingId}`, updatedPrescription);
    
    console.log(`✅ [PRESCRIPTION-UPDATE] Updated prescription: ${prescriptionId}`);
    
    return c.json({
      success: true,
      prescription: updatedPrescription
    });
    
  } catch (error) {
    console.error('❌ [PRESCRIPTION-UPDATE] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /make-server-3dd53475/prescription/pet/:petId
 * Get all prescriptions for a pet (medical history)
 */
app.get('/make-server-3dd53475/prescription/pet/:petId', async (c) => {
  try {
    const { petId } = c.req.param();
    
    console.log(`🏥 [PET-MEDICAL-HISTORY] Fetching prescriptions for pet: ${petId}`);
    
    const prescriptionIds = await kv.get(`pet:${petId}:prescriptions`) || [];
    
    const prescriptions = [];
    for (const prescriptionId of prescriptionIds) {
      const prescription = await kv.get(`prescription:${prescriptionId}`);
      if (prescription) {
        prescriptions.push(prescription);
      }
    }
    
    console.log(`✅ [PET-MEDICAL-HISTORY] Found ${prescriptions.length} prescriptions for pet: ${petId}`);
    
    return c.json({
      success: true,
      prescriptions,
      total: prescriptions.length
    });
    
  } catch (error) {
    console.error('❌ [PET-MEDICAL-HISTORY] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /make-server-3dd53475/prescription/:prescriptionId/pdf
 * Generate and download prescription as PDF
 */
app.get('/make-server-3dd53475/prescription/:prescriptionId/pdf', async (c) => {
  try {
    const { prescriptionId } = c.req.param();
    
    console.log(`📄 [PRESCRIPTION-PDF] Generating PDF for: ${prescriptionId}`);
    
    const prescription = await kv.get(`prescription:${prescriptionId}`);
    if (!prescription) {
      return c.json({ error: 'Prescription not found' }, 404);
    }
    
    // Generate simple HTML content for PDF (in production, use a proper PDF library)
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      line-height: 1.6;
    }
    .header {
      border-bottom: 3px solid #FF8C42;
      padding-bottom: 20px;
      margin-bottom: 20px;
    }
    .logo {
      color: #FF8C42;
      font-size: 24px;
      font-weight: bold;
    }
    .section {
      margin: 20px 0;
    }
    .section-title {
      color: #FF8C42;
      font-weight: bold;
      font-size: 16px;
      margin-bottom: 10px;
      border-bottom: 1px solid #ddd;
      padding-bottom: 5px;
    }
    .info-row {
      display: flex;
      margin: 5px 0;
    }
    .info-label {
      font-weight: bold;
      min-width: 150px;
    }
    .medication-item {
      background: #f5f5f5;
      padding: 10px;
      margin: 5px 0;
      border-left: 3px solid #FF8C42;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      text-align: center;
      color: #666;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🐾 Warmpawz</div>
    <h1>Medical Prescription</h1>
    <p><strong>Prescription ID:</strong> ${prescription.id}</p>
    <p><strong>Date:</strong> ${new Date(prescription.createdAt).toLocaleDateString('en-IN')}</p>
  </div>

  <div class="section">
    <div class="section-title">Patient Information</div>
    <div class="info-row">
      <span class="info-label">Pet Name:</span>
      <span>${prescription.petName}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Service:</span>
      <span>${prescription.serviceName}</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Veterinarian Information</div>
    <div class="info-row">
      <span class="info-label">Doctor:</span>
      <span>${prescription.vendorName}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Contact:</span>
      <span>${prescription.vendorPhone}</span>
    </div>
  </div>

  ${prescription.vitals ? `
  <div class="section">
    <div class="section-title">Vitals</div>
    <div class="info-row">
      <span class="info-label">Temperature:</span>
      <span>${prescription.vitals.temperature || 'N/A'}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Weight:</span>
      <span>${prescription.vitals.weight || 'N/A'}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Heart Rate:</span>
      <span>${prescription.vitals.heartRate || 'N/A'}</span>
    </div>
  </div>
  ` : ''}

  ${prescription.diagnosis ? `
  <div class="section">
    <div class="section-title">Diagnosis</div>
    <p>${prescription.diagnosis}</p>
  </div>
  ` : ''}

  ${prescription.observations ? `
  <div class="section">
    <div class="section-title">Observations</div>
    <p>${prescription.observations}</p>
  </div>
  ` : ''}

  ${prescription.medications && prescription.medications.length > 0 ? `
  <div class="section">
    <div class="section-title">Medications Prescribed</div>
    ${prescription.medications.map((med: any) => `
      <div class="medication-item">
        <strong>${med.name}</strong><br>
        Dosage: ${med.dosage}<br>
        Frequency: ${med.frequency}<br>
        Duration: ${med.duration}
        ${med.instructions ? `<br>Instructions: ${med.instructions}` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}

  ${prescription.testsRecommended && prescription.testsRecommended.length > 0 ? `
  <div class="section">
    <div class="section-title">Tests Recommended</div>
    <ul>
      ${prescription.testsRecommended.map((test: string) => `<li>${test}</li>`).join('')}
    </ul>
  </div>
  ` : ''}

  ${prescription.recommendations ? `
  <div class="section">
    <div class="section-title">Recommendations</div>
    <p>${prescription.recommendations}</p>
  </div>
  ` : ''}

  ${prescription.generalNotes ? `
  <div class="section">
    <div class="section-title">General Notes</div>
    <p>${prescription.generalNotes}</p>
  </div>
  ` : ''}

  ${prescription.nextFollowUpDate ? `
  <div class="section">
    <div class="section-title">Follow-up</div>
    <div class="info-row">
      <span class="info-label">Next Visit:</span>
      <span>${new Date(prescription.nextFollowUpDate).toLocaleDateString('en-IN')}</span>
    </div>
    ${prescription.followUpReason ? `
    <div class="info-row">
      <span class="info-label">Reason:</span>
      <span>${prescription.followUpReason}</span>
    </div>
    ` : ''}
  </div>
  ` : ''}

  <div class="footer">
    <p>This is a digitally generated prescription from Warmpawz</p>
    <p>For any queries, please contact us through the app</p>
  </div>
</body>
</html>
    `;
    
    console.log(`✅ [PRESCRIPTION-PDF] PDF HTML generated for: ${prescriptionId}`);
    
    // Return HTML (in production, convert to actual PDF using puppeteer or similar)
    return new Response(htmlContent, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `inline; filename="prescription_${prescriptionId}.html"`
      }
    });
    
  } catch (error) {
    console.error('❌ [PRESCRIPTION-PDF] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

export default app;