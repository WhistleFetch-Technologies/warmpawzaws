'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { IndianRupee, Edit2, Save, TrendingUp, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { VendorHeader } from '@/components/vendor/VendorHeader';

interface Service {
  id: string;
  service_name: string;
  description: string;
  category: string;
  price: number;
  duration_minutes: number;
  service_style: 'at_vendor' | 'at_home' | 'online';
  is_enabled: boolean;
  publish_status: 'draft' | 'published' | 'archived';
}

interface ServicePricing {
  serviceId: string;
  serviceName: string;
  category: string;
  serviceStyle: string;
  currentPrice: number;
  newPrice?: number;
  duration: number;
  isDirty: boolean;
}

export default function PricingPage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [pricing, setPricing] = useState<ServicePricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterStyle, setFilterStyle] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const storedVendorId = localStorage.getItem('vendorId');
    if (!storedVendorId) {
      router.push('/onboarding');
      return;
    }
    setVendorId(storedVendorId);
    loadServices();
  }, [router]);

  const loadServices = async () => {
    if (!vendorId) return;
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/${vendorId}/services`);
      const servicesData = Array.isArray(response.services) ? response.services : (response.allServices || []);
      setServices(servicesData);
      
      // Initialize pricing state
      const pricingData: ServicePricing[] = servicesData.map((service: Service) => ({
        serviceId: service.id,
        serviceName: service.service_name,
        category: service.category,
        serviceStyle: service.service_style,
        currentPrice: service.price,
        newPrice: service.price,
        duration: service.duration_minutes,
        isDirty: false,
      }));
      setPricing(pricingData);
    } catch (err: any) {
      console.error('Error loading services:', err);
      toast.error(err.message || 'Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (serviceId: string, newPrice: number) => {
    setPricing((prev) =>
      prev.map((item) => {
        if (item.serviceId === serviceId) {
          return {
            ...item,
            newPrice: newPrice,
            isDirty: newPrice !== item.currentPrice,
          };
        }
        return item;
      })
    );
  };

  const handleSavePrice = async (serviceId: string) => {
    const pricingItem = pricing.find((p) => p.serviceId === serviceId);
    if (!pricingItem || !pricingItem.isDirty) return;

    try {
      setSaving(true);
      await apiClient.put(`/vendor-services/${serviceId}`, {
        price: pricingItem.newPrice,
      });
      
      toast.success('Price updated successfully');
      await loadServices(); // Reload to get updated prices
    } catch (err: any) {
      console.error('Error updating price:', err);
      toast.error(err.message || 'Failed to update price');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkSave = async () => {
    const dirtyItems = pricing.filter((p) => p.isDirty);
    if (dirtyItems.length === 0) {
      toast.info('No changes to save');
      return;
    }

    try {
      setSaving(true);
      const updatePromises = dirtyItems.map((item) =>
        apiClient.put(`/vendor-services/${item.serviceId}`, {
          price: item.newPrice,
        })
      );
      
      await Promise.all(updatePromises);
      toast.success(`${dirtyItems.length} price(s) updated successfully`);
      await loadServices();
    } catch (err: any) {
      console.error('Error updating prices:', err);
      toast.error(err.message || 'Failed to update prices');
    } finally {
      setSaving(false);
    }
  };

  const categories = Array.from(new Set(services.map((s) => s.category))).filter(Boolean);
  const styles = Array.from(new Set(services.map((s) => s.service_style))).filter(Boolean);

  const filteredPricing = pricing.filter((item) => {
    if (filterStyle !== 'all' && item.serviceStyle !== filterStyle) {
      return false;
    }
    if (filterCategory !== 'all' && item.category !== filterCategory) {
      return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return item.serviceName.toLowerCase().includes(query);
    }
    return true;
  });

  const hasChanges = pricing.some((p) => p.isDirty);

  const getStyleLabel = (style: string) => {
    switch (style) {
      case 'at_vendor': return 'At Centre';
      case 'at_home': return 'Home Visit';
      case 'online': return 'Online/Tele';
      default: return style;
    }
  };

  const getStyleIcon = (style: string) => {
    switch (style) {
      case 'at_vendor': return '🏥';
      case 'at_home': return '🏠';
      case 'online': return '💻';
      default: return '📋';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="vendor-page-shell bg-gray-50">
      <div className="vendor-app-column bg-white min-h-screen">
        <VendorHeader
          title="Service Pricing"
          subtitle="Manage pricing for all your services"
          onBack={() => router.back()}
          actions={
            hasChanges
              ? [
                  <Button
                    key="save-all"
                    type="button"
                    onClick={handleBulkSave}
                    disabled={saving}
                    className="whitespace-nowrap bg-orange-500 hover:bg-orange-600 text-white h-9 px-3 text-sm"
                  >
                    <Save className="w-4 h-4 mr-1.5 inline shrink-0" />
                    {saving ? 'Saving...' : `Save (${pricing.filter((p) => p.isDirty).length})`}
                  </Button>,
                ]
              : []
          }
        />

        <div className="w-full px-4 py-6 sm:px-6">
        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Search Services</Label>
              <Input
                placeholder="Search by service name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Service Style</Label>
              <select
                value={filterStyle}
                onChange={(e) => setFilterStyle(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
              >
                <option value="all">All Styles</option>
                {styles.map((style) => (
                  <option key={style} value={style}>
                    {getStyleIcon(style)} {getStyleLabel(style)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Category</Label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
              >
                <option value="all">All Categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Pricing Table */}
        {filteredPricing.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <IndianRupee className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No services found</h3>
            <p className="text-gray-500">
              {searchQuery || filterStyle !== 'all' || filterCategory !== 'all'
                ? 'Try adjusting your filters'
                : 'Add services first to manage pricing'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Service
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Style
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current Price
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      New Price
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredPricing.map((item) => (
                    <tr key={item.serviceId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{item.serviceName}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500">
                          {getStyleIcon(item.serviceStyle)} {getStyleLabel(item.serviceStyle)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500">{item.category}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500">{item.duration} mins</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">₹{item.currentPrice}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={item.newPrice || ''}
                            onChange={(e) => handlePriceChange(item.serviceId, parseFloat(e.target.value) || 0)}
                            className="w-32"
                            min="0"
                            step="0.01"
                          />
                          {item.isDirty && (
                            <TrendingUp className="w-4 h-4 text-orange-500" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Button
                          size="sm"
                          onClick={() => handleSavePrice(item.serviceId)}
                          disabled={!item.isDirty || saving}
                          className={item.isDirty ? 'bg-orange-500 hover:bg-orange-600' : ''}
                        >
                          <Save className="w-4 h-4 mr-1" />
                          Save
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Summary */}
        {filteredPricing.length > 0 && (
          <div className="mt-6 bg-white rounded-2xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Total Services</p>
                <p className="text-2xl font-bold text-gray-900">{filteredPricing.length}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Services with Changes</p>
                <p className="text-2xl font-bold text-orange-600">
                  {filteredPricing.filter((p) => p.isDirty).length}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Average Price</p>
                <p className="text-2xl font-bold text-gray-900">
                  ₹{Math.round(filteredPricing.reduce((sum, p) => sum + (p.newPrice || 0), 0) / filteredPricing.length)}
                </p>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
