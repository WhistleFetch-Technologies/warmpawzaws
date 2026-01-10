// Placeholder capability helper
export default {
  hasCapability: (capabilities: any, capability: string) => {
    return capabilities?.[capability] === true;
  },
  getCapabilities: (vendor: any) => {
    return vendor?.capabilities || {};
  },
  hasBooking: (capabilities: any) => {
    return capabilities?.booking === true || capabilities?.canBook === true;
  },
  hasMedicalRecords: (capabilities: any) => {
    return capabilities?.medicalRecords === true || capabilities?.canViewMedicalRecords === true;
  },
  hasCatalog: (capabilities: any) => {
    return capabilities?.catalog === true || capabilities?.canManageCatalog === true;
  },
};

