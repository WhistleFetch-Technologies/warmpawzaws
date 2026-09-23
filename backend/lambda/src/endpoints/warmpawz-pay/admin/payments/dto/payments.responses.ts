export type WpayCommercialModel = 'tier_commission' | 'withhold';

/** Vendor payout flag mirrored from settlements.settlement_status (ledger map). */
export type WpayAdminPayoutStatus = 'pending' | 'settled' | 'unavailable';

export interface WpayAdminPaymentItemDTO {
  readonly paymentId: string;
  readonly customer: {
    readonly name: string;
    readonly phone: string;
  };
  readonly vendor: {
    readonly id: string;
    readonly name: string;
    readonly category: string;
    readonly tierName?: string | null;
  };
  readonly commercialModel: WpayCommercialModel;
  readonly originalAmount: number;
  readonly discountPercent: number;
  readonly discountAmount: number;
  readonly payableAmount: number;
  readonly appointmentFeeCredit?: number;
  readonly commissionPercent?: number;
  readonly vendorPayableAmount?: number;
  readonly wpayRevenueAmount?: number;
  readonly platformGstAmount?: number;
  readonly platformFee?: number;
  readonly platformFeeGstAmount?: number;
  readonly convenienceFee?: number;
  readonly convenienceGstAmount?: number;
  readonly finalGstAmount?: number;
  readonly burnMode?: boolean;
  readonly burnAmount?: number;
  /** Wallet cashback (or balance) applied on this Pay Bill. */
  readonly walletAmount?: number;
  /** Razorpay portion after wallet. */
  readonly razorpayChargeAmount?: number;
  /** Promo-engine evaluation id when a promo applied. */
  readonly evaluationId?: string | null;
  /** Instant promo discount from engine (same as discountAmount when engine-driven). */
  readonly engineDiscountAmount?: number;
  /** Cashback promised at quote (credit on commit). */
  readonly pendingCashback?: number;
  /** Cashback actually credited to wallet after promo commit. */
  readonly awardedCashback?: number;
  readonly platformWithholdPercent?: number;
  readonly platformWithholdAmount?: number;
  readonly vendorSettlementAmount: number;
  readonly settlementSource: 'persisted' | 'computed';
  readonly settlementId?: string | null;
  /** pending | settled | unavailable (no settlement row yet) */
  readonly payoutStatus: WpayAdminPayoutStatus;
  readonly payoutSettledAt?: string | null;
  readonly paidAt: string;
}

export interface WpayAdminPaymentsSettleDTO {
  readonly settledPaymentIds: readonly string[];
  readonly settledCount: number;
  readonly skipped: readonly {
    readonly paymentId: string;
    readonly reason: string;
  }[];
}

export interface WpayAdminPaymentsListDTO {
  readonly items: readonly WpayAdminPaymentItemDTO[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}
