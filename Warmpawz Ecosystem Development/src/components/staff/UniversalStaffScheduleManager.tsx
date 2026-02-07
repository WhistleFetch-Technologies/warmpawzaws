import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Plus,
  Clock,
  Calendar,
  Edit,
  Trash2,
  Save,
  X,
  MapPin,
  AlertCircle,
  Check,
  Coffee,
  Timer,
  Briefcase,
  Home
} from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

interface UniversalStaffScheduleManagerProps {
  staffId: string;
  staffName: string;
  staffRole: string;
  staffRoleId: string;
  vendorId: string;
  onBack: () => void;
}

interface Schedule {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  breaks: Break[];
  bufferTime: number;
  services: ServiceConfig[];
  homeServiceConfig: {
    radius: number;
    leadTime: number;
    leadTimeUnit: string;
  } | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Break {
  id?: string;
  startTime: string;
  endTime: string;
  name: string;
}

interface ServiceConfig {
  serviceId: string;
  serviceName: string;
  serviceStyle: string;
  duration: number;
  enabled: boolean;
}

interface Vacation {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
}

interface Holiday {
  id: string;
  date: string;
  name: string;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function UniversalStaffScheduleManager({
  staffId,
  staffName,
  staffRole,
  staffRoleId,
  vendorId,
  onBack
}: UniversalStaffScheduleManagerProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [availableServices, setAvailableServices] = useState<any[]>([]);
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [showAddVacation, setShowAddVacation] = useState(false);
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

  // Form state for new schedule
  const [scheduleName, setScheduleName] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [bufferTime, setBufferTime] = useState(15);
  const [breaks, setBreaks] = useState<Break[]>([]);
  const [selectedServices, setSelectedServices] = useState<ServiceConfig[]>([]);
  const [homeRadius, setHomeRadius] = useState(10);
  const [leadTime, setLeadTime] = useState(60);
  const [leadTimeUnit, setLeadTimeUnit] = useState('minutes');

  useEffect(() => {
    loadData();
  }, [staffId]);

  const loadData = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        `${getApiBaseUrl()}/staff/${staffId}/schedules`,
        {
          headers: getAuthHeaders()
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSchedules(data.schedules || []);
        setAvailableServices(data.availableServices || []);
        setVacations(data.vacations || []);
        setHolidays(data.holidays || []);
      } else {
        toast.error('Failed to load schedules');
      }
    } catch (error) {
      console.error('Error loading schedules:', error);
      toast.error('Network error loading schedules');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSchedule = async () => {
    // Validation
    if (!scheduleName.trim()) {
      toast.error('Please enter a schedule name');
      return;
    }

    if (selectedDays.length === 0) {
      toast.error('Please select at least one day');
      return;
    }

    if (selectedServices.length === 0) {
      toast.error('Please select at least one service');
      return;
    }

    // Check for home service configuration
    const hasHomeService = selectedServices.some(s => 
      s.serviceStyle === 'at_home' || s.serviceStyle === 'home'
    );

    if (hasHomeService && (!homeRadius || !leadTime)) {
      toast.error('Please configure service radius and lead time for home services');
      return;
    }

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/staff/${staffId}/schedules`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: scheduleName,
            startTime,
            endTime,
            daysOfWeek: selectedDays,
            breaks,
            bufferTime,
            services: selectedServices,
            homeServiceConfig: hasHomeService ? {
              radius: homeRadius,
              leadTime,
              leadTimeUnit
            } : null
          })
        }
      );

      if (response.ok) {
        toast.success('Schedule created successfully');
        setShowAddSchedule(false);
        resetForm();
        loadData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create schedule');
      }
    } catch (error) {
      console.error('Error creating schedule:', error);
      toast.error('Network error creating schedule');
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/staff/${staffId}/schedules/${scheduleId}`,
        {
          method: 'DELETE',
          headers: getAuthHeaders()
        }
      );

      if (response.ok) {
        toast.success('Schedule deleted');
        loadData();
      } else {
        toast.error('Failed to delete schedule');
      }
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast.error('Network error');
    }
  };

  const handleToggleService = (service: any) => {
    const exists = selectedServices.find(s => s.serviceId === service.id);
    
    if (exists) {
      setSelectedServices(selectedServices.filter(s => s.serviceId !== service.id));
    } else {
      // Check if service is enabled in catalog
      if (!service.isActive) {
        toast.error(`Please enable "${service.name}" in your service catalog first`);
        return;
      }

      setSelectedServices([
        ...selectedServices,
        {
          serviceId: service.id,
          serviceName: service.name,
          serviceStyle: service.serviceStyle || 'at_center',
          duration: service.duration || 30,
          enabled: true
        }
      ]);
    }
  };

  const handleAddBreak = () => {
    setBreaks([
      ...breaks,
      {
        id: `break-${Date.now()}`,
        startTime: '13:00',
        endTime: '14:00',
        name: 'Lunch Break'
      }
    ]);
  };

  const handleRemoveBreak = (index: number) => {
    setBreaks(breaks.filter((_, i) => i !== index));
  };

  const handleAddVacation = async (startDate: string, endDate: string, reason: string) => {
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/staff/${staffId}/vacations`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ startDate, endDate, reason })
        }
      );

      if (response.ok) {
        toast.success('Vacation added');
        setShowAddVacation(false);
        loadData();
      } else {
        toast.error('Failed to add vacation');
      }
    } catch (error) {
      toast.error('Network error');
    }
  };

  const handleAddHoliday = async (date: string, name: string) => {
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/staff/${staffId}/holidays`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ date, name })
        }
      );

      if (response.ok) {
        toast.success('Holiday added');
        setShowAddHoliday(false);
        loadData();
      } else {
        toast.error('Failed to add holiday');
      }
    } catch (error) {
      toast.error('Network error');
    }
  };

  const resetForm = () => {
    setScheduleName('');
    setStartTime('09:00');
    setEndTime('17:00');
    setSelectedDays([1, 2, 3, 4, 5]);
    setBufferTime(15);
    setBreaks([]);
    setSelectedServices([]);
    setHomeRadius(10);
    setLeadTime(60);
    setLeadTimeUnit('minutes');
  };

  const hasHomeService = selectedServices.some(s => 
    s.serviceStyle === 'at_home' || s.serviceStyle === 'home'
  );

  if (loading) {
    return (
      <div className=\"min-h-screen bg-gray-50 flex items-center justify-center\">
        <div className=\"w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin\"></div>
      </div>
    );
  }

  return (
    <div className=\"min-h-screen bg-gray-50\">
      {/* Header */}
      <div className=\"bg-white border-b border-gray-200 sticky top-0 z-10\">
        <div className=\"max-w-6xl mx-auto px-4 py-4\">
          <div className=\"flex items-center gap-4\">
            <button
              onClick={onBack}
              className=\"p-2 hover:bg-gray-100 rounded-lg transition-colors\"
            >
              <ArrowLeft className=\"w-5 h-5\" />
            </button>
            <div className=\"flex-1\">
              <h1 className=\"font-bold text-gray-900\">My Availability</h1>
              <p className=\"text-sm text-gray-600\">{staffName} • {staffRole}</p>
            </div>
            <Button
              onClick={() => setShowAddSchedule(true)}
              className=\"bg-blue-600 hover:bg-blue-700 text-white\"
            >
              <Plus className=\"w-4 h-4 mr-2\" />
              Add Schedule
            </Button>
          </div>
        </div>
      </div>

      <div className=\"max-w-6xl mx-auto px-4 py-6 space-y-6\">
        {/* Schedules */}
        <div className=\"bg-white rounded-xl border border-gray-200 p-6\">
          <h2 className=\"font-bold text-gray-900 mb-4 flex items-center gap-2\">
            <Clock className=\"w-5 h-5 text-blue-600\" />
            Work Schedules ({schedules.length})
          </h2>

          {schedules.length === 0 ? (
            <div className=\"text-center py-12 text-gray-500\">
              <Clock className=\"w-12 h-12 mx-auto mb-3 text-gray-300\" />
              <p className=\"mb-4\">No schedules created yet</p>
              <Button
                onClick={() => setShowAddSchedule(true)}
                variant=\"outline\"
              >
                <Plus className=\"w-4 h-4 mr-2\" />
                Create Your First Schedule
              </Button>
            </div>
          ) : (
            <div className=\"space-y-4\">
              {schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className=\"border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors\"
                >
                  <div className=\"flex items-start justify-between mb-3\">
                    <div className=\"flex-1\">
                      <div className=\"flex items-center gap-2 mb-2\">
                        <h3 className=\"font-bold text-gray-900\">{schedule.name}</h3>
                        {schedule.isActive ? (
                          <span className=\"px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs\">Active</span>
                        ) : (
                          <span className=\"px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs\">Inactive</span>
                        )}
                      </div>
                      <p className=\"text-sm text-gray-600\">
                        {schedule.startTime} - {schedule.endTime}
                      </p>
                    </div>
                    <div className=\"flex gap-2\">
                      <button
                        onClick={() => {
                          setEditingSchedule(schedule);
                          // Populate form with schedule data
                        }}
                        className=\"p-2 hover:bg-gray-100 rounded-lg\"
                      >
                        <Edit className=\"w-4 h-4 text-gray-600\" />
                      </button>
                      <button
                        onClick={() => handleDeleteSchedule(schedule.id)}
                        className=\"p-2 hover:bg-red-50 rounded-lg\"
                      >
                        <Trash2 className=\"w-4 h-4 text-red-600\" />
                      </button>
                    </div>
                  </div>

                  {/* Days */}
                  <div className=\"flex flex-wrap gap-1 mb-3\">
                    {schedule.daysOfWeek.map(day => (
                      <span key={day} className=\"px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs\">
                        {DAY_NAMES[day].substring(0, 3)}
                      </span>
                    ))}
                  </div>

                  {/* Services */}
                  <div className=\"mb-3\">
                    <p className=\"text-xs text-gray-500 mb-2\">Services ({schedule.services.length})</p>
                    <div className=\"flex flex-wrap gap-2\">
                      {schedule.services.map(service => (
                        <span key={service.serviceId} className=\"px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs flex items-center gap-1\">
                          {service.serviceStyle === 'at_home' && <Home className=\"w-3 h-3\" />}
                          {service.serviceName}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Breaks */}
                  {schedule.breaks.length > 0 && (
                    <div className=\"mb-3\">
                      <p className=\"text-xs text-gray-500 mb-2 flex items-center gap-1\">
                        <Coffee className=\"w-3 h-3\" />
                        Breaks
                      </p>
                      <div className=\"space-y-1\">
                        {schedule.breaks.map((br, idx) => (
                          <div key={idx} className=\"text-xs text-gray-600\">
                            {br.name}: {br.startTime} - {br.endTime}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Buffer Time */}
                  <div className=\"text-xs text-gray-500 flex items-center gap-1\">
                    <Timer className=\"w-3 h-3\" />
                    Buffer: {schedule.bufferTime} min between appointments
                  </div>

                  {/* Home Service Config */}
                  {schedule.homeServiceConfig && (
                    <div className=\"mt-3 pt-3 border-t border-gray-200\">
                      <p className=\"text-xs text-gray-500 mb-2 flex items-center gap-1\">
                        <MapPin className=\"w-3 h-3\" />
                        Home Service Configuration
                      </p>
                      <div className=\"grid grid-cols-2 gap-2 text-xs text-gray-600\">
                        <div>Radius: {schedule.homeServiceConfig.radius} km</div>
                        <div>Lead Time: {schedule.homeServiceConfig.leadTime} {schedule.homeServiceConfig.leadTimeUnit}</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vacations & Holidays */}
        <div className=\"grid grid-cols-2 gap-6\">
          {/* Vacations */}
          <div className=\"bg-white rounded-xl border border-gray-200 p-6\">
            <div className=\"flex items-center justify-between mb-4\">
              <h2 className=\"font-bold text-gray-900 flex items-center gap-2\">
                <Calendar className=\"w-5 h-5 text-orange-600\" />
                Vacation Days ({vacations.length})
              </h2>
              <button
                onClick={() => setShowAddVacation(true)}
                className=\"text-sm text-blue-600 hover:underline\"
              >
                + Add
              </button>
            </div>

            {vacations.length === 0 ? (
              <p className=\"text-sm text-gray-500 text-center py-4\">No vacations scheduled</p>
            ) : (
              <div className=\"space-y-2\">
                {vacations.map(vacation => (
                  <div key={vacation.id} className=\"p-3 bg-orange-50 rounded-lg text-sm\">
                    <p className=\"font-medium text-gray-900\">{vacation.reason}</p>
                    <p className=\"text-xs text-gray-600 mt-1\">
                      {vacation.startDate} to {vacation.endDate}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Holidays */}
          <div className=\"bg-white rounded-xl border border-gray-200 p-6\">
            <div className=\"flex items-center justify-between mb-4\">
              <h2 className=\"font-bold text-gray-900 flex items-center gap-2\">
                <Calendar className=\"w-5 h-5 text-purple-600\" />
                Holidays ({holidays.length})
              </h2>
              <button
                onClick={() => setShowAddHoliday(true)}
                className=\"text-sm text-blue-600 hover:underline\"
              >
                + Add
              </button>
            </div>

            {holidays.length === 0 ? (
              <p className=\"text-sm text-gray-500 text-center py-4\">No holidays marked</p>
            ) : (
              <div className=\"space-y-2\">
                {holidays.map(holiday => (
                  <div key={holiday.id} className=\"p-3 bg-purple-50 rounded-lg text-sm\">
                    <p className=\"font-medium text-gray-900\">{holiday.name}</p>
                    <p className=\"text-xs text-gray-600 mt-1\">{holiday.date}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Schedule Modal */}
      <Dialog open={showAddSchedule} onOpenChange={setShowAddSchedule}>
        <DialogContent className=\"max-w-3xl max-h-[90vh] overflow-y-auto\">
          <DialogHeader>
            <DialogTitle>Create New Schedule</DialogTitle>
          </DialogHeader>

          <div className=\"space-y-6 mt-4\">
            {/* Schedule Name */}
            <div>
              <label className=\"block text-sm font-medium text-gray-900 mb-2\">
                Schedule Name
              </label>
              <input
                type=\"text\"
                value={scheduleName}
                onChange={(e) => setScheduleName(e.target.value)}
                className=\"w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent\"
                placeholder=\"e.g., Morning Shift, Evening Clinic\"
              />
            </div>

            {/* Time Range */}
            <div className=\"grid grid-cols-2 gap-4\">
              <div>
                <label className=\"block text-sm font-medium text-gray-900 mb-2\">
                  Start Time
                </label>
                <input
                  type=\"time\"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className=\"w-full px-4 py-2 border border-gray-300 rounded-lg\"
                />
              </div>
              <div>
                <label className=\"block text-sm font-medium text-gray-900 mb-2\">
                  End Time
                </label>
                <input
                  type=\"time\"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className=\"w-full px-4 py-2 border border-gray-300 rounded-lg\"
                />
              </div>
            </div>

            {/* Days of Week */}
            <div>
              <label className=\"block text-sm font-medium text-gray-900 mb-2\">
                Working Days
              </label>
              <div className=\"flex flex-wrap gap-2\">
                {DAY_NAMES.map((day, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      if (selectedDays.includes(index)) {
                        setSelectedDays(selectedDays.filter(d => d !== index));
                      } else {
                        setSelectedDays([...selectedDays, index]);
                      }
                    }}
                    className={`px-4 py-2 rounded-lg border transition-colors ${ 
                      selectedDays.includes(index)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {day.substring(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            {/* Services Selection */}
            <div>
              <label className=\"block text-sm font-medium text-gray-900 mb-2\">
                Services for this Schedule
              </label>
              <p className=\"text-xs text-gray-500 mb-3\">
                Select which services you'll provide during this schedule
              </p>

              {availableServices.length === 0 ? (
                <div className=\"bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800\">
                  <AlertCircle className=\"w-4 h-4 inline mr-2\" />
                  No services available. Please add services to your catalog first.
                </div>
              ) : (
                <div className=\"space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3\">
                  {availableServices.map(service => (
                    <label
                      key={service.id}
                      className=\"flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer\"
                    >
                      <input
                        type=\"checkbox\"
                        checked={selectedServices.some(s => s.serviceId === service.id)}
                        onChange={() => handleToggleService(service)}
                        className=\"w-4 h-4 text-blue-600 rounded\"
                      />
                      <div className=\"flex-1\">
                        <p className=\"font-medium text-gray-900\">{service.name}</p>
                        <p className=\"text-xs text-gray-500\">
                          {service.serviceStyle} • {service.duration || 30} min
                        </p>
                      </div>
                      {!service.isActive && (
                        <span className=\"text-xs text-red-600\">Disabled in catalog</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Home Service Configuration */}
            {hasHomeService && (
              <div className=\"bg-blue-50 border border-blue-200 rounded-lg p-4\">
                <p className=\"text-sm font-medium text-blue-900 mb-3 flex items-center gap-2\">
                  <MapPin className=\"w-4 h-4\" />
                  Home Service Configuration
                </p>
                <div className=\"grid grid-cols-3 gap-3\">
                  <div>
                    <label className=\"block text-xs text-blue-800 mb-1\">Service Radius (KM)</label>
                    <input
                      type=\"number\"
                      value={homeRadius}
                      onChange={(e) => setHomeRadius(Number(e.target.value))}
                      className=\"w-full px-3 py-2 border border-blue-300 rounded-lg\"
                      min=\"1\"
                      max=\"50\"
                    />
                  </div>
                  <div>
                    <label className=\"block text-xs text-blue-800 mb-1\">Lead Time</label>
                    <input
                      type=\"number\"
                      value={leadTime}
                      onChange={(e) => setLeadTime(Number(e.target.value))}
                      className=\"w-full px-3 py-2 border border-blue-300 rounded-lg\"
                      min=\"15\"
                    />
                  </div>
                  <div>
                    <label className=\"block text-xs text-blue-800 mb-1\">Unit</label>
                    <select
                      value={leadTimeUnit}
                      onChange={(e) => setLeadTimeUnit(e.target.value)}
                      className=\"w-full px-3 py-2 border border-blue-300 rounded-lg\"
                    >
                      <option value=\"minutes\">Minutes</option>
                      <option value=\"hours\">Hours</option>
                    </select>
                  </div>
                </div>
                <p className=\"text-xs text-blue-700 mt-2\">
                  You'll travel up to {homeRadius}km, with {leadTime} {leadTimeUnit} notice
                </p>
              </div>
            )}

            {/* Buffer Time */}
            <div>
              <label className=\"block text-sm font-medium text-gray-900 mb-2\">
                Buffer Time Between Appointments (minutes)
              </label>
              <input
                type=\"number\"
                value={bufferTime}
                onChange={(e) => setBufferTime(Number(e.target.value))}
                className=\"w-full px-4 py-2 border border-gray-300 rounded-lg\"
                min=\"5\"
                step=\"5\"
              />
            </div>

            {/* Breaks */}
            <div>
              <div className=\"flex items-center justify-between mb-2\">
                <label className=\"block text-sm font-medium text-gray-900\">
                  Breaks
                </label>
                <button
                  onClick={handleAddBreak}
                  className=\"text-sm text-blue-600 hover:underline\"
                >
                  + Add Break
                </button>
              </div>

              {breaks.length === 0 ? (
                <p className=\"text-sm text-gray-500\">No breaks added</p>
              ) : (
                <div className=\"space-y-2\">
                  {breaks.map((br, index) => (
                    <div key={br.id} className=\"flex items-center gap-2\">
                      <input
                        type=\"text\"
                        value={br.name}
                        onChange={(e) => {
                          const updated = [...breaks];
                          updated[index].name = e.target.value;
                          setBreaks(updated);
                        }}
                        className=\"flex-1 px-3 py-2 border border-gray-300 rounded-lg\"
                        placeholder=\"Break name\"
                      />
                      <input
                        type=\"time\"
                        value={br.startTime}
                        onChange={(e) => {
                          const updated = [...breaks];
                          updated[index].startTime = e.target.value;
                          setBreaks(updated);
                        }}
                        className=\"px-3 py-2 border border-gray-300 rounded-lg\"
                      />
                      <span className=\"text-gray-500\">-</span>
                      <input
                        type=\"time\"
                        value={br.endTime}
                        onChange={(e) => {
                          const updated = [...breaks];
                          updated[index].endTime = e.target.value;
                          setBreaks(updated);
                        }}
                        className=\"px-3 py-2 border border-gray-300 rounded-lg\"
                      />
                      <button
                        onClick={() => handleRemoveBreak(index)}
                        className=\"p-2 hover:bg-red-50 rounded-lg\"
                      >
                        <X className=\"w-4 h-4 text-red-600\" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className=\"flex justify-end gap-3 pt-4 border-t\">
              <Button
                onClick={() => {
                  setShowAddSchedule(false);
                  resetForm();
                }}
                variant=\"outline\"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddSchedule}
                className=\"bg-blue-600 hover:bg-blue-700 text-white\"
              >
                <Save className=\"w-4 h-4 mr-2\" />
                Create Schedule
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Vacation Modal */}
      <AddVacationModal
        isOpen={showAddVacation}
        onClose={() => setShowAddVacation(false)}
        onSubmit={handleAddVacation}
      />

      {/* Add Holiday Modal */}
      <AddHolidayModal
        isOpen={showAddHoliday}
        onClose={() => setShowAddHoliday(false)}
        onSubmit={handleAddHoliday}
      />
    </div>
  );
}

// Vacation Modal Component
function AddVacationModal({ isOpen, onClose, onSubmit }: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (startDate: string, endDate: string, reason: string) => void;
}) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Vacation</DialogTitle>
        </DialogHeader>
        <div className=\"space-y-4 mt-4\">
          <div>
            <label className=\"block text-sm font-medium mb-2\">Start Date</label>
            <input
              type=\"date\"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className=\"w-full px-4 py-2 border rounded-lg\"
            />
          </div>
          <div>
            <label className=\"block text-sm font-medium mb-2\">End Date</label>
            <input
              type=\"date\"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className=\"w-full px-4 py-2 border rounded-lg\"
            />
          </div>
          <div>
            <label className=\"block text-sm font-medium mb-2\">Reason</label>
            <input
              type=\"text\"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className=\"w-full px-4 py-2 border rounded-lg\"
              placeholder=\"Personal Leave, Family Trip, etc.\"
            />
          </div>
          <div className=\"flex justify-end gap-3\">
            <Button onClick={onClose} variant=\"outline\">Cancel</Button>
            <Button
              onClick={() => {
                if (startDate && endDate && reason) {
                  onSubmit(startDate, endDate, reason);
                } else {
                  toast.error('Please fill all fields');
                }
              }}
              className=\"bg-orange-600 hover:bg-orange-700 text-white\"
            >
              Add Vacation
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Holiday Modal Component
function AddHolidayModal({ isOpen, onClose, onSubmit }: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (date: string, name: string) => void;
}) {
  const [date, setDate] = useState('');
  const [name, setName] = useState('');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Holiday</DialogTitle>
        </DialogHeader>
        <div className=\"space-y-4 mt-4\">
          <div>
            <label className=\"block text-sm font-medium mb-2\">Date</label>
            <input
              type=\"date\"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className=\"w-full px-4 py-2 border rounded-lg\"
            />
          </div>
          <div>
            <label className=\"block text-sm font-medium mb-2\">Holiday Name</label>
            <input
              type=\"text\"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className=\"w-full px-4 py-2 border rounded-lg\"
              placeholder=\"Diwali, Christmas, etc.\"
            />
          </div>
          <div className=\"flex justify-end gap-3\">
            <Button onClick={onClose} variant=\"outline\">Cancel</Button>
            <Button
              onClick={() => {
                if (date && name) {
                  onSubmit(date, name);
                } else {
                  toast.error('Please fill all fields');
                }
              }}
              className=\"bg-purple-600 hover:bg-purple-700 text-white\"
            >
              Add Holiday
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
