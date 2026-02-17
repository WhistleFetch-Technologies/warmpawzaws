'use client';

import React, { useState, useEffect } from 'react';
import { Users, Plus, Loader2, X, KeyRound, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { Button, Card, Input, Label } from '@warmpawz/ui';
import { toast } from 'sonner';

interface AdminUser {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  role_name?: string;
  role_display_name?: string;
  admin_role_id?: string;
  is_active: boolean;
  created_at: string;
}

interface AdminRole {
  id: string;
  name: string;
  display_name: string;
  role_type?: string;
}

export function AdminUsersTab() {
  const { hasPermission, admin } = useAdminAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [adminRoles, setAdminRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resendOtpId, setResendOtpId] = useState<string | null>(null);
  const [form, setForm] = useState({ email: '', name: '', phone: '', admin_role_id: '' });

  const canView = hasPermission('admin:users:view');
  const canCreate = hasPermission('admin:users:create');
  const canResetPassword = hasPermission('admin:users:reset_password');

  const loadUsers = async () => {
    if (!canView) return;
    try {
      setLoading(true);
      const res = await apiClient.get<{ success: boolean; users?: AdminUser[] }>('/admin/users');
      if (res?.success && Array.isArray(res.users)) setUsers(res.users);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load admin users');
    } finally {
      setLoading(false);
    }
  };

  const loadAdminRoles = async () => {
    try {
      const res = await apiClient.get<{ success: boolean; roles?: AdminRole[] }>('/admin/roles?active=false');
      if (res?.success && Array.isArray(res.roles)) {
        const adminOnly = (res.roles as AdminRole[]).filter(
          (r) => (r as any).role_type === 'admin' || (r as any).role_type === 'Admin'
        );
        setAdminRoles(adminOnly.length ? adminOnly : res.roles);
      }
    } catch {
      setAdminRoles([]);
    }
  };

  useEffect(() => {
    loadUsers();
    loadAdminRoles();
  }, [canView]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    if (!form.email?.trim() || !form.phone?.trim()) {
      toast.error('Email and phone are required');
      return;
    }
    try {
      setCreating(true);
      const res = await apiClient.post<{ success: boolean; error?: string; message?: string }>('/admin/users', {
        email: form.email.trim(),
        name: form.name?.trim() || undefined,
        phone: form.phone.trim(),
        admin_role_id: form.admin_role_id || undefined,
      });
      if (res?.success) {
        toast.success('User created. OTP sent to their phone. Ask them to set password at /set-password.');
        setShowCreateModal(false);
        setForm({ email: '', name: '', phone: '', admin_role_id: '' });
        loadUsers();
      } else {
        toast.error(res?.error || 'Failed to create user');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const canResetForUser = (u: AdminUser) => canResetPassword || u.id === admin?.id;
  const handleResetPassword = async (user: AdminUser) => {
    if (!canResetForUser(user)) return;
    try {
      setResettingId(user.id);
      const res = await apiClient.post<{ success: boolean; error?: string; message?: string }>(
        '/admin/users/reset-password-request',
        { adminId: user.id }
      );
      if (res?.success) {
        toast.success(res?.message || 'OTP sent. User can set a new password at /set-password.');
      } else {
        toast.error(res?.error || 'Failed to send reset OTP');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to send reset OTP');
    } finally {
      setResettingId(null);
    }
  };

  const handleResendSetPasswordOtp = async (user: AdminUser) => {
    if (!canCreate) return;
    try {
      setResendOtpId(user.id);
      const res = await apiClient.post<{ success: boolean; error?: string }>(
        `/admin/users/${user.id}/send-set-password-otp`,
        {}
      );
      if (res?.success) {
        toast.success('OTP sent to user’s phone.');
      } else {
        toast.error(res?.error || 'Failed to resend OTP');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to resend OTP');
    } finally {
      setResendOtpId(null);
    }
  };

  if (!canView) {
    return (
      <Card className="p-6">
        <p className="text-gray-600">You don’t have permission to view admin users.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Users className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Admin users</h2>
            <p className="text-sm text-gray-600">Create and manage admin accounts; password is set via OTP.</p>
          </div>
        </div>
        {canCreate && (
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create user
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Phone</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Role</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      No admin users yet. Create one to get started.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">{u.email}</td>
                      <td className="py-3 px-4">{u.name || '—'}</td>
                      <td className="py-3 px-4">{u.phone || '—'}</td>
                      <td className="py-3 px-4">{u.role_display_name || u.role_name || '—'}</td>
                      <td className="py-3 px-4 flex items-center gap-2 flex-wrap">
                        {canResetForUser(u) && (
                          <button
                            type="button"
                            onClick={() => handleResetPassword(u)}
                            disabled={resettingId === u.id}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-orange-600 hover:bg-orange-50 rounded disabled:opacity-50"
                          >
                            {resettingId === u.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <KeyRound className="w-3 h-3" />
                            )}
                            Reset password
                          </button>
                        )}
                        {canCreate && (
                          <button
                            type="button"
                            onClick={() => handleResendSetPasswordOtp(u)}
                            disabled={resendOtpId === u.id}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50"
                          >
                            {resendOtpId === u.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3 h-3" />
                            )}
                            Resend set-password OTP
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Create admin user</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-4">
              <div>
                <Label htmlFor="create-email">Email *</Label>
                <Input
                  id="create-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="admin@example.com"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="create-name">Name</Label>
                <Input
                  id="create-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Full name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="create-phone">Phone *</Label>
                <Input
                  id="create-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="10-digit mobile"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="create-role">Admin role</Label>
                <select
                  id="create-role"
                  value={form.admin_role_id}
                  onChange={(e) => setForm((f) => ({ ...f, admin_role_id: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">— Select role —</option>
                  {adminRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.display_name || r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={creating} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white">
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    'Create user'
                  )}
                </Button>
              </div>
            </form>
            <p className="px-4 pb-4 text-xs text-gray-500">
              An OTP will be sent to their phone. They set their password at <strong>/set-password</strong>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
