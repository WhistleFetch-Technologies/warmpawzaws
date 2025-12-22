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

  /**
   * GET /vendor/:vendorId/chat-config
   * Get chat configuration for a vendor based on their role
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/chat-config`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      const vendor = await kv.get(`vendor:${vendorId}`);
      
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      // Determine chat features based on vendor role
      const roleBasedConfig = {
        veterinarian: {
          chatEnabled: true,
          features: {
            prescriptionSharing: true,
            medicalRecordsAccess: true,
            fileSharing: true,
            videoCall: true,
            followUpScheduling: true
          },
          chatTypes: ['consultation', 'prescription', 'follow-up', 'general'],
          defaultChatType: 'consultation'
        },
        groomer: {
          chatEnabled: true,
          features: {
            prescriptionSharing: false,
            medicalRecordsAccess: false,
            fileSharing: true,
            videoCall: false,
            followUpScheduling: true
          },
          chatTypes: ['service-discussion', 'general'],
          defaultChatType: 'service-discussion'
        },
        trainer: {
          chatEnabled: true,
          features: {
            prescriptionSharing: false,
            medicalRecordsAccess: false,
            fileSharing: true,
            videoCall: true,
            followUpScheduling: true
          },
          chatTypes: ['training-progress', 'general'],
          defaultChatType: 'training-progress'
        },
        walker: {
          chatEnabled: true,
          features: {
            prescriptionSharing: false,
            medicalRecordsAccess: false,
            fileSharing: true,
            videoCall: false,
            followUpScheduling: false
          },
          chatTypes: ['walk-updates', 'general'],
          defaultChatType: 'walk-updates'
        },
        boarding: {
          chatEnabled: true,
          features: {
            prescriptionSharing: false,
            medicalRecordsAccess: true,
            fileSharing: true,
            videoCall: true,
            followUpScheduling: false
          },
          chatTypes: ['daily-updates', 'general'],
          defaultChatType: 'daily-updates'
        },
        default: {
          chatEnabled: true,
          features: {
            prescriptionSharing: false,
            medicalRecordsAccess: false,
            fileSharing: true,
            videoCall: false,
            followUpScheduling: false
          },
          chatTypes: ['general'],
          defaultChatType: 'general'
        }
      };

      // Get vendor's primary role
      const vendorRole = vendor.vendorRole || vendor.role || 'default';
      const config = roleBasedConfig[vendorRole] || roleBasedConfig.default;

      return sendSuccess(c, {
        vendorId,
        vendorName: vendor.businessName || vendor.name,
        vendorRole,
        chatConfig: config
      });

    } catch (error) {
      console.error('❌ Error fetching vendor chat config:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /booking/:bookingId/prescription/create
   * Create prescription linked to booking
   */
  app.post(`${BASE_PATH}/booking/:bookingId/prescription/create`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const {
        vendorId,
        doctorId,
        medicines,
        diagnosis,
        notes,
        followUpDate
      } = await c.req.json();

      console.log(`💊 Creating prescription for booking ${bookingId}`);

      const booking = await kv.get(`booking:${bookingId}`);
      
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // Verify booking is completed
      if (booking.status !== 'completed' && booking.status !== 'in_progress') {
        return sendError(c, 'Can only create prescriptions for ongoing or completed bookings', 400);
      }

      // Create prescription
      const prescriptionId = `presc_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const prescription = {
        id: prescriptionId,
        bookingId,
        petId: booking.petId,
        customerId: booking.customerId,
        customerPhone: booking.customerPhone,
        vendorId: vendorId || booking.vendorId,
        doctorId: doctorId || booking.doctorId,
        medicines: medicines || [],
        diagnosis: diagnosis || '',
        notes: notes || '',
        followUpDate: followUpDate || null,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`prescription:${prescriptionId}`, prescription);

      // Link prescription to booking
      booking.prescriptionId = prescriptionId;
      booking.prescriptionCreatedAt = new Date().toISOString();
      await kv.set(`booking:${bookingId}`, booking);

      // Update specialized services
      const specializedServices = await kv.get(`booking:${bookingId}:specialized`) || {
        bookingId,
        customerId: booking.customerId,
        petId: booking.petId,
        prescriptionRequested: false,
        medicalRecordsShared: false,
        addOnServices: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      specializedServices.prescriptionId = prescriptionId;
      specializedServices.prescriptionCreatedAt = new Date().toISOString();
      specializedServices.updatedAt = new Date().toISOString();

      await kv.set(`booking:${bookingId}:specialized`, specializedServices);

      // Add to customer's prescriptions
      const customerPhone = booking.customerPhone.replace(/[^0-9]/g, '');
      const customerPrescriptions = await kv.get(`customer:${customerPhone}:prescriptions`) || [];
      customerPrescriptions.unshift(prescriptionId);
      await kv.set(`customer:${customerPhone}:prescriptions`, customerPrescriptions);

      // Add to pet's prescriptions
      const petPrescriptions = await kv.get(`pet:${booking.petId}:prescriptions`) || [];
      petPrescriptions.unshift(prescriptionId);
      await kv.set(`pet:${booking.petId}:prescriptions`, petPrescriptions);

      console.log(`✅ Prescription created: ${prescriptionId}`);

      return sendSuccess(c, {
        prescription,
        message: 'Prescription created successfully'
      });

    } catch (error) {
      console.error('❌ Error creating prescription:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /booking/:bookingId/add-ons/calculate-pricing
   * Calculate real-time pricing for add-on services
   */
  app.post(`${BASE_PATH}/booking/:bookingId/add-ons/calculate-pricing`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { addOnServiceIds } = await c.req.json();

      console.log(`💰 Calculating add-on pricing for booking ${bookingId}`);

      const booking = await kv.get(`booking:${bookingId}`);
      
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // Get vendor's add-on services
      const allServices = await kv.getByPrefix(`service:${booking.vendorId}:`) || [];
      const vendorServices = await kv.get(`vendor:${booking.vendorId}:services`) || [];
      
      // Combine both sources
      const combinedServices = [...allServices.map((item: any) => item.value || item), ...vendorServices];

      // Calculate pricing for requested add-ons
      let totalAddOnPrice = 0;
      const pricedAddOns = [];

      for (const addOnId of addOnServiceIds) {
        const addOnService = combinedServices.find((s: any) => s.id === addOnId);
        
        if (addOnService) {
          const price = addOnService.price || 0;
          totalAddOnPrice += price;
          
          pricedAddOns.push({
            serviceId: addOnId,
            serviceName: addOnService.name || addOnService.serviceName,
            description: addOnService.description,
            price: price,
            duration: addOnService.duration || 0,
            category: addOnService.category
          });
        }
      }

      // Calculate grand total
      const baseAmount = booking.totalAmount || booking.amount || 0;
      const grandTotal = baseAmount + totalAddOnPrice;

      // Calculate savings if any
      const savings = 0; // Can add discount logic here

      return sendSuccess(c, {
        bookingId,
        baseAmount,
        addOnServices: pricedAddOns,
        addOnTotal: totalAddOnPrice,
        grandTotal,
        savings,
        breakdown: {
          baseService: baseAmount,
          addOns: totalAddOnPrice,
          discount: 0,
          total: grandTotal
        }
      });

    } catch (error) {
      console.error('❌ Error calculating add-on pricing:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Specialized Services Booking registered');
}