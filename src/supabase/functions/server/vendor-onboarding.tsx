import { Hono } from "npm:hono";
import { determineServiceCategory, getServiceCategoryFromVendorTypes } from "./service-category-mapping.tsx";
import { normalizePhone, createVendorId } from "./phone-utils.tsx";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * Vendor Onboarding & Application Management Endpoints
 * Handles vendor application submission, approval, rejection, and service setup
 */
export function vendorOnboardingEndpoints(app: Hono, kv: any) {

  /**
   * NOTE: /config/roles endpoint has been moved to vendor-role-config.tsx
   * to centralize role management and prevent shadowing issues.
   * DO NOT re-add this endpoint here.
   */

  /**
   * POST /make-server-3dd53475/vendor/apply
   * Submit vendor application
   */
  app.post("/make-server-3dd53475/vendor/apply", async (c) => {
    try {
      const body = await c.req.json();
      const { roleId, phone, email, serviceStyle, location } = body;
      const formData = body.formData || {};
      const documents = body.documents || {};
      
      console.log(`📝 Received new vendor application submission`);
      console.log(`   Role ID: ${roleId}`);
      console.log(`   Phone: ${phone}`);
      
      // Generate IDs
      const cleanPhone = normalizePhone(phone);
      const vendorId = createVendorId(cleanPhone);
      const applicationId = `APP${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      // Get role configuration
      const role = await kv.get(`role:config:${roleId}`);
      const roleName = role?.name || 'Vendor';
      const vendorType = role?.vendorTypes?.[0] || 'service_provider';
      const serviceCategory = determineServiceCategory(role);
      
      console.log(`🔍 Resolved Role: ${roleName}, Type: ${vendorType}, Category: ${serviceCategory}`);

      // Process documents
      const documentsArray = [];
      if (documents) {
        for (const [key, docData] of Object.entries(documents)) {
          // Handle nested structure (e.g. aadhar.front) or direct structure
          if (typeof docData === 'object' && docData !== null) {
             // Check for sides like front/back
             for (const [side, sideData] of Object.entries(docData)) {
               if (sideData && typeof sideData === 'object' && (sideData as any).preview) {
                 const sd = sideData as any;
                 documentsArray.push({
                   name: `${key} - ${side}`,
                   type: key,
                   category: 'Document',
                   preview: sd.preview,
                   fileName: sd.fileName,
                   fileType: sd.fileType
                 });
               } else if ((docData as any).preview) {
                 // It's a direct document without sides (e.g. docData is the file obj)
                 const dd = docData as any;
                 documentsArray.push({
                   name: key,
                   type: key,
                   category: 'Document',
                   preview: dd.preview,
                   fileName: dd.fileName,
                   fileType: dd.fileType
                 });
                 break; // Break inner loop as we handled the parent
               }
             }
          }
        }
      }
      console.log(`📎 Processed ${documentsArray.length} documents`);

      // Create Vendor Record
      const vendorKey = `vendor:${vendorId}`;
      let vendor = await kv.get(vendorKey);
      
      if (!vendor) {
        vendor = {
          id: vendorId,
          createdAt: new Date().toISOString()
        };
      }
      
      // Update vendor fields
      vendor = {
        ...vendor,
        applicationId,
        roleId,
        roleName,
        serviceCategory,
        vendorType,
        serviceStyle,
        
        fullName: formData.fullName,
        email: email || formData.email,
        phone: phone || formData.phone,
        
        // Address
        address: formData.address,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        location: location || formData.location,
        
        // Business
        businessName: formData.businessName,
        gstNumber: formData.gstNumber,
        yearsOfExperience: formData.yearsOfExperience,
        
        // Bank
        bankDetails: {
          accountHolderName: formData.accountHolderName,
          accountNumber: formData.accountNumber,
          ifscCode: formData.ifscCode,
          bankName: formData.bankName,
          branchName: formData.branchName
        },
        
        documents: documentsArray,
        documentsRaw: documents,
        customFields: formData,
        
        // Status
        status: 'pending',
        setupCompleted: false,
        isActive: false,
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(vendorKey, vendor);
      
      // Store separate application record
      const application = {
        id: applicationId,
        applicationId,
        vendorId,
        roleId,
        roleName,
        serviceCategory,
        vendorType,
        
        fullName: formData.fullName,
        businessName: formData.businessName,
        phone: phone || formData.phone,
        email: email || formData.email,
        
        formData,
        documentsRaw: documents,
        documents: documentsArray,
        
        status: 'pending',
        submittedAt: new Date().toISOString()
      };
      
      await kv.set(`vendor:application:${applicationId}`, application);
      
      // Add to pending applications list
      const pendingApps = await kv.get('vendor:applications:pending') || [];
      if (!pendingApps.includes(applicationId)) {
        pendingApps.push(applicationId);
        await kv.set('vendor:applications:pending', pendingApps);
      }
      
      console.log(`🎉 Application created: ${applicationId} for vendor ${vendorId}`);
      
      return sendSuccess(c, {
        applicationId,
        vendorId,
        message: 'Application submitted successfully'
      });
      
    } catch (error) {
      console.error('❌ Error creating application:', error);
      return sendError(c, error, 500);
    }
  });

}