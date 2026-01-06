'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, Clock, Plus, Trash2, Power, Calendar, Check, X, Save, AlertCircle, MapPin, Settings } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface VendorScheduleManagementProps {
  vendorId: string;
  onBack: () => void;
}

interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  isEnabled: boolean;
}

interface ServiceSlotConfig {
  serviceStyle: string;
  slotDuration: number;
  serviceArea?: number;
}

interface DayAvailability {
  dayOfWeek: string;
  timeWindows: TimeSlot[];
  serviceConfigs: ServiceSlotConfig[];
}

const DAYS = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' }
];

const SLOT_DURATIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
  { value: 75, label: '1 hr 15 min' },
  { value: 90, label: '1 hr 30 min' },
  { value: 105, label: '1 hr 45 min' },
  { value: 120, label: '2 hours' }
];

const SERVICE_AREAS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const SERVICE_STYLE_LABELS: Record<string, string> = {
  'at_center': 'At Center/Clinic',
  'at_home': 'At Home',
  'tele': 'Tele Consulting'
};

const generateTimeOptions = () => {
  const times = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hour = h.toString().padStart(2, '0');
      const minute = m.toString().padStart(2, '0');
      times.push(`${hour}:${minute}`);
    }
  }
  return times;
};

const TIME_OPTIONS = generateTimeOptions();

function initializeDefaultAvailability(): DayAvailability[] {
  return DAYS.map(day => ({
    dayOfWeek: day.value,
    timeWindows: [],
    serviceConfigs: []
  }));
}

export function VendorScheduleManagement({ vendorId, onBack }: VendorScheduleManagementProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [availability, setAvailability] = useState<DayAvailability[]>(initializeDefaultAvailability());
  const [vendorServiceStyles, setVendorServiceStyles] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>('monday');
  const [showAddWindowModal, setShowAddWindowModal] = useState(false);
  const [showServiceConfigModal, setShowServiceConfigModal] = useState(false);
  const [newTimeWindow, setNewTimeWindow] = useState({
    startTime: '09:00',
    endTime: '17:00'
  });

  useEffect(() => {
    loadScheduleData();
  }, [vendorId]);

  const loadScheduleData = async () => {
    try {
      setLoading(true);
      
      const [statusRes, availRes, vendorRes] = await Promise.all([
        apiClient.get<any>(`/vendor/status/${vendorId}`).catch(() => null),
        apiClient.get<any>(`/vendor/availability-v2/${vendorId}`).catch(() => null),
        apiClient.get<any>(`/vendor/${vendorId}`).catch(() => null)
      ]);

      if (statusRes?.success) {
        setIsOnline(statusRes.status?.isOnline ?? true);
      }

      if (availRes?.success && availRes.availability && Array.isArray(availRes.availability) && availRes.availability.length > 0) {
        setAvailability(availRes.availability);
        setVendorServiceStyles(availRes.serviceStyles || []);
      } else {
        setAvailability(initializeDefaultAvailability());
      }

      if (vendorRes?.vendor) {
        try {
          const servicesRes = await apiClient.get<any>(`/vendor/${vendorId}/services`);
          if (servicesRes?.services && typeof servicesRes.services === 'object') {
            const allServices: string[] = [];
            Object.keys(servicesRes.services).forEach(style => {
              const styleData = servicesRes.services[style];
              if (styleData?.services && Array.isArray(styleData.services) && styleData.services.length > 0) {
                allServices.push(style);
              }
            });
            setVendorServiceStyles(allServices.length > 0 ? allServices : ['at_center', 'at_home', 'tele']);
          }
        } catch {
          setVendorServiceStyles(['at_center', 'at_home', 'tele']);
        }
      } else {
        setVendorServiceStyles(['at_center', 'at_home', 'tele']);
      }
    } catch (error) {
      console.error('Error loading schedule data:', error);
      setAvailability(initializeDefaultAvailability());
    } finally {
      setLoading(false);
    }
  };

  const toggleOnlineStatus = async () => {
    try {
      const newStatus = !isOnline;
      const res = await apiClient.put<any>(`/vendor/status/${vendorId}`, { isOnline: newStatus });
      if (res.success) {
        setIsOnline(newStatus);
      }
    } catch (error) {
      console.error('Error toggling online status:', error);
    }
  };

  const saveAvailability = async () => {
    try {
      setSaving(true);
      const res = await apiClient.put<any>(`/vendor/availability-v2/${vendorId}`, { availability });
      if (res.success) {
        alert('✅ Schedule saved and published to customer app!');
      } else {
        alert('❌ Failed to save schedule');
      }
    } catch (error) {
      console.error('Error saving availability:', error);
      alert('❌ Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  const addTimeWindow = () => {
    if (!newTimeWindow.startTime || !newTimeWindow.endTime) {
      alert('Please select both start and end times');
      return;
    }
    
    if (newTimeWindow.startTime >= newTimeWindow.endTime) {
      alert('End time must be after start time');
      return;
    }

    if (!availability || availability.length === 0) {
      alert('Error: Schedule data not loaded. Please refresh the page.');
      return;
    }

    const dayAvail = availability.find(a => a.dayOfWeek === selectedDay);
    if (!dayAvail) {
      alert('Error: Day not found. Please try again.');
      return;
    }

    const newWindow: TimeSlot = {
      id: `window_${Date.now()}`,
      startTime: newTimeWindow.startTime,
      endTime: newTimeWindow.endTime,
      isEnabled: true
    };

    const updatedAvailability = availability.map(a =>
      a.dayOfWeek === selectedDay
        ? { ...a, timeWindows: [...a.timeWindows, newWindow] }
        : a
    );
    
    setAvailability(updatedAvailability);
    setShowAddWindowModal(false);
    setNewTimeWindow({ startTime: '09:00', endTime: '17:00' });
  };

  const removeTimeWindow = (dayOfWeek: string, windowId: string) => {
    setAvailability(availability.map(a =>
      a.dayOfWeek === dayOfWeek
        ? { ...a, timeWindows: a.timeWindows.filter(w => w.id !== windowId) }
        : a
    ));
  };

  const toggleTimeWindow = (dayOfWeek: string, windowId: string) => {
    setAvailability(availability.map(a =>
      a.dayOfWeek === dayOfWeek
        ? {
            ...a,
            timeWindows: a.timeWindows.map(w =>
              w.id === windowId ? { ...w, isEnabled: !w.isEnabled } : w
            )
          }
        : a
    ));
  };

  const addServiceConfig = (serviceStyle: string, slotDuration: number, serviceArea?: number) => {
    const dayAvail = availability.find(a => a.dayOfWeek === selectedDay);
    if (!dayAvail) return;

    const exists = dayAvail.serviceConfigs.some(c => c.serviceStyle === serviceStyle);
    if (exists) {
      alert('Configuration for this service style already exists. Remove it first to update.');
      return;
    }

    const newConfig: ServiceSlotConfig = {
      serviceStyle,
      slotDuration,
      ...(serviceStyle === 'at_home' && serviceArea ? { serviceArea } : {})
    };

    setAvailability(availability.map(a =>
      a.dayOfWeek === selectedDay
        ? { ...a, serviceConfigs: [...a.serviceConfigs, newConfig] }
        : a
    ));
  };

  const removeServiceConfig = (dayOfWeek: string, serviceStyle: string) => {
    setAvailability(availability.map(a =>
      a.dayOfWeek === dayOfWeek
        ? { ...a, serviceConfigs: a.serviceConfigs.filter(c => c.serviceStyle !== serviceStyle) }
        : a
    ));
  };

  const getCurrentDayAvailability = () => {
    return availability.find(a => a.dayOfWeek === selectedDay);
  };

  const copyToAllDays = () => {
    const currentDay = getCurrentDayAvailability();
    if (!currentDay) return;

    if (!confirm('Copy this day\'s schedule to all other days?')) return;

    setAvailability(availability.map(a => ({
      ...a,
      timeWindows: currentDay.timeWindows.map(w => ({ ...w, id: `window_${Date.now()}_${Math.random()}` })),
      serviceConfigs: [...currentDay.serviceConfigs]
    })));

    alert('✅ Schedule copied to all days!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Clock className="w-8 h-8 text-orange-500 animate-spin mx-auto mb-2" />
          <p className="text-gray-600">Loading schedule...</p>
        </div>
      </div>
    );
  }

  const currentDayAvail = getCurrentDayAvailability();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[430px] mx-auto bg-white min-h-screen pb-24">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h1 className="flex-1 text-center font-semibold text-gray-900">Advanced Schedule</h1>
              <div className="w-10" />
            </div>

            <div className="p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-xl border border-orange-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}>
                    <Power className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">
                      {isOnline ? 'Online' : 'Vacation Mode'}
                    </div>
                    <div className="text-xs text-gray-600">
                      {isOnline ? 'Accepting bookings' : 'Not accepting bookings'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={toggleOnlineStatus}
                  className={`relative w-16 h-8 rounded-full transition-colors ${
                    isOnline ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${
                    isOnline ? 'translate-x-9' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {DAYS.map(day => (
              <button
                key={day.value}
                onClick={() => setSelectedDay(day.value)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedDay === day.value
                    ? 'bg-orange-500 text-white'
                    : 'bg-white text-gray-700 border border-gray-300'
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">{DAYS.find(d => d.value === selectedDay)?.label} Schedule</h2>
            <button
              onClick={copyToAllDays}
              className="bg-blue-500 hover:bg-blue-600 text-white h-8 px-3 text-xs rounded-lg"
            >
              Copy to All Days
            </button>
          </div>

          <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">Service Configuration</h3>
              </div>
              <button
                onClick={() => setShowServiceConfigModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-3 text-xs rounded-lg flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Service
              </button>
            </div>

            {currentDayAvail && currentDayAvail.serviceConfigs.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm">
                No service configurations yet. Add service types to control slot durations and areas.
              </div>
            ) : (
              <div className="space-y-2">
                {currentDayAvail?.serviceConfigs.map((config) => (
                  <div key={config.serviceStyle} className="p-3 bg-white rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 text-sm">
                          {SERVICE_STYLE_LABELS[config.serviceStyle] || config.serviceStyle}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {config.slotDuration} min slots
                          </span>
                          {config.serviceArea && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {config.serviceArea} km radius
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeServiceConfig(selectedDay, config.serviceStyle)}
                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Time Windows</h3>
              <button
                onClick={() => setShowAddWindowModal(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white h-8 px-3 text-xs rounded-lg flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Window
              </button>
            </div>

            {currentDayAvail && currentDayAvail.timeWindows.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 mb-2">No time windows set</p>
                <p className="text-xs text-gray-500">Add time windows to define when you're available</p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentDayAvail?.timeWindows.map(window => (
                  <div
                    key={window.id}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      window.isEnabled
                        ? 'bg-white border-gray-200'
                        : 'bg-gray-50 border-gray-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-orange-500" />
                        <span className="font-semibold text-gray-900">
                          {window.startTime} - {window.endTime}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleTimeWindow(selectedDay, window.id)}
                          className={`p-2 rounded-lg transition-colors ${
                            window.isEnabled ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'
                          }`}
                        >
                          {window.isEnabled ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => removeTimeWindow(selectedDay, window.id)}
                          className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {currentDayAvail.serviceConfigs.length > 0 && window.isEnabled && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="text-xs text-gray-500 mb-2">Slots will be generated for:</div>
                        <div className="space-y-1">
                          {currentDayAvail.serviceConfigs.map(config => {
                            const slots = calculateSlots(window.startTime, window.endTime, config.slotDuration);
                            return (
                              <div key={config.serviceStyle} className="text-xs text-gray-600">
                                <span className="font-medium">{SERVICE_STYLE_LABELS[config.serviceStyle]}:</span>
                                {' '}{slots} slots ({config.slotDuration} min each)
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 bg-green-50 rounded-xl border border-green-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-700">
                <p className="font-medium mb-1">How it works:</p>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li>• Configure service types with slot durations</li>
                  <li>• Add time windows (e.g., 9 AM - 5 PM)</li>
                  <li>• Slots are auto-generated based on your config</li>
                  <li>• Customers see only enabled slots in real-time</li>
                  <li>• Service area applies to home visits only</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
          <div className="max-w-[430px] mx-auto">
            <button
              onClick={saveAvailability}
              disabled={saving}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Clock className="w-5 h-5 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save & Publish Schedule
                </>
              )}
            </button>
          </div>
        </div>

        {showAddWindowModal && (
          <AddTimeWindowModal
            newTimeWindow={newTimeWindow}
            setNewTimeWindow={setNewTimeWindow}
            onAdd={addTimeWindow}
            onClose={() => setShowAddWindowModal(false)}
          />
        )}

        {showServiceConfigModal && (
          <AddServiceConfigModal
            vendorServiceStyles={vendorServiceStyles}
            existingConfigs={currentDayAvail?.serviceConfigs || []}
            onAdd={addServiceConfig}
            onClose={() => setShowServiceConfigModal(false)}
          />
        )}
      </div>
    </div>
  );
}

function calculateSlots(startTime: string, endTime: string, slotDuration: number): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const totalMinutes = endMinutes - startMinutes;
  return Math.floor(totalMinutes / slotDuration);
}

function AddTimeWindowModal({ 
  newTimeWindow, 
  setNewTimeWindow, 
  onAdd, 
  onClose 
}: {
  newTimeWindow: { startTime: string; endTime: string };
  setNewTimeWindow: (value: any) => void;
  onAdd: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-[400px]">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Time Window</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
            <select
              value={newTimeWindow.startTime}
              onChange={(e) => setNewTimeWindow({ ...newTimeWindow, startTime: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg"
            >
              {TIME_OPTIONS.map(time => (
                <option key={time} value={time}>{time}</option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
            <select
              value={newTimeWindow.endTime}
              onChange={(e) => setNewTimeWindow({ ...newTimeWindow, endTime: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg"
            >
              {TIME_OPTIONS.map(time => (
                <option key={time} value={time}>{time}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200 h-11 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={onAdd}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white h-11 rounded-lg"
            >
              Add Window
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddServiceConfigModal({
  vendorServiceStyles,
  existingConfigs,
  onAdd,
  onClose
}: {
  vendorServiceStyles: string[];
  existingConfigs: ServiceSlotConfig[];
  onAdd: (serviceStyle: string, slotDuration: number, serviceArea?: number) => void;
  onClose: () => void;
}) {
  const availableStyles = vendorServiceStyles.length > 0 
    ? vendorServiceStyles.filter(style => !existingConfigs.some(c => c.serviceStyle === style))
    : ['at_center', 'at_home', 'tele'].filter(style => !existingConfigs.some(c => c.serviceStyle === style));

  const [serviceStyle, setServiceStyle] = useState(availableStyles[0] || 'at_center');
  const [slotDuration, setSlotDuration] = useState(30);
  const [serviceArea, setServiceArea] = useState(2);

  if (availableStyles.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-[400px]">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Service Configuration</h2>
            <p className="text-sm text-gray-600 mb-6">All service types have been configured for this day.</p>
            <button
              onClick={onClose}
              className="w-full bg-gray-100 text-gray-700 hover:bg-gray-200 h-11 rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-[400px] max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Service Configuration</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Service Type</label>
            <select
              value={serviceStyle}
              onChange={(e) => setServiceStyle(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg"
            >
              {availableStyles.map(style => (
                <option key={style} value={style}>
                  {SERVICE_STYLE_LABELS[style] || style}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Slot Duration</label>
            <select
              value={slotDuration}
              onChange={(e) => setSlotDuration(Number(e.target.value))}
              className="w-full p-3 border border-gray-300 rounded-lg"
            >
              {SLOT_DURATIONS.map(duration => (
                <option key={duration.value} value={duration.value}>
                  {duration.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Recommended: At Center (30 min), At Home (60 min), Tele (15 min)
            </p>
          </div>

          {serviceStyle === 'at_home' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Service Area (km)</label>
              <select
                value={serviceArea}
                onChange={(e) => setServiceArea(Number(e.target.value))}
                className="w-full p-3 border border-gray-300 rounded-lg"
              >
                {SERVICE_AREAS.map(area => (
                  <option key={area} value={area}>{area} km</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Maximum distance for home visits
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200 h-11 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onAdd(serviceStyle, slotDuration, serviceStyle === 'at_home' ? serviceArea : undefined);
                onClose();
              }}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-11 rounded-lg"
            >
              Add Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

