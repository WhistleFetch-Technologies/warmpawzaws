"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCustomerMedicalRecordsEndpointsSQL = registerCustomerMedicalRecordsEndpointsSQL;
const response_utils_1 = require("./response-utils");
const pets_1 = require("../lib/repositories/pets");
const db_1 = require("../lib/db");
const notifications_1 = require("../lib/repositories/notifications");
function registerCustomerMedicalRecordsEndpointsSQL(app) {
    const BASE_PATH = "/make-server-3dd53475";
    const petsRepo = (0, pets_1.getPetsRepository)();
    const notificationsRepo = (0, notifications_1.getNotificationsRepository)();
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
            const { customerId, documentType, // prescription, lab_report, xray, vaccination, medical_history
            documentName, documentData, // base64 or URL
            documentDate, notes, veterinarianName, veterinarianClinic } = await c.req.json();
            if (!customerId || !documentType || !documentData) {
                return (0, response_utils_1.sendError)(c, 'Missing required fields: customerId, documentType, documentData', 400);
            }
            // ✅ SQL: Verify pet belongs to customer
            const pet = await petsRepo.findById(petId);
            if (!pet) {
                return (0, response_utils_1.sendError)(c, 'Pet not found', 404);
            }
            if (pet.customer_id !== customerId) {
                return (0, response_utils_1.sendError)(c, 'Unauthorized: Pet does not belong to this customer', 403);
            }
            // ✅ SQL: Create document record
            const documentId = generateDocumentId();
            const now = new Date().toISOString();
            const pool = await (0, db_1.getDbClient)();
            const documents = await (0, db_1.insertQuery)('medical_documents', {
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
            });
            const document = documents[0];
            if (!document) {
                console.error('Error creating medical document: No document returned');
                return (0, response_utils_1.sendError)(c, 'Failed to upload document', 500);
            }
            // ✅ SQL: Update pet profile with latest vaccination if applicable
            if (documentType === 'vaccination' && documentDate) {
                await (0, db_1.updateQuery)('pets', { id: petId }, {
                    last_vaccination_date: documentDate,
                    vaccination_up_to_date: true,
                    updated_at: now
                });
            }
            console.log(`📄 Medical document uploaded: ${documentId} for pet ${petId}`);
            return (0, response_utils_1.sendSuccess)(c, {
                document: {
                    id: document.id,
                    documentType: document.document_type,
                    documentName: document.document_name,
                    uploadedAt: document.uploaded_at
                },
                message: 'Document uploaded successfully'
            });
        }
        catch (error) {
            console.error('Error uploading medical document:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
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
            const pool = await (0, db_1.getDbClient)();
            const filters = { pet_id: petId };
            if (documentType) {
                filters.document_type = documentType;
            }
            const documents = await (0, db_1.selectQuery)('medical_documents', filters, {
                orderBy: 'uploaded_at',
                orderDirection: 'desc'
            });
            // Group by type
            const groupedByType = {};
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
            return (0, response_utils_1.sendSuccess)(c, {
                documents: documents || [],
                groupedByType,
                totalDocuments: (documents || []).length
            });
        }
        catch (error) {
            console.error('Error fetching medical documents:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
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
                return (0, response_utils_1.sendError)(c, 'Missing required fields: customerId, photoData', 400);
            }
            // ✅ SQL: Verify pet ownership
            const pet = await petsRepo.findById(petId);
            if (!pet) {
                return (0, response_utils_1.sendError)(c, 'Pet not found', 404);
            }
            if (pet.customer_id !== customerId) {
                return (0, response_utils_1.sendError)(c, 'Unauthorized', 403);
            }
            // ✅ SQL: Update pet photo
            const pool = await (0, db_1.getDbClient)();
            await (0, db_1.updateQuery)('pets', { id: petId }, {
                photo: photoData, // In production, upload to storage and store URL
                photo_uploaded_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            console.log(`📸 Pet photo uploaded for ${petId}`);
            return (0, response_utils_1.sendSuccess)(c, {
                message: 'Pet photo uploaded successfully'
            });
        }
        catch (error) {
            console.error('Error uploading pet photo:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
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
                return (0, response_utils_1.sendError)(c, 'customerId required', 400);
            }
            // ✅ SQL: Get document and verify ownership
            const pool = await (0, db_1.getDbClient)();
            const documents = await (0, db_1.selectQuery)('medical_documents', {
                id: documentId,
                customer_id: customerId
            }, { limit: 1 });
            const document = documents[0];
            if (!document) {
                return (0, response_utils_1.sendError)(c, 'Document not found', 404);
            }
            // ✅ SQL: Delete document
            await pool.query('DELETE FROM medical_documents WHERE id = $1', [documentId]);
            console.log(`🗑️ Medical document deleted: ${documentId}`);
            return (0, response_utils_1.sendSuccess)(c, {
                message: 'Document deleted successfully'
            });
        }
        catch (error) {
            console.error('Error deleting medical document:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
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
                return (0, response_utils_1.sendError)(c, 'Missing required fields: documentIds, vendorId, customerId', 400);
            }
            // ✅ SQL: Verify all documents belong to customer
            const pool = await (0, db_1.getDbClient)();
            const placeholders = documentIds.map((_, i) => `$${i + 1}`).join(', ');
            const documentsResult = await pool.query(`SELECT id, customer_id FROM medical_documents WHERE id IN (${placeholders})`, documentIds);
            const documents = documentsResult.rows || [];
            const invalidDocs = documents.filter((doc) => doc.customer_id !== customerId);
            if (invalidDocs.length > 0) {
                return (0, response_utils_1.sendError)(c, 'Unauthorized: One or more documents do not belong to this customer', 403);
            }
            // ✅ SQL: Create share record
            const shareId = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const now = new Date().toISOString();
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
            const shareRecords = await (0, db_1.insertQuery)('document_shares', {
                id: shareId,
                customer_id: customerId,
                vendor_id: vendorId,
                booking_id: bookingId || null,
                document_ids: documentIds,
                shared_at: now,
                expires_at: expiresAt
            });
            const shareRecord = shareRecords[0];
            if (!shareRecord) {
                console.error('Error creating document share: No record returned');
                return (0, response_utils_1.sendError)(c, 'Failed to share documents', 500);
            }
            // ✅ SQL: Notify vendor
            await notificationsRepo.create({
                recipient_id: vendorId,
                recipient_type: 'vendor',
                notification_type: 'medical_documents_shared',
                title: 'Medical Documents Shared',
                message: 'Customer has shared medical documents',
                data: { shareId, documentIds },
            });
            console.log(`📤 Medical documents shared: ${shareId} with vendor ${vendorId}`);
            return (0, response_utils_1.sendSuccess)(c, {
                shareId: shareRecord.id,
                expiresAt: shareRecord.expires_at,
                message: 'Documents shared successfully'
            });
        }
        catch (error) {
            console.error('Error sharing medical documents:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
        }
    });
}
//# sourceMappingURL=customer-medical-records-sql.js.map