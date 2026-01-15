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
    <div>
      <div className="mb-4">
        <div className="text-sm text-gray-600 mb-4">Manage Vendors Active Right Now</div>
        
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base">Active Vendors</h3>
          <div className="flex gap-0">
            <Button variant="outline" className="gap-0" onClick={loadActiveVendors}>
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
            <Button className="bg-[#FF8C42] hover:bg-[#FF7A2E] gap-0">
              <Plus className="w-4 h-4" />
              Add Vendor
            </Button>
          </div>
        </div>

        <div className="flex gap-0 mb-4">
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
        <div className="p-0 text-center text-gray-500">Loading vendors...</div>
      ) : filteredVendors.length === 0 ? (
        <div className="p-0 text-center text-gray-500">No active vendors found</div>
      ) : (
        <div className="space-y-3">
          {filteredVendors.map((vendor) => (
            <div key={vendor.id} className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-0 mb-0">
                    <h4 className="font-semibold text-gray-900">{vendor.name}</h4>
                    <span className={`px-0 py-0 text-xs rounded-full ${getCategoryColor(vendor.category)}`}>
                      {vendor.category}
                    </span>
                    <span className={`text-xs font-medium ${getTierColor(vendor.tierColor)}`}>
                      {vendor.tier}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Location:</span>
                      <span className="ml-0 text-gray-900">{vendor.location}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Rating:</span>
                      <span className="ml-0 text-gray-900">{typeof vendor.rating === 'number' ? vendor.rating.toFixed(1) : '0.0'} ⭐</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Revenue:</span>
                      <span className="ml-0 text-gray-900">₹{vendor.revenue.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Last Active:</span>
                      <span className="ml-0 text-gray-900">{vendor.lastActive}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-0 ml-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewVendor(vendor.id)}
                  >
                    <Eye className="w-4 h-4 mr-0" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCallVendor(vendor.id)}
                  >
                    <Phone className="w-4 h-4 mr-0" />
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

