'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

interface Staff {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  experience_years: number;
  is_active: boolean;
  specializations: string[];
  services: { id: string; name: string }[];
}

export default function StaffManagementPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [vendorData, setVendorData] = useState<any>(null);
  const [newStaff, setNewStaff] = useState<Partial<Staff>>({
    is_active: true,
    specializations: [],
  });

  // ✅ PHASE 3: Role-based conditional field visibility
  useEffect(() => {
    const loadVendorData = async () => {
      try {
        const vendorId = localStorage.getItem('vendorId');
        if (vendorId) {
          const response = await apiClient.get<any>(`/vendor/${vendorId}/profile`);
          setVendorData(response.vendor || response);
        }
      } catch (err) {
        console.error('Error loading vendor data:', err);
      }
    };
    loadVendorData();
  }, []);

  const vendorRoleId = vendorData?.roleId || vendorData?.role_id;
  const isCafe = vendorRoleId === 'pet_cafe' || vendorRoleId === 'cafe';
  const isResort = vendorRoleId === 'pet_resort' || vendorRoleId === 'resort';
  const isBoarding = vendorRoleId === 'pet_boarding' || vendorRoleId === 'boarding';
  const isRetail = vendorRoleId === 'pet_products_store' || vendorRoleId === 'product_seller';
  const isPharmacy = vendorRoleId === 'pet_pharmacy' || vendorRoleId === 'pharmacy';
  const isHealthcare = vendorRoleId === 'veterinarian' || vendorRoleId === 'veterinary_clinic';
  const supportsHomeService = !isCafe && !isResort && !isBoarding && !isRetail && !isPharmacy; // These roles don't do home services

  useEffect(() => {
    const vendorId = localStorage.getItem('vendorId');
    if (!vendorId) {
      router.push('/onboarding');
      return;
    }
    loadStaff();
  }, [router]);

  const loadStaff = async () => {
    try {
      const vendorId = localStorage.getItem('vendorId');
      if (vendorId) {
        const response = await apiClient.get<{ staff: Staff[] }>(`/vendor/${vendorId}/staff`);
        setStaff(response.staff || []);
      }
    } catch (err) {
      console.error('Error loading staff:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = async () => {
    try {
      const vendorId = localStorage.getItem('vendorId');
      await apiClient.post('/staff/create', {
        vendorId,
        ...newStaff,
      });
      setShowAddForm(false);
      setNewStaff({ is_active: true, specializations: [] });
      loadStaff();
    } catch (err) {
      console.error('Error adding staff:', err);
    }
  };

  const toggleStaffStatus = async (staffId: string, isActive: boolean) => {
    try {
      await apiClient.put(`/staff/${staffId}`, { is_active: !isActive });
      loadStaff();
    } catch (err) {
      console.error('Error updating staff:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Staff Management</h1>
            <p className="text-gray-500 mt-1">Manage your team members and their assignments</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              ← Back
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
            >
              + Add Staff
            </button>
          </div>
        </div>

        {staff.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm">
            <div className="text-6xl mb-4">👥</div>
            <p className="text-gray-500">No staff members yet</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
            >
              Add Your First Staff Member
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {staff.map((member) => (
              <div key={member.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-xl font-semibold text-orange-600">
                      {member.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">{member.name}</h3>
                      <p className="text-sm text-gray-500">{member.role}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    member.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {member.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Phone</span>
                    <span className="font-medium">{member.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Experience</span>
                    <span className="font-medium">{member.experience_years} years</span>
                  </div>
                  {member.specializations.length > 0 && (
                    <div>
                      <span className="text-gray-500">Specializations</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {member.specializations.map((spec, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-orange-50 text-orange-600 rounded text-xs">
                            {spec}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <button
                    onClick={() => toggleStaffStatus(member.id, member.is_active)}
                    className={`flex-1 p-2 rounded-lg text-sm font-medium ${
                      member.is_active
                        ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        : 'bg-green-100 text-green-600 hover:bg-green-200'
                    }`}
                  >
                    {member.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => router.push(`/staff/${member.id}`)}
                    className="flex-1 p-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"
                  >
                    Manage
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showAddForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">Add New Staff</h2>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={newStaff.name || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewStaff({ ...newStaff, name: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                />
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={newStaff.phone || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewStaff({ ...newStaff, phone: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                />
                <input
                  type="email"
                  placeholder="Email (optional)"
                  value={newStaff.email || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewStaff({ ...newStaff, email: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                />
                <input
                  type="text"
                  placeholder="Role (e.g., Veterinarian, Groomer)"
                  value={newStaff.role || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewStaff({ ...newStaff, role: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                />
                <input
                  type="number"
                  placeholder="Years of Experience"
                  value={newStaff.experience_years || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewStaff({ ...newStaff, experience_years: parseInt(e.target.value) })}
                  className="w-full p-3 border rounded-lg"
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 p-3 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddStaff}
                  className="flex-1 p-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  Add Staff
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

