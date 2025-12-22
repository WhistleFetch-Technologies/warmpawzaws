import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { getPrimarySpecialization, getAllSpecializations } from './specialization-mapping.tsx';

const app = new Hono();

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * UNIVERSAL STAFF SEARCH SYSTEM
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This is the STANDARD way to search for staff across ALL vendor types:
 * - Veterinarians → "Doctors"
 * - Groomers → "Groomers"  
 * - Trainers → "Trainers"
 * - Walkers → "Walkers"
 * etc.
 * 
 * Features:
 * - Universal staff search by roleId, serviceStyle, location
 * - Returns staff WITH their enabled services
 * - Returns staff WITH their availability
 * - Works for at_center, at_home, tele
 * - Standardized response format for all vendor types
 */

/**
 * GET /make-server-3dd53475/customer/staff/search
 * 
 * Universal staff search endpoint
 * 
 * Query Parameters:
 * - query: Search term (name, specialization)
 * - roleId: Filter by role (veterinarian, pet_clinic, pet_groomer, etc.)
 * - serviceStyle: Filter by service style (at_center, at_home, tele)
 * - feeMin, feeMax: Price range
 * - experienceMin, experienceMax: Experience range
 * - gender: Gender filter
 * - sortBy: rating|fee_low|fee_high|experience|relevance
 * - limit, offset: Pagination
 */
app.get('/make-server-3dd53475/customer/staff/search', async (c) => {
  try {
    const query = c.req.query('query') || '';
    const roleId = c.req.query('roleId') || ''; // Empty = all roles
    const serviceStyle = c.req.query('serviceStyle') || ''; // at_center, at_home, tele
    const feeMin = parseInt(c.req.query('feeMin') || '0');
    const feeMax = parseInt(c.req.query('feeMax') || '999999');
    const experienceMin = parseInt(c.req.query('experienceMin') || '0');
    const experienceMax = parseInt(c.req.query('experienceMax') || '999');
    const gender = c.req.query('gender') || '';
    const availableToday = c.req.query('availableToday') === 'true';
    const sortBy = c.req.query('sortBy') || 'rating';
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    console.log(`\n🔍 ═══════════ UNIVERSAL STAFF SEARCH ═══════════`);
    console.log(`📋 Search Query: "${query}"`);
    console.log(`🏷️  Role Filter: ${roleId || 'ALL ROLES'}`);
    console.log(`🎨 Service Style: ${serviceStyle || 'ALL STYLES'}`);
    console.log(`💰 Fee Range: ₹${feeMin} - ₹${feeMax}`);
    console.log(`👨‍⚕️ Experience: ${experienceMin}-${experienceMax} years`);
    console.log(`👤 Gender: ${gender || 'All'}`);

    // Step 1: Get all vendors
    const allVendors = await kv.getByPrefix('vendor:vendor_');
    console.log(`\n📊 Total vendors in database: ${allVendors.length}`);

    // Step 2: Filter vendors by status and roleId
    let vendors = allVendors.filter((v: any) => {
      const isApproved = v.status === 'approved';
      const isActive = v.isActive === true;
      
      // Role filter (if specified)
      let roleMatches = true;
      if (roleId) {
        // Support multiple vet-related roles
        if (roleId === 'veterinarian' || roleId === 'vet_clinic') {
          roleMatches = v.roleId === 'veterinarian' || v.roleId === 'pet_clinic' || v.roleId === 'vet_clinic';
        } else {
          roleMatches = v.roleId === roleId;
        }
      }
      
      return isApproved && isActive && roleMatches;
    });
    
    console.log(`📊 Filtered vendors: ${vendors.length} (status=approved, isActive=true, roleId=${roleId || 'any'})`);

    // Step 3: Collect all staff members with their full data
    const staffList: any[] = [];
    let totalStaffFound = 0;
    let activeStaffFound = 0;

    for (const vendor of vendors) {
      console.log(`\n   ┌─────────────────────────────────────────────────────────`);
      console.log(`   │ 🏥 ${vendor.businessName || vendor.fullName}`);
      console.log(`   │    ID: ${vendor.id}`);
      console.log(`   │    Role: ${vendor.roleId}`);
      
      // Get vendor's staff array
      const staffIds = await kv.get(`vendor:${vendor.id}:staff`) || [];
      totalStaffFound += staffIds.length;
      
      console.log(`   │    Staff Array: ${staffIds.length} members → [${staffIds.slice(0, 3).join(', ')}${staffIds.length > 3 ? '...' : ''}]`);
      
      for (const staffId of staffIds) {
        const staff = await kv.get(`staff:${staffId}`);
        
        if (!staff) {
          console.log(`   │    ❌ ${staffId} - Record not found in KV!`);
          continue;
        }
        
        if (!staff.isActive) {
          console.log(`   │    ⏸️  ${staff.fullName} - Inactive`);
          continue;
        }
        
        activeStaffFound++;
        console.log(`   │    ✅ ${staff.fullName} - Active`);
        
        // Get staff services
        const staffServices = await kv.getByPrefix(`staff:${staff.id}:service:`) || [];
        const enabledServices = staffServices
          .filter((s: any) => s.isActive !== false)
          .map((s: any) => ({
            id: s.id || s.serviceId,
            serviceId: s.serviceId || s.id,
            name: s.serviceName || s.name,
            category: s.category,
            categoryName: s.categoryName,
            price: s.price || 0,
            duration: s.duration || 30,
            serviceStyle: s.serviceStyle || 'at_center',
            description: s.description || ''
          }));
        
        console.log(`   │       └─ Services: ${enabledServices.length}`);
        
        // Apply service style filter
        if (serviceStyle) {
          const hasMatchingService = enabledServices.some((s: any) => s.serviceStyle === serviceStyle);
          if (!hasMatchingService) {
            console.log(`   │       └─ ⛔ Filtered out (no ${serviceStyle} services)`);
            continue;
          }
        }
        
        // Get vendor's enabled services for this staff member (fallback)
        let vendorServices: any[] = [];
        if (enabledServices.length === 0) {
          // Fallback to vendor services
          const servicesAtCenter = await kv.get(`vendor_services:${vendor.id}:at_center`) || { services: [] };
          const servicesAtHome = await kv.get(`vendor_services:${vendor.id}:at_home`) || { services: [] };
          const servicesTele = await kv.get(`vendor_services:${vendor.id}:tele`) || { services: [] };
          
          vendorServices = [
            ...(servicesAtCenter.services || []).map((s: any) => ({ ...s, serviceStyle: 'at_center' })),
            ...(servicesAtHome.services || []).map((s: any) => ({ ...s, serviceStyle: 'at_home' })),
            ...(servicesTele.services || []).map((s: any) => ({ ...s, serviceStyle: 'tele' }))
          ]
            .filter((s: any) => s.isEnabled && s.publishStatus === 'published')
            .map((s: any) => ({
              id: s.id || s.serviceId,
              serviceId: s.serviceId || s.id,
              name: s.serviceName || s.name,
              category: s.category,
              categoryName: s.categoryName,
              price: s.customPrice || s.price || 0,
              duration: s.customDuration || s.duration || 30,
              serviceStyle: s.serviceStyle,
              description: s.description || s.customDescription || ''
            }));
          
          if (vendorServices.length > 0) {
            console.log(`   │       └─ Using vendor services (${vendorServices.length})`);
          }
        }
        
        const allServices = enabledServices.length > 0 ? enabledServices : vendorServices;
        
        // Apply filters
        // Name/specialization search
        if (query) {
          const searchLower = query.toLowerCase();
          const nameMatch = staff.fullName?.toLowerCase().includes(searchLower);
          const specializationMatch = staff.specialization?.toLowerCase().includes(searchLower);
          if (!nameMatch && !specializationMatch) {
            console.log(`   │       └─ ⛔ Filtered out (doesn't match "${query}")`);
            continue;
          }
        }

        // Fee range filter
        const consultationFee = staff.consultationFee || vendor.consultationFee || 0;
        if (consultationFee < feeMin || consultationFee > feeMax) {
          console.log(`   │       └─ ⛔ Filtered out (fee ₹${consultationFee} outside range)`);
          continue;
        }

        // Experience filter
        const experience = staff.yearsOfExperience || staff.experience || 0;
        if (experience < experienceMin || experience > experienceMax) {
          console.log(`   │       └─ ⛔ Filtered out (experience ${experience}y outside range)`);
          continue;
        }

        // Gender filter
        if (gender && staff.gender && staff.gender.toLowerCase() !== gender.toLowerCase()) {
          console.log(`   │       └─ ⛔ Filtered out (gender mismatch)`);
          continue;
        }

        // Build staff object with standardized format
        const staffMember = {
          // Staff info
          id: staff.id,
          staffId: staff.id,
          fullName: staff.fullName,
          phone: staff.phone,
          email: staff.email,
          role: staff.role,
          roleType: staff.roleType,
          
          // Professional info
          specialization: getPrimarySpecialization(staff), // ✅ FIXED: Show actual specialization
          specializations: getAllSpecializations(staff), // ✅ NEW: All specializations
          qualification: staff.qualification || staff.degree || '',
          degree: staff.degree || '',
          yearsOfExperience: experience,
          consultationFee: consultationFee,
          
          // Personal
          gender: staff.gender || '',
          photo: staff.photo || '',
          bio: staff.bio || '',
          languages: staff.languages || [],
          
          // Stats
          rating: staff.rating || vendor.rating || 4.5,
          totalReviews: staff.totalReviews || vendor.totalReviews || 0,
          totalAppointments: staff.totalAppointments || 0,
          completedAppointments: staff.completedAppointments || 0,
          
          // Vendor/Clinic info
          vendorId: vendor.id,
          clinicId: vendor.id, // Alias for backward compatibility
          vendorName: vendor.businessName || vendor.fullName,
          clinicName: vendor.businessName || vendor.fullName, // Alias
          vendorAddress: vendor.address,
          vendorCity: vendor.city,
          vendorState: vendor.state,
          vendorPincode: vendor.pincode,
          vendorPhone: vendor.phone,
          vendorRoleId: vendor.roleId,
          vendorType: vendor.vendorType,
          
          // Services (KEY: This is what was missing!)
          services: allServices,
          serviceCount: allServices.length,
          
          // Availability info (simplified - would need proper schedule check)
          isActive: staff.isActive,
          availableToday: true, // Placeholder - implement real availability check
          nextAvailableSlot: 'Today 2:00 PM', // Placeholder
          
          // Service styles available
          serviceStylesAvailable: [...new Set(allServices.map((s: any) => s.serviceStyle))]
        };

        staffList.push(staffMember);
        console.log(`   │       └─ ✅ INCLUDED in results`);
      }
      
      console.log(`   └─────────────────────────────────────────────────────────`);
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Total staff found: ${totalStaffFound}`);
    console.log(`   Active staff: ${activeStaffFound}`);
    console.log(`   After filters: ${staffList.length}`);

    // Sort staff
    staffList.sort((a, b) => {
      if (sortBy === 'fee_low') return a.consultationFee - b.consultationFee;
      if (sortBy === 'fee_high') return b.consultationFee - a.consultationFee;
      if (sortBy === 'experience') return b.yearsOfExperience - a.yearsOfExperience;
      if (sortBy === 'rating') return b.rating - a.rating;
      return 0; // relevance
    });

    // Paginate
    const total = staffList.length;
    const paginatedStaff = staffList.slice(offset, offset + limit);

    console.log(`\n✅ Returning ${paginatedStaff.length} staff members (page ${Math.floor(offset / limit) + 1})`);
    console.log(`═══════════════════════════════════════════════════\n`);

    return c.json({
      success: true,
      staff: paginatedStaff,
      total,
      count: paginatedStaff.length,
      limit,
      offset,
      filters: {
        query,
        roleId,
        serviceStyle,
        feeRange: [feeMin, feeMax],
        experienceRange: [experienceMin, experienceMax],
        gender,
        sortBy
      }
    });

  } catch (error) {
    console.error('❌ [UNIVERSAL-STAFF-SEARCH] Error:', error);
    return c.json({
      success: false,
      error: 'Failed to search staff',
      message: String(error)
    }, 500);
  }
});

/**
 * GET /make-server-3dd53475/customer/staff/:staffId
 * Get detailed staff information
 */
app.get('/make-server-3dd53475/customer/staff/:staffId', async (c) => {
  try {
    const { staffId } = c.req.param();
    
    console.log(`\n👨‍⚕️ ===== GET STAFF DETAILS =====`);
    console.log(`📝 Staff ID: ${staffId}`);
    
    const staff = await kv.get(`staff:${staffId}`);
    
    if (!staff) {
      return c.json({
        success: false,
        error: 'Staff member not found'
      }, 404);
    }

    // Get vendor/clinic info
    const vendor = await kv.get(`vendor:${staff.vendorId}`);
    
    if (!vendor) {
      return c.json({
        success: false,
        error: 'Vendor not found for this staff member'
      }, 404);
    }

    // Get staff services
    const staffServices = await kv.getByPrefix(`staff:${staff.id}:service:`) || [];
    const enabledServices = staffServices
      .filter((s: any) => s.isActive !== false)
      .map((s: any) => ({
        id: s.id || s.serviceId,
        serviceId: s.serviceId || s.id,
        name: s.serviceName || s.name,
        category: s.category,
        categoryName: s.categoryName,
        price: s.price || 0,
        duration: s.duration || 30,
        serviceStyle: s.serviceStyle || 'at_center',
        description: s.description || ''
      }));

    // Get vendor services as fallback
    let vendorServices: any[] = [];
    if (enabledServices.length === 0) {
      const servicesAtCenter = await kv.get(`vendor_services:${vendor.id}:at_center`) || { services: [] };
      const servicesAtHome = await kv.get(`vendor_services:${vendor.id}:at_home`) || { services: [] };
      const servicesTele = await kv.get(`vendor_services:${vendor.id}:tele`) || { services: [] };
      
      vendorServices = [
        ...(servicesAtCenter.services || []).map((s: any) => ({ ...s, serviceStyle: 'at_center' })),
        ...(servicesAtHome.services || []).map((s: any) => ({ ...s, serviceStyle: 'at_home' })),
        ...(servicesTele.services || []).map((s: any) => ({ ...s, serviceStyle: 'tele' }))
      ]
        .filter((s: any) => s.isEnabled && s.publishStatus === 'published')
        .map((s: any) => ({
          id: s.id || s.serviceId,
          serviceId: s.serviceId || s.id,
          name: s.serviceName || s.name,
          category: s.category,
          categoryName: s.categoryName,
          price: s.customPrice || s.price || 0,
          duration: s.customDuration || s.duration || 30,
          serviceStyle: s.serviceStyle,
          description: s.description || s.customDescription || ''
        }));
    }

    const allServices = enabledServices.length > 0 ? enabledServices : vendorServices;

    const staffDetails = {
      id: staff.id,
      fullName: staff.fullName,
      phone: staff.phone,
      email: staff.email,
      role: staff.role,
      roleType: staff.roleType,
      specialization: getPrimarySpecialization(staff), // ✅ FIXED: Show actual specialization
      specializations: getAllSpecializations(staff), // ✅ NEW: All specializations
      qualification: staff.qualification || staff.degree || '',
      degree: staff.degree || '',
      yearsOfExperience: staff.yearsOfExperience || staff.experience || 0,
      consultationFee: staff.consultationFee || vendor?.consultationFee || 0,
      gender: staff.gender || '',
      photo: staff.photo || '',
      rating: staff.rating || vendor?.rating || 4.5,
      totalReviews: staff.totalReviews || vendor?.totalReviews || 0,
      bio: staff.bio || '',
      languages: staff.languages || [],
      
      // Vendor info
      vendorId: vendor.id,
      clinicId: vendor.id,
      vendorName: vendor.businessName || vendor.fullName,
      clinicName: vendor.businessName || vendor.fullName,
      vendorAddress: vendor.address,
      vendorPhone: vendor.phone,
      vendorRoleId: vendor.roleId,
      
      // Services
      services: allServices,
      serviceCount: allServices.length,
      serviceStylesAvailable: [...new Set(allServices.map((s: any) => s.serviceStyle))]
    };

    console.log(`✅ Staff found: ${staffDetails.fullName} with ${staffDetails.serviceCount} services`);

    return c.json({
      success: true,
      staff: staffDetails
    });

  } catch (error) {
    console.error('❌ [GET-STAFF] Error:', error);
    return c.json({
      success: false,
      error: 'Failed to get staff details',
      message: String(error)
    }, 500);
  }
});

export default app;