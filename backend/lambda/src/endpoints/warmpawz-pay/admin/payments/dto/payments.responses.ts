export interface WpayAdminPaymentItemDTO {
  readonly paymentId: string;
  readonly customer: {
    readonly name: string;
    readonly phone: string;
  };
  readonly vendor: {
    readonly name: string;
    readonly category: string;
  };
  readonly originalAmount: number;
  readonly discountPercent: number;
  readonly discountAmount: number;
  readonly payableAmount: number;
  readonly platformWithholdPercent: number;
  readonly platformWithholdAmount: number;
  readonly vendorSettlementAmount: number;
  readonly settlementSource: 'persisted' | 'computed';
  readonly paidAt: string;
}

export interface WpayAdminPaymentsListDTO {
  readonly items: readonly WpayAdminPaymentItemDTO[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}
