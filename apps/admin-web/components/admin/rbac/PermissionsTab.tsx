'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Key, Check, Loader2, Search } from 'lucide-react';

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

export function PermissionsTab() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>('/admin/rbac/permissions');
      if (response.success && response.permissions) {
        const normalized = response.permissions.map((p: any) => ({
          ...p,
          id: p.id || p.key,
        }));
        setPermissions(normalized);
      }
    } catch (error) {
      console.error('Error loading permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPermissions = permissions.filter(perm =>
    perm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    perm.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    perm.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedPermissions = filteredPermissions.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Permissions</h2>
        <span className="text-sm text-gray-500">{permissions.length} total</span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search permissions..."
          className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
      </div>

      {/* Permissions by Category */}
      {Object.entries(groupedPermissions).map(([category, perms]) => (
        <div key={category} className="bg-white rounded-lg border-2 border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Key className="w-5 h-5 text-orange-600" />
            {category}
          </h3>
          <div className="space-y-2">
            {perms.map((perm) => (
              <div key={perm.id} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg">
                <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-sm text-gray-900">{perm.name}</p>
                  <p className="text-xs text-gray-500">{perm.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

