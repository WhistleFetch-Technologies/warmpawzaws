"use strict";
/**
 * ============================================================================
 * SPECIALIZED SERVICES BOOKING - SQL-ONLY VERSION
 * ============================================================================
 *
 * REFACTORED: Removed all KV usage, using SQL repositories only
 *
 * Features:
 * - Prescription management
 * - Medical records access
 * - Role-based chat
 * - Add-on services
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ Specialized services metadata stored in booking.notes (JSON)
 * ✅ Proper error handling
 * ✅ CRUD operations via repositories
 *
 * Date: 2025-01-27
 * Migration: Phase 2 - Critical Flow Migration
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.specializedServicesBooking = specializedServicesBooking;
const response_utils_1 = require("./response-utils");
const bookings_1 = require("../lib/repositories/bookings");
const vendors_1 = require("../lib/repositories/vendors");
const services_1 = require("../lib/repositories/services");
const staff_1 = require("../lib/repositories/staff");
const db_1 = require("../lib/db");
// Helper repository functions (inline SQL replacement)
const getPrescriptionsRepository = () => ({
    getById: async (prescriptionId) => {
        const [result] = await (0, db_1.selectQuery)('prescriptions', { id: prescriptionId }, { limit: 1 });
        return result || null;
    },
    create: async (data) => {
        const [result] = await (0, db_1.insertQuery)('prescriptions', {
            ...data,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
        return result;
    }
});
const getMedicalRecordsRepository = () => ({
    getById: async (recordId) => {
        const [result] = await (0, db_1.selectQuery)('medical_records', { id: recordId }, { limit: 1 });
        return result || null;
    },
    create: async (data) => {
        const [result] = await (0, db_1.insertQuery)('medical_records', {
            ...data,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
        return result;
    }
});
const getRolesRepository = () => ({
    findById: async (roleId) => {
        const [result] = await (0, db_1.selectQuery)('vendor_roles', { id: roleId }, { limit: 1 });
        return result || null;
    }
});
function specializedServicesBooking(app) {
    const BASE_PATH = "/make-server-3dd53475";
    /**
     * GET /booking/:bookingId/specialized-services/config
     * Get specialized services configuration for a booking
     */
    app.get(`${BASE_PATH}/booking/:bookingId/specialized-services/config`, async (c) => {
        try {
            const { bookingId } = c.req.param();
            // ✅ SQL: Get booking
            const bookingsRepo = (0, bookings_1.getBookingsRepository)();
            const booking = await bookingsRepo.findById(bookingId);
            if (!booking) {
                return (0, response_utils_1.sendError)(c, 'Booking not found', 404);
            }
            // ✅ SQL: Get vendor
            const vendorsRepo = (0, vendors_1.getVendorsRepository)();
            const vendor = await vendorsRepo.findById(booking.vendor_id || '');
            if (!vendor) {
                return (0, response_utils_1.sendError)(c, 'Vendor not found', 404);
            }
            // ✅ SQL: Get service
            const servicesRepo = (0, services_1.getServicesRepository)();
            const service = await servicesRepo.findById(booking.service_id);
            // ✅ SQL: Get vendor role to determine capabilities
            const rolesRepo = getRolesRepository();
            const role = vendor.role_id ? await rolesRepo.findById(vendor.role_id) : null;
            // Build configuration
            const roleAny = role;
            const config = {
                prescriptionAllowed: roleAny?.name === 'veterinarian' || vendor.category === 'vet_clinic' || false,
                medicalRecordsRequired: service?.description?.includes('medical') || false,
                chatEnabled: true, // Default enabled
                allowedRoles: roleAny ? [roleAny.name] : ['veterinarian', 'nurse', 'receptionist'],
                addOnServices: [] // Will be populated from services
            };
            return (0, response_utils_1.sendSuccess)(c, { config });
        }
        catch (error) {
            console.error('❌ Error fetching specialized services config:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
        }
    });
    /**
     * POST /booking/:bookingId/add-specialized-services
     * Add specialized services to an existing booking
     */
    app.post(`${BASE_PATH}/booking/:bookingId/add-specialized-services`, async (c) => {
        try {
            const { bookingId } = c.req.param();
            const { prescriptionRequested, prescriptionNotes, sharemedicalRecords, recordIds, chatRoleContext, addOnServices } = await c.req.json();
            console.log(`🏥 Adding specialized services to booking ${bookingId}`);
            // ✅ SQL: Get booking
            const bookingsRepo = (0, bookings_1.getBookingsRepository)();
            const booking = await bookingsRepo.findById(bookingId);
            if (!booking) {
                return (0, response_utils_1.sendError)(c, 'Booking not found', 404);
            }
            // Create specialized services record
            const specializedServices = {
                bookingId,
                customerId: booking.customer_id,
                petId: '', // Would need to be stored or retrieved from booking metadata
                prescriptionRequested: prescriptionRequested || false,
                prescriptionNotes: prescriptionNotes || '',
                medicalRecordsShared: sharemedicalRecords || false,
                sharedRecordIds: recordIds || [],
                chatRoleContext: chatRoleContext || 'general',
                addOnServices: addOnServices || [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            // ✅ SQL: Update booking notes with specialized services
            const bookingNotes = booking.notes ? JSON.parse(booking.notes) : {};
            bookingNotes.specializedServices = specializedServices;
            bookingNotes.hasSpecializedServices = true;
            bookingNotes.specializedServicesAdded = new Date().toISOString();
            // Calculate add-on services total
            if (addOnServices && addOnServices.length > 0) {
                const addOnTotal = addOnServices.reduce((sum, service) => sum + service.price, 0);
                bookingNotes.addOnServicesTotal = addOnTotal;
                await bookingsRepo.update(bookingId, {
                    total_amount: booking.total_amount + addOnTotal,
                    notes: JSON.stringify(bookingNotes),
                });
            }
            else {
                await bookingsRepo.update(bookingId, {
                    notes: JSON.stringify(bookingNotes),
                });
            }
            console.log(`✅ Specialized services added to booking ${bookingId}`);
            return (0, response_utils_1.sendSuccess)(c, {
                specializedServices,
                message: 'Specialized services added successfully'
            });
        }
        catch (error) {
            console.error('❌ Error adding specialized services:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
        }
    });
    /**
     * GET /booking/:bookingId/specialized-services
     * Get specialized services for a booking
     */
    app.get(`${BASE_PATH}/booking/:bookingId/specialized-services`, async (c) => {
        try {
            const { bookingId } = c.req.param();
            // ✅ SQL: Get booking
            const bookingsRepo = (0, bookings_1.getBookingsRepository)();
            const booking = await bookingsRepo.findById(bookingId);
            if (!booking) {
                return (0, response_utils_1.sendError)(c, 'Booking not found', 404);
            }
            const bookingNotes = booking.notes ? JSON.parse(booking.notes) : {};
            const specializedServices = bookingNotes.specializedServices || null;
            if (!specializedServices) {
                return (0, response_utils_1.sendSuccess)(c, { specializedServices: null, message: 'No specialized services added' });
            }
            // ✅ SQL: If medical records were shared, fetch them
            // Note: Using customer context for access - in production, use actual actor from auth
            let medicalRecords = [];
            if (specializedServices.medicalRecordsShared && specializedServices.sharedRecordIds) {
                const medicalRecordsRepo = getMedicalRecordsRepository();
                for (const recordId of specializedServices.sharedRecordIds) {
                    const record = await medicalRecordsRepo.getById(recordId);
                    if (record) {
                        medicalRecords.push(record);
                    }
                }
            }
            // ✅ SQL: If prescription was requested and created, fetch it
            // Note: Using system context for access - in production, use actual actor from auth
            let prescription = null;
            if (specializedServices.prescriptionId) {
                const prescriptionsRepo = getPrescriptionsRepository();
                // Use booking customer_id as actor for access check
                prescription = await prescriptionsRepo.getById(specializedServices.prescriptionId);
            }
            return (0, response_utils_1.sendSuccess)(c, {
                specializedServices,
                medicalRecords,
                prescription
            });
        }
        catch (error) {
            console.error('❌ Error fetching specialized services:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
        }
    });
    /**
     * GET /booking/:bookingId/chat/role-context
     * Get role-based chat context for booking
     */
    app.get(`${BASE_PATH}/booking/:bookingId/chat/role-context`, async (c) => {
        try {
            const { bookingId } = c.req.param();
            // ✅ SQL: Get booking
            const bookingsRepo = (0, bookings_1.getBookingsRepository)();
            const booking = await bookingsRepo.findById(bookingId);
            if (!booking) {
                return (0, response_utils_1.sendError)(c, 'Booking not found', 404);
            }
            const bookingNotes = booking.notes ? JSON.parse(booking.notes) : {};
            const specializedServices = bookingNotes.specializedServices || {};
            // ✅ SQL: Get assigned staff
            let staff = null;
            if (booking.staff_id) {
                const staffRepo = (0, staff_1.getStaffRepository)();
                staff = await staffRepo.findById(booking.staff_id);
            }
            const roleContext = {
                bookingId,
                roleContext: specializedServices.chatRoleContext || 'general',
                assignedStaff: staff ? {
                    id: staff.id,
                    name: staff.fullName,
                    role: staff.role,
                    specialization: staff.specialization
                } : null,
                chatEnabled: true,
                chatSessionId: specializedServices.chatSessionId || `chat-${bookingId}`,
                supportedFeatures: {
                    fileSharing: true,
                    prescriptionSharing: true,
                    medicalRecordsAccess: true,
                    videoCall: booking.service_type === 'tele'
                }
            };
            return (0, response_utils_1.sendSuccess)(c, { roleContext });
        }
        catch (error) {
            console.error('❌ Error fetching chat role context:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
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
            // ✅ SQL: Get booking
            const bookingsRepo = (0, bookings_1.getBookingsRepository)();
            const booking = await bookingsRepo.findById(bookingId);
            if (!booking) {
                return (0, response_utils_1.sendError)(c, 'Booking not found', 404);
            }
            // ✅ SQL: Get or create specialized services in booking notes
            const bookingNotes = booking.notes ? JSON.parse(booking.notes) : {};
            let specializedServices = bookingNotes.specializedServices || {
                bookingId,
                customerId: booking.customer_id,
                petId: '',
                prescriptionRequested: false,
                medicalRecordsShared: false,
                addOnServices: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            // Add new add-ons
            const existingAddOns = specializedServices.addOnServices || [];
            const newAddOns = addOnServices.filter((newService) => !existingAddOns.some((existing) => existing.serviceId === newService.serviceId));
            specializedServices.addOnServices = [...existingAddOns, ...newAddOns];
            specializedServices.updatedAt = new Date().toISOString();
            // ✅ SQL: Update booking
            bookingNotes.specializedServices = specializedServices;
            const addOnTotal = newAddOns.reduce((sum, service) => sum + service.price, 0);
            bookingNotes.addOnServicesTotal = (bookingNotes.addOnServicesTotal || 0) + addOnTotal;
            await bookingsRepo.update(bookingId, {
                total_amount: booking.total_amount + addOnTotal,
                notes: JSON.stringify(bookingNotes),
            });
            console.log(`✅ Add-on services added to booking ${bookingId}`);
            return (0, response_utils_1.sendSuccess)(c, {
                specializedServices,
                message: 'Add-on services added successfully'
            });
        }
        catch (error) {
            console.error('❌ Error adding add-on services:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
        }
    });
    /**
     * GET /vendor/:vendorId/add-on-services
     * Get available add-on services for a vendor
     */
    app.get(`${BASE_PATH}/vendor/:vendorId/add-on-services`, async (c) => {
        try {
            const { vendorId } = c.req.param();
            // ✅ SQL: Get vendor
            const vendorsRepo = (0, vendors_1.getVendorsRepository)();
            const vendor = await vendorsRepo.findById(vendorId);
            if (!vendor) {
                return (0, response_utils_1.sendError)(c, 'Vendor not found', 404);
            }
            // ✅ SQL: Get all services for this vendor
            const servicesRepo = (0, services_1.getServicesRepository)();
            const allServices = await servicesRepo.findByVendor(vendorId);
            // Filter add-on services (services marked as add-on or with is_addon flag)
            // Note: You may need to add an is_addon field to services table
            const addOnServices = allServices
                .filter((service) => {
                // For now, check if service has add-on characteristics
                // In production, add an `is_addon` boolean field to services table
                return service.category === 'add-on' || service.name?.toLowerCase().includes('add-on');
            })
                .map((service) => ({
                serviceId: service.id,
                serviceName: service.name,
                description: service.description,
                price: service.price,
                duration: service.duration_minutes,
                category: service.category
            }));
            return (0, response_utils_1.sendSuccess)(c, { addOnServices, total: addOnServices.length });
        }
        catch (error) {
            console.error('❌ Error fetching add-on services:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
        }
    });
    /**
     * GET /vendor/:vendorId/chat-config
     * Get chat configuration for a vendor based on their role
     */
    app.get(`${BASE_PATH}/vendor/:vendorId/chat-config`, async (c) => {
        try {
            const { vendorId } = c.req.param();
            // ✅ SQL: Get vendor
            const vendorsRepo = (0, vendors_1.getVendorsRepository)();
            const vendor = await vendorsRepo.findById(vendorId);
            if (!vendor) {
                return (0, response_utils_1.sendError)(c, 'Vendor not found', 404);
            }
            // ✅ SQL: Get vendor role
            const rolesRepo = getRolesRepository();
            const role = vendor.role_id ? await rolesRepo.findById(vendor.role_id) : null;
            const roleAny = role;
            const vendorRole = roleAny?.name || vendor.category || 'default';
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
            const config = roleBasedConfig[vendorRole] || roleBasedConfig.default;
            return (0, response_utils_1.sendSuccess)(c, {
                vendorId,
                vendorName: vendor.business_name,
                vendorRole,
                chatConfig: config
            });
        }
        catch (error) {
            console.error('❌ Error fetching vendor chat config:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
        }
    });
    /**
     * POST /booking/:bookingId/prescription/create
     * Create prescription linked to booking
     */
    app.post(`${BASE_PATH}/booking/:bookingId/prescription/create`, async (c) => {
        try {
            const { bookingId } = c.req.param();
            const { vendorId, doctorId, medicines, diagnosis, notes, followUpDate } = await c.req.json();
            console.log(`💊 Creating prescription for booking ${bookingId}`);
            // ✅ SQL: Get booking
            const bookingsRepo = (0, bookings_1.getBookingsRepository)();
            const booking = await bookingsRepo.findById(bookingId);
            if (!booking) {
                return (0, response_utils_1.sendError)(c, 'Booking not found', 404);
            }
            // Verify booking is completed
            if (booking.status !== 'completed' && booking.status !== 'in_progress') {
                return (0, response_utils_1.sendError)(c, 'Can only create prescriptions for ongoing or completed bookings', 400);
            }
            // ✅ SQL: Create prescription
            const prescriptionsRepo = getPrescriptionsRepository();
            const prescription = await prescriptionsRepo.create({
                booking_id: bookingId,
                pet_id: '', // Would need to be retrieved from booking metadata
                customer_id: booking.customer_id,
                vendor_id: vendorId || booking.vendor_id || '',
                staff_id: doctorId || booking.staff_id || null,
                diagnosis: diagnosis || null,
                observations: notes || null,
                medications: medicines || [],
                general_notes: notes || null,
                created_by: vendorId || booking.vendor_id || '',
                created_by_role: 'vendor',
                expires_at: followUpDate || null,
            });
            // ✅ SQL: Update booking notes with prescription ID
            const bookingNotes = booking.notes ? JSON.parse(booking.notes) : {};
            if (!bookingNotes.specializedServices) {
                bookingNotes.specializedServices = {
                    bookingId,
                    customerId: booking.customer_id,
                    prescriptionRequested: false,
                    medicalRecordsShared: false,
                    addOnServices: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
            }
            bookingNotes.specializedServices.prescriptionId = prescription?.id;
            bookingNotes.specializedServices.prescriptionCreatedAt = new Date().toISOString();
            bookingNotes.specializedServices.updatedAt = new Date().toISOString();
            await bookingsRepo.update(bookingId, {
                notes: JSON.stringify(bookingNotes),
            });
            console.log(`✅ Prescription created: ${prescription?.id}`);
            return (0, response_utils_1.sendSuccess)(c, {
                prescription,
                message: 'Prescription created successfully'
            });
        }
        catch (error) {
            console.error('❌ Error creating prescription:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
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
            // ✅ SQL: Get booking
            const bookingsRepo = (0, bookings_1.getBookingsRepository)();
            const booking = await bookingsRepo.findById(bookingId);
            if (!booking) {
                return (0, response_utils_1.sendError)(c, 'Booking not found', 404);
            }
            // ✅ SQL: Get vendor services
            const servicesRepo = (0, services_1.getServicesRepository)();
            const vendorServices = await servicesRepo.findByVendor(booking.vendor_id || '');
            // Calculate pricing for requested add-ons
            let totalAddOnPrice = 0;
            const pricedAddOns = [];
            for (const addOnId of addOnServiceIds) {
                const addOnService = vendorServices.find((s) => s.id === addOnId);
                if (addOnService) {
                    const price = addOnService.price || 0;
                    totalAddOnPrice += price;
                    pricedAddOns.push({
                        serviceId: addOnId,
                        serviceName: addOnService.name,
                        description: addOnService.description,
                        price: price,
                        duration: addOnService.duration_minutes || 0,
                        category: addOnService.category
                    });
                }
            }
            // Calculate grand total
            const baseAmount = booking.total_amount || 0;
            const grandTotal = baseAmount + totalAddOnPrice;
            return (0, response_utils_1.sendSuccess)(c, {
                bookingId,
                baseAmount,
                addOnServices: pricedAddOns,
                addOnTotal: totalAddOnPrice,
                grandTotal,
                savings: 0,
                breakdown: {
                    baseService: baseAmount,
                    addOns: totalAddOnPrice,
                    discount: 0,
                    total: grandTotal
                }
            });
        }
        catch (error) {
            console.error('❌ Error calculating add-on pricing:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
        }
    });
}
//# sourceMappingURL=specialized-services-booking-sql.js.map