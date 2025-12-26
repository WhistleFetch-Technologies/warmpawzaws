/**
 * ============================================================================
 * SPECIALIZED SERVICES ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Enhanced center booking with specialized services
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with repository calls
 * - Services stored in `services` table with metadata for specialized fields
 * - Prescriptions stored in `prescriptions` table
 * - Medical records stored in `medical_records` table
 * - Booking updates use bookings repository
 * 
 * Date: 2024-12-24
 * Migration: Phase 2 - KV to SQL
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getServicesRepository } from "../../lib/repositories/services.ts";
import { getPrescriptionsRepository } from "../../lib/repositories/prescriptions.ts";
import { getMedicalRecordsRepository } from "../../lib/repositories/medical-records.ts";
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { getDbClient } from "../../lib/db.ts";

// ============================================================================
// TYPES
// ============================================================================

interface SpecializedServiceMetadata {
  requiresPrescription: boolean;
  requiresMedicalRecords: boolean;
  allowsAddOns: boolean;
  addOns?: Array<{
    addOnId: string;
    name: string;
    price: number;
    description: string;
  }>;
}

// ============================================================================
// ENDPOINTS
// ============================================================================

export function specializedServicesEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const servicesRepo = getServicesRepository();
  const prescriptionsRepo = getPrescriptionsRepository();
  const medicalRecordsRepo = getMedicalRecordsRepository();
  const bookingsRepo = getBookingsRepository();
  const db = getDbClient();

  /**
   * POST /specialized-services/create
   * Create specialized service (vendor)
   */
  app.post(`${BASE_PATH}/specialized-services/create`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        vendorId,
        serviceName,
        category,
        basePrice,
        description,
        duration = 60,
        requiresPrescription = false,
        requiresMedicalRecords = false,
        allowsAddOns = true,
        addOns = []
      } = body;

      if (!vendorId || !serviceName || !category || !basePrice) {
        return sendError(c, 'Missing required fields', 400);
      }

      // Store specialized metadata in service metadata field
      const metadata: SpecializedServiceMetadata = {
        requiresPrescription,
        requiresMedicalRecords,
        allowsAddOns,
        addOns
      };

      // Create service in SQL
      const service = await servicesRepo.create({
        vendor_id: vendorId,
        name: serviceName,
        category,
        price: basePrice,
        description: description || '',
        duration_minutes: duration
      });

      // Store specialized metadata in vendor metadata or service metadata
      // For now, we'll store it in a separate metadata field if services table has one
      // Otherwise, we can use vendor metadata
      const { getVendorsRepository } = await import('../../lib/repositories/vendors.ts');
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(vendorId);
      
      if (vendor) {
        const vendorMetadata = vendor.metadata || {};
        const specializedServices = vendorMetadata.specialized_services || {};
        specializedServices[service.id] = metadata;
        vendorMetadata.specialized_services = specializedServices;
        
        await vendorsRepo.update(vendorId, {
          metadata: vendorMetadata
        });
      }

      console.log(`✅ Specialized service created: ${service.id}`);

      return sendSuccess(c, { 
        service: {
          serviceId: service.id,
          serviceName: service.name,
          category: service.category,
          basePrice: service.price,
          description: service.description,
          duration: service.duration_minutes,
          ...metadata
        }
      }, 'Service created successfully');

    } catch (error) {
      console.error('❌ Error creating service:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /specialized-services/vendor/:vendorId
   * Get vendor's specialized services
   */
  app.get(`${BASE_PATH}/specialized-services/vendor/:vendorId`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const category = c.req.query('category');

      // Get services for vendor
      let services = await servicesRepo.findByVendor(vendorId);

      if (category) {
        services = services.filter(s => s.category === category);
      }

      // Get specialized metadata from vendor
      const { getVendorsRepository } = await import('../../lib/repositories/vendors.ts');
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(vendorId);
      const vendorMetadata = vendor?.metadata || {};
      const specializedServices = vendorMetadata.specialized_services || {};

      // Map services with specialized metadata
      const mappedServices = services.map(service => {
        const specialized = specializedServices[service.id] || {};
        return {
          serviceId: service.id,
          serviceName: service.name,
          category: service.category,
          basePrice: service.price,
          description: service.description,
          duration: service.duration_minutes || 60,
          requiresPrescription: specialized.requiresPrescription || false,
          requiresMedicalRecords: specialized.requiresMedicalRecords || false,
          allowsAddOns: specialized.allowsAddOns !== false,
          addOns: specialized.addOns || [],
          vendorId: service.vendor_id,
          isActive: service.is_active,
          createdAt: service.created_at
        };
      });

      return sendSuccess(c, {
        vendorId,
        count: mappedServices.length,
        services: mappedServices
      });

    } catch (error) {
      console.error('❌ Error fetching services:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /booking/:bookingId/add-specialized-service
   * Add specialized service to booking
   */
  app.post(`${BASE_PATH}/booking/:bookingId/add-specialized-service`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const body = await c.req.json();
      const { serviceId, addOnIds = [], prescriptionId, medicalRecordIds = [] } = body;

      if (!serviceId) {
        return sendError(c, 'Missing serviceId', 400);
      }

      // Get service details
      const service = await servicesRepo.findById(serviceId);
      
      if (!service) {
        return sendError(c, 'Service not found', 404);
      }

      if (!service.is_active) {
        return sendError(c, 'Service not available', 400);
      }

      // Get specialized metadata
      const { getVendorsRepository } = await import('../../lib/repositories/vendors.ts');
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(service.vendor_id || '');
      const vendorMetadata = vendor?.metadata || {};
      const specializedServices = vendorMetadata.specialized_services || {};
      const specialized = specializedServices[serviceId] || {};

      // Check prescription requirement
      if (specialized.requiresPrescription && !prescriptionId) {
        return sendError(c, 'Prescription required for this service', 400);
      }

      // Check medical records requirement
      if (specialized.requiresMedicalRecords && medicalRecordIds.length === 0) {
        return sendError(c, 'Medical records required for this service', 400);
      }

      // Calculate total price with add-ons
      let totalPrice = service.price;
      const selectedAddOns: any[] = [];

      if (specialized.allowsAddOns && addOnIds.length > 0) {
        for (const addOnId of addOnIds) {
          const addOn = specialized.addOns?.find((a: any) => a.addOnId === addOnId);
          if (addOn) {
            totalPrice += addOn.price;
            selectedAddOns.push({
              addOnId: addOn.addOnId,
              name: addOn.name,
              price: addOn.price
            });
          }
        }
      }

      // Get booking
      const booking = await bookingsRepo.findById(bookingId);
      
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // Update booking with specialized service info
      // Store in booking notes or metadata
      const notes = booking.notes || '';
      const specializedData = {
        serviceId,
        serviceName: service.name,
        basePrice: service.price,
        addOns: selectedAddOns,
        totalPrice,
        prescriptionId,
        medicalRecordIds
      };

      const updatedNotes = notes 
        ? `${notes}\n[Specialized Service]: ${JSON.stringify(specializedData)}`
        : JSON.stringify(specializedData);

      await bookingsRepo.update(bookingId, {
        notes: updatedNotes,
        total_amount: booking.total_amount + totalPrice
      });

      console.log(`✅ Specialized service added to booking: ${bookingId}`);

      return sendSuccess(c, {
        bookingId,
        service: {
          serviceId,
          serviceName: service.name,
          addOns: selectedAddOns,
          totalPrice
        },
        newTotalAmount: booking.total_amount + totalPrice
      }, 'Service added to booking successfully');

    } catch (error) {
      console.error('❌ Error adding service to booking:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /prescription/create
   * Create/upload prescription
   */
  app.post(`${BASE_PATH}/prescription/create`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        bookingId,
        customerId,
        petId,
        vendorId,
        staffId,
        doctorName,
        clinicName,
        diagnosis,
        medications,
        observations,
        prescriptionFileUrl,
        attachments,
        expiresAt
      } = body;

      if (!bookingId || !customerId || !petId || !vendorId || !medications) {
        return sendError(c, 'Missing required fields', 400);
      }

      // Create prescription in SQL
      const prescription = await prescriptionsRepo.create({
        booking_id: bookingId,
        pet_id: petId,
        customer_id: customerId,
        vendor_id: vendorId,
        staff_id: staffId,
        diagnosis,
        observations,
        medications: Array.isArray(medications) ? medications : [],
        prescription_file_url: prescriptionFileUrl,
        attachments: attachments || [],
        created_by: staffId || vendorId,
        created_by_role: staffId ? 'staff' : 'vendor',
        expires_at: expiresAt
      });

      console.log(`✅ Prescription created: ${prescription.id}`);

      return sendSuccess(c, { 
        prescription: {
          prescriptionId: prescription.id,
          prescriptionNumber: prescription.prescription_number,
          ...prescription
        }
      }, 'Prescription created successfully');

    } catch (error) {
      console.error('❌ Error creating prescription:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /prescription/pet/:petId
   * Get pet's prescriptions
   */
  app.get(`${BASE_PATH}/prescription/pet/:petId`, async (c) => {
    try {
      const { petId } = c.req.param();
      const active = c.req.query('active') === 'true';

      // Get prescriptions using direct query (access control would be handled by repository if needed)
      const { data: prescriptions } = await db
        .from('prescriptions')
        .select('*')
        .eq('pet_id', petId)
        .order('created_at', { ascending: false });

      let filtered = prescriptions || [];
      
      // Filter active prescriptions (not expired)
      if (active) {
        const now = new Date();
        filtered = filtered.filter((rx: any) => {
          if (rx.status !== 'active') return false;
          if (!rx.expires_at) return true;
          return new Date(rx.expires_at) > now;
        });
      }

      return sendSuccess(c, {
        petId,
        count: filtered.length,
        prescriptions: filtered
      });

    } catch (error) {
      console.error('❌ Error fetching prescriptions:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /medical-record/create
   * Create medical record
   */
  app.post(`${BASE_PATH}/medical-record/create`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        customerId,
        petId,
        bookingId,
        vendorId,
        staffId,
        recordType,
        title,
        description,
        diagnosis,
        treatmentNotes,
        medications,
        veterinarianName,
        veterinarianLicense,
        recordDate,
        attachments = [],
        isConfidential = false
      } = body;

      if (!petId || !recordType || !title) {
        return sendError(c, 'Missing required fields', 400);
      }

      // Create medical record in SQL
      const record = await medicalRecordsRepo.create({
        pet_id: petId,
        booking_id: bookingId,
        vendor_id: vendorId,
        staff_id: staffId,
        record_type: recordType,
        title,
        description,
        diagnosis,
        treatment_notes: treatmentNotes,
        medications: medications ? (Array.isArray(medications) ? medications : [medications]) : null,
        veterinarian_name: veterinarianName,
        veterinarian_license: veterinarianLicense,
        record_date: recordDate || new Date().toISOString(),
        attachments: attachments,
        is_confidential: isConfidential,
        created_by: staffId || vendorId || customerId,
        created_by_role: staffId ? 'staff' : (vendorId ? 'vendor' : 'admin')
      });

      console.log(`✅ Medical record created: ${record.id}`);

      return sendSuccess(c, { 
        record: {
          recordId: record.id,
          ...record
        }
      }, 'Medical record created successfully');

    } catch (error) {
      console.error('❌ Error creating medical record:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /medical-record/pet/:petId
   * Get pet's medical records
   */
  app.get(`${BASE_PATH}/medical-record/pet/:petId`, async (c) => {
    try {
      const { petId } = c.req.param();
      const recordType = c.req.query('type');

      // Get medical records using direct query
      const { data: records } = await db
        .from('medical_records')
        .select('*')
        .eq('pet_id', petId)
        .is('deleted_at', null)
        .order('record_date', { ascending: false });

      let filtered = records || [];

      if (recordType) {
        filtered = filtered.filter((r: any) => r.record_type === recordType);
      }

      return sendSuccess(c, {
        petId,
        count: filtered.length,
        records: filtered
      });

    } catch (error) {
      console.error('❌ Error fetching medical records:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /booking/:bookingId/chat/role-context
   * Get role-based chat context for booking
   */
  app.get(`${BASE_PATH}/booking/:bookingId/chat/role-context`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const role = c.req.query('role') || 'customer';

      const booking = await bookingsRepo.findById(bookingId);
      
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // Get pet info (using direct query for simplicity)
      let pet = null;
      if (booking.pet_id) {
        const { data: petData } = await db
          .from('pets')
          .select('*')
          .eq('id', booking.pet_id)
          .maybeSingle();
        pet = petData;
      }

      // Get medical context
      let medicalContext = {
        hasActivePrescription: false,
        allergies: [] as string[],
        chronicConditions: [] as string[]
      };

      // Check for active prescriptions (using direct query for simplicity)
      if (booking.pet_id) {
        const { data: prescriptions } = await db
          .from('prescriptions')
          .select('*')
          .eq('pet_id', booking.pet_id)
          .eq('status', 'active');
        
        const activePrescriptions = (prescriptions || []).filter((rx: any) => {
          if (!rx.expires_at) return true;
          return new Date(rx.expires_at) > new Date();
        });
        medicalContext.hasActivePrescription = activePrescriptions.length > 0;
      }

      // Get medical records for allergies and chronic conditions
      if (booking.pet_id) {
        const { data: records } = await db
          .from('medical_records')
          .select('*')
          .eq('pet_id', booking.pet_id)
          .is('deleted_at', null);
        
        (records || []).forEach((record: any) => {
          if (record.record_type === 'allergy' && record.title) {
            medicalContext.allergies.push(record.title);
          } else if (record.record_type === 'chronic_condition' && record.title) {
            medicalContext.chronicConditions.push(record.title);
          }
        });
      }

      const context = {
        contextId: `CTX-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        bookingId,
        customerId: booking.customer_id,
        vendorId: booking.vendor_id || '',
        role: role as any,
        serviceType: booking.service_type || 'unknown',
        petInfo: pet ? {
          petId: pet.id,
          petName: pet.name,
          breed: pet.breed || '',
          age: pet.age || 0
        } : undefined,
        bookingInfo: {
          serviceName: booking.service_id || 'Service',
          scheduledDate: booking.scheduled_date || booking.booking_date || '',
          status: booking.status
        },
        medicalContext,
        createdAt: new Date().toISOString()
      };

      return sendSuccess(c, { context });

    } catch (error) {
      console.error('❌ Error getting chat context:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /booking/:bookingId/add-ons
   * Add add-on services to booking
   */
  app.post(`${BASE_PATH}/booking/:bookingId/add-ons`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const body = await c.req.json();
      const { serviceId, addOnIds } = body;

      if (!serviceId || !addOnIds || addOnIds.length === 0) {
        return sendError(c, 'Missing serviceId or addOnIds', 400);
      }

      const service = await servicesRepo.findById(serviceId);
      
      if (!service) {
        return sendError(c, 'Service not found', 404);
      }

      // Get specialized metadata
      const { getVendorsRepository } = await import('../../lib/repositories/vendors.ts');
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(service.vendor_id || '');
      const vendorMetadata = vendor?.metadata || {};
      const specializedServices = vendorMetadata.specialized_services || {};
      const specialized = specializedServices[serviceId] || {};

      if (!specialized.allowsAddOns) {
        return sendError(c, 'Add-ons not allowed for this service', 400);
      }

      const selectedAddOns: any[] = [];
      let addOnTotal = 0;

      for (const addOnId of addOnIds) {
        const addOn = specialized.addOns?.find((a: any) => a.addOnId === addOnId);
        if (addOn) {
          selectedAddOns.push({
            addOnId: addOn.addOnId,
            name: addOn.name,
            price: addOn.price,
            description: addOn.description
          });
          addOnTotal += addOn.price;
        }
      }

      const booking = await bookingsRepo.findById(bookingId);
      
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // Update booking with add-ons
      const notes = booking.notes || '';
      const addOnsData = {
        serviceId,
        addOns: selectedAddOns,
        addOnTotal
      };

      const updatedNotes = notes 
        ? `${notes}\n[Add-Ons]: ${JSON.stringify(addOnsData)}`
        : JSON.stringify(addOnsData);

      await bookingsRepo.update(bookingId, {
        notes: updatedNotes,
        total_amount: booking.total_amount + addOnTotal
      });

      console.log(`✅ Add-ons added to booking: ${bookingId}`);

      return sendSuccess(c, {
        bookingId,
        addOns: selectedAddOns,
        addOnTotal,
        newTotalAmount: booking.total_amount + addOnTotal
      }, 'Add-ons added successfully');

    } catch (error) {
      console.error('❌ Error adding add-ons:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /specialized-services/:serviceId/pricing
   * Calculate dynamic pricing with add-ons
   */
  app.get(`${BASE_PATH}/specialized-services/:serviceId/pricing`, async (c) => {
    try {
      const { serviceId } = c.req.param();
      const addOnIds = c.req.query('addOns')?.split(',') || [];

      const service = await servicesRepo.findById(serviceId);
      
      if (!service) {
        return sendError(c, 'Service not found', 404);
      }

      // Get specialized metadata
      const { getVendorsRepository } = await import('../../lib/repositories/vendors.ts');
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(service.vendor_id || '');
      const vendorMetadata = vendor?.metadata || {};
      const specializedServices = vendorMetadata.specialized_services || {};
      const specialized = specializedServices[serviceId] || {};

      let totalPrice = service.price;
      const selectedAddOns: any[] = [];

      if (addOnIds.length > 0 && specialized.allowsAddOns) {
        for (const addOnId of addOnIds) {
          const addOn = specialized.addOns?.find((a: any) => a.addOnId === addOnId);
          if (addOn) {
            selectedAddOns.push({
              addOnId: addOn.addOnId,
              name: addOn.name,
              price: addOn.price
            });
            totalPrice += addOn.price;
          }
        }
      }

      return sendSuccess(c, {
        serviceId,
        serviceName: service.name,
        basePrice: service.price,
        addOns: selectedAddOns,
        totalPrice,
        breakdown: {
          base: service.price,
          addOns: totalPrice - service.price,
          total: totalPrice
        }
      });

    } catch (error) {
      console.error('❌ Error calculating pricing:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Specialized Services Endpoints registered (SQL-only)');
}

