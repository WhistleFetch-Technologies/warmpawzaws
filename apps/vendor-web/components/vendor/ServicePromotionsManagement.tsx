'use client';

import { ServicePromotionsHub } from './promotions/ServicePromotionsHub';

interface ServicePromotionsManagementProps {
  vendorId: string;
  vendorRole?: string;
  onBack?: () => void;
}

/** UX Sprint 2 — unified promotion dashboard + wizard */
export function ServicePromotionsManagement(props: ServicePromotionsManagementProps) {
  return <ServicePromotionsHub {...props} />;
}

export default ServicePromotionsManagement;
