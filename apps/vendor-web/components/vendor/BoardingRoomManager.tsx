'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Edit, Trash2, Save, X, Upload, Image as ImageIcon, Check } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

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
  photos: string[];
  isActive: boolean;
  totalUnits: number;
}

export function BoardingRoomManager({
  vendorId,
  vendorName,
  onBack
}: BoardingRoomManagerProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    dayPrice: '',
    nightPrice: '',
    capacity: '1',
    totalUnits: '1',
    petTypes: [] as string[],
    amenities: [] as string[]
  });

  useEffect(() => {
    loadRooms();
  }, [vendorId]);

  const loadRooms = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/${vendorId}/boarding-rooms`);
      if (response.success) {
        setRooms(response.rooms || []);
      }
    } catch (error) {
      console.error('Error loading rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (editingRoom) {
        await apiClient.put(`/vendor/${vendorId}/boarding-rooms/${editingRoom.id}`, formData);
      } else {
        await apiClient.post(`/vendor/${vendorId}/boarding-rooms`, formData);
      }
      setShowAddRoom(false);
      setEditingRoom(null);
      resetForm();
      loadRooms();
    } catch (error: any) {
      alert(error.message || 'Failed to save room');
    }
  };

  const handleDelete = async (roomId: string) => {
    if (!confirm('Are you sure you want to delete this room?')) return;
    try {
      await apiClient.delete(`/vendor/${vendorId}/boarding-rooms/${roomId}`);
      loadRooms();
    } catch (error: any) {
      alert(error.message || 'Failed to delete room');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      dayPrice: '',
      nightPrice: '',
      capacity: '1',
      totalUnits: '1',
      petTypes: [],
      amenities: []
    });
  };

  const AMENITIES = ['CCTV', 'AC', 'Heating', 'Play Area', '24/7 Supervision', 'Medical Care'];

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      <div className="bg-white border-b sticky top-0 z-10 p-4">
        <div className="flex items-center gap-0 mb-4">
          <button onClick={onBack} className="w-8 h-8 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="font-semibold text-gray-900">Boarding Rooms</h1>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingRoom(null);
            setShowAddRoom(true);
          }}
          className="w-full px-4 py-0 bg-[#FF8C42] text-white rounded-lg font-medium flex items-center justify-center gap-0"
        >
          <Plus className="w-5 h-5" />
          Add Room
        </button>
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-center py-12">Loading rooms...</div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border-2 border-gray-200">
            <p className="text-gray-500">No rooms added yet</p>
          </div>
        ) : (
          rooms.map(room => (
            <div key={room.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-0">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{room.name}</h3>
                  <p className="text-sm text-gray-600 mt-0">{room.description}</p>
                  <div className="flex items-center gap-4 mt-0">
                    <span className="text-sm font-medium text-[#FF8C42]">₹{room.dayPrice}/day</span>
                    <span className="text-sm font-medium text-[#FF8C42]">₹{room.nightPrice}/night</span>
                  </div>
                </div>
                <div className="flex gap-0">
                  <button
                    onClick={() => {
                      setEditingRoom(room);
                      setFormData({
                        name: room.name,
                        description: room.description,
                        dayPrice: room.dayPrice.toString(),
                        nightPrice: room.nightPrice.toString(),
                        capacity: room.capacity.toString(),
                        totalUnits: room.totalUnits.toString(),
                        petTypes: room.petTypes,
                        amenities: room.amenities
                      });
                      setShowAddRoom(true);
                    }}
                    className="p-0 hover:bg-gray-100 rounded-lg"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(room.id)}
                    className="p-0 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showAddRoom && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-0">
            <h3 className="text-lg font-semibold mb-4">{editingRoom ? 'Edit Room' : 'Add Room'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-0">Room Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-0">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42] resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Day Price (₹)</label>
                  <input
                    type="number"
                    value={formData.dayPrice}
                    onChange={(e) => setFormData(prev => ({ ...prev, dayPrice: e.target.value }))}
                    className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Night Price (₹)</label>
                  <input
                    type="number"
                    value={formData.nightPrice}
                    onChange={(e) => setFormData(prev => ({ ...prev, nightPrice: e.target.value }))}
                    className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-0">Amenities</label>
                <div className="space-y-2">
                  {AMENITIES.map(amenity => (
                    <button
                      key={amenity}
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        amenities: prev.amenities.includes(amenity)
                          ? prev.amenities.filter(a => a !== amenity)
                          : [...prev.amenities, amenity]
                      }))}
                      className={`w-full px-4 py-0 rounded-lg border-2 text-left ${
                        formData.amenities.includes(amenity)
                          ? 'border-[#FF8C42] bg-orange-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{amenity}</span>
                        {formData.amenities.includes(amenity) && (
                          <Check className="w-5 h-5 text-[#FF8C42]" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-0 mt-0">
              <button
                onClick={() => {
                  setShowAddRoom(false);
                  setEditingRoom(null);
                  resetForm();
                }}
                className="flex-1 px-4 py-0 border border-gray-300 text-gray-700 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-0 bg-[#FF8C42] text-white rounded-lg font-medium"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

