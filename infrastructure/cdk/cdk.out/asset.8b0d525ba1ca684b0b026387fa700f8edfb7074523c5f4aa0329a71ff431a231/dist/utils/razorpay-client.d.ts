/**
 * ============================================================================
 * RAZORPAY CLIENT UTILITY
 * ============================================================================
 *
 * Centralized Razorpay API client
 *
 * Date: 2025-01-28
 * ============================================================================
 */
export interface RazorpayConfig {
    keyId: string;
    keySecret: string;
    webhookSecret: string;
}
/**
 * Get Razorpay configuration from database
 */
export declare function getRazorpayConfig(): Promise<RazorpayConfig>;
/**
 * Get Razorpay authorization header
 */
export declare function getRazorpayAuthHeader(): Promise<string>;
/**
 * Make Razorpay API request
 */
export declare function razorpayRequest(endpoint: string, method?: 'GET' | 'POST' | 'PUT' | 'DELETE', body?: any): Promise<any>;
/**
 * Convenience accessor for Razorpay client actions
 */
export declare function getRazorpayClient(): {
    request: typeof razorpayRequest;
    getConfig: typeof getRazorpayConfig;
    getAuthHeader: typeof getRazorpayAuthHeader;
    payments: {
        refund(params: {
            payment_id: string;
            amount?: number;
        }): Promise<any>;
    };
    payouts: {
        create(body: any): Promise<any>;
    };
};
//# sourceMappingURL=razorpay-client.d.ts.map