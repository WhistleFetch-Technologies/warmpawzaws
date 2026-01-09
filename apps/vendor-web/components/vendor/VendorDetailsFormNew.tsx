'use client';

import { useState, useRef, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { 
  ChevronRight, Upload, MapPin, Eye, CheckCircle2, Building2, ArrowLeft, AlertCircle, Loader2 
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { projectId, publicAnonKey } from '@/lib/supabase/info';
import { toast } from 'sonner';

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
  verified: boolean;
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

export function VendorDetailsFormNew({ vendorId, onSubmit, onNext, onBack, serviceStyles = ['both'] }: VendorDetailsFormProps) {
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
    gstVerified: false,
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
    cancelledCheque: null,
    verified: false
  });

  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [showBankDialog, setShowBankDialog] = useState(false);
  const [customBankName, setCustomBankName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [verifyingGST, setVerifyingGST] = useState(false);
  const [verifyingBank, setVerifyingBank] = useState(false);

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
      const data = await apiClient.get('/config/google-maps-key');
      if (data.apiKey && !/^\d+$/.test(data.apiKey)) {
        setGoogleMapsApiKey(data.apiKey);
        loadGoogleMapsScript(data.apiKey);
      } 
    } catch (error) {
      console.error('Error loading Google Maps API key:', error);
    }
  };

  const loadGoogleMapsScript = (apiKey: string) => {
    if (window.google && window.google.maps) {
      setMapsLoaded(true);
      return;
    }
    if (document.querySelector('script[src*="maps.googleapis.com"]')) return;
    
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapsLoaded(true);
    document.head.appendChild(script);
  };

  const verifyGST = async () => {
      if (!formData.gstNumber) return toast.error("Enter GST Number first");
      setVerifyingGST(true);
      try {
          const data = await apiClient.post('/verify/gst', {
              gstNumber: formData.gstNumber,
              businessName: formData.businessName
          });
          if (data.success && data.valid) {
              setFormData(prev => ({ ...prev, gstVerified: true }));
              toast.success("GST Verified Successfully!");
          } else {
              setFormData(prev => ({ ...prev, gstVerified: false }));
              toast.error("GST Verification Failed: Invalid GSTIN");
          }
      } catch (e) {
          toast.error("Verification service unavailable");
      } finally {
          setVerifyingGST(false);
      }
  };

  const verifyBank = async () => {
      if (!bankDetails.accountNumber || !bankDetails.ifscCode) return toast.error("Enter Account Number and IFSC first");
      setVerifyingBank(true);
      try {
          const data = await apiClient.post('/verify/bank', {
              accountNumber: bankDetails.accountNumber,
              ifsc: bankDetails.ifscCode,
              accountHolderName: formData.fullName
          });
          if (data.success && data.valid) {
              setBankDetails(prev => ({ ...prev, verified: true }));
              toast.success("Bank Account Verified (Penny Drop Success)!");
          } else {
              setBankDetails(prev => ({ ...prev, verified: false }));
              toast.error("Bank Verification Failed");
          }
      } catch (e) {
          toast.error("Verification service unavailable");
      } finally {
          setVerifyingBank(false);
      }
  };

  const detectCurrentLocation = () => {
    if (!navigator.geolocation) return toast.error('Geolocation not supported');
    if (!googleMapRef.current) return toast.error('Map not ready');
    
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
        if (googleMapRef.current) {
            googleMapRef.current.setCenter(pos);
            googleMapRef.current.setZoom(15);
            const latLng = new google.maps.LatLng(pos.lat, pos.lng);
            placeMarker(latLng);
            reverseGeocode(latLng);
            toast.success('Location detected');
        }
        setDetectingLocation(false);
      },
      () => {
        setDetectingLocation(false);
        toast.error('Location access denied');
      }
    );
  };

  const initializeMap = () => {
    if (!mapRef.current || !window.google || !window.google.maps) return;
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
    } catch (error) { console.error(error); }
  };

  const placeMarker = (location: google.maps.LatLng) => {
    if (!window.google || !window.google.maps) return;
    if (markerRef.current) markerRef.current.setMap(null);
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
  };

  const reverseGeocode = (latLng: google.maps.LatLng) => {
    if (!window.google || !window.google.maps) return;
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: latLng }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        setFormData(prev => ({ ...prev, address: results[0].formatted_address }));
      }
    });
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
    if (isBusinessNameRequired && !formData.businessName.trim()) newErrors.businessName = 'Business name is required';
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Valid email required';
    if (!formData.phone.trim() || !/^\d{10}$/.test(formData.phone)) newErrors.phone = 'Valid 10-digit phone required';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.state.trim()) newErrors.state = 'State is required';
    if (!formData.pincode.trim() || !/^\d{6}$/.test(formData.pincode)) newErrors.pincode = 'Valid 6-digit pincode required';
    if (!formData.aadhaarNumber.match(/^\d{12}$/)) newErrors.aadhaarNumber = 'Valid 12-digit Aadhaar required';
    if (!aadhaarFiles.front || !aadhaarFiles.back) newErrors.aadhaar = 'Aadhaar images required';
    if (!formData.address.trim()) newErrors.address = 'Address is required';
    if (!formData.experience.trim()) newErrors.experience = 'Experience is required';
    if (!formData.panNumber.match(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)) newErrors.panNumber = 'Valid PAN required';
    
    if (isGSTRequired && !formData.gstNumber) newErrors.gstNumber = 'GST number required';
    if (isGSTRequired && !gstCertificate) newErrors.gstCertificate = 'GST certificate required';
    if (isPoliceVerificationRequired && !policeVerification) newErrors.policeVerification = 'Police verification required';
    
    if (!bankDetails.accountNumber.match(/^\d{9,18}$/)) newErrors.accountNumber = 'Valid account number required';
    if (!bankDetails.bankName) newErrors.bankName = 'Bank name required';
    if (!bankDetails.ifscCode.match(/^[A-Z]{4}0[A-Z0-9]{6}$/)) newErrors.ifscCode = 'Valid IFSC required';
    if (!bankDetails.cancelledCheque) newErrors.cancelledCheque = 'Cancelled cheque required';
    if (!agreedToTerms) newErrors.terms = 'You must agree to the terms';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      toast.error('Please fix form errors');
      return;
    }
    const data = { ...formData, aadhaarFiles, gstCertificate, policeVerification, bankDetails, coordinates, agreedToTerms };
    if (onSubmit) onSubmit(data);
    else if (onNext) onNext(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white w-full max-w-[430px] mx-auto pb-32">
      {onBack && (
        <div className="px-6 pt-6">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-[#FF8C42]">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-semibold">Back</span>
          </button>
        </div>
      )}

      <div className="px-6 pt-8 pb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Complete Profile</h1>
        <p className="text-gray-600 text-sm">Enter your business & payment details</p>
      </div>

      <div className="px-6 space-y-5">
        <div>
          <Label className="mb-1.5 block text-gray-700">Full Name *</Label>
          <Input value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className={errors.fullName ? 'border-red-500' : ''} />
        </div>

        {isBusinessNameRequired && (
          <div>
            <Label className="mb-1.5 block text-gray-700">Business Name *</Label>
            <Input value={formData.businessName} onChange={e => setFormData({...formData, businessName: e.target.value})} className={errors.businessName ? 'border-red-500' : ''} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
            <div>
                <Label className="mb-1.5 block text-gray-700">Phone *</Label>
                <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} maxLength={10} className={errors.phone ? 'border-red-500' : ''} />
            </div>
            <div>
                <Label className="mb-1.5 block text-gray-700">Email *</Label>
                <Input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className={errors.email ? 'border-red-500' : ''} />
            </div>
        </div>

        <div>
            <Label className="mb-1.5 block text-gray-700">Address *</Label>
            <Textarea value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className={errors.address ? 'border-red-500' : ''} />
            
            <div className="mt-2 flex gap-2">
                <button onClick={detectCurrentLocation} disabled={detectingLocation} className="flex-1 bg-blue-50 text-blue-600 text-xs py-2 rounded-lg flex items-center justify-center gap-1 font-medium">
                   {detectingLocation ? <Loader2 className="w-3 h-3 animate-spin"/> : <MapPin className="w-3 h-3" />} Detect
                </button>
                <button onClick={initializeMap} className="flex-1 bg-gray-100 text-gray-600 text-xs py-2 rounded-lg font-medium">Show Map</button>
            </div>
            <div ref={mapRef} className="w-full h-40 mt-2 rounded-lg bg-gray-100 border overflow-hidden" />
        </div>

        {/* GST Section */}
        <div className="space-y-3 pt-4 border-t">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#FF8C42]" /> Compliance
            </h3>
            <div>
                <Label className="mb-1.5 block text-gray-700">GST Number {isGSTRequired && '*'}</Label>
                <div className="flex gap-2">
                    <Input 
                        value={formData.gstNumber} 
                        onChange={e => setFormData({...formData, gstNumber: e.target.value.toUpperCase(), gstVerified: false})} 
                        placeholder="29ABCDE1234F1Z5"
                        className={errors.gstNumber ? 'border-red-500' : ''}
                    />
                    <Button 
                        type="button" 
                        onClick={verifyGST} 
                        disabled={verifyingGST || formData.gstVerified || !formData.gstNumber}
                        className={`${formData.gstVerified ? 'bg-green-600' : 'bg-gray-900'} text-white w-24`}
                    >
                        {verifyingGST ? <Loader2 className="w-4 h-4 animate-spin" /> : formData.gstVerified ? <CheckCircle2 className="w-4 h-4" /> : 'Verify'}
                    </Button>
                </div>
                {formData.gstVerified && <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Verified Entity</p>}
            </div>
            
            {isGSTRequired && (
                <div>
                    <Label className="mb-1.5 block text-gray-700">GST Certificate *</Label>
                    <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center cursor-pointer hover:border-[#FF8C42]" onClick={() => document.getElementById('gst-upload')?.click()}>
                         <input id="gst-upload" type="file" className="hidden" onChange={e => handleFileUpload('gst', e.target.files?.[0] || null)} />
                         {gstCertificate ? <span className="text-green-600 text-xs font-medium">{gstCertificate.name}</span> : <span className="text-gray-500 text-xs">Click to upload PDF/Image</span>}
                    </div>
                </div>
            )}
        </div>

        {/* Bank Details */}
        <div className="space-y-3 pt-4 border-t">
             <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <CreditCardIcon className="w-4 h-4 text-[#FF8C42]" /> Bank Account
            </h3>
            <div>
                <Label className="mb-1.5 block text-gray-700">Account Number *</Label>
                <Input value={bankDetails.accountNumber} onChange={e => setBankDetails({...bankDetails, accountNumber: e.target.value, verified: false})} className={errors.accountNumber ? 'border-red-500' : ''} />
            </div>
            <div>
                <Label className="mb-1.5 block text-gray-700">IFSC Code *</Label>
                <div className="flex gap-2">
                    <Input value={bankDetails.ifscCode} onChange={e => setBankDetails({...bankDetails, ifscCode: e.target.value.toUpperCase(), verified: false})} className={errors.ifscCode ? 'border-red-500' : ''} />
                    <Button 
                        type="button" 
                        onClick={verifyBank} 
                        disabled={verifyingBank || bankDetails.verified || !bankDetails.accountNumber}
                        className={`${bankDetails.verified ? 'bg-green-600' : 'bg-gray-900'} text-white w-24`}
                    >
                        {verifyingBank ? <Loader2 className="w-4 h-4 animate-spin" /> : bankDetails.verified ? <CheckCircle2 className="w-4 h-4" /> : 'Verify'}
                    </Button>
                </div>
                 {bankDetails.verified && <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Beneficiary Validated</p>}
            </div>
            <div>
                <Label className="mb-1.5 block text-gray-700">Cancelled Cheque *</Label>
                 <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center cursor-pointer hover:border-[#FF8C42]" onClick={() => document.getElementById('cheque-upload')?.click()}>
                         <input id="cheque-upload" type="file" className="hidden" onChange={e => handleFileUpload('cheque', e.target.files?.[0] || null)} />
                         {bankDetails.cancelledCheque ? <span className="text-green-600 text-xs font-medium">{bankDetails.cancelledCheque.name}</span> : <span className="text-gray-500 text-xs">Click to upload</span>}
                </div>
            </div>
        </div>

        <div className="pt-6">
            <Button className="w-full bg-[#FF8C42] hover:bg-[#e67a30] text-white h-12 text-lg" onClick={handleSubmit}>
                Submit Application
            </Button>
        </div>
      </div>
    </div>
  );
}

function CreditCardIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  )
}
