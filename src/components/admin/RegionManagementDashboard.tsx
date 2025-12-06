import { useState, useEffect } from 'react';
import { regionApi } from '../../utils/api/client';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Plus, Edit, Trash2, MapPin, Search, Building2, Users, TrendingUp } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface Region {
  id: string;
  name: string;
  state: string;
  cities: string[];
  timezone: string;
  isActive: boolean;
  serviceCategories?: string[];
  vendorCount?: number;
  bookingCount?: number;
  revenue?: number;
  createdAt: string;
}

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Puducherry'
];

const TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Calcutta'
];

export function RegionManagementDashboard() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [filteredRegions, setFilteredRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    state: '',
    cities: [] as string[],
    timezone: 'Asia/Kolkata',
    isActive: true
  });
  const [cityInput, setCityInput] = useState('');

  useEffect(() => {
    loadRegions();
  }, []);

  useEffect(() => {
    filterRegions();
  }, [regions, searchTerm, stateFilter]);

  async function loadRegions() {
    try {
      setLoading(true);
      const data = await regionApi.getAll();
      setRegions(data.regions || []);
    } catch (error: any) {
      console.error('Error loading regions:', error);
      toast.error(error.message || 'Failed to load regions');
    } finally {
      setLoading(false);
    }
  }

  function filterRegions() {
    let filtered = regions;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(region =>
        region.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        region.state.toLowerCase().includes(searchTerm.toLowerCase()) ||
        region.cities.some(city => city.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Filter by state
    if (stateFilter !== 'all') {
      filtered = filtered.filter(region => region.state === stateFilter);
    }

    setFilteredRegions(filtered);
  }

  async function handleCreateRegion() {
    if (!formData.name || !formData.state || formData.cities.length === 0) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      await regionApi.create(formData);
      toast.success('Region created successfully');
      setShowCreateModal(false);
      resetForm();
      loadRegions();
    } catch (error: any) {
      console.error('Error creating region:', error);
      toast.error(error.message || 'Failed to create region');
    }
  }

  async function handleUpdateRegion() {
    if (!selectedRegion || !formData.name || !formData.state) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      await regionApi.update(selectedRegion.id, formData);
      toast.success('Region updated successfully');
      setShowEditModal(false);
      setSelectedRegion(null);
      resetForm();
      loadRegions();
    } catch (error: any) {
      console.error('Error updating region:', error);
      toast.error(error.message || 'Failed to update region');
    }
  }

  async function handleDeleteRegion(regionId: string) {
    if (!confirm('Are you sure you want to delete this region? This action cannot be undone.')) {
      return;
    }

    try {
      await regionApi.delete(regionId);
      toast.success('Region deleted successfully');
      loadRegions();
    } catch (error: any) {
      console.error('Error deleting region:', error);
      toast.error(error.message || 'Failed to delete region');
    }
  }

  function openEditModal(region: Region) {
    setSelectedRegion(region);
    setFormData({
      name: region.name,
      state: region.state,
      cities: region.cities,
      timezone: region.timezone,
      isActive: region.isActive
    });
    setShowEditModal(true);
  }

  function resetForm() {
    setFormData({
      name: '',
      state: '',
      cities: [],
      timezone: 'Asia/Kolkata',
      isActive: true
    });
    setCityInput('');
  }

  function addCity() {
    if (cityInput.trim() && !formData.cities.includes(cityInput.trim())) {
      setFormData(prev => ({
        ...prev,
        cities: [...prev.cities, cityInput.trim()]
      }));
      setCityInput('');
    }
  }

  function removeCity(city: string) {
    setFormData(prev => ({
      ...prev,
      cities: prev.cities.filter(c => c !== city)
    }));
  }

  // Calculate summary stats
  const totalRegions = regions.length;
  const activeRegions = regions.filter(r => r.isActive).length;
  const totalVendors = regions.reduce((sum, r) => sum + (r.vendorCount || 0), 0);
  const totalBookings = regions.reduce((sum, r) => sum + (r.bookingCount || 0), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl">Region Management</h1>
          <p className="text-sm text-gray-500">Manage geographic regions and regional catalogs</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Region
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Total Regions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl">{totalRegions}</p>
              <MapPin className="w-8 h-8 text-orange-500 opacity-20" />
            </div>
            <p className="text-xs text-gray-500 mt-1">{activeRegions} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Total Vendors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl">{totalVendors}</p>
              <Users className="w-8 h-8 text-orange-500 opacity-20" />
            </div>
            <p className="text-xs text-gray-500 mt-1">Across all regions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Total Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl">{totalBookings}</p>
              <Building2 className="w-8 h-8 text-orange-500 opacity-20" />
            </div>
            <p className="text-xs text-gray-500 mt-1">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">States Covered</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl">{new Set(regions.map(r => r.state)).size}</p>
              <TrendingUp className="w-8 h-8 text-orange-500 opacity-20" />
            </div>
            <p className="text-xs text-gray-500 mt-1">Unique states</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search regions, states, or cities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="w-full md:w-64">
                <SelectValue placeholder="Filter by state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {INDIAN_STATES.map(state => (
                  <SelectItem key={state} value={state}>{state}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Regions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Regions</CardTitle>
          <CardDescription>
            {filteredRegions.length} region{filteredRegions.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading regions...</div>
          ) : filteredRegions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No regions found. Create your first region to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Region Name</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Cities</TableHead>
                  <TableHead>Timezone</TableHead>
                  <TableHead>Vendors</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegions.map((region) => (
                  <TableRow key={region.id}>
                    <TableCell>
                      {region.name}
                    </TableCell>
                    <TableCell>{region.state}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {region.cities.slice(0, 2).map((city, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {city}
                          </Badge>
                        ))}
                        {region.cities.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{region.cities.length - 2} more
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{region.timezone}</TableCell>
                    <TableCell>{region.vendorCount || 0}</TableCell>
                    <TableCell>
                      <Badge variant={region.isActive ? 'default' : 'secondary'}>
                        {region.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(region)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRegion(region.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Region Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Region</DialogTitle>
            <DialogDescription>
              Add a new geographic region to your platform
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Region Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Bangalore Metro"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="state">State *</Label>
              <Select value={formData.state} onValueChange={(value) => setFormData({ ...formData, state: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {INDIAN_STATES.map(state => (
                    <SelectItem key={state} value={state}>{state}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="cities">Cities *</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="cities"
                  placeholder="Enter city name"
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCity())}
                />
                <Button type="button" onClick={addCity}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.cities.map((city, idx) => (
                  <Badge key={idx} variant="secondary">
                    {city}
                    <button
                      type="button"
                      onClick={() => removeCity(city)}
                      className="ml-1 text-xs hover:text-red-500"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Select value={formData.timezone} onValueChange={(value) => setFormData({ ...formData, timezone: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map(tz => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateModal(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleCreateRegion}>
              Create Region
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Region Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Region</DialogTitle>
            <DialogDescription>
              Update region information
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Region Name *</Label>
              <Input
                id="edit-name"
                placeholder="e.g., Bangalore Metro"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="edit-state">State *</Label>
              <Select value={formData.state} onValueChange={(value) => setFormData({ ...formData, state: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {INDIAN_STATES.map(state => (
                    <SelectItem key={state} value={state}>{state}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="edit-cities">Cities *</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="edit-cities"
                  placeholder="Enter city name"
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCity())}
                />
                <Button type="button" onClick={addCity}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.cities.map((city, idx) => (
                  <Badge key={idx} variant="secondary">
                    {city}
                    <button
                      type="button"
                      onClick={() => removeCity(city)}
                      className="ml-1 text-xs hover:text-red-500"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="edit-timezone">Timezone</Label>
              <Select value={formData.timezone} onValueChange={(value) => setFormData({ ...formData, timezone: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map(tz => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-active"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="edit-active">Region is active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditModal(false); setSelectedRegion(null); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleUpdateRegion}>
              Update Region
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
