import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { ArrowLeft, MapPin, Plus, Check, Home, Edit, Trash2 } from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';

interface AddressSelectorProps {
  phone: string;
  onBack: () => void;
  onSelect: (address: any) => void;
}

export function AddressSelector({ phone, onBack, onSelect }: AddressSelectorProps) {
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAddress, setNewAddress] = useState({
    label: 'Home',
    fullAddress: '',
    landmark: '',
    city: '',
    pincode: '',
    isDefault: false
  });

  const API_BASE = getApiBaseUrl();

  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/customer/addresses/${phone}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      
      if (response.ok) {
        const data = await response.json();
        setAddresses(data.addresses || []);
        
        // Auto-select default address
        const defaultAddr = data.addresses?.find((a: any) => a.isDefault);
        if (defaultAddr) setSelectedAddress(defaultAddr);
        
        console.log('✅ [ADDRESS-SELECTOR] Loaded addresses:', data.addresses?.length || 0);
      }
    } catch (error) {
      console.error('❌ [ADDRESS-SELECTOR] Error loading addresses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAddress = async () => {
    try {
      if (!newAddress.fullAddress || !newAddress.city || !newAddress.pincode) {
        alert('Please fill all required fields');
        return;
      }

      const response = await fetch(
        `${API_BASE}/customer/addresses`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ phone, ...newAddress })
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ [ADDRESS-SELECTOR] Address added:', data);
        await loadAddresses();
        setShowAddForm(false);
        setNewAddress({
          label: 'Home',
          fullAddress: '',
          landmark: '',
          city: '',
          pincode: '',
          isDefault: false
        });
      }
    } catch (error) {
      console.error('❌ [ADDRESS-SELECTOR] Error adding address:', error);
      alert('Failed to add address');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#FF8C42] to-[#FF7029] text-white px-6 pt-8 pb-6 sticky top-0 z-10">
        <button 
          onClick={onBack}
          className="mb-4 flex items-center gap-2 text-white/90 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        
        <div className="flex items-center gap-3 mb-2">
          <MapPin className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Select Address</h1>
        </div>
        <p className="text-white/80 text-sm">Where should the groomer visit?</p>
      </div>

      {/* Content */}
      <div className="px-6 py-6">
        {/* Add New Address Form */}
        {showAddForm ? (
          <Card className="p-4 border border-gray-200 mb-4">
            <h3 className="font-semibold mb-4">Add New Address</h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600 mb-1 block">Address Label</label>
                <select
                  value={newAddress.label}
                  onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                >
                  <option value="Home">Home</option>
                  <option value="Work">Work</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-600 mb-1 block">Full Address *</label>
                <textarea
                  value={newAddress.fullAddress}
                  onChange={(e) => setNewAddress({ ...newAddress, fullAddress: e.target.value })}
                  placeholder="House No., Building, Street"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                />
              </div>

              <div>
                <label className="text-sm text-gray-600 mb-1 block">Landmark</label>
                <input
                  type="text"
                  value={newAddress.landmark}
                  onChange={(e) => setNewAddress({ ...newAddress, landmark: e.target.value })}
                  placeholder="Near by landmark"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">City *</label>
                  <input
                    type="text"
                    value={newAddress.city}
                    onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                    placeholder="City"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">Pincode *</label>
                  <input
                    type="text"
                    value={newAddress.pincode}
                    onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })}
                    placeholder="Pincode"
                    maxLength={6}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newAddress.isDefault}
                  onChange={(e) => setNewAddress({ ...newAddress, isDefault: e.target.checked })}
                  className="w-4 h-4 text-[#FF8C42] border-gray-300 rounded focus:ring-[#FF8C42]"
                />
                <span className="text-sm text-gray-700">Set as default address</span>
              </label>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewAddress({
                      label: 'Home',
                      fullAddress: '',
                      landmark: '',
                      city: '',
                      pincode: '',
                      isDefault: false
                    });
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddAddress}
                  className="flex-1 bg-[#FF8C42] text-white hover:bg-[#FF7029]"
                >
                  Save Address
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          /* Add New Address Button */
          <Card 
            className="p-4 border-2 border-dashed border-gray-300 cursor-pointer hover:border-[#FF8C42] transition-all mb-4"
            onClick={() => setShowAddForm(true)}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center">
                <Plus className="w-6 h-6 text-[#FF8C42]" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Add New Address</h3>
                <p className="text-sm text-gray-500">Save a new delivery address</p>
              </div>
            </div>
          </Card>
        )}

        {/* Saved Addresses */}
        {addresses.length === 0 && !showAddForm ? (
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No saved addresses</p>
            <Button 
              className="bg-[#FF8C42] text-white hover:bg-[#FF7029]"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Address
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-gray-600 uppercase tracking-wide">
              Saved Addresses
            </h3>
            
            {addresses.map((address) => {
              const isSelected = selectedAddress?.id === address.id;
              
              return (
                <Card
                  key={address.id}
                  className={`p-4 cursor-pointer transition-all ${
                    isSelected 
                      ? 'border-2 border-[#FF8C42] bg-orange-50' 
                      : 'border border-gray-200 hover:border-[#FF8C42] bg-white'
                  }`}
                  onClick={() => setSelectedAddress(address)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'bg-[#FF8C42]' : 'bg-gray-100'
                    }`}>
                      <Home className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-gray-600'}`} />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{address.label}</h3>
                        {address.isDefault && (
                          <Badge className="bg-green-100 text-green-600 border-none text-xs">
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        {address.fullAddress}
                      </p>
                      {address.landmark && (
                        <p className="text-sm text-gray-500">
                          Near: {address.landmark}
                        </p>
                      )}
                      <p className="text-sm text-gray-500">
                        {address.city}, {address.pincode}
                      </p>
                    </div>
                    
                    {isSelected && (
                      <div className="w-6 h-6 bg-[#FF8C42] rounded-full flex items-center justify-center flex-shrink-0">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Fixed Bottom Button */}
      {selectedAddress && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 max-w-md mx-auto">
          <Button
            className="w-full bg-[#FF8C42] text-white hover:bg-[#FF7029]"
            onClick={() => onSelect(selectedAddress)}
          >
            Continue with {selectedAddress.label}
          </Button>
        </div>
      )}
    </div>
  );
}
