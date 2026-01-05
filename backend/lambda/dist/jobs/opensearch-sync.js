"use strict";
/**
 * ============================================================================
 * OPENSEARCH SYNC JOB
 * ============================================================================
 *
 * Lambda function that syncs data from RDS to OpenSearch
 * Triggered by:
 * - SQS messages (real-time updates)
 * - CloudWatch Events (full sync schedule)
 *
 * Date: 2026-01-02
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = handler;
exports.triggerServiceSync = triggerServiceSync;
exports.triggerVendorSync = triggerVendorSync;
exports.triggerStaffSync = triggerStaffSync;
const rds_connection_1 = require("../database/rds-connection");
const opensearch_client_1 = require("../utils/opensearch-client");
// ============================================================================
// MAIN HANDLER
// ============================================================================
async function handler(event, context) {
    console.log('OpenSearch sync job triggered', { event });
    try {
        // Check if this is an SQS event (real-time sync) or scheduled event (full sync)
        if ('Records' in event) {
            // SQS event - process individual messages
            await processSQSMessages(event);
        }
        else {
            // Scheduled event - full sync
            await performFullSync();
        }
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Sync completed successfully' }),
        };
    }
    catch (error) {
        console.error('Sync job error:', error);
        throw error;
    }
}
// ============================================================================
// SQS MESSAGE PROCESSING
// ============================================================================
async function processSQSMessages(event) {
    for (const record of event.Records) {
        try {
            const message = JSON.parse(record.body);
            console.log('Processing sync message:', message);
            await processEntityUpdate(message);
        }
        catch (error) {
            console.error('Error processing message:', record.body, error);
            // Don't throw - continue processing other messages
        }
    }
}
async function processEntityUpdate(message) {
    const { entity, action, entity_id, data } = message;
    const indexMap = {
        service: opensearch_client_1.INDEXES.SERVICES,
        vendor: opensearch_client_1.INDEXES.VENDORS,
        staff: opensearch_client_1.INDEXES.STAFF,
        product: opensearch_client_1.INDEXES.PRODUCTS,
        problem: opensearch_client_1.INDEXES.PROBLEMS,
    };
    const indexName = indexMap[entity];
    if (!indexName) {
        console.warn(`Unknown entity type: ${entity}`);
        return;
    }
    switch (action) {
        case 'create':
        case 'update':
            // Fetch latest data from database if not provided
            const document = data || await fetchEntityFromDatabase(entity, entity_id);
            if (document) {
                const indexableDoc = transformForIndex(entity, document);
                await (0, opensearch_client_1.indexDocument)(indexName, entity_id, indexableDoc);
            }
            break;
        case 'delete':
            await (0, opensearch_client_1.deleteDocument)(indexName, entity_id);
            break;
    }
}
// ============================================================================
// DATABASE FETCH FUNCTIONS
// ============================================================================
async function fetchEntityFromDatabase(entity, id) {
    const tableMap = {
        service: 'services',
        vendor: 'vendors',
        staff: 'staff',
        product: 'products',
        problem: 'problem_grid',
    };
    const tableName = tableMap[entity];
    if (!tableName)
        return null;
    const results = await (0, rds_connection_1.select)(tableName, { id });
    return results[0] || null;
}
// ============================================================================
// FULL SYNC
// ============================================================================
async function performFullSync() {
    console.log('Starting full OpenSearch sync...');
    // Initialize indexes if they don't exist
    await (0, opensearch_client_1.initializeAllIndexes)();
    // Sync each entity type
    await syncServices();
    await syncVendors();
    await syncStaff();
    await syncProducts();
    await syncProblems();
    console.log('Full sync completed');
}
async function syncServices() {
    console.log('Syncing services...');
    const services = await (0, rds_connection_1.query)(`
    SELECT 
      s.*,
      v.business_name as vendor_name,
      v.latitude as vendor_lat,
      v.longitude as vendor_lon
    FROM services s
    JOIN vendors v ON s.vendor_id = v.id
    WHERE s.is_active = true AND v.status = 'active'
  `);
    const serviceRows = Array.isArray(services) ? services : services.rows || [];
    const documents = serviceRows.map((service) => ({
        id: service.id,
        document: transformForIndex('service', service),
    }));
    if (documents.length > 0) {
        await (0, opensearch_client_1.bulkIndex)(opensearch_client_1.INDEXES.SERVICES, documents);
        console.log(`Synced ${documents.length} services`);
    }
}
async function syncVendors() {
    console.log('Syncing vendors...');
    const vendors = await (0, rds_connection_1.query)(`
    SELECT 
      v.*,
      r.service_styles
    FROM vendors v
    LEFT JOIN roles r ON v.role_id = r.id
    WHERE v.status = 'active'
  `);
    const vendorRows = Array.isArray(vendors) ? vendors : vendors.rows || [];
    const documents = vendorRows.map((vendor) => ({
        id: vendor.id,
        document: transformForIndex('vendor', vendor),
    }));
    if (documents.length > 0) {
        await (0, opensearch_client_1.bulkIndex)(opensearch_client_1.INDEXES.VENDORS, documents);
        console.log(`Synced ${documents.length} vendors`);
    }
}
async function syncStaff() {
    console.log('Syncing staff...');
    const staff = await (0, rds_connection_1.query)(`
    SELECT 
      s.*,
      v.latitude as vendor_lat,
      v.longitude as vendor_lon
    FROM staff s
    JOIN vendors v ON s.vendor_id = v.id
    WHERE s.is_active = true AND v.status = 'active'
  `);
    const staffRows = Array.isArray(staff) ? staff : staff.rows || [];
    const documents = staffRows.map((member) => ({
        id: member.id,
        document: transformForIndex('staff', member),
    }));
    if (documents.length > 0) {
        await (0, opensearch_client_1.bulkIndex)(opensearch_client_1.INDEXES.STAFF, documents);
        console.log(`Synced ${documents.length} staff members`);
    }
}
async function syncProducts() {
    console.log('Syncing products...');
    const products = await (0, rds_connection_1.query)(`
    SELECT p.*
    FROM products p
    JOIN vendors v ON p.vendor_id = v.id
    WHERE p.is_active = true AND v.status = 'active'
  `);
    const productRows = Array.isArray(products) ? products : products.rows || [];
    const documents = productRows.map((product) => ({
        id: product.id,
        document: transformForIndex('product', product),
    }));
    if (documents.length > 0) {
        await (0, opensearch_client_1.bulkIndex)(opensearch_client_1.INDEXES.PRODUCTS, documents);
        console.log(`Synced ${documents.length} products`);
    }
}
async function syncProblems() {
    console.log('Syncing problem grid...');
    const problems = await (0, rds_connection_1.query)(`SELECT * FROM problem_grid WHERE is_active = true`);
    const problemRows = Array.isArray(problems) ? problems : problems.rows || [];
    const documents = problemRows.map((problem) => ({
        id: problem.id,
        document: transformForIndex('problem', problem),
    }));
    if (documents.length > 0) {
        await (0, opensearch_client_1.bulkIndex)(opensearch_client_1.INDEXES.PROBLEMS, documents);
        console.log(`Synced ${documents.length} problem items`);
    }
}
// ============================================================================
// DATA TRANSFORMATION
// ============================================================================
function transformForIndex(entity, data) {
    switch (entity) {
        case 'service':
            return {
                id: data.id,
                name: data.name,
                description: data.description,
                category: data.category,
                service_style: data.service_style,
                vendor_id: data.vendor_id,
                vendor_name: data.vendor_name || data.business_name,
                price: data.price,
                duration: data.duration,
                rating: data.rating || 0,
                total_reviews: data.total_reviews || 0,
                tags: data.tags || [],
                location: data.vendor_lat && data.vendor_lon
                    ? { lat: data.vendor_lat, lon: data.vendor_lon }
                    : null,
                is_active: data.is_active,
                created_at: data.created_at,
                updated_at: data.updated_at,
            };
        case 'vendor':
            return {
                id: data.id,
                business_name: data.business_name,
                owner_name: data.owner_name,
                role_id: data.role_id,
                service_styles: parseJsonArray(data.service_styles),
                rating: data.rating || 0,
                total_reviews: data.total_reviews || 0,
                address: data.address,
                city: data.city,
                state: data.state,
                location: data.latitude && data.longitude
                    ? { lat: data.latitude, lon: data.longitude }
                    : null,
                service_radius_km: data.service_radius_km || 10,
                is_active: data.status === 'active',
                specializations: parseJsonArray(data.specializations),
                created_at: data.created_at,
            };
        case 'staff':
            return {
                id: data.id,
                name: data.name,
                vendor_id: data.vendor_id,
                role: data.role,
                specializations: parseJsonArray(data.specializations),
                rating: data.rating || 0,
                total_reviews: data.total_reviews || 0,
                location: data.latitude && data.longitude
                    ? { lat: data.latitude, lon: data.longitude }
                    : data.vendor_lat && data.vendor_lon
                        ? { lat: data.vendor_lat, lon: data.vendor_lon }
                        : null,
                service_radius_km: data.service_radius_km || 10,
                is_available: data.is_available ?? true,
                is_active: data.is_active,
            };
        case 'product':
            return {
                id: data.id,
                name: data.name,
                description: data.description,
                category: data.category,
                vendor_id: data.vendor_id,
                price: data.price,
                stock_quantity: data.stock_quantity,
                rating: data.rating || 0,
                tags: parseJsonArray(data.tags),
                is_active: data.is_active,
            };
        case 'problem':
            return {
                id: data.id,
                symptom: data.symptom,
                category: data.category,
                severity: data.severity,
                related_services: parseJsonArray(data.related_services),
                related_specializations: parseJsonArray(data.related_specializations),
                icon: data.icon,
            };
        default:
            return data;
    }
}
function parseJsonArray(value) {
    if (Array.isArray(value))
        return value;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        }
        catch {
            return value.split(',').map((s) => s.trim());
        }
    }
    return [];
}
// ============================================================================
// TRIGGER HELPERS (for calling from other Lambda functions)
// ============================================================================
async function triggerServiceSync(serviceId, action) {
    const message = {
        entity: 'service',
        action,
        entity_id: serviceId,
    };
    // In production, send to SQS; here we process directly for simplicity
    await processEntityUpdate(message);
}
async function triggerVendorSync(vendorId, action) {
    const message = {
        entity: 'vendor',
        action,
        entity_id: vendorId,
    };
    await processEntityUpdate(message);
}
async function triggerStaffSync(staffId, action) {
    const message = {
        entity: 'staff',
        action,
        entity_id: staffId,
    };
    await processEntityUpdate(message);
}
//# sourceMappingURL=opensearch-sync.js.map