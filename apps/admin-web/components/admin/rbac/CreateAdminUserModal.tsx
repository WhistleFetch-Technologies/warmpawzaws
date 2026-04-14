'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { X, Loader2, UserPlus } from 'lucide-react';

type RoleRow = { id: string; display_name?: string; name?: string; description?: string };

interface CreateAdminUserModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateAdminUserModal({ open, onClose, onCreated }: CreateAdminUserModalProps) {
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [roleId, setRoleId] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingRoles(true);
        const data = await apiClient.get<any>('/admin/roles?active=false&role_type=admin');
        const rows = Array.isArray(data?.roles) ? data.roles : [];
        if (!cancelled) setRoles(rows.map((r: any) => ({ id: r.id || r.roleId, display_name: r.display_name, name: r.name, description: r.description })));
      } catch (e) {
        console.error(e);
        if (!cancelled) setRoles([]);
      } finally {
        if (!cancelled) setLoadingRoles(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setEmail('');
      setPassword('');
      setName('');
      setRoleId('');
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async () => {
    const em = email.trim();
    if (!em || !password) {
      alert('Email and password are required');
      return;
    }
    if (!roleId) {
      alert('Please select a role');
      return;
    }
    try {
      setSaving(true);
      const data = await apiClient.post<any>('/admin/rbac/users/create', {
        email: em,
        password,
        name: name.trim() || em,
        roleId,
      });
      if (data?.success) {
        onCreated();
      } else {
        alert(data?.error || 'Failed to create admin user');
      }
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Failed to create admin user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-orange-600" />
            Create admin user
          </h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="Close">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Defaults to email"
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">RBAC role *</label>
            {loadingRoles ? (
              <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading roles…
              </div>
            ) : (
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Select a role</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.display_name || r.name} ({r.name})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="flex gap-3 border-t border-gray-200 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 border-2 border-gray-200 rounded-lg hover:bg-gray-50 font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || loadingRoles}
            className="flex-1 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating…
              </>
            ) : (
              'Create user'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
