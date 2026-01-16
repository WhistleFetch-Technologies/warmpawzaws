'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { ChevronDown, Check, User, Building2, Users, Briefcase } from 'lucide-react';

interface VendorRole {
  id: string;
  name: string;
  description?: string;
  icon?: React.ReactNode;
}

const DEFAULT_VENDOR_ROLES: VendorRole[] = [
  {
    id: 'solo-provider',
    name: 'Solo Provider',
    description: 'Independent service provider',
    icon: <User className="w-5 h-5" />,
  },
  {
    id: 'center',
    name: 'Center',
    description: 'Physical facility or center',
    icon: <Building2 className="w-5 h-5" />,
  },
  {
    id: 'staff',
    name: 'Staff',
    description: 'Employee of a center',
    icon: <Users className="w-5 h-5" />,
  },
  {
    id: 'business',
    name: 'Business',
    description: 'Business entity or company',
    icon: <Briefcase className="w-5 h-5" />,
  },
];

interface VendorRoleSelectorProps {
  value: string | null;
  onChange: (roleId: string | null) => void;
  placeholder?: string;
  className?: string;
  showDescription?: boolean;
  multiple?: boolean;
  selectedRoles?: string[];
  onMultipleChange?: (roleIds: string[]) => void;
}

export function VendorRoleSelector({
  value,
  onChange,
  placeholder = 'Select vendor role',
  className = '',
  showDescription = false,
  multiple = false,
  selectedRoles = [],
  onMultipleChange,
}: VendorRoleSelectorProps) {
  const [roles, setRoles] = useState<VendorRole[]>(DEFAULT_VENDOR_ROLES);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>('/admin/vendor-roles');
      if (response.success && response.roles) {
        setRoles(response.roles.map((r: any) => ({
          ...r,
          icon: getRoleIcon(r.id),
        })));
      }
    } catch (error) {
      console.error('Error loading vendor roles:', error);
      // Use default roles if API fails
      setRoles(DEFAULT_VENDOR_ROLES);
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = (roleId: string) => {
    const role = DEFAULT_VENDOR_ROLES.find(r => r.id === roleId);
    return role?.icon || <User className="w-5 h-5" />;
  };

  const selectedRole = roles.find(r => r.id === value);

  const handleToggleRole = (roleId: string) => {
    if (!onMultipleChange) return;
    
    const current = selectedRoles || [];
    const isSelected = current.includes(roleId);
    
    if (isSelected) {
      onMultipleChange(current.filter(id => id !== roleId));
    } else {
      onMultipleChange([...current, roleId]);
    }
  };

  if (multiple) {
    return (
      <div className={className}>
        <div className="space-y-2">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Loading roles...</div>
          ) : roles.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No roles available</div>
          ) : (
            roles.map((role) => {
              const isSelected = selectedRoles?.includes(role.id);
              return (
                <label
                  key={role.id}
                  className={`flex items-start gap-3 p-0 border-2 rounded-lg cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-orange-50 border-orange-300'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleRole(role.id)}
                    className="mt-0 w-4 h-4 text-orange-600 focus:ring-orange-500 rounded"
                  />
                  <div className="text-orange-600">{role.icon}</div>
                  <div className="flex-1">
                    <div className="font-medium">{role.name}</div>
                    {showDescription && role.description && (
                      <div className="text-sm text-gray-500">{role.description}</div>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="w-5 h-5 text-orange-600" />
                  )}
                </label>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full min-h-[44px] px-4 py-0.5 bg-white border-2 border-gray-200 rounded-lg flex items-center justify-between hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
      >
        <div className="flex items-center gap-3 flex-1 text-left">
          {selectedRole ? (
            <>
              <div className="text-orange-600">{selectedRole.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">{selectedRole.name}</div>
                {showDescription && selectedRole.description && (
                  <div className="text-xs text-gray-500 truncate">{selectedRole.description}</div>
                )}
              </div>
            </>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-20 w-full mt-0 bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">Loading roles...</div>
            ) : roles.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No roles available</div>
            ) : (
              <div className="py-0">
                <button
                  type="button"
                  onClick={() => {
                    onChange(null);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-0.5 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                    value === null ? 'bg-orange-50' : ''
                  }`}
                >
                  {value === null && <Check className="w-4 h-4 text-orange-600" />}
                  <span className={value === null ? 'font-medium text-orange-600' : 'text-gray-700'}>
                    None
                  </span>
                </button>
                {roles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => {
                      onChange(role.id);
                      setIsOpen(false);
                    }}
                    className={`w-full px-4 py-0.5 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                      value === role.id ? 'bg-orange-50' : ''
                    }`}
                  >
                    {value === role.id && <Check className="w-4 h-4 text-orange-600" />}
                    <div className="text-orange-600">{role.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium truncate ${value === role.id ? 'text-orange-600' : 'text-gray-900'}`}>
                        {role.name}
                      </div>
                      {showDescription && role.description && (
                        <div className="text-xs text-gray-500 truncate">{role.description}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

