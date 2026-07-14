'use client';

import { SellerPromotionsHub } from '../promotions/SellerPromotionsHub';

interface PromotionsManagementProps {
  sellerId: string;
}

/** UX Sprint 2 — unified seller promotion dashboard + wizard */
export function PromotionsManagement({ sellerId }: PromotionsManagementProps) {
  return <SellerPromotionsHub sellerId={sellerId} />;
}

export default PromotionsManagement;
