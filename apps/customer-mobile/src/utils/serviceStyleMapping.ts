/**
 * Service Style Mapping Utility
 * Maps between backend service style formats and frontend formats
 */

export type BackendServiceStyle = 'at_center' | 'at_clinic' | 'at_home' | 'home_visit' | 'tele' | 'video_consultation' | 'online' | 'delivery' | 'pickup' | 'outdoor';
export type FrontendServiceStyle = 'center' | 'home' | 'tele';

/**
 * Map backend service style to frontend format
 */
export function mapBackendToFrontendStyle(backendStyle: string | undefined | null): FrontendServiceStyle {
  if (!backendStyle) return 'center'; // Default
  
  const normalized = backendStyle.toLowerCase().trim();
  
  // Map to frontend style
  if (normalized === 'at_center' || normalized === 'at_clinic') {
    return 'center';
  }
  
  if (normalized === 'at_home' || normalized === 'home_visit') {
    return 'home';
  }
  
  if (normalized === 'tele' || normalized === 'video_consultation' || normalized === 'online') {
    return 'tele';
  }
  
  // For delivery/pickup/outdoor, default to center for booking purposes
  return 'center';
}

/**
 * Map frontend service style to backend format
 */
export function mapFrontendToBackendStyle(frontendStyle: FrontendServiceStyle): BackendServiceStyle {
  switch (frontendStyle) {
    case 'center':
      return 'at_center';
    case 'home':
      return 'at_home';
    case 'tele':
      return 'tele';
    default:
      return 'at_center';
  }
}

/**
 * Extract service style from service object
 */
export function getServiceStyleFromService(service: any): FrontendServiceStyle {
  if (!service) return 'center';
  
  // Check serviceStyle field first
  if (service.serviceStyle) {
    return mapBackendToFrontendStyle(service.serviceStyle);
  }
  
  // Check serviceType field (some APIs use this)
  if (service.serviceType) {
    return mapBackendToFrontendStyle(service.serviceType);
  }
  
  // Try to derive from name/description
  const text = `${service.name || ''} ${service.serviceName || ''} ${service.description || ''}`.toLowerCase();
  
  if (text.includes('home') || text.includes('visit')) {
    return 'home';
  }
  
  if (text.includes('tele') || text.includes('video') || text.includes('online') || text.includes('call') || text.includes('consultation')) {
    return 'tele';
  }
  
  // Default to center
  return 'center';
}

/**
 * Get default service style for a role
 */
export function getDefaultServiceStyleForRole(roleId: string): FrontendServiceStyle {
  const roleDefaults: Record<string, FrontendServiceStyle> = {
    // Healthcare providers - default to tele for convenience
    'veterinarian': 'tele',
    'pet_clinic': 'center',
    'veterinary_clinic': 'center',
    
    // Service providers - default to center
    'pet_groomer': 'center',
    'pet_trainer': 'center',
    'pet_walker': 'home',
    'pet_sitter': 'home',
    'pet_behaviorist': 'center',
    
    // Boarding - always center
    'pet_boarding': 'center',
    'pet_resort': 'center',
    
    // Retail - center (pickup/delivery handled separately)
    'pet_pharmacy': 'center',
    'pet_products_store': 'center',
    
    // Specialized
    'pet_cafe': 'center',
    'pet_photographer': 'center',
    'pet_taxi': 'home',
    'pet_transport': 'home',
    'pet_nutritionist': 'tele',
    'pet_insurance': 'tele',
  };
  
  return roleDefaults[roleId] || 'center';
}

