import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { S3Client, PutObjectCommand, ListBucketsCommand, CreateBucketCommand, HeadBucketCommand } from "npm:@aws-sdk/client-s3";
import { STSClient, GetCallerIdentityCommand } from "npm:@aws-sdk/client-sts";

export function adminIntegrationEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";

  console.log('[AdminIntegration] ===== REGISTERING ENDPOINTS =====');
  console.log('[AdminIntegration] Base path:', BASE_PATH);

  // Test endpoint to verify registration
  app.get(`${BASE_PATH}/admin/integrations/test`, async (c) => {
    console.log('[AdminIntegration] TEST endpoint hit');
    return c.json({ 
      success: true, 
      message: 'Admin integration endpoints are working!',
      timestamp: new Date().toISOString()
    });
  });

  // ==========================================
  // 1. AWS & GOOGLE MAPS CONFIGURATION
  // ==========================================

  // Get general integration settings (AWS, Google Maps)
  app.get(`${BASE_PATH}/admin/integrations/settings`, async (c) => {
    console.log('[AdminIntegration] ===== GET /admin/integrations/settings CALLED =====');
    console.log('[AdminIntegration] Request path:', c.req.path);
    console.log('[AdminIntegration] Request method:', c.req.method);
    
    try {
      console.log('[AdminIntegration] Fetching AWS settings from KV...');
      const awsSettings = await kv.get('admin:settings:aws');
      console.log('[AdminIntegration] AWS settings fetched:', awsSettings ? 'exists' : 'null/undefined');
      
      const defaultAws = {
        credentials: { accessKeyId: '', secretAccessKey: '', region: 'ap-south-1' },
        s3: { enabled: false, bucket: '', region: '', accessKeyId: '', secretAccessKey: '' },
        sqs: { enabled: false, queueUrl: '', region: '' },
        sns: { enabled: false, topicArn: '', region: '', senderId: '', businessListing: '' },
        ses: { enabled: false, region: '', emailSourceAddress: 'noreply@warmpawz.com' },
        es: { enabled: false, endpoint: '', region: '' }
      };
      
      console.log('[AdminIntegration] Fetching Google Maps settings from KV...');
      const googleMapsSettings = await kv.get('admin:settings:google_maps');
      console.log('[AdminIntegration] Google Maps settings fetched:', googleMapsSettings ? 'exists' : 'null/undefined');
      
      const defaultGoogleMaps = {
        enabled: false,
        apiKey: '',
        region: 'IN',
        language: 'en'
      };

      const response = {
        success: true,
        settings: {
          aws: awsSettings || defaultAws,
          googleMaps: googleMapsSettings || defaultGoogleMaps
        }
      };
      
      console.log('[AdminIntegration] Returning settings response');
      return c.json(response);
    } catch (error) {
      console.error('[AdminIntegration] ERROR in GET settings:', error);
      return c.json({ 
        success: false, 
        error: String(error),
        settings: {
          aws: {
            credentials: { accessKeyId: '', secretAccessKey: '', region: 'ap-south-1' },
            s3: { enabled: false, bucket: '', region: '' }
          },
          googleMaps: { enabled: false, apiKey: '', region: 'IN', language: 'en' }
        }
      }, 500);
    }
  });

  // Save general integration settings
  app.post(`${BASE_PATH}/admin/integrations/settings`, async (c) => {
    console.log('[AdminIntegration] POST /admin/integrations/settings called');
    try {
      const body = await c.req.json();
      const { type, settings } = body; // type = 'aws' or 'googleMaps'

      if (type === 'aws') {
        await kv.set('admin:settings:aws', settings);
      } else if (type === 'googleMaps') {
        await kv.set('admin:settings:google_maps', settings);
      } else {
        return c.json({ success: false, error: 'Invalid setting type' }, 400);
      }

      return c.json({ success: true, message: 'Settings saved successfully' });
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500);
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
          topicArn: settings.sns?.topicArn || '',
          senderId: settings.sns?.senderId || settings.sns?.businessListing || 'WARMP-VX',
          businessListing: settings.sns?.businessListing || settings.sns?.senderId || 'WARMP-VX'
        },
        ses: {
          enabled: settings.ses?.enabled || false,
          region: settings.ses?.region || 'ap-south-1',
          emailSourceAddress: settings.ses?.emailSourceAddress || 'noreply@warmpawz.com'
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
      
      await kv.set('platform:settings:aws', awsSettings);
      
      console.log('✅ AWS settings saved');
      return c.json({ 
        success: true,
        message: 'AWS settings saved successfully',
        settings: awsSettings
      });
    } catch (error) {
      console.error('Error saving AWS settings:', error);
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  // ✅ NEW: Get AWS settings
  app.get(`${BASE_PATH}/admin/settings/aws`, async (c) => {
    try {
      const settings = await kv.get('platform:settings:aws');
      
      const defaultSettings = {
        credentials: { accessKeyId: '', secretAccessKey: '', region: 'ap-south-1' },
        s3: { enabled: false, bucket: '', region: 'ap-south-1' },
        sns: { enabled: false, region: 'ap-south-1', topicArn: '', senderId: 'WARMP-VX', businessListing: 'WARMP-VX' },
        ses: { enabled: false, region: 'ap-south-1', emailSourceAddress: 'noreply@warmpawz.com' },
        sqs: { enabled: false, queueUrl: '', region: 'ap-south-1' },
        chime: { enabled: false, region: 'us-east-1' },
        bedrock: { enabled: false, region: 'us-east-1', modelId: 'anthropic.claude-v2' }
      };
      
      return c.json({
        success: true,
        settings: settings || defaultSettings
      });
    } catch (error) {
      console.error('Error fetching AWS settings:', error);
      return c.json({ success: false, error: String(error) }, 500);
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
      
      await kv.set('platform:settings:google_maps', googleMapsSettings);
      
      console.log('✅ Google Maps settings saved');
      return c.json({ 
        success: true,
        message: 'Google Maps settings saved successfully',
        settings: googleMapsSettings
      });
    } catch (error) {
      console.error('Error saving Google Maps settings:', error);
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  // ✅ NEW: Get Google Maps settings
  app.get(`${BASE_PATH}/admin/settings/google-maps`, async (c) => {
    try {
      const settings = await kv.get('platform:settings:google_maps');
      
      const defaultSettings = {
        enabled: false,
        apiKey: '',
        region: 'IN'
      };
      
      return c.json({
        success: true,
        settings: settings || defaultSettings
      });
    } catch (error) {
      console.error('Error fetching Google Maps settings:', error);
      return c.json({ success: false, error: String(error) }, 500);
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
      
      await kv.set('platform:settings:payment_gateway', paymentGatewaySettings);
      
      console.log('✅ Payment gateway settings updated');
      return c.json({ 
        success: true,
        message: 'Payment gateway settings updated successfully',
        settings: paymentGatewaySettings
      });
    } catch (error) {
      console.error('Error updating payment gateway settings:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ✅ EXISTING: Get payment gateway settings
  app.get(`${BASE_PATH}/admin/settings/payment-gateway`, async (c) => {
    try {
      const settings = await kv.get('platform:settings:payment_gateway');
      
      const defaultSettings = {
        razorpay: { enabled: false, key_id: '', test_mode: true },
        stripe: { enabled: false, test_mode: true },
        paytm: { enabled: false, test_mode: true },
        default_gateway: 'razorpay',
        commission_percentage: 15,
        settlement_period_days: 3
      };
      
      return c.json({
        success: true,
        settings: settings || defaultSettings
      });
    } catch (error) {
      console.error('Error fetching payment gateway settings:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ==========================================
  // 2. PAYMENT GATEWAYS & RULES
  // ==========================================

  // Get all payment gateways
  app.get(`${BASE_PATH}/admin/integrations/payments/gateways`, async (c) => {
    console.log('[AdminIntegration] GET /admin/integrations/payments/gateways called');
    try {
      const gateways = await kv.get('admin:settings:payment_gateways') || [];
      return c.json({ success: true, gateways });
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  // Add or Update Payment Gateway
  app.post(`${BASE_PATH}/admin/integrations/payments/gateways`, async (c) => {
    console.log('[AdminIntegration] POST /admin/integrations/payments/gateways called');
    try {
      const gateway = await c.req.json();
      if (!gateway.id) return c.json({ success: false, error: 'Gateway ID required' }, 400);

      const gateways = await kv.get('admin:settings:payment_gateways') || [];
      const index = gateways.findIndex((g: any) => g.id === gateway.id);

      if (index >= 0) {
        gateways[index] = { ...gateways[index], ...gateway };
      } else {
        gateways.push(gateway);
      }

      await kv.set('admin:settings:payment_gateways', gateways);
      return c.json({ success: true, gateways });
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  // Delete Payment Gateway
  app.delete(`${BASE_PATH}/admin/integrations/payments/gateways/:id`, async (c) => {
    console.log('[AdminIntegration] DELETE /admin/integrations/payments/gateways/:id called');
    try {
      const id = c.req.param('id');
      const gateways = await kv.get('admin:settings:payment_gateways') || [];
      const newGateways = gateways.filter((g: any) => g.id !== id);
      await kv.set('admin:settings:payment_gateways', newGateways);
      return c.json({ success: true, gateways: newGateways });
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  // Get Payout Rules
  app.get(`${BASE_PATH}/admin/integrations/payments/rules`, async (c) => {
    console.log('[AdminIntegration] GET /admin/integrations/payments/rules called');
    try {
      const rules = await kv.get('admin:settings:payout_rules') || {
        defaultCommission: 10,
        holdPeriodDays: 7,
        minimumPayout: 1000,
        autoPayout: true,
        taxRate: 18
      };
      return c.json({ success: true, rules });
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  // Save Payout Rules
  app.post(`${BASE_PATH}/admin/integrations/payments/rules`, async (c) => {
    console.log('[AdminIntegration] POST /admin/integrations/payments/rules called');
    try {
      const rules = await c.req.json();
      await kv.set('admin:settings:payout_rules', rules);
      return c.json({ success: true, rules });
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  // ==========================================
  // 3. LOGISTICS PARTNERS & TERRITORY RULES
  // ==========================================

  // Get Logistics Partners
  app.get(`${BASE_PATH}/admin/integrations/logistics`, async (c) => {
    console.log('[AdminIntegration] GET /admin/integrations/logistics called');
    try {
      const partners = await kv.get('admin:settings:logistics_partners') || [];
      return c.json({ success: true, partners });
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  // Add/Update Logistics Partner
  app.post(`${BASE_PATH}/admin/integrations/logistics`, async (c) => {
    console.log('[AdminIntegration] POST /admin/integrations/logistics called');
    try {
      const partner = await c.req.json();
      if (!partner.id) return c.json({ success: false, error: 'Partner ID required' }, 400);

      const partners = await kv.get('admin:settings:logistics_partners') || [];
      const index = partners.findIndex((p: any) => p.id === partner.id);

      if (index >= 0) {
        partners[index] = { ...partners[index], ...partner };
      } else {
        partners.push(partner);
      }

      await kv.set('admin:settings:logistics_partners', partners);
      return c.json({ success: true, partners });
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  // Get Logistics Rules
  app.get(`${BASE_PATH}/admin/integrations/logistics/rules`, async (c) => {
    console.log('[AdminIntegration] GET /admin/integrations/logistics/rules called');
    try {
      const rules = await kv.get('admin:settings:logistics_rules') || [];
      return c.json({ success: true, rules });
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  // Save Logistics Rules
  app.post(`${BASE_PATH}/admin/integrations/logistics/rules`, async (c) => {
    console.log('[AdminIntegration] POST /admin/integrations/logistics/rules called');
    try {
      const rules = await c.req.json();
      await kv.set('admin:settings:logistics_rules', rules);
      return c.json({ success: true, rules });
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500);
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
      
      await kv.set('platform:settings:logistics', logisticsSettings);
      
      console.log('✅ Logistics settings updated');
      return c.json({
        success: true,
        message: 'Logistics settings updated successfully',
        settings: logisticsSettings
      });
    } catch (error) {
      console.error('Error updating logistics settings:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ✅ NEW: Get logistics settings
  app.get(`${BASE_PATH}/admin/settings/logistics`, async (c) => {
    try {
      const settings = await kv.get('platform:settings:logistics');
      
      const defaultSettings = {
        shiprocket: { enabled: false, test_mode: true },
        delhivery: { enabled: false, test_mode: true },
        bluedart: { enabled: false, test_mode: true },
        default_provider: 'shiprocket',
        warehouse_address: {}
      };
      
      return c.json({
        success: true,
        settings: settings || defaultSettings
      });
    } catch (error) {
      console.error('Error fetching logistics settings:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ==========================================
  // 4. UNIFIED UPLOAD & UTILS
  // ==========================================

  // Unified Upload Handler (Determines destination based on settings)
  app.post(`${BASE_PATH}/upload/unified`, async (c) => {
    console.log('[AdminIntegration] POST /upload/unified called');
    try {
      const formData = await c.req.formData();
      const file = formData.get('file');
      const path = formData.get('path') || 'uploads'; // folder path

      if (!file) return c.json({ success: false, error: 'No file provided' }, 400);

      // 1. Check AWS Settings
      const awsSettings = await kv.get('admin:settings:aws');
      
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
          
          return c.json({
            success: true,
            url: s3Url,
            provider: 'aws_s3',
            bucket: bucket
          });
          
        } catch (s3Error) {
          console.error('❌ [UPLOAD] S3 Error:', s3Error);
          // Fallback to simulate if S3 fails? Or error out? 
          // Better to error out if configured but failed.
          return c.json({ success: false, error: 'S3 Upload Failed: ' + String(s3Error) }, 500);
        }
      }

      // 3. Fallback to Supabase Storage (Simulated or using existing storage logic)
      // For this demo, we'll assume the client handles the Supabase upload if S3 is off,
      // OR we return a flag telling the client where to upload.
      
      return c.json({
        success: true,
        provider: 'supabase_storage',
        message: 'S3 not enabled, use Supabase Storage'
      });

    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  // ==========================================
  // 5. CONNECTION TESTING
  // ==========================================

  app.post(`${BASE_PATH}/admin/integrations/test-connection`, async (c) => {
    console.log('[AdminIntegration] POST /admin/integrations/test-connection called');
    try {
      const { type, config } = await c.req.json();

      if (type === 'googleMaps') {
        if (!config.apiKey) return c.json({ success: false, error: 'API Key missing' });
        
        // Test Geocoding API
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=New+Delhi&key=${config.apiKey}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.status === 'OK') {
           return c.json({ success: true, message: 'Google Maps API connected successfully', details: data.results?.[0]?.formatted_address });
        } else {
           return c.json({ success: false, error: `Google Maps Error: ${data.status}`, details: data.error_message });
        }
      }

      if (type === 's3' || type === 'aws_iam') {
        if (!config.accessKeyId || !config.secretAccessKey) return c.json({ success: false, error: 'AWS Credentials missing' });

        const region = config.region || 'ap-south-1';
        const cleanAccessKeyId = String(config.accessKeyId).trim();
        const cleanSecretAccessKey = String(config.secretAccessKey).trim();
        
        if (!cleanAccessKeyId.startsWith('AKIA') && !cleanAccessKeyId.startsWith('ASIA')) {
             return c.json({ success: false, error: 'Invalid Access Key ID format. Should start with AKIA or ASIA.' });
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
                return c.json({ 
                    success: true, 
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
                
                return c.json({ 
                    success: true, 
                    message: `AWS S3 Connected. Found ${buckets.Buckets?.length} buckets.`,
                    details: `Buckets: ${bucketNames}...`
                });
            }

        } catch (awsError) {
            console.error('AWS Test Error:', awsError);
            const msg = String(awsError);
            if (msg.includes('InvalidAccessKeyId')) return c.json({ success: false, error: 'Invalid Access Key ID' });
            if (msg.includes('SignatureDoesNotMatch')) return c.json({ success: false, error: 'Invalid Secret Access Key' });
            return c.json({ success: false, error: `AWS Connection Failed: ${msg}` });
        }
      }

      return c.json({ success: false, error: 'Unknown test type' });
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500);
    }
  });
}