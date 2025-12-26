import { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Upload, MapPin, AlertCircle, CheckCircle2, ArrowLeft, X, User, Check } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface FormField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'tel' | 'textarea' | 'select' | 'multiselect' | 'checkbox' | 'radio' | 'date' | 'file' | 'map_pin';
  section: string;
  placeholder?: string;
  helpText?: string;
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
  
  // Map location
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string>('');

  // ✅ NEW: Specialization selection for center/vendor
  const [availableSpecializations, setAvailableSpecializations] = useState<any[]>([]);
  const [selectedSpecializations, setSelectedSpecializations] = useState<string[]>([]);
  const [loadingSpecializations, setLoadingSpecializations] = useState(false);
  const [showSpecializationDialog, setShowSpecializationDialog] = useState(false);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

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

  useEffect(() => {
    console.log('🚀 [INIT] Component mounted, starting initialization...');
    console.log('🚀 [INIT] roleId:', roleId);
    checkServerHealth();
    
    // ✅ FIX: Safely access environment variable with fallback
    console.log('🔍 [ENV] Checking for environment variable...');
    console.log('🔍 [ENV] import.meta exists:', typeof import.meta !== 'undefined');
    console.log('🔍 [ENV] import.meta.env exists:', !!(import.meta && import.meta.env));
    
    const envApiKey = typeof import.meta !== 'undefined' && 
                      import.meta.env && 
                      import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    console.log('🔍 [ENV] envApiKey exists:', !!envApiKey);
    console.log('🔍 [ENV] envApiKey value:', envApiKey ? `${envApiKey.substring(0, 10)}...` : 'null/undefined');
    
    if (envApiKey) {
      console.log('✅ [ENV] Using Google Maps API key from environment variable');
      setGoogleMapsApiKey(envApiKey);
    } else {
      console.log('⚠️ [ENV] No environment variable found, fetching from backend...');
      fetchGoogleMapsKey();
    }
    
    fetchForm();
    loadSpecializations(); // ✅ NEW: Load specializations when component mounts
  }, [roleId]);

  // ✅ NEW: Load available specializations from backend
  const loadSpecializations = async () => {
    try {
      setLoadingSpecializations(true);
      console.log('[DYNAMIC FORM] Loading specializations for roleId:', roleId);
      
      const response = await fetch(
        `${API_BASE}/vendor/problem-grid-specializations/${roleId}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      console.log('[DYNAMIC FORM] Specializations response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[DYNAMIC FORM] Specializations loaded:', data);
        setAvailableSpecializations(data.specializations || []);
        
        // Pre-select specializations from initialData if editing
        if (initialData?.specializations) {
          setSelectedSpecializations(initialData.specializations);
        }
      } else {
        const errorText = await response.text();
        console.error('[DYNAMIC FORM] Failed to load specializations:', errorText);
        // Don't show error toast - specializations might not be applicable for this role
      }
    } catch (error) {
      console.error('[DYNAMIC FORM] Error loading specializations:', error);
    } finally {
      setLoadingSpecializations(false);
    }
  };

  // ✅ NEW: Toggle specialization selection
  const toggleSpecialization = (specId: string) => {
    setSelectedSpecializations(prev => {
      if (prev.includes(specId)) {
        return prev.filter(id => id !== specId);
      } else {
        return [...prev, specId];
      }
    });
  };

  const fetchGoogleMapsKey = async () => {
    console.log('🔑 [API KEY] Fetching Google Maps API key from backend...');
    try {
      const response = await fetch(`${API_BASE}/admin/integrations/settings`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      
      console.log('🔑 [API KEY] Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('🔑 [API KEY] Response data:', data);
        
        if (data.settings?.googleMaps?.apiKey) {
          console.log('✅ [API KEY] Found API key in backend settings');
          console.log('🔑 [API KEY] Key length:', data.settings.googleMaps.apiKey.length);
          setGoogleMapsApiKey(data.settings.googleMaps.apiKey);
        } else {
          console.warn('⚠️ [API KEY] No Google Maps API key found in backend settings');
          console.warn('⚠️ [API KEY] Settings structure:', JSON.stringify(data.settings, null, 2));
          toast.warning('Google Maps not configured. Please contact administrator.');
        }
      } else {
        console.error('❌ [API KEY] Failed to fetch settings, status:', response.status);
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

  const checkServerHealth = async () => {
    try {
      console.log('[DYNAMIC FORM] 🏥 Checking server health...');
      const response = await fetch(`${API_BASE}/health`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('[DYNAMIC FORM] ✅ Server is healthy:', data);
      } else {
        console.error('[DYNAMIC FORM] ⚠️ Server health check failed:', response.status);
        toast.error('Backend server may not be running. Please check deployment.');
      }
    } catch (error) {
      console.error('[DYNAMIC FORM] ❌ Server unreachable:', error);
      console.error('[DYNAMIC FORM] 💡 Tip: Edge Function may not be deployed to Supabase');
      toast.error('Cannot connect to backend server. Please check Supabase Edge Functions.');
    }
  };

  const fetchForm = async () => {
    try {
      setLoading(true);
      console.log('[DYNAMIC FORM] Fetching form for roleId:', roleId);
      console.log('[DYNAMIC FORM] API URL:', `${API_BASE}/vendor/onboarding-form/${roleId}`);
      
      // ✅ CRITICAL: Add cache-busting to ensure we get the latest published version
      const timestamp = Date.now();
      const response = await fetch(`${API_BASE}/vendor/onboarding-form/${roleId}?t=${timestamp}&v=latest`, {
        headers: { 
          'Authorization': `Bearer ${publicAnonKey}`
          // ✅ Removed cache-control headers to avoid CORS issues - using query params for cache-busting instead
        }
      });

      console.log('[DYNAMIC FORM] Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[DYNAMIC FORM] ✅ Form loaded:', data);
        console.log('[DYNAMIC FORM] 📋 Version:', data.form?.version, 'Status:', data.form?.status);
        
        // ✅ CRITICAL: Verify version is present and is a number
        if (data.form && (!data.form.version || typeof data.form.version !== 'number')) {
          console.error('[DYNAMIC FORM] ⚠️ WARNING: Form version is missing or invalid!', {
            version: data.form.version,
            version_type: typeof data.form.version
          });
          // Set default version if missing
          data.form.version = data.form.version || 1;
        }
        
        // ✅ CRITICAL: Log version for debugging
        console.log('[DYNAMIC FORM] ✅ Loaded form version:', data.form?.version);
        
        if (data.autoGenerated) {
          console.log('[DYNAMIC FORM] 🎉 Auto-generated active form received from backend');
          toast.success('Onboarding form loaded successfully');
        }
        
        setForm(data.form);
      } else {
        const errorText = await response.text();
        console.error('[DYNAMIC FORM] ❌ Failed to load form. Status:', response.status);
        console.error('[DYNAMIC FORM] ❌ Error response:', errorText);
        toast.error(`Failed to load form: ${response.status}`);
      }
    } catch (error) {
      console.error('[DYNAMIC FORM] ❌ Fetch Error:', error);
      console.error('[DYNAMIC FORM] ❌ Error details:', {
        message: error instanceof Error ? error.message : String(error),
        roleId,
        apiBase: API_BASE
      });
      toast.error('Cannot connect to backend server. Please check Supabase Edge Functions.');
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
    
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&callback=initGoogleMaps`;
    script.async = true;
    script.defer = true;
    
    // Define global callback
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
    
    script.onerror = (error) => {
      console.error('❌ [GOOGLE MAPS] Script loading error:', error);
      toast.error('Failed to load Google Maps. Please check your internet connection.');
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
        
        // Use simple, direct Google Maps API
        const map = new (window as any).google.maps.Map(mapRef.current, {
          center: { lat: 20.5937, lng: 78.9629 }, // India center
          zoom: 5,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        googleMapRef.current = map;
        console.log('✅ [MAP INIT] Map instance created successfully');

        // Create marker
        console.log('🗺️ [MAP INIT] Creating marker...');
        const marker = new (window as any).google.maps.Marker({
          map: map,
          position: { lat: 20.5937, lng: 78.9629 },
          draggable: true,
          title: 'Your Business Location'
        });

        markerRef.current = marker;
        console.log('✅ [MAP INIT] Marker created successfully');
        
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
        toast.success('Map loaded successfully! Click or drag to set your location.');

    } catch (e) {
        console.error('❌ [MAP INIT] Error initializing map:', e);
        toast.error('Failed to initialize map. Please refresh the page.');
    }
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData({ ...formData, [fieldName]: value });
    // Clear error when user types
    if (errors[fieldName]) {
      setErrors({ ...errors, [fieldName]: '' });
    }
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

  const validateForm = (): boolean => {
    console.log('🔍 [VALIDATION] Starting form validation...');
    console.log('🔍 [VALIDATION] Current documents state:', documents);
    console.log('🔍 [VALIDATION] Document keys:', Object.keys(documents));
    console.log('🔍 [VALIDATION] Document values:', Object.values(documents).map(d => d?.name || 'null'));
    
    const newErrors: Record<string, string> = {};

    if (!form) return false;

    // ✅ PHASE 1 FIX 1.1: Find map_pin field for validation
    const mapPinField = form.sections
      .flatMap(s => s.fields)
      .find(f => f.type === 'map_pin');
    
    // Create enhanced formData for validation (includes coordinates if set)
    const validationFormData = { ...formData };
    if (mapPinField && coordinates) {
      // Include coordinates in validation data (don't mutate state during validation)
      validationFormData[mapPinField.name] = coordinates;
      validationFormData.location = coordinates;
      validationFormData.coordinates = coordinates;
    }

    // Validate all sections
    form.sections.forEach(section => {
      section.fields.forEach(field => {
        if (!field.isActive) return;

        let value = validationFormData[field.name];
        
        // Handle special field types
        if (field.type === 'file') {
          value = documents[field.name];
          // ✅ PHASE 1 FIX 1.2: Validate required file fields (already correct, verified)
          if (field.validation?.required) {
            const isEmpty = !value || (Array.isArray(value) && value.length === 0);
            if (isEmpty) {
              console.log(`❌ [VALIDATION] Required file field missing: ${field.name}`);
              newErrors[field.name] = `${field.label} is required`;
            } else {
              console.log(`✅ [VALIDATION] Required file field present: ${field.name}`);
            }
          } else if (value) {
            console.log(`✅ [VALIDATION] File field present: ${field.name}`);
          }
          // Skip further validation for file fields
        } else if (field.type === 'map_pin') {
          // ✅ PHASE 1 FIX 1.1: Check coordinates state, formData[field.name], and formData.location
          // PIN alone satisfies requirement - "Detect Location" is optional
          // Priority: coordinates state > validationFormData[field.name] > validationFormData.location
          value = coordinates || validationFormData[field.name] || validationFormData.location;
          
          // If field is required, validate that we have location data
          if (field.validation?.required && !value) {
            console.log(`❌ [VALIDATION] Required PIN location missing: ${field.name}`);
            newErrors[field.name] = `${field.label} is required. Please pin your location on the map.`;
          } else if (value) {
            console.log(`✅ [VALIDATION] Location present: ${field.name}`, value);
          }
          // Skip further validation for map_pin fields - coordinates object is valid
        } else {
          // Required validation (for non-map_pin, non-file fields)
          const isEmpty = !value || value === '' || (Array.isArray(value) && value.length === 0);
          
          if (field.validation?.required && isEmpty) {
            console.log(`❌ [VALIDATION] Required field missing: ${field.name}`);
            newErrors[field.name] = `${field.label} is required`;
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

          // Email validation
          if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            newErrors[field.name] = 'Invalid email address';
          }

          // Phone validation (basic)
          if (field.type === 'tel' && value && !/^\d{10}$/.test(value.replace(/\D/g, ''))) {
            newErrors[field.name] = 'Invalid phone number';
          }
        }
      });
    });

    // Validate document sections
    console.log('🔍 [VALIDATION] Validating document sections...');
    if (form.documentSections) {
      form.documentSections.forEach(section => {
        console.log(`🔍 [VALIDATION] Checking section: ${section.name}`);
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
      toast.error('Please accept the terms and conditions');
      newErrors['terms'] = 'You must accept the terms';
    } else {
      console.log('✅ [VALIDATION] Terms agreed');
    }

    console.log('🔍 [VALIDATION] Total errors found:', Object.keys(newErrors).length);
    console.log('🔍 [VALIDATION] Error details:', newErrors);

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Helper to upload a single file
  const uploadFile = async (file: File, path: string = 'uploads'): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);

    const response = await fetch(`${API_BASE}/upload/unified`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Upload failed');
    }

    return data.url;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    
    try {
      // 1. Upload all files first
      const uploadedDocuments: Record<string, any> = {};
      
      const fileUploadPromises = Object.keys(documents).map(async (key) => {
        const file = documents[key];
        if (file) {
          try {
            toast.info(`Uploading ${key}...`);
            const url = await uploadFile(file, `vendor-docs/${roleId}`);
            uploadedDocuments[key] = {
              name: file.name,
              type: file.type,
              size: file.size,
              url: url
            };
            console.log(`✅ Uploaded ${key}: ${url}`);
          } catch (err) {
            console.error(`Failed to upload ${key}:`, err);
            throw new Error(`Failed to upload ${key}`);
          }
        }
      });

      await Promise.all(fileUploadPromises);

      // 2. Prepare submission data with uploaded file URLs
      // ✅ FIX: Find map_pin field name and store coordinates in field-specific location
      const mapPinField = form?.sections
        .flatMap(s => s.fields)
        .find(f => f.type === 'map_pin');
      
      const enhancedFormData = {
        ...formData,
        coordinates, // Keep for backward compatibility
        location: coordinates, // Standard location field
      };
      
      // Store coordinates in field-specific location if map_pin field exists
      if (mapPinField && coordinates) {
        enhancedFormData[mapPinField.name] = coordinates;
      }
      
      const submissionData = {
        roleId,
        formData: enhancedFormData,
        documents: uploadedDocuments, // Send the object with URLs
        serviceStyles,
        location: coordinates, // Top-level location for backend
        specializations: selectedSpecializations, // ✅ NEW: Include specializations
        agreedToTerms,
        formVersion: form?.version,
        vendorId: vendorId, // ✅ NEW: Include vendorId for edit mode
        isEditMode: isEditMode, // ✅ NEW: Flag for edit vs create
      };

      console.log('[DYNAMIC FORM] Submitting:', submissionData);
      console.log('[DYNAMIC FORM] Selected specializations:', selectedSpecializations);
      await onSubmit(submissionData);
      
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
                  ⚠️ Google Maps API key is not configured. Please contact support or configure VITE_GOOGLE_MAPS_API_KEY in environment variables.
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

      default: // text, number, email, tel
        return (
          <Input
            type={field.type}
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            className={commonClasses}
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

  // ✅ Check if form has empty sections (no published form)
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

      {/* Main Content Card */}
      <div className="bg-white rounded-t-[40px] px-6 py-8 flex-1 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] min-h-[calc(100vh-220px)]">
        
        {/* Intro Text */}
        <div className="text-center mb-8 px-4">
           <p className="text-sm text-gray-600 leading-relaxed">
             Please complete the following details to register your business on Warmpawz.
           </p>
        </div>

        {/* Form Sections */}
        <div className="space-y-8 pb-32">
          {form.sections.filter(s => s.isActive).map((section) => (
            <div key={section.id} className="space-y-6">
              {/* Section Header */}
              {form.sections.length > 1 && (
                  <div className="flex items-center gap-3 pb-2 border-b border-gray-100">
                    <h3 className="font-bold text-lg text-gray-900">{section.title}</h3>
                  </div>
              )}

              <div className="space-y-5">
                {section.fields
                  .filter(f => f.isActive)
                  .sort((a, b) => a.order - b.order)
                  .map((field) => (
                    <div key={field.id}>
                      {field.type !== 'checkbox' && (
                        <Label className="text-sm font-semibold text-gray-900 mb-2 block ml-1">
                          {field.label}
                          {field.validation?.required && (
                            <span className="text-red-500 ml-0.5">*</span>
                          )}
                        </Label>
                      )}
                      
                      {renderField(field)}
                      
                      {field.helpText && (
                        <p className="text-xs text-gray-400 mt-1.5 ml-1">{field.helpText}</p>
                      )}
                      
                      {errors[field.name] && (
                        <p className="text-xs text-red-500 mt-1.5 ml-1 flex items-center gap-1 font-medium">
                          {errors[field.name]}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}

          {/* Document Sections */}
          {form.documentSections?.map((section) => (
            <div key={section.id} className="space-y-6 pt-2">
              <div className="flex items-center gap-3 pb-2 border-b border-gray-100">
                 <h3 className="font-bold text-lg text-gray-900">{section.title}</h3>
              </div>

              <div className="space-y-5">
                {section.fields
                  .filter(f => f.isActive)
                  .sort((a, b) => a.order - b.order)
                  .map((field) => (
                    <div key={field.id}>
                      <Label className="text-sm font-semibold text-gray-900 mb-2 block ml-1">
                        {field.label}
                        {field.validation?.required && (
                          <span className="text-red-500 ml-0.5">*</span>
                        )}
                      </Label>
                      
                      {renderField(field)}
                      
                      {field.helpText && (
                        <p className="text-xs text-gray-400 mt-1.5 ml-1">{field.helpText}</p>
                      )}
                      
                      {errors[field.name] && (
                        <p className="text-xs text-red-500 mt-1.5 ml-1 font-medium">
                          {errors[field.name]}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}

          {/* ✅ NEW: Specialization Selection (if available) */}
          {availableSpecializations.length > 0 && (
            <div className="space-y-6 pt-2">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <h3 className="font-bold text-lg text-gray-900">Specializations</h3>
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium">
                  {selectedSpecializations.length} selected
                </span>
              </div>
              
              <p className="text-xs text-gray-600">
                Select areas of expertise. Your center will appear in customer searches for these services.
              </p>

              {loadingSpecializations ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF8C42] mx-auto mb-2"></div>
                  <p className="text-sm text-gray-500">Loading specializations...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {availableSpecializations.map((spec) => {
                    const isSelected = selectedSpecializations.includes(spec.id);
                    return (
                      <div
                        key={spec.id}
                        onClick={() => toggleSpecialization(spec.id)}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#FF8C42] bg-orange-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                            isSelected
                              ? 'border-[#FF8C42] bg-[#FF8C42]'
                              : 'border-gray-300'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{spec.name}</p>
                            <p className="text-xs text-gray-600 mt-0.5">{spec.description}</p>
                            
                            {spec.helpsWithProblems && spec.helpsWithProblems.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {spec.helpsWithProblems.map((problem: any) => (
                                  <span
                                    key={problem.id}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs"
                                  >
                                    <span>{problem.icon}</span>
                                    <span>{problem.name}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Terms & Conditions */}
          <div className="pt-4">
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-gray-50 border border-gray-100">
              <Checkbox
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
        <DialogContent className="max-w-[90%] rounded-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vendor Agreements</DialogTitle>
            <DialogDescription>
              Review the vendor onboarding agreement and terms of service.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            <div>
              <h3 className="font-bold text-gray-800 mb-3">Vendor Onboarding Agreement</h3>
              <div className="text-sm text-gray-600 space-y-2">
                <p>1. The vendor agrees to provide services as per the platform standards.</p>
                <p>2. All information provided must be accurate and verifiable.</p>
                <p>3. The vendor must complete all required documents and certifications.</p>
                <p>4. Services will be activated only after admin approval.</p>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-gray-800 mb-3">Terms of Service</h3>
              <div className="text-sm text-gray-600 space-y-2">
                <p>1. The platform reserves the right to approve or reject applications.</p>
                <p>2. All bookings are subject to customer OTP verification.</p>
                <p>3. Vendors must provide service reports after each booking.</p>
                <p>4. Payment settlements are processed as per platform policy.</p>
              </div>
            </div>
          </div>
          <Button onClick={() => setShowAgreement(false)} className="w-full bg-[#FF8C42] rounded-full mt-4">
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