'use client';

import { useState, useEffect } from 'react';
import { Plus, Ambulance, MapPin, Calendar, Phone, User, Edit, Trash2, CheckCircle2, Clock, AlertTriangle, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface AmbulanceVendorDashboardProps {
  vendorId: string;
  vendorData?: any;
  onBack?: () => void;
}

interface Vehicle {
  id?: string;
  vehicleNumber: string;
  vehicleType: string;
  driverName: string;
  driverPhone: string;
  isAvailable: boolean;
  equipment: string[];
}

interface SOSRequest {
  id: string;
  customerName: string;
  customerPhone: string;
  petName: string;
  petType: string;
  emergency: string;
  pickupLocation: string;
  destinationLocation?: string;
  status: string;
  assignedVehicle?: string;
  createdAt: string;
}

export function AmbulanceVendorDashboard({ vendorId, vendorData, onBack }: AmbulanceVendorDashboardProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [sosRequests, setSosRequests] = useState<SOSRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'vehicles' | 'sos'>('overview');
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [newEquipment, setNewEquipment] = useState('');

  const [vehicleForm, setVehicleForm] = useState<Vehicle>({
    vehicleNumber: '',
    vehicleType: 'standard',
    driverName: '',
    driverPhone: '',
    isAvailable: true,
    equipment: [],
  });

  useEffect(() => {
    loadData();
  }, [vendorId]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadVehicles(),
        loadSOSRequests(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadVehicles = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/ambulance/vehicles`);
      setVehicles(response.vehicles || response || []);
    } catch (error) {
      console.error('Error loading vehicles:', error);
      setVehicles([]);
    }
  };

  const loadSOSRequests = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/ambulance/sos-requests`);
      setSosRequests(response.requests || response || []);
    } catch (error) {
      console.error('Error loading SOS requests:', error);
      setSosRequests([]);
    }
  };

  const handleSaveVehicle = async () => {
    if (!vehicleForm.vehicleNumber || !vehicleForm.driverName || !vehicleForm.driverPhone) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      if (editingVehicle?.id) {
        await apiClient.put<any>(`/vendor/${vendorId}/ambulance/vehicles/${editingVehicle.id}`, vehicleForm);
        toast.success('Vehicle updated successfully!');
      } else {
        await apiClient.post<any>(`/vendor/${vendorId}/ambulance/vehicles`, vehicleForm);
        toast.success('Vehicle added successfully!');
      }
      setShowVehicleModal(false);
      setEditingVehicle(null);
      resetVehicleForm();
      loadVehicles();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save vehicle');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    if (!confirm('Are you sure you want to delete this vehicle?')) return;

    try {
      await apiClient.delete<any>(`/vendor/${vendorId}/ambulance/vehicles/${vehicleId}`);
      toast.success('Vehicle deleted successfully!');
      loadVehicles();
    } catch (error: any) {
      toast.error('Failed to delete vehicle');
    }
  };

  const handleAcceptSOS = async (requestId: string, vehicleId: string) => {
    try {
      await apiClient.put<any>(`/vendor/${vendorId}/ambulance/sos-requests/${requestId}`, {
        status: 'accepted',
        assignedVehicle: vehicleId,
      });
      toast.success('SOS request accepted!');
      loadSOSRequests();
      loadVehicles();
    } catch (error: any) {
      toast.error('Failed to accept request');
    }
  };

  const handleCompleteSOS = async (requestId: string) => {
    try {
      await apiClient.put<any>(`/vendor/${vendorId}/ambulance/sos-requests/${requestId}`, {
        status: 'completed',
      });
      toast.success('SOS request completed!');
      loadSOSRequests();
      loadVehicles();
    } catch (error: any) {
      toast.error('Failed to complete request');
    }
  };

  const resetVehicleForm = () => {
    setVehicleForm({
      vehicleNumber: '',
      vehicleType: 'standard',
      driverName: '',
      driverPhone: '',
      isAvailable: true,
      equipment: [],
    });
    setNewEquipment('');
  };

  const addEquipment = () => {
    if (newEquipment.trim()) {
      setVehicleForm({
        ...vehicleForm,
        equipment: [...vehicleForm.equipment, newEquipment.trim()],
      });
      setNewEquipment('');
    }
  };

  const removeEquipment = (index: number) => {
    setVehicleForm({
      ...vehicleForm,
      equipment: vehicleForm.equipment.filter((_, i) => i !== index),
    });
  };

  const stats = {
    totalVehicles: vehicles.length,
    availableVehicles: vehicles.filter(v => v.isAvailable).length,
    activeSOS: sosRequests.filter(r => r.status === 'pending' || r.status === 'accepted').length,
    completedToday: sosRequests.filter(r => {
      const today = new Date().toISOString().split('T')[0];
      return r.status === 'completed' && r.createdAt?.startsWith(today);
    }).length,
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Ambulance Services</h1>
            <p className="text-gray-600 mt-1">Manage vehicles and emergency requests</p>
          </div>
          {onBack && (
            <Button variant="outline" onClick={onBack}>
              ← Back
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Vehicles</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalVehicles}</p>
              </div>
              <Truck className="w-8 h-8 text-blue-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Available</p>
                <p className="text-2xl font-bold text-green-600">{stats.availableVehicles}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </Card>
          <Card className="p-4 bg-red-50 border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600">Active SOS</p>
                <p className="text-2xl font-bold text-red-600">{stats.activeSOS}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed Today</p>
                <p className="text-2xl font-bold text-purple-600">{stats.completedToday}</p>
              </div>
              <Calendar className="w-8 h-8 text-purple-500" />
            </div>
          </Card>
        </div>

        <div className="flex gap-2 mb-6 border-b">
          {[
            { id: 'overview', label: 'Overview', icon: Ambulance },
            { id: 'vehicles', label: 'Vehicles', icon: Truck },
            { id: 'sos', label: 'SOS Requests', icon: AlertTriangle },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 flex items-center gap-2 border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-red-500 text-red-600 font-semibold'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <Button className="w-full justify-start" onClick={() => { resetVehicleForm(); setEditingVehicle(null); setShowVehicleModal(true); }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add New Vehicle
                  </Button>
                  <Button className="w-full justify-start" variant="outline" onClick={() => setActiveTab('sos')}>
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    View SOS Requests
                  </Button>
                </div>
              </Card>

              <Card className="p-6 bg-red-50">
                <h3 className="text-lg font-bold text-red-600 mb-4">Pending SOS Requests</h3>
                {sosRequests.filter(r => r.status === 'pending').length === 0 ? (
                  <p className="text-gray-600">No pending SOS requests</p>
                ) : (
                  <div className="space-y-2">
                    {sosRequests.filter(r => r.status === 'pending').slice(0, 3).map(req => (
                      <div key={req.id} className="p-3 bg-white rounded-lg border border-red-200">
                        <p className="font-semibold text-gray-900">{req.emergency}</p>
                        <p className="text-sm text-gray-500">{req.pickupLocation}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'vehicles' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Manage Vehicles</h2>
              <Button onClick={() => { resetVehicleForm(); setEditingVehicle(null); setShowVehicleModal(true); }} className="bg-red-500 hover:bg-red-600">
                <Plus className="w-4 h-4 mr-2" />
                Add Vehicle
              </Button>
            </div>

            {vehicles.length === 0 ? (
              <Card className="p-12 text-center">
                <Truck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Vehicles</h3>
                <Button onClick={() => { resetVehicleForm(); setShowVehicleModal(true); }} className="bg-red-500 hover:bg-red-600">
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Vehicle
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {vehicles.map((vehicle) => (
                  <Card key={vehicle.id || vehicle.vehicleNumber} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-gray-900">{vehicle.vehicleNumber}</h3>
                        <p className="text-sm text-gray-500 capitalize">{vehicle.vehicleType}</p>
                      </div>
                      {vehicle.isAvailable ? (
                        <Badge className="bg-green-500">Available</Badge>
                      ) : (
                        <Badge variant="outline">On Duty</Badge>
                      )}
                    </div>
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <User className="w-4 h-4" />
                        <span>{vehicle.driverName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4" />
                        <span>{vehicle.driverPhone}</span>
                      </div>
                    </div>
                    {vehicle.equipment && vehicle.equipment.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {vehicle.equipment.slice(0, 3).map((eq, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">{eq}</Badge>
                        ))}
                        {vehicle.equipment.length > 3 && (
                          <Badge variant="outline" className="text-xs">+{vehicle.equipment.length - 3}</Badge>
                        )}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setEditingVehicle(vehicle); setVehicleForm(vehicle); setShowVehicleModal(true); }}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => vehicle.id && handleDeleteVehicle(vehicle.id)} className="text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'sos' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">SOS Requests</h2>
            {sosRequests.length === 0 ? (
              <Card className="p-12 text-center">
                <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No SOS Requests</h3>
                <p className="text-gray-600">Emergency requests will appear here</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {sosRequests.map((request) => (
                  <Card key={request.id} className={`p-4 ${request.status === 'pending' ? 'border-red-200 bg-red-50' : ''}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-gray-900">{request.emergency}</h3>
                          <Badge variant={request.status === 'pending' ? 'destructive' : 'outline'}>{request.status}</Badge>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span>{request.customerName} • {request.petName} ({request.petType})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            <span>{request.pickupLocation}</span>
                          </div>
                          {request.destinationLocation && (
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4" />
                              <span>→ {request.destinationLocation}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            <span>{request.customerPhone}</span>
                          </div>
                          {request.assignedVehicle && (
                            <div className="flex items-center gap-2">
                              <Truck className="w-4 h-4" />
                              <span>Assigned: {request.assignedVehicle}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {request.status === 'pending' && vehicles.filter(v => v.isAvailable).length > 0 && (
                        <div className="ml-4">
                          <select
                            className="px-3 py-2 border rounded-lg text-sm mb-2 w-full"
                            id={`vehicle-${request.id}`}
                          >
                            {vehicles.filter(v => v.isAvailable).map(v => (
                              <option key={v.id} value={v.id}>{v.vehicleNumber} - {v.driverName}</option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            className="w-full bg-red-500 hover:bg-red-600"
                            onClick={() => {
                              const selectEl = document.getElementById(`vehicle-${request.id}`) as HTMLSelectElement;
                              if (selectEl?.value) {
                                handleAcceptSOS(request.id, selectEl.value);
                              }
                            }}
                          >
                            Dispatch
                          </Button>
                        </div>
                      )}
                      {request.status === 'accepted' && (
                        <Button
                          size="sm"
                          className="bg-green-500 hover:bg-green-600 ml-4"
                          onClick={() => handleCompleteSOS(request.id)}
                        >
                          Complete
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {showVehicleModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  {editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}
                </h2>
                <div className="space-y-4">
                  <div>
                    <Label>Vehicle Number *</Label>
                    <Input
                      value={vehicleForm.vehicleNumber}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, vehicleNumber: e.target.value })}
                      placeholder="e.g., MH01AB1234"
                    />
                  </div>
                  <div>
                    <Label>Vehicle Type</Label>
                    <select
                      value={vehicleForm.vehicleType}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, vehicleType: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="standard">Standard</option>
                      <option value="advanced">Advanced Life Support</option>
                      <option value="icu">ICU Ambulance</option>
                    </select>
                  </div>
                  <div>
                    <Label>Driver Name *</Label>
                    <Input
                      value={vehicleForm.driverName}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, driverName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Driver Phone *</Label>
                    <Input
                      value={vehicleForm.driverPhone}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, driverPhone: e.target.value })}
                      placeholder="+91 XXXXXXXXXX"
                    />
                  </div>
                  <div>
                    <Label>Equipment</Label>
                    <div className="flex gap-2 mb-2">
                      <Input
                        value={newEquipment}
                        onChange={(e) => setNewEquipment(e.target.value)}
                        placeholder="e.g., Oxygen, Stretcher"
                        onKeyPress={(e) => e.key === 'Enter' && addEquipment()}
                      />
                      <Button type="button" onClick={addEquipment}>Add</Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {vehicleForm.equipment.map((eq, idx) => (
                        <Badge key={idx} className="flex items-center gap-1">
                          {eq}
                          <button onClick={() => removeEquipment(idx)}>×</button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="vehicleAvailable"
                      checked={vehicleForm.isAvailable}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, isAvailable: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="vehicleAvailable">Available for dispatch</Label>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button variant="outline" className="flex-1" onClick={() => { setShowVehicleModal(false); resetVehicleForm(); setEditingVehicle(null); }}>
                      Cancel
                    </Button>
                    <Button className="flex-1 bg-red-500 hover:bg-red-600" onClick={handleSaveVehicle} disabled={loading}>
                      {editingVehicle ? 'Update' : 'Add'} Vehicle
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
