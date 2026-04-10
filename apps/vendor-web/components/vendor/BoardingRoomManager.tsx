'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Upload,
  Image as ImageIcon,
  Video,
  Check,
  AlertCircle,
  IndianRupee,
  Users,
  Home as HomeIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface BoardingRoomManagerProps {
  vendorId: string;
  vendorName: string;
  onBack: () => void;
}

interface Room {
  id: string;
  name: string;
  description: string;
  dayPrice: number;
  nightPrice: number;
  capacity: number;
  petTypes: string[];
  amenities: string[];
  included: string[];
  notIncluded: string[];
  photos: string[];
  videos: string[];
  photoUrls?: string[];
  videoUrls?: string[];
  size: string;
  features: string;
  rules: string;
  isActive: boolean;
  totalUnits: number;
}

const AMENITIES_OPTIONS = [
  'CCTV',
  'Air Conditioning',
  'Heating',
  'Play Area',
  'Indoor Space',
  'Outdoor Space',
  'Daily Exercise',
  'Daily Grooming',
  'Premium Bedding',
  'Toys Included',
  'Music Therapy',
  'Webcam Access',
  '24/7 Supervision',
  'Medical Care',
  'Custom Diet',
  'Swimming Pool'
];

export function BoardingRoomManager({
  vendorId,
  vendorName,
  onBack
}: BoardingRoomManagerProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dayPrice, setDayPrice] = useState('');
  const [nightPrice, setNightPrice] = useState('');
  const [capacity, setCapacity] = useState('1');
  const [petTypes, setPetTypes] = useState<string[]>(['dog', 'cat']);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [included, setIncluded] = useState<string[]>(['Daily Feeding', 'Fresh Water']);
  const [notIncluded, setNotIncluded] = useState<string[]>(['Veterinary Services']);
  const [size, setSize] = useState('');
  const [features, setFeatures] = useState('');
  const [rules, setRules] = useState('');
  const [totalUnits, setTotalUnits] = useState('1');
  const [photos, setPhotos] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);

  useEffect(() => {
    loadRooms();
  }, [vendorId]);

  const loadRooms = async () => {
    try {
      setLoading(true);
      // AWS Serverless compatible - use apiClient
      const roomsData = await apiClient.get(`/vendor/${vendorId}/boarding/rooms`) as any;
      setRooms(roomsData.rooms || roomsData || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async () => {
    // Validation
    if (!name.trim() || !dayPrice || !nightPrice) {
      toast.error('Please fill in room name and prices');
      return;
    }

    if (photos.length === 0) {
      toast.error('Please upload at least one photo');
      return;
    }

    try {
      // AWS Serverless compatible - use apiClient
      await apiClient.post(`/vendor/${vendorId}/boarding/rooms`, {
        name,
        description,
        dayPrice: parseFloat(dayPrice),
        nightPrice: parseFloat(nightPrice),
        capacity: parseInt(capacity),
        petTypes,
        amenities: selectedAmenities,
        included,
        notIncluded,
        photos,
        videos,
        size,
        features,
        rules,
        totalUnits: parseInt(totalUnits)
      });
      toast.success('Room created successfully');
      setShowAddRoom(false);
      resetForm();
      loadRooms();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Network error');
    }
  };

  const handleUpdateRoom = async () => {
    if (!editingRoom) return;

    try {
      // AWS Serverless compatible - use apiClient
      await apiClient.put(`/vendor/${vendorId}/boarding/rooms/${editingRoom.id}`, {
        name,
        description,
        dayPrice: parseFloat(dayPrice),
        nightPrice: parseFloat(nightPrice),
        capacity: parseInt(capacity),
        petTypes,
        amenities: selectedAmenities,
        included,
        notIncluded,
        photos,
        videos,
        size,
        features,
        rules,
        totalUnits: parseInt(totalUnits)
      });
      toast.success('Room updated successfully');
      setEditingRoom(null);
      resetForm();
      loadRooms();
    } catch (error) {
      toast.error('Network error');
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm('Are you sure? This will delete all photos and videos.')) return;

    try {
      // AWS Serverless compatible - use apiClient
      await apiClient.delete(`/vendor/${vendorId}/boarding/rooms/${roomId}`);
      toast.success('Room deleted successfully');
      loadRooms();
    } catch (error) {
      toast.error('Network error');
    }
  };

  const handleFileUpload = async (file: File, roomId: string | null = null) => {
    if (!file) return;

    const isPhoto = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isPhoto && !isVideo) {
      toast.error('Please upload an image or video file');
      return;
    }

    if (file.size > 52428800) {
      toast.error('File size must be less than 50MB');
      return;
    }

    try {
      setUploadingMedia(true);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', isPhoto ? 'photo' : 'video');

      const endpoint = roomId
        ? `/vendor/${vendorId}/boarding/rooms/${roomId}/media`
        : `/vendor/${vendorId}/boarding/rooms/temp/media`;

      const data = await apiClient.post(endpoint, formData) as any;
      
      if (isPhoto) {
        setPhotos([...photos, data.filePath]);
      } else {
        setVideos([...videos, data.filePath]);
      }

      toast.success(`${isPhoto ? 'Photo' : 'Video'} uploaded successfully`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Upload failed');
    } finally {
      setUploadingMedia(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setDayPrice('');
    setNightPrice('');
    setCapacity('1');
    setPetTypes(['dog', 'cat']);
    setSelectedAmenities([]);
    setIncluded(['Daily Feeding', 'Fresh Water']);
    setNotIncluded(['Veterinary Services']);
    setSize('');
    setFeatures('');
    setRules('');
    setTotalUnits('1');
    setPhotos([]);
    setVideos([]);
  };

  const openEditModal = (room: Room) => {
    setEditingRoom(room);
    setName(room.name);
    setDescription(room.description);
    setDayPrice(room.dayPrice.toString());
    setNightPrice(room.nightPrice.toString());
    setCapacity(room.capacity.toString());
    setPetTypes(room.petTypes);
    setSelectedAmenities(room.amenities);
    setIncluded(room.included);
    setNotIncluded(room.notIncluded);
    setSize(room.size);
    setFeatures(room.features);
    setRules(room.rules);
    setTotalUnits(room.totalUnits.toString());
    setPhotos(room.photos);
    setVideos(room.videos);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-bold text-gray-900">Boarding Rooms</h1>
              <p className="text-sm text-gray-600">{vendorName}</p>
            </div>
            <Button
              onClick={() => setShowAddRoom(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Room Type
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {rooms.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <HomeIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="font-bold text-gray-900 mb-2">No Rooms Yet</h3>
            <p className="text-gray-600 mb-6">
              Start by adding your first room type
            </p>
            <Button
              onClick={() => setShowAddRoom(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Room Type
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="bg-white rounded-xl border hover:shadow-lg transition-shadow overflow-hidden"
              >
                {/* Photo */}
                {room.photoUrls && room.photoUrls.length > 0 ? (
                  <img
                    src={room.photoUrls[0]}
                    alt={room.name}
                    className="w-full h-48 object-cover"
                  />
                ) : (
                  <div className="w-full h-48 bg-gray-100 flex items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-gray-300" />
                  </div>
                )}

                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-gray-900">{room.name}</h3>
                    {room.isActive ? (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                        Inactive
                      </span>
                    )}
                  </div>

                  {room.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {room.description}
                    </p>
                  )}

                  {/* Pricing */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-blue-50 rounded-lg p-2">
                      <p className="text-xs text-blue-600 font-medium">Day</p>
                      <p className="font-bold text-blue-900">₹{room.dayPrice}</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-2">
                      <p className="text-xs text-purple-600 font-medium">Night</p>
                      <p className="font-bold text-purple-900">₹{room.nightPrice}</p>
                    </div>
                  </div>

                  {/* Amenities */}
                  {room.amenities.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-1">Amenities</p>
                      <div className="flex flex-wrap gap-1">
                        {room.amenities.slice(0, 3).map((amenity, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs"
                          >
                            {amenity}
                          </span>
                        ))}
                        {room.amenities.length > 3 && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                            +{room.amenities.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Capacity & Units */}
                  <div className="flex items-center gap-4 text-xs text-gray-600 mb-3">
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>{room.capacity} pet{room.capacity !== 1 && 's'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <HomeIcon className="w-3 h-3" />
                      <span>{room.totalUnits} unit{room.totalUnits !== 1 && 's'}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t">
                    <button
                      onClick={() => openEditModal(room)}
                      className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 text-sm"
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteRoom(room.id)}
                      className="p-2 border border-red-200 rounded-lg hover:bg-red-50 text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Room Modal */}
      <Dialog
        open={showAddRoom || editingRoom !== null}
        onOpenChange={() => {
          setShowAddRoom(false);
          setEditingRoom(null);
          resetForm();
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRoom ? 'Edit Room' : 'Add New Room Type'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-2">Room Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="e.g., Deluxe Kennel, Luxury Suite"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg resize-none"
                  rows={3}
                  placeholder="Brief description of the room"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Day Price (₹) *</label>
                <input
                  type="number"
                  value={dayPrice}
                  onChange={(e) => setDayPrice(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Night Price (₹) *</label>
                <input
                  type="number"
                  value={nightPrice}
                  onChange={(e) => setNightPrice(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="1000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Capacity</label>
                <input
                  type="number"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Total Units</label>
                <input
                  type="number"
                  value={totalUnits}
                  onChange={(e) => setTotalUnits(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  min="1"
                />
              </div>
            </div>

            {/* Amenities */}
            <div>
              <label className="block text-sm font-medium mb-2">Amenities</label>
              <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto border rounded-lg p-3">
                {AMENITIES_OPTIONS.map((amenity) => (
                  <label
                    key={amenity}
                    className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAmenities.includes(amenity)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAmenities([...selectedAmenities, amenity]);
                        } else {
                          setSelectedAmenities(selectedAmenities.filter(a => a !== amenity));
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{amenity}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Media Upload */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Photos & Videos {!editingRoom && '*'}
              </label>
              <div className="relative overflow-hidden border-2 border-dashed rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, editingRoom?.id || null);
                  }}
                  className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                  id="media-upload"
                  disabled={uploadingMedia}
                />
                <div className="pointer-events-none flex flex-col items-center">
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">
                    {uploadingMedia ? 'Uploading...' : 'Click to upload photos or videos'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Max 50MB per file</p>
                </div>

                {/* Show uploaded media count */}
                {(photos.length > 0 || videos.length > 0) && (
                  <div className="mt-4 flex items-center justify-center gap-4 text-sm">
                    {photos.length > 0 && (
                      <span className="text-blue-600">
                        {photos.length} photo{photos.length !== 1 && 's'}
                      </span>
                    )}
                    {videos.length > 0 && (
                      <span className="text-purple-600">
                        {videos.length} video{videos.length !== 1 && 's'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                onClick={() => {
                  setShowAddRoom(false);
                  setEditingRoom(null);
                  resetForm();
                }}
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                onClick={editingRoom ? handleUpdateRoom : handleCreateRoom}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={uploadingMedia}
              >
                <Save className="w-4 h-4 mr-2" />
                {editingRoom ? 'Update Room' : 'Create Room'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
