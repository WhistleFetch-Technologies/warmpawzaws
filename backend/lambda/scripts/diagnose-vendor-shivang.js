const { query } = require('../src/database/rds-connection');

(async () => {
  try {
    console.log('=== DIAGNOSTIC: Finding vendor Dr_Shivang_98765 42310_SOLO ===\n');
    
    // Search for vendor with multiple patterns
    const searchPatterns = [
      '%Shivang%',
      '%98765%42310%',
      '%42310%',
      '%Dr_Shivang%',
      '%SOLO%42310%'
    ];
    
    let vendorResult = { rows: [] };
    for (const pattern of searchPatterns) {
      vendorResult = await query(`
        SELECT 
          v.id, 
          v.business_name, 
          v.owner_name, 
          v.phone, 
          v.status, 
          v.is_active, 
          v.vendor_type,
          v.latitude,
          v.longitude,
          r.id as role_id,
          r.name as role_name, 
          r.display_name as role_display_name
        FROM vendors v 
        LEFT JOIN roles r ON v.role_id = r.id 
        WHERE 
          v.business_name ILIKE $1 
          OR v.owner_name ILIKE $1
          OR v.phone LIKE $1
        ORDER BY v.created_at DESC 
        LIMIT 10
      `, [pattern]);
      
      if (vendorResult.rows.length > 0) {
        console.log(`Found vendor(s) with pattern "${pattern}":`);
        break;
      }
    }
    
    if (vendorResult.rows.length === 0) {
      console.log('❌ Vendor NOT FOUND in database');
      console.log('\nTrying broader search...');
      
      // Try searching all vendors with phone containing 42310
      vendorResult = await query(`
        SELECT 
          v.id, 
          v.business_name, 
          v.owner_name, 
          v.phone, 
          v.status, 
          v.is_active, 
          v.vendor_type,
          r.name as role_name
        FROM vendors v 
        LEFT JOIN roles r ON v.role_id = r.id 
        WHERE v.phone LIKE '%42310%' OR v.phone LIKE '%98765%'
        ORDER BY v.created_at DESC 
        LIMIT 20
      `);
      
      if (vendorResult.rows.length > 0) {
        console.log(`Found ${vendorResult.rows.length} vendor(s) with similar phone numbers:`);
        vendorResult.rows.forEach(v => {
          console.log(`  - ${v.business_name || v.owner_name} | Phone: ${v.phone} | Status: ${v.status} | Active: ${v.is_active} | Role: ${v.role_name}`);
        });
      }
      process.exit(1);
    }
    
    const vendor = vendorResult.rows[0];
    console.log(`\n✅ Found vendor: ${vendor.business_name || vendor.owner_name}`);
    console.log(`   ID: ${vendor.id}`);
    console.log(`   Phone: ${vendor.phone}`);
    console.log(`   Status: ${vendor.status}`);
    console.log(`   Is Active: ${vendor.is_active}`);
    console.log(`   Vendor Type: ${vendor.vendor_type}`);
    console.log(`   Role: ${vendor.role_name} (${vendor.role_display_name})`);
    console.log(`   Role ID: ${vendor.role_id}`);
    
    // Check if vendor meets criteria for tele services
    console.log('\n=== Checking eligibility for tele services ===');
    
    const eligibilityChecks = {
      statusApproved: vendor.status === 'approved' || vendor.status === 'active',
      isActive: vendor.is_active === true,
      hasRole: vendor.role_id !== null
    };
    
    console.log(`   Status approved/active: ${eligibilityChecks.statusApproved}`);
    console.log(`   Is active: ${eligibilityChecks.isActive}`);
    console.log(`   Has role: ${eligibilityChecks.hasRole}`);
    
    // Check services
    console.log('\n=== Checking services ===');
    const servicesResult = await query(`
      SELECT 
        vs.id, 
        vs.vendor_id, 
        vs.service_name, 
        vs.service_style, 
        vs.is_enabled, 
        vs.publish_status,
        vs.category,
        vs.price
      FROM vendor_services vs
      WHERE vs.vendor_id = $1
      ORDER BY vs.created_at DESC
    `, [vendor.id]);
    
    console.log(`   Total services: ${servicesResult.rows.length}`);
    
    if (servicesResult.rows.length === 0) {
      console.log('   ❌ NO SERVICES FOUND - This is why vendor is not appearing!');
    } else {
      servicesResult.rows.forEach(s => {
        console.log(`   - ${s.service_name} | Style: ${s.service_style} | Enabled: ${s.is_enabled} | Publish: ${s.publish_status} | Category: ${s.category}`);
      });
      
      // Check tele services specifically
      const teleServices = servicesResult.rows.filter(s => 
        (s.service_style === 'tele' || s.service_style === 'online') && 
        s.is_enabled === true &&
        (s.publish_status === 'published' || s.publish_status === 'auto_published' || s.publish_status === null || s.publish_status === 'draft')
      );
      
      console.log(`\n   Tele services (enabled & published): ${teleServices.length}`);
      if (teleServices.length === 0) {
        console.log('   ❌ NO ENABLED TELE SERVICES - This is why vendor is not appearing!');
      } else {
        teleServices.forEach(s => {
          console.log(`   ✅ ${s.service_name} | Price: ${s.price}`);
        });
      }
    }
    
    // Check role matching
    console.log('\n=== Checking role matching ===');
    const targetRoles = ['veterinarian', 'vet', 'vet_clinic', 'vet_solo', 'Veterinarian (Solo)', 'Vet Solo', 'Veterinary Clinic'];
    const roleMatches = targetRoles.some(role => 
      vendor.role_name?.toLowerCase() === role.toLowerCase() ||
      vendor.role_display_name?.toLowerCase() === role.toLowerCase()
    );
    
    console.log(`   Vendor role: ${vendor.role_name} (${vendor.role_display_name})`);
    console.log(`   Matches target roles: ${roleMatches}`);
    
    if (!roleMatches) {
      console.log('   ❌ ROLE DOES NOT MATCH - This might prevent vendor from appearing!');
      console.log(`   Target roles: ${targetRoles.join(', ')}`);
    }
    
    // Summary
    console.log('\n=== SUMMARY ===');
    const allChecksPass = 
      eligibilityChecks.statusApproved &&
      eligibilityChecks.isActive &&
      eligibilityChecks.hasRole &&
      servicesResult.rows.length > 0 &&
      teleServices.length > 0 &&
      roleMatches;
    
    if (allChecksPass) {
      console.log('✅ All checks passed - Vendor SHOULD appear in results');
      console.log('   If vendor is still not appearing, check CloudWatch logs for query execution');
    } else {
      console.log('❌ Some checks failed - Vendor will NOT appear in results');
      console.log('\nIssues to fix:');
      if (!eligibilityChecks.statusApproved) console.log('  - Vendor status is not approved/active');
      if (!eligibilityChecks.isActive) console.log('  - Vendor is not active');
      if (!eligibilityChecks.hasRole) console.log('  - Vendor has no role');
      if (servicesResult.rows.length === 0) console.log('  - Vendor has no services');
      if (teleServices.length === 0) console.log('  - Vendor has no enabled tele services');
      if (!roleMatches) console.log('  - Vendor role does not match target roles');
    }
    
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
})();
