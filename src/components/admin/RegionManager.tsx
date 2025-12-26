// Comprehensive Region Manager Component
// Allows admin to view, create, edit, and manage regions

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  ArrowLeft, 
  Globe, 
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle, 
  XCircle,
  Save,
  Copy,
  Loader2,
  Search,
  Calendar,
  DollarSign,
  Phone,
  Languages,
  Palette,
  Settings,
  Shield,
  Sparkles,
  Package
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { LOGO_CIRCULAR_ORANGE, WARM_ORANGE } from '../../assets/design-tokens';
const logoImage = LOGO_CIRCULAR_ORANGE;
import { toast } from 'sonner';
import { RegionActivePackagesTab } from './catalog/RegionActivePackagesTab';

interface Region {
  regionId: string;
  regionName: string;
  regionCode: string;
  isActive: boolean;
  launchDate: string;
  phoneConfig: {
    countryCode: string;
    phoneLength: number;
    phoneFormat: string;
    validationRegex: string;
    placeholder: string;
    displayFormat: string;
  };
  currency: {
    code: string;
    symbol: string;
    symbolPosition: 'before' | 'after';
    decimalPlaces: number;
    thousandsSeparator: string;
    decimalSeparator: string;
  };
  localization: {
    primaryLanguage: string;
    supportedLanguages: string[];
    dateFormat: string;
    timeFormat: '12h' | '24h';
    timezone: string;
    rtlSupport: boolean;
  };
  measurementSystem: {
    system: 'metric' | 'imperial';
    weightUnit: string;
    distanceUnit: string;
    heightUnit: string;
  };
  serviceCatalog: {
    veterinary: boolean;
    grooming: boolean;
    training: boolean;
    walking: boolean;
    behavioral: boolean;
    boarding: boolean;
    adoption: boolean;
    sunset: boolean;
    insurance: boolean;
    pharmacy: boolean;
    petCafe: boolean;
  };
  compliance: {
    gdprEnabled: boolean;
    dataRetentionDays: number;
    requiresPetLicense: boolean;
    vaccinationMandatory: string[];
    ageRestrictions: {
      minAgeMonths: number;
      maxAgeMonths: number;
    };
  };
  popularBreeds: {
    dogs: string[];
    cats: string[];
  };
  business: {
    taxRate: number;
    taxName: string;
    businessHours: {
      start: string;
      end: string;
    };
    holidays: string[];
  };
  payments: {
    supportedMethods: string[];
    paymentGateway: string;
    minBookingAmount: number;
    maxBookingAmount: number;
  };
  regional: {
    emergencyNumber: string;
    addressFormat: string;
    postalCodeRequired: boolean;
    stateRequired: boolean;
  };
  createdAt?: string;
  updatedAt?: string;
}

interface RegionTemplate {
  id: string;
  name: string;
  description: string;
  flag: string;
}

interface RegionManagerProps {
  onBack?: () => void;
}

const TEMPLATES: RegionTemplate[] = [
  { id: 'india', name: 'India', description: 'Indian Rupee, +91, Hindi/English', flag: '🇮🇳' },
  { id: 'usa', name: 'United States', description: 'USD, +1, English', flag: '🇺🇸' },
  { id: 'uae', name: 'United Arab Emirates', description: 'AED, +971, Arabic/English', flag: '🇦🇪' },
  { id: 'singapore', name: 'Singapore', description: 'SGD, +65, English/Chinese', flag: '🇸🇬' },
  { id: 'uk', name: 'United Kingdom', description: 'GBP, +44, English', flag: '🇬🇧' },
  { id: 'australia', name: 'Australia', description: 'AUD, +61, English', flag: '🇦🇺' },
  { id: 'emea', name: 'EMEA (Europe)', description: 'EUR, +33 (Default), English/European', flag: '🇪🇺' },
];

export function RegionManager({ onBack }: RegionManagerProps = {}) {
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [editingRegion, setEditingRegion] = useState<Partial<Region> | null>(null);
  const [autoInitAttempted, setAutoInitAttempted] = useState(false); // Guard against infinite loops

  useEffect(() => {
    loadRegions();
  }, []);

  const loadRegions = async () => {
    try {
      setLoading(true);
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/regions`;
      console.log('🌍 [REGION] Loading regions from:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });
      
      console.log('🌍 [REGION] Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('🌍 [REGION] Error response:', response.status, errorText);
        
        // For 404, initialize with empty regions instead of throwing error
        if (response.status === 404) {
          console.warn('🌍 [REGION] Regions endpoint not found, initializing with empty array');
          setRegions([]);
          toast.info('No regions found. Create your first region to get started.');
          return;
        }
        
        toast.error(`Server error: ${response.status} ${response.statusText}`);
        return;
      }
      
      const data = await response.json();
      console.log('🌍 [REGION] Response data:', data);
      console.log('🌍 [REGION] Regions array:', data.regions);
      console.log('🌍 [REGION] Regions count:', data.regions?.length || 0);
      
      // ✅ FIX: Handle both response formats - SQL returns direct array
      const regionsData = data.regions || [];
      console.log('🌍 [REGION] Processing regions data:', regionsData);
      console.log('🌍 [REGION] Regions data type:', Array.isArray(regionsData) ? 'array' : typeof regionsData);
      
      if (regionsData.length > 0 || data.success) {
        const extractedRegions: Region[] = [];
        
        regionsData.forEach((item: any) => {
          // ✅ SQL format: regions are already unwrapped with regionId, regionName, etc.
          // Check if it's a valid region object
          if (item && (item.regionId || item.regionCode)) {
            // Ensure regionId is set (use regionCode as fallback)
            const region: Region = {
              regionId: item.regionId || item.regionCode,
              regionName: item.regionName || item.name,
              regionCode: item.regionCode || item.code || item.regionId,
              country: item.country || 'India',
              serviceCatalog: item.serviceCatalog || {},
              isActive: item.isActive !== undefined ? item.isActive : (item.is_active !== undefined ? item.is_active : true),
              ...item
            };
            extractedRegions.push(region);
          } else if (item && item.value) {
            // ✅ Legacy KV format: unwrap from { key: "...", value: {...} }
            const region = item.value;
            if (region && region.regionId) {
              extractedRegions.push(region);
            }
          }
        });
        
        // Deduplicate regions by regionId to prevent React key warnings
        const uniqueRegionsMap = new Map<string, Region>();
        extractedRegions.forEach((r: Region) => {
          const existing = uniqueRegionsMap.get(r.regionId);
          
          if (!existing) {
            uniqueRegionsMap.set(r.regionId, r);
          } else if (r.isActive && !existing.isActive) {
             // If we encounter a duplicate, prefer the ACTIVE one
             // This ensures the user sees the active configuration if a stale duplicate exists
             uniqueRegionsMap.set(r.regionId, r);
          }
        });
        
        const uniqueRegions = Array.from(uniqueRegionsMap.values());
        setRegions(uniqueRegions);
        
        // 🛡️ GUARD: Only auto-initialize ONCE to prevent infinite loops
        if (uniqueRegions.length === 0 && !autoInitAttempted) {
          console.log('🇮🇳 No regions found - attempting one-time auto-initialization...');
          setAutoInitAttempted(true); // Prevent future attempts
          toast.info('Initializing India region...');
          await handleCreateFromTemplate('india');
        } else if (uniqueRegions.length === 0) {
          console.warn('⚠️ Auto-initialization already attempted. KV store may be having issues.');
          toast.warning('Region system unavailable. Using defaults.');
        } else {
          toast.success(`Loaded ${uniqueRegions.length} regions`);
        }
      } else {
        toast.error(data.error || 'Failed to load regions');
      }
    } catch (error) {
      console.error('🌍 [REGION] Exception:', error);
      toast.error(`Error loading regions: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSeedAllRegions = async () => {
    try {
      setLoading(true);
      toast('Seeding default regions...');
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/regions/seed-all`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success) {
        toast.success(data.message || 'All regions seeded successfully!');
        await loadRegions();
      } else {
        toast.error(data.error || 'Failed to seed regions');
      }
    } catch (error) {
      console.error('Error seeding regions:', error);
      toast.error(`Seeding error: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFromTemplate = async (templateId: string) => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/regions/init-${templateId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      // Check if response is ok
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error:', errorText);
        toast.error(`Server error: ${response.status} ${response.statusText}`);
        return;
      }
      
      // Try to parse JSON
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        const text = await response.text();
        console.error('Response text:', text);
        toast.error('Invalid response from server');
        return;
      }
      
      if (data.success) {
        toast.success(data.message || `${templateId.toUpperCase()} region created successfully!`);
        await loadRegions();
        setView('list');
      } else {
        toast.error(data.error || 'Failed to create region');
      }
    } catch (error) {
      console.error('Error creating region:', error);
      toast.error(`Error: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (regionId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/regions/${regionId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ isActive: !currentStatus }),
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(`Region ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
        await loadRegions();
      } else {
        toast.error(data.error || 'Failed to update region status');
      }
    } catch (error) {
      console.error('Error updating region status:', error);
      toast.error('Error updating region status');
    }
  };

  const handleEditRegion = (region: Region) => {
    setSelectedRegion(region);
    // Ensure all nested objects exist to prevent crashes when editing partial data
    setEditingRegion({ 
      ...region,
      currency: region.currency || { 
        code: '', symbol: '', symbolPosition: 'before', decimalPlaces: 2, 
        thousandsSeparator: ',', decimalSeparator: '.' 
      },
      phoneConfig: region.phoneConfig || {
        countryCode: '', phoneLength: 10, phoneFormat: '', 
        validationRegex: '', placeholder: '', displayFormat: ''
      },
      localization: region.localization || {
        primaryLanguage: '', supportedLanguages: [], dateFormat: 'DD/MM/YYYY', 
        timeFormat: '12h', timezone: '', rtlSupport: false
      },
      serviceCatalog: region.serviceCatalog || {
        veterinary: false, grooming: false, training: false, walking: false,
        behavioral: false, boarding: false, adoption: false, sunset: false,
        insurance: false, pharmacy: false, petCafe: false
      },
      popularBreeds: region.popularBreeds || { dogs: [], cats: [] },
      compliance: region.compliance || { 
        gdprEnabled: false, dataRetentionDays: 365, requiresPetLicense: false,
        vaccinationMandatory: [], ageRestrictions: { minAgeMonths: 0, maxAgeMonths: 0 }
      }
    });
    setView('edit');
  };

  const handleSaveRegion = async () => {
    if (!editingRegion || !editingRegion.regionId) return;

    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/regions/${editingRegion.regionId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(editingRegion),
        }
      );
      
      // Check if response is ok
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error:', errorText);
        toast.error(`Server error: ${response.status} ${response.statusText}`);
        return;
      }
      
      // Try to parse JSON
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        const text = await response.text();
        console.error('Response text:', text);
        toast.error('Invalid response from server');
        return;
      }
      
      if (data.success) {
        toast.success(data.message || 'Region updated successfully!');
        await loadRegions();
        setView('list');
        setEditingRegion(null);
        setSelectedRegion(null);
      } else {
        toast.error(data.error || 'Failed to update region');
      }
    } catch (error) {
      console.error('Error updating region:', error);
      toast.error(`Error: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredRegions = regions.filter(region =>
    (region.regionName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (region.regionCode?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {onBack && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onBack}
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
              )}
              <div className="flex items-center gap-3">
                <img src={logoImage} alt="WarmPawz" className="w-10 h-10" />
                <div>
                  <h1 className="text-xl flex items-center gap-2" style={{ color: WARM_ORANGE }}>
                    <Globe className="w-6 h-6" />
                    Region Manager
                  </h1>
                  <p className="text-sm text-gray-500">Launch and manage global markets</p>
                </div>
              </div>
            </div>
            {view === 'list' && (
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={handleSeedAllRegions}
                  className="gap-2 border-dashed border-gray-300"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = WARM_ORANGE;
                    e.currentTarget.style.color = WARM_ORANGE;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#D1D5DB';
                    e.currentTarget.style.color = '';
                  }}
                >
                  <Sparkles className="w-4 h-4" />
                  Seed Defaults
                </Button>
                <Button
                  onClick={() => setView('create')}
                  className="bg-[#FF8C42] hover:bg-[#FF8C42]/90 gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create Region
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        {/* List View */}
        {view === 'list' && (
          <div className="space-y-6">
            {/* Search and Filter */}
            <Card className="p-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search regions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="font-medium">{regions.length}</span>
                  <span>total regions</span>
                  <span className="mx-2">•</span>
                  <span className="font-medium">{regions.filter(r => r.isActive).length}</span>
                  <span>active</span>
                </div>
              </div>
            </Card>

            {/* Regions Grid */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#FF8C42]" />
              </div>
            ) : filteredRegions.length === 0 ? (
              <Card className="p-12 text-center">
                <Globe className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No regions found</h3>
                <p className="text-gray-500 mb-6">
                  {searchQuery ? 'Try a different search term' : 'Get started by creating your first region'}
                </p>
                {!searchQuery && (
                  <Button
                    onClick={() => setView('create')}
                    className="bg-[#FF8C42] hover:bg-[#FF8C42]/90 gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Create Region
                  </Button>
                )}
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredRegions.map((region, index) => (
                  <Card key={region.regionId || `region-${index}`} className="p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-[#FF8C42] to-[#FF6B35] rounded-lg flex items-center justify-center text-2xl">
                          {region.regionCode === 'IN' ? '🇮🇳' : 
                           region.regionCode === 'US' ? '🇺🇸' :
                           region.regionCode === 'AE' ? '🇦🇪' :
                           region.regionCode === 'SG' ? '🇸🇬' : 
                           region.regionCode === 'GB' ? '🇬🇧' :
                           region.regionCode === 'AU' ? '🇦🇺' :
                           region.regionCode === 'EU' ? '🇪🇺' : '🌍'}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{region.regionName}</h3>
                          <p className="text-sm text-gray-500">{region.regionCode}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {region.isActive ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <DollarSign className="w-4 h-4" />
                        <span>{region.currency?.symbol} ({region.currency?.code})</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4" />
                        <span>{region.phoneConfig?.countryCode}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Languages className="w-4 h-4" />
                        <span>{region.localization?.primaryLanguage}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span>{region.localization?.dateFormat}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {Object.entries(region.serviceCatalog || {}).filter(([_, enabled]) => enabled).slice(0, 4).map(([service]) => (
                        <span key={service} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                          {service}
                        </span>
                      ))}
                      {Object.entries(region.serviceCatalog || {}).filter(([_, enabled]) => enabled).length > 4 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                          +{Object.entries(region.serviceCatalog || {}).filter(([_, enabled]) => enabled).length - 4} more
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-4 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditRegion(region)}
                        className="flex-1 gap-2"
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </Button>
                      <Button
                        variant={region.isActive ? "outline" : "default"}
                        size="sm"
                        onClick={() => handleToggleStatus(region.regionId, region.isActive)}
                        className={region.isActive ? "" : "bg-[#FF8C42] hover:bg-[#FF8C42]/90"}
                      >
                        {region.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create View */}
        {view === 'create' && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView('list')}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to List
              </Button>
            </div>

            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Create Region from Template</h2>
              <p className="text-gray-600 mb-6">
                Select a pre-configured template to quickly launch in a new market. You can customize settings after creation.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {TEMPLATES.map((template) => {
                  const exists = regions.some(r => r.regionId === template.id);
                  return (
                    <Card
                      key={template.id}
                      className={`p-6 cursor-pointer transition-all ${
                        exists
                          ? 'bg-gray-50 cursor-not-allowed opacity-60'
                          : 'hover:shadow-lg hover:border-[#FF8C42]'
                      }`}
                      onClick={() => !exists && handleCreateFromTemplate(template.id)}
                    >
                      <div className="flex items-start gap-4">
                        <div className="text-4xl">{template.flag}</div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-1">{template.name}</h3>
                          <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                          {exists ? (
                            <span className="text-xs text-gray-500">✓ Already created</span>
                          ) : (
                            <Button
                              size="sm"
                              className="bg-[#FF8C42] hover:bg-[#FF8C42]/90 gap-2"
                            >
                              <Plus className="w-4 h-4" />
                              Create
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {/* Edit View */}
        {view === 'edit' && editingRegion && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setView('list');
                  setEditingRegion(null);
                  setSelectedRegion(null);
                }}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to List
              </Button>
              <Button
                onClick={handleSaveRegion}
                disabled={loading}
                className="bg-[#FF8C42] hover:bg-[#FF8C42]/90 gap-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Changes
              </Button>
            </div>

            <Card className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-[#FF8C42] to-[#FF6B35] rounded-lg flex items-center justify-center text-3xl">
                  {editingRegion.regionCode === 'IN' ? '🇮🇳' : 
                   editingRegion.regionCode === 'US' ? '🇺🇸' :
                   editingRegion.regionCode === 'AE' ? '🇦🇪' :
                   editingRegion.regionCode === 'SG' ? '🇸🇬' : 
                   editingRegion.regionCode === 'GB' ? '🇬🇧' :
                   editingRegion.regionCode === 'AU' ? '🇦🇺' :
                   editingRegion.regionCode === 'EU' ? '🇪🇺' : '🌍'}
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{editingRegion.regionName}</h2>
                  <p className="text-gray-500">Configure regional settings and services</p>
                </div>
              </div>

              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-7">
                  <TabsTrigger key="basic" value="basic">Basic</TabsTrigger>
                  <TabsTrigger key="currency" value="currency">Currency</TabsTrigger>
                  <TabsTrigger key="phone" value="phone">Phone</TabsTrigger>
                  <TabsTrigger key="localization" value="localization">Localization</TabsTrigger>
                  <TabsTrigger key="services" value="services">Services</TabsTrigger>
                  <TabsTrigger key="breeds" value="breeds">Breeds</TabsTrigger>
                  <TabsTrigger key="packages" value="packages">
                    <Package className="w-4 h-4 inline mr-1" />
                    Packages
                  </TabsTrigger>
                </TabsList>

                {/* Basic Tab */}
                <TabsContent value="basic" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Region Name</Label>
                      <Input
                        value={editingRegion.regionName || ''}
                        onChange={(e) => setEditingRegion({ ...editingRegion, regionName: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Region Code</Label>
                      <Input
                        value={editingRegion.regionCode || ''}
                        onChange={(e) => setEditingRegion({ ...editingRegion, regionCode: e.target.value })}
                        placeholder="US, IN, AE, etc."
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <Label className="text-base">Region Status</Label>
                      <p className="text-sm text-gray-500">Enable this region for customers and vendors</p>
                    </div>
                    <Switch
                      checked={editingRegion.isActive || false}
                      onCheckedChange={(checked) => setEditingRegion({ ...editingRegion, isActive: checked })}
                    />
                  </div>
                </TabsContent>

                {/* Currency Tab */}
                <TabsContent value="currency" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Currency Code</Label>
                      <Input
                        value={editingRegion.currency?.code || ''}
                        onChange={(e) => setEditingRegion({
                          ...editingRegion,
                          currency: { ...editingRegion.currency!, code: e.target.value }
                        })}
                        placeholder="USD, INR, AED"
                      />
                    </div>
                    <div>
                      <Label>Currency Symbol</Label>
                      <Input
                        value={editingRegion.currency?.symbol || ''}
                        onChange={(e) => setEditingRegion({
                          ...editingRegion,
                          currency: { ...editingRegion.currency!, symbol: e.target.value }
                        })}
                        placeholder="$, ₹, AED"
                      />
                    </div>
                    <div>
                      <Label>Decimal Places</Label>
                      <Input
                        type="number"
                        value={editingRegion.currency?.decimalPlaces || 2}
                        onChange={(e) => setEditingRegion({
                          ...editingRegion,
                          currency: { ...editingRegion.currency!, decimalPlaces: parseInt(e.target.value) }
                        })}
                      />
                    </div>
                    <div>
                      <Label>Thousands Separator</Label>
                      <Input
                        value={editingRegion.currency?.thousandsSeparator || ','}
                        onChange={(e) => setEditingRegion({
                          ...editingRegion,
                          currency: { ...editingRegion.currency!, thousandsSeparator: e.target.value }
                        })}
                        placeholder=", or ."
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* Phone Tab */}
                <TabsContent value="phone" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Country Code</Label>
                      <Input
                        value={editingRegion.phoneConfig?.countryCode || ''}
                        onChange={(e) => setEditingRegion({
                          ...editingRegion,
                          phoneConfig: { ...editingRegion.phoneConfig!, countryCode: e.target.value }
                        })}
                        placeholder="+91, +1, +971"
                      />
                    </div>
                    <div>
                      <Label>Phone Length</Label>
                      <Input
                        type="number"
                        value={editingRegion.phoneConfig?.phoneLength || 10}
                        onChange={(e) => setEditingRegion({
                          ...editingRegion,
                          phoneConfig: { ...editingRegion.phoneConfig!, phoneLength: parseInt(e.target.value) }
                        })}
                      />
                    </div>
                    <div>
                      <Label>Phone Format</Label>
                      <Input
                        value={editingRegion.phoneConfig?.phoneFormat || ''}
                        onChange={(e) => setEditingRegion({
                          ...editingRegion,
                          phoneConfig: { ...editingRegion.phoneConfig!, phoneFormat: e.target.value }
                        })}
                        placeholder="XXXXX XXXXX"
                      />
                    </div>
                    <div>
                      <Label>Placeholder</Label>
                      <Input
                        value={editingRegion.phoneConfig?.placeholder || ''}
                        onChange={(e) => setEditingRegion({
                          ...editingRegion,
                          phoneConfig: { ...editingRegion.phoneConfig!, placeholder: e.target.value }
                        })}
                        placeholder="+91 98765 43210"
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* Localization Tab */}
                <TabsContent value="localization" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Primary Language</Label>
                      <Input
                        value={editingRegion.localization?.primaryLanguage || ''}
                        onChange={(e) => setEditingRegion({
                          ...editingRegion,
                          localization: { ...editingRegion.localization!, primaryLanguage: e.target.value }
                        })}
                        placeholder="en, ar, es"
                      />
                    </div>
                    <div>
                      <Label>Date Format</Label>
                      <Input
                        value={editingRegion.localization?.dateFormat || ''}
                        onChange={(e) => setEditingRegion({
                          ...editingRegion,
                          localization: { ...editingRegion.localization!, dateFormat: e.target.value }
                        })}
                        placeholder="DD/MM/YYYY, MM/DD/YYYY"
                      />
                    </div>
                    <div>
                      <Label>Timezone</Label>
                      <Input
                        value={editingRegion.localization?.timezone || ''}
                        onChange={(e) => setEditingRegion({
                          ...editingRegion,
                          localization: { ...editingRegion.localization!, timezone: e.target.value }
                        })}
                        placeholder="Asia/Kolkata, America/New_York"
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <Label>RTL Support</Label>
                      <Switch
                        checked={editingRegion.localization?.rtlSupport || false}
                        onCheckedChange={(checked) => setEditingRegion({
                          ...editingRegion,
                          localization: { ...editingRegion.localization!, rtlSupport: checked }
                        })}
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* Services Tab */}
                <TabsContent value="services" className="space-y-4">
                  <p className="text-sm text-gray-600 mb-4">
                    Enable or disable services for this region based on local regulations and market demand.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    {editingRegion.serviceCatalog && Object.entries(editingRegion.serviceCatalog).map(([service, enabled]) => (
                      <div key={service} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <Label className="capitalize">{service}</Label>
                        <Switch
                          checked={enabled}
                          onCheckedChange={(checked) => setEditingRegion({
                            ...editingRegion,
                            serviceCatalog: { ...editingRegion.serviceCatalog!, [service]: checked }
                          })}
                        />
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {/* Breeds Tab */}
                <TabsContent value="breeds" className="space-y-4">
                  <div>
                    <Label>Popular Dog Breeds (comma separated)</Label>
                    <Input
                      value={editingRegion.popularBreeds?.dogs?.join(', ') || ''}
                      onChange={(e) => setEditingRegion({
                        ...editingRegion,
                        popularBreeds: {
                          ...editingRegion.popularBreeds!,
                          dogs: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                        }
                      })}
                      placeholder="Labrador, German Shepherd, Golden Retriever"
                    />
                  </div>
                  <div>
                    <Label>Popular Cat Breeds (comma separated)</Label>
                    <Input
                      value={editingRegion.popularBreeds?.cats?.join(', ') || ''}
                      onChange={(e) => setEditingRegion({
                        ...editingRegion,
                        popularBreeds: {
                          ...editingRegion.popularBreeds!,
                          cats: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                        }
                      })}
                      placeholder="Persian, Siamese, Maine Coon"
                    />
                  </div>
                </TabsContent>

                {/* Packages Tab - NEW */}
                <TabsContent value="packages">
                  {editingRegion && (
                    <RegionActivePackagesTab
                      regionId={editingRegion.regionId!}
                      regionName={editingRegion.regionName!}
                      currency={editingRegion.currency!}
                    />
                  )}
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}