"use strict";
/**
 * ============================================================================
 * ADMIN ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Migrated from: supabase/functions/make-server-admin/admin-vendor-routes-sql.tsx
 *
 * Endpoints:
 * - GET /admin/vendors/stats - Get vendor statistics
 * - POST /admin/vendors/:id/approve - Approve vendor
 * - POST /admin/vendors/:id/reject - Reject vendor
 * - GET /admin/vendors - List all vendors
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAdminEndpoints = registerAdminEndpoints;
const base_handler_1 = require("../handler/base-handler");
const rds_connection_1 = require("../database/rds-connection");
// ============================================================================
// ADMIN HANDLERS
// ============================================================================
class VendorStatsHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        // ✅ SQL: Get all vendors
        const vendors = await (0, rds_connection_1.select)('vendors', {});
        const activeVendors = vendors.filter(v => v.status === 'approved' && v.is_active);
        const pendingApplications = vendors.filter(v => v.status === 'pending' || v.status === 'pending_approval');
        const deactivatedVendors = vendors.filter(v => !v.is_active);
        const rejectedVendors = vendors.filter(v => v.status === 'rejected');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const pendingToday = pendingApplications.filter(v => {
            if (!v.created_at)
                return false;
            const submittedDate = new Date(v.created_at);
            return submittedDate >= today;
        });
        // Distribution by category
        const distributionByCategory = {};
        vendors.forEach(vendor => {
            if (vendor.category) {
                distributionByCategory[vendor.category] =
                    (distributionByCategory[vendor.category] || 0) + 1;
            }
        });
        return this.success({
            activeVendors: {
                count: activeVendors.length,
                percentage: vendors.length > 0
                    ? Math.round((activeVendors.length / vendors.length) * 100)
                    : 0,
            },
            pendingApplications: {
                count: pendingApplications.length,
                todayCount: pendingToday.length,
            },
            deactivatedVendors: {
                count: deactivatedVendors.length,
            },
            rejectedVendors: {
                count: rejectedVendors.length,
            },
            distributionByCategory,
            total: vendors.length,
        });
    }
}
class ApproveVendorHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const vendorId = context.event.pathParameters?.vendorId;
        const body = this.parseBody(context.event);
        const adminId = context.userId || body.adminId;
        if (!vendorId) {
            return this.error('Vendor ID is required', 400);
        }
        // ✅ SQL: Get vendor
        const vendors = await (0, rds_connection_1.select)('vendors', { id: vendorId });
        if (vendors.length === 0) {
            return this.error('Vendor not found', 404);
        }
        // ✅ SQL: Update vendor status
        await (0, rds_connection_1.update)('vendors', { id: vendorId }, {
            status: 'approved',
            approved_at: new Date(),
            approved_by: adminId,
            is_active: true,
        });
        // ✅ SQL: Create notification (use recipient_id/recipient_type)
        await (0, rds_connection_1.insert)('notifications', {
            recipient_id: vendorId,
            recipient_type: 'vendor',
            notification_type: 'vendor_approved',
            title: 'Application Approved',
            message: 'Your vendor application has been approved!',
            channels: { email: true, sms: true, inApp: true, push: false },
            is_read: false,
        });
        // ✅ Publish vendor approved event
        try {
            const { publishVendorApproved } = await Promise.resolve().then(() => __importStar(require('../utils/sns-client')));
            await publishVendorApproved({
                vendorId,
                approvedAt: new Date().toISOString(),
                approvedBy: adminId,
            });
        }
        catch (error) {
            console.error('Failed to publish vendor approved event:', error);
        }
        return this.success({
            message: 'Vendor approved successfully',
            vendorId,
        });
    }
}
class RejectVendorHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const vendorId = context.event.pathParameters?.vendorId;
        const body = this.parseBody(context.event);
        const { reason } = body;
        const adminId = context.userId || body.adminId;
        if (!vendorId) {
            return this.error('Vendor ID is required', 400);
        }
        if (!reason) {
            return this.error('Rejection reason is required', 400);
        }
        // ✅ SQL: Get vendor
        const vendors = await (0, rds_connection_1.select)('vendors', { id: vendorId });
        if (vendors.length === 0) {
            return this.error('Vendor not found', 404);
        }
        // ✅ SQL: Update vendor status
        await (0, rds_connection_1.update)('vendors', { id: vendorId }, {
            status: 'rejected',
            rejection_reason: reason,
            rejected_at: new Date(),
            rejected_by: adminId,
            is_active: false,
        });
        // ✅ SQL: Add comment
        await (0, rds_connection_1.insert)('vendor_onboarding_comments', {
            vendor_id: vendorId,
            admin_id: adminId,
            comment: reason,
            comment_type: 'rejection',
            is_resolved: false,
        });
        // ✅ SQL: Create notification (use recipient_id/recipient_type)
        await (0, rds_connection_1.insert)('notifications', {
            recipient_id: vendorId,
            recipient_type: 'vendor',
            notification_type: 'vendor_rejected',
            title: 'Application Rejected',
            message: `Your application was rejected: ${reason}`,
            channels: { email: true, sms: true, inApp: true, push: false },
            is_read: false,
        });
        return this.success({
            message: 'Vendor rejected',
            vendorId,
        });
    }
}
class ListVendorsHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const status = context.event.queryStringParameters?.status;
        const limit = parseInt(context.event.queryStringParameters?.limit || '50', 10);
        const offset = parseInt(context.event.queryStringParameters?.offset || '0', 10);
        // ✅ SQL: Get vendors with filters
        let vendors;
        if (status) {
            vendors = await (0, rds_connection_1.select)('vendors', { status }, {
                limit,
                offset,
                orderBy: 'created_at',
                orderDirection: 'DESC',
            });
        }
        else {
            vendors = await (0, rds_connection_1.select)('vendors', {}, {
                limit,
                offset,
                orderBy: 'created_at',
                orderDirection: 'DESC',
            });
        }
        return this.success({
            vendors: vendors.map(v => ({
                id: v.id,
                businessName: v.business_name,
                ownerName: v.owner_name,
                phone: v.phone,
                email: v.email,
                status: v.status,
                tier: v.tier,
                createdAt: v.created_at,
            })),
            total: vendors.length,
        });
    }
}
// ============================================================================
// HONO ROUTER SETUP
// ============================================================================
function registerAdminEndpoints(app) {
    const statsHandler = new VendorStatsHandler();
    const approveHandler = new ApproveVendorHandler();
    const rejectHandler = new RejectVendorHandler();
    const listHandler = new ListVendorsHandler();
    app.get('/admin/vendors/stats', async (c) => {
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await statsHandler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.post('/admin/vendors/:vendorId/approve', async (c) => {
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { vendorId: c.req.param('vendorId') };
        const context = createLambdaContext();
        const result = await approveHandler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.post('/admin/vendors/:vendorId/reject', async (c) => {
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { vendorId: c.req.param('vendorId') };
        const context = createLambdaContext();
        const result = await rejectHandler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
    app.get('/admin/vendors', async (c) => {
        const event = createApiGatewayEvent(c.req);
        const context = createLambdaContext();
        const result = await listHandler.execute(event, context);
        return c.json(JSON.parse(result.body), result.statusCode);
    });
}
function createApiGatewayEvent(req) {
    return {
        httpMethod: req.method,
        path: req.url,
        headers: req.headers,
        body: JSON.stringify(req.body || {}),
        pathParameters: req.param() || {},
        queryStringParameters: Object.fromEntries(new URL(req.url).searchParams),
        requestContext: {
            requestId: crypto.randomUUID(),
        },
    };
}
function createLambdaContext() {
    return {
        requestId: crypto.randomUUID(),
        functionName: 'admin-handler',
        functionVersion: '$LATEST',
    };
}
//# sourceMappingURL=admin.js.map