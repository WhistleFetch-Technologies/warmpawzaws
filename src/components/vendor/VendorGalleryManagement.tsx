import { useState, useEffect } from 'react';
import { Camera, Upload, X, Image as ImageIcon, Trash2, Star, Eye, Download, Grid3x3, List } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface GalleryImage {
  id: string;
  vendorId: string;
  imageUrl: string;
  caption?: string;
  category: 'before_after' | 'work_showcase' | 'facility' | 'team' | 'other';
  isFeatured: boolean;
  orderIndex: number;
  uploadedAt: string;
  metadata?: {
    petName?: string;
    serviceType?: string;
    date?: string;
  };
}

interface VendorGalleryManagementProps {
  vendorId: string;
  vendorData?: any;
  onBack?: () => void;
}

export function VendorGalleryManagement({ vendorId, vendorData, onBack }: VendorGalleryManagementProps) {
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    caption: '',
    category: 'work_showcase' as GalleryImage['category'],
    isFeatured: false
  });

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    fetchGallery();
  }, [vendorId]);

  const fetchGallery = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/groomer-gallery/${vendorId}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });

      if (response.ok) {
        const data = await response.json();
        // ✅ FIX: Handle standardized response format
        // Response format: { success: true, images: [...], total: ... }
        setGallery(data.images || data.data?.images || []);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to fetch gallery:', errorData);
        toast.error(errorData.error || 'Failed to load gallery');
      }
    } catch (error: any) {
      console.error('Error fetching gallery:', error);
      const errorMessage = error?.message || 'Failed to load gallery. Please try again.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    try {
      setUploading(true);

      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = async () => {
        const base64Image = reader.result as string;

        const response = await fetch(`${API_BASE}/groomer-gallery/${vendorId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            image: base64Image,
            caption: uploadForm.caption,
            category: uploadForm.category,
            isFeatured: uploadForm.isFeatured
          })
        });

        if (response.ok) {
          const result = await response.json();
          toast.success('Image uploaded successfully');
          setUploadModalOpen(false);
          setUploadForm({ caption: '', category: 'work_showcase', isFeatured: false });
          await fetchGallery(); // ✅ Ensure gallery reloads
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
          const errorMessage = errorData.error || errorData.message || 'Upload failed. Please try again.';
          toast.error(errorMessage);
        }
      };

      reader.onerror = () => {
        toast.error('Failed to read image file');
      };
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    const image = gallery.find(img => img.id === imageId);
    const imageLabel = image?.caption || 'this image';
    
    if (!confirm(`Are you sure you want to delete "${imageLabel}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/groomer-gallery/${vendorId}/${imageId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });

      if (response.ok) {
        toast.success('Image deleted successfully');
        await fetchGallery(); // ✅ Ensure gallery reloads
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
        const errorMessage = errorData.error || errorData.message || 'Failed to delete image';
        toast.error(errorMessage);
      }
    } catch (error: any) {
      console.error('Error deleting image:', error);
      const errorMessage = error?.message || 'Network error. Please check your connection and try again.';
      toast.error(errorMessage);
    }
  };

  const toggleFeatured = async (imageId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`${API_BASE}/groomer-gallery/${vendorId}/${imageId}/featured`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isFeatured: !currentStatus })
      });

      if (response.ok) {
        toast.success(currentStatus ? 'Removed from featured' : 'Added to featured');
        fetchGallery();
      } else {
        toast.error('Failed to update featured status');
      }
    } catch (error) {
      console.error('Error updating featured:', error);
      toast.error('Failed to update');
    }
  };

  const categories = [
    { id: 'all', label: 'All Images', icon: ImageIcon },
    { id: 'before_after', label: 'Before & After', icon: Camera },
    { id: 'work_showcase', label: 'Work Showcase', icon: Star },
    { id: 'facility', label: 'Facility', icon: ImageIcon },
    { id: 'team', label: 'Team', icon: ImageIcon },
    { id: 'other', label: 'Other', icon: ImageIcon }
  ];

  const filteredGallery = filterCategory === 'all' 
    ? gallery 
    : gallery.filter(img => img.category === filterCategory);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Camera className="w-12 h-12 text-orange-500 animate-pulse mx-auto mb-3" />
          <p className="text-gray-600">Loading gallery...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[430px] mx-auto bg-white min-h-screen">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {onBack && (
                  <button onClick={onBack} className="text-gray-600">
                    <X className="w-6 h-6" />
                  </button>
                )}
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Gallery Management</h1>
                  <p className="text-sm text-gray-500">{gallery.length} images</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  {viewMode === 'grid' ? <List className="w-5 h-5" /> : <Grid3x3 className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => setUploadModalOpen(true)}
                  className="bg-orange-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-orange-600"
                >
                  <Upload className="w-4 h-4" />
                  Upload
                </button>
              </div>
            </div>

            {/* Category Filter */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setFilterCategory(cat.id)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    filterCategory === cat.id
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Gallery Grid/List */}
        <div className="p-4">
          {filteredGallery.length === 0 ? (
            <div className="text-center py-12">
              <Camera className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Images Yet</h3>
              <p className="text-gray-500 mb-4">Upload images to showcase your work</p>
              <button
                onClick={() => setUploadModalOpen(true)}
                className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600"
              >
                Upload First Image
              </button>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>
              {filteredGallery.map(image => (
                <div
                  key={image.id}
                  className={`bg-white border border-gray-200 rounded-lg overflow-hidden ${
                    viewMode === 'list' ? 'flex gap-3' : ''
                  }`}
                >
                  <div className={`relative ${viewMode === 'grid' ? 'aspect-square' : 'w-24 h-24 flex-shrink-0'}`}>
                    <img
                      src={image.imageUrl}
                      alt={image.caption || 'Gallery image'}
                      className="w-full h-full object-cover"
                      onClick={() => setSelectedImage(image)}
                    />
                    {image.isFeatured && (
                      <div className="absolute top-2 right-2 bg-yellow-500 text-white p-1 rounded-full">
                        <Star className="w-3 h-3 fill-current" />
                      </div>
                    )}
                  </div>
                  <div className={`p-3 ${viewMode === 'list' ? 'flex-1' : ''}`}>
                    {image.caption && (
                      <p className="text-sm text-gray-900 mb-2 line-clamp-2">{image.caption}</p>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-500 capitalize">{image.category.replace('_', ' ')}</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => toggleFeatured(image.id, image.isFeatured)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title={image.isFeatured ? 'Remove from featured' : 'Add to featured'}
                        >
                          <Star className={`w-4 h-4 ${image.isFeatured ? 'fill-yellow-500 text-yellow-500' : 'text-gray-400'}`} />
                        </button>
                        <button
                          onClick={() => handleDeleteImage(image.id)}
                          className="p-1 hover:bg-red-50 rounded text-red-500"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upload Modal */}
        {uploadModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Upload Image</h2>
                <button onClick={() => setUploadModalOpen(false)}>
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file);
                    }}
                    className="w-full border border-gray-300 rounded-lg p-2"
                    disabled={uploading}
                  />
                  <p className="text-xs text-gray-500 mt-1">Max size: 5MB</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Caption (Optional)
                  </label>
                  <textarea
                    value={uploadForm.caption}
                    onChange={(e) => setUploadForm({ ...uploadForm, caption: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                    rows={3}
                    placeholder="Describe this image..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={uploadForm.category}
                    onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value as GalleryImage['category'] })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  >
                    <option value="work_showcase">Work Showcase</option>
                    <option value="before_after">Before & After</option>
                    <option value="facility">Facility</option>
                    <option value="team">Team</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="featured"
                    checked={uploadForm.isFeatured}
                    onChange={(e) => setUploadForm({ ...uploadForm, isFeatured: e.target.checked })}
                    className="rounded"
                  />
                  <label htmlFor="featured" className="text-sm text-gray-700">
                    Mark as featured
                  </label>
                </div>
              </div>

              {uploading && (
                <div className="mt-4 text-center">
                  <Upload className="w-8 h-8 text-orange-500 animate-pulse mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Uploading...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Image Detail Modal */}
        {selectedImage && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <div className="max-w-4xl w-full">
              <img
                src={selectedImage.imageUrl}
                alt={selectedImage.caption || 'Gallery image'}
                className="w-full h-auto rounded-lg"
              />
              {selectedImage.caption && (
                <p className="text-white text-center mt-4">{selectedImage.caption}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
