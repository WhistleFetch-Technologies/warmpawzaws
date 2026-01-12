// Comprehensive vendor utilities for all vendor roles
export default {
  formatCurrency: (amount: number) => `₹${amount}`,
  formatDate: (date: Date | string) => new Date(date).toLocaleDateString(),
  formatTime: (date: Date | string) => new Date(date).toLocaleTimeString(),
  isSoloProvider: (vendorData: any) => {
    return vendorData?.serviceStyle === 'solo' || vendorData?.isSoloProvider === true;
  },
  isVet: (roleId?: string) => {
    return roleId === 'vet' || roleId === 'doctor' || roleId === 'veterinarian' || 
           roleId === 'pet_clinic' || roleId === 'veterinary_clinic' ||
           roleId?.includes('vet') || roleId?.includes('clinic');
  },
  isHealthcareProvider: (roleId?: string) => {
    return roleId === 'vet' || roleId === 'doctor' || roleId === 'veterinarian' || 
           roleId === 'pet_clinic' || roleId === 'veterinary_clinic' || 
           roleId === 'clinic' || roleId === 'hospital' ||
           roleId === 'pet_pharmacy' || roleId === 'pharmacy' ||
           roleId === 'pet_ambulance' || roleId === 'ambulance';
  },
  canOfferCenter: (roleId?: string) => {
    // Roles that can offer center-based services
    return roleId === 'boarder' || roleId === 'pet_boarding' || 
           roleId === 'groomer' || roleId === 'pet_groomer' || 
           roleId === 'clinic' || roleId === 'hospital' || 
           roleId === 'vet' || roleId === 'veterinarian' ||
           roleId === 'pet_clinic' || roleId === 'veterinary_clinic' ||
           roleId === 'pet_resort' || roleId === 'resort' ||
           roleId === 'pet_cafe' || roleId === 'cafe';
  },
  isStore: (roleId?: string) => {
    return roleId === 'store' || roleId === 'shop' || roleId === 'retailer' ||
           roleId === 'product_seller' || roleId === 'pet_products_store' ||
           roleId === 'pet_product' || roleId === 'retail';
  },
  isGroomer: (roleId?: string) => {
    return roleId === 'groomer' || roleId === 'pet_groomer' || roleId?.includes('groom');
  },
  isWalker: (roleId?: string) => {
    return roleId === 'walker' || roleId === 'pet_walker' || roleId?.includes('walk');
  },
  isTrainer: (roleId?: string) => {
    return roleId === 'trainer' || roleId === 'pet_trainer' || roleId?.includes('train');
  },
  isBoarding: (roleId?: string) => {
    return roleId === 'boarding' || roleId === 'pet_boarding' || 
           roleId === 'boarder' || roleId?.includes('board');
  },
  isTaxi: (roleId?: string) => {
    return roleId === 'taxi' || roleId === 'pet_taxi' || 
           roleId === 'pet_transport' || roleId?.includes('transport');
  },
  isPhotographer: (roleId?: string) => {
    return roleId === 'photographer' || roleId === 'pet_photographer' || roleId?.includes('photo');
  },
  isShelter: (roleId?: string) => {
    return roleId === 'shelter' || roleId === 'pet_shelter' || roleId?.includes('shelter');
  },
  isCafe: (roleId?: string) => {
    return roleId === 'cafe' || roleId === 'pet_cafe';
  },
  isResort: (roleId?: string) => {
    return roleId === 'resort' || roleId === 'pet_resort';
  },
  isNutritionist: (roleId?: string) => {
    return roleId === 'nutritionist' || roleId === 'pet_nutritionist';
  },
  isSunsetServices: (roleId?: string) => {
    return roleId === 'sunset_services' || roleId === 'pet_sunset_services' || roleId?.includes('sunset');
  },
  isInsurance: (roleId?: string) => {
    return roleId === 'insurance' || roleId === 'pet_insurance';
  },
  isPharmacy: (roleId?: string) => {
    return roleId === 'pharmacy' || roleId === 'pet_pharmacy';
  },
  isSitter: (roleId?: string) => {
    return roleId === 'sitter' || roleId === 'pet_sitter';
  },
  isBreeder: (roleId?: string) => {
    return roleId === 'breeder' || roleId === 'pet_breeder';
  },
};

