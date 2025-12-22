/**
 * ============================================================================
 * PLATFORM SETTINGS REPOSITORY
 * ============================================================================
 * 
 * Repository for platform settings (AWS, Google Maps, Payment Gateway, Logistics)
 * Replaces: platform:settings:* KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery, upsertQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

// ============================================================================
// TYPES
// ============================================================================

export interface AWSSettings {
  id: string;
  setting_key: string;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
  };
  s3_config: any;
  sns_config: any;
  sqs_config: any;
  chime_config: any;
  bedrock_config: any;
  updated_at: string;
}

export interface GoogleMapsSettings {
  id: string;
  setting_key: string;
  api_key: string;
  enabled: boolean;
  region: string;
  language: string;
  updated_at: string;
}

export interface PaymentGatewaySettings {
  id: string;
  gateway_name: string;
  gateway_type: 'razorpay' | 'stripe' | 'paypal' | 'paytm';
  key_id: string | null;
  key_secret: string | null;
  webhook_secret: string | null;
  marketplace_mode: boolean;
  enabled: boolean;
  test_mode: boolean;
  config: any;
  updated_at: string;
}

export interface LogisticsPartner {
  id: string;
  partner_id: string;
  partner_name: string;
  partner_type: 'shiprocket' | 'delhivery' | 'dunzo' | 'other';
  email: string | null;
  password: string | null;
  api_key: string | null;
  api_secret: string | null;
  enabled: boolean;
  config: any;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// REPOSITORY CLASS
// ============================================================================

export class PlatformSettingsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  // ============================================================================
  // AWS SETTINGS
  // ============================================================================

  async getAWSSettings(): Promise<AWSSettings | null> {
    const results = await selectQuery<AWSSettings>("aws_settings", { setting_key: 'aws' }, { limit: 1 });
    return results[0] || null;
  }

  async saveAWSSettings(settings: Partial<AWSSettings>): Promise<AWSSettings> {
    const results = await upsertQuery<AWSSettings>(
      "aws_settings",
      {
        setting_key: 'aws',
        credentials: settings.credentials || {},
        s3_config: settings.s3_config || {},
        sns_config: settings.sns_config || {},
        sqs_config: settings.sqs_config || {},
        chime_config: settings.chime_config || {},
        bedrock_config: settings.bedrock_config || {},
        updated_at: new Date().toISOString(),
      },
      "setting_key"
    );
    
    if (!results[0]) {
      throw new Error("Failed to save AWS settings");
    }
    
    return results[0];
  }

  // ============================================================================
  // GOOGLE MAPS SETTINGS
  // ============================================================================

  async getGoogleMapsSettings(): Promise<GoogleMapsSettings | null> {
    const results = await selectQuery<GoogleMapsSettings>("google_maps_settings", { setting_key: 'google_maps' }, { limit: 1 });
    return results[0] || null;
  }

  async saveGoogleMapsSettings(settings: Partial<GoogleMapsSettings>): Promise<GoogleMapsSettings> {
    const results = await upsertQuery<GoogleMapsSettings>(
      "google_maps_settings",
      {
        setting_key: 'google_maps',
        api_key: settings.api_key || '',
        enabled: settings.enabled !== false,
        region: settings.region || 'IN',
        language: settings.language || 'en',
        updated_at: new Date().toISOString(),
      },
      "setting_key"
    );
    
    if (!results[0]) {
      throw new Error("Failed to save Google Maps settings");
    }
    
    return results[0];
  }

  // ============================================================================
  // PAYMENT GATEWAY SETTINGS
  // ============================================================================

  async getPaymentGatewaySettings(gatewayName: string = 'razorpay'): Promise<PaymentGatewaySettings | null> {
    const results = await selectQuery<PaymentGatewaySettings>("payment_gateway_settings", { gateway_name: gatewayName }, { limit: 1 });
    return results[0] || null;
  }

  async savePaymentGatewaySettings(settings: Partial<PaymentGatewaySettings>): Promise<PaymentGatewaySettings> {
    const gatewayName = settings.gateway_name || 'razorpay';
    
    const results = await upsertQuery<PaymentGatewaySettings>(
      "payment_gateway_settings",
      {
        gateway_name: gatewayName,
        gateway_type: settings.gateway_type || 'razorpay',
        key_id: settings.key_id || null,
        key_secret: settings.key_secret || null,
        webhook_secret: settings.webhook_secret || null,
        marketplace_mode: settings.marketplace_mode !== false,
        enabled: settings.enabled !== false,
        test_mode: settings.test_mode || false,
        config: settings.config || {},
        updated_at: new Date().toISOString(),
      },
      "gateway_name"
    );
    
    if (!results[0]) {
      throw new Error("Failed to save payment gateway settings");
    }
    
    return results[0];
  }

  // ============================================================================
  // LOGISTICS PARTNERS
  // ============================================================================

  async getLogisticsPartners(): Promise<LogisticsPartner[]> {
    return selectQuery<LogisticsPartner>("logistics_partners", { enabled: true }, {
      orderBy: "partner_name",
      orderDirection: "asc",
    });
  }

  async getLogisticsPartner(partnerId: string): Promise<LogisticsPartner | null> {
    const results = await selectQuery<LogisticsPartner>("logistics_partners", { partner_id: partnerId }, { limit: 1 });
    return results[0] || null;
  }

  async saveLogisticsPartner(partner: Partial<LogisticsPartner>): Promise<LogisticsPartner> {
    if (!partner.partner_id) {
      throw new Error("partner_id is required");
    }
    
    const results = await upsertQuery<LogisticsPartner>(
      "logistics_partners",
      {
        partner_id: partner.partner_id,
        partner_name: partner.partner_name || partner.partner_id,
        partner_type: partner.partner_type || 'other',
        email: partner.email || null,
        password: partner.password || null,
        api_key: partner.api_key || null,
        api_secret: partner.api_secret || null,
        enabled: partner.enabled !== false,
        config: partner.config || {},
        updated_at: new Date().toISOString(),
      },
      "partner_id"
    );
    
    if (!results[0]) {
      throw new Error("Failed to save logistics partner");
    }
    
    return results[0];
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let repositoryInstance: PlatformSettingsRepository | null = null;

export function getPlatformSettingsRepository(): PlatformSettingsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new PlatformSettingsRepository();
  }
  return repositoryInstance;
}

