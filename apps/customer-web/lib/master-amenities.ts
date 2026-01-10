/**
 * Master Amenities - Centralized amenity definitions
 */

export interface Amenity {
  id: string;
  name: string;
  icon?: string;
  category?: string;
}

export const MASTER_AMENITIES: Record<string, Amenity> = {
  'wifi': { id: 'wifi', name: 'Wi-Fi', icon: '📶', category: 'tech' },
  'parking': { id: 'parking', name: 'Parking', icon: '🚗', category: 'facility' },
  'ac': { id: 'ac', name: 'Air Conditioning', icon: '❄️', category: 'comfort' },
  'pet_friendly': { id: 'pet_friendly', name: 'Pet Friendly', icon: '🐾', category: 'general' },
  'cctv': { id: 'cctv', name: 'CCTV Security', icon: '📹', category: 'security' },
  'emergency': { id: 'emergency', name: '24/7 Emergency', icon: '🚨', category: 'service' },
  'consultation_room': { id: 'consultation_room', name: 'Consultation Room', icon: '🏥', category: 'facility' },
  'surgery': { id: 'surgery', name: 'Surgery Room', icon: '⚕️', category: 'facility' },
  'pharmacy': { id: 'pharmacy', name: 'In-house Pharmacy', icon: '💊', category: 'service' },
  'grooming_station': { id: 'grooming_station', name: 'Grooming Station', icon: '✂️', category: 'facility' },
  'training_area': { id: 'training_area', name: 'Training Area', icon: '🎓', category: 'facility' },
  'boarding': { id: 'boarding', name: 'Boarding Facility', icon: '🏠', category: 'facility' },
};

export function getAmenityById(id: string): Amenity | null {
  return MASTER_AMENITIES[id] || null;
}

export function getAllAmenities(): Amenity[] {
  return Object.values(MASTER_AMENITIES);
}

export function getAmenitiesByCategory(category: string): Amenity[] {
  return Object.values(MASTER_AMENITIES).filter(a => a.category === category);
}

