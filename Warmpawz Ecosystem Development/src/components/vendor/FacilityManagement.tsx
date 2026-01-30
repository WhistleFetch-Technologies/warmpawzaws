import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { 
  Building2,
  Upload, 
  X, 
  Check,
  MapPin,
  Clock,
  Save,
  ArrowLeft,
  Plus,
  Image as ImageIcon,
  Trash2
} from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';
import { getAmenitiesForVendorType } from '../../utils/master-amenities';
import { toast } from 'sonner';
import { SpecializationSelector } from './SpecializationSelector'; // ✅ NEW
import { authenticatedFetch } from '../../utils/session-manager'; // ✅ SECURITY FIX

interface FacilityManagementProps {
  vendorId: string;
  vendorData: any;
  onBack?: () => void;
}

interface FacilityData {
  description: string;
  address: string;
  operatingHours: string;
  amenities: string[]; // Array of amenity IDs
  customAmenities: string[]; // Custom amenities added by vendor
  photos: string[]; // Array of photo URLs from backend
  specializations?: string[]; // ✅ NEW: Problem grid specializations
  location?: { lat: number; lng: number }; // ✅ NEW: GPS coordinates for location-based search
  city?: string; // ✅ NEW: City
  state?: string; // ✅ NEW: State
  pincode?: string; // ✅ NEW: PIN code - auto-populated from vendor onboarding
}

interface PhotoFile {
  file: File;
  preview: string;
}

export function FacilityManagement({ vendorId, vendorData, onBack }: FacilityManagementProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [facility, setFacility] = useState<FacilityData>({
    description: '',
    address: vendorData?.address || '',
    operatingHours: 'Mon-Fri: 9AM-6PM',
    amenities: [],
    customAmenities: [],
    photos: []
  });
  const [newPhotos, setNewPhotos] = useState<PhotoFile[]>([]); // New photos to upload
  const [customAmenityInput, setCustomAmenityInput] = useState('');

  const API_BASE = getApiBaseUrl();
  const MAX_PHOTOS = 10;

  // Get applicable amenities for this vendor type
  const availableAmenities = getAmenitiesForVendorType(vendorData?.roleId);

  // Load existing facility data
  useEffect(() => {
    const loadFacilityData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/vendor/facility/${vendorId}`, {
          headers: {
            ...getAuthHeaders()
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.facility) {
            setFacility({
              description: data.facility.description || '',
              address: data.facility.address || '',
              operatingHours: data.facility.operatingHours || 'Mon-Fri: 9AM-6PM',
              amenities: data.facility.amenities || [],
              customAmenities: data.facility.customAmenities || [],
              photos: data.facility.photos || [],
              specializations: data.facility.specializations || []
            });
          }
        }
      } catch (error) {
        console.error('Error loading facility data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFacilityData();
  }, [vendorId]);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Validate file types first
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image file`);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error(`${file.name} is too large. Max size is 5MB`);
        return false;
      }
      return true;
    });

    // Check total photos count
    const totalPhotos = newPhotos.length + facility.photos.length + validFiles.length;

    if (totalPhotos > MAX_PHOTOS) {
      toast.error(`You can only upload up to ${MAX_PHOTOS} photos total`);
      return;
    }

    // Create preview URLs
    const newPhotoFiles: PhotoFile[] = validFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));

    setNewPhotos(prev => [...prev, ...newPhotoFiles]);
  };

  // Remove photo before upload
  const removePhoto = (index: number) => {
    const photo = newPhotos[index];
    URL.revokeObjectURL(photo.preview);
    setNewPhotos(prev => prev.filter((_, i) => i !== index));
  };

  // Remove existing uploaded photo
  const removeExistingPhoto = (index: number) => {
    setFacility(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  // Upload photos and save
  const handleSave = async () => {
    try {
      setSaving(true);

      // Upload new photos if any
      let uploadedUrls: string[] = [];
      
      if (newPhotos.length > 0) {
        const formData = new FormData();
        formData.append('vendorId', vendorId);
        
        newPhotos.forEach((photo, index) => {
          formData.append('photos', photo.file);
        });

        console.log('📤 Uploading facility photos...');
        // ✅ SECURITY FIX: Use authenticatedFetch for photo upload
        const uploadResponse = await authenticatedFetch(
          `${API_BASE}/storage/upload-facility-photos`,
          {
            method: 'POST',
            body: formData
            // Note: Don't set Content-Type - browser handles multipart/form-data
          }
        );

        if (!uploadResponse.ok) {
          const error = await uploadResponse.text();
          console.error('❌ Upload failed:', error);
          toast.error('Failed to upload photos');
          return;
        }

        const uploadResult = await uploadResponse.json();
        console.log('✅ Photos uploaded:', uploadResult);
        
        if (uploadResult.uploads) {
          uploadedUrls = uploadResult.uploads
            .filter((u: any) => u.success)
            .map((u: any) => u.url);
        }
      }

      // Combine existing and new photo URLs
      const allPhotos = [...facility.photos, ...uploadedUrls];

      // Save facility data
      // ✅ SECURITY FIX: Use authenticatedFetch for facility update
      const response = await authenticatedFetch(`${API_BASE}/vendor/facility/${vendorId}`, {
        method: 'PUT',
        body: JSON.stringify({
          description: facility.description,
          photos: allPhotos,
          address: facility.address,
          operatingHours: facility.operatingHours,
          amenities: facility.amenities,
          customAmenities: facility.customAmenities,
          specializations: facility.specializations
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Facility photos and description saved successfully!');
        
        // Clear the new photos and update existing
        setNewPhotos([]);
        setFacility(prev => ({
          ...prev,
          photos: allPhotos
        }));
      } else {
        toast.error(data.error || 'Failed to save facility information');
      }
    } catch (error) {
      console.error('Error saving facility data:', error);
      toast.error('Failed to save facility information');
    } finally {
      setSaving(false);
    }
  };

  // Toggle amenity selection
  const toggleAmenity = (amenityId: string) => {
    setFacility(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenityId)
        ? prev.amenities.filter(id => id !== amenityId)
        : [...prev.amenities, amenityId]
    }));
  };

  // Add custom amenity
  const addCustomAmenity = () => {
    if (customAmenityInput.trim()) {
      setFacility(prev => ({
        ...prev,
        customAmenities: [...prev.customAmenities, customAmenityInput.trim()]
      }));
      setCustomAmenityInput('');
    }
  };

  // Remove custom amenity
  const removeCustomAmenity = (index: number) => {
    setFacility(prev => ({
      ...prev,
      customAmenities: prev.customAmenities.filter((_, i) => i !== index)
    }));
  };

  const totalPhotoCount = newPhotos.length + facility.photos.length;
  const canAddMore = totalPhotoCount < MAX_PHOTOS;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading facility information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[430px] mx-auto bg-white min-h-screen pb-6">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
          <div className="flex items-center gap-3">
            <button onClick={onBack}>
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-gray-900">Facility Photos & Description</h1>
              <p className="text-xs text-gray-500">Upload up to {MAX_PHOTOS} photos</p>
            </div>
          </div>
        </div>

        {/* Photo Count Badge */}
        <div className="p-4 bg-orange-50 border-b border-orange-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-[#FF8C42]" />
              <span className="text-sm font-medium text-gray-900">
                {totalPhotoCount} / {MAX_PHOTOS} photos
              </span>
            </div>
            {totalPhotoCount === MAX_PHOTOS && (
              <span className="text-xs text-orange-600 flex items-center gap-1">
                <Check className="w-4 h-4" />
                Maximum reached
              </span>
            )}
          </div>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-[#FF8C42] h-2 rounded-full transition-all"
              style={{ width: `${(totalPhotoCount / MAX_PHOTOS) * 100}%` }}
            />
          </div>
        </div>

        {/* Upload Area */}
        <div className="p-4">
          {canAddMore && (
            <label className="block w-full cursor-pointer">
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 hover:border-[#FF8C42] hover:bg-orange-50 transition-all text-center">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="font-medium text-gray-900 mb-1">Upload Facility Photos</p>
                <p className="text-sm text-gray-500 mb-1">
                  Click to select {MAX_PHOTOS - totalPhotoCount} more {MAX_PHOTOS - totalPhotoCount === 1 ? 'photo' : 'photos'}
                </p>
                <p className="text-xs text-gray-400">JPG, PNG or WEBP • Max 5MB per photo</p>
              </div>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          )}

          {!canAddMore && (
            <div className="border-2 border-gray-200 rounded-xl p-6 bg-gray-50 text-center">
              <Check className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <p className="font-medium text-gray-900">Maximum photos uploaded</p>
              <p className="text-sm text-gray-500">Remove a photo to add more</p>
            </div>
          )}
        </div>

        {/* Existing Photos */}
        {facility.photos.length > 0 && (
          <div className="px-4 pb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Saved Photos</h3>
            <div className="grid grid-cols-2 gap-3">
              {facility.photos.map((url, index) => (
                <div key={`existing-${index}`} className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden group">
                  <img 
                    src={url}
                    alt={`Facility photo ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => removeExistingPhoto(index)}
                    className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-2">
                    <span className="text-xs text-white">Saved</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* New Photos Preview */}
        {newPhotos.length > 0 && (
          <div className="px-4 pb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">New Photos to Upload</h3>
            <div className="grid grid-cols-2 gap-3">
              {newPhotos.map((photo, index) => (
                <div key={`new-${index}`} className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden group">
                  <img 
                    src={photo.preview}
                    alt={`New photo ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => removePhoto(index)}
                    className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-orange-500/80 to-transparent p-2">
                    <span className="text-xs text-white font-medium">Ready to upload</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        <div className="px-4 pb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Facility Description</h3>
          <Textarea
            placeholder="Describe your facility, what makes it special, your services, amenities, etc..."
            value={facility.description}
            onChange={(e) => setFacility(prev => ({ ...prev, description: e.target.value }))}
            rows={5}
            maxLength={500}
            className="resize-none"
          />
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-gray-500">
              {facility.description.length}/500 characters
            </p>
          </div>
        </div>

        {/* Address */}
        <div className="px-4 pb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Facility Address</h3>
          <Input
            placeholder="Enter your facility's address"
            value={facility.address}
            onChange={(e) => setFacility(prev => ({ ...prev, address: e.target.value }))}
            className="w-full"
          />
        </div>

        {/* Operating Hours */}
        <div className="px-4 pb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Operating Hours</h3>
          <Input
            placeholder="Enter your facility's operating hours"
            value={facility.operatingHours}
            onChange={(e) => setFacility(prev => ({ ...prev, operatingHours: e.target.value }))}
            className="w-full"
          />
        </div>

        {/* ✅ NEW: Center Specializations Section */}
        {vendorData?.roleId && (
          <div className="px-4 pb-6 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-2">Center Specializations</h2>
            <p className="text-sm text-gray-500 mb-3">
              Select the broad service areas your center specializes in
            </p>
            <SpecializationSelector
              roleId={vendorData.roleId}
              selected={facility.specializations || []}
              onChange={(specs) => setFacility(prev => ({ ...prev, specializations: specs }))}
            />
          </div>
        )}

        {/* Amenities */}
        <div className="px-4 pb-6 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-3">Amenities & Facilities</h2>
          <p className="text-sm text-gray-500 mb-3">
            Select amenities available at your facility
          </p>

          {/* Group amenities by category */}
          {['basic', 'medical', 'grooming', 'boarding', 'training', 'safety', 'comfort', 'specialty'].map(category => {
            const categoryAmenities = availableAmenities.filter(a => a.category === category);
            
            if (categoryAmenities.length === 0) return null;

            return (
              <div key={category} className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2 capitalize">
                  {category} Amenities
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {categoryAmenities.map(amenity => {
                    const isSelected = facility.amenities.includes(amenity.id);
                    const IconComponent = amenity.icon;

                    return (
                      <button
                        key={amenity.id}
                        onClick={() => toggleAmenity(amenity.id)}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                          isSelected
                            ? 'border-[#FF8C42] bg-orange-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'bg-[#FF8C42]' : 'bg-gray-100'
                        }`}>
                          <IconComponent className={`w-5 h-5 ${
                            isSelected ? 'text-white' : 'text-gray-600'
                          }`} />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {amenity.name}
                          </div>
                          {amenity.description && (
                            <div className="text-xs text-gray-500">
                              {amenity.description}
                            </div>
                          )}
                        </div>
                        {isSelected && (
                          <Check className="w-5 h-5 text-[#FF8C42] flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Custom Amenities */}
        <div className="px-4 pb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Custom Amenities</h3>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Add a custom amenity"
              value={customAmenityInput}
              onChange={(e) => setCustomAmenityInput(e.target.value)}
              className="w-full"
            />
            <Button
              onClick={addCustomAmenity}
              className="bg-[#FF8C42] hover:bg-[#FF7A2F] text-white h-10"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add
            </Button>
          </div>
          {facility.customAmenities.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {facility.customAmenities.map((amenity, index) => (
                <Badge
                  key={index}
                  className="bg-gray-200 text-gray-500 cursor-pointer"
                  onClick={() => removeCustomAmenity(index)}
                >
                  {amenity}
                  <Trash2 className="w-4 h-4 ml-2" />
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="px-4 pb-6">
          <Button
            onClick={handleSave}
            disabled={saving || (newPhotos.length === 0 && facility.photos.length === 0)}
            className="w-full bg-[#FF8C42] hover:bg-[#FF7A2F] text-white h-12"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                Save {newPhotos.length > 0 && `& Upload ${newPhotos.length} ${newPhotos.length === 1 ? 'Photo' : 'Photos'}`}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}