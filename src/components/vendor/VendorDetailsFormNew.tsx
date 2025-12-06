import { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/button';
import { 
  ChevronRight, Upload, MapPin, Eye, CheckCircle2, Building2, ArrowLeft 
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'react-toastify';

interface VendorDetailsFormProps {
  vendorId?: string;
  onSubmit?: (data: any) => void;
  onNext?: (data: any) => void;
  onBack?: () => void;
  serviceStyles?: string[]; // Array: ['clinic', 'home'] or just ['clinic'] or just ['home']
}

interface BankDetails {
  accountNumber: string;
  bankName: string;
  ifscCode: string;
  cancelledCheque: File | null;
}

const INDIAN_BANKS = [
  'State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank',
  'Kotak Mahindra Bank', 'IndusInd Bank', 'Yes Bank', 'IDFC First Bank',
  'Bank of Baroda', 'Punjab National Bank', 'Canara Bank', 'Union Bank of India',
  'Indian Bank', 'Central Bank of India', 'Bank of India', 'UCO Bank',
  'Indian Overseas Bank', 'Punjab & Sind Bank', 'Bank of Maharashtra',
  'Federal Bank', 'RBL Bank', 'South Indian Bank', 'Karur Vysya Bank',
  'Tamilnad Mercantile Bank', 'Jammu & Kashmir Bank', 'DCB Bank',
  'City Union Bank', 'Other'
];

export function VendorDetailsForm({ vendorId, onSubmit, onNext, onBack, serviceStyles = ['both'] }: VendorDetailsFormProps) {
  // Determine field requirements
  const hasClinic = serviceStyles.includes('clinic');
  const hasHome = serviceStyles.includes('home');
  const hasBoth = hasClinic && hasHome;
  
  const isBusinessNameRequired = hasClinic;
  const isGSTRequired = hasClinic;
  const isPoliceVerificationRequired = hasHome;

  const [formData, setFormData] = useState({
    fullName: '',
    businessName: '',
    email: '',
    phone: '',
    city: '',
    state: '',
    pincode: '',
    aadhaarNumber: '',
    panNumber: '',
    gstNumber: '',
    address: '',
    experience: '',
  });

  const [aadhaarFiles, setAadhaarFiles] = useState<{ front: File | null; back: File | null }>({
    front: null,
    back: null
  });
  const [gstCertificate, setGstCertificate] = useState<File | null>(null);
  const [policeVerification, setPoliceVerification] = useState<File | null>(null);
  const [bankDetails, setBankDetails] = useState<BankDetails>({
    accountNumber: '',
    bankName: '',
    ifscCode: '',
    cancelledCheque: null
  });

  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [showBankDialog, setShowBankDialog] = useState(false);
  const [customBankName, setCustomBankName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string>('');
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);

  useEffect(() => {
    fetchGoogleMapsApiKey();
  }, []);

  const fetchGoogleMapsApiKey = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/config/google-maps-key`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('[VendorForm] Google Maps API response:', data);
        
        if (data.apiKey) {
          // ✅ VALIDATE: Check if API key looks like a project number
          if (/^\d+$/.test(data.apiKey)) {
            console.error('❌ Invalid API Key: Looks like a project number, not an API key');
            toast.error('Google Maps API key is invalid. Please configure a valid API key.');
            return;
          }
          
          setGoogleMapsApiKey(data.apiKey);
          loadGoogleMapsScript(data.apiKey);
        } else {
          console.error('❌ No API key in response:', data);
          toast.error('Google Maps not available. Address search disabled.');
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Failed to fetch Google Maps API key:', response.status, errorData);
        toast.error(`Address search unavailable: ${errorData.error || 'Server error'}`);
      }
    } catch (error) {
      console.error('❌ Error loading Google Maps API key:', error);
      toast.error('Address search unavailable. Please enter address manually.');
    }
  };

  const loadGoogleMapsScript = (apiKey: string) => {
    if (window.google && window.google.maps) {
      setMapsLoaded(true);
      return;
    }
    
    // Check if script is already being loaded
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      console.log('Google Maps script already loading/loaded');
      return;
    }
    
    if (!apiKey) {
      console.error('Google Maps API key not available');
      return;
    }

    const script = document.createElement('script');
    // ✅ Include marker library for AdvancedMarkerElement with loading=async
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapsLoaded(true);
    script.onerror = () => console.error('Failed to load Google Maps API');
    document.head.appendChild(script);
  };

  const detectCurrentLocation = () => {
    try {
      if (!navigator.geolocation) {
        toast.error('❌ Geolocation is not supported by your browser');
        return;
      }

      if (!googleMapRef.current) {
        toast.error('⚠️ Please wait for the map to load');
        return;
      }
      
      if (!window.google || !window.google.maps) {
        toast.error('⚠️ Map services not available. Please enter address manually.');
        return;
      }

      setDetectingLocation(true);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          try {
            const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
            
            if (googleMapRef.current && window.google && window.google.maps) {
              googleMapRef.current.setCenter(pos);
              googleMapRef.current.setZoom(15);
              const latLng = new google.maps.LatLng(pos.lat, pos.lng);
              placeMarker(latLng);
              reverseGeocode(latLng);
              toast.success('✅ Location detected successfully!');
            }
            
            setDetectingLocation(false);
          } catch (innerError) {
            console.error('Error processing location:', innerError);
            setDetectingLocation(false);
            toast.error('Error processing location. Please enter address manually.');
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          setDetectingLocation(false);
          
          if (error.code === error.PERMISSION_DENIED) {
            toast.error('❌ Location access denied. Please enable location permissions.');
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            toast.error('❌ Location information unavailable. Please try again.');
          } else {
            toast.error('❌ Unable to detect location. Please pin manually on the map.');
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } catch (error) {
      console.error('Error detecting location:', error);
      setDetectingLocation(false);
      toast.error('Location detection failed. Please enter address manually.');
    }
  };

  const initializeMap = () => {
    if (!mapRef.current) {
      console.warn('Map container not available');
      return;
    }
    
    if (!window.google || !window.google.maps) {
      console.warn('Google Maps API not loaded yet');
      return;
    }

    try {
      const map = new google.maps.Map(mapRef.current, {
        center: { lat: 12.9716, lng: 77.5946 },
        zoom: 13,
        zoomControl: true,
        mapTypeControl: false
      });

      googleMapRef.current = map;

      map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          placeMarker(e.latLng);
          reverseGeocode(e.latLng);
        }
      });
    } catch (error) {
      console.error('Error initializing map:', error);
      toast.error('Map initialization failed. Address can still be entered manually.');
    }

    // ✅ DON'T AUTO-DETECT location on first load
    // User should manually click "Detect Location" or pin on map
    // This prevents permission errors on page load
    /*
    if (navigator.geolocation) {
      setDetectingLocation(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
          map.setCenter(pos);
          map.setZoom(15);
          const latLng = new google.maps.LatLng(pos.lat, pos.lng);
          placeMarker(latLng);
          reverseGeocode(latLng);
          setDetectingLocation(false);
          console.log('✅ Auto-detected business location:', pos);
        },
        (error) => {
          console.log('⚠️ Location permission denied or unavailable - vendor can pin manually');
          setDetectingLocation(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    }
    */
  };

  const placeMarker = (location: google.maps.LatLng) => {
    try {
      if (!window.google || !window.google.maps) {
        console.error('Google Maps not available for marker placement');
        return;
      }
      
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }

      // Create a standard Marker for now since AdvancedMarkerElement has complex setup
      // Standard Marker will still work but shows deprecation warning
      const marker = new google.maps.Marker({
        position: location,
        map: googleMapRef.current,
        draggable: true
      });

      markerRef.current = marker;

      setCoordinates({ lat: location.lat(), lng: location.lng() });

      marker.addListener('dragend', () => {
        const pos = marker.getPosition();
        if (pos) {
          setCoordinates({ lat: pos.lat(), lng: pos.lng() });
          reverseGeocode(pos);
        }
      });
    } catch (error) {
      console.error('Error placing marker:', error);
      toast.error('Could not place marker. Please enter coordinates manually.');
    }
  };

  const reverseGeocode = (latLng: google.maps.LatLng) => {
    try {
      if (!window.google || !window.google.maps || !window.google.maps.Geocoder) {
        console.error('Google Maps Geocoder not available');
        toast.error('Address search unavailable. Please enter address manually.');
        return;
      }
      
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: latLng }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          setFormData(prev => ({ ...prev, address: results[0].formatted_address }));
        } else {
          console.error('Geocoding failed:', status);
          if (status === 'OVER_QUERY_LIMIT') {
            toast.error('Address lookup limit reached. Please enter address manually.');
          } else if (status === 'REQUEST_DENIED') {
            toast.error('Address search not available. Please enter address manually.');
          }
        }
      });
    } catch (error) {
      console.error('Error searching address:', error);
      toast.error('Address search failed. Please enter address manually.');
    }
  };

  const handleFileUpload = (field: string, file: File | null, subField?: string) => {
    if (field === 'aadhaar' && subField) {
      setAadhaarFiles(prev => ({ ...prev, [subField]: file }));
    } else if (field === 'gst') {
      setGstCertificate(file);
    } else if (field === 'police') {
      setPoliceVerification(file);
    } else if (field === 'cheque') {
      setBankDetails(prev => ({ ...prev, cancelledCheque: file }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required';
    
    // Business Name required for clinic services
    if (isBusinessNameRequired && !formData.businessName.trim()) {
      newErrors.businessName = 'Business name is required';
    }
    
    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Valid email required';
    }
    
    // Phone validation
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\d{10}$/.test(formData.phone)) {
      newErrors.phone = 'Valid 10-digit phone required';
    }
    
    // City validation
    if (!formData.city.trim()) newErrors.city = 'City is required';
    
    // State validation
    if (!formData.state.trim()) newErrors.state = 'State is required';
    
    // Pincode validation
    if (!formData.pincode.trim()) {
      newErrors.pincode = 'Pincode is required';
    } else if (!/^\d{6}$/.test(formData.pincode)) {
      newErrors.pincode = 'Valid 6-digit pincode required';
    }
    
    if (!formData.aadhaarNumber.match(/^\d{12}$/)) newErrors.aadhaarNumber = 'Valid 12-digit Aadhaar required';
    if (!aadhaarFiles.front) newErrors.aadhaarFront = 'Aadhaar front image required';
    if (!aadhaarFiles.back) newErrors.aadhaarBack = 'Aadhaar back image required';
    if (!formData.address.trim()) newErrors.address = 'Address is required';
    if (!formData.experience.trim()) newErrors.experience = 'Experience is required';
    if (!formData.panNumber.match(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)) newErrors.panNumber = 'Valid PAN required';
    
    // GST required for clinic services
    if (isGSTRequired && !formData.gstNumber) {
      newErrors.gstNumber = 'GST number is required for clinic/center services';
    }
    if (isGSTRequired && !gstCertificate) {
      newErrors.gstCertificate = 'GST certificate is required for clinic/center services';
    }
    
    // Police Verification required for home services
    if (isPoliceVerificationRequired && !policeVerification) {
      newErrors.policeVerification = 'Police verification required for home services';
    }
    
    if (!bankDetails.accountNumber.match(/^\d{9,18}$/)) newErrors.accountNumber = 'Valid account number required';
    if (!bankDetails.bankName) newErrors.bankName = 'Bank name is required';
    if (!bankDetails.ifscCode.match(/^[A-Z]{4}0[A-Z0-9]{6}$/)) newErrors.ifscCode = 'Valid IFSC code required';
    if (!bankDetails.cancelledCheque) newErrors.cancelledCheque = 'Cancelled cheque required';
    if (!agreedToTerms) newErrors.terms = 'You must agree to the terms';

    if (formData.gstNumber && !formData.gstNumber.match(/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/)) {
      newErrors.gstNumber = 'Valid GST number required (15 characters)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      alert('Please fill all required fields correctly');
      return;
    }

    if (onSubmit) {
      onSubmit({
        ...formData,
        aadhaarFiles,
        gstCertificate,
        policeVerification,
        bankDetails,
        coordinates,
        agreedToTerms
      });
    } else if (onNext) {
      onNext({
        ...formData,
        aadhaarFiles,
        gstCertificate,
        policeVerification,
        bankDetails,
        coordinates,
        agreedToTerms
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white w-full max-w-[430px] mx-auto pb-32">
      {/* Back Button */}
      {onBack && (
        <div className="px-6 pt-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-[#FF8C42] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-semibold">Back to Services</span>
          </button>
        </div>
      )}

      {/* Header */}
      <div className="px-6 pt-8 pb-6 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-[#FF8C42] to-[#FF6B35] rounded-full mx-auto mb-6 flex items-center justify-center shadow-lg">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Create Your Profile</h1>
        <p className="text-gray-600 text-sm">Tell us about yourself and your business</p>
      </div>

      {/* Conditional Info Box */}
      <div className="px-6 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-800 text-center">
            {hasBoth && '📋 Both clinic and home services selected - all fields required'}
            {hasClinic && !hasHome && '🏪 Clinic services - Business Name & GST required'}
            {hasHome && !hasClinic && '🏡 Home services - Police Verification required'}
          </p>
        </div>
      </div>

      {/* Form Fields */}
      <div className="px-6 space-y-5">
        {/* Full Name */}
        <div>
          <Label className="text-gray-700 mb-2 block">Full Name *</Label>
          <Input
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            placeholder="e.g., Rajesh Kumar"
            className={`bg-white ${errors.fullName ? 'border-red-500' : ''}`}
          />
          {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
        </div>

        {/* Business Name - Conditional */}
        {isBusinessNameRequired && (
          <div>
            <Label className="text-gray-700 mb-2 block">Business Name *</Label>
            <Input
              value={formData.businessName}
              onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
              placeholder="e.g., Paws & Claws Pet Clinic"
              className={`bg-white ${errors.businessName ? 'border-red-500' : ''}`}
            />
            {errors.businessName && <p className="text-xs text-red-500 mt-1">{errors.businessName}</p>}
          </div>
        )}

        {/* Email */}
        <div>
          <Label className="text-gray-700 mb-2 block">Email Address *</Label>
          <Input
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="e.g., rajesh@example.com"
            className={`bg-white ${errors.email ? 'border-red-500' : ''}`}
          />
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
        </div>

        {/* Phone */}
        <div>
          <Label className="text-gray-700 mb-2 block">Phone Number *</Label>
          <Input
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
            placeholder="1234567890"
            maxLength={10}
            className={`bg-white ${errors.phone ? 'border-red-500' : ''}`}
          />
          {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
        </div>

        {/* City */}
        <div>
          <Label className="text-gray-700 mb-2 block">City *</Label>
          <Input
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            placeholder="e.g., Bangalore"
            className={`bg-white ${errors.city ? 'border-red-500' : ''}`}
          />
          {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city}</p>}
        </div>

        {/* State */}
        <div>
          <Label className="text-gray-700 mb-2 block">State *</Label>
          <Input
            value={formData.state}
            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            placeholder="e.g., Karnataka"
            className={`bg-white ${errors.state ? 'border-red-500' : ''}`}
          />
          {errors.state && <p className="text-xs text-red-500 mt-1">{errors.state}</p>}
        </div>

        {/* Pincode */}
        <div>
          <Label className="text-gray-700 mb-2 block">Pincode *</Label>
          <Input
            value={formData.pincode}
            onChange={(e) => setFormData({ ...formData, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
            placeholder="560001"
            maxLength={6}
            className={`bg-white ${errors.pincode ? 'border-red-500' : ''}`}
          />
          {errors.pincode && <p className="text-xs text-red-500 mt-1">{errors.pincode}</p>}
        </div>

        {/* Aadhaar */}
        <div>
          <Label className="text-gray-700 mb-2 block">Aadhaar Card Number *</Label>
          <Input
            value={formData.aadhaarNumber}
            onChange={(e) => setFormData({ ...formData, aadhaarNumber: e.target.value.replace(/\D/g, '').slice(0, 12) })}
            placeholder="123456789012"
            maxLength={12}
            className={`bg-white ${errors.aadhaarNumber ? 'border-red-500' : ''}`}
          />
          {errors.aadhaarNumber && <p className="text-xs text-red-500 mt-1">{errors.aadhaarNumber}</p>}
          
          <div className="grid grid-cols-2 gap-3 mt-3">
            {['front', 'back'].map((side) => (
              <label key={side} className="block">
                <div className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer hover:border-[#FF8C42] transition-all ${errors[`aadhaar${side.charAt(0).toUpperCase() + side.slice(1)}`] ? 'border-red-500' : 'border-gray-300'} ${aadhaarFiles[side as 'front' | 'back'] ? 'bg-green-50 border-green-500' : 'bg-white'}`}>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileUpload('aadhaar', e.target.files?.[0] || null, side)}
                  />
                  {aadhaarFiles[side as 'front' | 'back'] ? (
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                      <span className="text-xs text-green-700">{side.charAt(0).toUpperCase() + side.slice(1)} Uploaded</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-6 h-6 text-gray-400" />
                      <span className="text-xs text-gray-600">{side.charAt(0).toUpperCase() + side.slice(1)} Side</span>
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Address */}
        <div>
          <Label className="text-gray-700 mb-2 block">Business Address *</Label>
          <Textarea
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="Enter your address or pin location on map below"
            className={`bg-white resize-none ${errors.address ? 'border-red-500' : ''}`}
            rows={3}
          />
          {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address}</p>}
          
          <div className="mt-3 space-y-3">
            {/* Detect Location Button */}
            <button
              type="button"
              onClick={detectCurrentLocation}
              disabled={detectingLocation || !mapsLoaded}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {detectingLocation ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Detecting Location...</span>
                </>
              ) : (
                <>
                  <MapPin className="w-5 h-5" />
                  <span>📍 Detect My Current Location</span>
                </>
              )}
            </button>

            <div className="relative">
              <div className="absolute inset-x-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-4 text-xs text-gray-500">or pin manually</span>
              </div>
            </div>

            <button
              type="button"
              onClick={initializeMap}
              className="w-full bg-[#FF8C42] text-white py-2 rounded-xl text-sm flex items-center justify-center gap-2"
            >
              <MapPin className="w-4 h-4" />
              Show Map
            </button>
            
            <div ref={mapRef} className="w-full h-64 rounded-xl overflow-hidden border border-gray-300" />
            {coordinates && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-3 flex items-center gap-3">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="text-xs text-green-900 flex-1">
                  <p className="font-semibold">✓ Location Selected</p>
                  <p className="text-green-700">Lat: {coordinates.lat.toFixed(6)}, Lng: {coordinates.lng.toFixed(6)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* GST - Conditional */}
        <div>
          <Label className="text-gray-700 mb-2 block">
            GST Number {isGSTRequired ? '*' : '(Optional)'}
          </Label>
          <Input
            value={formData.gstNumber}
            onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
            placeholder="22AAAAA0000A1Z5"
            maxLength={15}
            className={`bg-white ${errors.gstNumber ? 'border-red-500' : ''}`}
          />
          {errors.gstNumber && <p className="text-xs text-red-500 mt-1">{errors.gstNumber}</p>}
          
          {(formData.gstNumber || isGSTRequired) && (
            <div className="mt-3">
              <label className="block">
                <div className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer hover:border-[#FF8C42] transition-all ${errors.gstCertificate ? 'border-red-500' : gstCertificate ? 'bg-green-50 border-green-500' : 'bg-white border-gray-300'}`}>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    className="hidden"
                    onChange={(e) => handleFileUpload('gst', e.target.files?.[0] || null)}
                  />
                  {gstCertificate ? (
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <span className="text-sm text-green-700">{gstCertificate.name}</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <Upload className="w-5 h-5 text-gray-400" />
                      <span className="text-sm text-gray-600">Upload GST Certificate {isGSTRequired && '*'}</span>
                    </div>
                  )}
                </div>
              </label>
              {errors.gstCertificate && <p className="text-xs text-red-500 mt-1">{errors.gstCertificate}</p>}
            </div>
          )}
        </div>

        {/* Experience */}
        <div>
          <Label className="text-gray-700 mb-2 block">Experience *</Label>
          <Input
            value={formData.experience}
            onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
            placeholder="e.g., 5 years of professional dog walking"
            className={`bg-white ${errors.experience ? 'border-red-500' : ''}`}
          />
          {errors.experience && <p className="text-xs text-red-500 mt-1">{errors.experience}</p>}
        </div>

        {/* PAN */}
        <div>
          <Label className="text-gray-700 mb-2 block">PAN Card Number *</Label>
          <Input
            value={formData.panNumber}
            onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })}
            placeholder="ABCDE1234F"
            maxLength={10}
            className={`bg-white ${errors.panNumber ? 'border-red-500' : ''}`}
          />
          {errors.panNumber && <p className="text-xs text-red-500 mt-1">{errors.panNumber}</p>}
        </div>

        {/* Police Verification - Conditional */}
        {isPoliceVerificationRequired && (
          <div>
            <Label className="text-gray-700 mb-2 block">Police Verification Certificate *</Label>
            <label className="block">
              <div className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer hover:border-[#FF8C42] transition-all ${errors.policeVerification ? 'border-red-500' : policeVerification ? 'bg-green-50 border-green-500' : 'bg-white border-gray-300'}`}>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  className="hidden"
                  onChange={(e) => handleFileUpload('police', e.target.files?.[0] || null)}
                />
                {policeVerification ? (
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-green-700">{policeVerification.name}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Upload className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-600">Upload Certificate</span>
                  </div>
                )}
              </div>
            </label>
            {errors.policeVerification && <p className="text-xs text-red-500 mt-1">{errors.policeVerification}</p>}
          </div>
        )}

        {/* Bank Details */}
        <div className="bg-blue-50 rounded-2xl p-5 border border-blue-200">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            Bank Details
          </h3>

          <div className="space-y-4">
            <div>
              <Label className="text-gray-700 mb-2 block">Bank Account Number *</Label>
              <Input
                value={bankDetails.accountNumber}
                onChange={(e) => setBankDetails({ ...bankDetails, accountNumber: e.target.value.replace(/\D/g, '') })}
                placeholder="123456789012"
                className={`bg-white ${errors.accountNumber ? 'border-red-500' : ''}`}
              />
              {errors.accountNumber && <p className="text-xs text-red-500 mt-1">{errors.accountNumber}</p>}
            </div>

            <div>
              <Label className="text-gray-700 mb-2 block">Bank Name *</Label>
              <Select value={bankDetails.bankName} onValueChange={(val) => val === 'Other' ? setShowBankDialog(true) : setBankDetails({ ...bankDetails, bankName: val })}>
                <SelectTrigger className={`bg-white ${errors.bankName ? 'border-red-500' : ''}`}>
                  <SelectValue placeholder="Select your bank" />
                </SelectTrigger>
                <SelectContent>
                  {INDIAN_BANKS.map((bank) => (
                    <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.bankName && <p className="text-xs text-red-500 mt-1">{errors.bankName}</p>}
            </div>

            <div>
              <Label className="text-gray-700 mb-2 block">IFSC Code *</Label>
              <Input
                value={bankDetails.ifscCode}
                onChange={(e) => setBankDetails({ ...bankDetails, ifscCode: e.target.value.toUpperCase() })}
                placeholder="HDFC0001234"
                maxLength={11}
                className={`bg-white ${errors.ifscCode ? 'border-red-500' : ''}`}
              />
              {errors.ifscCode && <p className="text-xs text-red-500 mt-1">{errors.ifscCode}</p>}
            </div>

            <div>
              <Label className="text-gray-700 mb-2 block">Cancelled Cheque *</Label>
              <label className="block">
                <div className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer hover:border-[#FF8C42] transition-all ${errors.cancelledCheque ? 'border-red-500' : bankDetails.cancelledCheque ? 'bg-green-50 border-green-500' : 'bg-white border-gray-300'}`}>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileUpload('cheque', e.target.files?.[0] || null)}
                  />
                  {bankDetails.cancelledCheque ? (
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <span className="text-sm text-green-700">{bankDetails.cancelledCheque.name}</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <Upload className="w-5 h-5 text-gray-400" />
                      <span className="text-sm text-gray-600">Upload Cancelled Cheque</span>
                    </div>
                  )}
                </div>
              </label>
              {errors.cancelledCheque && <p className="text-xs text-red-500 mt-1">{errors.cancelledCheque}</p>}
            </div>
          </div>
        </div>

        {/* Terms */}
        <div className="bg-orange-50 rounded-2xl p-5 border border-orange-200">
          <div className="flex items-start gap-3">
            <Checkbox
              checked={agreedToTerms}
              onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
              className="mt-1"
            />
            <div className="flex-1">
              <p className="text-sm text-gray-800 mb-2">
                I agree to the <button type="button" onClick={() => setShowAgreement(true)} className="text-[#FF8C42] underline font-semibold">Vendor Onboarding Agreement</button> & <button type="button" onClick={() => setShowAgreement(true)} className="text-[#FF8C42] underline font-semibold">Vendor Terms of Services</button>
              </p>
              <button
                type="button"
                onClick={() => setShowAgreement(true)}
                className="text-sm text-[#FF8C42] font-semibold flex items-center gap-1"
              >
                <Eye className="w-4 h-4" />
                View Agreements
              </button>
            </div>
          </div>
          {errors.terms && <p className="text-xs text-red-500 mt-2">{errors.terms}</p>}
        </div>
      </div>

      {/* Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 max-w-[430px] mx-auto">
        <div className="flex gap-3">
          {onBack && (
            <Button
              onClick={onBack}
              variant="outline"
              className="flex-1 py-6 rounded-xl border-[#FF8C42] text-[#FF8C42]"
            >
              Back
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            className="flex-1 bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white py-6 rounded-xl"
          >
            Verify & Continue
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={showBankDialog} onOpenChange={setShowBankDialog}>
        <DialogContent className="max-w-[90%] w-[360px]">
          <DialogHeader>
            <DialogTitle>Enter Bank Name</DialogTitle>
            <DialogDescription>
              Please enter your bank name for payment processing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Input
              value={customBankName}
              onChange={(e) => setCustomBankName(e.target.value)}
              placeholder="Enter your bank name"
            />
            <Button
              onClick={() => {
                if (customBankName.trim()) {
                  setBankDetails({ ...bankDetails, bankName: customBankName });
                  setShowBankDialog(false);
                  setCustomBankName('');
                }
              }}
              className="w-full bg-[#FF8C42]"
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAgreement} onOpenChange={setShowAgreement}>
        <DialogContent className="max-w-[90%] w-[380px] max-h-[80vh] overflow-y-auto">
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
                <p>3. The vendor will maintain professional conduct with all customers.</p>
                <p>4. Payment will be processed as per the agreed commission structure.</p>
                <p>5. The vendor can be suspended for policy violations.</p>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-gray-800 mb-3">Terms of Service</h3>
              <div className="text-sm text-gray-600 space-y-2">
                <p>1. Commission: Platform charges 15% on all bookings.</p>
                <p>2. Payments are processed weekly to the registered bank account.</p>
                <p>3. Customer ratings below 3.5 may result in account review.</p>
                <p>4. Cancellation charges apply as per platform policy.</p>
                <p>5. Vendors must maintain valid certifications and documents.</p>
              </div>
            </div>
            <Button onClick={() => setShowAgreement(false)} className="w-full bg-[#FF8C42]">Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Export with alias for backward compatibility
export { VendorDetailsForm as VendorDetailsFormNew };