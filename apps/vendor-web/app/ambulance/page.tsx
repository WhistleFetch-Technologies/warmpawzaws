'use client';

/**
 * Ambulance Management Page
 * Manages ambulance vehicles and dispatch
 * Capability: ambulance
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Ambulance, 
  Plus, 
  MapPin, 
  Phone, 
  Settings, 
  CheckCircle,
  XCircle,
  Truck,
  Users,
  Clock
} from 'lucide-react';

interface Vehicle {
  id: string;
  vehicle_number: string;
  vehicle_type: 'basic' | 'advanced' | 'icu';
  capacity: number;
  equipment: string[];
  is_available: boolean;
  current_location?: string;
  rating: number;
  total_trips: number;
  driver_name?: string;
  driver_phone?: string;
}

export default function AmbulancePage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    vehicleNumber: '',
    vehicleType: 'basic' as 'basic' | 'advanced' | 'icu',
    capacity: 2,
    equipment: [] as string[],
    driverName: '',
    driverPhone: '',
  });

  useEffect(() => {
    const storedVendorId = localStorage.getItem('vendorId');
    if (!storedVendorId) {
      router.push('/onboarding');
      return;
    }
    setVendorId(storedVendorId);
    fetchVehicles(storedVendorId);
  }, [router]);

  const fetchVehicles = async (vId?: string) => {
    const id = vId || vendorId;
    if (!id) return;
    
    setLoading(true);
    try {
      const data = await apiClient.get<{ success: boolean; vehicles: Vehicle[] }>(`/vendor/${id}/ambulance/vehicles`);
      setVehicles(data.vehicles || []);
    } catch (error: any) {
      console.error('Error fetching vehicles:', error);
      if (error.message?.includes('403')) {
        toast.error('You do not have access to ambulance management');
      } else {
        toast.error('Failed to load vehicles');
      }
    } finally {
      setLoading(false);
    }
  };

  const addVehicle = async () => {
    if (!vendorId || !newVehicle.vehicleNumber) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      await apiClient.post(`/vendor/${vendorId}/ambulance/vehicles`, newVehicle);
      toast.success('Vehicle added successfully');
      setShowAddModal(false);
      setNewVehicle({
        vehicleNumber: '',
        vehicleType: 'basic',
        capacity: 2,
        equipment: [],
        driverName: '',
        driverPhone: '',
      });
      fetchVehicles();
    } catch (error: any) {
      console.error('Error adding vehicle:', error);
      toast.error(error.message || 'Failed to add vehicle');
    }
  };

  const toggleAvailability = async (vehicleId: string, isAvailable: boolean) => {
    if (!vendorId) return;

    try {
      await apiClient.put(`/vendor/${vendorId}/ambulance/vehicles/${vehicleId}`, { isAvailable: !isAvailable });
      toast.success(`Vehicle ${isAvailable ? 'marked unavailable' : 'marked available'}`);
      fetchVehicles();
    } catch (error: any) {
      console.error('Error updating vehicle:', error);
      toast.error('Failed to update vehicle');
    }
  };

  const getVehicleTypeColor = (type: string) => {
    switch (type) {
      case 'icu': return 'bg-red-100 text-red-800';
      case 'advanced': return 'bg-orange-100 text-orange-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const stats = {
    total: vehicles.length,
    available: vehicles.filter(v => v.is_available).length,
    onDuty: vehicles.filter(v => !v.is_available).length,
    totalTrips: vehicles.reduce((sum, v) => sum + (v.total_trips || 0), 0),
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Ambulance className="h-8 w-8 text-red-500" />
            Ambulance Management
          </h1>
          <p className="text-muted-foreground">Manage your emergency vehicle fleet</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Vehicle
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <Truck className="h-10 w-10 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Vehicles</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <CheckCircle className="h-10 w-10 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Available</p>
              <p className="text-2xl font-bold">{stats.available}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <Clock className="h-10 w-10 text-orange-500" />
            <div>
              <p className="text-sm text-muted-foreground">On Duty</p>
              <p className="text-2xl font-bold">{stats.onDuty}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <Users className="h-10 w-10 text-purple-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Trips</p>
              <p className="text-2xl font-bold">{stats.totalTrips}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vehicles Grid */}
      {loading ? (
        <div className="text-center py-12">Loading vehicles...</div>
      ) : vehicles.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Ambulance className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No vehicles yet</h3>
            <p className="text-muted-foreground mb-4">Add your first ambulance vehicle to get started</p>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Vehicle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map((vehicle) => (
            <Card key={vehicle.id} className={`${vehicle.is_available ? 'border-green-200' : 'border-red-200'}`}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Truck className="h-5 w-5" />
                      {vehicle.vehicle_number}
                    </CardTitle>
                    <Badge className={getVehicleTypeColor(vehicle.vehicle_type)}>
                      {vehicle.vehicle_type.toUpperCase()}
                    </Badge>
                  </div>
                  <Button
                    variant={vehicle.is_available ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => toggleAvailability(vehicle.id, vehicle.is_available)}
                  >
                    {vehicle.is_available ? (
                      <><XCircle className="h-4 w-4 mr-1" /> Mark Busy</>
                    ) : (
                      <><CheckCircle className="h-4 w-4 mr-1" /> Mark Available</>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>Capacity: {vehicle.capacity} patients</span>
                </div>
                {vehicle.current_location && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{vehicle.current_location}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <span>Trips: {vehicle.total_trips} | Rating: ⭐ {vehicle.rating?.toFixed(1) || '5.0'}</span>
                </div>
                {vehicle.equipment && vehicle.equipment.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {vehicle.equipment.map((equip, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">{equip}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Vehicle Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Add New Vehicle</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Vehicle Number *</label>
                <Input
                  value={newVehicle.vehicleNumber}
                  onChange={(e) => setNewVehicle(prev => ({ ...prev, vehicleNumber: e.target.value }))}
                  placeholder="e.g., MH01AB1234"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Vehicle Type</label>
                <select
                  className="w-full border rounded-md p-2"
                  value={newVehicle.vehicleType}
                  onChange={(e) => setNewVehicle(prev => ({ ...prev, vehicleType: e.target.value as any }))}
                >
                  <option value="basic">Basic Ambulance</option>
                  <option value="advanced">Advanced Life Support</option>
                  <option value="icu">Mobile ICU</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Capacity (patients)</label>
                <Input
                  type="number"
                  value={newVehicle.capacity}
                  onChange={(e) => setNewVehicle(prev => ({ ...prev, capacity: parseInt(e.target.value) || 2 }))}
                  min={1}
                  max={10}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowAddModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={addVehicle} className="flex-1">
                  Add Vehicle
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
