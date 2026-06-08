'use client';

import React, { useState, useEffect, useCallback } from 'react';
import * as LucideIcons from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { CatalogActiveSwitch } from './CatalogActiveSwitch';

interface SymptomItem {
  id: string;
  symptomName: string;
  symptomDisplayName: string;
  symptomKeywords: string[];
  displayOrder?: number;
  isActive?: boolean;
}

// ============================================================================
// ICON MAPPING - Direct reference to Lucide icons
// ============================================================================

const getIconComponent = (iconName: string | null | undefined): React.ComponentType<any> => {
  if (!iconName) return LucideIcons.Folder;
  
  // Try to get the icon from lucide-react
  const icon = (LucideIcons as any)[iconName];
  if (icon) return icon;
  
  // Fallback to Folder
  return LucideIcons.Folder;
};

// Available icons for selection
const ICON_OPTIONS = [
  'Stethoscope', 'Scissors', 'ShoppingBag', 'GraduationCap', 'Bike', 'Home', 'Heart', 'Wheat',
  'Coffee', 'Camera', 'Shield', 'PawPrint', 'Phone', 'Truck', 'Sparkles', 'Sun', 'Pill',
  'FlaskConical', 'Package', 'Eye', 'Activity', 'FileText', 'Siren', 'Hand', 'Brush', 'Dog',
  'Bath', 'Trophy', 'AlertTriangle', 'Footprints', 'Mountain', 'Bone', 'Hotel', 'Star',
  'Frown', 'Volume2', 'Ghost', 'Bomb', 'Brain', 'Folder'
];

// Color options
const COLOR_OPTIONS = [
  { value: 'text-blue-500', label: 'Blue', bg: 'bg-blue-100' },
  { value: 'text-blue-600', label: 'Blue Dark', bg: 'bg-blue-100' },
  { value: 'text-green-500', label: 'Green', bg: 'bg-green-100' },
  { value: 'text-orange-500', label: 'Orange', bg: 'bg-orange-100' },
  { value: 'text-red-500', label: 'Red', bg: 'bg-red-100' },
  { value: 'text-purple-500', label: 'Purple', bg: 'bg-purple-100' },
  { value: 'text-pink-500', label: 'Pink', bg: 'bg-pink-100' },
  { value: 'text-amber-500', label: 'Amber', bg: 'bg-amber-100' },
  { value: 'text-teal-500', label: 'Teal', bg: 'bg-teal-100' },
  { value: 'text-cyan-500', label: 'Cyan', bg: 'bg-cyan-100' },
  { value: 'text-indigo-500', label: 'Indigo', bg: 'bg-indigo-100' },
  { value: 'text-gray-500', label: 'Gray', bg: 'bg-gray-100' },
];

// Get background color for icon
const getIconBg = (color: string | null | undefined): string => {
  if (!color) return 'bg-gray-100';
  const mapping: Record<string, string> = {
    'text-blue-500': 'bg-blue-100', 'text-blue-600': 'bg-blue-100',
    'text-green-500': 'bg-green-100', 'text-green-600': 'bg-green-100',
    'text-orange-500': 'bg-orange-100', 'text-red-500': 'bg-red-100', 'text-red-600': 'bg-red-100',
    'text-purple-500': 'bg-purple-100', 'text-purple-600': 'bg-purple-100',
    'text-pink-500': 'bg-pink-100', 'text-amber-500': 'bg-amber-100', 'text-amber-600': 'bg-amber-100',
    'text-teal-500': 'bg-teal-100', 'text-teal-600': 'bg-teal-100',
    'text-cyan-500': 'bg-cyan-100', 'text-indigo-500': 'bg-indigo-100', 'text-indigo-600': 'bg-indigo-100',
    'text-gray-500': 'bg-gray-100',
  };
  return mapping[color] || 'bg-gray-100';
};

// ============================================================================
// TYPES
// ============================================================================

interface Specialization {
  id: string;
  specializationId: string;
  name: string;
  displayName: string;
  iconName: string;
  iconColor: string;
  symptomCount: number;
  isActive?: boolean;
  applicableRoles?: string[];
  showInProblemGrid?: boolean;
  showInVendorProfile?: boolean;
  showInServicesDashboard?: boolean;
}

interface Category {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  icon?: string;
  iconColor?: string;
  specializationCount: number;
  symptomCount: number;
  isActive?: boolean;
  customerVisibilityType?: string;
  customerVisibilityState?: string;
  customerVisibilityCity?: string;
  customerDashboardCardActive?: boolean;
}

// ============================================================================
// ICON COMPONENT
// ============================================================================

function DynamicIcon({ name, className }: { name: string | null | undefined; className?: string }) {
  const IconComponent = getIconComponent(name);
  return <IconComponent className={className || 'w-6 h-6'} />;
}

// ============================================================================
// MODALS
// ============================================================================

function CategoryModal({ 
  category, 
  onSave, 
  onClose,
  saving
}: { 
  category?: Category | null; 
  onSave: (data: any) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    categoryId: category?.categoryId || '',
    name: category?.name || '',
    description: category?.description || '',
    icon: category?.icon || 'Folder',
    iconColor: category?.iconColor || 'text-blue-500',
    customerVisibilityType: (category?.customerVisibilityType as string) || 'GLOBAL',
    customerVisibilityState: category?.customerVisibilityState || '',
    customerVisibilityCity: category?.customerVisibilityCity || '',
    customerDashboardCardActive: category?.customerDashboardCardActive !== false,
  });
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconSearch, setIconSearch] = useState('');

  useEffect(() => {
    setForm({
      categoryId: category?.categoryId || '',
      name: category?.name || '',
      description: category?.description || '',
      icon: category?.icon || 'Folder',
      iconColor: category?.iconColor || 'text-blue-500',
      customerVisibilityType: (category?.customerVisibilityType as string) || 'GLOBAL',
      customerVisibilityState: category?.customerVisibilityState || '',
      customerVisibilityCity: category?.customerVisibilityCity || '',
      customerDashboardCardActive: category?.customerDashboardCardActive !== false,
    });
  }, [category]);

  const filteredIcons = ICON_OPTIONS.filter(i => i.toLowerCase().includes(iconSearch.toLowerCase()));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
          <h3 className="text-lg font-semibold text-gray-900">
            {category ? 'Edit Category' : 'Add New Category'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category ID *</label>
              <input
                type="text"
                value={form.categoryId}
                onChange={e => setForm(f => ({ ...f, categoryId: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
                placeholder="e.g., pet-sitting"
                disabled={!!category}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Pet Sitting"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Brief description..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
              <button
                type="button"
                onClick={() => setShowIconPicker(!showIconPicker)}
                className="w-full flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white hover:border-orange-400"
              >
                <DynamicIcon name={form.icon} className="w-5 h-5" />
                <span className="flex-1 text-left text-sm">{form.icon}</span>
                <LucideIcons.ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
              
              {showIconPicker && (
                <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl w-64 max-h-64 overflow-hidden">
                  <div className="p-2 border-b">
                    <input
                      type="text"
                      value={iconSearch}
                      onChange={e => setIconSearch(e.target.value)}
                      placeholder="Search icons..."
                      className="w-full px-2 py-1 text-sm border border-gray-200 rounded"
                    />
                  </div>
                  <div className="p-2 grid grid-cols-6 gap-1 max-h-48 overflow-y-auto">
                    {filteredIcons.map(icon => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => { setForm(f => ({ ...f, icon })); setShowIconPicker(false); }}
                        className={`p-2 rounded hover:bg-orange-100 ${form.icon === icon ? 'bg-orange-200 ring-2 ring-orange-400' : ''}`}
                        title={icon}
                      >
                        <DynamicIcon name={icon} className="w-5 h-5" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <select
                value={form.iconColor}
                onChange={e => setForm(f => ({ ...f, iconColor: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {COLOR_OPTIONS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-t pt-4 space-y-2">
            <p className="text-sm font-medium text-gray-800">Customer home tiles</p>
            <p className="text-xs text-gray-700 rounded-lg border border-blue-100 bg-blue-50 p-3">
              Whether a category appears on the customer home (and in which regions) is controlled in{' '}
              <strong>Marketing &amp; Promotions → Dashboard UI</strong>: choose <strong>Geographic Scope</strong>, then set each service under <strong>Service Launch Status</strong> (Launched, Coming Soon, Beta, or Hidden). The tile label still comes from the category name above.
            </p>
          </div>
          
          {/* Preview */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-2">Preview</p>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl ${getIconBg(form.iconColor)} flex items-center justify-center`}>
                <DynamicIcon name={form.icon} className={`w-6 h-6 ${form.iconColor}`} />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{form.name || 'Category Name'}</p>
                <p className="text-xs text-gray-500">{form.description || 'Description...'}</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100">
            Cancel
          </button>
          <button 
            onClick={() => onSave(form)}
            disabled={saving || !form.name}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <LucideIcons.Loader2 className="w-4 h-4 animate-spin" />}
            {category ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Role options for specialization assignment
const ROLE_OPTIONS = [
  { value: 'veterinarian', label: 'Veterinarian' },
  { value: 'vet_solo', label: 'Vet (Solo)' },
  { value: 'vet_clinic', label: 'Vet Clinic' },
  { value: 'pet_groomer', label: 'Pet Groomer' },
  { value: 'groomer_solo', label: 'Groomer (Solo)' },
  { value: 'groomer_center', label: 'Grooming Center' },
  { value: 'pet_trainer', label: 'Pet Trainer' },
  { value: 'trainer_solo', label: 'Trainer (Solo)' },
  { value: 'trainer_center', label: 'Training Center' },
  { value: 'pet_walker', label: 'Pet Walker' },
  { value: 'walker', label: 'Walker' },
  { value: 'pet_boarder', label: 'Pet Boarder' },
  { value: 'pet_boarding', label: 'Pet Boarding' },
  { value: 'boarding', label: 'Boarding' },
  { value: 'pet_behaviorist', label: 'Pet Behaviorist' },
  { value: 'nutritionist', label: 'Nutritionist' },
];

function SpecializationModal({ 
  categoryId,
  specialization, 
  onSave, 
  onClose,
  saving
}: { 
  categoryId: string;
  specialization?: Specialization | null; 
  onSave: (data: any) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    specializationId: specialization?.specializationId || '',
    name: specialization?.name || '',
    displayName: specialization?.displayName || '',
    iconName: specialization?.iconName || 'Package',
    iconColor: specialization?.iconColor || 'text-blue-500',
    applicableRoles: (specialization as any)?.applicableRoles || [],
    showInProblemGrid: (specialization as any)?.showInProblemGrid ?? true,
    showInVendorProfile: (specialization as any)?.showInVendorProfile ?? true,
    showInServicesDashboard: (specialization as any)?.showInServicesDashboard ?? true,
  });
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconSearch, setIconSearch] = useState('');

  // Symptoms: load when editing an existing specialization; full CRUD (add/edit/remove)
  const [symptoms, setSymptoms] = useState<SymptomItem[]>([]);
  const [loadingSymptoms, setLoadingSymptoms] = useState(false);
  const [symptomForm, setSymptomForm] = useState({ symptomName: '', symptomDisplayName: '', symptomKeywords: '' });
  const [editingSymptomId, setEditingSymptomId] = useState<string | null>(null);
  const [savingSymptom, setSavingSymptom] = useState(false);

  const specId = form.specializationId || specialization?.specializationId;

  useEffect(() => {
    if (specId && specialization) {
      setLoadingSymptoms(true);
      apiClient.get<any>(`/admin/specializations/${specId}`)
        .then((res) => {
          if (res.success && res.data?.symptoms) {
            const list = (res.data.symptoms || []).map((s: any) => ({
              id: s.id,
              symptomName: s.symptomName || s.symptom_name,
              symptomDisplayName: s.symptomDisplayName || s.symptom_display_name || s.symptomName || s.symptom_name,
              symptomKeywords: Array.isArray(s.symptomKeywords) ? s.symptomKeywords : (s.symptom_keywords || []),
              displayOrder: s.displayOrder ?? s.display_order,
              isActive: s.isActive !== false && s.is_active !== false,
            }));
            setSymptoms(list);
          } else {
            setSymptoms([]);
          }
        })
        .catch(() => setSymptoms([]))
        .finally(() => setLoadingSymptoms(false));
    } else {
      setSymptoms([]);
    }
  }, [specId, specialization?.specializationId]);

  const refreshSymptoms = useCallback(() => {
    if (!specId) return;
    setLoadingSymptoms(true);
    apiClient.get<any>(`/admin/specializations/${specId}/symptoms`)
      .then((res) => {
        if (res.success && res.data) {
          setSymptoms((res.data || []).map((s: any) => ({
            id: s.id,
            symptomName: s.symptomName || s.symptom_name,
            symptomDisplayName: s.symptomDisplayName || s.symptom_display_name || s.symptomName || s.symptom_name,
            symptomKeywords: Array.isArray(s.symptomKeywords) ? s.symptomKeywords : (s.symptom_keywords || []),
            displayOrder: s.displayOrder ?? s.display_order,
            isActive: s.isActive !== false && s.is_active !== false,
          })));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSymptoms(false));
  }, [specId]);

  const handleAddOrUpdateSymptom = async () => {
    if (!specId || !symptomForm.symptomName.trim()) return;
    setSavingSymptom(true);
    try {
      await apiClient.post(`/admin/specializations/${specId}/symptoms`, {
        symptomName: symptomForm.symptomName.trim().toLowerCase().replace(/\s+/g, '_'),
        symptomDisplayName: symptomForm.symptomDisplayName.trim() || symptomForm.symptomName.trim(),
        symptomKeywords: symptomForm.symptomKeywords.trim() ? symptomForm.symptomKeywords.split(/[,;]/).map((k: string) => k.trim()).filter(Boolean) : [],
      });
      setSymptomForm({ symptomName: '', symptomDisplayName: '', symptomKeywords: '' });
      setEditingSymptomId(null);
      refreshSymptoms();
    } catch (err: any) {
      alert(err.message || 'Failed to save symptom');
    } finally {
      setSavingSymptom(false);
    }
  };

  const handleEditSymptom = (symptom: SymptomItem) => {
    setSymptomForm({
      symptomName: symptom.symptomName,
      symptomDisplayName: symptom.symptomDisplayName || symptom.symptomName,
      symptomKeywords: Array.isArray(symptom.symptomKeywords) ? symptom.symptomKeywords.join(', ') : '',
    });
    setEditingSymptomId(symptom.id);
  };

  const handleDeleteSymptom = async (symptomId: string) => {
    if (!confirm('Remove this symptom?')) return;
    try {
      await apiClient.delete(`/admin/symptoms/${symptomId}`);
      refreshSymptoms();
      if (editingSymptomId === symptomId) {
        setEditingSymptomId(null);
        setSymptomForm({ symptomName: '', symptomDisplayName: '', symptomKeywords: '' });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete symptom');
    }
  };

  const filteredIcons = ICON_OPTIONS.filter(i => i.toLowerCase().includes(iconSearch.toLowerCase()));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
          <h3 className="text-lg font-semibold text-gray-900">
            {specialization ? 'Edit Specialization' : 'Add Specialization'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ID *</label>
              <input
                type="text"
                value={form.specializationId}
                onChange={e => setForm(f => ({ ...f, specializationId: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                placeholder="e.g., ear_care"
                disabled={!!specialization}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Ear Care"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
            <input
              type="text"
              value={form.displayName}
              onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
              placeholder="Display name for customers"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
              <button
                type="button"
                onClick={() => setShowIconPicker(!showIconPicker)}
                className="w-full flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white hover:border-orange-400"
              >
                <DynamicIcon name={form.iconName} className="w-5 h-5" />
                <span className="flex-1 text-left text-sm">{form.iconName}</span>
                <LucideIcons.ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
              
              {showIconPicker && (
                <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl w-64 max-h-64 overflow-hidden">
                  <div className="p-2 border-b">
                    <input
                      type="text"
                      value={iconSearch}
                      onChange={e => setIconSearch(e.target.value)}
                      placeholder="Search..."
                      className="w-full px-2 py-1 text-sm border border-gray-200 rounded"
                    />
                  </div>
                  <div className="p-2 grid grid-cols-6 gap-1 max-h-48 overflow-y-auto">
                    {filteredIcons.map(icon => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => { setForm(f => ({ ...f, iconName: icon })); setShowIconPicker(false); }}
                        className={`p-2 rounded hover:bg-orange-100 ${form.iconName === icon ? 'bg-orange-200 ring-2 ring-orange-400' : ''}`}
                        title={icon}
                      >
                        <DynamicIcon name={icon} className="w-5 h-5" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <select
                value={form.iconColor}
                onChange={e => setForm(f => ({ ...f, iconColor: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {COLOR_OPTIONS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* ✅ NEW: Applicable Roles - Required for visibility */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Applicable Roles * <span className="text-xs text-gray-400">(for vendor/customer visibility)</span>
            </label>
            <div className="border border-gray-300 rounded-lg p-2 max-h-40 overflow-y-auto">
              {ROLE_OPTIONS.map(role => (
                <label key={role.value} className="flex items-center gap-2 p-1 hover:bg-gray-50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.applicableRoles.includes(role.value)}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      if (e.target.checked) {
                        setForm(f => ({ ...f, applicableRoles: [...f.applicableRoles, role.value] }));
                      } else {
                        setForm(f => ({ ...f, applicableRoles: f.applicableRoles.filter((r: string) => r !== role.value) }));
                      }
                    }}
                    className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">{role.label}</span>
                </label>
              ))}
            </div>
            {form.applicableRoles.length === 0 && (
              <p className="text-xs text-red-500 mt-1">⚠️ Select at least one role for this specialization to appear in customer/vendor apps</p>
            )}
          </div>
          
          {/* ✅ Visibility flags: control where this specialization appears (all from one place) */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.showInProblemGrid}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, showInProblemGrid: e.target.checked }))}
                className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700">Show in &quot;What&apos;s your pet&apos;s need?&quot;</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.showInVendorProfile}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, showInVendorProfile: e.target.checked }))}
                className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700">Show in Vendor Profile</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.showInServicesDashboard}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, showInServicesDashboard: e.target.checked }))}
                className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700">Show in Services Dashboard</span>
            </label>
          </div>

          {/* Symptoms: visible when editing existing specialization; full CRUD */}
          {specId && (
            <div className="border-t border-gray-200 pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Symptoms ({symptoms.length}) <span className="text-xs text-gray-400">— used for search (e.g. &quot;vomiting&quot;) and filtering</span>
              </label>
              {loadingSymptoms ? (
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <LucideIcons.Loader2 className="w-4 h-4 animate-spin" /> Loading symptoms…
                </p>
              ) : (
                <>
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 mb-3 bg-gray-50">
                    {symptoms.length === 0 ? (
                      <p className="text-sm text-gray-400 py-2">No symptoms yet. Add below.</p>
                    ) : (
                      <ul className="space-y-1">
                        {symptoms.map((s) => (
                          <li key={s.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded hover:bg-white group">
                            <div className="min-w-0">
                              <span className="font-medium text-gray-900">{s.symptomDisplayName || s.symptomName}</span>
                              {s.symptomKeywords?.length > 0 && (
                                <span className="text-xs text-gray-500 ml-2">({(s.symptomKeywords as string[]).join(', ')})</span>
                              )}
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                              <button type="button" onClick={() => handleEditSymptom(s)} className="p-1 text-orange-600 hover:bg-orange-50 rounded" title="Edit">
                                <LucideIcons.Edit className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => handleDeleteSymptom(s.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Remove">
                                <LucideIcons.Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <input
                      type="text"
                      placeholder="Symptom name (e.g. vomiting)"
                      value={symptomForm.symptomName}
                      onChange={(e) => setSymptomForm((f) => ({ ...f, symptomName: e.target.value }))}
                      readOnly={!!editingSymptomId}
                      className={`px-3 py-2 border border-gray-300 rounded-lg text-sm ${editingSymptomId ? 'bg-gray-100' : ''}`}
                    />
                    <input
                      type="text"
                      placeholder="Display name (e.g. Vomiting)"
                      value={symptomForm.symptomDisplayName}
                      onChange={(e) => setSymptomForm((f) => ({ ...f, symptomDisplayName: e.target.value }))}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Keywords (comma-separated)"
                      value={symptomForm.symptomKeywords}
                      onChange={(e) => setSymptomForm((f) => ({ ...f, symptomKeywords: e.target.value }))}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleAddOrUpdateSymptom}
                        disabled={savingSymptom || !symptomForm.symptomName.trim()}
                        className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
                      >
                        {savingSymptom ? 'Saving…' : editingSymptomId ? 'Update symptom' : 'Add symptom'}
                      </button>
                      {editingSymptomId && (
                        <button type="button" onClick={() => { setEditingSymptomId(null); setSymptomForm({ symptomName: '', symptomDisplayName: '', symptomKeywords: '' }); }} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          {!specId && specialization && (
            <p className="text-xs text-gray-500">Save the specialization first, then you can add symptoms.</p>
          )}

          {/* Preview */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-2">Preview</p>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${getIconBg(form.iconColor)} flex items-center justify-center`}>
                <DynamicIcon name={form.iconName} className={`w-5 h-5 ${form.iconColor}`} />
              </div>
              <div>
                <p className="font-medium text-gray-900">{form.displayName || form.name || 'Specialization'}</p>
                <p className="text-xs text-gray-500">{form.applicableRoles.length} role(s) assigned</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100">
            Cancel
          </button>
          <button 
            onClick={() => onSave({ ...form, categoryId })}
            disabled={saving || !form.name || form.applicableRoles.length === 0}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <LucideIcons.Loader2 className="w-4 h-4 animate-spin" />}
            {specialization ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ADMIN CATEGORY LOAD + RECOVERY (inactive rows omitted by older list APIs)
// ============================================================================

/** Slugs to probe when list APIs omit disabled categories (GET /admin/catalog/categories/:slug still works). */
const CATALOG_CATEGORY_SLUG_CANDIDATES = [
  'veterinary', 'vet', 'grooming', 'shop', 'training', 'walking', 'walker', 'boarding',
  'behavioral', 'behaviorist', 'behaviour', 'emergency', 'wellness', 'nutritionist', 'nutrition',
  'adoption', 'mating', 'specialty', 'speciality', 'cafes', 'cafe', 'photography', 'insurance',
  'breeder', 'ambulance', 'relocation', 'resort', 'holiday', 'sunset', 'pharmacy',
  'lab-diagnostics', 'diagnostic', 'diagnostics', 'lab',
  'physio-therapy', 'physiotherapy', 'physio',
  'pet-sitter', 'pet_sitter', 'sitting', 'sitter',
];

function mapApiCategory(cat: any, spec?: { specializationCount?: number; symptomCount?: number }): Category {
  return {
    id: cat.id || cat.categoryId || '',
    categoryId: cat.categoryId || cat.category_id || '',
    name: cat.name || '',
    description: cat.description || '',
    icon: cat.icon || '',
    iconColor: cat.iconColor || cat.icon_color || '',
    specializationCount: spec?.specializationCount ?? (parseInt(cat.specializationCount) || 0),
    symptomCount: spec?.symptomCount ?? (parseInt(cat.symptomCount) || 0),
    customerVisibilityType: cat.customerVisibilityType || 'GLOBAL',
    customerVisibilityState: cat.customerVisibilityState || '',
    customerVisibilityCity: cat.customerVisibilityCity || '',
    customerDashboardCardActive: cat.customerDashboardCardActive !== false,
    isActive: (cat.isActive ?? cat.is_active) !== false,
  };
}

async function recoverMissingCategories(loaded: Category[]): Promise<Category[]> {
  const byCategoryId = new Map(loaded.map(c => [c.categoryId.toLowerCase(), c]));
  const byId = new Set(loaded.map(c => c.id));
  const recovered: Category[] = [];

  await Promise.all(
    CATALOG_CATEGORY_SLUG_CANDIDATES.map(async (slug) => {
      const key = slug.toLowerCase();
      if (byCategoryId.has(key)) return;
      try {
        const res = await apiClient.get<any>(`/admin/catalog/categories/${encodeURIComponent(slug)}`);
        const row = res?.category;
        if (!row?.id || byId.has(String(row.id))) return;
        const cat = mapApiCategory({
          ...row,
          categoryId: row.category_id || row.categoryId || slug,
          isActive: row.is_active ?? row.isActive,
        });
        recovered.push(cat);
        byCategoryId.set((cat.categoryId || key).toLowerCase(), cat);
        byId.add(cat.id);
      } catch {
        /* slug not in catalog */
      }
    })
  );

  if (recovered.length === 0) return loaded;
  return [...loaded, ...recovered];
}

function mergeCategoryLists(catalogRows: Category[], specRows: Category[]): Category[] {
  const specBySlug = new Map(specRows.map(c => [c.categoryId.toLowerCase(), c]));
  const byId = new Map<string, Category>();

  for (const cat of catalogRows) {
    const spec = specBySlug.get(cat.categoryId.toLowerCase());
    byId.set(cat.id, {
      ...cat,
      specializationCount: spec?.specializationCount ?? cat.specializationCount,
      symptomCount: spec?.symptomCount ?? cat.symptomCount,
    });
  }

  for (const spec of specRows) {
    if ([...byId.values()].some(c => c.categoryId.toLowerCase() === spec.categoryId.toLowerCase())) continue;
    byId.set(spec.id, spec);
  }

  return Array.from(byId.values());
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function CategoriesTab() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'with' | 'without'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [specsByCategory, setSpecsByCategory] = useState<Record<string, Specialization[]>>({});
  const [loadingSpecs, setLoadingSpecs] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [togglingCategoryId, setTogglingCategoryId] = useState<string | null>(null);
  const [togglingSpecId, setTogglingSpecId] = useState<string | null>(null);
  
  // Modals
  const [catModal, setCatModal] = useState<{ open: boolean; category?: Category | null }>({ open: false });
  const [specModal, setSpecModal] = useState<{ open: boolean; categoryId: string; spec?: Specialization | null }>({ open: false, categoryId: '' });

  // Load categories
  const loadCategories = useCallback(async () => {
    console.log('[CategoriesTab] Loading categories...');
    try {
      setLoading(true);
      setError(null);

      const [catalogData, specData] = await Promise.all([
        apiClient.get<any>('/admin/catalog/categories?includeInactive=true'),
        apiClient.get<any>('/admin/categories/with-specializations?includeInactive=true'),
      ]);

      const catalogRows: Category[] = Array.isArray(catalogData?.categories)
        ? catalogData.categories.map((cat: any) => mapApiCategory(cat))
        : [];
      const specRows: Category[] =
        specData?.success && Array.isArray(specData.categories)
          ? specData.categories.map((cat: any) => mapApiCategory(cat))
          : [];

      let merged = mergeCategoryLists(catalogRows, specRows);
      merged = await recoverMissingCategories(merged);

      console.log('[CategoriesTab] Loaded categories:', merged.length, 'inactive:', merged.filter(c => c.isActive === false).length);
      setCategories(merged);
      if (merged.length === 0) {
        setError(catalogData?.error || specData?.error || 'Failed to load categories');
      }
    } catch (err: any) {
      console.error('[CategoriesTab] Error:', err);
      setError(err.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Toggle expanded category
  const toggleExpand = async (categoryId: string) => {
    const next = new Set(expanded);
    if (next.has(categoryId)) {
      next.delete(categoryId);
    } else {
      next.add(categoryId);
      if (!specsByCategory[categoryId]) {
        await loadSpecs(categoryId);
      }
    }
    setExpanded(next);
  };

  // Load specializations for a category
  const loadSpecs = async (categoryId: string) => {
    setLoadingSpecs(prev => new Set(prev).add(categoryId));
    try {
      const data = await apiClient.get<any>(`/admin/specializations?categoryId=${categoryId}`);
      console.log('[CategoriesTab] Loaded specs for', categoryId, ':', data);
      if (data.success && data.data) {
        // ✅ Map all fields including applicableRoles
        const mappedSpecs = data.data.map((spec: any) => ({
          id: spec.id,
          specializationId: spec.specializationId,
          name: spec.name,
          displayName: spec.displayName || spec.name,
          iconName: spec.iconName,
          iconColor: spec.iconColor,
          symptomCount: spec.symptomCount || 0,
          isActive: spec.isActive !== false,
          applicableRoles: spec.applicableRoles || [],
          showInProblemGrid: spec.showInProblemGrid,
          showInVendorProfile: spec.showInVendorProfile,
          showInServicesDashboard: spec.showInServicesDashboard,
        }));
        setSpecsByCategory(prev => ({ ...prev, [categoryId]: mappedSpecs }));
      }
    } catch (err) {
      console.error('[CategoriesTab] Failed to load specs:', err);
    } finally {
      setLoadingSpecs(prev => { const n = new Set(prev); n.delete(categoryId); return n; });
    }
  };

  // Save category
  const handleSaveCategory = async (formData: any) => {
    setSaving(true);
    try {
      const payload = {
        categoryId: formData.categoryId,
        name: formData.name,
        description: formData.description || '',
        icon: formData.icon,
        iconColor: formData.iconColor,
        status: 'active',
        hasProblemGrid: false,
        vendorRoles: [],
        customerVisibilityType: formData.customerVisibilityType || 'GLOBAL',
        customerVisibilityState: formData.customerVisibilityState || '',
        customerVisibilityCity: formData.customerVisibilityCity || '',
        customerDashboardCardActive: formData.customerDashboardCardActive !== false,
      };
      if (catModal.category) {
        await apiClient.put(`/admin/catalog/categories/${catModal.category.id}`, payload);
      } else {
        await apiClient.post('/admin/catalog/categories', payload);
      }
      setCatModal({ open: false });
      loadCategories();
    } catch (err: any) {
      alert(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Save specialization
  const handleSaveSpec = async (formData: any) => {
    setSaving(true);
    try {
      if (specModal.spec) {
        await apiClient.put(`/admin/specializations/${specModal.spec.specializationId}`, formData);
      } else {
        await apiClient.post('/admin/specializations', formData);
      }
      setSpecModal({ open: false, categoryId: '' });
      await loadSpecs(formData.categoryId);
      loadCategories();
    } catch (err: any) {
      alert(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCategory = async (cat: Category, enable: boolean) => {
    if (togglingCategoryId) return;

    setTogglingCategoryId(cat.id);
    const nextCat = { ...cat, isActive: enable };
    setCategories(prev => prev.map(c => (c.id === cat.id ? nextCat : c)));
    if (!enable && filterStatus === 'active') setFilterStatus('all');
    try {
      await apiClient.put(`/admin/catalog/categories/${cat.id}`, {
        status: enable ? 'active' : 'inactive',
      });
      toast.success(
        enable
          ? `"${cat.name}" is now visible to customers`
          : `"${cat.name}" is hidden from customers (still visible here in admin)`
      );
    } catch (err: any) {
      setCategories(prev => prev.map(c => (c.id === cat.id ? cat : c)));
      toast.error(err.message || `Failed to ${enable ? 'enable' : 'disable'} category`);
    } finally {
      setTogglingCategoryId(null);
    }
  };

  const handleToggleSpec = async (spec: Specialization, categoryId: string, enable: boolean) => {
    if (togglingSpecId) return;

    setTogglingSpecId(spec.specializationId);
    setSpecsByCategory(prev => ({
      ...prev,
      [categoryId]: (prev[categoryId] || []).map(s =>
        s.specializationId === spec.specializationId ? { ...s, isActive: enable } : s
      ),
    }));
    try {
      await apiClient.put(`/admin/specializations/${spec.specializationId}`, {
        isActive: enable,
      });
      toast.success(
        enable
          ? `"${spec.displayName || spec.name}" is now visible to customers`
          : `"${spec.displayName || spec.name}" is hidden from customers (still visible here in admin)`
      );
      await loadSpecs(categoryId);
      loadCategories();
    } catch (err: any) {
      toast.error(err.message || `Failed to ${enable ? 'enable' : 'disable'} specialization`);
    } finally {
      setTogglingSpecId(null);
    }
  };

  // Delete category
  const handleDeleteCategory = async (cat: Category) => {
    if (!confirm(`Delete "${cat.name}"?`)) return;
    try {
      await apiClient.delete(`/admin/catalog/categories/${cat.id}`);
      loadCategories();
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  // Delete specialization
  const handleDeleteSpec = async (specId: string, categoryId: string) => {
    if (!confirm('Delete this specialization? This will deactivate it and remove it from customer/vendor views.')) return;
    try {
      console.log('[CategoriesTab] Deleting specialization:', specId);
      const result = await apiClient.delete<any>(`/admin/specializations/${specId}`);
      console.log('[CategoriesTab] Delete result:', result);
      
      if (result.success) {
        // ✅ FIX: Immediately update local state to remove the spec
        setSpecsByCategory(prev => ({
          ...prev,
          [categoryId]: (prev[categoryId] || []).filter(s => s.specializationId !== specId)
        }));
        // Also refresh from server to ensure sync
        await loadSpecs(categoryId);
        await loadCategories();
        alert('Specialization deleted successfully');
      } else {
        alert(result.error || 'Failed to delete');
      }
    } catch (err: any) {
      console.error('[CategoriesTab] Delete error:', err);
      alert(err.message || 'Failed to delete');
    }
  };

  const inactiveCount = categories.filter(c => c.isActive === false).length;
  const hasDiagnosticCategory = categories.some(
    c => /diagnostic/i.test(c.name || '') || /diagnostic/i.test(c.categoryId || '')
  );

  // Filter categories
  const filtered = categories.filter(cat => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!cat.name?.toLowerCase().includes(q) && !cat.categoryId?.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (filterType === 'with' && cat.specializationCount === 0) return false;
    if (filterType === 'without' && cat.specializationCount > 0) return false;
    if (filterStatus === 'active' && cat.isActive === false) return false;
    if (filterStatus === 'inactive' && cat.isActive !== false) return false;
    return true;
  });

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LucideIcons.Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        <span className="ml-3 text-gray-600">Loading categories...</span>
      </div>
    );
  }

  return (
    <div>
      {/* Error banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LucideIcons.AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">&times;</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative">
            <LucideIcons.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-56 pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          
          {/* Filter */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">All Categories</option>
            <option value="with">With Specializations</option>
            <option value="without">Without Specializations</option>
          </select>
          
          {/* Refresh */}
          <button
            onClick={loadCategories}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            title="Refresh"
          >
            <LucideIcons.RefreshCw className="w-4 h-4" />
          </button>
        </div>
        
        {/* Add button */}
        <button
          onClick={() => setCatModal({ open: true, category: null })}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium flex items-center gap-2"
        >
          <LucideIcons.Plus className="w-4 h-4" />
          Add Category
        </button>
      </div>

      {inactiveCount > 0 && filterStatus === 'active' && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm flex items-center justify-between gap-3 flex-wrap">
          <span>
            <strong>{inactiveCount}</strong> disabled categor{inactiveCount === 1 ? 'y is' : 'ies are'} hidden.
            Switch Status to <strong>Inactive</strong> or <strong>All Status</strong> to find and re-enable them.
          </span>
          <button
            type="button"
            onClick={() => setFilterStatus('inactive')}
            className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 rounded-lg text-sm font-medium"
          >
            Show disabled
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{categories.length}</p>
          <p className="text-xs text-blue-600">Categories</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-gray-600">{inactiveCount}</p>
          <p className="text-xs text-gray-600">Disabled</p>
        </div>
        <div className="bg-orange-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-orange-600">{categories.filter(c => c.specializationCount > 0).length}</p>
          <p className="text-xs text-orange-600">With Problem Grid</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{categories.reduce((s, c) => s + c.specializationCount, 0)}</p>
          <p className="text-xs text-green-600">Specializations</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-purple-600">{categories.reduce((s, c) => s + c.symptomCount, 0)}</p>
          <p className="text-xs text-purple-600">Symptoms</p>
        </div>
      </div>

      {/* Category list */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-gray-500 bg-gray-50 rounded-xl border-2 border-dashed">
          <LucideIcons.Folder className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No categories found</p>
          {inactiveCount > 0 && filterStatus === 'active' && (
            <p className="text-sm text-amber-700 mt-2">
              Try <button type="button" className="underline font-medium" onClick={() => setFilterStatus('inactive')}>Show disabled categories</button>
              {' '}— a category like Diagnostics &amp; Lab may have been turned off, not deleted.
            </p>
          )}
          {!hasDiagnosticCategory && searchQuery.toLowerCase().includes('diagnostic') && (
            <p className="text-sm text-gray-600 mt-2 max-w-md mx-auto">
              Diagnostics &amp; Lab is not in the database. Use <strong>Add Category</strong> to recreate it
              (e.g. category id: <code className="bg-gray-100 px-1 rounded">diagnostic</code>).
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(cat => {
            const isExpanded = expanded.has(cat.categoryId);
            const specs = specsByCategory[cat.categoryId] || [];
            const isLoadingSpec = loadingSpecs.has(cat.categoryId);
            const hasSpecs = cat.specializationCount > 0;
            
            return (
              <div key={cat.id || cat.categoryId} className={`bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-all ${cat.isActive === false ? 'opacity-60' : ''}`}>
                {/* Category row */}
                <div className="p-4 flex items-center gap-4">
                  {/* Expand */}
                  {hasSpecs ? (
                    <button onClick={() => toggleExpand(cat.categoryId)} className="text-gray-400 hover:text-gray-600">
                      {isExpanded ? <LucideIcons.ChevronDown className="w-5 h-5" /> : <LucideIcons.ChevronRight className="w-5 h-5" />}
                    </button>
                  ) : <div className="w-5" />}
                  
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl ${getIconBg(cat.iconColor)} flex items-center justify-center shrink-0`}>
                    <DynamicIcon name={cat.icon} className={`w-6 h-6 ${cat.iconColor || 'text-gray-500'}`} />
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-gray-900">{cat.name}</h4>
                      <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{cat.categoryId}</span>
                      {cat.isActive === false && (
                        <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">Inactive</span>
                      )}
                    </div>
                    {cat.description && <p className="text-sm text-gray-500 truncate">{cat.description}</p>}
                    <div className="flex gap-3 mt-1 text-xs">
                      {hasSpecs ? (
                        <>
                          <span className="text-orange-600 font-medium">{cat.specializationCount} specs</span>
                          <span className="text-gray-400">{cat.symptomCount} symptoms</span>
                        </>
                      ) : (
                        <span className="text-gray-400 italic">No problem grid</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <CatalogActiveSwitch
                      active={cat.isActive !== false}
                      loading={togglingCategoryId === cat.id}
                      onToggle={(enable) => handleToggleCategory(cat, enable)}
                    />
                    {hasSpecs && (
                      <button
                        onClick={() => setSpecModal({ open: true, categoryId: cat.categoryId })}
                        className="px-3 py-1.5 text-sm border border-orange-400 text-orange-600 rounded-lg hover:bg-orange-50 flex items-center gap-1"
                      >
                        <LucideIcons.Plus className="w-3 h-3" /> Spec
                      </button>
                    )}
                    <button
                      onClick={() => setCatModal({ open: true, category: cat })}
                      className="px-3 py-1.5 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 flex items-center gap-1"
                    >
                      <LucideIcons.Edit className="w-3 h-3" /> Edit
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat)}
                      className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 flex items-center gap-1"
                    >
                      <LucideIcons.Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
                
                {/* Expanded specs */}
                {isExpanded && hasSpecs && (
                  <div className="border-t bg-gray-50 p-4">
                    {isLoadingSpec ? (
                      <div className="flex items-center justify-center py-4">
                        <LucideIcons.Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                        <span className="ml-2 text-sm text-gray-500">Loading...</span>
                      </div>
                    ) : specs.length === 0 ? (
                      <p className="text-center text-gray-500 py-4">No specializations</p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {specs.map(spec => (
                          <div key={spec.id || spec.specializationId} className={`bg-white rounded-lg p-3 border hover:shadow-md transition group ${spec.isActive === false ? 'opacity-60' : ''}`}>
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`w-8 h-8 rounded-lg ${getIconBg(spec.iconColor)} flex items-center justify-center shrink-0`}>
                                  <DynamicIcon name={spec.iconName} className={`w-4 h-4 ${spec.iconColor || 'text-gray-500'}`} />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-sm text-gray-900 truncate">{spec.displayName || spec.name}</p>
                                  <p className="text-xs text-gray-400 font-mono truncate">{spec.specializationId}</p>
                                  {spec.isActive === false && (
                                    <span className="text-xs text-gray-500">Inactive</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 ml-1">
                                <CatalogActiveSwitch
                                  active={spec.isActive !== false}
                                  loading={togglingSpecId === spec.specializationId}
                                  onToggle={(enable) => handleToggleSpec(spec, cat.categoryId, enable)}
                                />
                                <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                                <button 
                                  onClick={() => setSpecModal({ open: true, categoryId: cat.categoryId, spec })}
                                  className="p-1 hover:bg-gray-100 rounded"
                                  title="Edit specialization"
                                >
                                  <LucideIcons.Edit className="w-3 h-3 text-gray-500" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteSpec(spec.specializationId, cat.categoryId)}
                                  className="p-1 hover:bg-red-50 rounded"
                                  title="Delete specialization"
                                >
                                  <LucideIcons.Trash2 className="w-3 h-3 text-red-500" />
                                </button>
                                </div>
                              </div>
                            </div>
                            {spec.symptomCount > 0 && (
                              <p className="text-xs text-gray-400 mt-1">{spec.symptomCount} symptoms</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {catModal.open && (
        <CategoryModal
          key={catModal.category?.id || 'new-category'}
          category={catModal.category}
          onSave={handleSaveCategory}
          onClose={() => setCatModal({ open: false })}
          saving={saving}
        />
      )}
      
      {specModal.open && (
        <SpecializationModal
          categoryId={specModal.categoryId}
          specialization={specModal.spec}
          onSave={handleSaveSpec}
          onClose={() => setSpecModal({ open: false, categoryId: '' })}
          saving={saving}
        />
      )}
    </div>
  );
}
