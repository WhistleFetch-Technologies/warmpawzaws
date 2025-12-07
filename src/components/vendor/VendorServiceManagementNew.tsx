import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save,
  X,
  Search,
  CheckCircle2,
  AlertCircle,
  Filter,
  Info
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface VendorServiceManagementNewProps {
  vendorId: string;
  vendorData: any;
  onBack: () => void;
}

interface ServiceItem {
  id: string; // Catalog ID
  name: string;
  description: string;
  categoryName: string;
  subCategoryName: string;
  duration: number;
  price: number;
  serviceStyles: string[];
  isPlatformManaged: boolean;
  // Vendor specific fields
  isEnabled: boolean;
  customPrice?: number;
  customDuration?: number;
  customDescription?: string;
  publishStatus: 'draft' | 'published' | 'pending_approval';
  isCustomService: boolean;
  isNewService: boolean;
}

export function VendorServiceManagementNew({ vendorId, vendorData, onBack }: VendorServiceManagementNewProps) {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'published' | 'draft'>('all');
  const [selectedStyle, setSelectedStyle] = useState<string>('at_center'); // Default to at_center
  const [allowedStyles, setAllowedStyles] = useState<string[]>([]);
  const [showCustomServiceModal, setShowCustomServiceModal] = useState(false);
  
  // Custom Service Form
  const [customServiceForm, setCustomServiceForm] = useState({
    name: '',
    description: '',
    price: '',
    duration: '30',
    category: 'General'
  });

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    initialize();
  }, [vendorId]);

  const initialize = async () => {
    try {
      setLoading(true);
      
      // 1. Determine allowed styles from role
      const roleId = vendorData?.roleId;
      if (!roleId) {
        console.warn('No roleId found, defaulting styles');
        setAllowedStyles(['at_center', 'at_home', 'tele']);
      } else {
        // Fetch role config to get real allowed styles
        const roleRes = await fetch(`${API_BASE}/config/roles/${roleId}`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        });
        
        if (roleRes.ok) {
          const roleData = await roleRes.json();
          const styles = roleData.role?.serviceStyles || ['at_center'];
          setAllowedStyles(styles);
          // Set active style to first allowed
          if (styles.length > 0) setSelectedStyle(styles[0]);
        }
      }
    } catch (error) {
      console.error('Error initializing:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch services when selected style changes
  useEffect(() => {
    if (selectedStyle && !loading) {
      fetchServices();
    }
  }, [selectedStyle, loading]);

  const fetchServices = async () => {
    try {
      setLoading(true);
      console.log(`📡 Fetching services for style: ${selectedStyle}`);
      
      const response = await fetch(
        `${API_BASE}/vendor/${vendorId}/services/${selectedStyle}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Services loaded:', data.services?.length);
        setServices(data.services || []);
      } else {
        toast.error('Failed to load services');
      }
    } catch (error) {
      console.error('Error loading services:', error);
      toast.error('Network error loading services');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleService = (serviceId: string) => {
    setServices(prev => prev.map(s => 
      s.id === serviceId ? { ...s, isEnabled: !s.isEnabled } : s
    ));
  };

  const handleUpdateService = (serviceId: string, field: string, value: any) => {
    setServices(prev => prev.map(s => 
      s.id === serviceId ? { ...s, [field]: value } : s
    ));
  };

  const handleSaveChanges = async () => {
    try {
      setSaving(true);
      
      // 1. Prepare payload - map services to expected format
      const payload = {
        serviceStyle: selectedStyle,
        services: services.map(s => ({
          serviceId: s.id,
          serviceName: s.name,
          isEnabled: s.isEnabled,
          customPrice: s.customPrice || s.price, // Ensure price is sent
          customDuration: s.customDuration || s.duration,
          customDescription: s.customDescription,
          isCustomService: s.isCustomService,
          isNewService: s.isNewService,
          // Pass through catalog fields for context
          categoryName: s.categoryName,
          subCategoryName: s.subCategoryName
        }))
      };

      console.log('📤 Saving services configuration:', payload);

      // 2. Save Configuration
      const configRes = await fetch(
        `${API_BASE}/vendor/${vendorId}/services/configure`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify(payload)
        }
      );

      if (!configRes.ok) throw new Error('Failed to save configuration');

      // 3. Publish (Activate)
      const publishRes = await fetch(
        `${API_BASE}/vendor/${vendorId}/services/publish`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({ serviceStyle: selectedStyle })
        }
      );

      if (!publishRes.ok) throw new Error('Failed to publish services');

      const result = await publishRes.json();
      
      toast.success(
        `Successfully published ${result.publishedCount} services! ` + 
        (result.pendingCount > 0 ? `(${result.pendingCount} pending approval)` : '')
      );
      
      // Refresh data
      await fetchServices();

    } catch (error) {
      console.error('Error saving services:', error);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCustomService = () => {
    if (!customServiceForm.name || !customServiceForm.price) {
      toast.error('Name and Price are required');
      return;
    }

    const newService: ServiceItem = {
      id: `custom_${Date.now()}`,
      name: customServiceForm.name,
      description: customServiceForm.description,
      categoryName: customServiceForm.category,
      subCategoryName: 'Custom',
      duration: parseInt(customServiceForm.duration),
      price: parseFloat(customServiceForm.price),
      serviceStyles: [selectedStyle],
      isPlatformManaged: false,
      isEnabled: true,
      customPrice: parseFloat(customServiceForm.price),
      customDuration: parseInt(customServiceForm.duration),
      customDescription: customServiceForm.description,
      publishStatus: 'draft',
      isCustomService: true,
      isNewService: true
    };

    setServices(prev => [newService, ...prev]);
    setShowCustomServiceModal(false);
    
    // Reset form
    setCustomServiceForm({
      name: '',
      description: '',
      price: '',
      duration: '30',
      category: 'General'
    });
    
    toast.success('Custom service added to list. Click "Publish Changes" to save.');
  };

  // Filter services
  const filteredServices = services.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.categoryName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === 'published') return matchesSearch && s.publishStatus === 'published' && s.isEnabled;
    if (activeTab === 'draft') return matchesSearch && (s.publishStatus === 'draft' || !s.isEnabled);
    return matchesSearch;
  });

  const getStyleLabel = (style: string) => {
    switch(style) {
      case 'at_center': return 'At Clinic/Center';
      case 'at_home': return 'Home Visit';
      case 'tele': return 'Tele-Consultation';
      default: return style;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div>
            <h1 className="font-bold text-lg text-gray-900">Service Catalog</h1>
            <p className="text-xs text-gray-500">Select & publish your services</p>
          </div>
        </div>

        {/* Style Selector */}
        {allowedStyles.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mb-2">
            {allowedStyles.map(style => (
              <button
                key={style}
                onClick={() => setSelectedStyle(style)}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedStyle === style 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {getStyleLabel(style)}
              </button>
            ))}
          </div>
        )}

        {/* Search & Filter */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-gray-50 border-gray-200"
          />
        </div>
      </div>

      {/* Service List */}
      <div className="flex-1 p-4 overflow-y-auto pb-24">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-gray-500 text-sm">Loading catalog...</p>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Info className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-gray-900 font-medium">No services found</h3>
            <p className="text-gray-500 text-sm mt-1">Try adjusting your search or filters.</p>
            <Button 
              onClick={() => setShowCustomServiceModal(true)}
              variant="outline" 
              className="mt-4 border-blue-200 text-blue-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Custom Service
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredServices.map((service) => (
              <div 
                key={service.id}
                className={`bg-white border rounded-xl p-4 transition-all ${
                  service.isEnabled 
                    ? 'border-blue-200 shadow-sm' 
                    : 'border-gray-200 opacity-80 hover:opacity-100'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox 
                    checked={service.isEnabled}
                    onCheckedChange={() => handleToggleService(service.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-semibold text-gray-900">{service.name}</h3>
                      {service.publishStatus === 'published' && (
                        <Badge variant="secondary" className="bg-green-100 text-green-700 text-[10px] px-1.5">Published</Badge>
                      )}
                      {service.publishStatus === 'pending_approval' && (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 text-[10px] px-1.5">Pending</Badge>
                      )}
                    </div>
                    
                    <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                      {service.description || 'No description available'}
                    </p>

                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-[10px] text-gray-500 uppercase font-medium">Price (₹)</label>
                        <Input 
                          type="number"
                          value={service.customPrice || service.price || ''}
                          onChange={(e) => handleUpdateService(service.id, 'customPrice', parseFloat(e.target.value))}
                          className="h-8 text-sm mt-0.5"
                          placeholder="0.00"
                          disabled={!service.isEnabled}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-gray-500 uppercase font-medium">Duration (min)</label>
                        <Input 
                          type="number"
                          value={service.customDuration || service.duration || ''}
                          onChange={(e) => handleUpdateService(service.id, 'customDuration', parseInt(e.target.value))}
                          className="h-8 text-sm mt-0.5"
                          placeholder="30"
                          disabled={!service.isEnabled}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            <Button 
              onClick={() => setShowCustomServiceModal(true)}
              variant="ghost" 
              className="w-full border-2 border-dashed border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 h-12"
            >
              <Plus className="w-4 h-4 mr-2" />
              Can't find a service? Add Custom
            </Button>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="bg-white border-t border-gray-200 p-4 fixed bottom-0 w-full max-w-[430px] z-20">
        <div className="flex gap-3">
          <div className="flex-1">
            <p className="text-xs text-gray-500">
              Selected: <span className="font-bold text-gray-900">{services.filter(s => s.isEnabled).length}</span>
            </p>
            <p className="text-[10px] text-gray-400">
              {services.filter(s => s.isEnabled && s.publishStatus !== 'published').length} changes pending • Updates will apply to all staff
            </p>
          </div>
          <Button 
            onClick={handleSaveChanges} 
            disabled={saving || services.every(s => !s.isEnabled)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6"
          >
            {saving ? 'Publishing...' : 'Publish Changes'}
          </Button>
        </div>
      </div>

      {/* Custom Service Modal */}
      <Dialog open={showCustomServiceModal} onOpenChange={setShowCustomServiceModal}>
        <DialogContent className="max-w-[350px]">
          <DialogHeader>
            <DialogTitle>Add Custom Service</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium">Service Name</label>
              <Input 
                value={customServiceForm.name}
                onChange={(e) => setCustomServiceForm({...customServiceForm, name: e.target.value})}
                placeholder="e.g. Advanced Dental Surgery"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Price (₹)</label>
              <Input 
                type="number"
                value={customServiceForm.price}
                onChange={(e) => setCustomServiceForm({...customServiceForm, price: e.target.value})}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Duration (min)</label>
              <Input 
                type="number"
                value={customServiceForm.duration}
                onChange={(e) => setCustomServiceForm({...customServiceForm, duration: e.target.value})}
                placeholder="30"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input 
                value={customServiceForm.description}
                onChange={(e) => setCustomServiceForm({...customServiceForm, description: e.target.value})}
                placeholder="Brief description of service..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCustomServiceModal(false)}>Cancel</Button>
            <Button onClick={handleAddCustomService} className="bg-blue-600 text-white">Add to List</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}