import { useState, useEffect, useRef } from 'react';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Badge } from '../../ui/badge';
import { Switch } from '../../ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../ui/accordion';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { Loader2, Plus, Trash2, Save, RefreshCw, Eye, Code, CheckCircle2, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../ui/dialog';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

interface Role {
  id: string;
  name: string;
  type: string;
}

interface Field {
  id: string;
  name: string;
  label: string;
  type: string;
  section: string;
  placeholder?: string;
  helpText?: string;
  validation?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
  };
  options?: { label: string; value: string }[];
  isActive: boolean;
  order: number;
}

interface Section {
  id: string;
  name: string;
  title: string;
  description: string;
  icon: string;
  order: number;
  isActive: boolean;
  fields: Field[];
}

interface FormConfig {
  id: string;
  roleId: string;
  roleName: string;
  version: number;
  status: string;
  sections: Section[];
  documentSections?: Section[]; // Optional, usually merged into sections now
}

export function OnboardingDesigner() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [formConfig, setFormConfig] = useState<FormConfig | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [activeTab, setActiveTab] = useState('designer');
  
  // Edit Dialog State
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);

  // ✅ FIX: Refs for cleanup and mounted state tracking
  const isMountedRef = useRef(true);
  const refetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchRoles();
    
    // ✅ FIX: Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      if (refetchTimeoutRef.current) {
        clearTimeout(refetchTimeoutRef.current);
        refetchTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (selectedRole) {
      fetchFormConfig(selectedRole);
    } else {
      setFormConfig(null);
    }
  }, [selectedRole]);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/config/roles`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      console.log('[ONBOARDING DESIGNER] Roles response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('[ONBOARDING DESIGNER] Roles data:', data);
        console.log('[ONBOARDING DESIGNER] Roles array:', data.roles);
        // ✅ FIX: Handle both response formats
        const rolesArray = data.roles || data.data?.roles || [];
        console.log('[ONBOARDING DESIGNER] Setting roles:', rolesArray.length);
        setRoles(rolesArray);
      } else {
        const errorText = await response.text();
        console.error('[ONBOARDING DESIGNER] Error fetching roles:', response.status, errorText);
        toast.error(`Failed to load roles: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to fetch roles:', error);
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const fetchFormConfig = async (roleId: string): Promise<void> => {
    // ✅ FIX Bug 2 & 3: Check if component is mounted before setting state
    if (!isMountedRef.current) {
      return Promise.resolve();
    }
    
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/vendor/onboarding-form/${roleId}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      
      // ✅ FIX Bug 2 & 3: Check again after async operation
      if (!isMountedRef.current) {
        return Promise.resolve();
      }
      
      if (response.ok) {
        const data = await response.json();
        // Merge documentSections into sections if separated, or just use config as is
        // Our seed logic merges them, but let's be safe
        const config = data.config || data.form;
        
        if (config) {
            // Ensure sections is an array
            if (!config.sections) config.sections = [];
            
            // ✅ FIX Bug 2 & 3: Final check before setting state
            if (isMountedRef.current) {
              setFormConfig(config);
              setUnsavedChanges(false);
            }
        }
      }
    } catch (error) {
      // ✅ FIX Bug 2 & 3: Only show error if component is still mounted
      if (isMountedRef.current) {
        console.error('Failed to fetch form config:', error);
        toast.error('Failed to load form configuration');
      }
    } finally {
      // ✅ FIX Bug 2 & 3: Only update loading state if component is still mounted
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleSeedRoles = async (missingOnly: boolean = true) => {
    try {
      setSeeding(true);
      const response = await fetch(`${API_BASE}/admin/roles/seed?missingOnly=${missingOnly}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || 'Roles seeded successfully');
        fetchRoles(); // Refresh list
        if (selectedRole) fetchFormConfig(selectedRole); // Refresh current form
      } else {
        toast.error('Failed to seed roles');
      }
    } catch (error) {
      toast.error('Error communicating with server');
    } finally {
      setSeeding(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!formConfig) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/admin/role-config/save`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            ...formConfig,
            version: (formConfig.version || 0) + 1
        })
      });

      if (response.ok) {
        const data = await response.json();
        const deletedCount = data.deletedFields?.length || 0;
        const isVerified = data.verified === true;
        
        if (deletedCount > 0) {
          toast.success(`Form saved! ${deletedCount} field(s) deleted from database.`);
        } else {
          toast.success('Form configuration saved successfully');
        }
        
        setUnsavedChanges(false);
        
        // ✅ FIX Bug 1, 2, 3: Smart refetch based on verification status with proper cleanup
        // Clear any existing timeout
        if (refetchTimeoutRef.current) {
          clearTimeout(refetchTimeoutRef.current);
          refetchTimeoutRef.current = null;
        }
        
        // If backend verified the save, fetch immediately
        // Otherwise, use a retry mechanism with exponential backoff
        const refetchForm = () => {
          // ✅ FIX Bug 2 & 3: Check if component is still mounted before setting state
          if (!isMountedRef.current) {
            return;
          }
          
          fetchFormConfig(formConfig.roleId);
        };
        
        if (isVerified) {
          // ✅ FIX Bug 1: Backend verified the save - fetch immediately (no delay needed)
          refetchForm();
        } else {
          // ✅ FIX Bug 1: Backend didn't verify - use smart retry with exponential backoff
          // Start with 200ms, then 500ms, then 1000ms (instead of fixed 500ms)
          let retryCount = 0;
          const maxRetries = 3;
          const delays = [200, 500, 1000];
          
          const scheduleRetry = () => {
            // ✅ FIX Bug 2 & 3: Check if component unmounted before scheduling
            if (!isMountedRef.current) {
              return;
            }
            
            if (retryCount >= maxRetries) {
              // Final attempt
              if (isMountedRef.current) {
                refetchForm();
              }
              return;
            }
            
            const delay = delays[retryCount] || 1000;
            refetchTimeoutRef.current = setTimeout(() => {
              // ✅ FIX Bug 2 & 3: Check again before executing
              if (!isMountedRef.current) {
                return;
              }
              
              retryCount++;
              // Try fetching - if successful, stop retrying
              fetchFormConfig(formConfig.roleId)
                .then(() => {
                  // Success - clear any pending retries
                  if (refetchTimeoutRef.current) {
                    clearTimeout(refetchTimeoutRef.current);
                    refetchTimeoutRef.current = null;
                  }
                })
                .catch(() => {
                  // Failed - schedule next retry if still mounted
                  if (isMountedRef.current) {
                    scheduleRetry();
                  }
                });
            }, delay);
          };
          
          scheduleRetry();
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(`Failed to save: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      toast.error('Error saving configuration');
    } finally {
      setLoading(false);
    }
  };

  // --- Form Manipulation Handlers ---

  const updateField = (sectionId: string, fieldId: string, updates: Partial<Field>) => {
    if (!formConfig) return;
    
    const newSections = formConfig.sections.map(section => {
        if (section.id !== sectionId) return section;
        
        return {
            ...section,
            fields: section.fields.map(field => {
                if (field.id !== fieldId) return field;
                return { ...field, ...updates };
            })
        };
    });

    setFormConfig({ ...formConfig, sections: newSections });
    setUnsavedChanges(true);
  };

  const toggleFieldActive = (sectionId: string, fieldId: string, currentStatus: boolean) => {
    updateField(sectionId, fieldId, { isActive: !currentStatus });
  };

  const deleteField = (sectionId: string, fieldId: string) => {
    if (!formConfig) return;
    
    const newSections = formConfig.sections.map(section => {
        if (section.id !== sectionId) return section;
        
        return {
            ...section,
            fields: section.fields.filter(field => field.id !== fieldId)
        };
    });
    
    setFormConfig({ ...formConfig, sections: newSections });
    setUnsavedChanges(true);
  };

  const toggleSectionActive = (sectionId: string, currentStatus: boolean) => {
    if (!formConfig) return;
    
    const newSections = formConfig.sections.map(section => {
        if (section.id !== sectionId) return section;
        return { ...section, isActive: !currentStatus };
    });
    
    setFormConfig({ ...formConfig, sections: newSections });
    setUnsavedChanges(true);
  };

  const openEditDialog = (sectionId: string, field: Field) => {
    setEditingSectionId(sectionId);
    setEditingField({ ...field });
    setIsEditDialogOpen(true);
  };

  const saveFieldEdits = () => {
    if (editingField && editingSectionId) {
        updateField(editingSectionId, editingField.id, editingField);
        setIsEditDialogOpen(false);
        setEditingField(null);
        setEditingSectionId(null);
    }
  };

  if (loading && !formConfig) {
      return (
          <div className="flex h-screen items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#FF8C42]" />
          </div>
      );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Onboarding Form Designer</h1>
          <p className="text-gray-600 mt-1">Configure dynamic forms for vendor roles</p>
        </div>
        
        <div className="flex gap-3">
           <Button 
            variant="outline" 
            onClick={() => handleSeedRoles(true)} 
            disabled={seeding}
            className="border-orange-200 hover:bg-orange-50 text-orange-700"
           >
             {seeding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
             Seed Missing Roles
           </Button>
           <Button 
            variant="outline" 
            onClick={() => handleSeedRoles(false)} 
            disabled={seeding}
           >
             <RefreshCw className={`w-4 h-4 mr-2 ${seeding ? 'animate-spin' : ''}`} />
             Reset All Roles
           </Button>
        </div>
      </div>

      {/* Role Selection */}
      <Card className="border-2 border-gray-100">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-xs">
              <Label className="mb-2 block">Select Role to Configure</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a vendor role..." />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(role => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name} ({role.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedRole && formConfig && (
                <div className="flex-1 flex items-end justify-end h-full pt-6">
                    <Button 
                        onClick={handleSaveConfig} 
                        disabled={!unsavedChanges || loading}
                        className={`${unsavedChanges ? 'bg-[#FF8C42] hover:bg-[#FF7A2E]' : 'bg-gray-400'}`}
                    >
                        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        {unsavedChanges ? 'Save Changes' : 'Saved'}
                    </Button>
                </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Designer Area */}
      {selectedRole && formConfig ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="designer" className="flex items-center gap-2">
                <Eye className="w-4 h-4" /> Designer
            </TabsTrigger>
            <TabsTrigger value="json" className="flex items-center gap-2">
                <Code className="w-4 h-4" /> JSON Source
            </TabsTrigger>
          </TabsList>

          <TabsContent value="designer" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Canvas / Form Preview & Edit */}
                <div className="lg:col-span-2 space-y-6">
                    {formConfig.sections.map((section) => (
                        <Card key={section.id} className={`border-2 transition-colors ${section.isActive ? 'border-gray-200' : 'border-gray-100 bg-gray-50 opacity-75'}`}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-orange-50 rounded-lg text-orange-500">
                                        {/* Simple icon map fallback */}
                                        {section.icon === 'Building' ? '🏢' : section.icon === 'MapPin' ? '📍' : section.icon === 'FileText' ? '📄' : '📝'}
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg font-bold">{section.title}</CardTitle>
                                        <CardDescription>{section.description}</CardDescription>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Switch 
                                        checked={section.isActive} 
                                        onCheckedChange={(checked) => toggleSectionActive(section.id, checked)} 
                                    />
                                </div>
                            </CardHeader>
                            {section.isActive && (
                                <CardContent className="pt-4 space-y-4">
                                    {section.fields.sort((a, b) => a.order - b.order).map((field) => (
                                        <div key={field.id} className="flex items-center gap-4 p-3 bg-white border border-gray-100 rounded-xl hover:border-orange-200 transition-colors group">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-medium text-sm text-gray-900">{field.label}</span>
                                                    {field.validation?.required && <span className="text-red-500 text-xs">*</span>}
                                                    {!field.isActive && <Badge variant="secondary" className="text-xs">Hidden</Badge>}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                                    <Badge variant="outline" className="text-[10px] uppercase">{field.type}</Badge>
                                                    <span>{field.name}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                <Button size="sm" variant="ghost" onClick={() => openEditDialog(section.id, field)}>Edit</Button>
                                                <Button 
                                                    size="sm" 
                                                    variant="ghost" 
                                                    onClick={() => {
                                                        if (confirm(`Are you sure you want to delete "${field.label}"? This action cannot be undone.`)) {
                                                            deleteField(section.id, field.id);
                                                        }
                                                    }}
                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                                <Switch 
                                                    checked={field.isActive} 
                                                    onCheckedChange={(checked) => toggleFieldActive(section.id, field.id, checked)} 
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            )}
                        </Card>
                    ))}
                </div>

                {/* Sidebar Information */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Role Metadata</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div className="flex justify-between py-2 border-b">
                                <span className="text-gray-500">Role ID</span>
                                <span className="font-mono font-medium">{formConfig.roleId}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b">
                                <span className="text-gray-500">Version</span>
                                <span className="font-medium">{formConfig.version}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b">
                                <span className="text-gray-500">Status</span>
                                <Badge className={formConfig.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}>
                                    {formConfig.status}
                                </Badge>
                            </div>
                            
                            <div className="pt-4">
                                <h4 className="font-medium mb-2">Capability Flags</h4>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-xs bg-gray-50 p-2 rounded">
                                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                                        <span>Supports Map Pinning</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs bg-gray-50 p-2 rounded">
                                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                                        <span>Supports File Uploads</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
          </TabsContent>

          <TabsContent value="json">
            <Card>
                <CardContent className="p-0">
                    <pre className="bg-slate-950 text-slate-50 p-6 rounded-lg overflow-auto max-h-[600px] text-xs font-mono">
                        {JSON.stringify(formConfig, null, 2)}
                    </pre>
                </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No Role Selected</h3>
          <p className="text-gray-500 mt-1">Select a role from the dropdown to start designing the onboarding form.</p>
        </div>
      )}

      {/* Field Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
            <DialogHeader>
                <DialogTitle>Edit Field</DialogTitle>
                <DialogDescription>Modify field properties and validation rules.</DialogDescription>
            </DialogHeader>
            
            {editingField && (
                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Label</Label>
                            <Input 
                                value={editingField.label} 
                                onChange={(e) => setEditingField({...editingField, label: e.target.value})} 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Field Name (Key)</Label>
                            <Input 
                                value={editingField.name} 
                                disabled
                                className="bg-gray-100 font-mono"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Placeholder</Label>
                        <Input 
                            value={editingField.placeholder || ''} 
                            onChange={(e) => setEditingField({...editingField, placeholder: e.target.value})} 
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Help Text</Label>
                        <Input 
                            value={editingField.helpText || ''} 
                            onChange={(e) => setEditingField({...editingField, helpText: e.target.value})} 
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Type</Label>
                            <Select 
                                value={editingField.type} 
                                onValueChange={(val) => setEditingField({...editingField, type: val})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="text">Text</SelectItem>
                                    <SelectItem value="number">Number</SelectItem>
                                    <SelectItem value="email">Email</SelectItem>
                                    <SelectItem value="tel">Phone</SelectItem>
                                    <SelectItem value="textarea">Text Area</SelectItem>
                                    <SelectItem value="file">File Upload</SelectItem>
                                    <SelectItem value="map_pin">Map Location</SelectItem>
                                    <SelectItem value="select">Dropdown</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="flex items-center justify-between border rounded-lg p-3 mt-6">
                            <Label className="cursor-pointer" htmlFor="req-switch">Required?</Label>
                            <Switch 
                                id="req-switch"
                                checked={editingField.validation?.required}
                                onCheckedChange={(checked) => setEditingField({
                                    ...editingField, 
                                    validation: { ...editingField.validation, required: checked }
                                })}
                            />
                        </div>
                    </div>
                </div>
            )}

            <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                <Button onClick={saveFieldEdits} className="bg-[#FF8C42]">Save Changes</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
