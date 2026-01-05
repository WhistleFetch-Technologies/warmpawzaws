/**
 * GST Calculator - Inline implementation for Lambda
 * Uses SQL queries to calculate GST based on rules
 */
export interface GSTCalculationParams {
    amount: number;
    roleId?: string;
    serviceStyle?: string;
    customerState?: string;
    vendorState?: string;
    category?: string;
}
export interface GSTCalculation {
    subtotal: number;
    gstAmount: number;
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
    ruleId?: string;
    ruleName?: string;
    rate: number;
    isInterState: boolean;
}
/**
 * Calculate GST based on role and service style
 */
export declare function calculateGST(params: GSTCalculationParams): Promise<GSTCalculation>;
//# sourceMappingURL=gst-calculator.d.ts.map