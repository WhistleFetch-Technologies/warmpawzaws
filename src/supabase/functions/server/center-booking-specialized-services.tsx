/**
 * CENTER BOOKING WITH SPECIALIZED SERVICES INTEGRATION
 * Production-Grade Implementation
 * 
 * Features:
 * - Complete booking lifecycle with specialized services
 * - Prescription management integration
 * - Medical record management
 * - Service add-ons during booking
 * - Post-booking service additions
 */

import { Hono } from 'npm:hono@4';
import * as kv from './kv_store.tsx';

interface SpecializedService {
  id: string;
  name: string;
  type: 'prescription' | 'medical_record' | 'diagnostics' | 'follow_up' | 'custom';
  price?: number;
  description?: string;
  required: boolean;
}

interface BookingWithServices {
  bookingId: string;
  baseServices: string[];
  specializedServices: SpecializedService[];
  prescriptionId?: string;
  medicalRecordId?: string;
  followUpDate?: string;
  totalAmount: number;
}

export function centerBookingSpecializedServicesEndpoints(app: Hono) {
  const BASE = '/make-server-3dd53475';

  /**
   * POST /center-booking/create-with-services
   * Create center booking with specialized services
   */
  app.post(`${BASE}/center-booking/create-with-services`, async (c) => {
    try {
      const {
        customerId,
        vendorId,
        centerId,
        petId,
        baseServices,
        specializedServices,
        scheduledDate,
        scheduledTime,
        notes
      } = await c.req.json();

      if (!customerId || !vendorId || !centerId || !petId || !baseServices || !scheduledDate) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      console.log(`🏥 [CENTER-BOOKING] Creating booking with specialized services`);

      // Get vendor and center details
      const vendor = await kv.get(`vendor:${vendorId}`);
      const center = await kv.get(`center:${centerId}`) || vendor;

      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Calculate total amount
      let totalAmount = 0;
      const baseServicePrices = await Promise.all(
        baseServices.map(async (serviceId: string) => {
          const service = await kv.get(`service:${serviceId}`);
          return service?.price || 0;
        })
      );
      totalAmount = baseServicePrices.reduce((sum, price) => sum + price, 0);

      // Add specialized services prices
      const specializedServicePrices = (specializedServices || []).map((s: SpecializedService) => s.price || 0);
      totalAmount += specializedServicePrices.reduce((sum, price) => sum + price, 0);

      // Create booking
      const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const booking = {
        id: bookingId,
        customerId,
        vendorId,
        centerId,
        petId,
        serviceStyle: 'at_center',
        serviceType: 'center_visit',
        baseServices,
        specializedServices: specializedServices || [],
        scheduledDate,
        scheduledTime,
        totalAmount,
        status: 'confirmed',
        notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`booking:${bookingId}`, booking);

      // Link to customer
      const customerBookings = await kv.get(`customer:${customerId}:bookings`) || [];
      customerBookings.push(bookingId);
      await kv.set(`customer:${customerId}:bookings`, customerBookings);

      // Link to vendor
      const vendorBookings = await kv.get(`vendor:${vendorId}:bookings`) || [];
      vendorBookings.push(bookingId);
      await kv.set(`vendor:${vendorId}:bookings`, vendorBookings);

      // Link to center
      const centerBookings = await kv.get(`center:${centerId}:bookings`) || [];
      centerBookings.push(bookingId);
      await kv.set(`center:${centerId}:bookings`, centerBookings);

      console.log(`✅ [CENTER-BOOKING] Created booking: ${bookingId}`);

      return c.json({
        success: true,
        booking,
        message: 'Booking created with specialized services'
      });

    } catch (error) {
      console.error('❌ [CENTER-BOOKING] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /center-booking/:bookingId/add-specialized-service
   * Add specialized service to existing booking
   */
  app.post(`${BASE}/center-booking/:bookingId/add-specialized-service`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { service, vendorId } = await c.req.json();

      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      if (booking.vendorId !== vendorId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }

      // Add service
      const specializedServices = booking.specializedServices || [];
      specializedServices.push(service);

      // Update total amount
      booking.totalAmount = (booking.totalAmount || 0) + (service.price || 0);
      booking.specializedServices = specializedServices;
      booking.updatedAt = new Date().toISOString();

      await kv.set(`booking:${bookingId}`, booking);

      return c.json({
        success: true,
        booking,
        message: 'Specialized service added'
      });

    } catch (error) {
      console.error('❌ [CENTER-BOOKING] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /center-booking/:bookingId/attach-prescription
   * Attach prescription to booking
   */
  app.post(`${BASE}/center-booking/:bookingId/attach-prescription`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const {
        vendorId,
        prescriptionId,
        diagnosis,
        medications,
        instructions,
        followUpDate
      } = await c.req.json();

      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      if (booking.vendorId !== vendorId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }

      // Create or update prescription
      const prescription = {
        id: prescriptionId || `prescription_${Date.now()}`,
        bookingId,
        vendorId,
        customerId: booking.customerId,
        petId: booking.petId,
        diagnosis,
        medications: medications || [],
        instructions,
        followUpDate,
        createdAt: new Date().toISOString()
      };

      await kv.set(`prescription:${prescription.id}`, prescription);

      // Link to booking
      booking.prescriptionId = prescription.id;
      booking.hasPrescription = true;
      booking.updatedAt = new Date().toISOString();
      await kv.set(`booking:${bookingId}`, booking);

      // Add to pet's medical records
      const petRecords = await kv.get(`pet:${booking.petId}:medical_records`) || { prescriptions: [] };
      petRecords.prescriptions.push(prescription.id);
      await kv.set(`pet:${booking.petId}:medical_records`, petRecords);

      return c.json({
        success: true,
        prescription,
        booking,
        message: 'Prescription attached successfully'
      });

    } catch (error) {
      console.error('❌ [CENTER-BOOKING] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /center-booking/:bookingId/attach-medical-record
   * Attach medical record to booking
   */
  app.post(`${BASE}/center-booking/:bookingId/attach-medical-record`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const {
        vendorId,
        recordType,
        notes,
        vitals,
        attachments,
        testResults
      } = await c.req.json();

      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      if (booking.vendorId !== vendorId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }

      // Create medical record
      const recordId = `medical_record_${Date.now()}`;
      const medicalRecord = {
        id: recordId,
        bookingId,
        vendorId,
        customerId: booking.customerId,
        petId: booking.petId,
        recordType,
        notes,
        vitals: vitals || {},
        attachments: attachments || [],
        testResults: testResults || [],
        createdAt: new Date().toISOString()
      };

      await kv.set(`medical_record:${recordId}`, medicalRecord);

      // Link to booking
      booking.medicalRecordId = recordId;
      booking.hasMedicalRecord = true;
      booking.updatedAt = new Date().toISOString();
      await kv.set(`booking:${bookingId}`, booking);

      // Add to pet's medical records
      const petRecords = await kv.get(`pet:${booking.petId}:medical_records`) || { records: [] };
      petRecords.records.push(recordId);
      await kv.set(`pet:${booking.petId}:medical_records`, petRecords);

      return c.json({
        success: true,
        medicalRecord,
        booking,
        message: 'Medical record attached successfully'
      });

    } catch (error) {
      console.error('❌ [CENTER-BOOKING] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /center-booking/:bookingId/specialized-services
   * Get all specialized services for a booking
   */
  app.get(`${BASE}/center-booking/:bookingId/specialized-services`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const booking = await kv.get(`booking:${bookingId}`);

      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const services = {
        specializedServices: booking.specializedServices || [],
        prescription: booking.prescriptionId ? await kv.get(`prescription:${booking.prescriptionId}`) : null,
        medicalRecord: booking.medicalRecordId ? await kv.get(`medical_record:${booking.medicalRecordId}`) : null,
        followUpDate: booking.followUpDate || null
      };

      return c.json({
        success: true,
        services
      });

    } catch (error) {
      console.error('❌ [CENTER-BOOKING] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  console.log('✅ Center Booking with Specialized Services endpoints registered');
}

