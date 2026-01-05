"use strict";
/**
 * ============================================================================
 * CUSTOMER SERVICES ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 *
 * Customer-facing service discovery endpoints
 *
 * ✅ SQL-ONLY: All operations use SQL repositories
 *
 * Date: 2025-01-28
 * Migration: Supabase → Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCustomerServices = registerCustomerServices;
const response_utils_1 = require("./response-utils");
const repositories_1 = require("../lib/repositories");
const BASE_PATH = '/make-server-3dd53475';
function registerCustomerServices(app) {
    /**
     * GET /make-server-3dd53475/customer/services
     * Get all published services for customers
     */
    app.get(`${BASE_PATH}/customer/services`, async (c) => {
        try {
            const category = c.req.query('category');
            const serviceStyle = c.req.query('serviceStyle');
            const location = c.req.query('location');
            const petType = c.req.query('petType');
            const roleId = c.req.query('roleId'); // Filter by vendor role
            console.log('🛍️ [CUSTOMER-SERVICES] Fetching published services');
            console.log(`   Filters: category=${category}, style=${serviceStyle}, petType=${petType}, roleId=${roleId}`);
            // ✅ SQL: Get all approved vendors with published services
            const vendorsRepo = (0, repositories_1.getVendorsRepository)();
            const allVendors = await vendorsRepo.findAll();
            // Accept vendors who are approved and active
            const activeVendors = allVendors.filter((v) => {
                const isApproved = v.application_status === 'approved' || v.status === 'approved';
                return isApproved && v.is_active !== false;
            });
            console.log(`   Found ${activeVendors.length} approved vendors out of ${allVendors.length} total`);
            const allServices = [];
            const servicesRepo = (0, repositories_1.getServicesRepository)();
            // Iterate through each vendor to get their published services
            for (const vendor of activeVendors) {
                const vendorId = vendor.id;
                // ✅ SQL: Get all published services for this vendor
                const vendorServices = await servicesRepo.findByVendor(vendorId);
                // Filter by publish status and service style
                let filteredServices = vendorServices.filter((s) => {
                    const isPublished = s.publish_status === 'published' || s.is_enabled === true;
                    if (!isPublished)
                        return false;
                    if (serviceStyle) {
                        const svcStyle = s.service_style || s.serviceStyle;
                        if (svcStyle !== serviceStyle)
                            return false;
                    }
                    return true;
                });
                // Enrich services with vendor information
                for (const service of filteredServices) {
                    const s = service;
                    const enrichedService = {
                        // Service details
                        id: s.id,
                        serviceName: s.service_name || s.name,
                        description: s.description || s.custom_description,
                        price: s.custom_price || s.price || 0,
                        duration: s.custom_duration || s.duration || 30,
                        categoryName: s.category_name || s.categoryName || s.category,
                        subCategoryName: s.sub_category_name || s.subCategoryName,
                        serviceStyle: s.service_style || s.serviceStyle,
                        // Package details
                        isPackage: s.is_package || s.isPackage || false,
                        packageDetails: s.package_details || s.packageDetails,
                        whatIncluded: s.what_included || s.whatIncluded || [],
                        whatNotIncluded: s.what_not_included || s.whatNotIncluded || [],
                        // Vendor details
                        vendorId,
                        vendorName: vendor.business_name || vendor.full_name || vendor.businessName || vendor.fullName,
                        vendorRating: vendor.rating || 4.5,
                        vendorReviewCount: vendor.review_count || vendor.reviewCount || 0,
                        vendorLocation: vendor.location || vendor.address,
                        vendorProfileImage: vendor.profile_image || vendor.profileImage,
                        vendorType: vendor.vendor_type || vendor.vendorType,
                        vendorRoleId: vendor.role_id || vendor.roleId,
                        vendorRoleName: vendor.role_name || vendor.roleName,
                        // Metadata
                        publishedAt: s.published_at || s.publishedAt || s.created_at,
                        approvedBy: s.approved_by || s.approvedBy
                    };
                    // Apply filters
                    let includeService = true;
                    // Category filter
                    if (category && enrichedService.categoryName !== category) {
                        includeService = false;
                    }
                    // Pet type filter
                    const petTypes = s.pet_types || s.petTypes || [];
                    if (petType && petTypes.length > 0 && !petTypes.includes(petType)) {
                        includeService = false;
                    }
                    // Role ID filter
                    if (roleId && enrichedService.vendorRoleId !== roleId) {
                        includeService = false;
                    }
                    if (includeService) {
                        allServices.push(enrichedService);
                    }
                }
            }
            // Sort by rating and published date
            allServices.sort((a, b) => {
                // First by vendor rating
                if (b.vendorRating !== a.vendorRating) {
                    return b.vendorRating - a.vendorRating;
                }
                // Then by published date (newer first)
                const dateA = new Date(a.publishedAt || 0).getTime();
                const dateB = new Date(b.publishedAt || 0).getTime();
                return dateB - dateA;
            });
            console.log(`✅ [CUSTOMER-SERVICES] Returning ${allServices.length} published services`);
            return (0, response_utils_1.sendSuccess)(c, {
                services: allServices,
                total: allServices.length,
                filters: {
                    category,
                    serviceStyle,
                    petType
                }
            });
        }
        catch (error) {
            console.error('❌ [CUSTOMER-SERVICES] Error fetching services:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * GET /make-server-3dd53475/customer/services/:serviceId
     * Get detailed information about a specific service
     */
    app.get(`${BASE_PATH}/customer/services/:serviceId`, async (c) => {
        try {
            const serviceId = c.req.param('serviceId');
            if (!serviceId) {
                return (0, response_utils_1.sendError)(c, 'Service ID is required', 400);
            }
            console.log(`🛍️ [CUSTOMER-SERVICES] Fetching service details: ${serviceId}`);
            // ✅ SQL: Get service details
            const servicesRepo = (0, repositories_1.getServicesRepository)();
            const service = await servicesRepo.findById(serviceId);
            if (!service) {
                return (0, response_utils_1.sendError)(c, 'Service not found', 404);
            }
            const s = service;
            // ✅ SQL: Get vendor details
            const vendorsRepo = (0, repositories_1.getVendorsRepository)();
            const vendor = s.vendor_id ? await vendorsRepo.findById(s.vendor_id) : null;
            if (!vendor) {
                return (0, response_utils_1.sendError)(c, 'Vendor not found for this service', 404);
            }
            const enrichedService = {
                // Service details
                id: s.id,
                serviceName: s.service_name || s.name,
                description: s.description || s.custom_description,
                price: s.custom_price || s.price || 0,
                duration: s.custom_duration || s.duration || 30,
                categoryName: s.category_name || s.categoryName || s.category,
                subCategoryName: s.sub_category_name || s.subCategoryName,
                serviceStyle: s.service_style || s.serviceStyle,
                // Package details
                isPackage: s.is_package || s.isPackage || false,
                packageDetails: s.package_details || s.packageDetails,
                whatIncluded: s.what_included || s.whatIncluded || [],
                whatNotIncluded: s.what_not_included || s.whatNotIncluded || [],
                petTypes: s.pet_types || s.petTypes || [],
                // Vendor details
                vendorId: vendor.id,
                vendorName: vendor.business_name || vendor.full_name,
                vendorRating: vendor.rating || 4.5,
                vendorReviewCount: vendor.review_count || 0,
                vendorLocation: vendor.location || vendor.address,
                vendorProfileImage: vendor.profile_image,
                vendorType: vendor.vendor_type,
                vendorRoleId: vendor.role_id,
                vendorRoleName: vendor.role_name,
                // Metadata
                publishedAt: s.published_at || s.publishedAt || s.created_at,
                approvedBy: s.approved_by || s.approvedBy
            };
            console.log(`✅ [CUSTOMER-SERVICES] Service details loaded: ${serviceId}`);
            return (0, response_utils_1.sendSuccess)(c, {
                service: enrichedService
            });
        }
        catch (error) {
            console.error('❌ [CUSTOMER-SERVICES] Error fetching service details:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * GET /make-server-3dd53475/customer/services/by-vendor/:vendorId
     * Get all services for a specific vendor
     */
    app.get(`${BASE_PATH}/customer/services/by-vendor/:vendorId`, async (c) => {
        try {
            const vendorId = c.req.param('vendorId');
            const serviceStyle = c.req.query('serviceStyle');
            if (!vendorId) {
                return (0, response_utils_1.sendError)(c, 'Vendor ID is required', 400);
            }
            console.log(`🛍️ [CUSTOMER-SERVICES] Fetching services for vendor: ${vendorId}`);
            // ✅ SQL: Verify vendor exists and is approved
            const vendorsRepo = (0, repositories_1.getVendorsRepository)();
            const vendor = await vendorsRepo.findById(vendorId);
            if (!vendor) {
                return (0, response_utils_1.sendError)(c, 'Vendor not found', 404);
            }
            const isApproved = vendor.application_status === 'approved' || vendor.status === 'approved';
            if (!isApproved || !vendor.is_active) {
                return (0, response_utils_1.sendError)(c, 'Vendor is not active or approved', 403);
            }
            // ✅ SQL: Get all published services for this vendor
            const servicesRepo = (0, repositories_1.getServicesRepository)();
            const vendorServices = await servicesRepo.findByVendor(vendorId);
            // Filter by publish status and service style
            let filteredServices = vendorServices.filter((s) => {
                const isPublished = s.publish_status === 'published' || s.is_enabled === true;
                if (!isPublished)
                    return false;
                if (serviceStyle) {
                    const svcStyle = s.service_style || s.serviceStyle;
                    if (svcStyle !== serviceStyle)
                        return false;
                }
                return true;
            });
            // Enrich with vendor info
            const enrichedServices = filteredServices.map((s) => ({
                id: s.id,
                serviceName: s.service_name || s.name,
                description: s.description || s.custom_description,
                price: s.custom_price || s.price || 0,
                duration: s.custom_duration || s.duration || 30,
                categoryName: s.category_name || s.categoryName || s.category,
                serviceStyle: s.service_style || s.serviceStyle,
                isPackage: s.is_package || s.isPackage || false,
                vendorId: vendor.id,
                vendorName: vendor.business_name || vendor.full_name
            }));
            console.log(`✅ [CUSTOMER-SERVICES] Returning ${enrichedServices.length} services for vendor ${vendorId}`);
            return (0, response_utils_1.sendSuccess)(c, {
                services: enrichedServices,
                vendor: {
                    id: vendor.id,
                    name: vendor.business_name || vendor.full_name,
                    rating: vendor.rating || 4.5
                },
                total: enrichedServices.length
            });
        }
        catch (error) {
            console.error('❌ [CUSTOMER-SERVICES] Error fetching vendor services:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
}
//# sourceMappingURL=customer-services-sql.js.map