'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Edit2, Trash2, Loader2, Save, X, Globe, DollarSign, Clock } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Region {
  regionId: string;
  regionName: string;
  regionCode: string;
  country: string;
  isActive: boolean;
  currency: {
    code: string;
    symbol: string;
    symbolPosition: 'before' | 'after';
  };
  business: {
    taxRate: number;
    taxName: string;
    commissionRate: number;
  };
  settings: {
    timezone: string;
    language: string;
    dateFormat: string;
  };
  coverage: {
    cities: string[];
    postalCodes: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export function RegionManager() {
  const [loading, setLoading] = useState(true);
  const [regions, setRegions] = useState<Region[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    regionName: '',
    regionCode: '',
    country: 'India',
    currencyCode: 'INR',
    currencySymbol: '₹',
    symbolPosition: 'before' as 'before' | 'after',
    taxRate: 18,
    taxName: 'GST',
    commissionRate: 15,
    timezone: 'Asia/Kolkata',
    language: 'en',
    dateFormat: 'DD/MM/YYYY',
    cities: '',
    postalCodes: '',
    isActive: true,
  });

  useEffect(() => {
    loadRegions();
  }, []);

  const loadRegions = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/admin/regions');
      setRegions(data.regions || []);
    } catch (error) {
      console.error('Error loading regions:', error);
      alert('Failed to load regions');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (region?: Region) => {
    if (region) {
      setEditingRegion(region);
      setFormData({
        regionName: region.regionName,
        regionCode: region.regionCode,
        country: region.country,
        currencyCode: region.currency.code,
        currencySymbol: region.currency.symbol,
        symbolPosition: region.currency.symbolPosition,
        taxRate: region.business.taxRate,
        taxName: region.business.taxName,
        commissionRate: region.business.commissionRate,
        timezone: region.settings.timezone,
        language: region.settings.language,
        dateFormat: region.settings.dateFormat,
        cities: region.coverage.cities.join(', '),
        postalCodes: region.coverage.postalCodes.join(', '),
        isActive: region.isActive,
      });
    } else {
      setEditingRegion(null);
      setFormData({
        regionName: '',
        regionCode: '',
        country: 'India',
        currencyCode: 'INR',
        currencySymbol: '₹',
        symbolPosition: 'before',
        taxRate: 18,
        taxName: 'GST',
        commissionRate: 15,
        timezone: 'Asia/Kolkata',
        language: 'en',
        dateFormat: 'DD/MM/YYYY',
        cities: '',
        postalCodes: '',
        isActive: true,
      });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.regionName || !formData.regionCode) {
      alert('Region name and code are required');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        regionName: formData.regionName,
        regionCode: formData.regionCode,
        country: formData.country,
        currency: {
          code: formData.currencyCode,
          symbol: formData.currencySymbol,
          symbolPosition: formData.symbolPosition,
        },
        business: {
          taxRate: formData.taxRate,
          taxName: formData.taxName,
          commissionRate: formData.commissionRate,
        },
        settings: {
          timezone: formData.timezone,
          language: formData.language,
          dateFormat: formData.dateFormat,
        },
        coverage: {
          cities: formData.cities.split(',').map(c => c.trim()).filter(Boolean),
          postalCodes: formData.postalCodes.split(',').map(p => p.trim()).filter(Boolean),
        },
        isActive: formData.isActive,
      };

      if (editingRegion) {
        const data = await apiClient.put<any>(`/admin/regions/${editingRegion.regionId}`, payload);
        if (data.success) {
          alert('Region updated successfully');
          setShowModal(false);
          loadRegions();
        } else {
          alert(data.error || 'Failed to update region');
        }
      } else {
        const data = await apiClient.post<any>('/admin/regions', payload);
        if (data.success) {
          alert('Region created successfully');
          setShowModal(false);
          loadRegions();
        } else {
          alert(data.error || 'Failed to create region');
        }
      }
    } catch (error) {
      console.error('Error saving region:', error);
      alert('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (regionId: string) => {
    if (!confirm('Are you sure you want to delete this region?')) return;

    try {
      const data = await apiClient.delete<any>(`/admin/regions/${regionId}`);
      if (data.success) {
        alert('Region deleted successfully');
        loadRegions();
      } else {
        alert(data.error || 'Failed to delete region');
      }
    } catch (error) {
      console.error('Error deleting region:', error);
      alert('An error occurred while deleting');
    }
  };

  const toggleActive = async (regionId: string, isActive: boolean) => {
    try {
      const data = await apiClient.put<any>(`/admin/regions/${regionId}/status`, { isActive: !isActive });
      if (data.success) {
        loadRegions();
      } else {
        alert(data.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('An error occurred');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-0 bg-blue-100 rounded-xl">
            <MapPin className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Region Manager</h1>
            <p className="text-sm text-gray-600">Manage regional operations and settings</p>
          </div>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-3 px-4 py-0 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
        >
          <Plus className="w-4 h-4" />
          Add Region
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {regions.map((region) => (
          <div key={region.regionId} className="bg-white rounded-xl border-2 border-gray-200 p-0">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-0 bg-blue-100 rounded-lg">
                  <Globe className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{region.regionName}</h3>
                  <p className="text-sm text-gray-600">{region.regionCode}</p>
                </div>
              </div>
              <button
                onClick={() => toggleActive(region.regionId, region.isActive)}
                className={`px-0 py-0 text-xs font-medium rounded ${
                  region.isActive
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {region.isActive ? 'Active' : 'Inactive'}
              </button>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-3 text-sm">
                <DollarSign className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">
                  {region.currency.symbol} {region.currency.code} • Tax: {region.business.taxRate}%
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">{region.settings.timezone}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">{region.coverage.cities.length} cities</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleOpenModal(region)}
                className="flex-1 flex items-center justify-center gap-3 px-0 py-0 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={() => handleDelete(region.regionId)}
                className="flex-1 flex items-center justify-center gap-3 px-0 py-0 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-0 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingRegion ? 'Edit Region' : 'Add New Region'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-0 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-0 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Region Name *</label>
                  <input
                    type="text"
                    value={formData.regionName}
                    onChange={(e) => setFormData(prev => ({ ...prev, regionName: e.target.value }))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g., Mumbai"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Region Code *</label>
                  <input
                    type="text"
                    value={formData.regionCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, regionCode: e.target.value.toUpperCase() }))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g., MUM"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-0">Country</label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                  className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium text-gray-900 mb-0">Currency Settings</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-0">Currency Code</label>
                    <input
                      type="text"
                      value={formData.currencyCode}
                      onChange={(e) => setFormData(prev => ({ ...prev, currencyCode: e.target.value.toUpperCase() }))}
                      className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-0">Symbol</label>
                    <input
                      type="text"
                      value={formData.currencySymbol}
                      onChange={(e) => setFormData(prev => ({ ...prev, currencySymbol: e.target.value }))}
                      className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-0">Position</label>
                    <select
                      value={formData.symbolPosition}
                      onChange={(e) => setFormData(prev => ({ ...prev, symbolPosition: e.target.value as 'before' | 'after' }))}
                      className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="before">Before</option>
                      <option value="after">After</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium text-gray-900 mb-0">Business Settings</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-0">Tax Rate (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={formData.taxRate}
                      onChange={(e) => setFormData(prev => ({ ...prev, taxRate: parseFloat(e.target.value) }))}
                      className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-0">Tax Name</label>
                    <input
                      type="text"
                      value={formData.taxName}
                      onChange={(e) => setFormData(prev => ({ ...prev, taxName: e.target.value }))}
                      className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-0">Commission (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={formData.commissionRate}
                      onChange={(e) => setFormData(prev => ({ ...prev, commissionRate: parseFloat(e.target.value) }))}
                      className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium text-gray-900 mb-0">Regional Settings</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-0">Timezone</label>
                    <select
                      value={formData.timezone}
                      onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
                      className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="Asia/Kolkata">Asia/Kolkata</option>
                      <option value="America/New_York">America/New_York</option>
                      <option value="Europe/London">Europe/London</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-0">Language</label>
                    <select
                      value={formData.language}
                      onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
                      className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="en">English</option>
                      <option value="hi">Hindi</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-0">Date Format</label>
                    <select
                      value={formData.dateFormat}
                      onChange={(e) => setFormData(prev => ({ ...prev, dateFormat: e.target.value }))}
                      className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium text-gray-900 mb-0">Coverage Area</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-0">Cities (comma-separated)</label>
                    <textarea
                      value={formData.cities}
                      onChange={(e) => setFormData(prev => ({ ...prev, cities: e.target.value }))}
                      className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                      rows={2}
                      placeholder="Mumbai, Navi Mumbai, Thane"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-0">Postal Codes (comma-separated)</label>
                    <textarea
                      value={formData.postalCodes}
                      onChange={(e) => setFormData(prev => ({ ...prev, postalCodes: e.target.value }))}
                      className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                      rows={2}
                      placeholder="400001, 400002, 400003"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Active Region</span>
                </label>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-0 py-4 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-0 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-0 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {editingRegion ? 'Update' : 'Create'} Region
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
