/**
 * Browser Console Script to Create Services
 * 
 * Copy and paste this entire script into the browser console on the Admin UI
 * This will create all services via API calls
 */

(async function createAllServices() {
  const servicesData = {
    "services": [
      {
        "service_id": "vet_general_checkup",
        "service_name": "General Health Checkup",
        "display_name": "Complete Physical Examination",
        "description": "Comprehensive health checkup for your pet including vital signs, physical examination, and health assessment",
        "category_id": "veterinary",
        "category_name": "Veterinary Services",
        "applicable_roles": ["veterinarian", "vet_clinic"],
        "service_style": "at_center",
        "base_price": 500.00,
        "duration_minutes": 30,
        "display_order": 1
      },
      {
        "service_id": "vet_vaccination",
        "service_name": "Vaccination",
        "display_name": "Core and Non-Core Vaccinations",
        "description": "Essential vaccinations to protect your pet from common diseases",
        "category_id": "veterinary",
        "category_name": "Veterinary Services",
        "applicable_roles": ["veterinarian", "vet_clinic"],
        "service_style": "at_center",
        "base_price": 800.00,
        "duration_minutes": 20,
        "display_order": 2
      },
      {
        "service_id": "groom_bath",
        "service_name": "Bath & Dry",
        "display_name": "Full Bath and Blow Dry",
        "description": "Complete bathing and drying service with premium pet shampoo",
        "category_id": "grooming",
        "category_name": "Grooming & Hygiene",
        "applicable_roles": ["pet_groomer", "pet_spa"],
        "service_style": "at_center",
        "base_price": 600.00,
        "duration_minutes": 45,
        "display_order": 19
      },
      {
        "service_id": "walk_30min",
        "service_name": "30 Min Walk",
        "display_name": "Short Neighborhood Walk",
        "description": "30 minute walking session for daily exercise",
        "category_id": "walking",
        "category_name": "Walking & Exercise",
        "applicable_roles": ["pet_walker"],
        "service_style": "at_home",
        "base_price": 200.00,
        "duration_minutes": 30,
        "display_order": 34
      },
      {
        "service_id": "vet_tele_consult",
        "service_name": "Tele-Consultation",
        "display_name": "Online Video Consultation",
        "description": "Connect with veterinarian via video call for quick consultations and follow-ups",
        "category_id": "veterinary",
        "category_name": "Veterinary Services",
        "applicable_roles": ["veterinarian", "vet_clinic"],
        "service_style": "tele",
        "base_price": 300.00,
        "duration_minutes": 20,
        "display_order": 8
      },
      {
        "service_id": "pharmacy_delivery",
        "service_name": "Medicine Delivery",
        "display_name": "Home Delivery Service",
        "description": "Deliver medicines to your home for convenience",
        "category_id": "pharmacy",
        "category_name": "Pharmacy & Medication",
        "applicable_roles": ["pharmacy"],
        "service_style": "delivery",
        "base_price": 100.00,
        "duration_minutes": 30,
        "display_order": 50
      }
    ]
  };

  const API_BASE = window.__WARMPAWZ_RUNTIME_CONFIG__?.apiBaseUrl || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
  
  console.log('🚀 Starting service creation via API...');
  console.log(`API Base: ${API_BASE}`);
  
  let successCount = 0;
  let failCount = 0;
  const errors = [];

  for (const service of servicesData.services) {
    try {
      const payload = {
        service_id: service.service_id,
        service_name: service.service_name,
        display_name: service.display_name || service.service_name,
        description: service.description || '',
        category_id: service.category_id,
        category_name: service.category_name,
        applicable_roles: service.applicable_roles,
        service_style: service.service_style,
        base_price: service.base_price,
        duration_minutes: service.duration_minutes,
        status: 'active',
        publish_status: 'published',
        display_order: service.display_order || 0
      };

      const response = await fetch(`${API_BASE}/admin/service-catalog`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok) {
        console.log(`✅ Created: ${service.service_name} (${service.service_id})`);
        successCount++;
      } else {
        console.error(`❌ Failed: ${service.service_name} - ${result.error || 'Unknown error'}`);
        failCount++;
        errors.push({ service: service.service_id, error: result.error });
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`❌ Error creating ${service.service_name}:`, error);
      failCount++;
      errors.push({ service: service.service_id, error: error.message });
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Successfully created: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  
  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(err => {
      console.log(`  - ${err.service}: ${err.error}`);
    });
  }
  
  console.log('\n✨ Done! Refresh the page to see created services.');
  
  return { successCount, failCount, errors };
})();
