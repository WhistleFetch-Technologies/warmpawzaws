/**
 * CUSTOMER MEDICAL RECORDS UPLOAD (SQL-ONLY VERSION)
 * 
 * Features:
 * - Upload medical documents (prescriptions, lab reports, x-rays)
 * - Vaccination certificate upload
 * - Pet photo upload
 * - Document categorization
 * - Secure storage with Supabase
 * - Document sharing with vets
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()`, `kv.del()` with SQL repository calls
 * - All data now comes from SQL tables (pets, medical_documents, document_shares)
 * 
 * Date: 2025-01-27
 * Migration: Batch 8 - Complete KV to SQL Migration
 * Status: ✅ P1 IMPLEMENTATION
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getPetsRepository } from '../../lib/repositories/pets.ts';
import { getDbClient } from '../../lib/db.ts';
import { getNotificationsRepository } from '../../lib/repositories/notifications.ts';

export function registerCustomerMedicalRecordsEndpointsSQL(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const client = getDbClient();
  const petsRepo = getPetsRepository();
  const notificationsRepo = getNotificationsRepository();

  // Helper: Generate document ID
  function generateDocumentId() {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ==========================================================================
  // UPLOAD PET MEDICAL DOCUMENT
  // ==========================================================================

  /**
   * POST /pets/:petId/medical-documents/upload
   * Upload medical document for pet
   */
  app.post(`${BASE_PATH}/pets/:petId/medical-documents/upload`, async (c) => {
    try {
      const petId = c.req.param('petId');
      const {
        customerId,
        documentType, // prescription, lab_report, xray, vaccination, medical_history
        documentName,
        documentData, // base64 or URL
        documentDate,
        notes,
        veterinarianName,
        veterinarianClinic
      } = await c.req.json();

      if (!customerId || !documentType || !documentData) {
        return sendError(c, 'Missing required fields: customerId, documentType, documentData', 400);
      }

      // ✅ SQL: Verify pet belongs to customer
      const pet = await petsRepo.findById(petId);
      if (!pet) {
        return sendError(c, 'Pet not found', 404);
      }

      if (pet.owner_id !== customerId) {
        return sendError(c, 'Unauthorized: Pet does not belong to this customer', 403);
      }

      // ✅ SQL: Create document record
      const documentId = generateDocumentId();
      const now = new Date().toISOString();

      const { data: document, error } = await client
        .from('medical_documents')
        .insert({
          id: documentId,
          pet_id: petId,
          customer_id: customerId,
          document_type: documentType,
          document_name: documentName || `${documentType}_${new Date().toISOString().split('T')[0]}`,
          document_data: documentData, // In production, upload to Supabase Storage and store URL
          document_date: documentDate || now,
          notes: notes || '',
          veterinarian_name: veterinarianName || '',
          veterinarian_clinic: veterinarianClinic || '',
          uploaded_at: now,
          file_size: documentData.length,
          is_verified: false
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating medical document:', error);
        return sendError(c, 'Failed to upload document', 500);
      }

      // ✅ SQL: Update pet profile with latest vaccination if applicable
      if (documentType === 'vaccination' && documentDate) {
        await client
          .from('pets')
          .update({
            last_vaccination_date: documentDate,
            vaccination_up_to_date: true,
            updated_at: now
          })
          .eq('id', petId);
      }

      console.log(`📄 Medical document uploaded: ${documentId} for pet ${petId}`);

      return sendSuccess(c, {
        document: {
          id: document.id,
          documentType: document.document_type,
          documentName: document.document_name,
          uploadedAt: document.uploaded_at
        },
        message: 'Document uploaded successfully'
      });
    } catch (error) {
      console.error('Error uploading medical document:', error);
      return sendError(c, String(error), 500);
    }
  });

  // ==========================================================================
  // GET PET MEDICAL DOCUMENTS
  // ==========================================================================

  /**
   * GET /pets/:petId/medical-documents
   * Get all medical documents for a pet
   */
  app.get(`${BASE_PATH}/pets/:petId/medical-documents`, async (c) => {
    try {
      const petId = c.req.param('petId');
      const documentType = c.req.query('type'); // Optional filter

      // ✅ SQL: Fetch documents
      let query = client
        .from('medical_documents')
        .select('*')
        .eq('pet_id', petId)
        .order('uploaded_at', { ascending: false });

      if (documentType) {
        query = query.eq('document_type', documentType);
      }

      const { data: documents, error } = await query;

      if (error) {
        console.error('Error fetching medical documents:', error);
        return sendError(c, 'Failed to fetch documents', 500);
      }

      // Group by type
      const groupedByType: any = {};
      (documents || []).forEach(doc => {
        const type = doc.document_type;
        if (!groupedByType[type]) {
          groupedByType[type] = [];
        }
        groupedByType[type].push({
          id: doc.id,
          documentType: doc.document_type,
          documentName: doc.document_name,
          documentDate: doc.document_date,
          uploadedAt: doc.uploaded_at,
          isVerified: doc.is_verified
        });
      });

      return sendSuccess(c, {
        documents: documents || [],
        groupedByType,
        totalDocuments: (documents || []).length
      });
    } catch (error) {
      console.error('Error fetching medical documents:', error);
      return sendError(c, String(error), 500);
    }
  });

  // ==========================================================================
  // UPLOAD PET PHOTO
  // ==========================================================================

  /**
   * POST /pets/:petId/photo
   * Upload pet photo
   */
  app.post(`${BASE_PATH}/pets/:petId/photo`, async (c) => {
    try {
      const petId = c.req.param('petId');
      const { customerId, photoData } = await c.req.json();

      if (!customerId || !photoData) {
        return sendError(c, 'Missing required fields: customerId, photoData', 400);
      }

      // ✅ SQL: Verify pet ownership
      const pet = await petsRepo.findById(petId);
      if (!pet) {
        return sendError(c, 'Pet not found', 404);
      }

      if (pet.owner_id !== customerId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // ✅ SQL: Update pet photo
      await client
        .from('pets')
        .update({
          photo: photoData, // In production, upload to storage and store URL
          photo_uploaded_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', petId);

      console.log(`📸 Pet photo uploaded for ${petId}`);

      return sendSuccess(c, {
        message: 'Pet photo uploaded successfully'
      });
    } catch (error) {
      console.error('Error uploading pet photo:', error);
      return sendError(c, String(error), 500);
    }
  });

  // ==========================================================================
  // DELETE MEDICAL DOCUMENT
  // ==========================================================================

  /**
   * DELETE /medical-documents/:documentId
   * Delete a medical document
   */
  app.delete(`${BASE_PATH}/medical-documents/:documentId`, async (c) => {
    try {
      const documentId = c.req.param('documentId');
      const customerId = c.req.query('customerId');

      if (!customerId) {
        return sendError(c, 'customerId required', 400);
      }

      // ✅ SQL: Get document and verify ownership
      const { data: document, error: fetchError } = await client
        .from('medical_documents')
        .select('*')
        .eq('id', documentId)
        .eq('customer_id', customerId)
        .maybeSingle();

      if (fetchError || !document) {
        return sendError(c, 'Document not found', 404);
      }

      // ✅ SQL: Delete document
      const { error: deleteError } = await client
        .from('medical_documents')
        .delete()
        .eq('id', documentId);

      if (deleteError) {
        console.error('Error deleting medical document:', deleteError);
        return sendError(c, 'Failed to delete document', 500);
      }

      console.log(`🗑️ Medical document deleted: ${documentId}`);

      return sendSuccess(c, {
        message: 'Document deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting medical document:', error);
      return sendError(c, String(error), 500);
    }
  });

  // ==========================================================================
  // SHARE MEDICAL DOCUMENTS WITH VET
  // ==========================================================================

  /**
   * POST /medical-documents/share
   * Share medical documents with veterinarian
   */
  app.post(`${BASE_PATH}/medical-documents/share`, async (c) => {
    try {
      const { documentIds, vendorId, bookingId, customerId } = await c.req.json();

      if (!documentIds || !vendorId || !customerId) {
        return sendError(c, 'Missing required fields: documentIds, vendorId, customerId', 400);
      }

      // ✅ SQL: Verify all documents belong to customer
      const { data: documents } = await client
        .from('medical_documents')
        .select('id, customer_id')
        .in('id', documentIds);

      const invalidDocs = (documents || []).filter(doc => doc.customer_id !== customerId);
      if (invalidDocs.length > 0) {
        return sendError(c, 'Unauthorized: One or more documents do not belong to this customer', 403);
      }

      // ✅ SQL: Create share record
      const shareId = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

      const { data: shareRecord, error: shareError } = await client
        .from('document_shares')
        .insert({
          id: shareId,
          customer_id: customerId,
          vendor_id: vendorId,
          booking_id: bookingId || null,
          document_ids: documentIds,
          shared_at: now,
          expires_at: expiresAt
        })
        .select()
        .single();

      if (shareError) {
        console.error('Error creating document share:', shareError);
        return sendError(c, 'Failed to share documents', 500);
      }

      // ✅ SQL: Notify vendor
      await notificationsRepo.create({
        recipient_id: vendorId,
        recipient_type: 'vendor',
        type: 'medical_documents_shared',
        title: 'Medical Documents Shared',
        message: 'Customer has shared medical documents',
        metadata: { shareId, documentIds },
        created_at: now
      });

      console.log(`📤 Medical documents shared: ${shareId} with vendor ${vendorId}`);

      return sendSuccess(c, {
        shareId: shareRecord.id,
        expiresAt: shareRecord.expires_at,
        message: 'Documents shared successfully'
      });
    } catch (error) {
      console.error('Error sharing medical documents:', error);
      return sendError(c, String(error), 500);
    }
  });
}

