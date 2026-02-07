'use client';

import { useState, useEffect } from 'react';
import { Plus, Camera, Image as ImageIcon, Calendar, Users, Edit, Trash2, Upload, Eye, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface PhotographyVendorDashboardProps {
  vendorId: string;
  vendorData?: any;
  onBack?: () => void;
}

interface PhotographyPackage {
  id?: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  includes: string[];
  isPublished: boolean;
  category: string;
}

interface PortfolioItem {
  id?: string;
  title: string;
  description: string;
  imageUrl: string;
  category: string;
  isFeatured: boolean;
}

export function PhotographyVendorDashboard({ vendorId, vendorData, onBack }: PhotographyVendorDashboardProps) {
  const [packages, setPackages] = useState<PhotographyPackage[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'packages' | 'portfolio' | 'bookings'>('overview');
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState<PhotographyPackage | null>(null);
  const [editingPortfolio, setEditingPortfolio] = useState<PortfolioItem | null>(null);
  const [newInclude, setNewInclude] = useState('');

  const [packageForm, setPackageForm] = useState<PhotographyPackage>({
    name: '',
    description: '',
    price: 0,
    duration: 60,
    includes: [],
    isPublished: false,
    category: 'portrait',
  });

  const [portfolioForm, setPortfolioForm] = useState<PortfolioItem>({
    title: '',
    description: '',
    imageUrl: '',
    category: 'portrait',
    isFeatured: false,
  });

  useEffect(() => {
    loadData();
  }, [vendorId]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadPackages(),
        loadPortfolio(),
        loadBookings(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadPackages = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/services?category=photography`);
      setPackages(response.services || response.packages || []);
    } catch (error) {
      console.error('Error loading packages:', error);
      setPackages([]);
    }
  };

  const loadPortfolio = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/photography/portfolio`);
      setPortfolio(response.portfolio || response.items || []);
    } catch (error) {
      console.error('Error loading portfolio:', error);
      setPortfolio([]);
    }
  };

  const loadBookings = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/bookings?category=photography`);
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
        serviceType: 'photography',
        category: 'photography',
        serviceStyle: 'at_vendor',
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

  const handleSavePortfolio = async () => {
    if (!portfolioForm.title || !portfolioForm.imageUrl) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      if (editingPortfolio?.id) {
        await apiClient.put<any>(`/vendor/${vendorId}/photography/portfolio/${editingPortfolio.id}`, portfolioForm);
        toast.success('Portfolio item updated successfully!');
      } else {
        await apiClient.post<any>(`/vendor/${vendorId}/photography/portfolio`, portfolioForm);
        toast.success('Portfolio item added successfully!');
      }
      setShowPortfolioModal(false);
      setEditingPortfolio(null);
      resetPortfolioForm();
      loadPortfolio();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save portfolio item');
    } finally {
      setLoading(false);
    }
  };

  const resetPackageForm = () => {
    setPackageForm({
      name: '',
      description: '',
      price: 0,
      duration: 60,
      includes: [],
      isPublished: false,
      category: 'portrait',
    });
    setNewInclude('');
  };

  const resetPortfolioForm = () => {
    setPortfolioForm({
      title: '',
      description: '',
      imageUrl: '',
      category: 'portrait',
      isFeatured: false,
    });
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

  const stats = {
    totalPackages: packages.length,
    publishedPackages: packages.filter(p => p.isPublished).length,
    portfolioItems: portfolio.length,
    featuredItems: portfolio.filter(p => p.isFeatured).length,
    totalBookings: bookings.length,
    upcomingBookings: bookings.filter(b => {
      const bookingDate = b.bookingDate || b.scheduled_date;
      return bookingDate && new Date(bookingDate) >= new Date();
    }).length,
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Photography Services</h1>
            <p className="text-gray-600 mt-1">Manage packages, portfolio, and bookings</p>
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
                <p className="text-sm text-gray-600">Packages</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalPackages}</p>
              </div>
              <Package className="w-8 h-8 text-blue-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Published</p>
                <p className="text-2xl font-bold text-green-600">{stats.publishedPackages}</p>
              </div>
              <Eye className="w-8 h-8 text-green-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Portfolio</p>
                <p className="text-2xl font-bold text-gray-900">{stats.portfolioItems}</p>
              </div>
              <ImageIcon className="w-8 h-8 text-purple-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Upcoming</p>
                <p className="text-2xl font-bold text-orange-600">{stats.upcomingBookings}</p>
              </div>
              <Calendar className="w-8 h-8 text-orange-500" />
            </div>
          </Card>
        </div>

        <div className="flex gap-2 mb-6 border-b">
          {[
            { id: 'overview', label: 'Overview', icon: Camera },
            { id: 'packages', label: 'Packages', icon: Package },
            { id: 'portfolio', label: 'Portfolio', icon: ImageIcon },
            { id: 'bookings', label: 'Bookings', icon: Calendar },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 flex items-center gap-2 border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-orange-500 text-orange-600 font-semibold'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'packages' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Photography Packages</h2>
              <Button
                onClick={() => { resetPackageForm(); setEditingPackage(null); setShowPackageModal(true); }}
                className="bg-orange-500 hover:bg-orange-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Package
              </Button>
            </div>

            {packages.length === 0 ? (
              <Card className="p-12 text-center">
                <Camera className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Packages</h3>
                <Button onClick={() => { resetPackageForm(); setShowPackageModal(true); }} className="bg-orange-500 hover:bg-orange-600">
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Package
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {packages.map((pkg) => (
                  <Card key={pkg.id || pkg.name} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-gray-900">{pkg.name}</h3>
                        <p className="text-sm text-gray-500 capitalize">{pkg.category}</p>
                      </div>
                      {pkg.isPublished ? (
                        <Badge className="bg-green-500">Published</Badge>
                      ) : (
                        <Badge variant="outline">Draft</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{pkg.description}</p>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm text-gray-600">
                        <span>₹{pkg.price}</span>
                        <span className="text-gray-400"> • {pkg.duration} mins</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setEditingPackage(pkg); setPackageForm(pkg); setShowPackageModal(true); }}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" className="text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'portfolio' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Portfolio</h2>
              <Button
                onClick={() => { resetPortfolioForm(); setEditingPortfolio(null); setShowPortfolioModal(true); }}
                className="bg-orange-500 hover:bg-orange-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add to Portfolio
              </Button>
            </div>

            {portfolio.length === 0 ? (
              <Card className="p-12 text-center">
                <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Portfolio Items</h3>
                <Button onClick={() => { resetPortfolioForm(); setShowPortfolioModal(true); }} className="bg-orange-500 hover:bg-orange-600">
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Item
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {portfolio.map((item) => (
                  <Card key={item.id || item.title} className="p-4">
                    {item.imageUrl && (
                      <img src={item.imageUrl} alt={item.title} className="w-full h-48 object-cover rounded-lg mb-3" />
                    )}
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-bold text-gray-900">{item.title}</h3>
                      {item.isFeatured && <Badge className="bg-yellow-500">Featured</Badge>}
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{item.description}</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setEditingPortfolio(item); setPortfolioForm(item); setShowPortfolioModal(true); }}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" className="text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'bookings' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Bookings</h2>
            {bookings.length === 0 ? (
              <Card className="p-12 text-center">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Bookings</h3>
                <p className="text-gray-600">Bookings will appear here</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {bookings.map((booking) => (
                  <Card key={booking.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-gray-900">{booking.serviceName || 'Photography Session'}</h3>
                          <Badge variant="outline">{booking.status || 'pending'}</Badge>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            <span>Customer: {booking.customerName || booking.customer_phone}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>{booking.bookingDate || booking.scheduled_date} at {booking.bookingTime || booking.scheduled_time}</span>
                          </div>
                          {booking.petName && (
                            <div className="flex items-center gap-2">
                              <span>Pet: {booking.petName}</span>
                            </div>
                          )}
                        </div>
                      </div>
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
                  {editingPackage ? 'Edit Package' : 'Add Package'}
                </h2>
                <div className="space-y-4">
                  <div>
                    <Label>Package Name *</Label>
                    <Input
                      value={packageForm.name}
                      onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })}
                      placeholder="e.g., Portrait Session, Event Photography"
                    />
                  </div>
                  <div>
                    <Label>Description *</Label>
                    <Textarea
                      value={packageForm.description}
                      onChange={(e) => setPackageForm({ ...packageForm, description: e.target.value })}
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
                      <Label>Duration (mins) *</Label>
                      <Input
                        type="number"
                        value={packageForm.duration}
                        onChange={(e) => setPackageForm({ ...packageForm, duration: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Category</Label>
                    <select
                      value={packageForm.category}
                      onChange={(e) => setPackageForm({ ...packageForm, category: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="portrait">Portrait</option>
                      <option value="event">Event</option>
                      <option value="video">Video</option>
                      <option value="showcase">Showcase</option>
                    </select>
                  </div>
                  <div>
                    <Label>What's Included</Label>
                    <div className="flex gap-2 mb-2">
                      <Input
                        value={newInclude}
                        onChange={(e) => setNewInclude(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addInclude()}
                        placeholder="e.g., 10 edited photos"
                      />
                      <Button type="button" onClick={addInclude}>Add</Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {packageForm.includes.map((inc, idx) => (
                        <Badge key={idx} className="flex items-center gap-1">
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
                    <Button className="flex-1 bg-orange-500 hover:bg-orange-600" onClick={handleSavePackage} disabled={loading}>
                      {editingPackage ? 'Update' : 'Create'} Package
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {showPortfolioModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  {editingPortfolio ? 'Edit Portfolio Item' : 'Add to Portfolio'}
                </h2>
                <div className="space-y-4">
                  <div>
                    <Label>Title *</Label>
                    <Input
                      value={portfolioForm.title}
                      onChange={(e) => setPortfolioForm({ ...portfolioForm, title: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={portfolioForm.description}
                      onChange={(e) => setPortfolioForm({ ...portfolioForm, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>Image URL *</Label>
                    <Input
                      value={portfolioForm.imageUrl}
                      onChange={(e) => setPortfolioForm({ ...portfolioForm, imageUrl: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <select
                      value={portfolioForm.category}
                      onChange={(e) => setPortfolioForm({ ...portfolioForm, category: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="portrait">Portrait</option>
                      <option value="event">Event</option>
                      <option value="video">Video</option>
                      <option value="showcase">Showcase</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="portfolioFeatured"
                      checked={portfolioForm.isFeatured}
                      onChange={(e) => setPortfolioForm({ ...portfolioForm, isFeatured: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="portfolioFeatured">Feature this item</Label>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button variant="outline" className="flex-1" onClick={() => { setShowPortfolioModal(false); resetPortfolioForm(); setEditingPortfolio(null); }}>
                      Cancel
                    </Button>
                    <Button className="flex-1 bg-orange-500 hover:bg-orange-600" onClick={handleSavePortfolio} disabled={loading}>
                      {editingPortfolio ? 'Update' : 'Add'} Item
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
