'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Plus, Edit, Trash2, Building2, Calendar, Clock, Check, X, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface RoomManagementProps {
  vendorId: string;
  centreId?: string;
}

interface Room {
  id: string;
  vendorId: string;
  centreId?: string;
  centreName?: string;
  roomNumber: string;
  roomName?: string;
  roomType: string;
  isActive: boolean;
  capacity: number;
  amenities: string[];
  metadata: any;
  availability?: AvailabilitySlot[];
}

interface AvailabilitySlot {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

export function RoomManagement({ vendorId, centreId }: RoomManagementProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<Room | null>(null);

  const [formData, setFormData] = useState({
    roomNumber: '',
    roomName: '',
    roomType: 'consultation',
    capacity: 1,
    amenities: [] as string[],
    isActive: true,
  });

  useEffect(() => {
    loadRooms();
  }, [vendorId, centreId]);

  const loadRooms = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get(`/vendor/${vendorId}/rooms${centreId ? `?centreId=${centreId}` : ''}`) as any;
      
      if (data.success) {
        setRooms(data.rooms || []);
      }
    } catch (error) {
      console.error('Error loading rooms:', error);
      toast.error('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async () => {
    try {
      if (!formData.roomNumber.trim()) {
        toast.error('Room number is required');
        return;
      }

      const data = await apiClient.post(`/vendor/${vendorId}/rooms`, {
        roomNumber: formData.roomNumber,
        roomName: formData.roomName || null,
        roomType: formData.roomType,
        centreId: centreId || null,
        capacity: formData.capacity,
        amenities: formData.amenities,
        metadata: {},
      }) as any;

      if (data.success) {
        toast.success('Room created successfully');
        setShowCreateDialog(false);
        resetForm();
        loadRooms();
      }
    } catch (error: any) {
      console.error('Error creating room:', error);
      toast.error(error?.error || 'Failed to create room');
    }
  };

  const handleUpdateRoom = async () => {
    try {
      if (!editingRoom) return;

      const data = await apiClient.put(`/vendor/${vendorId}/rooms/${editingRoom.id}`, {
        roomName: formData.roomName,
        roomType: formData.roomType,
        capacity: formData.capacity,
        amenities: formData.amenities,
        isActive: formData.isActive,
      }) as any;

      if (data.success) {
        toast.success('Room updated successfully');
        setEditingRoom(null);
        resetForm();
        loadRooms();
      }
    } catch (error: any) {
      console.error('Error updating room:', error);
      toast.error(error?.error || 'Failed to update room');
    }
  };

  const handleDeleteRoom = async () => {
    try {
      if (!deletingRoom) return;

      const data = await apiClient.delete(`/vendor/${vendorId}/rooms/${deletingRoom.id}`) as any;

      if (data.success) {
        toast.success(data.message || 'Room deleted successfully');
        setDeletingRoom(null);
        loadRooms();
      }
    } catch (error: any) {
      console.error('Error deleting room:', error);
      toast.error(error?.error || 'Failed to delete room');
    }
  };

  const resetForm = () => {
    setFormData({
      roomNumber: '',
      roomName: '',
      roomType: 'consultation',
      capacity: 1,
      amenities: [],
      isActive: true,
    });
  };

  const openEditDialog = (room: Room) => {
    setEditingRoom(room);
    setFormData({
      roomNumber: room.roomNumber,
      roomName: room.roomName || '',
      roomType: room.roomType,
      capacity: room.capacity,
      amenities: room.amenities || [],
      isActive: room.isActive,
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setShowCreateDialog(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-gray-500">Loading rooms...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Consultation Rooms</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage consultation rooms for {centreId ? 'this centre' : 'your clinic'}
          </p>
        </div>
        <Button onClick={openCreateDialog} className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white">
          <Plus className="w-4 h-4 mr-2" />
          Add Room
        </Button>
      </div>

      {/* Rooms List */}
      {rooms.length === 0 ? (
        <Card className="p-8 text-center">
          <Building2 className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600 mb-4">No rooms configured yet</p>
          <Button onClick={openCreateDialog} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Room
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rooms.map((room) => (
            <Card key={room.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{room.roomNumber}</h3>
                    {room.roomName && (
                      <span className="text-sm text-gray-600">- {room.roomName}</span>
                    )}
                    {room.isActive ? (
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-600 mt-2">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {room.roomType}
                    </span>
                    <span className="flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      Capacity: {room.capacity}
                    </span>
                  </div>
                  {room.centreName && (
                    <p className="text-xs text-gray-500 mt-1">Centre: {room.centreName}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(room)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeletingRoom(room)}
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </div>
              {room.amenities && room.amenities.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500">Amenities:</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {room.amenities.map((amenity, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {amenity}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog || editingRoom !== null} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setEditingRoom(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingRoom ? 'Edit Room' : 'Create New Room'}
            </DialogTitle>
            <DialogDescription>
              {editingRoom ? 'Update room details' : 'Add a new consultation room'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Room Number *</Label>
              <Input
                value={formData.roomNumber}
                onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                placeholder="e.g., Room 1, Consultation 101"
                disabled={!!editingRoom}
              />
            </div>
            <div>
              <Label>Room Name (Optional)</Label>
              <Input
                value={formData.roomName}
                onChange={(e) => setFormData({ ...formData, roomName: e.target.value })}
                placeholder="e.g., Consultation Room 1"
              />
            </div>
            <div>
              <Label>Room Type</Label>
              <select
                value={formData.roomType}
                onChange={(e) => setFormData({ ...formData, roomType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="consultation">Consultation</option>
                <option value="surgery">Surgery</option>
                <option value="examination">Examination</option>
                <option value="procedure">Procedure</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <Label>Capacity</Label>
              <Input
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 1 })}
                min="1"
                placeholder="1"
              />
            </div>
            {editingRoom && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <Label>Active</Label>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false);
              setEditingRoom(null);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button
              onClick={editingRoom ? handleUpdateRoom : handleCreateRoom}
              className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
            >
              {editingRoom ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deletingRoom !== null} onOpenChange={(open) => {
        if (!open) setDeletingRoom(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Room</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {deletingRoom?.roomNumber}? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingRoom(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteRoom}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
