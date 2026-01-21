'use client';

import { useState, useEffect } from 'react';
import { Plus, Heart, Calendar, Clock, MapPin, Phone, User, Edit, Trash2, Sun, Flower2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface SunsetServicesVendorDashboardProps {
  vendorId: string;
  vendorData?: any;
  onBack?: () => void;
}

interface ServicePackage {
  id?: string;
  name: string;
  description: string;
  price: number;
  type: string;
  includes: string[];
  isPublished: boolean;
}

interface MemorialBooking {
  id: string;
  customerName: string;
  customerPhone: string;
  petName: string;
  petType: string;
  serviceType: string;
  packageName: string;
  scheduledDate: string;
  scheduledTime: string;
  status: string;
  specialRequests?: string;
}

export function SunsetServicesVendorDashboard({ vendorId, vendorData, onBack }: SunsetServicesVendorDashboardProps) {
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [bookings, setBookings] = useState<MemorialBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'packages' | 'bookings'>('overview');
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState<ServicePackage | null>(null);
  const [newInclude, setNewInclude] = useState('');

  const [packageForm, setPackageForm] = useState<ServicePackage>({
    name: '',
    description: '',
    price: 0,
    type: 'cremation',
    includes: [],
    isPublished: false,
  });

  useEffect(() => {
    loadData();
  }, [vendorId]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadPackages(),
        loadBookings(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadPackages = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/services?category=sunset`);
      setPackages(response.services || response.packages || []);
    } catch (error) {
      console.error('Error loading packages:', error);
      setPackages([]);
    }
  };

  const loadBookings = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/bookings?category=sunset`);
      setBookings(response.bookings || response || []);
    } catch (error) {
      console.error('Error loading bookings:', error);
      setBookings([]);
    }
  };

  const handleSavePackage = async () => {
    if (!packageForm.name || !packageForm.description || packageForm.price <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        ...packageForm,
        vendorId,
        serviceType: 'sunset',
        category: 'sunset',
        serviceStyle: packageForm.type,
      };

      if (editingPackage?.id) {
        await apiClient.put<any>(`/vendor/${vendorId}/services/${editingPackage.id}`, payload);
        toast.success('Package updated successfully!');
      } else {
        await apiClient.post<any>(`/vendor/${vendorId}/services`, payload);
        toast.success('Package created successfully!');
      }
      setShowPackageModal(false);
      setEditingPackage(null);
      resetPackageForm();
      loadPackages();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save package');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePackage = async (packageId: string) => {
    if (!confirm('Are you sure you want to delete this package?')) return;

    try {
      await apiClient.delete<any>(`/vendor/${vendorId}/services/${packageId}`);
      toast.success('Package deleted successfully!');
      loadPackages();
    } catch (error: any) {
      toast.error('Failed to delete package');
    }
  };

  const handleUpdateBookingStatus = async (bookingId: string, status: string) => {
    try {
      await apiClient.put<any>(`/vendor/${vendorId}/bookings/${bookingId}`, { status });
      toast.success(`Booking ${status}`);
      loadBookings();
    } catch (error: any) {
      toast.error('Failed to update booking');
    }
  };

  const resetPackageForm = () => {
    setPackageForm({
      name: '',
      description: '',
      price: 0,
      type: 'cremation',
      includes: [],
      isPublished: false,
    });
    setNewInclude('');
  };

  const addInclude = () => {
    if (newInclude.trim()) {
      setPackageForm({
        ...packageForm,
        includes: [...packageForm.includes, newInclude.trim()],
      });
      setNewInclude('');
    }
  };

  const removeInclude = (index: number) => {
    setPackageForm({
      ...packageForm,
      includes: packageForm.includes.filter((_, i) => i !== index),
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'cremation': return Sun;
      case 'burial': return Flower2;
      case 'memorial': return Heart;
      default: return Package;
    }
  };

  const stats = {
    totalPackages: packages.length,
    publishedPackages: packages.filter(p => p.isPublished).length,
    pendingBookings: bookings.filter(b => b.status === 'pending').length,
    totalBookings: bookings.length,
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Sunset Care Services</h1>
            <p className="text-gray-600 mt-1">Manage memorial packages and bookings with compassion</p>
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
                <p className="text-sm text-gray-600">Service Packages</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalPackages}</p>
              </div>
              <Package className="w-8 h-8 text-purple-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Published</p>
                <p className="text-2xl font-bold text-green-600">{stats.publishedPackages}</p>
              </div>
              <Heart className="w-8 h-8 text-green-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-orange-600">{stats.pendingBookings}</p>
              </div>
              <Clock className="w-8 h-8 text-orange-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Bookings</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalBookings}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-500" />
            </div>
          </Card>
        </div>

        <div className="flex gap-2 mb-6 border-b">
          {[
            { id: 'overview', label: 'Overview', icon: Heart },
            { id: 'packages', label: 'Packages', icon: Package },
            { id: 'bookings', label: 'Bookings', icon: Calendar },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 flex items-center gap-2 border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-600 font-semibold'
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
                  <Button className="w-full justify-start bg-purple-500 hover:bg-purple-600" onClick={() => { resetPackageForm(); setEditingPackage(null); setShowPackageModal(true); }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Service Package
                  </Button>
                  <Button className="w-full justify-start" variant="outline" onClick={() => setActiveTab('bookings')}>
                    <Calendar className="w-4 h-4 mr-2" />
                    View All Bookings
                  </Button>
                </div>
              </Card>

              <Card className="p-6 bg-purple-50">
                <h3 className="text-lg font-bold text-purple-800 mb-4">Pending Arrangements</h3>
                {bookings.filter(b => b.status === 'pending').length === 0 ? (
                  <p className="text-gray-600">No pending arrangements</p>
                ) : (
                  <div className="space-y-2">
                    {bookings.filter(b => b.status === 'pending').slice(0, 3).map(booking => (
                      <div key={booking.id} className="p-3 bg-white rounded-lg border border-purple-200">
                        <p className="font-semibold text-gray-900">{booking.petName} - {booking.packageName}</p>
                        <p className="text-sm text-gray-500">{booking.scheduledDate} at {booking.scheduledTime}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'packages' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Memorial Packages</h2>
              <Button onClick={() => { resetPackageForm(); setEditingPackage(null); setShowPackageModal(true); }} className="bg-purple-500 hover:bg-purple-600">
                <Plus className="w-4 h-4 mr-2" />
                Add Package
              </Button>
            </div>

            {packages.length === 0 ? (
              <Card className="p-12 text-center">
                <Heart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Packages</h3>
                <p className="text-gray-600 mb-4">Create your first memorial service package</p>
                <Button onClick={() => { resetPackageForm(); setShowPackageModal(true); }} className="bg-purple-500 hover:bg-purple-600">
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Package
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {packages.map((pkg) => {
                  const TypeIcon = getTypeIcon(pkg.type);
                  return (
                    <Card key={pkg.id || pkg.name} className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                            <TypeIcon className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900">{pkg.name}</h3>
                            <p className="text-sm text-gray-500 capitalize">{pkg.type}</p>
                          </div>
                        </div>
                        {pkg.isPublished ? (
                          <Badge className="bg-green-500">Published</Badge>
                        ) : (
                          <Badge variant="outline">Draft</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{pkg.description}</p>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-lg font-bold text-purple-600">₹{pkg.price?.toLocaleString()}</span>
                      </div>
                      {pkg.includes && pkg.includes.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {pkg.includes.slice(0, 2).map((inc, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">{inc}</Badge>
                          ))}
                          {pkg.includes.length > 2 && (
                            <Badge variant="outline" className="text-xs">+{pkg.includes.length - 2}</Badge>
                          )}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => { setEditingPackage(pkg); setPackageForm(pkg); setShowPackageModal(true); }}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => pkg.id && handleDeletePackage(pkg.id)} className="text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'bookings' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Memorial Bookings</h2>
            {bookings.length === 0 ? (
              <Card className="p-12 text-center">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Bookings</h3>
                <p className="text-gray-600">Bookings will appear here</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {bookings.map((booking) => (
                  <Card key={booking.id} className={`p-4 ${booking.status === 'pending' ? 'border-purple-200 bg-purple-50' : ''}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-gray-900">In Memory of {booking.petName}</h3>
                          <Badge variant={booking.status === 'pending' ? 'default' : 'outline'}>{booking.status}</Badge>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4" />
                            <span>{booking.packageName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span>{booking.customerName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>{booking.scheduledDate} at {booking.scheduledTime}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            <span>{booking.customerPhone}</span>
                          </div>
                          {booking.specialRequests && (
                            <div className="mt-2 p-2 bg-white rounded border">
                              <p className="text-xs text-gray-500">Special Requests:</p>
                              <p className="text-sm">{booking.specialRequests}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      {booking.status === 'pending' && (
                        <div className="flex gap-2 ml-4">
                          <Button
                            size="sm"
                            className="bg-green-500 hover:bg-green-600"
                            onClick={() => handleUpdateBookingStatus(booking.id, 'confirmed')}
                          >
                            Confirm
                          </Button>
                        </div>
                      )}
                      {booking.status === 'confirmed' && (
                        <Button
                          size="sm"
                          className="bg-purple-500 hover:bg-purple-600 ml-4"
                          onClick={() => handleUpdateBookingStatus(booking.id, 'completed')}
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

        {showPackageModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  {editingPackage ? 'Edit Package' : 'Create Memorial Package'}
                </h2>
                <div className="space-y-4">
                  <div>
                    <Label>Package Name *</Label>
                    <Input
                      value={packageForm.name}
                      onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })}
                      placeholder="e.g., Peaceful Farewell, Premium Memorial"
                    />
                  </div>
                  <div>
                    <Label>Description *</Label>
                    <Textarea
                      value={packageForm.description}
                      onChange={(e) => setPackageForm({ ...packageForm, description: e.target.value })}
                      placeholder="Describe the service with empathy..."
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Price (₹) *</Label>
                      <Input
                        type="number"
                        value={packageForm.price}
                        onChange={(e) => setPackageForm({ ...packageForm, price: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>Service Type</Label>
                      <select
                        value={packageForm.type}
                        onChange={(e) => setPackageForm({ ...packageForm, type: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="cremation">Cremation</option>
                        <option value="burial">Burial</option>
                        <option value="memorial">Memorial Service</option>
                        <option value="complete">Complete Package</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <Label>What's Included</Label>
                    <div className="flex gap-2 mb-2">
                      <Input
                        value={newInclude}
                        onChange={(e) => setNewInclude(e.target.value)}
                        placeholder="e.g., Memorial plaque, Ashes urn"
                        onKeyPress={(e) => e.key === 'Enter' && addInclude()}
                      />
                      <Button type="button" onClick={addInclude}>Add</Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {packageForm.includes.map((inc, idx) => (
                        <Badge key={idx} className="flex items-center gap-1 bg-purple-100 text-purple-800">
                          {inc}
                          <button onClick={() => removeInclude(idx)}>×</button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="packagePublished"
                      checked={packageForm.isPublished}
                      onChange={(e) => setPackageForm({ ...packageForm, isPublished: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="packagePublished">Publish immediately</Label>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button variant="outline" className="flex-1" onClick={() => { setShowPackageModal(false); resetPackageForm(); setEditingPackage(null); }}>
                      Cancel
                    </Button>
                    <Button className="flex-1 bg-purple-500 hover:bg-purple-600" onClick={handleSavePackage} disabled={loading}>
                      {editingPackage ? 'Update' : 'Create'} Package
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
