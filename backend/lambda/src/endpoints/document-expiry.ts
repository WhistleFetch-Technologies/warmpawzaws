/**
 * ============================================================================
 * DOCUMENT EXPIRY TRACKING ENDPOINTS
 * ============================================================================
 * 
 * Handles vendor document expiry tracking and notifications
 * - Track document expiry dates (licenses, certificates, insurance)
 * - Send alerts before expiry (30 days, 7 days, 1 day)
 * - Block services for expired documents
 * - Admin dashboard for compliance tracking
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select, insert, update } from '../database/rds-connection';

// ============================================================================
// TYPES
// ============================================================================

interface VendorDocument {
  id: string;
  vendorId: string;
  documentType: string;
  documentName: string;
  documentUrl: string;
  expiryDate: string | null;
  issuedDate?: string;
  issuingAuthority?: string;
  status: 'valid' | 'expiring_soon' | 'expired' | 'pending_review';
  daysUntilExpiry: number | null;
  lastNotifiedAt?: string;
}

// ============================================================================
// GET VENDOR DOCUMENTS HANDLER
// ============================================================================

class GetVendorDocumentsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const vendorId = context.event.pathParameters?.vendorId;

    if (!vendorId) {
      return this.error('Vendor ID is required', 400);
    }

    try {
      const { rows } = await query(
        `SELECT 
          id,
          vendor_id,
          document_type,
          document_name,
          document_url,
          expiry_date,
          issued_date,
          issuing_authority,
          status,
          last_notified_at,
          CASE 
            WHEN expiry_date IS NULL THEN NULL
            ELSE EXTRACT(DAY FROM (expiry_date::date - CURRENT_DATE))
          END as days_until_expiry
        FROM vendor_documents
        WHERE vendor_id = $1
        ORDER BY 
          CASE 
            WHEN expiry_date IS NULL THEN 1
            ELSE 0
          END,
          expiry_date ASC`,
        [vendorId]
      );

      const documents: VendorDocument[] = rows.map(row => ({
        id: row.id,
        vendorId: row.vendor_id,
        documentType: row.document_type,
        documentName: row.document_name,
        documentUrl: row.document_url,
        expiryDate: row.expiry_date,
        issuedDate: row.issued_date,
        issuingAuthority: row.issuing_authority,
        status: getDocumentStatus(row.days_until_expiry),
        daysUntilExpiry: row.days_until_expiry !== null ? parseInt(row.days_until_expiry) : null,
        lastNotifiedAt: row.last_notified_at,
      }));

      const expiringCount = documents.filter(d => d.status === 'expiring_soon').length;
      const expiredCount = documents.filter(d => d.status === 'expired').length;

      return this.success({
        success: true,
        documents,
        summary: {
          total: documents.length,
          valid: documents.filter(d => d.status === 'valid').length,
          expiringSoon: expiringCount,
          expired: expiredCount,
          needsAttention: expiringCount + expiredCount,
        },
      });
    } catch (error: any) {
      console.error('Error getting vendor documents:', error);
      return this.error(error.message || 'Failed to get documents', 500);
    }
  }
}

// ============================================================================
// CHECK EXPIRING DOCUMENTS JOB HANDLER
// ============================================================================

class CheckExpiringDocumentsJobHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      // Get documents expiring in 30, 7, and 1 day(s)
      const { rows: expiringDocs } = await query(
        `SELECT 
          vd.id,
          vd.vendor_id,
          vd.document_type,
          vd.document_name,
          vd.expiry_date,
          vd.last_notified_at,
          v.business_name,
          v.contact_email,
          v.contact_phone,
          EXTRACT(DAY FROM (vd.expiry_date::date - CURRENT_DATE)) as days_until_expiry
        FROM vendor_documents vd
        JOIN vendors v ON v.id = vd.vendor_id
        WHERE vd.expiry_date IS NOT NULL
          AND vd.expiry_date::date >= CURRENT_DATE
          AND vd.expiry_date::date <= CURRENT_DATE + INTERVAL '30 days'
          AND (
            vd.last_notified_at IS NULL 
            OR vd.last_notified_at::date < CURRENT_DATE
          )
        ORDER BY vd.expiry_date ASC`
      );

      const notificationsSent: any[] = [];

      for (const doc of expiringDocs) {
        const daysLeft = parseInt(doc.days_until_expiry);
        
        // Only notify at specific intervals: 30, 14, 7, 3, 1 days
        const notifyDays = [30, 14, 7, 3, 1];
        if (!notifyDays.includes(daysLeft)) continue;

        // Create notification
        const urgency = daysLeft <= 3 ? 'critical' : daysLeft <= 7 ? 'high' : 'medium';
        
        await insert('notifications', {
          user_id: doc.vendor_id,
          user_type: 'vendor',
          type: 'document_expiry_warning',
          title: daysLeft <= 1 
            ? `⚠️ ${doc.document_name} Expires Tomorrow!`
            : `📋 ${doc.document_name} Expires in ${daysLeft} Days`,
          message: `Your ${doc.document_type} document expires on ${new Date(doc.expiry_date).toLocaleDateString('en-IN')}. Please renew it to continue providing services.`,
          data: JSON.stringify({
            document_id: doc.id,
            document_type: doc.document_type,
            expiry_date: doc.expiry_date,
            days_until_expiry: daysLeft,
            urgency,
            action: 'renew_document',
          }),
          is_read: false,
          requires_action: true,
          action_url: '/settings/documents',
          created_at: new Date(),
        });

        // Update last notified date
        await update('vendor_documents', { id: doc.id }, {
          last_notified_at: new Date(),
          status: daysLeft <= 7 ? 'expiring_soon' : 'valid',
        });

        notificationsSent.push({
          vendorId: doc.vendor_id,
          vendorName: doc.business_name,
          documentType: doc.document_type,
          daysUntilExpiry: daysLeft,
          urgency,
        });
      }

      // Check for expired documents and update status
      const { rowCount: expiredCount } = await query(
        `UPDATE vendor_documents 
         SET status = 'expired'
         WHERE expiry_date IS NOT NULL 
           AND expiry_date::date < CURRENT_DATE
           AND status != 'expired'`
      );

      return this.success({
        success: true,
        message: `Processed ${notificationsSent.length} expiry notifications, marked ${expiredCount || 0} as expired`,
        notificationsSent: notificationsSent.length,
        newlyExpired: expiredCount || 0,
        details: notificationsSent,
      });
    } catch (error: any) {
      console.error('Error checking expiring documents:', error);
      return this.error(error.message || 'Job failed', 500);
    }
  }
}

// ============================================================================
// UPDATE DOCUMENT EXPIRY HANDLER
// ============================================================================

class UpdateDocumentExpiryHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const documentId = context.event.pathParameters?.documentId;
    const body = this.parseBody(context.event);
    const { expiryDate, newDocumentUrl, issuingAuthority } = body;

    if (!documentId) {
      return this.error('Document ID is required', 400);
    }

    try {
      const updates: any = { updated_at: new Date() };
      
      if (expiryDate) {
        updates.expiry_date = new Date(expiryDate);
        updates.status = 'valid';
        updates.last_notified_at = null; // Reset notifications
      }
      
      if (newDocumentUrl) {
        updates.document_url = newDocumentUrl;
      }
      
      if (issuingAuthority) {
        updates.issuing_authority = issuingAuthority;
      }

      await update('vendor_documents', { id: documentId }, updates);

      return this.success({
        success: true,
        documentId,
        message: 'Document updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating document:', error);
      return this.error(error.message || 'Failed to update document', 500);
    }
  }
}

// ============================================================================
// ADMIN: GET ALL EXPIRING DOCUMENTS
// ============================================================================

class AdminGetExpiringDocumentsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const params = context.event.queryStringParameters || {};
    const { daysAhead = '30', status } = params;

    try {
      let queryStr = `
        SELECT 
          vd.*,
          v.business_name,
          v.contact_email,
          v.contact_phone,
          v.role_id,
          r.name as role_name,
          EXTRACT(DAY FROM (vd.expiry_date::date - CURRENT_DATE)) as days_until_expiry
        FROM vendor_documents vd
        JOIN vendors v ON v.id = vd.vendor_id
        LEFT JOIN roles r ON r.id = v.role_id
        WHERE vd.expiry_date IS NOT NULL
      `;

      const values: any[] = [];
      let paramIndex = 1;

      if (status === 'expired') {
        queryStr += ` AND vd.expiry_date::date < CURRENT_DATE`;
      } else if (status === 'expiring') {
        queryStr += ` AND vd.expiry_date::date >= CURRENT_DATE AND vd.expiry_date::date <= CURRENT_DATE + INTERVAL '${parseInt(daysAhead)} days'`;
      } else {
        queryStr += ` AND vd.expiry_date::date <= CURRENT_DATE + INTERVAL '${parseInt(daysAhead)} days'`;
      }

      queryStr += ` ORDER BY vd.expiry_date ASC LIMIT 100`;

      const { rows } = await query(queryStr, values);

      const documents = rows.map(row => ({
        id: row.id,
        vendorId: row.vendor_id,
        vendorName: row.business_name,
        vendorRole: row.role_name,
        vendorEmail: row.contact_email,
        vendorPhone: row.contact_phone,
        documentType: row.document_type,
        documentName: row.document_name,
        documentUrl: row.document_url,
        expiryDate: row.expiry_date,
        daysUntilExpiry: row.days_until_expiry !== null ? parseInt(row.days_until_expiry) : null,
        status: getDocumentStatus(row.days_until_expiry),
      }));

      return this.success({
        success: true,
        documents,
        summary: {
          total: documents.length,
          expired: documents.filter(d => d.status === 'expired').length,
          expiringSoon: documents.filter(d => d.status === 'expiring_soon').length,
        },
      });
    } catch (error: any) {
      console.error('Error getting expiring documents:', error);
      return this.error(error.message || 'Failed to get documents', 500);
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getDocumentStatus(daysUntilExpiry: number | string | null): VendorDocument['status'] {
  if (daysUntilExpiry === null) return 'valid';
  
  const days = typeof daysUntilExpiry === 'string' ? parseInt(daysUntilExpiry) : daysUntilExpiry;
  
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring_soon';
  return 'valid';
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerDocumentExpiryEndpoints(app: Hono) {
  const getVendorDocsHandler = new GetVendorDocumentsHandler();
  const checkExpiryJobHandler = new CheckExpiringDocumentsJobHandler();
  const updateDocHandler = new UpdateDocumentExpiryHandler();
  const adminGetExpiringHandler = new AdminGetExpiringDocumentsHandler();

  // Get vendor documents with expiry status
  app.get('/vendor/:vendorId/documents/expiry', async (c) => {
    const event = {
      httpMethod: 'GET',
      path: `/vendor/${c.req.param('vendorId')}/documents/expiry`,
      headers: {},
      body: '',
      pathParameters: { vendorId: c.req.param('vendorId') },
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'document-expiry', functionVersion: '$LATEST' };
    const result = await getVendorDocsHandler.execute(event as unknown as APIGatewayProxyEvent, context as unknown as Context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Update document expiry
  app.put('/vendor/documents/:documentId/expiry', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const event = {
      httpMethod: 'PUT',
      path: `/vendor/documents/${c.req.param('documentId')}/expiry`,
      headers: {},
      body: JSON.stringify(body),
      pathParameters: { documentId: c.req.param('documentId') },
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'document-expiry', functionVersion: '$LATEST' };
    const result = await updateDocHandler.execute(event as unknown as APIGatewayProxyEvent, context as unknown as Context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Scheduled job to check expiring documents
  app.post('/jobs/check-document-expiry', async (c) => {
    const event = {
      httpMethod: 'POST',
      path: '/jobs/check-document-expiry',
      headers: {},
      body: '',
      pathParameters: {},
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'document-expiry', functionVersion: '$LATEST' };
    const result = await checkExpiryJobHandler.execute(event as unknown as APIGatewayProxyEvent, context as unknown as Context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Admin: Get all expiring documents
  app.get('/admin/documents/expiring', async (c) => {
    const event = {
      httpMethod: 'GET',
      path: '/admin/documents/expiring',
      headers: {},
      body: '',
      pathParameters: {},
      queryStringParameters: Object.fromEntries(new URL(c.req.url).searchParams),
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'document-expiry', functionVersion: '$LATEST' };
    const result = await adminGetExpiringHandler.execute(event as unknown as APIGatewayProxyEvent, context as unknown as Context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}
