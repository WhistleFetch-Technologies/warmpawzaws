'use client';

import React, { useState } from 'react';
import { Shield, ArrowLeft } from 'lucide-react';
import { RolesTab } from './rbac/RolesTab';
import { PermissionsTab } from './rbac/PermissionsTab';
import { UsersTab } from './rbac/UsersTab';

interface RBACManagementProps {
  onBack?: () => void;
}

export function RBACManagement({ onBack }: RBACManagementProps) {
  const [activeTab, setActiveTab] = useState<'roles' | 'permissions' | 'users'>('roles');

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-4">
          {onBack && (
            <button
              onClick={onBack}
              className="mb-0 text-gray-600 hover:text-gray-900 flex items-center gap-0"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          )}
          <div className="flex items-center gap-0">
            <div className="p-0 bg-orange-100 rounded-lg">
              <Shield className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">RBAC Management</h1>
              <p className="text-sm text-gray-500">Role-Based Access Control</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-gray-200">
          <button
            onClick={() => setActiveTab('roles')}
            className={`flex-1 px-4 py-0 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'roles'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Roles
          </button>
          <button
            onClick={() => setActiveTab('permissions')}
            className={`flex-1 px-4 py-0 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'permissions'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Permissions
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 px-4 py-0 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'users'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Users
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'roles' && <RolesTab />}
        {activeTab === 'permissions' && <PermissionsTab />}
        {activeTab === 'users' && <UsersTab />}
      </div>
    </div>
  );
}

