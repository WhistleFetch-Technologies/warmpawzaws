import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";

/**
 * 🎯 SPECIALIZED SERVICES ENDPOINTS
 * 
 * Enhanced center booking with specialized services
 * 
 * Features:
 * - Prescription management during booking
 * - Medical records access in booking
 * - Role-based chat integration
 * - Add-on services selection
 * - Real-time pricing updates
 * - Service bundling
 */

interface SpecializedService {
  serviceId: string;
  serviceName: string;
  category: 'grooming' | 'training' | 'boarding' | 'veterinary' | 'daycare';
  basePrice: number;
  description: string;
  duration: number; // in minutes
  requiresPrescription: boolean;
  requiresMedicalRecords: boolean;
  allowsAddOns: boolean;
  addOns?: Array<{
    addOnId: string;
    name: string;
    price: number;
    description: string;
  }>;
  vendorId: string;
  isActive: boolean;
  createdAt: string;
}

interface Prescription {
  prescriptionId: string;
  customerId: string;
  petId: string;
  doctorName: string;
  clinicName?: string;
  issuedDate: string;
  expiryDate?: string;
  diagnosis: string;
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
  }>;
  instructions?: string;
  imageUrl?: string;
  pdfUrl?: string;
  createdAt: string;
}

interface MedicalRecord {
  recordId: string;
  customerId: string;
  petId: string;
  recordType: 'vaccination' | 'surgery' | 'allergy' | 'chronic_condition' | 'lab_result' | 'general';
  title: string;
  description: string;
  date: string;
  veterinarianName?: string;
  clinicName?: string;
  documents: Array<{
    documentId: string;
    fileName: string;
    fileUrl: string;
    fileType: string;
  }>;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

interface BookingWithSpecializedServices {
  bookingId: string;
  customerId: string;
  petId: string;
  serviceId: string;
  serviceName: string;
  basePrice: number;
  addOns: Array<{
    addOnId: string;
    name: string;
    price: number;
  }>;
  totalPrice: number;
  prescriptionId?: string;
  medicalRecordIds?: string[];
  specialRequirements?: string;
  scheduledDate: string;
  scheduledTime: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

interface RoleBasedChatContext {
  contextId: string;
  bookingId: string;
  customerId: string;
  vendorId: string;
  role: 'customer' | 'vendor' | 'service_provider' | 'admin';
  serviceType: string;
  petInfo?: {
    petId: string;
    petName: string;
    breed: string;
    age: number;
  };
  bookingInfo?: {
    serviceName: string;
    scheduledDate: string;
    status: string;
  };
  medicalContext?: {
    hasActivePrescription: boolean;
    allergies: string[];
    chronicConditions: string[];
  };
  createdAt: string;
}

export function specializedServicesEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

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

      const serviceId = `SVC-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const service: SpecializedService = {
        serviceId,
        serviceName,
        category,
        basePrice,
        description: description || '',
        duration,
        requiresPrescription,
        requiresMedicalRecords,
        allowsAddOns,
        addOns,
        vendorId,
        isActive: true,
        createdAt: new Date().toISOString()
      };

      await kv.set(`specialized-service:${serviceId}`, service);

      console.log(`✅ Specialized service created: ${serviceId}`);

      return sendSuccess(c, { service }, 'Service created successfully');

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

      const allServices = await kv.getByPrefix('specialized-service:') || [];
      
      let services = allServices
        .map((item: any) => item.value || item)
        .filter((service: any) => service.vendorId === vendorId && service.isActive);

      if (category) {
        services = services.filter((s: any) => s.category === category);
      }

      return sendSuccess(c, {
        vendorId,
        count: services.length,
        services
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
      const service = await kv.get(`specialized-service:${serviceId}`);
      
      if (!service) {
        return sendError(c, 'Service not found', 404);
      }

      if (!service.isActive) {
        return sendError(c, 'Service not available', 400);
      }

      // Check prescription requirement
      if (service.requiresPrescription && !prescriptionId) {
        return sendError(c, 'Prescription required for this service', 400);
      }

      // Check medical records requirement
      if (service.requiresMedicalRecords && medicalRecordIds.length === 0) {
        return sendError(c, 'Medical records required for this service', 400);
      }

      // Calculate total price with add-ons
      let totalPrice = service.basePrice;
      const selectedAddOns: any[] = [];

      if (service.allowsAddOns && addOnIds.length > 0) {
        for (const addOnId of addOnIds) {
          const addOn = service.addOns?.find((a: any) => a.addOnId === addOnId);
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

      // Get or update booking
      let booking = await kv.get(`booking:${bookingId}`);
      
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // Add specialized service to booking
      if (!booking.specializedServices) {
        booking.specializedServices = [];
      }

      booking.specializedServices.push({
        serviceId,
        serviceName: service.serviceName,
        basePrice: service.basePrice,
        addOns: selectedAddOns,
        totalPrice
      });

      booking.totalAmount = (booking.totalAmount || 0) + totalPrice;
      
      if (prescriptionId) {
        booking.prescriptionId = prescriptionId;
      }
      
      if (medicalRecordIds.length > 0) {
        booking.medicalRecordIds = [...(booking.medicalRecordIds || []), ...medicalRecordIds];
      }

      booking.updatedAt = new Date().toISOString();

      await kv.set(`booking:${bookingId}`, booking);

      console.log(`✅ Specialized service added to booking: ${bookingId}`);

      return sendSuccess(c, {
        bookingId,
        service: {
          serviceId,
          serviceName: service.serviceName,
          addOns: selectedAddOns,
          totalPrice
        },
        newTotalAmount: booking.totalAmount
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
        customerId,
        petId,
        doctorName,
        clinicName,
        issuedDate,
        expiryDate,
        diagnosis,
        medications,
        instructions,
        imageUrl,
        pdfUrl
      } = body;

      if (!customerId || !petId || !doctorName || !diagnosis || !medications) {
        return sendError(c, 'Missing required fields', 400);
      }

      const prescriptionId = `RX-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const prescription: Prescription = {
        prescriptionId,
        customerId,
        petId,
        doctorName,
        clinicName,
        issuedDate,
        expiryDate,
        diagnosis,
        medications,
        instructions,
        imageUrl,
        pdfUrl,
        createdAt: new Date().toISOString()
      };

      await kv.set(`prescription:${prescriptionId}`, prescription);

      console.log(`✅ Prescription created: ${prescriptionId}`);

      return sendSuccess(c, { prescription }, 'Prescription created successfully');

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

      const allPrescriptions = await kv.getByPrefix('prescription:') || [];
      
      let prescriptions = allPrescriptions
        .map((item: any) => item.value || item)
        .filter((rx: any) => rx.petId === petId);

      // Filter active prescriptions (not expired)
      if (active) {
        const now = new Date();
        prescriptions = prescriptions.filter((rx: any) => {
          if (!rx.expiryDate) return true;
          return new Date(rx.expiryDate) > now;
        });
      }

      prescriptions.sort((a: any, b: any) => 
        new Date(b.issuedDate).getTime() - new Date(a.issuedDate).getTime()
      );

      return sendSuccess(c, {
        petId,
        count: prescriptions.length,
        prescriptions
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
        recordType,
        title,
        description,
        date,
        veterinarianName,
        clinicName,
        documents = [],
        tags = []
      } = body;

      if (!customerId || !petId || !recordType || !title) {
        return sendError(c, 'Missing required fields', 400);
      }

      const recordId = `MR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const record: MedicalRecord = {
        recordId,
        customerId,
        petId,
        recordType,
        title,
        description: description || '',
        date: date || new Date().toISOString(),
        veterinarianName,
        clinicName,
        documents,
        tags,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`medical-record:${recordId}`, record);

      console.log(`✅ Medical record created: ${recordId}`);

      return sendSuccess(c, { record }, 'Medical record created successfully');

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

      const allRecords = await kv.getByPrefix('medical-record:') || [];
      
      let records = allRecords
        .map((item: any) => item.value || item)
        .filter((record: any) => record.petId === petId);

      if (recordType) {
        records = records.filter((r: any) => r.recordType === recordType);
      }

      records.sort((a: any, b: any) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      return sendSuccess(c, {
        petId,
        count: records.length,
        records
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

      const booking = await kv.get(`booking:${bookingId}`);
      
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // Get pet info
      const pet = booking.petId ? await kv.get(`pet:${booking.petId}`) : null;

      // Get medical context
      let medicalContext = {
        hasActivePrescription: false,
        allergies: [],
        chronicConditions: []
      };

      if (booking.prescriptionId) {
        const prescription = await kv.get(`prescription:${booking.prescriptionId}`);
        if (prescription) {
          medicalContext.hasActivePrescription = true;
        }
      }

      if (booking.medicalRecordIds && booking.medicalRecordIds.length > 0) {
        for (const recordId of booking.medicalRecordIds) {
          const record = await kv.get(`medical-record:${recordId}`);
          if (record) {
            if (record.recordType === 'allergy') {
              medicalContext.allergies.push(record.title);
            } else if (record.recordType === 'chronic_condition') {
              medicalContext.chronicConditions.push(record.title);
            }
          }
        }
      }

      const contextId = `CTX-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const context: RoleBasedChatContext = {
        contextId,
        bookingId,
        customerId: booking.customerId,
        vendorId: booking.vendorId,
        role: role as any,
        serviceType: booking.serviceType || booking.serviceName || 'unknown',
        petInfo: pet ? {
          petId: pet.petId,
          petName: pet.petName,
          breed: pet.breed,
          age: pet.age
        } : undefined,
        bookingInfo: {
          serviceName: booking.serviceName,
          scheduledDate: booking.scheduledDate,
          status: booking.status
        },
        medicalContext,
        createdAt: new Date().toISOString()
      };

      await kv.set(`chat-context:${contextId}`, context);

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

      const service = await kv.get(`specialized-service:${serviceId}`);
      
      if (!service) {
        return sendError(c, 'Service not found', 404);
      }

      if (!service.allowsAddOns) {
        return sendError(c, 'Add-ons not allowed for this service', 400);
      }

      const selectedAddOns: any[] = [];
      let addOnTotal = 0;

      for (const addOnId of addOnIds) {
        const addOn = service.addOns?.find((a: any) => a.addOnId === addOnId);
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

      const booking = await kv.get(`booking:${bookingId}`);
      
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      if (!booking.addOns) {
        booking.addOns = [];
      }

      booking.addOns.push(...selectedAddOns);
      booking.totalAmount = (booking.totalAmount || 0) + addOnTotal;
      booking.updatedAt = new Date().toISOString();

      await kv.set(`booking:${bookingId}`, booking);

      console.log(`✅ Add-ons added to booking: ${bookingId}`);

      return sendSuccess(c, {
        bookingId,
        addOns: selectedAddOns,
        addOnTotal,
        newTotalAmount: booking.totalAmount
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

      const service = await kv.get(`specialized-service:${serviceId}`);
      
      if (!service) {
        return sendError(c, 'Service not found', 404);
      }

      let totalPrice = service.basePrice;
      const selectedAddOns: any[] = [];

      if (addOnIds.length > 0 && service.allowsAddOns) {
        for (const addOnId of addOnIds) {
          const addOn = service.addOns?.find((a: any) => a.addOnId === addOnId);
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
        serviceName: service.serviceName,
        basePrice: service.basePrice,
        addOns: selectedAddOns,
        totalPrice,
        breakdown: {
          base: service.basePrice,
          addOns: totalPrice - service.basePrice,
          total: totalPrice
        }
      });

    } catch (error) {
      console.error('❌ Error calculating pricing:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Specialized Services Endpoints registered');
}
