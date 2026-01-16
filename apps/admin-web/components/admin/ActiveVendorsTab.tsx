'use client';

import { useState, useEffect } from 'react';
import { Eye, Phone, RefreshCw, Plus } from 'lucide-react';
import { Button } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';
import { CustomDropdown } from './CustomDropdown';
import { VendorDetailsModal } from './VendorDetailsModal';

interface ActiveVendor {
  id: string;
  name: string;
  tier: string;
  tierColor: string;
  location: string;
  experience: string;
  lastActive: string;
  category: string;
  rating: number;
  complaints: number;
  module: string;
  moduleTier: string;
  revenue: number;
  revenuePeriod: string;
  lastActiveDate: string;
}

export function ActiveVendorsTab() {
  const [vendors, setVendors] = useState<ActiveVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [performanceFilter, setPerformanceFilter] = useState('all');
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);

  useEffect(() => {
    loadActiveVendors();
  }, []);

  const loadActiveVendors = async () => {
    try {
      setLoading(true);
      
      const data = await apiClient.get<any>('/admin/vendors/active');
      console.log('Active vendors loaded:', data);
      
      // Map the vendor data to match the expected format
      const mappedVendors = (data.vendors || []).map((v: any) => ({
        id: v.id,
        name: v.businessName || v.ownerName,
        tier: v.tier || 'Bronze',
        tierColor: v.tier?.toLowerCase() || 'bronze',
        location: v.city || v.location?.city || 'N/A',
        experience: v.experience || 'N/A',
        lastActive: 'Just now',
        category: v.category || v.services?.[0] || 'General',
        rating: parseFloat(v.rating) || 0,
        complaints: 0,
        module: v.services?.join(', ') || 'N/A',
        moduleTier: v.tier || 'Bronze',
        revenue: parseFloat(v.revenue) || 0,
        revenuePeriod: 'This month',
        lastActiveDate: new Date(v.lastActive || v.joinedDate).toLocaleDateString()
      }));
      
      setVendors(mappedVendors);
    } catch (error) {
      console.error('Error loading active vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewVendor = (vendorId: string) => {
    setSelectedVendorId(vendorId);
  };

  const handleCallVendor = (vendorId: string) => {
    console.log('Call vendor:', vendorId);
    // Initiate call or show contact modal
  };

  const getCategoryColor = (category: string) => {
    const colors: any = {
      'vet': 'bg-blue-100 text-blue-700 border-blue-200',
      'groomer': 'bg-purple-100 text-purple-700 border-purple-200',
      'walker': 'bg-pink-100 text-pink-700 border-pink-200',
      'boarding': 'bg-indigo-100 text-indigo-700 border-indigo-200',
      'training': 'bg-orange-100 text-orange-700 border-orange-200'
    };
    return colors[category.toLowerCase()] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getTierColor = (tierColor: string) => {
    const colors: any = {
      'gold': 'text-yellow-600',
      'silver': 'text-gray-600',
      'premium': 'text-purple-600',
      'standard': 'text-blue-600'
    };
    return colors[tierColor] || 'text-gray-600';
  };

  const filteredVendors = vendors.filter(vendor => {
    if (categoryFilter !== 'all' && vendor.category.toLowerCase() !== categoryFilter.toLowerCase()) return false;
    if (performanceFilter !== 'all') {
      const rating = typeof vendor.rating === 'number' ? vendor.rating : 0;
      if (performanceFilter === 'high' && rating < 4.5) return false;
      if (performanceFilter === 'medium' && (rating < 3.5 || rating >= 4.5)) return false;
      if (performanceFilter === 'low' && rating >= 3.5) return false;
    }
    return true;
  });

  return (
    <div className="p-4">
      <div className="mb-6">
        <div className="text-sm text-gray-600 mb-4">Manage Vendors Active Right Now</div>
        
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Active Vendors</h3>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={loadActiveVendors}>
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
            <Button className="bg-[#FF8C42] hover:bg-[#FF7A2E] gap-2">
              <Plus className="w-4 h-4" />
              Add Vendor
            </Button>
          </div>
        </div>

        <div className="flex gap-3 mb-4">
          <CustomDropdown
            options={[
              { value: 'all', label: 'All Categories' },
              { value: 'vet', label: 'Vet' },
              { value: 'groomer', label: 'Groomer' },
              { value: 'walker', label: 'Walker' },
              { value: 'boarding', label: 'Boarding' },
              { value: 'training', label: 'Training' }
            ]}
            value={categoryFilter}
            onChange={setCategoryFilter}
            placeholder="Category"
          />
          <CustomDropdown
            options={[
              { value: 'all', label: 'All Performance' },
              { value: 'high', label: 'High (4.5+)' },
              { value: 'medium', label: 'Medium (3.5-4.5)' },
              { value: 'low', label: 'Low (<3.5)' }
            ]}
            value={performanceFilter}
            onChange={setPerformanceFilter}
            placeholder="Performance"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#FF8C42]" />
          Loading vendors...
        </div>
      ) : filteredVendors.length === 0 ? (
        <div className="p-12 text-center text-gray-500 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <Eye className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No active vendors found</p>
          <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredVendors.map((vendor) => (
            <div key={vendor.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg hover:border-[#FF8C42]/30 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h4 className="font-semibold text-gray-900 text-lg">{vendor.name}</h4>
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getCategoryColor(vendor.category)}`}>
                      {vendor.category}
                    </span>
                    <span className={`text-xs font-semibold ${getTierColor(vendor.tierColor)}`}>
                      {vendor.tier}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Location:</span>
                      <span className="ml-2 text-gray-900 font-medium">{vendor.location}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Rating:</span>
                      <span className="ml-2 text-gray-900 font-medium">{typeof vendor.rating === 'number' ? vendor.rating.toFixed(1) : '0.0'} ⭐</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Revenue:</span>
                      <span className="ml-2 text-gray-900 font-medium">₹{vendor.revenue.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Last Active:</span>
                      <span className="ml-2 text-gray-900 font-medium">{vendor.lastActive}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 ml-6">
                  <Button
                    size="sm"
                    variant="outline"
                    className="hover:bg-gray-50"
                    onClick={() => handleViewVendor(vendor.id)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="hover:bg-green-50 hover:border-green-200 text-green-600"
                    onClick={() => handleCallVendor(vendor.id)}
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Call
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedVendorId && (
        <VendorDetailsModal
          isOpen={!!selectedVendorId}
          onClose={() => setSelectedVendorId(null)}
          vendorId={selectedVendorId}
        />
      )}
    </div>
  );
}

