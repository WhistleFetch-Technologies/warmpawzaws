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

interface VendorService {
  id: string;
  service_name: string;
  category: string;
  service_style: string;
  price: number;
}

interface StaffAvailability {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  serviceStyles: string[];
}

export default function StaffManagementPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showServiceAssignment, setShowServiceAssignment] = useState<string | null>(null);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState<string | null>(null);
  const [vendorData, setVendorData] = useState<any>(null);
  const [vendorServices, setVendorServices] = useState<VendorService[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [staffAvailability, setStaffAvailability] = useState<StaffAvailability[]>([]);
  const [selectedServiceStyles, setSelectedServiceStyles] = useState<string[]>([]);
  const [newStaff, setNewStaff] = useState<Partial<Staff>>({
    is_active: true,
    specializations: [],
    services: [],
  });

  const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const SERVICE_STYLES = [
    { id: 'at_center', label: 'At Center', icon: '🏥' },
    { id: 'at_home', label: 'At Home', icon: '🏠' },
    { id: 'tele', label: 'Tele/Video', icon: '📱' },
  ];

  // ✅ PHASE 3: Role-based conditional field visibility + Load vendor services
  useEffect(() => {
    const loadVendorData = async () => {
      try {
        const vendorId = localStorage.getItem('vendorId');
        if (vendorId) {
          // Load vendor profile
          const response = await apiClient.get<any>(`/vendor/${vendorId}/profile`);
          setVendorData(response.vendor || response);
          
          // Load vendor services for assignment
          const servicesResponse = await apiClient.get<any>(`/vendor/${vendorId}/services`);
          const allServices = servicesResponse.allServices || [];
          setVendorServices(allServices);
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

  // Open service assignment modal for a staff member
  const openServiceAssignment = (staffMember: Staff) => {
    setShowServiceAssignment(staffMember.id);
    setSelectedServices(staffMember.services?.map(s => s.id) || []);
  };

  // Toggle service selection
  const toggleServiceSelection = (serviceId: string) => {
    setSelectedServices(prev => 
      prev.includes(serviceId) 
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  // Save service assignments
  const saveServiceAssignments = async () => {
    if (!showServiceAssignment) return;
    
    try {
      const vendorId = localStorage.getItem('vendorId');
      await apiClient.put(`/vendor/${vendorId}/staff/${showServiceAssignment}`, {
        services: selectedServices,
      });
      setShowServiceAssignment(null);
      setSelectedServices([]);
      loadStaff();
    } catch (err) {
      console.error('Error saving service assignments:', err);
    }
  };

  // Open availability modal
  const openAvailabilityModal = async (staffMember: Staff) => {
    setShowAvailabilityModal(staffMember.id);
    try {
      const vendorId = localStorage.getItem('vendorId');
      const response = await apiClient.get<any>(`/vendor/${vendorId}/staff/${staffMember.id}/availability`);
      setStaffAvailability(response.availability || []);
      setSelectedServiceStyles((response.serviceStyles || ['at_center', 'at_home', 'tele']));
    } catch (err) {
      console.error('Error loading availability:', err);
      // Default availability (Mon-Sat 9-6)
      setStaffAvailability([1, 2, 3, 4, 5, 6].map(day => ({
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '18:00',
        serviceStyles: ['at_center', 'at_home', 'tele'],
      })));
      setSelectedServiceStyles(['at_center', 'at_home', 'tele']);
    }
  };

  // Toggle service style
  const toggleServiceStyle = (styleId: string) => {
    setSelectedServiceStyles(prev => 
      prev.includes(styleId) 
        ? prev.filter(s => s !== styleId)
        : [...prev, styleId]
    );
  };

  // Save availability
  const saveAvailability = async () => {
    if (!showAvailabilityModal) return;
    
    try {
      const vendorId = localStorage.getItem('vendorId');
      await apiClient.put(`/vendor/${vendorId}/staff/${showAvailabilityModal}/availability`, {
        availability: staffAvailability,
        serviceStyles: selectedServiceStyles,
      });
      setShowAvailabilityModal(null);
      alert('Availability saved successfully!');
    } catch (err) {
      console.error('Error saving availability:', err);
      alert('Failed to save availability');
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
                  {member.specializations && member.specializations.length > 0 && (
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
                  {member.services && member.services.length > 0 && (
                    <div>
                      <span className="text-gray-500">Assigned Services ({member.services.length})</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {member.services.slice(0, 3).map((svc, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">
                            {svc.name}
                          </span>
                        ))}
                        {member.services.length > 3 && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                            +{member.services.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
                  <button
                    onClick={() => openServiceAssignment(member)}
                    className="flex-1 p-2 bg-blue-100 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-200 min-w-[120px]"
                  >
                    Assign Services
                  </button>
                  <button
                    onClick={() => openAvailabilityModal(member)}
                    className="flex-1 p-2 bg-purple-100 text-purple-600 rounded-lg text-sm font-medium hover:bg-purple-200 min-w-[120px]"
                  >
                    Set Availability
                  </button>
                  <button
                    onClick={() => toggleStaffStatus(member.id, member.is_active)}
                    className={`flex-1 p-2 rounded-lg text-sm font-medium min-w-[100px] ${
                      member.is_active
                        ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        : 'bg-green-100 text-green-600 hover:bg-green-200'
                    }`}
                  >
                    {member.is_active ? 'Deactivate' : 'Activate'}
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

        {/* Service Assignment Modal */}
        {showServiceAssignment && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
              <h2 className="text-xl font-semibold mb-4">Assign Services to Staff</h2>
              <p className="text-sm text-gray-500 mb-4">
                Select which services this staff member can perform
              </p>
              
              {vendorServices.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No services available to assign.</p>
                  <p className="text-sm mt-2">Add services first in Service Management.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {vendorServices.map((service) => (
                    <label
                      key={service.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                        selectedServices.includes(service.id)
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedServices.includes(service.id)}
                        onChange={() => toggleServiceSelection(service.id)}
                        className="w-4 h-4 text-orange-500 rounded"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{service.service_name}</p>
                        <p className="text-xs text-gray-500">
                          {service.category} • {service.service_style?.replace('_', ' ')} • ₹{service.price}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowServiceAssignment(null);
                    setSelectedServices([]);
                  }}
                  className="flex-1 p-3 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveServiceAssignments}
                  className="flex-1 p-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  Save ({selectedServices.length} selected)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Availability Modal */}
        {showAvailabilityModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-semibold mb-4">📅 Set Staff Availability</h2>
              
              {/* Service Styles */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Available for Service Types:</h3>
                <div className="flex flex-wrap gap-2">
                  {SERVICE_STYLES.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => toggleServiceStyle(style.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${
                        selectedServiceStyles.includes(style.id)
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <span>{style.icon}</span>
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Weekly Schedule */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Weekly Schedule:</h3>
                <div className="space-y-3">
                  {DAYS_OF_WEEK.map((day, index) => {
                    const dayAvail = staffAvailability.find(a => a.dayOfWeek === index);
                    const isEnabled = !!dayAvail;
                    
                    return (
                      <div key={day} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setStaffAvailability([...staffAvailability, {
                                dayOfWeek: index,
                                startTime: '09:00',
                                endTime: '18:00',
                                serviceStyles: selectedServiceStyles,
                              }]);
                            } else {
                              setStaffAvailability(staffAvailability.filter(a => a.dayOfWeek !== index));
                            }
                          }}
                          className="w-4 h-4 text-orange-500 rounded"
                        />
                        <span className="w-24 font-medium text-gray-700">{day}</span>
                        {isEnabled && (
                          <>
                            <input
                              type="time"
                              value={dayAvail?.startTime || '09:00'}
                              onChange={(e) => {
                                setStaffAvailability(staffAvailability.map(a => 
                                  a.dayOfWeek === index ? { ...a, startTime: e.target.value } : a
                                ));
                              }}
                              className="p-2 border rounded text-sm"
                            />
                            <span className="text-gray-400">to</span>
                            <input
                              type="time"
                              value={dayAvail?.endTime || '18:00'}
                              onChange={(e) => {
                                setStaffAvailability(staffAvailability.map(a => 
                                  a.dayOfWeek === index ? { ...a, endTime: e.target.value } : a
                                ));
                              }}
                              className="p-2 border rounded text-sm"
                            />
                          </>
                        )}
                        {!isEnabled && (
                          <span className="text-gray-400 text-sm">Not Available</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAvailabilityModal(null);
                    setStaffAvailability([]);
                    setSelectedServiceStyles([]);
                  }}
                  className="flex-1 p-3 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveAvailability}
                  className="flex-1 p-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  Save Availability
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

