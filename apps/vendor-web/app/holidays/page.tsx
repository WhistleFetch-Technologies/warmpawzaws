'use client';

/**
 * Holiday Packages Management Page
 * Manages pet holiday/tour packages
 * Capability: holiday_packages, tour_schedule
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
  Plane, 
  Plus, 
  Calendar,
  MapPin,
  Users,
  IndianRupee,
  Clock,
  Star
} from 'lucide-react';

interface HolidayPackage {
  id: string;
  name: string;
  description?: string;
  destination: string;
  duration_days: number;
  price: number;
  max_pets: number;
  pet_types_allowed: string[];
  includes: string[];
  next_departure?: string;
  rating?: number;
  bookings_count?: number;
  is_active: boolean;
  created_at: string;
}

export default function HolidaysPage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [packages, setPackages] = useState<HolidayPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPackage, setNewPackage] = useState({
    name: '',
    description: '',
    destination: '',
    durationDays: 3,
    price: 0,
    maxPets: 10,
    includes: [] as string[],
  });

  useEffect(() => {
    const storedVendorId = localStorage.getItem('vendorId');
    if (!storedVendorId) {
      router.push('/onboarding');
      return;
    }
    setVendorId(storedVendorId);
    fetchPackages(storedVendorId);
  }, [router]);

  const fetchPackages = async (vId?: string) => {
    const id = vId || vendorId;
    if (!id) return;
    
    setLoading(true);
    try {
      const data = await apiClient.get<{ success: boolean; packages: HolidayPackage[] }>(`/vendor/${id}/holidays/packages`);
      setPackages(data.packages || []);
    } catch (error: any) {
      console.error('Error fetching packages:', error);
      if (error.message?.includes('403')) {
        toast.error('You do not have access to holiday management');
      }
    } finally {
      setLoading(false);
    }
  };

  const addPackage = async () => {
    if (!vendorId || !newPackage.name || !newPackage.destination || !newPackage.price) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      await apiClient.post(`/vendor/${vendorId}/holidays/packages`, newPackage);
      toast.success('Holiday package created successfully');
      setShowAddModal(false);
      setNewPackage({
        name: '',
        description: '',
        destination: '',
        durationDays: 3,
        price: 0,
        maxPets: 10,
        includes: [],
      });
      fetchPackages();
    } catch (error: any) {
      console.error('Error creating package:', error);
      toast.error(error.message || 'Failed to create package');
    }
  };

  const stats = {
    total: packages.length,
    active: packages.filter(p => p.is_active).length,
    totalBookings: packages.reduce((sum, p) => sum + (p.bookings_count || 0), 0),
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Plane className="h-8 w-8 text-cyan-500" />
            Pet Holidays
          </h1>
          <p className="text-muted-foreground">Manage pet-friendly holiday packages</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Package
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <Plane className="h-10 w-10 text-cyan-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Packages</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <Calendar className="h-10 w-10 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Active Packages</p>
              <p className="text-2xl font-bold">{stats.active}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <Users className="h-10 w-10 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Bookings</p>
              <p className="text-2xl font-bold">{stats.totalBookings}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Packages Grid */}
      {loading ? (
        <div className="text-center py-12">Loading packages...</div>
      ) : packages.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Plane className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No holiday packages yet</h3>
            <p className="text-muted-foreground mb-4">Create your first pet holiday package to get started</p>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Package
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages.map((pkg) => (
            <Card key={pkg.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="flex items-center gap-2">
                    <Plane className="h-5 w-5" />
                    {pkg.name}
                  </CardTitle>
                  <Badge variant={pkg.is_active ? 'default' : 'secondary'}>
                    {pkg.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{pkg.destination}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{pkg.duration_days} days</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>Max {pkg.max_pets} pets</span>
                </div>
                {pkg.rating && (
                  <div className="flex items-center gap-2 text-sm">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <span>{pkg.rating.toFixed(1)}</span>
                  </div>
                )}
                <div className="text-lg font-semibold">₹{pkg.price.toLocaleString()}</div>
                {pkg.includes && pkg.includes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {pkg.includes.slice(0, 3).map((item, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">{item}</Badge>
                    ))}
                    {pkg.includes.length > 3 && (
                      <Badge variant="secondary" className="text-xs">+{pkg.includes.length - 3}</Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Package Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Create Holiday Package</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Package Name *</label>
                <Input
                  value={newPackage.name}
                  onChange={(e) => setNewPackage(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Mountain Adventure"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Destination *</label>
                <Input
                  value={newPackage.destination}
                  onChange={(e) => setNewPackage(prev => ({ ...prev, destination: e.target.value }))}
                  placeholder="e.g., Manali, Himachal Pradesh"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <textarea
                  className="w-full border rounded-md p-2 min-h-[60px]"
                  value={newPackage.description}
                  onChange={(e) => setNewPackage(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the package"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Duration (days)</label>
                  <Input
                    type="number"
                    value={newPackage.durationDays}
                    onChange={(e) => setNewPackage(prev => ({ ...prev, durationDays: parseInt(e.target.value) || 1 }))}
                    min={1}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Price (₹) *</label>
                  <Input
                    type="number"
                    value={newPackage.price}
                    onChange={(e) => setNewPackage(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    min={0}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowAddModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={addPackage} className="flex-1">
                  Create Package
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
