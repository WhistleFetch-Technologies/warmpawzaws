/**
 * ADMIN INTEGRATION ENDPOINTS - SQL VERSION
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * Admin integration management endpoints:
 * - AWS & Google Maps configuration
 * - Payment gateway settings
 * - Logistics partners & rules
 * - Unified upload handler
 * - Connection testing
 * 
 * Date: 2025-01-27
 * Migration: KV to SQL (25 KV operations → 0)
 */

import { Hono } from "npm:hono";
import { S3Client, PutObjectCommand, ListBucketsCommand, CreateBucketCommand, HeadBucketCommand } from "npm:@aws-sdk/client-s3";
import { STSClient, GetCallerIdentityCommand } from "npm:@aws-sdk/client-sts";
import { getDbClient } from "../../lib/db.ts";
import { sendSuccess, sendError } from "../_shared/response-utils.ts";

export function adminIntegrationEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const db = getDbClient();

  console.log('[AdminIntegration-SQL] ===== REGISTERING ENDPOINTS =====');
  console.log('[AdminIntegration-SQL] Base path:', BASE_PATH);

  // Test endpoint to verify registration
  app.get(`${BASE_PATH}/admin/integrations/test`, async (c) => {
    console.log('[AdminIntegration-SQL] TEST endpoint hit');
    return sendSuccess(c, { 
      message: 'Admin integration endpoints are working!',
      timestamp: new Date().toISOString()
    });
  });

  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================

  /**
   * Get platform setting from database
   */
  async function getPlatformSetting(key: string): Promise<any> {
    try {
      const { data, error } = await db
        .from('platform_settings')
        .select('setting_value, setting_type')
        .eq('setting_key', key)
        .maybeSingle();
      
      if (error || !data) {
        return null;
      }
      
      return data.setting_value;
    } catch (error) {
      console.error(`[AdminIntegration-SQL] Error fetching platform setting ${key}:`, error);
      return null;
    }
  }

  /**
   * Set platform setting in database
   */
  async function setPlatformSetting(key: string, value: any): Promise<void> {
    try {
      // Determine setting type
      let settingType = 'object';
      if (typeof value === 'string') settingType = 'string';
      else if (typeof value === 'number') settingType = 'number';
      else if (typeof value === 'boolean') settingType = 'boolean';
      else if (Array.isArray(value)) settingType = 'array';
      
      const { error } = await db
        .from('platform_settings')
        .upsert({
          setting_key: key,
          setting_value: value,
          setting_type: settingType,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });
      
      if (error) {
        throw error;
      }
    } catch (error) {
      console.error(`[AdminIntegration-SQL] Error saving platform setting ${key}:`, error);
      throw error;
    }
  }

  // ==========================================
  // 1. AWS & GOOGLE MAPS CONFIGURATION
  // ==========================================

  // Get general integration settings (AWS, Google Maps)
  app.get(`${BASE_PATH}/admin/integrations/settings`, async (c) => {
    console.log('[AdminIntegration-SQL] ===== GET /admin/integrations/settings CALLED =====');
    
    try {
      // ✅ SQL: Get AWS settings from platform_settings table
      const awsSettings = await getPlatformSetting('admin:settings:aws');
      
      const defaultAws = {
        credentials: { accessKeyId: '', secretAccessKey: '', region: 'ap-south-1' },
        s3: { enabled: false, bucket: '', region: '', accessKeyId: '', secretAccessKey: '' },
        sqs: { enabled: false, queueUrl: '', region: '' },
        sns: { enabled: false, topicArn: '', region: '' },
        es: { enabled: false, endpoint: '', region: '' }
      };
      
      // ✅ SQL: Get Google Maps settings from platform_settings table
      const googleMapsSettings = await getPlatformSetting('admin:settings:google_maps');
      
      const defaultGoogleMaps = {
        enabled: false,
        apiKey: '',
        region: 'IN',
        language: 'en'
      };

      return sendSuccess(c, {
        settings: {
          aws: awsSettings || defaultAws,
          googleMaps: googleMapsSettings || defaultGoogleMaps
        }
      });
    } catch (error) {
      console.error('[AdminIntegration-SQL] ERROR in GET settings:', error);
      return sendError(c, error, 500);
    }
  });

  // Save general integration settings
  app.post(`${BASE_PATH}/admin/integrations/settings`, async (c) => {
    console.log('[AdminIntegration-SQL] POST /admin/integrations/settings called');
    try {
      const body = await c.req.json();
      const { type, settings } = body; // type = 'aws' or 'googleMaps'

      // ✅ SQL: Save settings to platform_settings table
      if (type === 'aws') {
        await setPlatformSetting('admin:settings:aws', settings);
      } else if (type === 'googleMaps') {
        await setPlatformSetting('admin:settings:google_maps', settings);
      } else {
        return sendError(c, 'Invalid setting type', 400);
      }

      return sendSuccess(c, { message: 'Settings saved successfully' });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  // ✅ NEW: Save AWS settings (S3, SNS, SQS, Chime, Bedrock)
  app.post(`${BASE_PATH}/admin/settings/aws`, async (c) => {
    try {
      const settings = await c.req.json();
      
      const awsSettings = {
        credentials: {
          accessKeyId: settings.credentials?.accessKeyId || '',
          secretAccessKey: settings.credentials?.secretAccessKey || '',
          region: settings.credentials?.region || 'ap-south-1'
        },
        s3: {
          enabled: settings.s3?.enabled || false,
          bucket: settings.s3?.bucket || '',
          region: settings.s3?.region || 'ap-south-1'
        },
        sns: {
          enabled: settings.sns?.enabled || false,
          region: settings.sns?.region || 'ap-south-1',
          smsOriginationNumber: settings.sns?.smsOriginationNumber || '',
          emailSourceAddress: settings.sns?.emailSourceAddress || ''
        },
        sqs: {
          enabled: settings.sqs?.enabled || false,
          queueUrl: settings.sqs?.queueUrl || '',
          region: settings.sqs?.region || 'ap-south-1'
        },
        chime: {
          enabled: settings.chime?.enabled || false,
          region: settings.chime?.region || 'us-east-1'
        },
        bedrock: {
          enabled: settings.bedrock?.enabled || false,
          region: settings.bedrock?.region || 'us-east-1',
          modelId: settings.bedrock?.modelId || 'anthropic.claude-v2'
        },
        updatedAt: new Date().toISOString()
      };
      
      // ✅ SQL: Save AWS settings to platform_settings table
      await setPlatformSetting('platform:settings:aws', awsSettings);
      
      console.log('✅ AWS settings saved');
      return sendSuccess(c, {
        message: 'AWS settings saved successfully',
        settings: awsSettings
      });
    } catch (error) {
      console.error('Error saving AWS settings:', error);
      return sendError(c, error, 500);
    }
  });

  // ✅ NEW: Get AWS settings
  app.get(`${BASE_PATH}/admin/settings/aws`, async (c) => {
    try {
      // ✅ SQL: Get AWS settings from platform_settings table
      const settings = await getPlatformSetting('platform:settings:aws');
      
      const defaultSettings = {
        credentials: { accessKeyId: '', secretAccessKey: '', region: 'ap-south-1' },
        s3: { enabled: false, bucket: '', region: 'ap-south-1' },
        sns: { enabled: false, region: 'ap-south-1', smsOriginationNumber: '', emailSourceAddress: '' },
        sqs: { enabled: false, queueUrl: '', region: 'ap-south-1' },
        chime: { enabled: false, region: 'us-east-1' },
        bedrock: { enabled: false, region: 'us-east-1', modelId: 'anthropic.claude-v2' }
      };
      
      return sendSuccess(c, {
        settings: settings || defaultSettings
      });
    } catch (error) {
      console.error('Error fetching AWS settings:', error);
      return sendError(c, error, 500);
    }
  });

  // ✅ NEW: Save Google Maps settings
  app.post(`${BASE_PATH}/admin/settings/google-maps`, async (c) => {
    try {
      const settings = await c.req.json();
      
      const googleMapsSettings = {
        enabled: settings.enabled || false,
        apiKey: settings.apiKey || '',
        region: settings.region || 'IN',
        updatedAt: new Date().toISOString()
      };
      
      // ✅ SQL: Save Google Maps settings to platform_settings table
      await setPlatformSetting('platform:settings:google_maps', googleMapsSettings);
      
      console.log('✅ Google Maps settings saved');
      return sendSuccess(c, {
        message: 'Google Maps settings saved successfully',
        settings: googleMapsSettings
      });
    } catch (error) {
      console.error('Error saving Google Maps settings:', error);
      return sendError(c, error, 500);
    }
  });

  // ✅ NEW: Get Google Maps settings
  app.get(`${BASE_PATH}/admin/settings/google-maps`, async (c) => {
    try {
      // ✅ SQL: Get Google Maps settings from platform_settings table
      const settings = await getPlatformSetting('platform:settings:google_maps');
      
      const defaultSettings = {
        enabled: false,
        apiKey: '',
        region: 'IN'
      };
      
      return sendSuccess(c, {
        settings: settings || defaultSettings
      });
    } catch (error) {
      console.error('Error fetching Google Maps settings:', error);
      return sendError(c, error, 500);
    }
  });

  // ✅ EXISTING: Save payment gateway settings (Razorpay, Stripe, etc.)
  app.post(`${BASE_PATH}/admin/settings/payment-gateway`, async (c) => {
    try {
      const settings = await c.req.json();
      
      const paymentGatewaySettings = {
        razorpay: {
          enabled: settings.razorpay?.enabled || false,
          key_id: settings.razorpay?.key_id || '',
          key_secret: settings.razorpay?.key_secret || '',
          webhook_secret: settings.razorpay?.webhook_secret || '',
          auto_capture: settings.razorpay?.auto_capture !== false,
          test_mode: settings.razorpay?.test_mode || false
        },
        stripe: {
          enabled: settings.stripe?.enabled || false,
          publishable_key: settings.stripe?.publishable_key || '',
          secret_key: settings.stripe?.secret_key || '',
          webhook_secret: settings.stripe?.webhook_secret || '',
          test_mode: settings.stripe?.test_mode || false
        },
        paytm: {
          enabled: settings.paytm?.enabled || false,
          merchant_id: settings.paytm?.merchant_id || '',
          merchant_key: settings.paytm?.merchant_key || '',
          test_mode: settings.paytm?.test_mode || false
        },
        default_gateway: settings.default_gateway || 'razorpay',
        commission_percentage: settings.commission_percentage || 15,
        settlement_period_days: settings.settlement_period_days || 3,
        updatedAt: new Date().toISOString()
      };
      
      // ✅ SQL: Save payment gateway settings to platform_settings table
      await setPlatformSetting('platform:settings:payment_gateway', paymentGatewaySettings);
      
      console.log('✅ Payment gateway settings updated');
      return sendSuccess(c, {
        message: 'Payment gateway settings updated successfully',
        settings: paymentGatewaySettings
      });
    } catch (error) {
      console.error('Error updating payment gateway settings:', error);
      return sendError(c, error, 500);
    }
  });

  // ✅ EXISTING: Get payment gateway settings
  app.get(`${BASE_PATH}/admin/settings/payment-gateway`, async (c) => {
    try {
      // ✅ SQL: Get payment gateway settings from platform_settings table
      const settings = await getPlatformSetting('platform:settings:payment_gateway');
      
      const defaultSettings = {
        razorpay: { enabled: false, key_id: '', test_mode: true },
        stripe: { enabled: false, test_mode: true },
        paytm: { enabled: false, test_mode: true },
        default_gateway: 'razorpay',
        commission_percentage: 15,
        settlement_period_days: 3
      };
      
      return sendSuccess(c, {
        settings: settings || defaultSettings
      });
    } catch (error) {
      console.error('Error fetching payment gateway settings:', error);
      return sendError(c, error, 500);
    }
  });

  // ==========================================
  // 2. PAYMENT GATEWAYS & RULES
  // ==========================================

  // Get all payment gateways
  app.get(`${BASE_PATH}/admin/integrations/payments/gateways`, async (c) => {
    console.log('[AdminIntegration-SQL] GET /admin/integrations/payments/gateways called');
    try {
      // ✅ SQL: Get payment gateways from platform_settings table
      const gateways = await getPlatformSetting('admin:settings:payment_gateways') || [];
      return sendSuccess(c, { gateways });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  // Add or Update Payment Gateway
  app.post(`${BASE_PATH}/admin/integrations/payments/gateways`, async (c) => {
    console.log('[AdminIntegration-SQL] POST /admin/integrations/payments/gateways called');
    try {
      const gateway = await c.req.json();
      if (!gateway.id) return sendError(c, 'Gateway ID required', 400);

      // ✅ SQL: Get existing gateways from platform_settings table
      const gateways = await getPlatformSetting('admin:settings:payment_gateways') || [];
      const index = gateways.findIndex((g: any) => g.id === gateway.id);

      if (index >= 0) {
        gateways[index] = { ...gateways[index], ...gateway };
      } else {
        gateways.push(gateway);
      }

      // ✅ SQL: Save updated gateways to platform_settings table
      await setPlatformSetting('admin:settings:payment_gateways', gateways);
      return sendSuccess(c, { gateways });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  // Delete Payment Gateway
  app.delete(`${BASE_PATH}/admin/integrations/payments/gateways/:id`, async (c) => {
    console.log('[AdminIntegration-SQL] DELETE /admin/integrations/payments/gateways/:id called');
    try {
      const id = c.req.param('id');
      
      // ✅ SQL: Get existing gateways from platform_settings table
      const gateways = await getPlatformSetting('admin:settings:payment_gateways') || [];
      const newGateways = gateways.filter((g: any) => g.id !== id);
      
      // ✅ SQL: Save updated gateways to platform_settings table
      await setPlatformSetting('admin:settings:payment_gateways', newGateways);
      return sendSuccess(c, { gateways: newGateways });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  // Get Payout Rules
  app.get(`${BASE_PATH}/admin/integrations/payments/rules`, async (c) => {
    console.log('[AdminIntegration-SQL] GET /admin/integrations/payments/rules called');
    try {
      // ✅ SQL: Get payout rules from platform_settings table
      const rules = await getPlatformSetting('admin:settings:payout_rules') || {
        defaultCommission: 10,
        holdPeriodDays: 7,
        minimumPayout: 1000,
        autoPayout: true,
        taxRate: 18
      };
      return sendSuccess(c, { rules });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  // Save Payout Rules
  app.post(`${BASE_PATH}/admin/integrations/payments/rules`, async (c) => {
    console.log('[AdminIntegration-SQL] POST /admin/integrations/payments/rules called');
    try {
      const rules = await c.req.json();
      
      // ✅ SQL: Save payout rules to platform_settings table
      await setPlatformSetting('admin:settings:payout_rules', rules);
      return sendSuccess(c, { rules });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  // ==========================================
  // 3. LOGISTICS PARTNERS & TERRITORY RULES
  // ==========================================

  // Get Logistics Partners
  app.get(`${BASE_PATH}/admin/integrations/logistics`, async (c) => {
    console.log('[AdminIntegration-SQL] GET /admin/integrations/logistics called');
    try {
      // ✅ SQL: Get logistics partners from platform_settings table
      const partners = await getPlatformSetting('admin:settings:logistics_partners') || [];
      return sendSuccess(c, { partners });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  // Add/Update Logistics Partner
  app.post(`${BASE_PATH}/admin/integrations/logistics`, async (c) => {
    console.log('[AdminIntegration-SQL] POST /admin/integrations/logistics called');
    try {
      const partner = await c.req.json();
      if (!partner.id) return sendError(c, 'Partner ID required', 400);

      // ✅ SQL: Get existing partners from platform_settings table
      const partners = await getPlatformSetting('admin:settings:logistics_partners') || [];
      const index = partners.findIndex((p: any) => p.id === partner.id);

      if (index >= 0) {
        partners[index] = { ...partners[index], ...partner };
      } else {
        partners.push(partner);
      }

      // ✅ SQL: Save updated partners to platform_settings table
      await setPlatformSetting('admin:settings:logistics_partners', partners);
      return sendSuccess(c, { partners });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  // Get Logistics Rules
  app.get(`${BASE_PATH}/admin/integrations/logistics/rules`, async (c) => {
    console.log('[AdminIntegration-SQL] GET /admin/integrations/logistics/rules called');
    try {
      // ✅ SQL: Get logistics rules from platform_settings table
      const rules = await getPlatformSetting('admin:settings:logistics_rules') || [];
      return sendSuccess(c, { rules });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  // Save Logistics Rules
  app.post(`${BASE_PATH}/admin/integrations/logistics/rules`, async (c) => {
    console.log('[AdminIntegration-SQL] POST /admin/integrations/logistics/rules called');
    try {
      const rules = await c.req.json();
      
      // ✅ SQL: Save logistics rules to platform_settings table
      await setPlatformSetting('admin:settings:logistics_rules', rules);
      return sendSuccess(c, { rules });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  // ✅ NEW: Save logistics integration settings (Shiprocket, etc.)
  app.post(`${BASE_PATH}/admin/settings/logistics`, async (c) => {
    try {
      const settings = await c.req.json();
      
      const logisticsSettings = {
        shiprocket: {
          enabled: settings.shiprocket?.enabled || false,
          email: settings.shiprocket?.email || '',
          password: settings.shiprocket?.password || '',
          auto_awb: settings.shiprocket?.auto_awb !== false,
          auto_pickup: settings.shiprocket?.auto_pickup !== false,
          test_mode: settings.shiprocket?.test_mode || false
        },
        delhivery: {
          enabled: settings.delhivery?.enabled || false,
          api_key: settings.delhivery?.api_key || '',
          test_mode: settings.delhivery?.test_mode || false
        },
        bluedart: {
          enabled: settings.bluedart?.enabled || false,
          username: settings.bluedart?.username || '',
          password: settings.bluedart?.password || '',
          test_mode: settings.bluedart?.test_mode || false
        },
        default_provider: settings.default_provider || 'shiprocket',
        warehouse_address: settings.warehouse_address || {},
        updatedAt: new Date().toISOString()
      };
      
      // ✅ SQL: Save logistics settings to platform_settings table
      await setPlatformSetting('platform:settings:logistics', logisticsSettings);
      
      console.log('✅ Logistics settings updated');
      return sendSuccess(c, {
        message: 'Logistics settings updated successfully',
        settings: logisticsSettings
      });
    } catch (error) {
      console.error('Error updating logistics settings:', error);
      return sendError(c, error, 500);
    }
  });

  // ✅ NEW: Get logistics settings
  app.get(`${BASE_PATH}/admin/settings/logistics`, async (c) => {
    try {
      // ✅ SQL: Get logistics settings from platform_settings table
      const settings = await getPlatformSetting('platform:settings:logistics');
      
      const defaultSettings = {
        shiprocket: { enabled: false, test_mode: true },
        delhivery: { enabled: false, test_mode: true },
        bluedart: { enabled: false, test_mode: true },
        default_provider: 'shiprocket',
        warehouse_address: {}
      };
      
      return sendSuccess(c, {
        settings: settings || defaultSettings
      });
    } catch (error) {
      console.error('Error fetching logistics settings:', error);
      return sendError(c, error, 500);
    }
  });

  // ==========================================
  // 4. UNIFIED UPLOAD & UTILS
  // ==========================================

  // Unified Upload Handler (Determines destination based on settings)
  app.post(`${BASE_PATH}/upload/unified`, async (c) => {
    console.log('[AdminIntegration-SQL] POST /upload/unified called');
    try {
      const formData = await c.req.formData();
      const file = formData.get('file');
      const path = formData.get('path') || 'uploads'; // folder path

      if (!file) return sendError(c, 'No file provided', 400);

      // ✅ SQL: Get AWS settings from platform_settings table
      const awsSettings = await getPlatformSetting('admin:settings:aws');
      
      // 2. If S3 Enabled, Upload to S3
      if (awsSettings?.s3?.enabled && awsSettings?.credentials?.accessKeyId) {
        const fileName = (file as File).name;
        // Use configured bucket or default to the required dev bucket
        let bucket = awsSettings.s3.bucket || 'warmpawsvendorfilesdev';
        
        // Force specific bucket for vendor documents as per requirements
        if (path.includes('vendor-docs') || path.includes('vendor')) {
           bucket = 'warmpawsvendorfilesdev';
        }

        const region = awsSettings.s3.region || 'ap-south-1';
        const key = `${path}/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        
        try {
          console.log(`☁️ [UPLOAD] Uploading to S3 bucket: ${bucket}`);
          const client = new S3Client({
            region,
            credentials: {
              accessKeyId: awsSettings.credentials.accessKeyId,
              secretAccessKey: awsSettings.credentials.secretAccessKey
            }
          });
          
          // Check if bucket exists, create if not
          try {
            await client.send(new HeadBucketCommand({ Bucket: bucket }));
          } catch (headErr: any) {
            if (headErr.name === 'NotFound' || headErr.$metadata?.httpStatusCode === 404) {
               console.log(`⚠️ [UPLOAD] Bucket ${bucket} not found. Creating...`);
               await client.send(new CreateBucketCommand({ Bucket: bucket }));
               console.log(`✅ [UPLOAD] Bucket ${bucket} created successfully.`);
            } else {
               console.warn(`⚠️ [UPLOAD] Could not verify bucket ${bucket}:`, headErr);
               // Continue anyway, maybe we have Write but not List/Head permissions
            }
          }
          
          const arrayBuffer = await (file as File).arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          
          const command = new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: uint8Array,
            ContentType: (file as File).type
          });
          
          await client.send(command);
          
          const s3Url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
          console.log(`✅ [UPLOAD] S3 Upload success: ${s3Url}`);
          
          return sendSuccess(c, {
            url: s3Url,
            provider: 'aws_s3',
            bucket: bucket
          });
          
        } catch (s3Error) {
          console.error('❌ [UPLOAD] S3 Error:', s3Error);
          return sendError(c, `S3 Upload Failed: ${String(s3Error)}`, 500);
        }
      }

      // 3. Fallback to Supabase Storage
      return sendSuccess(c, {
        provider: 'supabase_storage',
        message: 'S3 not enabled, use Supabase Storage'
      });

    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  // ==========================================
  // 5. CONNECTION TESTING
  // ==========================================

  app.post(`${BASE_PATH}/admin/integrations/test-connection`, async (c) => {
    console.log('[AdminIntegration-SQL] POST /admin/integrations/test-connection called');
    try {
      const { type, config } = await c.req.json();

      if (type === 'googleMaps') {
        if (!config.apiKey) return sendError(c, 'API Key missing', 400);
        
        // Test Geocoding API
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=New+Delhi&key=${config.apiKey}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.status === 'OK') {
           return sendSuccess(c, { 
             message: 'Google Maps API connected successfully', 
             details: data.results?.[0]?.formatted_address 
           });
        } else {
           return sendError(c, `Google Maps Error: ${data.status}`, 400);
        }
      }

      if (type === 's3' || type === 'aws_iam') {
        if (!config.accessKeyId || !config.secretAccessKey) {
          return sendError(c, 'AWS Credentials missing', 400);
        }

        const region = config.region || 'ap-south-1';
        const cleanAccessKeyId = String(config.accessKeyId).trim();
        const cleanSecretAccessKey = String(config.secretAccessKey).trim();
        
        if (!cleanAccessKeyId.startsWith('AKIA') && !cleanAccessKeyId.startsWith('ASIA')) {
             return sendError(c, 'Invalid Access Key ID format. Should start with AKIA or ASIA.', 400);
        }

        try {
            // 1. Test IAM (Identity)
            const stsClient = new STSClient({
                region,
                credentials: {
                    accessKeyId: cleanAccessKeyId,
                    secretAccessKey: cleanSecretAccessKey
                }
            });
            const identity = await stsClient.send(new GetCallerIdentityCommand({}));
            
            if (type === 'aws_iam') {
                return sendSuccess(c, { 
                    message: `AWS IAM Connected: ${identity.Arn}`,
                    details: `Account: ${identity.Account}, UserId: ${identity.UserId}`
                });
            }

            // 2. Test S3 (Storage)
            if (type === 's3') {
                const s3Client = new S3Client({
                    region,
                    credentials: {
                        accessKeyId: cleanAccessKeyId,
                        secretAccessKey: cleanSecretAccessKey
                    }
                });
                
                const buckets = await s3Client.send(new ListBucketsCommand({}));
                const bucketNames = buckets.Buckets?.map(b => b.Name).slice(0, 5).join(', ') || 'No buckets found';
                
                return sendSuccess(c, { 
                    message: `AWS S3 Connected. Found ${buckets.Buckets?.length} buckets.`,
                    details: `Buckets: ${bucketNames}...`
                });
            }

        } catch (awsError) {
            console.error('AWS Test Error:', awsError);
            const msg = String(awsError);
            if (msg.includes('InvalidAccessKeyId')) return sendError(c, 'Invalid Access Key ID', 400);
            if (msg.includes('SignatureDoesNotMatch')) return sendError(c, 'Invalid Secret Access Key', 400);
            return sendError(c, `AWS Connection Failed: ${msg}`, 500);
        }
      }

      return sendError(c, 'Unknown test type', 400);
    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Admin Integration endpoints registered (SQL-only)');
}

