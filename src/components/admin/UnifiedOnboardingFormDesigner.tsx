/**
 * ============================================================================
 * UNIFIED ONBOARDING FORM DESIGNER
 * ============================================================================
 * 
 * Clean, comprehensive form designer for onboarding forms
 * - Full CRUD operations
 * - Drag & drop field ordering
 * - Real-time preview
 * - Version management
 * - Publish/Archive functionality
 * 
 * Date: 2025-12-25
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner';
import { 
  Save, 
  Eye, 
  Plus, 
  Trash2, 
  Edit2, 
  ArrowUp, 
  ArrowDown,
  Building,
  MapPin,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Publish,
  Archive
} from 'lucide-react';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

// Types
interface FieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  customMessage?: string;
}

interface SelectOption {
  value: string;
  label: string;
}

interface FormField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'tel' | 'textarea' | 'select' | 'multiselect' | 'checkbox' | 'radio' | 'date' | 'file' | 'map_pin';
  section: string;
  placeholder?: string;
  helpText?: string;
  validation?: FieldValidation;
  options?: SelectOption[];
  requiresDocument?: boolean;
  documentType?: string;
  documentLabel?: string;
  acceptedFileTypes?: string[];
  maxFileSize?: number;
  order: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface FormSection {
  id: string;
  name: string;
  title: string;
  description?: string;
  icon?: string;
  order: number;
  isActive: boolean;
  fields: FormField[];
}

interface OnboardingForm {
  id: string;
  roleId: string;
  roleName: string;
  version: number;
  status: 'draft' | 'active' | 'archived';
  sections: FormSection[];
  documentSections?: FormSection[];
  metadata: {
    createdBy: string;
    createdAt: string;
    lastModifiedBy?: string;
    lastModifiedAt?: string;
    publishedAt?: string;
    publishedBy?: string;
  };
  notes?: string;
}

interface Role {
  id: string;
  name: string;
  displayName: string;
}

export function UnifiedOnboardingFormDesigner() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [form, setForm] = useState<OnboardingForm | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  
  // Field/Section editing
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [editingSection, setEditingSection] = useState<FormSection | null>(null);
  const [showFieldDialog, setShowFieldDialog] = useState(false);
  const [showSectionDialog, setShowSectionDialog] = useState(false);
  const [currentSectionId, setCurrentSectionId] = useState<string>('');
  
  // Field form state
  const [fieldForm, setFieldForm] = useState<Partial<FormField>>({
    name: '',
    label: '',
    type: 'text',
    section: 'business_information',
    placeholder: '',
    helpText: '',
    validation: { required: false },
    isActive: true,
    order: 0
  });

  // Fetch roles
  useEffect(() => {
    fetchRoles();
  }, []);

  // Fetch form when role changes
  useEffect(() => {
    if (selectedRole) {
      fetchForm(selectedRole);
    }
  }, [selectedRole]);

  const fetchRoles = async () => {
    try {
      const response = await fetch(`${API_BASE}/config/roles`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const rolesArray = data.roles || data.data?.roles || [];
        setRoles(rolesArray);
        if (rolesArray.length > 0 && !selectedRole) {
          setSelectedRole(rolesArray[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch roles:', error);
      toast.error('Failed to load roles');
    }
  };

  const fetchForm = async (roleId: string) => {
    try {
      setLoading(true);
      const timestamp = Date.now();
      const response = await fetch(`${API_BASE}/admin/onboarding-forms/${roleId}?t=${timestamp}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setForm(data.form);
        setUnsavedChanges(false);
        toast.success('Form loaded successfully');
      } else {
        toast.error('Failed to load form');
      }
    } catch (error) {
      console.error('Failed to fetch form:', error);
      toast.error('Failed to load form');
    } finally {
      setLoading(false);
    }
  };

  const saveForm = async (status: 'draft' | 'active' = 'draft') => {
    if (!form) return;
    
    try {
      setSaving(true);
      const response = await fetch(`${API_BASE}/admin/onboarding-forms/${form.roleId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sections: form.sections,
          status,
          notes: form.notes
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setForm(data.form);
        setUnsavedChanges(false);
        toast.success(data.message || 'Form saved successfully');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save form');
      }
    } catch (error) {
      console.error('Failed to save form:', error);
      toast.error('Failed to save form');
    } finally {
      setSaving(false);
    }
  };

  const publishForm = async () => {
    if (!form) return;
    
    try {
      setSaving(true);
      const response = await fetch(`${API_BASE}/admin/onboarding-forms/${form.roleId}/publish`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setForm(data.form);
        setUnsavedChanges(false);
        toast.success('Form published successfully');
      } else {
        toast.error('Failed to publish form');
      }
    } catch (error) {
      console.error('Failed to publish form:', error);
      toast.error('Failed to publish form');
    } finally {
      setSaving(false);
    }
  };

  const addField = (sectionId: string) => {
    if (!form) return;
    
    const section = form.sections.find(s => s.id === sectionId);
    if (!section) return;
    
    const newField: FormField = {
      id: `field_${Date.now()}`,
      name: `field_${section.fields.length + 1}`,
      label: 'New Field',
      type: 'text',
      section: sectionId,
      placeholder: '',
      validation: { required: false },
      order: section.fields.length,
      isActive: true
    };
    
    setCurrentSectionId(sectionId);
    setFieldForm(newField);
    setEditingField(newField);
    setShowFieldDialog(true);
  };

  const updateField = (sectionId: string, fieldId: string, updates: Partial<FormField>) => {
    if (!form) return;
    
    setForm({
      ...form,
      sections: form.sections.map(section => {
        if (section.id !== sectionId) return section;
        return {
          ...section,
          fields: section.fields.map(field => {
            if (field.id !== fieldId) return field;
            return { ...field, ...updates, updatedAt: new Date().toISOString() };
          })
        };
      })
    });
    setUnsavedChanges(true);
  };

  const deleteField = (sectionId: string, fieldId: string) => {
    if (!form) return;
    
    if (!confirm('Are you sure you want to delete this field?')) return;
    
    setForm({
      ...form,
      sections: form.sections.map(section => {
        if (section.id !== sectionId) return section;
        return {
          ...section,
          fields: section.fields.filter(f => f.id !== fieldId)
        };
      })
    });
    setUnsavedChanges(true);
  };

  const saveField = () => {
    if (!editingField || !form) return;
    
    const section = form.sections.find(s => s.id === currentSectionId || s.id === editingField.section);
    if (!section) return;
    
    if (editingField.id.startsWith('field_')) {
      // New field
      setForm({
        ...form,
        sections: form.sections.map(s => {
          if (s.id !== section.id) return s;
          return {
            ...s,
            fields: [...s.fields, { ...editingField, id: `field_${Date.now()}` }]
          };
        })
      });
    } else {
      // Update existing
      updateField(section.id, editingField.id, editingField);
    }
    
    setShowFieldDialog(false);
    setEditingField(null);
    setUnsavedChanges(true);
  };

  if (loading && !form) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#FF8C42]" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Onboarding Form Designer</h1>
          <p className="text-gray-600 mt-1">Design and manage vendor onboarding forms</p>
        </div>
        
        <div className="flex gap-3">
          {form && (
            <>
              <Button
                variant="outline"
                onClick={() => saveForm('draft')}
                disabled={!unsavedChanges || saving}
              >
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Draft
              </Button>
              <Button
                onClick={publishForm}
                disabled={saving || form.status === 'active'}
                className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
              >
                <Publish className="w-4 h-4 mr-2" />
                Publish
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Role Selection */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-xs">
              <Label>Select Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role..." />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(role => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.displayName || role.name} ({role.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {form && (
              <div className="flex-1 flex items-center gap-4">
                <Badge variant={form.status === 'active' ? 'default' : 'secondary'}>
                  {form.status}
                </Badge>
                <span className="text-sm text-gray-500">Version {form.version}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Form Designer */}
      {form && (
        <Tabs defaultValue="designer" className="w-full">
          <TabsList>
            <TabsTrigger value="designer">Designer</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="designer" className="space-y-6 mt-6">
            {form.sections.map((section) => (
              <Card key={section.id} className={section.isActive ? '' : 'opacity-50'}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-50 rounded-lg">
                      {section.icon === 'Building' && <Building className="w-5 h-5 text-orange-500" />}
                      {section.icon === 'MapPin' && <MapPin className="w-5 h-5 text-orange-500" />}
                      {section.icon === 'FileText' && <FileText className="w-5 h-5 text-orange-500" />}
                    </div>
                    <div>
                      <CardTitle>{section.title}</CardTitle>
                      <CardDescription>{section.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={section.isActive}
                      onCheckedChange={(checked) => {
                        setForm({
                          ...form,
                          sections: form.sections.map(s =>
                            s.id === section.id ? { ...s, isActive: checked } : s
                          )
                        });
                        setUnsavedChanges(true);
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addField(section.id)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Field
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {section.fields
                      .sort((a, b) => a.order - b.order)
                      .map((field) => (
                        <div
                          key={field.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{field.label}</span>
                              {field.validation?.required && (
                                <span className="text-red-500">*</span>
                              )}
                              <Badge variant="outline" className="text-xs">
                                {field.type}
                              </Badge>
                              {!field.isActive && (
                                <Badge variant="secondary" className="text-xs">
                                  Hidden
                                </Badge>
                              )}
                            </div>
                            <span className="text-sm text-gray-500">{field.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingField(field);
                                setCurrentSectionId(section.id);
                                setFieldForm(field);
                                setShowFieldDialog(true);
                              }}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteField(section.id, field.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                            <Switch
                              checked={field.isActive}
                              onCheckedChange={(checked) =>
                                updateField(section.id, field.id, { isActive: checked })
                              }
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="preview" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Form Preview</CardTitle>
                <CardDescription>How the form will appear to vendors</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {form.sections
                    .filter(s => s.isActive)
                    .map((section) => (
                      <div key={section.id} className="space-y-4">
                        <h3 className="text-lg font-semibold">{section.title}</h3>
                        <p className="text-sm text-gray-600">{section.description}</p>
                        <div className="space-y-3">
                          {section.fields
                            .filter(f => f.isActive)
                            .sort((a, b) => a.order - b.order)
                            .map((field) => (
                              <div key={field.id} className="space-y-2">
                                <Label>
                                  {field.label}
                                  {field.validation?.required && (
                                    <span className="text-red-500 ml-1">*</span>
                                  )}
                                </Label>
                                <Input
                                  placeholder={field.placeholder}
                                  disabled
                                  className="bg-gray-50"
                                />
                                {field.helpText && (
                                  <p className="text-xs text-gray-500">{field.helpText}</p>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Field Edit Dialog */}
      <Dialog open={showFieldDialog} onOpenChange={setShowFieldDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Field</DialogTitle>
            <DialogDescription>Configure field properties and validation</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Label *</Label>
                <Input
                  value={fieldForm.label || ''}
                  onChange={(e) => setFieldForm({ ...fieldForm, label: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Field Name (Key) *</Label>
                <Input
                  value={fieldForm.name || ''}
                  onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })}
                  className="font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select
                  value={fieldForm.type}
                  onValueChange={(value: any) => setFieldForm({ ...fieldForm, type: value })}
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
                    <SelectItem value="select">Dropdown</SelectItem>
                    <SelectItem value="multiselect">Multi-Select</SelectItem>
                    <SelectItem value="checkbox">Checkbox</SelectItem>
                    <SelectItem value="radio">Radio</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="file">File Upload</SelectItem>
                    <SelectItem value="map_pin">Map Location</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Placeholder</Label>
                <Input
                  value={fieldForm.placeholder || ''}
                  onChange={(e) => setFieldForm({ ...fieldForm, placeholder: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Help Text</Label>
              <Textarea
                value={fieldForm.helpText || ''}
                onChange={(e) => setFieldForm({ ...fieldForm, helpText: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between border rounded-lg p-3">
              <Label>Required Field</Label>
              <Switch
                checked={fieldForm.validation?.required || false}
                onCheckedChange={(checked) =>
                  setFieldForm({
                    ...fieldForm,
                    validation: { ...fieldForm.validation, required: checked }
                  })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFieldDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveField} className="bg-[#FF8C42]">
              Save Field
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

