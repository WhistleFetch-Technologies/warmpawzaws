/**
 * 🚚 DELIVERY PARTNER AUTO-ASSIGNMENT UTILITIES
 * 
 * Utility functions for automatically assigning delivery partners to orders
 * when they are ready to ship (status changed to "shipped")
 */

import * as kv from './kv_store.tsx';

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Find available delivery partners near a pickup location
 */
export async function findAvailableDeliveryPartners(
  pickupLat: number,
  pickupLng: number,
  maxDistance: number = 5 // km
): Promise<Array<{
  id: string;
  name: string;
  phone: string;
  distance: number;
  rating?: number;
  currentLocation?: { lat: number; lng: number };
}>> {
  try {
    // Try multiple sources for delivery partners
    
    // 1. Check dedicated delivery partners (from delivery-integration-endpoints)
    const deliveryPartners = await kv.getByPrefix('delivery:partner:') || [];
    
    // 2. Check staff with delivery_partner role (from hyperlocal-delivery-endpoints)
    const allStaff = await kv.getByPrefix('staff:') || [];
    
    // 3. Check available_delivery_partners list (from nutritionist-food-delivery)
    const availablePartnersList = await kv.get('available_delivery_partners') || [];
    
    const availablePartners: any[] = [];
    
    // Process dedicated delivery partners
    for (const item of deliveryPartners) {
      const partner = item.value || item;
      if (partner.status === 'available' && partner.isActive && partner.currentLocation) {
        const distance = calculateDistance(
          pickupLat,
          pickupLng,
          partner.currentLocation.lat,
          partner.currentLocation.lng
        );
        
        if (distance <= maxDistance) {
          availablePartners.push({
            id: partner.partnerId || partner.id,
            name: partner.name || partner.fullName || 'Delivery Partner',
            phone: partner.phone || partner.contactNumber || '',
            distance: Math.round(distance * 10) / 10,
            rating: partner.rating || 0,
            currentLocation: partner.currentLocation
          });
        }
      }
    }
    
    // Process staff with delivery_partner role
    for (const item of allStaff) {
      const staff = item.value || item;
      
      // Check if staff is delivery partner
      if (!staff.roles || !Array.isArray(staff.roles) || !staff.roles.includes('delivery_partner')) {
        continue;
      }
      
      if (!staff.isActive || staff.availability !== 'available') {
        continue;
      }
      
      // Check location if available
      if (staff.currentLocation && staff.currentLocation.lat && staff.currentLocation.lng) {
        const distance = calculateDistance(
          pickupLat,
          pickupLng,
          staff.currentLocation.lat,
          staff.currentLocation.lng
        );
        
        if (distance <= maxDistance) {
          // Check if already added (avoid duplicates)
          if (!availablePartners.find(p => p.id === staff.id)) {
            availablePartners.push({
              id: staff.id,
              name: staff.fullName || staff.name || 'Delivery Partner',
              phone: staff.phone || '',
              distance: Math.round(distance * 10) / 10,
              rating: staff.rating || 0,
              currentLocation: staff.currentLocation
            });
          }
        }
      }
    }
    
    // Process available_delivery_partners list
    if (Array.isArray(availablePartnersList)) {
      for (const partner of availablePartnersList) {
        if (partner.status === 'available' && partner.currentLocation) {
          const distance = calculateDistance(
            pickupLat,
            pickupLng,
            partner.currentLocation.lat || 0,
            partner.currentLocation.lng || 0
          );
          
          if (distance <= maxDistance) {
            // Check if already added
            if (!availablePartners.find(p => p.id === partner.partnerId || p.id === partner.id)) {
              availablePartners.push({
                id: partner.partnerId || partner.id,
                name: partner.name || 'Delivery Partner',
                phone: partner.phone || '',
                distance: Math.round(distance * 10) / 10,
                rating: partner.rating || 0,
                currentLocation: partner.currentLocation
              });
            }
          }
        }
      }
    }
    
    // Sort by distance and rating (closer and higher rated first)
    availablePartners.sort((a, b) => {
      const scoreA = (1 / (a.distance + 0.1)) * (a.rating || 1);
      const scoreB = (1 / (b.distance + 0.1)) * (b.rating || 1);
      return scoreB - scoreA;
    });
    
    return availablePartners;
  } catch (error) {
    console.error('❌ [DELIVERY-ASSIGN] Error finding delivery partners:', error);
    return [];
  }
}

/**
 * Auto-assign delivery partner to an order
 * 
 * @param orderId - The order ID
 * @param orderType - Type of order ('medicine_order', 'product_order', 'reorder', etc.)
 * @param pickupLocation - Pickup location with lat/lng
 * @param dropLocation - Delivery location with lat/lng (optional)
 * @returns Assigned partner info or null if none available
 */
export async function autoAssignDeliveryPartner(
  orderId: string,
  orderType: string,
  pickupLocation: { lat: number; lng: number; address?: string },
  dropLocation?: { lat: number; lng: number; address?: string }
): Promise<{
  partnerId: string;
  partnerName: string;
  partnerPhone: string;
  distance: number;
} | null> {
  try {
    console.log(`🚚 [DELIVERY-ASSIGN] Auto-assigning partner for order ${orderId} (${orderType})`);
    
    // Find available partners near pickup location
    const availablePartners = await findAvailableDeliveryPartners(
      pickupLocation.lat,
      pickupLocation.lng,
      5 // 5km radius
    );
    
    if (availablePartners.length === 0) {
      console.log(`⚠️ [DELIVERY-ASSIGN] No delivery partners available for order ${orderId}`);
      return null;
    }
    
    // Select best partner (first one after sorting)
    const selectedPartner = availablePartners[0];
    
    console.log(`✅ [DELIVERY-ASSIGN] Selected partner ${selectedPartner.id} (${selectedPartner.name}) for order ${orderId}`);
    
    // Update partner status to busy (if using dedicated delivery partners system)
    try {
      const partnerKey = `delivery:partner:${selectedPartner.id}`;
      const partner = await kv.get(partnerKey);
      if (partner) {
        partner.status = 'busy';
        partner.currentOrderId = orderId;
        await kv.set(partnerKey, partner);
      }
    } catch (partnerUpdateError) {
      // Non-critical: continue even if partner status update fails
      console.warn('⚠️ Could not update partner status:', partnerUpdateError);
    }
    
    return {
      partnerId: selectedPartner.id,
      partnerName: selectedPartner.name,
      partnerPhone: selectedPartner.phone,
      distance: selectedPartner.distance
    };
  } catch (error) {
    console.error(`❌ [DELIVERY-ASSIGN] Error auto-assigning partner for order ${orderId}:`, error);
    return null;
  }
}

/**
 * Extract pickup location from order data
 * Helper function to get pickup location from various order types
 */
export function extractPickupLocation(order: any): { lat: number; lng: number; address?: string } | null {
  // Try various possible fields for pickup location
  if (order.pickupLocation) {
    return {
      lat: order.pickupLocation.lat || order.pickupLocation.latitude,
      lng: order.pickupLocation.lng || order.pickupLocation.longitude,
      address: order.pickupLocation.address
    };
  }
  
  if (order.vendorId) {
    // Try to get vendor location
    // Note: This would require fetching vendor, but we return null to avoid async here
    // The caller should handle vendor location lookup if needed
  }
  
  // For medicine orders, pickup is usually at pharmacy/vendor location
  // For product orders, pickup is at warehouse/vendor location
  // We'll need vendor location from vendor data
  
  return null;
}

/**
 * Extract delivery location from order data
 */
export function extractDeliveryLocation(order: any): { lat: number; lng: number; address?: string } | null {
  if (order.deliveryAddress) {
    const addr = order.deliveryAddress;
    if (addr.lat && addr.lng) {
      return {
        lat: addr.lat,
        lng: addr.lng,
        address: addr.address || addr.street || addr.fullAddress
      };
    }
  }
  
  if (order.dropoffLocation) {
    return {
      lat: order.dropoffLocation.lat || order.dropoffLocation.latitude,
      lng: order.dropoffLocation.lng || order.dropoffLocation.longitude,
      address: order.dropoffLocation.address
    };
  }
  
  return null;
}

