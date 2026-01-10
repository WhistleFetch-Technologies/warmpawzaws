/**
 * Master Amenities Configuration
 * Returns available amenities based on vendor type/role
 */

export interface Amenity {
  id: string;
  name: string;
  category: string;
  icon?: string;
  description?: string;
}

/**
 * Get amenities available for a specific vendor type/role
 */
export function getAmenitiesForVendorType(roleId?: string): Amenity[] {
  // Default amenities that can be customized based on role
  const defaultAmenities: Amenity[] = [
    { id: 'parking', name: 'Parking', category: 'facilities' },
    { id: 'wifi', name: 'WiFi', category: 'facilities' },
    { id: 'ac', name: 'Air Conditioning', category: 'facilities' },
    { id: 'camera', name: 'Security Camera', category: 'security' },
    { id: 'play_area', name: 'Play Area', category: 'facilities' },
    { id: 'grooming', name: 'Grooming Station', category: 'services' },
    { id: 'medical', name: 'Medical Equipment', category: 'services' },
  ];

  // Role-specific amenities can be added here
  // For now, return default amenities for all roles
  return defaultAmenities;
}
