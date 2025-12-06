import { useState, useEffect, useRef } from 'react';
import { MapPin, Upload, FileText, Building, Phone, Mail, CreditCard, Shield, Save, CheckCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Card } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface DocumentUpload {
  front?: { file: File; preview: string };
  back?: { file: File; preview: string };
}

export function OnboardingConfiguration() {
  const [roles, setRoles] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form Data
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  
  // Location
  const [location, setLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  
  // Documents
  const [aadharCard, setAadharCard] = useState<DocumentUpload>({});
  const [panCard, setPanCard] = useState<DocumentUpload>({});
  const [gstCertificate, setGstCertificate] = useState<DocumentUpload>({});
  const [professionalLicense, setProfessionalLicense] = useState<DocumentUpload>({});
  const [policeVerification, setPoliceVerification] = useState<DocumentUpload>({});
  const [establishmentCert, setEstablishmentCert] = useState<DocumentUpload>({});
  const [insuranceCert, setInsuranceCert] = useState<DocumentUpload>({});

  useEffect(() => {
    fetchRoles();
    loadGoogleMapsScript();
  }, []);

  useEffect(() => {
    if (mapLoaded && mapRef.current) {
      initializeMap();
    }
  }, [mapLoaded]);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/config/roles`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setRoles(data.roles || []);
        if (data.roles && data.roles.length > 0) {
          setSelectedRole(data.roles[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const loadGoogleMapsScript = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/config/google-maps-key`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.apiKey && !window.google) {
          // Check if script is already being loaded
          if (document.querySelector('script[src*="maps.googleapis.com"]')) {
            console.log('Google Maps script already loading/loaded');
            return;
          }
          
          const script = document.createElement('script');
          // ✅ Load with loading=async parameter for optimal performance
          script.src = `https://maps.googleapis.com/maps/api/js?key=${data.apiKey}&libraries=places&loading=async`;
          script.async = true;
          script.onload = () => setMapLoaded(true);
          document.head.appendChild(script);
        }
      }
    } catch (error) {
      console.error('Error loading Google Maps:', error);
    }
  };

  const initializeMap = () => {
    if (!mapRef.current || !window.google) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: 28.6139, lng: 77.2090 },
      zoom: 12
    });

    const marker = new window.google.maps.Marker({
      map,
      draggable: true
    });

    markerRef.current = marker;

    map.addListener('click', (e: any) => {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      marker.setPosition(e.latLng);
      updateLocation(lat, lng);
    });

    marker.addListener('dragend', (e: any) => {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      updateLocation(lat, lng);
    });

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        map.setCenter(pos);
        marker.setPosition(pos);
        updateLocation(pos.lat, pos.lng);
      });
    }
  };

  const updateLocation = async (lat: number, lng: number) => {
    try {
      const geocoder = new window.google.maps.Geocoder();
      const result = await geocoder.geocode({ location: { lat, lng } });
      
      if (result.results[0]) {
        setLocation({
          lat,
          lng,
          address: result.results[0].formatted_address
        });
      }
    } catch (error) {
      console.error('Error geocoding:', error);
    }
  };

  const handleFileUpload = (setter: React.Dispatch<React.SetStateAction<DocumentUpload>>, side: 'front' | 'back', file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setter(prev => ({
        ...prev,
        [side]: {
          file,
          preview: reader.result as string
        }
      }));
      toast.success(`${side} uploaded successfully`);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    // Validate required fields
    if (!businessName || !ownerName || !phone || !email || !address || !city || !state || !pincode) {
      toast.error('Please fill all required fields');
      return;
    }

    if (!location) {
      toast.error('Please select location on map');
      return;
    }

    if (!aadharCard.front || !aadharCard.back) {
      toast.error('Please upload both sides of Aadhar Card');
      return;
    }

    if (!panCard.front) {
      toast.error('Please upload PAN Card');
      return;
    }

    setSaving(true);
    try {
      const configData = {
        roleId: selectedRole,
        businessInfo: {
          businessName,
          ownerName,
          phone,
          email,
          address,
          city,
          state,
          pincode,
          yearsOfExperience,
          licenseNumber,
          gstNumber,
          location
        },
        documents: {
          aadhar: aadharCard,
          pan: panCard,
          gst: gstCertificate,
          license: professionalLicense,
          policeVerification,
          establishmentCert,
          insuranceCert
        }
      };

      // Here you would typically save to your backend
      console.log('Configuration saved:', configData);
      toast.success('Configuration saved successfully!');
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const DocumentUploadCard = ({ 
    title, 
    required, 
    hasFront, 
    hasBack, 
    onFrontUpload, 
    onBackUpload,
    frontPreview,
    backPreview,
    requiresBothSides 
  }: { 
    title: string; 
    required: boolean; 
    hasFront: boolean; 
    hasBack: boolean; 
    onFrontUpload: (file: File) => void; 
    onBackUpload?: (file: File) => void;
    frontPreview?: string;
    backPreview?: string;
    requiresBothSides?: boolean;
  }) => (
    <Card className="p-4 border-2 border-gray-200 hover:border-[#FF8C42] transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#FF8C42]" />
          <span className="font-medium text-gray-900">{title}</span>
        </div>
        {required && (
          <span className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded-full border border-red-200">
            Required
          </span>
        )}
      </div>
      
      <div className={`grid ${requiresBothSides ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
        <div>
          <Label className="text-sm text-gray-600 mb-2 block">Front Side</Label>
          {frontPreview ? (
            <div className="relative">
              <img src={frontPreview} alt="Front" className="w-full h-32 object-cover rounded-lg border-2 border-green-500" />
              <CheckCircle className="w-6 h-6 text-green-500 absolute top-2 right-2 bg-white rounded-full" />
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#FF8C42] hover:bg-orange-50 transition-all">
              <Upload className="w-6 h-6 text-gray-400 mb-2" />
              <span className="text-sm text-gray-500">Upload Front</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onFrontUpload(e.target.files[0])}
              />
            </label>
          )}
        </div>
        
        {requiresBothSides && onBackUpload && (
          <div>
            <Label className="text-sm text-gray-600 mb-2 block">Back Side</Label>
            {backPreview ? (
              <div className="relative">
                <img src={backPreview} alt="Back" className="w-full h-32 object-cover rounded-lg border-2 border-green-500" />
                <CheckCircle className="w-6 h-6 text-green-500 absolute top-2 right-2 bg-white rounded-full" />
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#FF8C42] hover:bg-orange-50 transition-all">
                <Upload className="w-6 h-6 text-gray-400 mb-2" />
                <span className="text-sm text-gray-500">Upload Back</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && onBackUpload(e.target.files[0])}
                />
              </label>
            )}
          </div>
        )}
      </div>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-gray-900">Vendor Onboarding Form</h2>
          <p className="text-sm text-gray-600">
            Complete all required fields and upload necessary documents
          </p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Configuration'}
        </Button>
      </div>

      {/* Role Selection */}
      <Card className="p-6">
        <Label className="mb-2 block">Vendor Role *</Label>
        <Select value={selectedRole} onValueChange={setSelectedRole}>
          <SelectTrigger>
            <SelectValue placeholder="Select a role" />
          </SelectTrigger>
          <SelectContent>
            {roles.map(role => (
              <SelectItem key={role.id} value={role.id}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {/* Business Information */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Building className="w-5 h-5 text-[#FF8C42]" />
          <h3 className="text-gray-900">Business Information</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Business Name *</Label>
            <Input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Enter business name"
              className="mt-2"
            />
          </div>
          
          <div>
            <Label>Owner Name *</Label>
            <Input
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Enter owner full name"
              className="mt-2"
            />
          </div>
          
          <div>
            <Label>Phone Number *</Label>
            <div className="flex gap-2 mt-2">
              <Phone className="w-5 h-5 text-gray-400 mt-2" />
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 XXXXX XXXXX"
              />
            </div>
          </div>
          
          <div>
            <Label>Email Address *</Label>
            <div className="flex gap-2 mt-2">
              <Mail className="w-5 h-5 text-gray-400 mt-2" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>
          </div>

          <div>
            <Label>Years of Experience</Label>
            <Input
              type="number"
              value={yearsOfExperience}
              onChange={(e) => setYearsOfExperience(e.target.value)}
              placeholder="Enter years"
              className="mt-2"
            />
          </div>

          <div>
            <Label>License Number</Label>
            <div className="flex gap-2 mt-2">
              <CreditCard className="w-5 h-5 text-gray-400 mt-2" />
              <Input
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="Enter license number"
              />
            </div>
          </div>

          <div className="col-span-2">
            <Label>GST Number (Optional)</Label>
            <Input
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value)}
              placeholder="Enter GST number"
              className="mt-2"
            />
          </div>
        </div>
      </Card>

      {/* Address Information */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <MapPin className="w-5 h-5 text-[#FF8C42]" />
          <h3 className="text-gray-900">Address & Location</h3>
        </div>
        
        <div className="space-y-4">
          <div>
            <Label>Business Address *</Label>
            <Textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter complete address"
              className="mt-2"
              rows={3}
            />
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>City *</Label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Enter city"
                className="mt-2"
              />
            </div>
            
            <div>
              <Label>State *</Label>
              <Input
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="Enter state"
                className="mt-2"
              />
            </div>
            
            <div>
              <Label>Pincode *</Label>
              <Input
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="6-digit pincode"
                className="mt-2"
                maxLength={6}
              />
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Google PIN Location *</Label>
            <div className="relative">
              <div 
                ref={mapRef} 
                className="w-full h-80 rounded-lg border-2 border-gray-200"
              />
              {location && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-green-800">
                      Location selected: {location.address}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Document Uploads */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Shield className="w-5 h-5 text-[#FF8C42]" />
          <h3 className="text-gray-900">Document Verification</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <DocumentUploadCard
            title="Aadhar Card"
            required={true}
            hasFront={!!aadharCard.front}
            hasBack={!!aadharCard.back}
            onFrontUpload={(file) => handleFileUpload(setAadharCard, 'front', file)}
            onBackUpload={(file) => handleFileUpload(setAadharCard, 'back', file)}
            frontPreview={aadharCard.front?.preview}
            backPreview={aadharCard.back?.preview}
            requiresBothSides={true}
          />

          <DocumentUploadCard
            title="PAN Card"
            required={true}
            hasFront={!!panCard.front}
            hasBack={false}
            onFrontUpload={(file) => handleFileUpload(setPanCard, 'front', file)}
            frontPreview={panCard.front?.preview}
            requiresBothSides={false}
          />

          <DocumentUploadCard
            title="GST Certificate"
            required={false}
            hasFront={!!gstCertificate.front}
            hasBack={false}
            onFrontUpload={(file) => handleFileUpload(setGstCertificate, 'front', file)}
            frontPreview={gstCertificate.front?.preview}
            requiresBothSides={false}
          />

          <DocumentUploadCard
            title="Professional License"
            required={false}
            hasFront={!!professionalLicense.front}
            hasBack={false}
            onFrontUpload={(file) => handleFileUpload(setProfessionalLicense, 'front', file)}
            frontPreview={professionalLicense.front?.preview}
            requiresBothSides={false}
          />

          <DocumentUploadCard
            title="Police Verification"
            required={false}
            hasFront={!!policeVerification.front}
            hasBack={false}
            onFrontUpload={(file) => handleFileUpload(setPoliceVerification, 'front', file)}
            frontPreview={policeVerification.front?.preview}
            requiresBothSides={false}
          />

          <DocumentUploadCard
            title="Establishment Certificate"
            required={false}
            hasFront={!!establishmentCert.front}
            hasBack={false}
            onFrontUpload={(file) => handleFileUpload(setEstablishmentCert, 'front', file)}
            frontPreview={establishmentCert.front?.preview}
            requiresBothSides={false}
          />

          <DocumentUploadCard
            title="Insurance Certificate"
            required={false}
            hasFront={!!insuranceCert.front}
            hasBack={false}
            onFrontUpload={(file) => handleFileUpload(setInsuranceCert, 'front', file)}
            frontPreview={insuranceCert.front?.preview}
            requiresBothSides={false}
          />
        </div>
      </Card>

      {/* Summary */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <h3 className="text-gray-900 mb-4">Form Summary</h3>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600 mb-1">Business Info</p>
            <p className="font-semibold text-blue-600">
              {[businessName, ownerName, phone, email].filter(Boolean).length}/4
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Address Info</p>
            <p className="font-semibold text-blue-600">
              {[address, city, state, pincode, location].filter(Boolean).length}/5
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Required Docs</p>
            <p className="font-semibold text-blue-600">
              {[aadharCard.front && aadharCard.back, panCard.front].filter(Boolean).length}/2
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Optional Docs</p>
            <p className="font-semibold text-blue-600">
              {[gstCertificate.front, professionalLicense.front, policeVerification.front, establishmentCert.front, insuranceCert.front].filter(Boolean).length}/5
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}