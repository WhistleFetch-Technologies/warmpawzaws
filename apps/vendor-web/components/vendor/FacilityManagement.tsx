'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { getAmenitiesForVendorType } from '@/lib/master-amenities';
import { toast } from 'sonner';
import { TouchFilePicker } from '@/components/shared/TouchFilePicker';
import { fileMatchesAccept } from '@/lib/capacitor-file-pick';
import {
  resolveFacilityGalleryVendorId,
  uploadFacilityCenterPhotos,
} from '@/lib/photo-upload-enhanced';
import { takePendingCameraUploadPayloads } from '@/lib/camera-upload-bridge';
import { SpecializationSelector } from './SpecializationSelector'; // ✅ NEW
import { formatOperatingHours } from '@/lib/format-utils';

interface FacilityManagementProps {
  vendorId: string;
  vendorData?: any;
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
  const effectiveVendorId = resolveFacilityGalleryVendorId(vendorId);
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
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingPhotoIndex, setUploadingPhotoIndex] = useState<number | null>(null);
  const [customAmenityInput, setCustomAmenityInput] = useState('');

  // Using apiClient instead of API_BASE
  const MAX_PHOTOS = 10;

  // Get applicable amenities for this vendor type
  const availableAmenities = getAmenitiesForVendorType(vendorData?.roleId);

  // Load existing facility data
  useEffect(() => {
    const loadFacilityData = async () => {
      try {
        setLoading(true);
        const data = await apiClient.get(`/vendor/${effectiveVendorId}/facility`) as any;

        if (data && data.success && data.facility) {
          setFacility({
            description: data.facility.description || '',
            address: data.facility.address || '',
            operatingHours: formatOperatingHours(data.facility.operatingHours) || 'Mon-Fri: 9AM-6PM',
            amenities: data.facility.amenities || [],
            customAmenities: data.facility.customAmenities || [],
            photos: data.facility.photos || [],
            specializations: data.facility.specializations || []
          });
        }
      } catch (error) {
        console.error('Error loading facility data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFacilityData();
  }, [effectiveVendorId]);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Validate file types first
    const validFiles = files.filter((file) => {
      if (!fileMatchesAccept(file, 'image/*')) {
        toast.error(`${file.name} is not an image file`);
        return false;
      }
      if (file.size === 0) {
        toast.error(`${file.name || 'Photo'} is empty. Please pick again.`);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
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
    const pendingPhotoCount = newPhotos.length;
    try {
      setSaving(true);

      if (pendingPhotoCount > 0) {
        setUploadingPhotos(true);
        setUploadProgress(0);
        setUploadingPhotoIndex(0);
        try {
          const files = newPhotos.map((p) => p.file);
          await uploadFacilityCenterPhotos(effectiveVendorId, files, {
            payloads: takePendingCameraUploadPayloads(),
            onProgress: (pct) => setUploadProgress(pct),
          });
          for (const photo of newPhotos) {
            URL.revokeObjectURL(photo.preview);
          }
          setNewPhotos([]);
        } catch (error: unknown) {
          console.error('Error uploading facility photos:', error);
          toast.error(
            error instanceof Error ? error.message : 'Failed to upload photos'
          );
          setSaving(false);
          setUploadingPhotos(false);
          setUploadProgress(0);
          setUploadingPhotoIndex(null);
          return;
        } finally {
          setUploadingPhotos(false);
          setUploadProgress(0);
          setUploadingPhotoIndex(null);
        }
      }

      const saveData = await apiClient.put<{ success?: boolean; error?: string }>(`/vendor/facility/${effectiveVendorId}`, {
        description: facility.description,
        address: facility.address,
        operatingHours: facility.operatingHours,
        amenities: facility.amenities,
        customAmenities: facility.customAmenities,
        specializations: facility.specializations
      });

      if (saveData.success) {
        const refreshed = (await apiClient.get(`/vendor/${effectiveVendorId}/facility`)) as {
          success?: boolean;
          facility?: { photos?: string[] };
        };
        const refreshedPhotos =
          refreshed?.success && refreshed.facility?.photos ? refreshed.facility.photos : facility.photos;

        toast.success(
          pendingPhotoCount > 0
            ? 'Facility photos and description saved successfully!'
            : 'Facility information saved successfully!'
        );

        setFacility((prev) => ({
          ...prev,
          photos: refreshedPhotos,
        }));
      } else {
        toast.error((saveData as any).error || 'Failed to save facility information');
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
      <div className="vendor-app-column bg-white min-h-screen pb-6">
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
            <TouchFilePicker
              onFileChange={handleFileSelect}
              accept="image/*"
              multiple
              className="block w-full min-h-[12rem] overflow-hidden rounded-xl"
              innerClassName="flex w-full min-h-[12rem] flex-col items-center justify-center p-8 text-center"
            >
              <div className="w-full border-2 border-dashed border-gray-300 rounded-xl p-6 transition-all hover:border-[#FF8C42] hover:bg-orange-50">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="font-medium text-gray-900 mb-1">Upload Facility Photos</p>
                <p className="text-sm text-gray-500 mb-1">
                  Click to select {MAX_PHOTOS - totalPhotoCount} more {MAX_PHOTOS - totalPhotoCount === 1 ? 'photo' : 'photos'}
                </p>
                <p className="text-xs text-gray-400">JPG, PNG or WEBP • Max 5MB per photo</p>
              </div>
            </TouchFilePicker>
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
              {newPhotos.map((photo, index) => {
                const isUploading = uploadingPhotos && uploadingPhotoIndex === index;
                const isUploaded = uploadingPhotos && uploadingPhotoIndex !== null && index < uploadingPhotoIndex;
                
                return (
                <div key={`new-${index}`} className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden group">
                  <img 
                    src={photo.preview}
                    alt={`New photo ${index + 1}`}
                      className={`w-full h-full object-cover ${isUploading ? 'opacity-50' : ''}`}
                  />
                    {!uploadingPhotos && (
                  <button
                    onClick={() => removePhoto(index)}
                    className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                    )}
                    {isUploading && (
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mb-2" />
                        <span className="text-white text-xs">{uploadProgress}%</span>
                      </div>
                    )}
                    {isUploaded && (
                      <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                        <Check className="w-8 h-8 text-green-500" />
                      </div>
                    )}
                    <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t p-2 ${
                      isUploaded ? 'from-green-500/80' : isUploading ? 'from-orange-500/80' : 'from-orange-500/80'
                    } to-transparent`}>
                      <span className="text-xs text-white font-medium">
                        {isUploaded ? 'Uploaded' : isUploading ? `Uploading... ${uploadProgress}%` : 'Ready to upload'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            {uploadingPhotos && (
              <div className="mt-4 space-y-2">
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-orange-500 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600 text-center">
                  Uploading {uploadingPhotoIndex !== null ? uploadingPhotoIndex + 1 : 0} of {newPhotos.length} photos... {uploadProgress}%
                </p>
            </div>
            )}
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
                          {amenity.icon ? (
                            <span className={`text-lg ${isSelected ? 'text-white' : 'text-gray-600'}`}>
                              {amenity.icon}
                            </span>
                          ) : (
                            <span className={`text-xs font-medium ${isSelected ? 'text-white' : 'text-gray-600'}`}>
                              {amenity.name.charAt(0).toUpperCase()}
                            </span>
                          )}
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
            disabled={saving || uploadingPhotos}
            className="w-full bg-[#FF8C42] hover:bg-[#FF7A2F] text-white h-12"
          >
            {saving || uploadingPhotos ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                {uploadingPhotos ? `Uploading... ${uploadProgress}%` : 'Saving...'}
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