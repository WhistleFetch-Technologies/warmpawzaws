'use client';

import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, MapPin, AlertCircle, CheckCircle2, ArrowLeft, X, User, Check } from 'lucide-react';
// Uses apiClient (API Gateway)
import { toast } from 'sonner';
// KYC verification components
import { AadhaarOTPVerification, PANVerification, GSTVerification, DeclarationField } from '../kyc';

interface FormField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'tel' | 'textarea' | 'select' | 'multiselect' | 'checkbox' | 'radio' | 'date' | 'file' | 'map_pin' | 'aadhaar-otp' | 'pan-verify' | 'gst-verify' | 'declaration';
  section: string;
  placeholder?: string;
  helpText?: string;
  defaultValue?: any;
  validation?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    min?: number;
    max?: number;
  };
  options?: { value: string; label: string }[];
  requiresDocument?: boolean;
  documentType?: string;
  documentLabel?: string;
  acceptedFileTypes?: string[];
  order: number;
  isActive: boolean;
  // KYC-specific fields
  requiresVerification?: boolean;
  verificationEndpoint?: string;
  declarationText?: string;
  declarationType?: string;
  softBlock?: boolean;
}

interface FormSection {
  id: string;
  name: string;
  title: string;
  description?: string;
  icon?: string;
  order: number;
  isActive: boolean;
  fields: FormField[];
}

interface OnboardingForm {
  id: string;
  roleId: string;
  roleName: string;
  version: number;
  status: string;
  sections: FormSection[];
  documentSections: FormSection[];
}

interface DynamicVendorOnboardingFormProps {
  roleId: string;
  onSubmit: (data: any) => void;
  onBack?: () => void;
  serviceStyles?: string[];
  initialData?: any; // ✅ NEW: Support for re-editing
  vendorId?: string; // ✅ NEW: For edit mode
  isEditMode?: boolean; // ✅ NEW: Flag for edit vs create
}

// ✅ FIX: Extract default policies as a constant to avoid TDZ (Temporal Dead Zone) issues
// This prevents "Cannot access 'p' before initialization" errors when fetchPolicies references policies
const DEFAULT_POLICIES = {
  vendorOnboardingAgreement: {
    title: 'Vendor Onboarding Agreement',
    content: `VENDOR ONBOARDING AGREEMENT

1. SERVICE STANDARDS
   - The vendor agrees to provide services as per the platform standards and guidelines.
   - All services must meet the quality benchmarks set by the platform.

2. INFORMATION ACCURACY
   - All information provided during onboarding must be accurate, complete, and verifiable.
   - Any misrepresentation may result in immediate termination of the vendor account.

3. DOCUMENTATION REQUIREMENTS
   - The vendor must complete all required documents and certifications as mandated by applicable laws.
   - Professional licenses and certifications must be kept current and valid.

4. SERVICE ACTIVATION
   - Services will be activated only after successful verification and admin approval.
   - The platform reserves the right to conduct periodic reviews of vendor credentials.`,
  },
  termsOfService: {
    title: 'Terms of Service',
    content: `TERMS OF SERVICE

1. PLATFORM RIGHTS
   - The platform reserves the right to approve or reject vendor applications at its sole discretion.
   - Approval decisions are final and may not be appealed.

2. BOOKING VERIFICATION
   - All bookings are subject to customer OTP verification before service commencement.
   - Services must not begin until proper verification is completed.

3. SERVICE REPORTING
   - Vendors must provide detailed service reports after each booking completion.
   - Failure to submit reports may delay payment processing.

4. PAYMENT SETTLEMENTS
   - Payment settlements are processed as per the platform's payment policy.
   - Standard settlement cycle is 7 business days from service completion.`,
  },
  privacyPolicy: {
    title: 'Privacy Policy',
    content: `PRIVACY POLICY

This policy describes how we collect, use, and protect your information when you use Warmpawz as a vendor.`,
  },
};

export function DynamicVendorOnboardingForm({ 
  roleId, 
  onSubmit, 
  onBack,
  serviceStyles = [],
  initialData,
  vendorId,
  isEditMode
}: DynamicVendorOnboardingFormProps) {
  const [form, setForm] = useState<OnboardingForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [documents, setDocuments] = useState<Record<string, File | null>>({});
  const [documentPreviews, setDocumentPreviews] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showAgreement, setShowAgreement] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Dynamic policies from backend - use DEFAULT_POLICIES constant to avoid TDZ issues
  const [policies, setPolicies] = useState<{
    vendorOnboardingAgreement: { title: string; content: string };
    termsOfService: { title: string; content: string };
    privacyPolicy: { title: string; content: string };
  }>(DEFAULT_POLICIES);
  const [loadingPolicies, setLoadingPolicies] = useState(false);
  
  // Map location
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string>('');

  // Specialization selection removed - now handled via admin-defined form fields only

  // Using apiClient instead of API_BASE

  // Fetch policies when agreement dialog is opened
  // ✅ FIX: Use DEFAULT_POLICIES constant instead of policies state to avoid TDZ error
  const fetchPolicies = async () => {
    if (loadingPolicies) return;
    
    try {
      setLoadingPolicies(true);
      const response = await apiClient.get<any>('/public/policies');
      const raw = response?.policies ?? response?.data?.policies;
      const list = Array.isArray(raw) ? raw : [];
      console.log('[vendor-onboarding] Fetched policies:', list.length, 'types:', list.map((p: any) => p.policyType).join(','));

      if (list.length > 0) {
        const vendorAgreement = list.find((p: any) => p.policyType === 'vendor_onboarding_agreement');
        const terms = list.find(
          (p: any) =>
            p.policyType === 'vendor_terms_of_service' || p.policyType === 'terms_of_service'
        );
        const privacy = list.find((p: any) => p.policyType === 'privacy_policy');

        setPolicies({
          vendorOnboardingAgreement: {
            title: vendorAgreement?.title || DEFAULT_POLICIES.vendorOnboardingAgreement.title,
            content: vendorAgreement?.content || DEFAULT_POLICIES.vendorOnboardingAgreement.content,
          },
          termsOfService: {
            title: terms?.title || DEFAULT_POLICIES.termsOfService.title,
            content: terms?.content || DEFAULT_POLICIES.termsOfService.content,
          },
          privacyPolicy: {
            title: privacy?.title || DEFAULT_POLICIES.privacyPolicy.title,
            content: privacy?.content || DEFAULT_POLICIES.privacyPolicy.content,
          },
        });
      }
    } catch (error) {
      console.warn('Failed to fetch policies, using defaults:', error);
    } finally {
      setLoadingPolicies(false);
    }
  };

  // Fetch policies when dialog is opened
  useEffect(() => {
    if (showAgreement) {
      fetchPolicies();
    }
  }, [showAgreement]);

  useEffect(() => {
    if (initialData) {
      console.log('📝 [DYNAMIC FORM] Pre-filling form with initial data:', initialData);
      
      // Merge initial form data
      if (initialData.formData) {
        setFormData(prev => ({ ...prev, ...initialData.formData }));
      }
      
      // Set coordinates if available
      if (initialData.location) {
        setCoordinates(initialData.location);
      }
    }
  }, [initialData]);

  // ✅ NEW: Load saved form data from localStorage on mount (before initialData overrides)
  useEffect(() => {
    if (typeof window !== 'undefined' && !initialData && !isEditMode) {
      try {
        const savedFormKey = `vendorOnboardingForm_${roleId}`;
        const savedFormData = localStorage.getItem(savedFormKey);
        if (savedFormData) {
          const parsed = JSON.parse(savedFormData);
          console.log('📝 [DYNAMIC FORM] Restoring saved form data from localStorage:', Object.keys(parsed.formData || {}).length, 'fields');
          
          if (parsed.formData) {
            setFormData(prev => ({ ...prev, ...parsed.formData }));
          }
          if (parsed.coordinates) {
            setCoordinates(parsed.coordinates);
          }
          if (parsed.agreedToTerms) {
            setAgreedToTerms(parsed.agreedToTerms);
          }
        }
      } catch (error) {
        console.warn('⚠️ [DYNAMIC FORM] Error loading saved form data:', error);
      }
    }
  }, [roleId, initialData, isEditMode]);

  // ✅ NEW: Auto-save form data to localStorage on change
  useEffect(() => {
    if (typeof window !== 'undefined' && !isEditMode && roleId && Object.keys(formData).length > 0) {
      try {
        const savedFormKey = `vendorOnboardingForm_${roleId}`;
        const dataToSave = {
          formData,
          coordinates,
          agreedToTerms,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(savedFormKey, JSON.stringify(dataToSave));
        console.log('💾 [DYNAMIC FORM] Auto-saved form data to localStorage');
      } catch (error) {
        console.warn('⚠️ [DYNAMIC FORM] Error saving form data:', error);
      }
    }
  }, [formData, coordinates, agreedToTerms, roleId, isEditMode]);

  useEffect(() => {
    console.log('🚀 [INIT] Component mounted, starting initialization...');
    console.log('🚀 [INIT] roleId:', roleId);
    checkServerHealth();
    
    // ✅ FIX: Check runtime config first, then environment variable, then fetch from backend
    console.log('🔍 [ENV] Checking for Google Maps API key...');
    
    // Check runtime config
    const runtimeConfig = (window as any).__WARMPAWZ_RUNTIME_CONFIG__;
    if (runtimeConfig?.googleMapsApiKey) {
      console.log('✅ [RUNTIME CONFIG] Using Google Maps API key from runtime config');
      setGoogleMapsApiKey(runtimeConfig.googleMapsApiKey);
    } else {
      console.log('🔍 [ENV] process.env exists:', !!process.env);
      
      const envApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      
      console.log('🔍 [ENV] envApiKey exists:', !!envApiKey);
      console.log('🔍 [ENV] envApiKey value:', envApiKey ? `${envApiKey.substring(0, 10)}...` : 'null/undefined');
      
      if (envApiKey) {
        console.log('✅ [ENV] Using Google Maps API key from environment variable');
        setGoogleMapsApiKey(envApiKey);
      } else {
        console.log('⚠️ [ENV] No environment variable found, fetching from backend...');
        fetchGoogleMapsKey();
      }
    }
    
    fetchForm();
  }, [roleId]);

  const fetchGoogleMapsKey = async () => {
    console.log('🔑 [API KEY] Fetching Google Maps API key from backend...');
    try {
      const data = await apiClient.get('/config/google-maps-key') as any;
      
      console.log('🔑 [API KEY] Response data:', data);
      
      if (data && data.apiKey) {
        console.log('✅ [API KEY] Found API key in backend settings');
        console.log('🔑 [API KEY] Key length:', data.apiKey.length);
        setGoogleMapsApiKey(data.apiKey);
      } else if (data && data.settings?.googleMaps?.apiKey) {
        console.log('✅ [API KEY] Found API key in backend settings (legacy)');
        console.log('🔑 [API KEY] Key length:', data.settings.googleMaps.apiKey.length);
        setGoogleMapsApiKey(data.settings.googleMaps.apiKey);
      } else {
        console.warn('⚠️ [API KEY] No Google Maps API key found in backend settings');
        console.warn('⚠️ [API KEY] Settings structure:', JSON.stringify(data, null, 2));
        toast.warning('Google Maps not configured. Please contact administrator.');
      }
    } catch (error) {
      console.error('❌ [API KEY] Error fetching Google Maps key:', error);
    }
  };

  useEffect(() => {
    console.log('🔄 [API KEY EFFECT] googleMapsApiKey changed:', !!googleMapsApiKey);
    if (googleMapsApiKey) {
      console.log('🔄 [API KEY EFFECT] Calling loadGoogleMapsScript...');
      loadGoogleMapsScript();
    } else {
      console.log('⚠️ [API KEY EFFECT] No API key available yet');
    }
  }, [googleMapsApiKey]);

  // Note: initializeMap is now called directly from loadGoogleMapsScript callback
  // These useEffect hooks are kept as a backup in case callback doesn't fire
  useEffect(() => {
    if (mapLoaded && mapRef.current && !googleMapRef.current) {
      console.log('🔄 [BACKUP] useEffect triggered - attempting to initialize map...');
      initializeMap();
    }
  }, [mapLoaded, mapRef.current]);

  // Update map marker when coordinates change after initialization
  useEffect(() => {
    if (coordinates && googleMapRef.current && markerRef.current) {
      console.log('🔄 [COORDINATES UPDATE] Updating map marker position:', coordinates);
      const position = { lat: coordinates.lat, lng: coordinates.lng };
      markerRef.current.setPosition(position);
      googleMapRef.current.setCenter(position);
      googleMapRef.current.setZoom(15);
    }
  }, [coordinates]);

  const checkServerHealth = async () => {
    try {
      console.log('[DYNAMIC FORM] 🏥 Checking server health...');
      const data = await apiClient.get('/health') as any;
      
      if (data && data.status === 'ok') {
        console.log('[DYNAMIC FORM] ✅ Server is healthy:', data);
      } else {
        console.error('[DYNAMIC FORM] ⚠️ Server health check failed');
        toast.error('Backend server may not be running. Please check deployment.');
      }
    } catch (error) {
      console.error('[DYNAMIC FORM] ❌ Server unreachable:', error);
      console.error('[DYNAMIC FORM] 💡 Tip: API Gateway may not be deployed correctly');
      toast.error('Cannot connect to backend server. Please check API Gateway.');
    }
  };

  const fetchForm = async () => {
    try {
      setLoading(true);
      console.log('[DYNAMIC FORM] Fetching form for roleId:', roleId);
      
      // ✅ FIX: Get phone from localStorage and use correct endpoint
      const phone = typeof window !== 'undefined' ? localStorage.getItem('vendorPhone') : null;
      
      // ✅ FIX: Try fixed endpoint first, fall back to original
      let response: any = null;
      let endpoint = '';
      
      try {
        // Try new fixed endpoint
        const params = new URLSearchParams();
        if (phone) {
          params.append('phone', phone);
        }
        endpoint = `/vendor/onboarding/form-schema-fixed?${params.toString()}`;
        console.log('[DYNAMIC FORM] 🔗 Trying FIXED endpoint:', endpoint);
        response = await apiClient.get(endpoint);
        console.log('[DYNAMIC FORM] ✅ FIXED endpoint succeeded');
      } catch (fixedError) {
        console.warn('[DYNAMIC FORM] ⚠️  FIXED endpoint failed, trying ORIGINAL endpoint:', fixedError);
        // Fall back to original endpoint
        const params = new URLSearchParams();
        if (phone) {
          params.append('phone', phone);
        }
        if (roleId) {
          params.append('roleId', roleId);
        }
        endpoint = `/vendor/onboarding/form-schema?${params.toString()}`;
        console.log('[DYNAMIC FORM] 🔗 Trying ORIGINAL endpoint:', endpoint);
        response = await apiClient.get(endpoint);
        console.log('[DYNAMIC FORM] ✅ ORIGINAL endpoint succeeded');
      }

      console.log('[DYNAMIC FORM] ✅ Raw response:', response);
      
      // ✅ FIX: Unwrap double-wrapped response from BaseHandlerEnhanced
      // Backend returns: { success: true, data: { success: true, fields: [...], sections: [...] } }
      const data = response.data || response;
      
      console.log('[DYNAMIC FORM] ✅ Unwrapped data:', data);
      console.log('[DYNAMIC FORM] 📋 Version:', data.version, 'Status:', data.status);
      console.log('[DYNAMIC FORM] 📋 Sections count:', data.sections?.length);
      
      // ✅ FIX: Handle new response structure (fields, sections, schema)
      if (data && (data.schema || data.fields || data.sections)) {
        // ✅ FIX: Transform fields to use 'name' instead of 'fieldName' (backend uses fieldName)
        const transformField = (f: any) => {
          // Normalize options - convert string arrays to {value, label} objects for multiselect/select fields
          let normalizedOptions = f.options;
          if (f.options && Array.isArray(f.options) && f.options.length > 0) {
            if (typeof f.options[0] === 'string') {
              // Convert string array to object array: ["opt1"] => [{value: "opt1", label: "opt1"}]
              normalizedOptions = f.options.map((opt: string) => ({
                value: opt,
                label: opt
              }));
            }
            // If already objects, keep as-is (support both formats)
          }
          
          // ✅ FIX: Prioritize unique field name - use id if fieldName is generic like "new_field"
          // This prevents multiple file fields from sharing the same name
          let fieldName = f.name || f.fieldName || f.id;
          if (f.fieldName === 'new_field' || f.fieldName === 'newField' || (!f.fieldName && !f.name)) {
            // Use id as the field name for generic fieldName values to ensure uniqueness
            fieldName = f.id || `field_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          }
          
          return {
            ...f,
            name: fieldName,
            isActive: f.isActive !== false && f.is_active !== false,
            options: normalizedOptions, // Add normalized options
            validation: {
              required: f.isMandatory || f.validation?.required,
              ...f.validation
            }
          };
        };
        // Transform sections to have properly named fields
        const transformedSections = (data.sections || []).map((section: any) => ({
          ...section,
          isActive: section.isActive !== false,
          fields: (section.fields || []).map(transformField)
        }));
        
        // Transform response to match expected form structure
        const formStructure: OnboardingForm = {
          id: data.roleId || roleId,
          roleId: data.roleId || roleId,
          roleName: data.roleName || roleId,
          version: data.version || 1,
          status: data.status || 'active',
          sections: transformedSections,
          documentSections: []
        };
        
        console.log('[DYNAMIC FORM] 📋 Transformed sections:', formStructure.sections.map(s => ({
          id: s.id,
          fieldCount: s.fields?.length,
          fieldNames: s.fields?.map((f: any) => f.name)
        })));
        
        setForm(formStructure);
        
        // ✅ NEW: Initialize default values for fields (including multiselect)
        const defaultFormData: Record<string, any> = {};
        formStructure.sections.forEach(section => {
          section.fields.forEach(field => {
            if (field.defaultValue !== undefined) {
              defaultFormData[field.name] = field.defaultValue;
            }
          });
        });
        
        // Merge with existing formData (initialData takes precedence)
        setFormData(prev => ({ ...prev, ...defaultFormData }));
        
        if (data.existingApplication && data.existingApplication.application_payload) {
          setFormData(data.existingApplication.application_payload);
        }
        
        console.log('[DYNAMIC FORM] 🎉 Form schema loaded successfully with', formStructure.sections.length, 'sections');
        toast.success('Onboarding form loaded successfully');
      } else {
        console.error('[DYNAMIC FORM] ❌ Invalid response structure:', data);
        toast.error('Failed to load form: Invalid response structure');
      }
    } catch (error) {
      console.error('[DYNAMIC FORM] ❌ Fetch Error:', error);
      console.error('[DYNAMIC FORM] ❌ Error details:', {
        message: error instanceof Error ? error.message : String(error),
        roleId,
        endpoint: '/vendor/onboarding/form-schema'
      });
      toast.error('Cannot connect to backend server. Please check API Gateway configuration.');
    } finally {
      setLoading(false);
    }
  };

  const loadGoogleMapsScript = () => {
    console.log('🗺️ [GOOGLE MAPS] loadGoogleMapsScript called');
    console.log('🗺️ [GOOGLE MAPS] API Key exists:', !!googleMapsApiKey);
    console.log('🗺️ [GOOGLE MAPS] API Key length:', googleMapsApiKey?.length || 0);
    
    if (!googleMapsApiKey) {
      console.error('❌ [GOOGLE MAPS] No API key available');
      toast.error('Google Maps API key not configured. Please contact support.');
      return;
    }

    // Check if already loaded and Map class is available
    if ((window as any).google?.maps?.Map) {
      console.log('✅ [GOOGLE MAPS] Already loaded and Map class available');
      setMapLoaded(true);
      // Try to initialize immediately
      setTimeout(() => {
        if (mapRef.current && !googleMapRef.current) {
          initializeMap();
        }
      }, 100);
      return;
    }

    // Check if script tag already exists
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      console.log('⏳ [GOOGLE MAPS] Script tag already exists, polling for Map class...');
      
      let attempts = 0;
      const maxAttempts = 100; // 10 seconds
      
      const checkInterval = setInterval(() => {
        attempts++;
        console.log(`🔄 [GOOGLE MAPS] Polling attempt ${attempts}/${maxAttempts}`);
        
        if ((window as any).google?.maps?.Map) {
          console.log('✅ [GOOGLE MAPS] Map class now available!');
          setMapLoaded(true);
          clearInterval(checkInterval);
          
          // Initialize map after a short delay
          setTimeout(() => {
            if (mapRef.current && !googleMapRef.current) {
              initializeMap();
            }
          }, 100);
        } else if (attempts >= maxAttempts) {
          console.error('❌ [GOOGLE MAPS] Timeout - Map class never became available');
          console.error('❌ [GOOGLE MAPS] window.google exists:', !!(window as any).google);
          console.error('❌ [GOOGLE MAPS] window.google.maps exists:', !!((window as any).google?.maps));
          clearInterval(checkInterval);
          toast.error('Map loading timed out. Please refresh the page.');
        }
      }, 100);
      
      return;
    }

    console.log('📦 [GOOGLE MAPS] Creating new script tag...');
    console.log('📦 [GOOGLE MAPS] Using API key:', googleMapsApiKey.substring(0, 10) + '...');
    
    // Define global callback BEFORE creating script to ensure it's available
    (window as any).initGoogleMaps = () => {
      console.log('✅ [GOOGLE MAPS] Callback fired - Google Maps is ready!');
      console.log('✅ [GOOGLE MAPS] window.google exists:', !!(window as any).google);
      console.log('✅ [GOOGLE MAPS] window.google.maps exists:', !!((window as any).google?.maps));
      console.log('✅ [GOOGLE MAPS] window.google.maps.Map exists:', !!((window as any).google?.maps?.Map));
      
      setMapLoaded(true);
      
      // Initialize map after a short delay to ensure React has rendered
      setTimeout(() => {
        console.log('🔄 [GOOGLE MAPS] Attempting to initialize map...');
        console.log('🔄 [GOOGLE MAPS] mapRef.current exists:', !!mapRef.current);
        console.log('🔄 [GOOGLE MAPS] googleMapRef.current exists:', !!googleMapRef.current);
        
        if (mapRef.current && !googleMapRef.current) {
          initializeMap();
        } else {
          console.warn('⚠️ [GOOGLE MAPS] Cannot initialize - mapRef or googleMapRef issue');
        }
      }, 200);
    };
    
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places&callback=initGoogleMaps`;
    script.async = true;
    script.defer = true;
    
    script.onerror = (error) => {
      console.error('❌ [GOOGLE MAPS] Script loading error:', error);
      toast.error('Failed to load Google Maps. Please check your internet connection and API key.');
    };
    
    console.log('📦 [GOOGLE MAPS] Appending script to document head...');
    document.head.appendChild(script);
  };

  const detectCurrentLocation = () => {
    console.log('🎯 [GEOLOCATION] detectCurrentLocation called');
    console.log('🎯 [GEOLOCATION] navigator.geolocation exists:', !!navigator.geolocation);
    console.log('🎯 [GEOLOCATION] googleMapRef.current exists:', !!googleMapRef.current);
    console.log('🎯 [GEOLOCATION] markerRef.current exists:', !!markerRef.current);
    
    if (!navigator.geolocation) {
      console.error('❌ [GEOLOCATION] Geolocation not supported');
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    if (!googleMapRef.current || !markerRef.current) {
      console.error('❌ [GEOLOCATION] Map not ready yet');
      toast.error('Please wait for the map to load');
      return;
    }

    setDetectingLocation(true);
    console.log('🔍 [GEOLOCATION] Requesting current position...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('✅ [GEOLOCATION] Position received:', position);
        const pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        
        console.log('📍 [GEOLOCATION] Coordinates:', pos);
        
        if (googleMapRef.current && markerRef.current) {
          googleMapRef.current.setCenter(pos);
          googleMapRef.current.setZoom(15);
          markerRef.current.setPosition(pos);
          setCoordinates(pos);
          console.log('✅ [GEOLOCATION] Map updated with location');
          toast.success('Location detected successfully!');
        }
        
        setDetectingLocation(false);
      },
      (error) => {
        console.error('❌ [GEOLOCATION] Geolocation error:', error);
        console.error('❌ [GEOLOCATION] Error code:', error.code);
        console.error('❌ [GEOLOCATION] Error message:', error.message);
        setDetectingLocation(false);
        
        let errorMessage = '📍 Unable to detect location. Please pin manually on the map.';
        let errorType: 'error' | 'warning' = 'warning';
        
        if (error.code === 1 || error.message?.includes('permissions policy')) { // PERMISSION_DENIED
          errorMessage = '🔒 Location access restricted. Please search for your city or pin manually on the map.';
          errorType = 'warning';
          console.log('💡 [GEOLOCATION] Permission policy restriction detected');
        } else if (error.code === 2) { // POSITION_UNAVAILABLE
          errorMessage = '📡 Location unavailable. Please try again or pin manually on the map.';
          errorType = 'warning';
        } else if (error.code === 3) { // TIMEOUT
          errorMessage = '⏱️ Location request timed out. Please try again or pin manually on the map.';
          errorType = 'warning';
        }
        
        console.log('💬 [GEOLOCATION] Showing error:', errorMessage);
        
        // Use warning toast for permission denied, error for others
        if (errorType === 'warning') {
          toast.warning(errorMessage);
        } else {
          toast.error(errorMessage);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const initializeMap = () => {
    console.log('🗺️ [MAP INIT] Starting map initialization...');
    console.log('🗺️ [MAP INIT] mapRef.current exists:', !!mapRef.current);
    console.log('🗺️ [MAP INIT] window.google exists:', !!(window as any).google);
    console.log('🗺️ [MAP INIT] window.google.maps exists:', !!((window as any).google?.maps));
    console.log('🗺️ [MAP INIT] window.google.maps.Map exists:', !!((window as any).google?.maps?.Map));
    console.log('🗺️ [MAP INIT] window.google.maps.Marker exists:', !!((window as any).google?.maps?.Marker));
    console.log('🗺️ [MAP INIT] Existing coordinates:', coordinates);
    
    if (!mapRef.current) {
       console.error('❌ [MAP INIT] Map Ref not found');
       toast.error('Map container not ready. Please try again.');
       return;
    }
    
    // Safe check for Google Maps availability
    if (!(window as any).google) {
      console.error('❌ [MAP INIT] window.google not found');
      toast.error('Google Maps not loaded. Please refresh the page.');
      return;
    }
    
    if (!(window as any).google.maps) {
      console.error('❌ [MAP INIT] window.google.maps not found');
      toast.error('Google Maps API not ready. Please refresh the page.');
      return;
    }
    
    if (!(window as any).google.maps.Map) {
      console.error('❌ [MAP INIT] google.maps.Map class not found');
      toast.error('Google Maps Map class not available. Please refresh the page.');
      return;
    }
    
    if (!(window as any).google.maps.Marker) {
      console.error('❌ [MAP INIT] google.maps.Marker class not found');
      toast.error('Google Maps Marker class not available. Please refresh the page.');
      return;
    }
    
    try {
        console.log('🗺️ [MAP INIT] All checks passed - creating map instance...');
        
        // Use existing coordinates if available, otherwise default to India center
        const initialCenter = coordinates || { lat: 20.5937, lng: 78.9629 };
        const initialZoom = coordinates ? 15 : 5;
        
        console.log('🗺️ [MAP INIT] Initial center:', initialCenter);
        console.log('🗺️ [MAP INIT] Initial zoom:', initialZoom);
        
        // Use simple, direct Google Maps API
        const map = new (window as any).google.maps.Map(mapRef.current, {
          center: initialCenter,
          zoom: initialZoom,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        googleMapRef.current = map;
        console.log('✅ [MAP INIT] Map instance created successfully');

        // Create marker with existing coordinates if available
        console.log('🗺️ [MAP INIT] Creating marker...');
        const marker = new (window as any).google.maps.Marker({
          map: map,
          position: initialCenter,
          draggable: true,
          title: 'Your Business Location',
          animation: (window as any).google.maps.Animation.DROP
        });

        markerRef.current = marker;
        console.log('✅ [MAP INIT] Marker created successfully at position:', initialCenter);
        
        // Add click listener to map
        map.addListener('click', (e: any) => {
          console.log('🗺️ [MAP CLICK] Map clicked');
          if (!e.latLng) {
            console.log('⚠️ [MAP CLICK] No latLng in event');
            return;
          }
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          console.log('📍 [MAP CLICK] New position:', { lat, lng });
          marker.setPosition({ lat, lng });
          setCoordinates({ lat, lng });
          toast.success('Location updated!');
        });
        
        // Add drag listener to marker
        marker.addListener('dragend', (e: any) => {
          console.log('🗺️ [MARKER DRAG] Marker dragged');
          if (!e.latLng) {
            console.log('⚠️ [MARKER DRAG] No latLng in event');
            return;
          }
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          console.log('📍 [MARKER DRAG] New position:', { lat, lng });
          setCoordinates({ lat, lng });
          toast.success('Location updated!');
        });

        console.log('✅ [MAP INIT] Map fully initialized and ready to use');
        if (!coordinates) {
          toast.success('Map loaded successfully! Click or drag to set your location.');
        } else {
          toast.success('Map loaded with your location!');
        }

    } catch (e) {
        console.error('❌ [MAP INIT] Error initializing map:', e);
        toast.error('Failed to initialize map. Please refresh the page.');
    }
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    // ✅ FIX: Use functional state update to avoid stale closure issues
    setFormData(prev => ({ ...prev, [fieldName]: value }));
    // ✅ FIX: Clear error using functional update to ensure latest state
    setErrors(prev => {
      if (prev[fieldName]) {
        const updated = { ...prev };
        delete updated[fieldName]; // Actually delete the error, not just set to empty string
        return updated;
      }
      return prev;
    });
  };

  const handleFileUpload = (fieldName: string, file: File) => {
    console.log('📤 [UPLOAD] handleFileUpload called:', { fieldName, fileName: file.name, fileSize: file.size });
    
    setDocuments(prev => {
      const updated = { ...prev, [fieldName]: file };
      console.log('📤 [UPLOAD] Updated documents state:', Object.keys(updated));
      return updated;
    });
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setDocumentPreviews(prev => {
        const updated = { ...prev, [fieldName]: reader.result as string };
        console.log('📤 [UPLOAD] Updated preview state:', Object.keys(updated));
        return updated;
      });
    };
    reader.readAsDataURL(file);
    
    // Clear error for this field
    if (errors[fieldName]) {
      setErrors(prev => {
        const updated = { ...prev, [fieldName]: '' };
        console.log('📤 [UPLOAD] Cleared error for:', fieldName);
        return updated;
      });
    }
    
    console.log('✅ [UPLOAD] File upload handler completed for:', fieldName);
  };

  const validateForm = (): { isValid: boolean; errors: Record<string, string> } => {
    console.log('🔍 [VALIDATION] Starting form validation...');
    console.log('🔍 [VALIDATION] Current formData:', formData);
    console.log('🔍 [VALIDATION] Current documents state:', documents);
    console.log('🔍 [VALIDATION] Document keys:', Object.keys(documents));
    console.log('🔍 [VALIDATION] Document values:', Object.values(documents).map(d => d?.name || 'null'));
    console.log('🔍 [VALIDATION] agreedToTerms:', agreedToTerms);
    
    const newErrors: Record<string, string> = {};

    if (!form) return { isValid: false, errors: { form: 'Form not loaded' } };

    // Validate all sections
    form.sections.forEach(section => {
      console.log(`🔍 [VALIDATION] Checking section: ${section.id || section.name}, isActive: ${section.isActive}`);
      if (!section.isActive) return;
      
      section.fields.forEach(field => {
        console.log(`🔍 [VALIDATION] Field: ${field.name}, isActive: ${field.isActive}, required: ${field.validation?.required || (field as any).isMandatory}`);
        if (!field.isActive) return;

        let value = formData[field.name];
        
        // Handle special field types
        if (field.type === 'file') {
          value = documents[field.name];
        } else if (field.type === 'map_pin') {
          value = coordinates;
        }
        
        console.log(`🔍 [VALIDATION] Field ${field.name} value:`, value, 'type:', typeof value);
        
        // Required validation - check both validation.required and isMandatory
        const isRequired = field.validation?.required || (field as any).isMandatory;
        // Trim strings and check for empty values - whitespace-only is considered empty
        const trimmedValue = typeof value === 'string' ? value.trim() : value;
        
        // ✅ FIX: Special handling for checkbox and declaration fields
        // For these types, only `true` means the field is filled
        if (field.type === 'checkbox' || field.type === 'declaration') {
          if (isRequired && value !== true) {
            console.log(`❌ [VALIDATION] Required checkbox/declaration not checked: ${field.name} (label: ${field.label})`);
            newErrors[field.name] = `${field.label || field.name} is required`;
          } else if (value === true) {
            console.log(`✅ [VALIDATION] Checkbox/declaration checked: ${field.name}`);
          }
        } else {
          // Standard empty check for other field types
          const isEmpty = trimmedValue === undefined || trimmedValue === null || trimmedValue === '' || (Array.isArray(trimmedValue) && trimmedValue.length === 0);
          
          if (isRequired && isEmpty) {
            console.log(`❌ [VALIDATION] Required field missing: ${field.name} (label: ${field.label})`);
            newErrors[field.name] = `${field.label || field.name} is required`;
          } else if (field.type === 'file' && value) {
            console.log(`✅ [VALIDATION] File field present: ${field.name}`);
          } else if (field.type === 'map_pin' && value) {
            console.log(`✅ [VALIDATION] Location present: ${field.name}`, value);
          } else if (value) {
            console.log(`✅ [VALIDATION] Field ${field.name} has value:`, value);
          }
        }

        // Min/Max length validation (only for text fields)
        if (value && typeof value === 'string') {
          if (field.validation?.minLength && value.length < field.validation.minLength) {
            newErrors[field.name] = `Minimum ${field.validation.minLength} characters required`;
          }
          if (field.validation?.maxLength && value.length > field.validation.maxLength) {
            newErrors[field.name] = `Maximum ${field.validation.maxLength} characters allowed`;
          }
        }

        // Number validation
        if (field.type === 'number' && value) {
          const numValue = parseFloat(value);
          if (field.validation?.min && numValue < field.validation.min) {
            newErrors[field.name] = `Minimum value is ${field.validation.min}`;
          }
          if (field.validation?.max && numValue > field.validation.max) {
            newErrors[field.name] = `Maximum value is ${field.validation.max}`;
          }
        }

        // Email validation - stricter to reject invalid extensions
        if (field.type === 'email' && value) {
          // ✅ FIX: Stricter email validation - must have valid TLD (at least 2 chars after dot)
          const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
          if (!emailRegex.test(value)) {
            newErrors[field.name] = 'Only valid emails are accepted';
          }
        }

        // Phone validation - enforce exactly 10 digits
        if (field.type === 'tel' && value) {
          const phoneDigits = value.replace(/\D/g, '');
          if (phoneDigits.length !== 10) {
            newErrors[field.name] = 'Phone number must be exactly 10 digits';
          }
        }

        // Pincode validation - enforce exactly 6 digits
        if ((field.name === 'pin' || field.name === 'pincode' || field.name === 'pinCode') && value) {
          const pincodeDigits = value.replace(/\D/g, '');
          if (pincodeDigits.length !== 6) {
            newErrors[field.name] = 'Pincode must be exactly 6 digits';
          }
        }
      });
    });

    // Validate document sections
    console.log('🔍 [VALIDATION] Validating document sections...');
    if (form.documentSections && form.documentSections.length > 0) {
      form.documentSections.forEach(section => {
        console.log(`🔍 [VALIDATION] Checking document section: ${section.name}`);
        section.fields.forEach(field => {
          console.log(`🔍 [VALIDATION] Checking document field: ${field.name}`);
          console.log(`🔍 [VALIDATION] Is required: ${field.validation?.required}`);
          console.log(`🔍 [VALIDATION] Document exists: ${!!documents[field.name]}`);
          console.log(`🔍 [VALIDATION] Document value:`, documents[field.name]);
          
          if (field.validation?.required && !documents[field.name]) {
            console.log(`❌ [VALIDATION] Required document missing: ${field.name}`);
            newErrors[field.name] = `${field.label} is required`;
          } else if (documents[field.name]) {
            console.log(`✅ [VALIDATION] Document present: ${field.name} - ${documents[field.name]?.name}`);
          }
        });
      });
    }

    // Check terms agreement
    if (!agreedToTerms) {
      console.log('❌ [VALIDATION] Terms not agreed');
      newErrors['terms'] = 'You must accept the terms';
    } else {
      console.log('✅ [VALIDATION] Terms agreed');
    }

    console.log('🔍 [VALIDATION] Total errors found:', Object.keys(newErrors).length);
    console.log('🔍 [VALIDATION] Error details:', newErrors);

    setErrors(newErrors);
    return { isValid: Object.keys(newErrors).length === 0, errors: newErrors };
  };

  // Helper to upload a single file
  const uploadFile = async (file: File, path: string = 'uploads'): Promise<string> => {
    try {
      // ✅ FIX: Use storage endpoint that handles FormData directly
      const formData = new FormData();
      formData.append('file', file);
      
      // ✅ FIX: Get vendorId or use phone to get identity ID during onboarding
      // During onboarding, vendorId might not exist, so we use phone to identify the vendor
      let vendorId = typeof window !== 'undefined' ? localStorage.getItem('vendorId') : null;
      
      // If no vendorId but we're in onboarding, try to get from vendor identity using phone
      if (!vendorId && typeof window !== 'undefined') {
        const phone = localStorage.getItem('vendorPhone');
        if (phone) {
          try {
            // Get vendor identity ID from phone (used for onboarding documents)
            const identityResponse = await apiClient.get<any>(`/vendor/onboarding/status?phone=${encodeURIComponent(phone)}`);
            // ✅ FIX: API returns {success: true, data: {identity, application, role}}
            const identityData = identityResponse?.data?.identity || identityResponse?.identity;
            if (identityData?.id) {
              // Use identity ID as vendorId for onboarding documents
              vendorId = identityData.id;
            }
          } catch (err) {
            console.warn('Could not get vendor identity for file upload:', err);
          }
        }
      }
      
      // ✅ FIX: Use phone number as fallback identifier if vendorId still not available
      if (!vendorId && typeof window !== 'undefined') {
        const phone = localStorage.getItem('vendorPhone');
        if (phone) {
          // Use phone number as temporary vendorId for onboarding documents
          vendorId = `onboarding-${phone}`;
        }
      }
      
      if (!vendorId) {
        throw new Error('Vendor ID or phone number is required for file upload');
      }
      
      formData.append('vendorId', vendorId);
      
      // Use path as documentType for categorization
      formData.append('documentType', path.split('/').pop() || 'document');

      // ✅ FIX: Use /storage/upload endpoint - apiClient handles FormData automatically
      const data = await apiClient.post<{ 
        success: boolean; 
        url?: string;
        publicUrl?: string;
        fileName?: string;
        error?: string;
      }>('/storage/upload', formData);
      
      if (!data || !data.success || !data.url) {
        throw new Error(data?.error || 'Upload failed: No URL returned');
      }

      return data.url || data.publicUrl || '';
    } catch (error: any) {
      console.error('File upload error:', error);
      throw new Error(error?.message || 'Failed to upload file');
    }
  };

  const handleSubmit = async () => {
    const { isValid, errors: validationErrors } = validateForm();
    if (!isValid) {
      // Show specific error messages for better UX
      const errorFields = Object.entries(validationErrors).filter(([key, value]) => value && key !== 'terms');
      
      if (errorFields.length > 0) {
        const missingFields = errorFields.map(([key, msg]) => msg).slice(0, 3).join(', ');
        toast.error(`Missing: ${missingFields}`);
        console.log('❌ [SUBMIT] Validation failed. Missing fields:', errorFields);
        
        // Scroll to first error field
        const firstErrorField = errorFields[0][0];
        const element = document.querySelector(`[name="${firstErrorField}"]`) || 
                        document.querySelector(`[id="${firstErrorField}"]`) ||
                        document.querySelector(`[data-field="${firstErrorField}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add focus for accessibility
          if (element instanceof HTMLElement) {
            element.focus();
          }
        }
      } else if (!agreedToTerms) {
        toast.error('Please accept the terms and conditions');
        // Scroll to terms checkbox
        const termsSection = document.querySelector('[data-field="terms"]') || document.getElementById('terms-checkbox');
        if (termsSection) {
          termsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        toast.error('Please fill all required fields');
      }
      return;
    }

    setSubmitting(true);
    
    try {
      // 1. Upload all files first - continue even if some fail
      const uploadedDocuments: Record<string, any> = {};
      const failedUploads: string[] = [];
      
      const fileUploadPromises = Object.keys(documents).map(async (key) => {
        const file = documents[key];
        if (!file) {
          return { key, success: true, skipped: true };
        }

          try {
            toast.info(`Uploading ${key}...`);
            const url = await uploadFile(file, `vendor-docs/${roleId}`);
          
          // Only add to uploadedDocuments if upload succeeded
            uploadedDocuments[key] = {
              name: file.name,
              type: file.type,
              size: file.size,
              url: url
            };
          
            console.log(`✅ Uploaded ${key}: ${url}`);
          return { key, success: true };
        } catch (err: any) {
          console.error(`❌ Failed to upload ${key}:`, err);
          failedUploads.push(key);
          // Don't throw - just log and continue with other uploads
          return { key, success: false, error: err?.message || 'Upload failed' };
        }
      });

      // Use allSettled instead of all - waits for all promises regardless of success/failure
      const uploadResults = await Promise.allSettled(fileUploadPromises);
      
      // Log summary of upload results
      const successfulUploads = uploadResults.filter(
        (result) => result.status === 'fulfilled' && result.value?.success && !result.value?.skipped
      ).length;
      
      const skippedUploads = uploadResults.filter(
        (result) => result.status === 'fulfilled' && result.value?.skipped
      ).length;
      
      console.log(`📤 [UPLOAD SUMMARY] Successful: ${successfulUploads}, Failed: ${failedUploads.length}, Skipped: ${skippedUploads}`);
      
      // Show appropriate feedback based on upload results
      if (failedUploads.length > 0) {
        toast.warning(
          `${failedUploads.length} document(s) failed to upload. Continuing with ${successfulUploads} successful upload(s)...`
        );
        console.warn(`⚠️ [UPLOAD] Failed uploads: ${failedUploads.join(', ')}`);
      } else if (successfulUploads > 0) {
        toast.success(`All ${successfulUploads} document(s) uploaded successfully`);
      }

      // 2. Prepare submission data with uploaded file URLs
      const submissionData = {
        roleId,
        formData: {
          ...formData,
          coordinates,
          location: coordinates, // ✅ Ensure backend receives location in formData
        },
        documents: uploadedDocuments, // Send the object with URLs
        serviceStyles,
        location: coordinates,
        agreedToTerms,
        formVersion: form?.version,
        vendorId: vendorId, // ✅ NEW: Include vendorId for edit mode
        isEditMode: isEditMode, // ✅ NEW: Flag for edit vs create
      };

      // ✅ DEBUG: Log pincode specifically
      console.log('📍 [DYNAMIC FORM] Form submission - checking pincode:');
      console.log('📍 [DYNAMIC FORM] formData keys:', Object.keys(formData).join(', '));
      if (formData.pincode !== undefined) {
        console.log(`📍 [DYNAMIC FORM] ✅ formData.pincode = '${formData.pincode}'`);
      }
      if (formData.pin !== undefined) {
        console.log(`📍 [DYNAMIC FORM] ✅ formData.pin = '${formData.pin}'`);
      }
      console.log('📍 [DYNAMIC FORM] submissionData.formData keys:', Object.keys(submissionData.formData).join(', '));
      if (submissionData.formData.pincode !== undefined) {
        console.log(`📍 [DYNAMIC FORM] ✅ submissionData.formData.pincode = '${submissionData.formData.pincode}'`);
      }
      if (submissionData.formData.pin !== undefined) {
        console.log(`📍 [DYNAMIC FORM] ✅ submissionData.formData.pin = '${submissionData.formData.pin}'`);
      }

      console.log('[DYNAMIC FORM] Submitting:', submissionData);
      await onSubmit(submissionData);
      
      // ✅ Clear saved form data from localStorage after successful submission
      if (typeof window !== 'undefined') {
        try {
          const savedFormKey = `vendorOnboardingForm_${roleId}`;
          localStorage.removeItem(savedFormKey);
          console.log('🧹 [DYNAMIC FORM] Cleared saved form data after successful submission');
        } catch (error) {
          console.warn('⚠️ [DYNAMIC FORM] Error clearing saved form data:', error);
        }
      }
      
    } catch (error) {
      console.error('[DYNAMIC FORM] Submission error:', error);
      toast.error('Failed to submit form: ' + String(error));
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: FormField) => {
    const value = formData[field.name] || '';
    const error = errors[field.name];

    // Updated styles to match reference: rounded-xl (or larger), light border, specific padding
    const commonClasses = `w-full rounded-2xl border ${
      error ? 'border-red-300' : 'border-gray-200'
    } px-4 py-3.5 text-gray-800 focus:border-[#FF8C42] focus:ring-1 focus:ring-[#FF8C42] focus:outline-none transition-all placeholder:text-gray-400 bg-white`;

    switch (field.type) {
      case 'textarea':
        return (
          <Textarea
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            className={`${commonClasses} min-h-[100px] resize-none`}
            rows={3}
          />
        );

      case 'select':
        return (
          <Select value={value} onValueChange={(val) => handleFieldChange(field.name, val)}>
            <SelectTrigger className={commonClasses}>
              <SelectValue placeholder={field.placeholder || `Select ${field.label}`} />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-gray-200">
              {field.options?.map((opt, index) => (
                <SelectItem key={`${field.name}-${opt.value}-${index}`} value={opt.value} className="focus:bg-orange-50 focus:text-orange-900 cursor-pointer rounded-lg my-1">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'multiselect':
        const selectedValues = Array.isArray(value) ? value : (value ? [value] : []);
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 min-h-[60px] p-3 rounded-2xl border border-gray-200 bg-white">
              {selectedValues.length === 0 ? (
                <span className="text-gray-400 text-sm">{field.placeholder || `Select ${field.label}`}</span>
              ) : (
                selectedValues.map((val: string) => {
                  const option = field.options?.find(opt => opt.value === val);
                  return (
                    <div
                      key={`${field.name}-${val}`}
                      className="inline-flex items-center gap-2 bg-[#FF8C42] text-white px-3 py-1.5 rounded-full text-sm font-medium"
                    >
                      <span>{option?.label || val}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const newValues = selectedValues.filter((v: string) => v !== val);
                          handleFieldChange(field.name, newValues);
                        }}
                        className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto p-2 border border-gray-100 rounded-xl bg-gray-50">
              {field.options?.map((opt, index) => {
                const isSelected = selectedValues.includes(opt.value);
                return (
                  <button
                    key={`${field.name}-${opt.value}-${index}`}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        const newValues = selectedValues.filter((v: string) => v !== opt.value);
                        handleFieldChange(field.name, newValues);
                      } else {
                        handleFieldChange(field.name, [...selectedValues, opt.value]);
                      }
                    }}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                      isSelected
                        ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42]'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected
                        ? 'border-[#FF8C42] bg-[#FF8C42]'
                        : 'border-gray-300'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-sm font-medium text-gray-900">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 'checkbox':
        return (
          <div className="flex items-center space-x-3 p-1">
            <Checkbox
              checked={!!value}
              onCheckedChange={(checked) => handleFieldChange(field.name, checked)}
              className="border-gray-300 data-[state=checked]:bg-[#FF8C42] data-[state=checked]:border-[#FF8C42] w-5 h-5 rounded-md"
            />
            <label className="text-sm font-medium text-gray-700 leading-none cursor-pointer">{field.label}</label>
          </div>
        );

      case 'date':
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            className={commonClasses}
          />
        );

      case 'file':
        return (
          <div className="mt-1">
            {documentPreviews[field.name] ? (
              <div className="relative group overflow-hidden rounded-2xl border border-gray-200">
                <img 
                  src={documentPreviews[field.name]} 
                  alt={field.label}
                  className="w-full h-48 object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        setDocuments({ ...documents, [field.name]: null });
                        setDocumentPreviews({ ...documentPreviews, [field.name]: '' });
                      }}
                      className="bg-white/20 backdrop-blur-md border border-white/50 text-white rounded-full p-2 hover:bg-white/40 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 shadow-sm">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Uploaded
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer hover:border-[#FF8C42] hover:bg-orange-50/50 transition-all group">
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6 text-[#FF8C42]" />
                </div>
                <span className="text-sm font-semibold text-gray-700 group-hover:text-[#FF8C42] transition-colors">Tap to upload document</span>
                <span className="text-xs text-gray-400 mt-1">{field.documentLabel || field.label}</span>
                <input
                  type="file"
                  accept={field.acceptedFileTypes?.join(',') || 'image/*'}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(field.name, file);
                  }}
                />
              </label>
            )}
          </div>
        );

      case 'map_pin':
        return (
          <div className="space-y-4 mt-2">
            {/* ✅ Show warning if no API key */}
            {!googleMapsApiKey && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <p className="text-xs text-yellow-800 font-medium">
                  ⚠️ Google Maps API key is not configured. Please contact support or configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in environment variables.
                </p>
              </div>
            )}
            
            <button
              type="button"
              onClick={detectCurrentLocation}
              disabled={detectingLocation || !googleMapsApiKey}
              className="w-full py-3.5 bg-white border-2 border-[#FF8C42] text-[#FF8C42] rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-orange-50"
            >
              {detectingLocation ? (
                <>
                  <div className="w-5 h-5 border-2 border-[#FF8C42] border-t-transparent rounded-full animate-spin"></div>
                  <span>Detecting...</span>
                </>
              ) : (
                <>
                  <MapPin className="w-5 h-5" />
                  <span>Detect Location</span>
                </>
              )}
            </button>

            <div className="relative">
              <div 
                ref={mapRef} 
                className="w-full h-64 rounded-2xl border border-gray-200 bg-gray-100 overflow-hidden shadow-inner"
              />
              {!mapLoaded && googleMapsApiKey && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 rounded-2xl">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#FF8C42] mb-3"></div>
                  <p className="text-sm text-gray-600 font-medium">Loading map...</p>
                  <p className="text-xs text-gray-400 mt-1">Please wait</p>
                </div>
              )}
              {!mapLoaded && !googleMapsApiKey && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-yellow-50 rounded-2xl border-2 border-yellow-200">
                  <AlertCircle className="w-10 h-10 text-yellow-600 mb-3" />
                  <p className="text-sm text-yellow-800 font-semibold">Map Not Available</p>
                  <p className="text-xs text-yellow-600 mt-1 px-4 text-center">
                    Google Maps API key not configured. Please contact support.
                  </p>
                </div>
              )}
              {mapLoaded && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
                   <span className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full text-xs font-medium text-gray-600 shadow-sm border border-gray-100">
                      Click or drag marker to set location
                   </span>
                </div>
              )}
            </div>
            
            {coordinates && (
              <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-center gap-3">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
                <div className="text-sm text-green-900 flex-1">
                  <p className="font-semibold">Location Pinned</p>
                  <p className="text-xs text-green-700 opacity-80">Lat: {coordinates.lat.toFixed(4)}, Lng: {coordinates.lng.toFixed(4)}</p>
                </div>
              </div>
            )}
            
            {errors[field.name] && (
              <p className="text-xs text-red-500 flex items-center gap-1 font-medium bg-red-50 p-2 rounded-lg">
                <AlertCircle className="w-3 h-3" />
                {errors[field.name]}
              </p>
            )}
          </div>
        );

      // ========================================
      // KYC VERIFICATION FIELD TYPES
      // ========================================
      
      case 'aadhaar-otp':
        return (
          <AadhaarOTPVerification
            vendorId={vendorId || ''}
            value={value}
            onChange={(val) => handleFieldChange(field.name, val)}
            onVerified={(data) => {
              handleFieldChange(field.name, data.maskedAadhaar);
              handleFieldChange(`${field.name}_verified`, true);
              handleFieldChange(`${field.name}_name`, data.name);
            }}
            disabled={!vendorId}
            label=""
            helpText={field.helpText}
            required={field.validation?.required}
          />
        );

      case 'pan-verify':
        return (
          <PANVerification
            vendorId={vendorId || ''}
            value={value}
            name={formData['fullName'] || formData['ownerName'] || formData['businessName']}
            onChange={(val) => handleFieldChange(field.name, val)}
            onVerified={(data) => {
              handleFieldChange(field.name, data.panNumber);
              handleFieldChange(`${field.name}_verified`, true);
              handleFieldChange(`${field.name}_name`, data.name);
              handleFieldChange(`${field.name}_status`, data.status);
            }}
            disabled={!vendorId}
            label=""
            helpText={field.helpText}
            required={field.validation?.required}
            autoVerify={true}
          />
        );

      case 'gst-verify':
        return (
          <GSTVerification
            vendorId={vendorId || ''}
            value={value}
            onChange={(val) => handleFieldChange(field.name, val)}
            onVerified={(data) => {
              handleFieldChange(field.name, data.gstin);
              handleFieldChange(`${field.name}_verified`, true);
              handleFieldChange(`${field.name}_legalName`, data.legalName);
              handleFieldChange(`${field.name}_tradeName`, data.tradeName);
              handleFieldChange(`${field.name}_status`, data.status);
            }}
            disabled={!vendorId}
            label=""
            helpText={field.helpText}
            required={field.validation?.required}
            conditional={!field.validation?.required}
            autoVerify={true}
          />
        );

      case 'declaration':
        return (
          <DeclarationField
            vendorId={vendorId || ''}
            declarationType={field.declarationType || field.name}
            declarationText={field.declarationText || field.label}
            value={!!value}
            onChange={(accepted) => handleFieldChange(field.name, accepted)}
            onAccepted={(data) => {
              handleFieldChange(`${field.name}_accepted`, true);
              handleFieldChange(`${field.name}_acceptedAt`, data.acceptedAt);
            }}
            disabled={!vendorId}
            required={field.validation?.required}
          />
        );

      default: // text, number, email, tel
        // ✅ FIX: Add maxLength based on field type
        let maxLength: number | undefined = undefined;
        if (field.type === 'tel') {
          maxLength = 10; // Exactly 10 digits for phone
        } else if (field.name === 'pin' || field.name === 'pincode' || field.name === 'pinCode') {
          maxLength = 6; // Exactly 6 digits for pincode
        } else if (field.validation?.maxLength) {
          maxLength = field.validation.maxLength;
        }
        
        return (
          <Input
            type={field.type}
            value={value}
            onChange={(e) => {
              let newValue = e.target.value;
              // ✅ FIX: Enforce maxLength for phone and pincode
              if (field.type === 'tel') {
                // Only allow digits, max 10
                newValue = newValue.replace(/\D/g, '').slice(0, 10);
              } else if (field.name === 'pin' || field.name === 'pincode' || field.name === 'pinCode') {
                // Only allow digits, max 6
                newValue = newValue.replace(/\D/g, '').slice(0, 6);
              }
              handleFieldChange(field.name, newValue);
            }}
            placeholder={field.placeholder}
            className={commonClasses}
            maxLength={maxLength}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFF5F1] w-full max-w-[430px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen bg-[#FFF5F1] flex items-center justify-center max-w-[430px] mx-auto p-6">
        <div className="bg-white rounded-3xl p-8 w-full text-center shadow-sm">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-800 mb-2">Form Not Available</h3>
          <p className="text-gray-600 mb-6 text-sm">Unable to load the onboarding form for this role.</p>
          
          <div className="flex flex-col gap-3">
            <Button onClick={fetchForm} className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E] text-white rounded-xl py-6 font-bold">
              Retry
            </Button>
            {onBack && (
              <Button onClick={onBack} variant="outline" className="w-full border-gray-200 rounded-xl py-6 font-semibold text-gray-600">
                Go Back
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }
  //Check if form has empty sections (no published form)
  if (form.sections.length === 0) {
    return (
      <div className="min-h-screen bg-[#FFF5F1] flex items-center justify-center max-w-[430px] mx-auto p-6">
        <div className="bg-white rounded-3xl p-8 w-full text-center shadow-sm">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-800 mb-2">Form Not Published</h3>
          <p className="text-gray-600 mb-6 text-sm">
            The onboarding form for <strong>{form.roleName}</strong> hasn't been configured yet.
          </p>
          {onBack && (
            <Button onClick={onBack} variant="outline" className="w-full border-gray-200 rounded-xl py-6 font-semibold text-gray-600">
              Go Back
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF5F1] w-full max-w-[430px] mx-auto flex flex-col">
      {/* Header Section */}
      <div className="pt-8 pb-8 px-6 text-center relative">
        {onBack && (
          <button 
            onClick={onBack} 
            className="absolute top-8 left-6 p-2 bg-white/50 hover:bg-white rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-800" />
          </button>
        )}
        
        {/* Centered Icon */}
        <div className="w-20 h-20 bg-[#FF8C42] rounded-full flex items-center justify-center mx-auto mb-4 shadow-orange-200 shadow-lg">
           {/* Dynamic Icon based on role if possible, else default User/Store */}
           <User className="w-10 h-10 text-white" />
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-1">{form.roleName}</h2>
        <p className="text-sm text-gray-500 font-medium">Vendor Onboarding</p>
      </div>

      {/* Error Summary Panel - Shows all missing fields */}
      {Object.keys(errors).length > 0 && (
        <div className="mx-4 mb-4 p-4 bg-red-50 border border-red-200 rounded-2xl">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Please fix the following:</p>
              <ul className="text-xs text-red-600 mt-1 space-y-0.5">
                {Object.entries(errors).map(([key, value]) => (
                  <li key={key}>• {value}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Card */}
      <div className="bg-white rounded-t-[40px] px-6 py-8 flex-1 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] min-h-[calc(100vh-220px)]">
        
        {/* Intro Text */}
        <div className="text-center mb-8 px-4">
           <p className="text-sm text-gray-600 leading-relaxed">
             Please complete the following details to register your business on Warmpawz.
           </p>
        </div>

        {/* Single Unified Onboarding Form */}
        <div className="space-y-5 pb-32">
          {/* ✅ FIX: Collect all fields from all sections, respecting section order first, then field order */}
          {form.sections
            .filter(s => s.isActive !== false)
            .sort((a, b) => (a.order || 0) - (b.order || 0)) // ✅ Sort sections by order first
            .flatMap(section => 
              section.fields
            .filter(f => f.isActive !== false)
                .sort((a, b) => (a.displayOrder || a.order || 0) - (b.displayOrder || b.order || 0)) // ✅ Sort fields within section
                .map(field => ({ ...field, sectionOrder: section.order || 0 })) // Preserve section order
            )
            .sort((a, b) => {
              // ✅ Sort by section order first, then field order
              if (a.sectionOrder !== b.sectionOrder) {
                return a.sectionOrder - b.sectionOrder;
              }
              return (a.displayOrder || a.order || 0) - (b.displayOrder || b.order || 0);
            })
            .map((field) => (
              <div key={field.id}>
                {field.type !== 'checkbox' && (
                  <Label className="text-sm font-semibold text-gray-900 mb-2 block">
                    {field.label}
                    {field.validation?.required && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </Label>
                )}
                
                {renderField(field)}
                
                {field.helpText && (
                  <p className="text-xs text-gray-400 mt-1.5">{field.helpText}</p>
                )}
                
                {errors[field.name] && (
                  <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1 font-medium">
                    {errors[field.name]}
                  </p>
                )}
              </div>
            ))}

          {/* Document Fields - Also integrated into single form */}
          {form.documentSections?.flatMap(section => section.fields)
            .filter(f => f.isActive !== false)
            .sort((a, b) => a.order - b.order)
            .map((field) => (
              <div key={field.id}>
                <Label className="text-sm font-semibold text-gray-900 mb-2 block">
                  {field.label}
                  {field.validation?.required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </Label>
                
                {renderField(field)}
                
                {field.helpText && (
                  <p className="text-xs text-gray-400 mt-1.5">{field.helpText}</p>
                )}
                
                {errors[field.name] && (
                  <p className="text-xs text-red-500 mt-1.5 font-medium">
                    {errors[field.name]}
                  </p>
                )}
              </div>
            ))}

          {/* Terms & Conditions */}
          <div className="pt-4" id="terms-checkbox" data-field="terms">
            <div className={`flex items-start gap-3 p-4 rounded-2xl bg-gray-50 border ${errors.terms ? 'border-red-300 bg-red-50' : 'border-gray-100'}`}>
              <Checkbox
                id="agree-terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(!!checked)}
                className="mt-1 data-[state=checked]:bg-[#FF8C42] data-[state=checked]:border-[#FF8C42]"
              />
              <div className="flex-1">
                <p className="text-xs text-gray-600 leading-relaxed">
                  By continuing, you agree to the{' '}
                  <button 
                    type="button" 
                    onClick={() => setShowAgreement(true)} 
                    className="text-gray-900 underline font-bold hover:text-[#FF8C42] transition-colors"
                  >
                    Vendor Onboarding Agreement
                  </button>
                  {' '}and{' '}
                  <button 
                    type="button" 
                    onClick={() => setShowAgreement(true)} 
                    className="text-gray-900 underline font-bold hover:text-[#FF8C42] transition-colors"
                  >
                    Terms of Service
                  </button>
                </p>
              </div>
            </div>
            {errors.terms && (
              <p className="text-xs text-red-500 mt-2 ml-4 font-medium">
                {errors.terms}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Fixed Bottom Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md px-6 py-4 max-w-[430px] mx-auto border-t border-gray-100 z-50">
        <div className="flex flex-col gap-3">
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E] text-white py-6 rounded-full font-bold text-lg shadow-lg hover:shadow-orange-200 transition-all disabled:opacity-70"
          >
            {submitting ? 'Submitting...' : 'Continue'}
          </Button>
          
          {/* Optional Skip button if needed, purely visual here unless prop provided */}
          {/* <Button variant="outline" className="w-full border-[#FF8C42] text-[#FF8C42] py-6 rounded-full font-bold hover:bg-orange-50">
             Skip
          </Button> */}
        </div>
      </div>

      {/* Terms Dialog */}
      <Dialog open={showAgreement} onOpenChange={setShowAgreement}>
        <DialogContent className="max-w-[90%] rounded-3xl max-h-[80vh] overflow-y-auto bg-white border border-gray-200 shadow-2xl z-[100]">
          <DialogHeader className="bg-white">
            <DialogTitle className="text-gray-900 text-xl font-bold">Vendor Agreements</DialogTitle>
            <DialogDescription className="text-gray-600">
              Review the vendor onboarding agreement, terms of service, and privacy policy.
            </DialogDescription>
          </DialogHeader>
          
          {loadingPolicies ? (
            <div className="flex items-center justify-center py-8 bg-white">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF8C42]"></div>
              <p className="ml-3 text-gray-600">Loading policies...</p>
            </div>
          ) : (
            <div className="space-y-6 mt-4 bg-white">
              <div className="bg-white">
                <h3 className="font-bold text-gray-800 mb-3">{policies.vendorOnboardingAgreement.title}</h3>
                <div className="text-sm text-gray-600 whitespace-pre-wrap max-h-[200px] overflow-y-auto p-3 bg-gray-50 rounded-lg border border-gray-100">
                  {policies.vendorOnboardingAgreement.content}
                </div>
              </div>
              <div className="bg-white">
                <h3 className="font-bold text-gray-800 mb-3">{policies.termsOfService.title}</h3>
                <div className="text-sm text-gray-600 whitespace-pre-wrap max-h-[200px] overflow-y-auto p-3 bg-gray-50 rounded-lg border border-gray-100">
                  {policies.termsOfService.content}
                </div>
              </div>
              <div className="bg-white">
                <h3 className="font-bold text-gray-800 mb-3">{policies.privacyPolicy.title}</h3>
                <div className="text-sm text-gray-600 whitespace-pre-wrap max-h-[200px] overflow-y-auto p-3 bg-gray-50 rounded-lg border border-gray-100">
                  {policies.privacyPolicy.content}
                </div>
              </div>
            </div>
          )}
          
          <Button onClick={() => setShowAgreement(false)} className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E] text-white rounded-full mt-4 py-3 font-semibold">
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ✅ Helper function to create a default form structure
function createDefaultForm(roleId: string): OnboardingForm {
  // ✅ Create role-specific display names
  const roleNames: Record<string, string> = {
    'pet_clinic': 'Pet Clinic',
    'pet_groomer': 'Pet Grooming Service',
    'pet_trainer': 'Pet Training Service',
    'pet_sitter': 'Pet Sitting Service',
    'pet_walker': 'Pet Walking Service',
    'pet_boarding': 'Pet Boarding Service',
    'pet_store': 'Pet Store',
    'pet_insurance': 'Pet Insurance Provider'
  };

  const roleName = roleNames[roleId] || 'Vendor Service';

  return {
    id: `default-form-${roleId}`,
    roleId,
    roleName,
    version: 1,
    status: 'published',
    sections: [
      {
        id: 'section-business-info',
        name: 'business-info',
        title: 'Business Information',
        description: 'Enter your business details',
        icon: 'Building',
        order: 1,
        isActive: true,
        fields: [
          {
            id: 'field-business-name',
            name: 'businessName',
            label: 'Business Name',
            type: 'text',
            section: 'business-info',
            placeholder: 'Enter your business name',
            helpText: 'Your registered business or company name',
            validation: {
              required: true,
              minLength: 3,
              maxLength: 100
            },
            order: 1,
            isActive: true
          },
          {
            id: 'field-contact-person',
            name: 'contactPerson',
            label: 'Contact Person Name',
            type: 'text',
            section: 'business-info',
            placeholder: 'Enter the contact person name',
            validation: {
              required: true,
              minLength: 2
            },
            order: 2,
            isActive: true
          },
          {
            id: 'field-email',
            name: 'email',
            label: 'Business Email',
            type: 'email',
            section: 'business-info',
            placeholder: 'business@example.com',
            validation: {
              required: true
            },
            order: 3,
            isActive: true
          },
          {
            id: 'field-phone',
            name: 'phone',
            label: 'Business Phone',
            type: 'tel',
            section: 'business-info',
            placeholder: '9876543210',
            helpText: '10-digit mobile number',
            validation: {
              required: true
            },
            order: 4,
            isActive: true
          },
          {
            id: 'field-address',
            name: 'address',
            label: 'Business Address',
            type: 'textarea',
            section: 'business-info',
            placeholder: 'Enter your complete business address',
            validation: {
              required: true,
              minLength: 10
            },
            order: 5,
            isActive: true
          },
          {
            id: 'field-pincode',
            name: 'pincode',
            label: 'Pincode',
            type: 'text',
            section: 'business-info',
            placeholder: '400001',
            validation: {
              required: true,
              minLength: 6,
              maxLength: 6
            },
            order: 6,
            isActive: true
          },
          {
            id: 'field-years-experience',
            name: 'yearsOfExperience',
            label: 'Years of Experience',
            type: 'number',
            section: 'business-info',
            placeholder: 'Enter years of experience',
            validation: {
              required: true,
              min: 0,
              max: 50
            },
            order: 7,
            isActive: true
          }
        ]
      }
    ],
    documentSections: [
      {
        id: 'section-documents',
        name: 'documents',
        title: 'Required Documents',
        description: 'Upload your business documents',
        icon: 'Upload',
        order: 2,
        isActive: true,
        fields: [
          {
            id: 'field-business-license',
            name: 'businessLicense',
            label: 'Business License / Registration Certificate',
            type: 'file',
            section: 'documents',
            documentType: 'license',
            documentLabel: 'Business License',
            acceptedFileTypes: ['image/jpeg', 'image/png', 'application/pdf'],
            helpText: 'Upload a clear image or PDF of your business license',
            validation: {
              required: true
            },
            order: 1,
            isActive: true
          },
          {
            id: 'field-id-proof',
            name: 'idProof',
            label: 'Owner ID Proof (Aadhaar/PAN/Passport)',
            type: 'file',
            section: 'documents',
            documentType: 'id',
            documentLabel: 'ID Proof',
            acceptedFileTypes: ['image/jpeg', 'image/png', 'application/pdf'],
            helpText: 'Government-issued photo ID',
            validation: {
              required: true
            },
            order: 2,
            isActive: true
          }
        ]
      }
    ]
  };
}