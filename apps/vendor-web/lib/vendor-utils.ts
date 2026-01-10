// Placeholder vendor utilities
export default {
  formatCurrency: (amount: number) => `₹${amount}`,
  formatDate: (date: Date | string) => new Date(date).toLocaleDateString(),
  formatTime: (date: Date | string) => new Date(date).toLocaleTimeString(),
  isSoloProvider: (vendorData: any) => {
    return vendorData?.serviceStyle === 'solo' || vendorData?.isSoloProvider === true;
  },
  isVet: (roleId?: string) => {
    return roleId === 'vet' || roleId === 'doctor';
  },
  isHealthcareProvider: (roleId?: string) => {
    return roleId === 'vet' || roleId === 'doctor' || roleId === 'clinic' || roleId === 'hospital';
  },
  canOfferCenter: (roleId?: string) => {
    // Roles that can offer center-based services
    return roleId === 'boarder' || roleId === 'groomer' || roleId === 'clinic' || roleId === 'hospital' || roleId === 'vet';
  },
  isStore: (roleId?: string) => {
    return roleId === 'store' || roleId === 'shop' || roleId === 'retailer';
  },
};

