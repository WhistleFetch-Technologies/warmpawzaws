/**
 * ============================================================================
 * KYC VERIFICATION CLIENT UTILITY
 * ============================================================================
 * 
 * Centralized KYC verification API client for Aadhaar, PAN, and GST verification
 * Supports multiple providers: Sandbox, Signzy, IDfy, Karza
 * 
 * Date: 2026-01-28
 * ============================================================================
 */

import { query, select, insert, update } from '../database/rds-connection';
import { getSecretJson } from './secrets-manager';

// ============================================================================
// TYPES
// ============================================================================

export type KYCProvider = 'sandbox' | 'signzy' | 'idfy' | 'karza';

// ============================================================================
// ACCESS TOKEN MANAGEMENT (for Sandbox.co)
// ============================================================================

interface AccessTokenCache {
  token: string;
  expiresAt: number;
}

// In-memory cache for access tokens (valid for 24 hours, we refresh after 23 hours)
let sandboxAccessTokenCache: AccessTokenCache | null = null;
const TOKEN_REFRESH_BUFFER_MS = 60 * 60 * 1000; // Refresh 1 hour before expiry

/**
 * Get or refresh Sandbox.co access token
 * Tokens are valid for 24 hours, cached in memory
 */
async function getSandboxAccessToken(config: KYCConfig): Promise<string> {
  // Check if we have a valid cached token
  if (sandboxAccessTokenCache && Date.now() < sandboxAccessTokenCache.expiresAt - TOKEN_REFRESH_BUFFER_MS) {
    console.log('[SANDBOX-AUTH] Using cached access token');
    return sandboxAccessTokenCache.token;
  }

  console.log('[SANDBOX-AUTH] Generating new access token...');
  
  try {
    const response = await fetch(`${config.baseUrl}/authenticate`, {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'x-api-secret': config.apiSecret,
        'x-api-version': '1.0.0',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[SANDBOX-AUTH] Authentication failed:', error);
      throw new Error(`Sandbox authentication failed: ${error?.message || response.statusText}`);
    }

    const result = await response.json();
    const accessToken = result.data?.access_token || result.access_token;
    
    if (!accessToken) {
      throw new Error('No access token in authentication response');
    }

    // Cache the token (24 hour validity)
    sandboxAccessTokenCache = {
      token: accessToken,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
    };

    console.log('[SANDBOX-AUTH] Access token generated and cached');
    return accessToken;
  } catch (error: any) {
    console.error('[SANDBOX-AUTH] Error getting access token:', error.message);
    throw error;
  }
}

export interface KYCConfig {
  provider: KYCProvider;
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  aadhaarApiUrl?: string;
  panApiUrl?: string;
  gstApiUrl?: string;
  enabled: boolean;
}

export interface AadhaarOTPRequest {
  aadhaarNumber: string;
}

export interface AadhaarOTPResponse {
  success: boolean;
  requestId: string;
  message: string;
  expiresIn?: number; // OTP validity in seconds
}

export interface AadhaarVerifyOTPRequest {
  requestId: string;
  otp: string;
}

export interface AadhaarVerifyOTPResponse {
  success: boolean;
  verified: boolean;
  data?: {
    name: string;
    dob?: string;
    gender?: string;
    address?: {
      house?: string;
      street?: string;
      landmark?: string;
      locality?: string;
      district?: string;
      state?: string;
      pincode?: string;
    };
    photo?: string; // Base64 encoded photo
    maskedAadhaar: string; // XXXX XXXX 1234
  };
  message?: string;
  error?: string;
}

export interface PANVerifyRequest {
  panNumber: string;
  name?: string; // Optional name for matching
}

export interface PANVerifyResponse {
  success: boolean;
  verified: boolean;
  data?: {
    panNumber: string;
    name: string;
    status: 'active' | 'inactive' | 'unknown';
    nameMatchScore?: number; // 0-100 percentage
    category?: string; // Individual, Company, etc.
  };
  message?: string;
  error?: string;
}

export interface GSTVerifyRequest {
  gstin: string;
}

export interface GSTVerifyResponse {
  success: boolean;
  verified: boolean;
  data?: {
    gstin: string;
    legalName: string;
    tradeName?: string;
    status: 'Active' | 'Cancelled' | 'Suspended' | 'unknown';
    stateCode: string;
    stateName: string;
    registrationDate?: string;
    businessType?: string;
    address?: string;
  };
  message?: string;
  error?: string;
}

// ============================================================================
// PROVIDER BASE URLS
// ============================================================================

const PROVIDER_BASE_URLS: Record<KYCProvider, string> = {
  sandbox: 'https://api.sandbox.co.in',
  signzy: 'https://preproduction.signzy.tech',
  idfy: 'https://eve.idfy.com',
  karza: 'https://api.karza.in',
};

// ============================================================================
// CONFIG RETRIEVAL (3-tier fallback)
// ============================================================================

/**
 * Get KYC provider configuration from AWS Secrets Manager (primary) or database/env (fallback)
 */
export async function getKYCConfig(): Promise<KYCConfig> {
  // PRIMARY: Try AWS Secrets Manager first (with timeout)
  try {
    const secretConfig = await Promise.race([
      getSecretJson<KYCConfig>('kyc-provider'),
      new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Secrets Manager timeout')), 5000)
      )
    ]).catch((error) => {
      if (error.message === 'Secrets Manager timeout') {
        console.warn('[KYC-CONFIG] Secrets Manager timeout, using fallback');
        return null;
      }
      throw error;
    });
    
    if (secretConfig && secretConfig.apiKey) {
      console.log('[KYC-CONFIG] Loaded from AWS Secrets Manager');
      return {
        ...secretConfig,
        baseUrl: secretConfig.baseUrl || PROVIDER_BASE_URLS[secretConfig.provider] || PROVIDER_BASE_URLS.sandbox,
        enabled: secretConfig.enabled !== false,
      };
    }
  } catch (error: any) {
    console.warn('[KYC-CONFIG] Failed to load from Secrets Manager, trying fallback:', error.message);
  }

  // FALLBACK 1: Try database (platform_settings or platform_integrations)
  try {
    // Try platform_settings first
    const settings = await select('platform_settings', {
      setting_key: 'platform:integrations:kyc',
    });

    if (settings.length > 0 && settings[0].setting_value) {
      const config = typeof settings[0].setting_value === 'string' 
        ? JSON.parse(settings[0].setting_value) 
        : settings[0].setting_value;
        
      if (config.apiKey) {
        console.log('[KYC-CONFIG] Loaded from platform_settings');
        return {
          ...config,
          baseUrl: config.baseUrl || PROVIDER_BASE_URLS[config.provider] || PROVIDER_BASE_URLS.sandbox,
          enabled: config.enabled !== false,
        };
      }
    }

    // Try platform_integrations
    const integrations = await select('platform_integrations', {
      integration_name: 'kyc',
    });

    if (integrations.length > 0 && integrations[0].integration_config) {
      const config = integrations[0].integration_config as any;
      if (config.apiKey) {
        console.log('[KYC-CONFIG] Loaded from platform_integrations');
        return {
          ...config,
          baseUrl: config.baseUrl || PROVIDER_BASE_URLS[config.provider] || PROVIDER_BASE_URLS.sandbox,
          enabled: integrations[0].is_enabled !== false,
        };
      }
    }
  } catch (error: any) {
    console.warn('[KYC-CONFIG] Failed to load from database, trying env vars:', error.message);
  }

  // FALLBACK 2: Try environment variables
  const provider = (process.env.KYC_PROVIDER || 'sandbox') as KYCProvider;
  const apiKey = process.env.KYC_API_KEY;
  const apiSecret = process.env.KYC_API_SECRET;

  if (apiKey) {
    console.log('[KYC-CONFIG] Loaded from environment variables');
    return {
      provider,
      apiKey,
      apiSecret: apiSecret || '',
      baseUrl: process.env.KYC_BASE_URL || PROVIDER_BASE_URLS[provider],
      aadhaarApiUrl: process.env.KYC_AADHAAR_URL,
      panApiUrl: process.env.KYC_PAN_URL,
      gstApiUrl: process.env.KYC_GST_URL,
      enabled: process.env.KYC_ENABLED !== 'false',
    };
  }

  // Return sandbox config for development/testing
  console.warn('[KYC-CONFIG] No configuration found, using sandbox mock mode');
  return {
    provider: 'sandbox',
    apiKey: 'mock_key',
    apiSecret: 'mock_secret',
    baseUrl: PROVIDER_BASE_URLS.sandbox,
    enabled: false, // Disabled by default - will use mock responses
  };
}

// ============================================================================
// HTTP REQUEST HELPER
// ============================================================================

/**
 * Make KYC API request with timeout handling
 */
export async function kycRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' = 'POST',
  body?: any,
  timeoutMs: number = 30000
): Promise<T> {
  const config = await getKYCConfig();
  
  // If KYC is disabled, throw error
  if (!config.enabled) {
    throw new Error('KYC verification service is not configured. Please contact administrator.');
  }
  
  const url = endpoint.startsWith('http') ? endpoint : `${config.baseUrl}${endpoint}`;
  
  console.log(`[KYC-REQUEST] ${method} ${endpoint} (provider: ${config.provider}, timeout: ${timeoutMs}ms)`);

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn(`[KYC-REQUEST] Timeout after ${timeoutMs}ms for ${endpoint}`);
    controller.abort();
  }, timeoutMs);

  try {
    const startTime = Date.now();
    
    // Get access token for Sandbox provider (required for all API calls)
    let accessToken: string | undefined;
    if (config.provider === 'sandbox') {
      accessToken = await getSandboxAccessToken(config);
    }
    
    // Build headers based on provider
    const headers = buildAuthHeaders(config, accessToken);
    
    const response = await fetch(url, {
      method,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;
    console.log(`[KYC-REQUEST] Response received in ${duration}ms for ${endpoint}`);

    if (!response.ok) {
      const error: any = await response.json().catch(() => ({}));
      const errorMsg = error?.message || error?.error?.description || response.statusText || 'Unknown error';
      console.error(`[KYC-REQUEST] API error (${response.status}): ${errorMsg}`);
      throw new Error(`KYC API error: ${errorMsg}`);
    }

    const result = await response.json();
    console.log(`[KYC-REQUEST] Success for ${endpoint}`);
    return result as T;
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      console.error(`[KYC-REQUEST] Request timed out for ${endpoint}`);
      throw new Error('KYC verification request timed out. Please try again.');
    }
    
    console.error(`[KYC-REQUEST] Error for ${endpoint}:`, error.message);
    throw error;
  }
}

/**
 * Build authentication headers based on provider
 * Note: For Sandbox, accessToken must be passed separately as it requires async fetch
 */
function buildAuthHeaders(config: KYCConfig, accessToken?: string): Record<string, string> {
  switch (config.provider) {
    case 'sandbox':
      if (!accessToken) {
        throw new Error('Access token required for Sandbox provider');
      }
      return {
        'authorization': accessToken, // JWT access token (no "Bearer" prefix per Sandbox docs)
        'x-api-key': config.apiKey,
        'x-api-version': '1.0',
      };
      
    case 'signzy':
      return {
        'Authorization': `Bearer ${config.apiKey}`,
      };
      
    case 'idfy':
      return {
        'api-key': config.apiKey,
        'account-id': config.apiSecret,
      };
      
    case 'karza':
      return {
        'x-karza-key': config.apiKey,
      };
      
    default:
      return {
        'Authorization': `Bearer ${config.apiKey}`,
      };
  }
}

// ============================================================================
// AADHAAR VERIFICATION
// ============================================================================

/**
 * Generate OTP for Aadhaar verification
 */
export async function generateAadhaarOTP(request: AadhaarOTPRequest): Promise<AadhaarOTPResponse> {
  const config = await getKYCConfig();
  
  // Validate Aadhaar number format
  if (!/^[0-9]{12}$/.test(request.aadhaarNumber)) {
    return {
      success: false,
      requestId: '',
      message: 'Invalid Aadhaar number. Please enter a valid 12-digit Aadhaar number.',
    };
  }
  
  // If not enabled, return mock response for testing
  if (!config.enabled) {
    console.log('[AADHAAR-OTP] Mock mode - returning test response');
    return {
      success: true,
      requestId: `mock_${Date.now()}_${request.aadhaarNumber.slice(-4)}`,
      message: 'OTP sent to registered mobile number (mock mode)',
      expiresIn: 600,
    };
  }
  
  try {
    // Provider-specific endpoints
    const endpoints: Record<KYCProvider, string> = {
      sandbox: '/kyc/aadhaar/okyc/otp',
      signzy: '/api/v2/aadhaar/otp',
      idfy: '/v3/tasks/async/verify_with_source/ind_aadhaar',
      karza: '/v3/aadhaar-xml/otp',
    };
    
    const endpoint = config.aadhaarApiUrl || endpoints[config.provider];
    
    // Provider-specific request body
    const body = buildAadhaarOTPRequestBody(config.provider, request);
    
    const response = await kycRequest<any>(endpoint, 'POST', body);
    
    // Normalize response across providers
    return normalizeAadhaarOTPResponse(config.provider, response);
  } catch (error: any) {
    console.error('[AADHAAR-OTP] Error generating OTP:', error.message);
    return {
      success: false,
      requestId: '',
      message: error.message || 'Failed to generate OTP. Please try again.',
    };
  }
}

/**
 * Verify Aadhaar OTP
 */
export async function verifyAadhaarOTP(request: AadhaarVerifyOTPRequest): Promise<AadhaarVerifyOTPResponse> {
  const config = await getKYCConfig();
  
  // Validate inputs
  if (!request.requestId || !request.otp) {
    return {
      success: false,
      verified: false,
      error: 'Request ID and OTP are required',
    };
  }
  
  // If not enabled, return mock response for testing
  if (!config.enabled) {
    console.log('[AADHAAR-VERIFY] Mock mode - returning test response');
    
    // For mock mode, accept OTP "123456"
    if (request.otp === '123456') {
      return {
        success: true,
        verified: true,
        data: {
          name: 'Test User',
          dob: '1990-01-01',
          gender: 'M',
          address: {
            house: '123',
            street: 'Test Street',
            locality: 'Test Locality',
            district: 'Test District',
            state: 'Test State',
            pincode: '123456',
          },
          maskedAadhaar: 'XXXX XXXX 1234',
        },
        message: 'Aadhaar verified successfully (mock mode)',
      };
    }
    
    return {
      success: false,
      verified: false,
      error: 'Invalid OTP (mock mode - use 123456)',
    };
  }
  
  try {
    // Provider-specific endpoints
    const endpoints: Record<KYCProvider, string> = {
      sandbox: '/kyc/aadhaar/okyc/otp/verify',
      signzy: '/api/v2/aadhaar/verify',
      idfy: '/v3/tasks',
      karza: '/v3/aadhaar-xml/submit-otp',
    };
    
    const endpoint = endpoints[config.provider];
    
    // Provider-specific request body
    const body = buildAadhaarVerifyRequestBody(config.provider, request);
    
    const response = await kycRequest<any>(endpoint, 'POST', body);
    
    // Normalize response across providers
    return normalizeAadhaarVerifyResponse(config.provider, response);
  } catch (error: any) {
    console.error('[AADHAAR-VERIFY] Error verifying OTP:', error.message);
    return {
      success: false,
      verified: false,
      error: error.message || 'Failed to verify OTP. Please try again.',
    };
  }
}

// ============================================================================
// PAN VERIFICATION
// ============================================================================

/**
 * Verify PAN number
 */
export async function verifyPAN(request: PANVerifyRequest): Promise<PANVerifyResponse> {
  const config = await getKYCConfig();
  
  // Validate PAN format
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  const normalizedPAN = request.panNumber.toUpperCase().trim();
  
  if (!panRegex.test(normalizedPAN)) {
    return {
      success: false,
      verified: false,
      error: 'Invalid PAN format. Please enter a valid PAN number (e.g., ABCDE1234F).',
    };
  }
  
  // If not enabled, return mock response for testing
  if (!config.enabled) {
    console.log('[PAN-VERIFY] Mock mode - returning test response');
    return {
      success: true,
      verified: true,
      data: {
        panNumber: normalizedPAN,
        name: 'TEST USER',
        status: 'active',
        nameMatchScore: request.name ? 85 : undefined,
        category: 'Individual',
      },
      message: 'PAN verified successfully (mock mode)',
    };
  }
  
  try {
    // Provider-specific endpoints (Sandbox changed from GET /pans/{pan} to POST /kyc/pan/verify)
    const endpoints: Record<KYCProvider, string> = {
      sandbox: '/kyc/pan/verify',
      signzy: '/api/v2/pancard/verify',
      idfy: '/v3/tasks/sync/verify_with_source/ind_pan',
      karza: '/v3/pan-verify',
    };
    
    const endpoint = config.panApiUrl || endpoints[config.provider];
    
    // Provider-specific request body (all providers now use POST)
    const body = buildPANVerifyRequestBody(config.provider, { ...request, panNumber: normalizedPAN });
    
    const response = await kycRequest<any>(endpoint, 'POST', body);
    
    // Normalize response across providers
    return normalizePANVerifyResponse(config.provider, response, request.name);
  } catch (error: any) {
    console.error('[PAN-VERIFY] Error verifying PAN:', error.message);
    return {
      success: false,
      verified: false,
      error: error.message || 'Failed to verify PAN. Please try again.',
    };
  }
}

// ============================================================================
// GST VERIFICATION
// ============================================================================

/**
 * Verify GST number
 */
export async function verifyGST(request: GSTVerifyRequest): Promise<GSTVerifyResponse> {
  const config = await getKYCConfig();
  
  // Validate GSTIN format
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  const normalizedGST = request.gstin.toUpperCase().trim();
  
  if (!gstRegex.test(normalizedGST)) {
    return {
      success: false,
      verified: false,
      error: 'Invalid GSTIN format. Please enter a valid 15-character GSTIN.',
    };
  }
  
  // If not enabled, return mock response for testing
  if (!config.enabled) {
    console.log('[GST-VERIFY] Mock mode - returning test response');
    return {
      success: true,
      verified: true,
      data: {
        gstin: normalizedGST,
        legalName: 'TEST BUSINESS PVT LTD',
        tradeName: 'Test Business',
        status: 'Active',
        stateCode: normalizedGST.substring(0, 2),
        stateName: 'Test State',
        registrationDate: '2020-01-01',
        businessType: 'Private Limited Company',
        address: '123 Test Address, Test City, Test State - 123456',
      },
      message: 'GST verified successfully (mock mode)',
    };
  }
  
  try {
    // Provider-specific endpoints
    const endpoints: Record<KYCProvider, string> = {
      sandbox: '/gst/search/' + normalizedGST,
      signzy: '/api/v2/gst/verify',
      idfy: '/v3/tasks/sync/verify_with_source/ind_gstin',
      karza: '/v3/gst-verify',
    };
    
    const endpoint = config.gstApiUrl || endpoints[config.provider];
    
    // Provider-specific request body
    const body = buildGSTVerifyRequestBody(config.provider, { gstin: normalizedGST });
    
    const response = await kycRequest<any>(
      endpoint,
      config.provider === 'sandbox' ? 'GET' : 'POST',
      config.provider === 'sandbox' ? undefined : body
    );
    
    // Normalize response across providers
    return normalizeGSTVerifyResponse(config.provider, response);
  } catch (error: any) {
    console.error('[GST-VERIFY] Error verifying GST:', error.message);
    return {
      success: false,
      verified: false,
      error: error.message || 'Failed to verify GST. Please try again.',
    };
  }
}

// ============================================================================
// PROVIDER-SPECIFIC REQUEST BUILDERS
// ============================================================================

function buildAadhaarOTPRequestBody(provider: KYCProvider, request: AadhaarOTPRequest): any {
  switch (provider) {
    case 'sandbox':
      // Updated format per Sandbox.co API docs - requires consent and reason
      return { 
        '@entity': 'in.co.sandbox.kyc.aadhaar.okyc.otp.request', 
        aadhaar_number: request.aadhaarNumber,
        consent: 'Y',
        reason: 'KYC verification for vendor onboarding',
      };
    case 'signzy':
      return { aadhaarNo: request.aadhaarNumber };
    case 'idfy':
      return { task_id: `aadhaar_${Date.now()}`, group_id: 'default', data: { aadhaar_number: request.aadhaarNumber } };
    case 'karza':
      return { aadhaarNo: request.aadhaarNumber, consent: 'Y' };
    default:
      return { aadhaarNumber: request.aadhaarNumber };
  }
}

function buildAadhaarVerifyRequestBody(provider: KYCProvider, request: AadhaarVerifyOTPRequest): any {
  switch (provider) {
    case 'sandbox':
      // Updated format per Sandbox.co API docs
      return { 
        '@entity': 'in.co.sandbox.kyc.aadhaar.okyc.otp.verify.request', 
        reference_id: parseInt(request.requestId, 10) || request.requestId, 
        otp: request.otp,
      };
    case 'signzy':
      return { requestId: request.requestId, otp: request.otp };
    case 'idfy':
      return { request_id: request.requestId, otp: request.otp };
    case 'karza':
      return { requestId: request.requestId, otp: request.otp };
    default:
      return { requestId: request.requestId, otp: request.otp };
  }
}

function buildPANVerifyRequestBody(provider: KYCProvider, request: PANVerifyRequest): any {
  switch (provider) {
    case 'sandbox':
      // Updated format per Sandbox.co API docs - now uses POST with required fields
      return { 
        '@entity': 'in.co.sandbox.kyc.pan_verification.request',
        pan: request.panNumber,
        name_as_per_pan: request.name || 'NA', // Required field
        date_of_birth: '01/01/1990', // Required field - using placeholder since we don't collect DOB for PAN-only verification
        consent: 'Y',
        reason: 'KYC verification for vendor onboarding',
      };
    case 'signzy':
      return { pan: request.panNumber, name: request.name };
    case 'idfy':
      return { task_id: `pan_${Date.now()}`, data: { pan_number: request.panNumber, name_as_per_pan: request.name } };
    case 'karza':
      return { pan: request.panNumber, consent: 'Y', name: request.name };
    default:
      return { panNumber: request.panNumber, name: request.name };
  }
}

function buildGSTVerifyRequestBody(provider: KYCProvider, request: GSTVerifyRequest): any {
  switch (provider) {
    case 'sandbox':
      return null; // Sandbox uses GET with GSTIN in URL
    case 'signzy':
      return { gstin: request.gstin };
    case 'idfy':
      return { task_id: `gst_${Date.now()}`, data: { gstin: request.gstin } };
    case 'karza':
      return { gstin: request.gstin, consent: 'Y' };
    default:
      return { gstin: request.gstin };
  }
}

// ============================================================================
// PROVIDER-SPECIFIC RESPONSE NORMALIZERS
// ============================================================================

function normalizeAadhaarOTPResponse(provider: KYCProvider, response: any): AadhaarOTPResponse {
  switch (provider) {
    case 'sandbox':
      // Updated response format: { code, timestamp, data: { reference_id, message }, transaction_id }
      const sandboxOTPData = response.data || response;
      const isSuccess = response.code === 200;
      const message = sandboxOTPData.message || response.message || 'OTP sent successfully';
      
      // Handle error responses (e.g., "Invalid Aadhaar Card")
      if (isSuccess && message.toLowerCase().includes('invalid')) {
        return {
          success: false,
          requestId: '',
          message: message,
        };
      }
      
      return {
        success: isSuccess,
        requestId: String(sandboxOTPData.reference_id || response.reference_id || ''),
        message: message,
        expiresIn: 600,
      };
    case 'signzy':
      return {
        success: response.result?.success === true,
        requestId: response.result?.requestId || '',
        message: response.result?.message || 'OTP sent successfully',
        expiresIn: 600,
      };
    case 'idfy':
      return {
        success: response.status === 'completed',
        requestId: response.request_id || '',
        message: 'OTP sent successfully',
        expiresIn: 600,
      };
    case 'karza':
      return {
        success: response.statusCode === 101,
        requestId: response.requestId || '',
        message: response.message || 'OTP sent successfully',
        expiresIn: 600,
      };
    default:
      return {
        success: true,
        requestId: response.requestId || response.reference_id || '',
        message: 'OTP sent successfully',
        expiresIn: 600,
      };
  }
}

function normalizeAadhaarVerifyResponse(provider: KYCProvider, response: any): AadhaarVerifyOTPResponse {
  switch (provider) {
    case 'sandbox':
      const sandboxData = response.data || response;
      return {
        success: response.code === 200 || response.status === 'SUCCESS',
        verified: sandboxData.status === 'VALID',
        data: sandboxData.status === 'VALID' ? {
          name: sandboxData.name || sandboxData.full_name,
          dob: sandboxData.dob || sandboxData.date_of_birth,
          gender: sandboxData.gender,
          address: {
            house: sandboxData.split_address?.house,
            street: sandboxData.split_address?.street,
            locality: sandboxData.split_address?.vtc || sandboxData.split_address?.locality,
            district: sandboxData.split_address?.district,
            state: sandboxData.split_address?.state,
            pincode: sandboxData.split_address?.pincode || sandboxData.zip,
          },
          maskedAadhaar: sandboxData.aadhaar_number ? `XXXX XXXX ${sandboxData.aadhaar_number.slice(-4)}` : '',
        } : undefined,
        message: response.message,
      };
      
    case 'signzy':
      const signzyData = response.result;
      return {
        success: signzyData?.success === true,
        verified: signzyData?.verified === true,
        data: signzyData?.verified ? {
          name: signzyData.name,
          dob: signzyData.dob,
          gender: signzyData.gender,
          address: signzyData.address,
          maskedAadhaar: signzyData.maskedAadhaar,
        } : undefined,
        message: signzyData?.message,
      };
      
    case 'idfy':
    case 'karza':
    default:
      return {
        success: response.success !== false,
        verified: response.verified === true || response.status === 'verified',
        data: response.data || response.result,
        message: response.message,
      };
  }
}

function normalizePANVerifyResponse(provider: KYCProvider, response: any, inputName?: string): PANVerifyResponse {
  switch (provider) {
    case 'sandbox':
      // Updated response format: { code, timestamp, data: { pan, category, status, remarks, ... }, transaction_id }
      const sandboxPAN = response.data || response;
      const panStatus = sandboxPAN.status?.toLowerCase();
      const isValid = panStatus === 'valid';
      
      return {
        success: response.code === 200,
        verified: isValid,
        data: {
          panNumber: sandboxPAN.pan || '',
          name: inputName || '', // New API doesn't return name, only validates match
          status: isValid ? 'active' : 'inactive',
          nameMatchScore: sandboxPAN.name_as_per_pan_match === true ? 100 : 
                          sandboxPAN.name_as_per_pan_match === false ? 0 : undefined,
          category: sandboxPAN.category ? capitalizeFirst(sandboxPAN.category.replace(/_/g, ' ')) : 'Individual',
        },
        message: sandboxPAN.remarks || (isValid ? 'PAN verified successfully' : 'PAN verification failed'),
      };
      
    case 'signzy':
    case 'idfy':
    case 'karza':
    default:
      const data = response.result || response.data || response;
      const name = data.name || data.registeredName || '';
      return {
        success: response.success !== false,
        verified: data.valid === true || data.status === 'VALID' || data.status === 'Active',
        data: {
          panNumber: data.pan || data.panNumber || '',
          name: name,
          status: data.status === 'VALID' || data.valid ? 'active' : 'inactive',
          nameMatchScore: inputName ? calculateNameMatchScore(inputName, name) : undefined,
          category: data.category,
        },
        message: response.message,
      };
  }
}

/**
 * Capitalize first letter of each word
 */
function capitalizeFirst(str: string): string {
  return str.split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
}

function normalizeGSTVerifyResponse(provider: KYCProvider, response: any): GSTVerifyResponse {
  const data = response.data || response.result || response;
  
  return {
    success: response.code === 200 || response.success !== false || data.gstin,
    verified: data.status === 'Active' || data.sts === 'Active' || data.gstStatus === 'Active',
    data: {
      gstin: data.gstin || data.gstinNo || '',
      legalName: data.lgnm || data.legalName || data.legal_name || '',
      tradeName: data.tradeNam || data.tradeName || data.trade_name || '',
      status: data.status || data.sts || data.gstStatus || 'unknown',
      stateCode: data.stj || data.stateCode || (data.gstin ? data.gstin.substring(0, 2) : ''),
      stateName: data.stateName || getStateNameFromCode(data.gstin ? data.gstin.substring(0, 2) : ''),
      registrationDate: data.rgdt || data.registrationDate || data.registration_date,
      businessType: data.ctb || data.businessType || data.constitution_of_business,
      address: data.pradr?.addr || data.principalAddress || data.address,
    },
    message: response.message || 'GST verified',
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate name match score (simple implementation)
 */
function calculateNameMatchScore(inputName: string, verifiedName: string): number {
  if (!inputName || !verifiedName) return 0;
  
  const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
  const input = normalize(inputName);
  const verified = normalize(verifiedName);
  
  if (input === verified) return 100;
  if (verified.includes(input) || input.includes(verified)) return 85;
  
  // Simple Levenshtein-based similarity
  const longer = input.length > verified.length ? input : verified;
  const shorter = input.length > verified.length ? verified : input;
  
  if (longer.length === 0) return 100;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return Math.round(((longer.length - editDistance) / longer.length) * 100);
}

/**
 * Levenshtein distance for string similarity
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Get state name from GST state code
 */
function getStateNameFromCode(stateCode: string): string {
  const stateMap: Record<string, string> = {
    '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
    '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
    '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
    '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
    '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
    '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam',
    '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha',
    '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
    '26': 'Dadra and Nagar Haveli', '27': 'Maharashtra', '29': 'Karnataka',
    '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala',
    '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman and Nicobar Islands',
    '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh',
  };
  
  return stateMap[stateCode] || 'Unknown';
}

/**
 * Mask Aadhaar number for display
 */
export function maskAadhaarNumber(aadhaar: string): string {
  if (!aadhaar || aadhaar.length !== 12) return '';
  return `XXXX XXXX ${aadhaar.slice(-4)}`;
}

/**
 * Log KYC verification attempt to audit log
 */
export async function logKYCVerification(
  vendorId: string,
  verificationType: 'aadhaar' | 'pan' | 'gst' | 'police' | 'professional' | 'awbi',
  action: string,
  success: boolean,
  requestData?: any,
  responseData?: any,
  errorMessage?: string,
  ipAddress?: string
): Promise<void> {
  try {
    const config = await getKYCConfig();
    
    // Sanitize sensitive data before logging
    const sanitizedRequest = requestData ? {
      ...requestData,
      aadhaarNumber: requestData.aadhaarNumber ? maskAadhaarNumber(requestData.aadhaarNumber) : undefined,
      panNumber: requestData.panNumber ? `${requestData.panNumber.slice(0, 2)}XXXXX${requestData.panNumber.slice(-2)}` : undefined,
    } : null;
    
    await insert('kyc_verification_audit_log', {
      vendor_id: vendorId,
      verification_type: verificationType,
      action,
      request_data: sanitizedRequest,
      response_data: responseData ? { verified: responseData.verified, message: responseData.message } : null,
      success,
      error_message: errorMessage,
      provider: config.provider,
      ip_address: ipAddress,
    });
  } catch (error: any) {
    console.error('[KYC-AUDIT] Failed to log verification:', error.message);
    // Don't throw - audit logging should not break the main flow
  }
}
