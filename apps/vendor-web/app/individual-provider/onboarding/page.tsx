'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { 
  ArrowLeft, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Camera, 
  Upload, 
  Check, 
  X,
  Loader2,
  Home,
  Stethoscope,
  GraduationCap,
  AlertCircle,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// Specialization options (same as staff)
const SPECIALIZATION_OPTIONS = [
  { id: 'eye_care', name: 'Eye Care', description: 'Eye problems, vision care, optical issues', icon: '👁️' },
  { id: 'heart_cardio', name: 'Heart & Cardiovascular', description: 'Heart conditions, cardiac care, circulation', icon: '❤️' },
  { id: 'neuro', name: 'Neurological Care', description: 'Nervous system, seizures, neurological issues', icon: '🧠' },
  { id: 'general', name: 'General Health', description: 'General health issues, consultation, diagnosis', icon: '🩺' },
  { id: 'skin_coat', name: 'Skin & Coat Care', description: 'Dermatology, skin conditions, coat health', icon: '🧴' },
  { id: 'dental', name: 'Dental Care', description: 'Dental cleaning, oral health, tooth issues', icon: '🦷' },
  { id: 'surgery', name: 'Surgery & Procedures', description: 'Surgical procedures, operations, aftercare', icon: '🔪' },
  { id: 'nutrition', name: 'Nutrition & Diet', description: 'Diet planning, nutrition counseling', icon: '🥗' },
  { id: 'emergency', name: 'Emergency Care', description: 'Emergency treatment, critical care', icon: '🚨' },
  { id: 'orthopedic', name: 'Orthopedic Care', description: 'Bone, joint, muscle issues', icon: '🦴' },
];

const ROLE_OPTIONS = [
  { id: 'veterinarian', name: 'Veterinarian', description: 'Individual vet without clinic', icon: <Stethoscope className="w-5 h-5" /> },
  { id: 'pet_groomer', name: 'Home Groomer', description: 'Grooming services at customer location', icon: <Home className="w-5 h-5" /> },
  { id: 'pet_trainer', name: 'Pet Trainer', description: 'Training services at home or center', icon: <GraduationCap className="w-5 h-5" /> },
];

export default function IndividualProviderOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [locationResults, setLocationResults] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    role: '',
    photo: '',
    qualifications: '',
    experience: '',
    bio: '',
    specializations: [] as string[],
    defaultLocation: null as any,
  });

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');

  const handleLocationSearch = async (query: string) => {
    if (query.length < 3) {
      setLocationResults([]);
      return;
    }

    try {
      const response = await apiClient.post<any>('/location/autocomplete', { input: query });
      if (response.success) {
        setLocationResults(response.predictions || []);
      }
    } catch (error) {
      console.error('Location search error:', error);
    }
  };

  const handleSelectLocation = async (placeId: string) => {
    try {
      const response = await apiClient.post<any>('/location/details', { placeId });
      if (response.success && response.location) {
        setSelectedLocation(response.location);
        setFormData(prev => ({ ...prev, defaultLocation: response.location }));
        setLocationSearch(response.location.formatted_address || response.location.address);
        setLocationResults([]);
      }
    } catch (error) {
      console.error('Location details error:', error);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Photo must be less than 5MB');
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadPhoto = async (): Promise<string> => {
    if (!photoFile) {
      throw new Error('Photo is required');
    }

    const formDataUpload = new FormData();
    formDataUpload.append('provider_photo', photoFile);

    const uploadResponse = await apiClient.post<any>('/storage/upload-multiple', formDataUpload);

    if (uploadResponse.uploads && uploadResponse.uploads[0]?.success) {
      return uploadResponse.uploads[0].url;
    }

    throw new Error('Photo upload failed');
  };

  const handleSubmit = async () => {
    // Validate all mandatory fields
    if (!formData.name || !formData.phone || !formData.role) {
      toast.error('Name, phone, and role are required');
      return;
    }

    if (!photoFile && !photoPreview) {
      toast.error('Photo is MANDATORY');
      return;
    }

    if (!formData.qualifications || formData.qualifications.trim() === '') {
      toast.error('Qualifications are MANDATORY');
      return;
    }

    if (formData.specializations.length === 0) {
      toast.error('At least one specialization is MANDATORY');
      return;
    }

    if (!formData.defaultLocation || !formData.defaultLocation.lat || !formData.defaultLocation.lng) {
      toast.error('Default location is required');
      return;
    }

    // Validate phone
    if (formData.phone.length !== 10 || !/^\d+$/.test(formData.phone)) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    try {
      setSubmitting(true);

      // Upload photo first
      let photoUrl = '';
      if (photoFile) {
        photoUrl = await uploadPhoto();
      } else if (photoPreview) {
        photoUrl = photoPreview;
      }

      // Map specializations
      const specializationNames = formData.specializations.map(id => {
        const spec = SPECIALIZATION_OPTIONS.find(s => s.id === id);
        return spec?.name || id;
      });

      const payload = {
        name: formData.name,
        phone: formData.phone,
        email: formData.email || `${formData.phone}@warmpawz.com`,
        role: formData.role,
        photo: photoUrl,
        qualifications: formData.qualifications,
        experienceYears: parseInt(formData.experience) || 0,
        bio: formData.bio,
        specializations: specializationNames,
        defaultLocation: formData.defaultLocation,
      };

      const response = await apiClient.post<any>('/individual-provider/create', payload);

      if (response.success) {
        toast.success('Profile created successfully! OTP sent to your mobile for verification.');
        router.push('/staff/login');
      } else {
        throw new Error(response.error || 'Failed to create profile');
      }
    } catch (error: any) {
      console.error('[INDIVIDUAL PROVIDER] Error:', error);
      toast.error(error.message || 'Failed to create profile');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSpecialization = (specId: string) => {
    setFormData(prev => ({
      ...prev,
      specializations: prev.specializations.includes(specId)
        ? prev.specializations.filter(id => id !== specId)
        : [...prev.specializations, specId],
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="max-w-2xl mx-auto p-4">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">Become a Service Provider</h1>
              <p className="text-sm text-gray-600">Join as an individual provider (Home Groomer, Vet, Trainer)</p>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex-1 flex items-center">
                <div className={`flex-1 h-1 rounded ${
                  step >= s ? 'bg-[#FF8C42]' : 'bg-gray-200'
                }`} />
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                  step >= s 
                    ? 'bg-[#FF8C42] text-white' 
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {step > s ? <Check className="w-4 h-4" /> : s}
                </div>
                <div className={`flex-1 h-1 rounded ${
                  step > s ? 'bg-[#FF8C42]' : 'bg-gray-200'
                }`} />
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Basic Information</h2>

            {/* Role Selection */}
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">
                Service Type <span className="text-red-500">*</span>
              </Label>
              <div className="grid grid-cols-1 gap-3">
                {ROLE_OPTIONS.map((role) => (
                  <label
                    key={role.id}
                    className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                      formData.role === role.id
                        ? 'border-[#FF8C42] bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={role.id}
                      checked={formData.role === role.id}
                      onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                      className="sr-only"
                    />
                    <div className="text-2xl">{role.icon}</div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{role.name}</p>
                      <p className="text-xs text-gray-500">{role.description}</p>
                    </div>
                    {formData.role === role.id && (
                      <Check className="w-5 h-5 text-[#FF8C42]" />
                    )}
                  </label>
                ))}
              </div>
            </div>

            {/* Name */}
            <div>
              <Label htmlFor="name" className="text-sm font-medium text-gray-700 mb-1 block">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter your full name"
                className="h-10"
                required
              />
            </div>

            {/* Phone */}
            <div>
              <Label htmlFor="phone" className="text-sm font-medium text-gray-700 mb-1 block">
                Mobile Number <span className="text-red-500">*</span> (Login Credential)
              </Label>
              <Input
                id="phone"
                type="tel"
                maxLength={10}
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value.replace(/\D/g, '') }))}
                placeholder="10-digit mobile number"
                className="h-10"
                required
              />
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="email" className="text-sm font-medium text-gray-700 mb-1 block">
                Email (Optional)
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="email@example.com"
                className="h-10"
              />
            </div>

            <Button
              onClick={() => {
                if (!formData.name || !formData.phone || !formData.role) {
                  toast.error('Please fill all required fields');
                  return;
                }
                setStep(2);
              }}
              className="w-full bg-[#FF8C42] hover:bg-[#FF7A29] text-white"
            >
              Continue
            </Button>
          </div>
        )}

        {/* Step 2: Professional Details */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Professional Details</h2>

            {/* Photo */}
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">
                Photo <span className="text-red-500">*</span> <span className="text-red-500 font-semibold">(MANDATORY)</span>
              </Label>
              <p className="text-xs text-gray-500 mb-2">Max size: 5MB. Photo is mandatory.</p>
              <div className="flex items-center gap-4">
                <div className="relative">
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="w-24 h-24 rounded-full object-cover border-2 border-[#FF8C42]"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
                      <Camera className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <label className="cursor-pointer">
                    <div className="px-4 py-2 bg-[#FF8C42] text-white rounded-lg hover:bg-[#FF7A29] transition-colors inline-flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      Choose Photo
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Qualifications */}
            <div>
              <Label htmlFor="qualifications" className="text-sm font-medium text-gray-700 mb-1 block">
                Qualifications <span className="text-red-500">*</span> <span className="text-red-500 font-semibold">(MANDATORY)</span>
              </Label>
              <p className="text-xs text-gray-500 mb-2">Enter your professional qualifications, degrees, or certifications.</p>
              <Input
                id="qualifications"
                type="text"
                value={formData.qualifications}
                onChange={(e) => setFormData(prev => ({ ...prev, qualifications: e.target.value }))}
                placeholder="e.g., BVSc, MVSc, Certified Groomer, etc."
                className="h-10"
                required
              />
            </div>

            {/* Experience */}
            <div>
              <Label htmlFor="experience" className="text-sm font-medium text-gray-700 mb-1 block">
                Experience (years)
              </Label>
              <Input
                id="experience"
                type="number"
                value={formData.experience}
                onChange={(e) => setFormData(prev => ({ ...prev, experience: e.target.value }))}
                placeholder="e.g., 10"
                min="0"
                className="h-10"
              />
            </div>

            {/* Specializations */}
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">
                Specializations <span className="text-red-500">*</span> <span className="text-red-500 font-semibold">(MANDATORY - At least one)</span>
              </Label>
              <p className="text-xs text-gray-500 mb-3">Select areas of expertise. At least one specialization is mandatory.</p>
              <div className="space-y-2 border border-gray-200 rounded-lg p-3 max-h-64 overflow-y-auto">
                {SPECIALIZATION_OPTIONS.map((spec) => {
                  const isSelected = formData.specializations.includes(spec.id);
                  return (
                    <label
                      key={spec.id}
                      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        isSelected ? 'bg-orange-50 border-2 border-[#FF8C42]' : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSpecialization(spec.id)}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        isSelected ? 'bg-[#FF8C42] border-[#FF8C42]' : 'border-gray-300'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{spec.icon}</span>
                          <span className="font-medium text-gray-900">{spec.name}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{spec.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
              {formData.specializations.length > 0 ? (
                <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  {formData.specializations.length} specialization{formData.specializations.length !== 1 ? 's' : ''} selected
                </p>
              ) : (
                <p className="text-sm text-red-500 mt-2">Please select at least one specialization</p>
              )}
            </div>

            {/* Bio */}
            <div>
              <Label htmlFor="bio" className="text-sm font-medium text-gray-700 mb-1 block">
                About You
              </Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                placeholder="Brief introduction about yourself..."
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => setStep(1)}
                variant="outline"
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={() => {
                  if (!photoPreview && !photoFile) {
                    toast.error('Photo is MANDATORY');
                    return;
                  }
                  if (!formData.qualifications || formData.qualifications.trim() === '') {
                    toast.error('Qualifications are MANDATORY');
                    return;
                  }
                  if (formData.specializations.length === 0) {
                    toast.error('At least one specialization is MANDATORY');
                    return;
                  }
                  setStep(3);
                }}
                className="flex-1 bg-[#FF8C42] hover:bg-[#FF7A29] text-white"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Location */}
        {step === 3 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Service Location</h2>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 text-sm text-blue-800">
                  <p className="font-semibold mb-1">Default Service Location</p>
                  <p className="text-xs">This will be your default location for home services. You can override it per slot in your schedule.</p>
                </div>
              </div>
            </div>

            {/* Location Search */}
            <div>
              <Label htmlFor="location" className="text-sm font-medium text-gray-700 mb-1 block">
                Search Location <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="location"
                  type="text"
                  value={locationSearch}
                  onChange={(e) => {
                    setLocationSearch(e.target.value);
                    handleLocationSearch(e.target.value);
                  }}
                  placeholder="Search your service location..."
                  className="h-10 pr-10"
                />
                <MapPin className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                {locationResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {locationResults.map((result) => (
                      <button
                        key={result.place_id}
                        onClick={() => handleSelectLocation(result.place_id)}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b last:border-b-0"
                      >
                        <p className="font-medium text-sm">{result.description}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedLocation && (
                <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    {selectedLocation.formatted_address || selectedLocation.address}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => setStep(2)}
                variant="outline"
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !selectedLocation}
                className="flex-1 bg-[#FF8C42] hover:bg-[#FF7A29] text-white"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Profile...
                  </>
                ) : (
                  'Create Profile'
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
