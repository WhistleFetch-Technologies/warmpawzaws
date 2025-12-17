import { useState, useEffect } from 'react';
import { Eye, Phone, RefreshCw, Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
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
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/active`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
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
          rating: v.rating || 0,
          complaints: 0,
          module: v.services?.join(', ') || 'N/A',
          moduleTier: v.tier || 'Bronze',
          revenue: v.revenue || 0,
          revenuePeriod: 'This month',
          lastActiveDate: new Date(v.lastActive || v.joinedDate).toLocaleDateString()
        }));
        
        setVendors(mappedVendors);
      }
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
      if (performanceFilter === 'high' && vendor.rating < 4.5) return false;
      if (performanceFilter === 'medium' && (vendor.rating < 3.5 || vendor.rating >= 4.5)) return false;
      if (performanceFilter === 'low' && vendor.rating >= 3.5) return false;
    }
    return true;
  });

  return (
    <div>
      <div className="mb-4">
        <div className="text-sm text-gray-600 mb-4">Manage Vendors Active Right Now</div>
        
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base">Active Vendors</h3>
          <div className="flex gap-3">
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
            placeholder="All Categories"
          />
          <CustomDropdown
            options={[
              { value: 'all', label: 'Performance' },
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

      {/* Table Header */}
      <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-gray-50 rounded-lg text-xs text-gray-600 mb-2">
        <div className="col-span-3">Vendor Details</div>
        <div className="col-span-2">Category</div>
        <div className="col-span-2">Performance</div>
        <div className="col-span-2">Module</div>
        <div className="col-span-2">Revenue</div>
        <div className="col-span-1">Last Active</div>
        <div className="col-span-1">Actions</div>
      </div>

      {/* Vendors List */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-sm">Loading active vendors...</div>
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-sm">No active vendors found</div>
          </div>
        ) : (
          filteredVendors.map((vendor) => (
            <div key={vendor.id} className="grid grid-cols-12 gap-4 px-4 py-4 bg-white border border-gray-200 rounded-lg items-center hover:bg-gray-50">
              <div className="col-span-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <div className="text-sm">
                    {vendor.name} | <span className={getTierColor(vendor.tierColor)}>{vendor.tier}</span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 ml-4">
                  📍 {vendor.location} | {vendor.experience} | {vendor.lastActive}
                </div>
              </div>
              
              <div className="col-span-2">
                <span className={`inline-block px-3 py-1 text-xs rounded-full border ${getCategoryColor(vendor.category)}`}>
                  {vendor.category}
                </span>
              </div>
              
              <div className="col-span-2">
                <div className="flex items-center gap-2">
                  <span className="text-orange-500">⭐</span>
                  <span className="text-sm">{vendor.rating}/5</span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{vendor.complaints} complaints</div>
              </div>
              
              <div className="col-span-2">
                <div className="text-sm">{vendor.module}</div>
                <div className="text-xs text-gray-500">{vendor.moduleTier}</div>
              </div>
              
              <div className="col-span-2">
                <div className="text-sm text-green-600">Rs. {vendor.revenue.toLocaleString('en-IN')}</div>
                <div className="text-xs text-gray-500">{vendor.revenuePeriod}</div>
              </div>
              
              <div className="col-span-1">
                <div className="text-xs">{vendor.lastActiveDate}</div>
                <div className="text-xs text-gray-500">{vendor.lastActive}</div>
              </div>
              
              <div className="col-span-1 flex items-center gap-2">
                <button 
                  onClick={() => handleViewVendor(vendor.id)}
                  className="p-1.5 hover:bg-blue-50 rounded-lg"
                >
                  <Eye className="w-4 h-4 text-blue-600" />
                </button>
                <button 
                  onClick={() => handleCallVendor(vendor.id)}
                  className="p-1.5 hover:bg-green-50 rounded-lg"
                >
                  <Phone className="w-4 h-4 text-green-600" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Vendor Details Modal */}
      <VendorDetailsModal
        isOpen={!!selectedVendorId}
        onClose={() => setSelectedVendorId(null)}
        vendorId={selectedVendorId || ''}
      />
    </div>
  );
}