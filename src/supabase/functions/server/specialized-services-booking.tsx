import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * 🏥 SPECIALIZED SERVICES BOOKING INTEGRATION
 * 
 * Integrates specialized services into center booking flow:
 * - Prescription management
 * - Medical records access
 * - Role-based chat
 * - Add-on services
 * 
 * Features:
 * - Add specialized services during booking
 * - Access medical history
 * - Request prescription
 * - Role-based chat context
 * - Add-on service selection
 */

interface SpecializedServiceConfig {
  prescriptionAllowed: boolean;
  medicalRecordsRequired: boolean;
  chatEnabled: boolean;
  allowedRoles: string[];
  addOnServices: string[];
}

interface BookingSpecializedServices {
  bookingId: string;
  customerId: string;
  petId: string;
  
  // Prescription
  prescriptionRequested: boolean;
  prescriptionId?: string;
  prescriptionNotes?: string;
  
  // Medical records
  medicalRecordsShared: boolean;
  sharedRecordIds?: string[];
  
  // Chat
  chatSessionId?: string;
  chatRoleContext?: string;
  
  // Add-ons
  addOnServices: {
    serviceId: string;
    serviceName: string;
    price: number;
    duration?: number;
  }[];
  
  createdAt: string;
  updatedAt: string;
}

export function specializedServicesBooking(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

  /**
   * GET /booking/:bookingId/specialized-services/config
   * Get specialized services configuration for a booking
   */
  app.get(`${BASE_PATH}/booking/:bookingId/specialized-services/config`, async (c) => {
    try {
      const { bookingId } = c.req.param();

      // Get booking details
      const booking = await kv.get(`booking:${bookingId}`);
      
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // Get vendor configuration
      const vendor = await kv.get(`vendor:${booking.vendorId}`);
      
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      // Get service configuration
      const service = await kv.get(`service:${booking.serviceId}`);

      // Build configuration
      const config: SpecializedServiceConfig = {
        prescriptionAllowed: vendor.services?.includes('prescription') || false,
        medicalRecordsRequired: service?.requiresMedicalRecords || false,
        chatEnabled: vendor.features?.chat || false,
        allowedRoles: vendor.roles || ['veterinarian', 'nurse', 'receptionist'],
        addOnServices: vendor.addOnServices || []
      };

      return sendSuccess(c, { config });

    } catch (error) {
      console.error('❌ Error fetching specialized services config:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /booking/:bookingId/add-specialized-services
   * Add specialized services to an existing booking
   */
  app.post(`${BASE_PATH}/booking/:bookingId/add-specialized-services`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const {
        prescriptionRequested,
        prescriptionNotes,
        sharemedicalRecords,
        recordIds,
        chatRoleContext,
        addOnServices
      } = await c.req.json();

      console.log(`🏥 Adding specialized services to booking ${bookingId}`);

      // Get booking
      const booking = await kv.get(`booking:${bookingId}`);
      
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // Create specialized services record
      const specializedServices: BookingSpecializedServices = {
        bookingId,
        customerId: booking.customerId,
        petId: booking.petId,
        prescriptionRequested: prescriptionRequested || false,
        prescriptionNotes: prescriptionNotes || '',
        medicalRecordsShared: sharemedicalRecords || false,
        sharedRecordIds: recordIds || [],
        chatRoleContext: chatRoleContext || 'general',
        addOnServices: addOnServices || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save to KV
      await kv.set(`booking:${bookingId}:specialized`, specializedServices);

      // Update booking with specialized services flag
      booking.hasSpecializedServices = true;
      booking.specializedServicesAdded = new Date().toISOString();
      
      // Add add-on services cost to total
      if (addOnServices && addOnServices.length > 0) {
        const addOnTotal = addOnServices.reduce((sum: number, service: any) => sum + service.price, 0);
        booking.totalAmount = (booking.totalAmount || 0) + addOnTotal;
        booking.addOnServicesTotal = addOnTotal;
      }

      await kv.set(`booking:${bookingId}`, booking);

      console.log(`✅ Specialized services added to booking ${bookingId}`);

      return sendSuccess(c, { 
        specializedServices, 
        booking,
        message: 'Specialized services added successfully' 
      });

    } catch (error) {
      console.error('❌ Error adding specialized services:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /booking/:bookingId/specialized-services
   * Get specialized services for a booking
   */
  app.get(`${BASE_PATH}/booking/:bookingId/specialized-services`, async (c) => {
    try {
      const { bookingId } = c.req.param();

      const specializedServices = await kv.get(`booking:${bookingId}:specialized`);

      if (!specializedServices) {
        return sendSuccess(c, { specializedServices: null, message: 'No specialized services added' });
      }

      // If medical records were shared, fetch them
      let medicalRecords = [];
      if (specializedServices.medicalRecordsShared && specializedServices.sharedRecordIds) {
        for (const recordId of specializedServices.sharedRecordIds) {
          const record = await kv.get(`medical-record:${recordId}`);
          if (record) {
            medicalRecords.push(record);
          }
        }
      }

      // If prescription was requested and created, fetch it
      let prescription = null;
      if (specializedServices.prescriptionId) {
        prescription = await kv.get(`prescription:${specializedServices.prescriptionId}`);
      }

      return sendSuccess(c, {
        specializedServices,
        medicalRecords,
        prescription
      });

    } catch (error) {
      console.error('❌ Error fetching specialized services:', error);
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

      const booking = await kv.get(`booking:${bookingId}`);
      
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      const specializedServices = await kv.get(`booking:${bookingId}:specialized`);

      // Get assigned staff for this booking
      const staff = booking.assignedStaffId 
        ? await kv.get(`staff:${booking.assignedStaffId}`)
        : null;

      const roleContext = {
        bookingId,
        roleContext: specializedServices?.chatRoleContext || 'general',
        assignedStaff: staff ? {
          id: staff.id,
          name: staff.name,
          role: staff.role,
          specialization: staff.specialization
        } : null,
        chatEnabled: true,
        chatSessionId: specializedServices?.chatSessionId || `chat-${bookingId}`,
        supportedFeatures: {
          fileSharing: true,
          prescriptionSharing: true,
          medicalRecordsAccess: true,
          videoCall: booking.serviceStyle === 'tele'
        }
      };

      return sendSuccess(c, { roleContext });

    } catch (error) {
      console.error('❌ Error fetching chat role context:', error);
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
      const { addOnServices } = await c.req.json();

      console.log(`➕ Adding add-on services to booking ${bookingId}`);

      const booking = await kv.get(`booking:${bookingId}`);
      
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // Get or create specialized services
      let specializedServices = await kv.get(`booking:${bookingId}:specialized`) || {
        bookingId,
        customerId: booking.customerId,
        petId: booking.petId,
        prescriptionRequested: false,
        medicalRecordsShared: false,
        addOnServices: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Add new add-ons
      const existingAddOns = specializedServices.addOnServices || [];
      const newAddOns = addOnServices.filter((newService: any) => 
        !existingAddOns.some((existing: any) => existing.serviceId === newService.serviceId)
      );

      specializedServices.addOnServices = [...existingAddOns, ...newAddOns];
      specializedServices.updatedAt = new Date().toISOString();

      await kv.set(`booking:${bookingId}:specialized`, specializedServices);

      // Update booking total
      const addOnTotal = newAddOns.reduce((sum: number, service: any) => sum + service.price, 0);
      booking.totalAmount = (booking.totalAmount || 0) + addOnTotal;
      booking.addOnServicesTotal = (booking.addOnServicesTotal || 0) + addOnTotal;
      
      await kv.set(`booking:${bookingId}`, booking);

      console.log(`✅ Add-on services added to booking ${bookingId}`);

      return sendSuccess(c, {
        specializedServices,
        booking,
        message: 'Add-on services added successfully'
      });

    } catch (error) {
      console.error('❌ Error adding add-on services:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/add-on-services
   * Get available add-on services for a vendor
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/add-on-services`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      const vendor = await kv.get(`vendor:${vendorId}`);
      
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      // Get all services for this vendor
      const allServices = await kv.getByPrefix(`service:${vendorId}:`) || [];
      
      // Filter add-on services
      const addOnServices = allServices
        .map((item: any) => item.value || item)
        .filter((service: any) => service.isAddOn === true)
        .map((service: any) => ({
          serviceId: service.id,
          serviceName: service.name,
          description: service.description,
          price: service.price,
          duration: service.duration,
          category: service.category
        }));

      return sendSuccess(c, { addOnServices, total: addOnServices.length });

    } catch (error) {
      console.error('❌ Error fetching add-on services:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Specialized Services Booking registered');
}
