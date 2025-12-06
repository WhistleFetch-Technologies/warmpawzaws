import { Hono } from "npm:hono";

/**
 * Vendor Data Migration & Diagnostic Tools
 * Fixes existing vendor data and ensures proper status sync
 */
export function vendorMigrationEndpoints(app: Hono, kv: any) {

  // ============================================
  // DIAGNOSTIC: Find vendor by phone
  // ============================================
  
  app.get("/make-server-3dd53475/admin/vendor/diagnose/:phone", async (c) => {
    try {
      const { phone } = c.req.param();
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      
      console.log(`🔍 DIAGNOSTIC: Searching for vendor with phone: ${cleanPhone}`);
      
      const results: any = {
        phone: cleanPhone,
        found: false,
        records: []
      };
      
      // Search all vendor-related keys
      const allVendorKeys = await kv.getByPrefix('vendor:');
      
      console.log(`📋 Total vendor-related keys: ${allVendorKeys.length}`);
      
      for (const record of allVendorKeys) {
        if (!record || !record.phone) continue;
        
        const recordPhone = record.phone.replace(/[^0-9]/g, '');
        
        if (recordPhone === cleanPhone) {
          results.found = true;
          
          // Determine the key pattern
          let keyPattern = 'unknown';
          let keyValue = '';
          
          // Try to extract the key from the record structure
          const recordStr = JSON.stringify(record);
          if (recordStr.includes('vendor:vendor_')) {
            keyPattern = 'vendor:vendor_';
            keyValue = `vendor:${record.id}`;
          } else if (recordStr.includes('vendor:profile:')) {
            keyPattern = 'vendor:profile:';
            keyValue = `vendor:profile:${record.id}`;
          } else if (recordStr.includes('vendor:application:')) {
            keyPattern = 'vendor:application:';
            keyValue = `vendor:application:${record.id}`;
          }
          
          results.records.push({
            key: keyValue,
            keyPattern: keyPattern,
            id: record.id,
            fullName: record.fullName || record.ownerName,
            businessName: record.businessName,
            email: record.email,
            phone: record.phone,
            vendorType: record.vendorType,
            serviceStyle: record.serviceStyle,
            status: record.status || record.applicationStatus,
            submittedAt: record.submittedAt,
            createdAt: record.createdAt,
            applicationId: record.applicationId,
            setupCompleted: record.setupCompleted,
            isActive: record.isActive
          });
          
          console.log(`✅ Found record:`, {
            key: keyValue,
            id: record.id,
            status: record.status,
            businessName: record.businessName
          });
        }
      }
      
      console.log(`📊 Found ${results.records.length} records for phone ${cleanPhone}`);
      
      return c.json(results);
    } catch (error) {
      console.error('❌ Diagnostic error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // MIGRATION: Fix vendor data
  // ============================================
  
  app.post("/make-server-3dd53475/admin/vendor/migrate/:phone", async (c) => {
    try {
      const { phone } = c.req.param();
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      
      console.log(`🔧 MIGRATION: Fixing vendor with phone: ${cleanPhone}`);
      
      // Find all records for this phone
      const allVendorKeys = await kv.getByPrefix('vendor:');
      const vendorRecords = [];
      
      for (const record of allVendorKeys) {
        if (!record || !record.phone) continue;
        const recordPhone = record.phone.replace(/[^0-9]/g, '');
        if (recordPhone === cleanPhone) {
          vendorRecords.push(record);
        }
      }
      
      if (vendorRecords.length === 0) {
        return c.json({ error: 'No vendor found with this phone number' }, 404);
      }
      
      console.log(`📋 Found ${vendorRecords.length} records for phone ${cleanPhone}`);
      
      // Find the main vendor record (vendor:vendor_xxx pattern)
      let mainVendor = vendorRecords.find(r => 
        r.id && r.id.startsWith('vendor_') && !r.applicationId
      );
      
      // If no main vendor, find the profile
      if (!mainVendor) {
        mainVendor = vendorRecords.find(r => r.vendorType);
      }
      
      if (!mainVendor) {
        mainVendor = vendorRecords[0]; // Use first record as fallback
      }
      
      console.log(`🎯 Main vendor record:`, {
        id: mainVendor.id,
        businessName: mainVendor.businessName,
        status: mainVendor.status
      });
      
      // Create/update the proper vendor record at vendor:vendor_xxx
      const vendorId = mainVendor.id;
      const vendorKey = `vendor:${vendorId}`;
      
      // Check if application was submitted
      const hasSubmittedApplication = mainVendor.businessName && 
                                      mainVendor.vendorType && 
                                      mainVendor.address;
      
      // Determine correct status
      let correctStatus = 'pending_approval'; // Default for submitted applications
      
      if (mainVendor.status === 'approved') {
        correctStatus = 'approved';
      } else if (mainVendor.status === 'rejected') {
        correctStatus = 'rejected';
      } else if (mainVendor.status === 'clarification_requested') {
        correctStatus = 'clarification_requested';
      } else if (!hasSubmittedApplication) {
        correctStatus = 'new'; // No application yet
      }
      
      // Map legacy vendor types to new role IDs
      const roleId = mapVendorTypeToRoleId(mainVendor.vendorType);
      
      // Build the complete vendor record
      const fixedVendor = {
        id: vendorId,
        fullName: mainVendor.fullName || mainVendor.ownerName || 'Vendor',
        businessName: mainVendor.businessName || '',
        vendorType: mainVendor.vendorType || '',
        serviceStyle: mainVendor.serviceStyle || '',
        roleId: roleId, // ✅ NEW: Add roleId for new system
        email: mainVendor.email || '',
        phone: mainVendor.phone,
        address: mainVendor.address || '',
        city: mainVendor.city || '',
        state: mainVendor.state || '',
        pincode: mainVendor.pincode || '',
        gstNumber: mainVendor.gstNumber || mainVendor.gstin || '',
        panNumber: mainVendor.panNumber || mainVendor.pan || '',
        licenseNumber: mainVendor.licenseNumber || '',
        documents: mainVendor.documents || [],
        location: mainVendor.location || null,
        status: correctStatus,
        applicationStatus: correctStatus, // ✅ Ensure both fields are set
        submittedAt: mainVendor.submittedAt || mainVendor.createdAt || new Date().toISOString(),
        createdAt: mainVendor.createdAt || mainVendor.created_at || new Date().toISOString(),
        setupCompleted: mainVendor.setupCompleted || false,
        isActive: mainVendor.isActive || (correctStatus === 'approved'),
        applicationId: mainVendor.applicationId || null
      };
      
      // Save the fixed vendor record
      await kv.set(vendorKey, fixedVendor);
      console.log(`✅ Saved vendor at ${vendorKey} with status: ${correctStatus}`);
      
      // Create application record if needed
      if (hasSubmittedApplication && correctStatus === 'pending_approval') {
        const applicationId = mainVendor.applicationId || `APP${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        
        const application = {
          id: applicationId,
          applicationId: applicationId,
          vendorId: vendorId,
          fullName: fixedVendor.fullName,
          businessName: fixedVendor.businessName,
          vendorType: fixedVendor.vendorType,
          serviceStyle: fixedVendor.serviceStyle,
          email: fixedVendor.email,
          phone: fixedVendor.phone,
          location: fixedVendor.location,
          address: fixedVendor.address,
          city: fixedVendor.city,
          state: fixedVendor.state,
          pincode: fixedVendor.pincode,
          gstNumber: fixedVendor.gstNumber,
          panNumber: fixedVendor.panNumber,
          licenseNumber: fixedVendor.licenseNumber,
          documents: fixedVendor.documents,
          status: 'pending',
          submittedAt: fixedVendor.submittedAt,
          reviewedAt: null,
          reviewedBy: null,
          rejectionReason: null,
          clarificationNotes: null
        };
        
        await kv.set(`vendor:application:${applicationId}`, application);
        console.log(`✅ Created application record: ${applicationId}`);
        
        // Update vendor with application ID
        fixedVendor.applicationId = applicationId;
        await kv.set(vendorKey, fixedVendor);
      }
      
      // Verify it will show up in admin portal
      const willShowInAdmin = hasSubmittedApplication && correctStatus === 'pending_approval';
      
      const result = {
        success: true,
        vendor: fixedVendor,
        migration: {
          recordsFound: vendorRecords.length,
          vendorId: vendorId,
          vendorKey: vendorKey,
          status: correctStatus,
          hasSubmittedApplication,
          willShowInAdminPortal: willShowInAdmin
        }
      };
      
      console.log(`🎉 Migration complete for ${cleanPhone}:`, result.migration);
      
      return c.json(result);
    } catch (error) {
      console.error('❌ Migration error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // BULK MIGRATION: Fix all vendors
  // ============================================
  
  app.post("/make-server-3dd53475/admin/vendor/migrate-all", async (c) => {
    try {
      console.log(`🔧 BULK MIGRATION: Fixing all vendors...`);
      
      const allVendorKeys = await kv.getByPrefix('vendor:');
      console.log(`📋 Total vendor-related keys: ${allVendorKeys.length}`);
      
      // Group by phone number
      const vendorsByPhone: Record<string, any[]> = {};
      
      for (const record of allVendorKeys) {
        if (!record || !record.phone) continue;
        
        const cleanPhone = record.phone.replace(/[^0-9]/g, '');
        if (!vendorsByPhone[cleanPhone]) {
          vendorsByPhone[cleanPhone] = [];
        }
        vendorsByPhone[cleanPhone].push(record);
      }
      
      const phoneNumbers = Object.keys(vendorsByPhone);
      console.log(`📊 Found ${phoneNumbers.length} unique vendors`);
      
      const results = [];
      
      for (const phone of phoneNumbers) {
        try {
          const records = vendorsByPhone[phone];
          
          // Find main vendor record
          let mainVendor = records.find(r => 
            r.id && r.id.startsWith('vendor_')
          ) || records[0];
          
          const vendorId = mainVendor.id;
          const vendorKey = `vendor:${vendorId}`;
          
          const hasSubmittedApplication = mainVendor.businessName && 
                                          mainVendor.vendorType;
          
          let correctStatus = 'pending_approval';
          if (mainVendor.status === 'approved') correctStatus = 'approved';
          else if (mainVendor.status === 'rejected') correctStatus = 'rejected';
          else if (mainVendor.status === 'clarification_requested') correctStatus = 'clarification_requested';
          else if (!hasSubmittedApplication) correctStatus = 'new';
          
          // Map legacy vendor types to new role IDs
          const roleId = mapVendorTypeToRoleId(mainVendor.vendorType);
          
          const fixedVendor = {
            id: vendorId,
            fullName: mainVendor.fullName || mainVendor.ownerName || 'Vendor',
            businessName: mainVendor.businessName || '',
            vendorType: mainVendor.vendorType || '',
            serviceStyle: mainVendor.serviceStyle || '',
            roleId: roleId, // ✅ NEW: Add roleId for new system
            email: mainVendor.email || '',
            phone: mainVendor.phone,
            address: mainVendor.address || '',
            city: mainVendor.city || '',
            state: mainVendor.state || '',
            pincode: mainVendor.pincode || '',
            gstNumber: mainVendor.gstNumber || mainVendor.gstin || '',
            panNumber: mainVendor.panNumber || mainVendor.pan || '',
            licenseNumber: mainVendor.licenseNumber || '',
            documents: mainVendor.documents || [],
            location: mainVendor.location || null,
            status: correctStatus,
            applicationStatus: correctStatus, // ✅ Ensure both fields are set
            submittedAt: mainVendor.submittedAt || mainVendor.createdAt || new Date().toISOString(),
            createdAt: mainVendor.createdAt || mainVendor.created_at || new Date().toISOString(),
            setupCompleted: mainVendor.setupCompleted || false,
            isActive: mainVendor.isActive || (correctStatus === 'approved'),
            applicationId: mainVendor.applicationId || null
          };
          
          await kv.set(vendorKey, fixedVendor);
          
          results.push({
            phone: phone,
            vendorId: vendorId,
            businessName: fixedVendor.businessName,
            status: correctStatus,
            roleId: roleId,
            success: true
          });
          
          console.log(`✅ Fixed vendor ${vendorId} - ${phone} - ${correctStatus} - Role: ${roleId}`);
        } catch (error) {
          results.push({
            phone: phone,
            error: String(error),
            success: false
          });
          console.error(`❌ Failed to fix vendor ${phone}:`, error);
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      console.log(`🎉 Bulk migration complete: ${successCount}/${results.length} vendors fixed`);
      
      return c.json({
        success: true,
        totalVendors: results.length,
        successCount: successCount,
        failureCount: results.length - successCount,
        results: results
      });
    } catch (error) {
      console.error('❌ Bulk migration error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // HELPER: Map legacy vendor type to new role ID
  // ============================================
  function mapVendorTypeToRoleId(vendorType: string): string {
    if (!vendorType) return 'veterinarian'; // Default fallback
    
    const normalized = vendorType.toLowerCase().trim();

    const typeMap: Record<string, string> = {
      // Healthcare
      'veterinarian': 'veterinarian',
      'vet': 'veterinarian',
      'healthcare': 'veterinarian',
      'clinic': 'veterinarian',
      'pet_clinic': 'pet_clinic',
      
      // Pet Services
      'groomer': 'pet_groomer',
      'grooming': 'pet_groomer',
      'walker': 'pet_walker',
      'walking': 'pet_walker',
      'training': 'pet_trainer',
      'trainer': 'pet_trainer',
      'boarding': 'pet_boarding',
      'boarder': 'pet_boarding',
      'sitter': 'pet_sitter',
      'sitting': 'pet_sitter',
      'taxi': 'pet_taxi',
      'transport': 'pet_taxi',
      
      // Retail
      'seller': 'pet_products_store',
      'retail': 'pet_products_store',
      'shop': 'pet_products_store',
      'store': 'pet_products_store',
      'pharmacy': 'pet_pharmacy',
      
      // Other
      'photography': 'pet_photographer',
      'photographer': 'pet_photographer',
      'cafe': 'pet_cafe',
      'shelter': 'pet_shelter',
      'ngo': 'pet_shelter',
      'sunset': 'pet_sunset_services',
      'cremation': 'pet_sunset_services'
    };
    
    // Direct match or mapped match
    if (typeMap[normalized]) return typeMap[normalized];
    
    // If the normalized type is already a valid role key (e.g. pet_walker)
    if (normalized.startsWith('pet_')) return normalized;
    
    return 'veterinarian'; // Safer fallback for professional services
  }
}