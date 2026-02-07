import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { 
  Megaphone, 
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  LayoutTemplate, 
  Save,
  RotateCcw,
  Star,
  Zap,
  Tag
} from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';
import { toast } from 'sonner@2.0.3';
import { CouponManagement } from './marketing/CouponManagement';
import { AdvancedPromotionsEngine } from './marketing/AdvancedPromotionsEngine';

export function MarketingPromotionsTab() {
  const [activeTab, setActiveTab] = useState<'promotions' | 'ui-config' | 'spotlight' | 'coupons' | 'advanced'>('promotions');
  const [loading, setLoading] = useState(false);
  
  // Spotlight State
  const [spotlights, setSpotlights] = useState<any[]>([]);
  const [availableVendors, setAvailableVendors] = useState<any[]>([]);
  const [spotlightModal, setSpotlightModal] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [spotlightDuration, setSpotlightDuration] = useState('7');
  const [spotlightType, setSpotlightType] = useState('featured_vendor');
  
  // Promotions State
  const [promotions, setPromotions] = useState<any[]>([]);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [editingPromo, setEditingPromo] = useState<any>(null);
  const [promoForm, setPromoForm] = useState({
    title: '',
    subtitle: '',
    discountType: 'percentage',
    discountValue: 0,
    code: '',
    serviceCategory: 'all',
    serviceStyle: 'all',
    validFrom: '',
    validUntil: '',
    isActive: true,
    displayType: 'spotlight'
  });

  // UI Config State
  const [uiConfig, setUiConfig] = useState<any>(null);
  const [selectedRole, setSelectedRole] = useState('veterinarian');
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  const [configLoading, setConfigLoading] = useState(false);

  const API_BASE = getApiBaseUrl();

  useEffect(() => {
    if (activeTab === 'promotions') {
      loadPromotions();
      loadRoles();
    } else if (activeTab === 'spotlight') {
      loadSpotlights();
      loadVendors();
    } else {
      loadRoles(); // Load roles first
    }
  }, [activeTab]);

  // Reload config when role changes (but not on initial load if roles aren't loaded yet)
  useEffect(() => {
    if (activeTab === 'ui-config' && selectedRole) {
      loadUiConfig();
    }
  }, [selectedRole, activeTab]);
  
  const loadRoles = async () => {
    try {
      const res = await fetch(`${API_BASE}/config/roles`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setAvailableRoles(data.roles || []);
        
        // If current selected role is not in the list and we have roles, select the first one
        if (data.roles && data.roles.length > 0) {
           // Check if currently selected role exists in the fetched roles
           const roleExists = data.roles.some((r: any) => r.id === selectedRole);
           if (!roleExists) {
             setSelectedRole(data.roles[0].id);
           }
        }
      }
    } catch (error) {
      console.error('Error loading roles:', error);
    }
  };

  // ===========================
  // SPOTLIGHT LOGIC
  // ===========================
  
  const loadSpotlights = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/marketing/spotlights`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setSpotlights(data.spotlights || []);
      }
    } catch (error) {
      console.error('Error loading spotlights:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const loadVendors = async () => {
    try {
      // Fetch only active vendors
      const res = await fetch(`${API_BASE}/admin/vendors`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        const activeVendors = (data.vendors || []).filter((v: any) => v.status === 'approved');
        setAvailableVendors(activeVendors);
      }
    } catch (error) {
      console.error('Error loading vendors:', error);
    }
  };

  const handleAddSpotlight = async () => {
    if (!selectedVendorId) {
      toast.error('Please select a vendor');
      return;
    }
    
    try {
      const vendor = availableVendors.find(v => v.id === selectedVendorId || v.vendorId === selectedVendorId);
      
      const payload = {
        vendorId: selectedVendorId,
        vendorName: vendor?.businessName || vendor?.fullName || 'Unknown Vendor',
        type: spotlightType,
        durationDays: parseInt(spotlightDuration),
        startDate: new Date().toISOString(),
        status: 'active'
      };
      
      const res = await fetch(`${API_BASE}/marketing/spotlights`, {
        method: 'POST',
        headers: { 
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        toast.success('Vendor added to spotlight');
        setSpotlightModal(false);
        loadSpotlights();
        setSelectedVendorId('');
      } else {
        toast.error('Failed to add spotlight');
      }
    } catch (error) {
      console.error('Error adding spotlight:', error);
      toast.error('Error adding spotlight');
    }
  };
  
  const handleRemoveSpotlight = async (id: string) => {
    if (!confirm('Remove this vendor from spotlight?')) return;
    
    try {
      const res = await fetch(`${API_BASE}/marketing/spotlights/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      if (res.ok) {
        toast.success('Spotlight removed');
        loadSpotlights();
      }
    } catch (error) {
      toast.error('Failed to remove spotlight');
    }
  };

  // ===========================
  // PROMOTIONS LOGIC
  // ===========================

  const loadPromotions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/marketing/promotions`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setPromotions(data.promotions);
      }
    } catch (error) {
      console.error('Error loading promotions:', error);
      toast.error('Failed to load promotions');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePromo = async () => {
    try {
      const method = editingPromo ? 'PUT' : 'POST';
      const url = editingPromo 
        ? `${API_BASE}/marketing/promotions/${editingPromo.id}`
        : `${API_BASE}/marketing/promotions`;

      const res = await fetch(url, {
        method,
        headers: { 
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(promoForm)
      });

      if (res.ok) {
        toast.success(`Promotion ${editingPromo ? 'updated' : 'created'} successfully`);
        setShowPromoModal(false);
        loadPromotions();
        resetForm();
      } else {
        toast.error('Failed to save promotion');
      }
    } catch (error) {
      console.error('Error saving promotion:', error);
      toast.error('Error saving promotion');
    }
  };

  const handleDeletePromo = async (id: string) => {
    if (!confirm('Are you sure you want to delete this promotion?')) return;
    
    try {
      const res = await fetch(`${API_BASE}/marketing/promotions/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (res.ok) {
        toast.success('Promotion deleted');
        loadPromotions();
      }
    } catch (error) {
      toast.error('Failed to delete promotion');
    }
  };

  const resetForm = () => {
    setEditingPromo(null);
    setPromoForm({
      title: '',
      subtitle: '',
      discountType: 'percentage',
      discountValue: 0,
      code: '',
      serviceCategory: 'all',
      serviceStyle: 'all',
      validFrom: '',
      validUntil: '',
      isActive: true,
      displayType: 'spotlight'
    });
  };

  const openEditModal = (promo: any) => {
    setEditingPromo(promo);
    setPromoForm({
      title: promo.title,
      subtitle: promo.subtitle,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      code: promo.code,
      serviceCategory: promo.serviceCategory,
      serviceStyle: promo.serviceStyle,
      validFrom: promo.validFrom,
      validUntil: promo.validUntil,
      isActive: promo.isActive,
      displayType: promo.displayType
    });
    setShowPromoModal(true);
  };

  // ===========================
  // UI CONFIG LOGIC
  // ===========================

  const loadUiConfig = async () => {
    setConfigLoading(true);
    try {
      const res = await fetch(`${API_BASE}/config/ui/dashboard?roleId=${selectedRole}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setUiConfig(data.config);
      }
    } catch (error) {
      console.error('Error loading config:', error);
      toast.error('Failed to load UI config');
    } finally {
      setConfigLoading(false);
    }
  };

  const handleToggleService = (index: number) => {
    if (!uiConfig) return;
    const newConfig = [...uiConfig];
    newConfig[index].enabled = !newConfig[index].enabled;
    setUiConfig(newConfig);
  };

  const handleSaveConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/config/ui/dashboard`, {
        method: 'PUT',
        headers: { 
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roleId: selectedRole,
          config: uiConfig
        })
      });

      if (res.ok) {
        toast.success('Dashboard configuration saved');
      } else {
        toast.error('Failed to save configuration');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Error saving configuration');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Marketing & Promotions</h2>
          <p className="text-gray-500">Manage promotions and customize customer dashboard experience</p>
        </div>
        
        <div className="flex gap-2 bg-white p-1 rounded-lg border">
          <button
            onClick={() => setActiveTab('promotions')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'promotions' 
                ? 'bg-[#FF8C42] text-white shadow-sm' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Megaphone className="w-4 h-4 inline mr-2" />
            Promotions
          </button>
          <button
            onClick={() => setActiveTab('ui-config')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'ui-config' 
                ? 'bg-[#FF8C42] text-white shadow-sm' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <LayoutTemplate className="w-4 h-4 inline mr-2" />
            Dashboard UI
          </button>
          <button
            onClick={() => setActiveTab('spotlight')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'spotlight' 
                ? 'bg-[#FF8C42] text-white shadow-sm' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Star className="w-4 h-4 inline mr-2" />
            Spotlight
          </button>
          <button
            onClick={() => setActiveTab('coupons')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'coupons' 
                ? 'bg-[#FF8C42] text-white shadow-sm' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Tag className="w-4 h-4 inline mr-2" />
            Coupons
          </button>
          <button
            onClick={() => setActiveTab('advanced')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'advanced' 
                ? 'bg-[#FF8C42] text-white shadow-sm' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Zap className="w-4 h-4 inline mr-2" />
            Advanced
          </button>
        </div>
      </div>

      {/* PROMOTIONS TAB */}
      {activeTab === 'promotions' && (
        <Card className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search promotions..." className="pl-9" />
            </div>
            <Button 
              className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
              onClick={() => { resetForm(); setShowPromoModal(true); }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Promotion
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-12">Loading promotions...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promotions.map((promo) => (
                  <TableRow key={promo.id}>
                    <TableCell className="font-medium">
                      <div>{promo.title}</div>
                      <div className="text-xs text-gray-500">{promo.subtitle}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        {promo.discountType === 'percentage' ? `${promo.discountValue}%` : `₹${promo.discountValue}`} OFF
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{promo.code}</TableCell>
                    <TableCell className="capitalize">{promo.serviceCategory.replace('_', ' ')}</TableCell>
                    <TableCell>
                      <Switch 
                        checked={promo.isActive}
                        onCheckedChange={async () => {
                          // Toggle active status
                          await fetch(`${API_BASE}/marketing/promotions/${promo.id}`, {
                            method: 'PUT',
                            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                            body: JSON.stringify({ isActive: !promo.isActive })
                          });
                          loadPromotions();
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEditModal(promo)}>
                        <Edit className="w-4 h-4 text-blue-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeletePromo(promo.id)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {promotions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      No promotions found. Create one to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {/* UI CONFIG TAB */}
      {activeTab === 'ui-config' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 col-span-1 h-fit">
            <h3 className="font-semibold mb-4">Configuration Scope</h3>
            <div className="space-y-4">
              <div>
                <Label>Target Role</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.length > 0 ? (
                      availableRoles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))
                    ) : (
                      <>
                        <SelectItem value="veterinarian">Veterinarian</SelectItem>
                        <SelectItem value="groomer">Groomer</SelectItem>
                        <SelectItem value="walker">Walker</SelectItem>
                        <SelectItem value="trainer">Trainer</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="pt-4 border-t text-sm text-gray-500">
                Use this section to show or hide service buttons on the customer dashboard. Changes reflect immediately in the app.
              </div>
            </div>
          </Card>

          <Card className="p-6 col-span-2">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-semibold">Dashboard Buttons</h3>
              <Button onClick={handleSaveConfig} disabled={configLoading} className="bg-[#FF8C42] hover:bg-[#FF7A2E]">
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>

            {configLoading ? (
              <div className="text-center py-12">Loading configuration...</div>
            ) : (
              <div className="space-y-4">
                {uiConfig && uiConfig.map((btn: any, index: number) => (
                  <div key={btn.id} className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-lg border flex items-center justify-center">
                        {/* Icon placeholder since we can't dynamically render icon component easily here without mapping */}
                        <span className="text-xs font-bold text-gray-500">{btn.icon}</span>
                      </div>
                      <div>
                        <div className="font-medium">{btn.label}</div>
                        <div className="text-xs text-gray-500 font-mono">{btn.id}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${btn.enabled ? 'text-green-600' : 'text-gray-400'}`}>
                        {btn.enabled ? 'Visible' : 'Hidden'}
                      </span>
                      <Switch 
                        checked={btn.enabled} 
                        onCheckedChange={() => handleToggleService(index)}
                      />
                    </div>
                  </div>
                ))}
                {(!uiConfig || uiConfig.length === 0) && (
                  <div className="text-center py-8 text-gray-500">
                    No configuration found for this role.
                    <Button variant="outline" onClick={loadUiConfig} className="mt-2">
                      <RotateCcw className="w-4 h-4 mr-2" /> Retry
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* SPOTLIGHT TAB */}
      {activeTab === 'spotlight' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
             <div>
               <h3 className="text-lg font-medium">Featured Vendors</h3>
               <p className="text-sm text-gray-500">Highlight top performing vendors on the home screen</p>
             </div>
             <Button className="bg-[#FF8C42] hover:bg-[#FF7A2E]" onClick={() => setSpotlightModal(true)}>
               <Plus className="w-4 h-4 mr-2" />
               Add Spotlight
             </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {spotlights.map((spot) => (
              <Card key={spot.id} className="overflow-hidden border-orange-100 shadow-sm hover:shadow-md transition-all">
                <div className="bg-gradient-to-r from-orange-50 to-white p-4 border-b border-orange-100 flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-white rounded-full shadow-sm">
                      <Zap className="w-4 h-4 text-orange-500 fill-orange-500" />
                    </div>
                    <span className="text-xs font-semibold text-orange-600 uppercase tracking-wider">Featured</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2 hover:text-red-600" onClick={() => handleRemoveSpotlight(spot.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <div className="p-4">
                  <h4 className="font-bold text-lg mb-1">{spot.vendorName}</h4>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="secondary" className="text-xs">
                      {spot.type === 'featured_vendor' ? 'Vendor Spotlight' : 'Service Highlight'}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-500 flex justify-between items-center pt-2 border-t mt-2">
                    <span>Expires in:</span>
                    <span className="font-medium text-gray-900">
                      {Math.max(0, Math.ceil((new Date(new Date(spot.startDate).getTime() + spot.durationDays * 86400000).getTime() - new Date().getTime()) / (1000 * 3600 * 24)))} days
                    </span>
                  </div>
                </div>
              </Card>
            ))}
            
            {spotlights.length === 0 && (
              <div className="col-span-3 text-center py-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-gray-900 font-medium">No Active Spotlights</h3>
                <p className="text-gray-500 text-sm mt-1 mb-4">Feature your best vendors to boost their visibility</p>
                <Button variant="outline" onClick={() => setSpotlightModal(true)}>
                  Add First Spotlight
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE/EDIT PROMO MODAL */}
      <Dialog open={showPromoModal} onOpenChange={setShowPromoModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPromo ? 'Edit Promotion' : 'Create New Promotion'}</DialogTitle>
            <DialogDescription>Configure details for the marketing campaign.</DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Title</Label>
                <Input 
                  value={promoForm.title} 
                  onChange={e => setPromoForm({...promoForm, title: e.target.value})}
                  placeholder="e.g. Summer Sale" 
                />
              </div>
              <div>
                <Label>Subtitle</Label>
                <Input 
                  value={promoForm.subtitle} 
                  onChange={e => setPromoForm({...promoForm, subtitle: e.target.value})}
                  placeholder="e.g. 20% off on grooming" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Discount Type</Label>
                <Select 
                  value={promoForm.discountType} 
                  onValueChange={v => setPromoForm({...promoForm, discountType: v})}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="flat">Flat Amount (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Value</Label>
                <Input 
                  type="number"
                  value={promoForm.discountValue} 
                  onChange={e => setPromoForm({...promoForm, discountValue: Number(e.target.value)})}
                />
              </div>
            </div>

            <div>
              <Label>Coupon Code</Label>
              <Input 
                value={promoForm.code} 
                onChange={e => setPromoForm({...promoForm, code: e.target.value.toUpperCase()})}
                placeholder="SUMMER20" 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Target Category</Label>
                <Select 
                  value={promoForm.serviceCategory} 
                  onValueChange={v => setPromoForm({...promoForm, serviceCategory: v})}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {availableRoles.length > 0 ? (
                      availableRoles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))
                    ) : (
                      <>
                        <SelectItem value="veterinarian">Veterinarian</SelectItem>
                        <SelectItem value="groomer">Groomer</SelectItem>
                        <SelectItem value="walker">Walker</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Service Style</Label>
                <Select 
                  value={promoForm.serviceStyle} 
                  onValueChange={v => setPromoForm({...promoForm, serviceStyle: v})}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Styles</SelectItem>
                    <SelectItem value="at_home">Home Visit</SelectItem>
                    <SelectItem value="at_center">Center Visit</SelectItem>
                    <SelectItem value="tele">Tele-Consult</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPromoModal(false)}>Cancel</Button>
            <Button onClick={handleSavePromo} className="bg-[#FF8C42] hover:bg-[#FF7A2E]">Save Promotion</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* SPOTLIGHT MODAL */}
      <Dialog open={spotlightModal} onOpenChange={setSpotlightModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Spotlight</DialogTitle>
            <DialogDescription>Feature a vendor or service on the homepage.</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Vendor</Label>
              <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Search vendors..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {availableVendors.map(v => (
                    <SelectItem key={v.id || v.vendorId} value={v.id || v.vendorId}>
                      {v.businessName || v.fullName} ({v.vendorType})
                    </SelectItem>
                  ))}
                  {availableVendors.length === 0 && (
                    <SelectItem value="none" disabled>No active vendors found</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Spotlight Type</Label>
              <Select value={spotlightType} onValueChange={setSpotlightType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="featured_vendor">Featured Vendor (Top Card)</SelectItem>
                  <SelectItem value="trending_service">Trending Service</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Duration (Days)</Label>
              <Select value={spotlightDuration} onValueChange={setSpotlightDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 Days</SelectItem>
                  <SelectItem value="7">7 Days</SelectItem>
                  <SelectItem value="14">14 Days</SelectItem>
                  <SelectItem value="30">30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSpotlightModal(false)}>Cancel</Button>
            <Button onClick={handleAddSpotlight} className="bg-[#FF8C42] hover:bg-[#FF7A2E]">Add Spotlight</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* COUPONS TAB */}
      {activeTab === 'coupons' && (
        <CouponManagement />
      )}

      {/* ADVANCED TAB */}
      {activeTab === 'advanced' && (
        <AdvancedPromotionsEngine />
      )}
    </div>
  );
}