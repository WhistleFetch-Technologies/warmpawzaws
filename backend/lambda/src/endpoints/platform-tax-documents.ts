/**
 * Platform tax documents — WarmPawz → vendor GST invoices.
 */

import { Hono } from 'hono';
import {
  getPlatformTaxHealthSnapshot,
  getVendorPlatformTaxDocument,
  isPlatformTaxMigrationApplied,
  listVendorPlatformTaxDocuments,
} from '../lib/platform-tax/platform-tax-api.service';
import { isPlatformTaxDocumentsEnabled } from '../lib/platform-tax/platform-tax-feature-flag';
import {
  generatePlatformTaxPdf,
  issuePlatformTaxInvoice,
  previewPlatformTaxInvoice,
  readPlatformTaxDocumentBytes,
} from '../lib/platform-tax/platform-tax-issue.service';
import {
  toDocumentDetailDto,
  toDocumentSummaryDto,
  type IssueTaxDocumentRequestDto,
} from './platform-tax-documents.dto';
import {
  assertPlatformTaxFeatureEnabledForMutation,
  mapPlatformTaxErrorToHttp,
  platformTaxFeatureDisabledResponse,
  requireAdminPlatformTaxAccess,
  requireVendorPlatformTaxAccess,
} from './platform-tax-documents.guard';

function parseJsonBody<T extends object>(body: unknown): T | null {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) return null;
  return body as T;
}

export function registerPlatformTaxEndpoints(app: Hono) {
  app.get('/vendor/:vendorId/platform-tax-documents', async (c) => {
    try {
      if (!isPlatformTaxDocumentsEnabled()) {
        return platformTaxFeatureDisabledResponse(c);
      }
      if (!(await isPlatformTaxMigrationApplied())) {
        return c.json(
          { success: false, error: 'Platform tax migration not applied', code: 'MIGRATION_REQUIRED' },
          503
        );
      }

      const access = await requireVendorPlatformTaxAccess(c, c.req.param('vendorId'));
      if (!access.ok) return access.response;

      const { documents, total } = await listVendorPlatformTaxDocuments({
        vendorId: access.vendorId,
        status: c.req.query('status') || undefined,
        documentType: c.req.query('documentType') || undefined,
        periodFrom: c.req.query('periodFrom') || undefined,
        periodTo: c.req.query('periodTo') || undefined,
        limit: c.req.query('limit') ? parseInt(c.req.query('limit')!, 10) : undefined,
        offset: c.req.query('offset') ? parseInt(c.req.query('offset')!, 10) : undefined,
      });

      return c.json({
        success: true,
        vendorId: access.vendorId,
        total,
        documents: documents.map(toDocumentSummaryDto),
      });
    } catch (error) {
      const mapped = mapPlatformTaxErrorToHttp(error);
      return c.json(mapped.body, mapped.status as 400);
    }
  });

  app.get('/vendor/:vendorId/platform-tax-documents/:id', async (c) => {
    try {
      if (!isPlatformTaxDocumentsEnabled()) {
        return platformTaxFeatureDisabledResponse(c);
      }
      if (!(await isPlatformTaxMigrationApplied())) {
        return c.json(
          { success: false, error: 'Platform tax migration not applied', code: 'MIGRATION_REQUIRED' },
          503
        );
      }

      const access = await requireVendorPlatformTaxAccess(c, c.req.param('vendorId'));
      if (!access.ok) return access.response;

      const document = await getVendorPlatformTaxDocument(access.vendorId, c.req.param('id'));
      return c.json({ success: true, document: toDocumentDetailDto(document) });
    } catch (error) {
      const mapped = mapPlatformTaxErrorToHttp(error);
      return c.json(mapped.body, mapped.status as 400);
    }
  });

  app.get('/vendor/:vendorId/platform-tax-documents/:id/pdf', async (c) => {
    try {
      if (!isPlatformTaxDocumentsEnabled()) {
        return platformTaxFeatureDisabledResponse(c);
      }
      if (!(await isPlatformTaxMigrationApplied())) {
        return c.json(
          { success: false, error: 'Platform tax migration not applied', code: 'MIGRATION_REQUIRED' },
          503
        );
      }

      const access = await requireVendorPlatformTaxAccess(c, c.req.param('vendorId'));
      if (!access.ok) return access.response;

      const documentId = c.req.param('id');
      const document = await getVendorPlatformTaxDocument(access.vendorId, documentId);

      let bytes = await readPlatformTaxDocumentBytes(documentId);
      if (!bytes) {
        await generatePlatformTaxPdf(documentId);
        bytes = await readPlatformTaxDocumentBytes(documentId);
      }

      if (!bytes) {
        return c.json(
          {
            success: false,
            error: 'Tax document file has not been generated for this document',
            code: 'PDF_NOT_GENERATED',
          },
          404
        );
      }

      const isHtml = bytes.slice(0, 15).toString('utf8').toLowerCase().includes('<!doctype');
      const number = document.invoice_number || documentId.slice(0, 8);
      const safeName = String(number).replace(/[^\w.-]+/g, '_');
      return new Response(bytes, {
        status: 200,
        headers: {
          'Content-Type': isHtml ? 'text/html; charset=utf-8' : 'application/pdf',
          'Content-Disposition': `attachment; filename="platform-tax-${safeName}.${isHtml ? 'html' : 'pdf'}"`,
          'Cache-Control': 'private, no-store',
        },
      });
    } catch (error) {
      const mapped = mapPlatformTaxErrorToHttp(error);
      return c.json(mapped.body, mapped.status as 400);
    }
  });

  app.get('/admin/platform-tax/health', async (c) => {
    const admin = await requireAdminPlatformTaxAccess(c);
    if (!admin.ok) return admin.response;
    const snapshot = await getPlatformTaxHealthSnapshot();
    return c.json({ success: true, ...snapshot });
  });

  app.post('/admin/platform-tax-documents/preview', async (c) => {
    try {
      assertPlatformTaxFeatureEnabledForMutation();
      const admin = await requireAdminPlatformTaxAccess(c);
      if (!admin.ok) return admin.response;

      if (!(await isPlatformTaxMigrationApplied())) {
        return c.json(
          { success: false, error: 'Platform tax migration not applied', code: 'MIGRATION_REQUIRED' },
          503
        );
      }

      const body = parseJsonBody<IssueTaxDocumentRequestDto>(await c.req.json());
      if (!body?.vendorId || !body.periodFrom || !body.periodTo) {
        return c.json({ success: false, error: 'vendorId, periodFrom, periodTo required' }, 400);
      }

      const preview = await previewPlatformTaxInvoice({
        vendorId: body.vendorId,
        periodFrom: body.periodFrom,
        periodTo: body.periodTo,
      });

      return c.json({ success: true, preview });
    } catch (error) {
      const mapped = mapPlatformTaxErrorToHttp(error);
      return c.json(mapped.body, mapped.status as 400);
    }
  });

  app.post('/admin/platform-tax-documents/issue', async (c) => {
    try {
      assertPlatformTaxFeatureEnabledForMutation();
      const admin = await requireAdminPlatformTaxAccess(c);
      if (!admin.ok) return admin.response;

      if (!(await isPlatformTaxMigrationApplied())) {
        return c.json(
          { success: false, error: 'Platform tax migration not applied', code: 'MIGRATION_REQUIRED' },
          503
        );
      }

      const body = parseJsonBody<IssueTaxDocumentRequestDto>(await c.req.json());
      if (!body?.vendorId || !body.periodFrom || !body.periodTo) {
        return c.json({ success: false, error: 'vendorId, periodFrom, periodTo required' }, 400);
      }

      const issued = await issuePlatformTaxInvoice({
        vendorId: body.vendorId,
        periodFrom: body.periodFrom,
        periodTo: body.periodTo,
      });

      await generatePlatformTaxPdf(issued.documentId);

      return c.json({ success: true, ...issued });
    } catch (error) {
      const mapped = mapPlatformTaxErrorToHttp(error);
      return c.json(mapped.body, mapped.status as 400);
    }
  });

  app.post('/admin/platform-tax-documents/:id/generate-pdf', async (c) => {
    try {
      assertPlatformTaxFeatureEnabledForMutation();
      const admin = await requireAdminPlatformTaxAccess(c);
      if (!admin.ok) return admin.response;

      const documentId = c.req.param('id');
      const { pdfPath, sizeBytes } = await generatePlatformTaxPdf(documentId);

      return c.json({
        success: true,
        documentId,
        pdfUrl: pdfPath,
        sizeBytes,
      });
    } catch (error) {
      const mapped = mapPlatformTaxErrorToHttp(error);
      return c.json(mapped.body, mapped.status as 400);
    }
  });
}
