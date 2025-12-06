# 🎯 Warmpawz Critical Gaps - Task List

## Implementation Strategy
- ✅ Keep existing KV store architecture
- ✅ Maintain Supabase Edge Functions + Deno runtime
- ✅ Preserve #FF8C42 orange brand color
- ✅ Keep mobile-first 430px max-width design
- ✅ Minimal UI changes - enhance existing screens
- ✅ Reuse existing components and patterns

---

## 📋 TASK CATEGORIES

### 🔴 **CRITICAL PRIORITY** (Week 1-4)
### 🟡 **HIGH PRIORITY** (Week 5-8)  
### 🟢 **MEDIUM PRIORITY** (Week 9-12)

---

# 🔴 CRITICAL PRIORITY TASKS (Week 1-4)

## **CATEGORY 1: DOCTOR SEARCH & DISCOVERY**

### Task 1.1: Add Doctor Search by Name
**Priority**: 🔴 CRITICAL  
**Effort**: 4 hours  
**Files to Modify**:
- `/components/customer/vet/VetClinicListView.tsx`
- `/supabase/functions/server/index.tsx` (add search endpoint)

**Acceptance Criteria**:
- [ ] Search bar accepts doctor name input
- [ ] Search returns doctors matching name (case-insensitive)
- [ ] Results show doctor's clinic, specialization, fee
- [ ] Works alongside existing clinic search
- [ ] Uses existing orange search UI design

**Implementation Details**:
```typescript
// Add to VetClinicListView.tsx
const [searchType, setSearchType] = useState<'clinic' | 'doctor'>('clinic');

// API Endpoint: /customer/doctors/search?query=sharma&roleId=veterinarian
// Response: { doctors: [{ id, name, clinicName, specialization, fee, photo }] }

// UI: Toggle between "Search Clinics" and "Search Doctors"
<div className="flex gap-2 mb-3">
  <button 
    className={searchType === 'clinic' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100'}
    onClick={() => setSearchType('clinic')}
  >
    Clinics
  </button>
  <button 
    className={searchType === 'doctor' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100'}
    onClick={() => setSearchType('doctor')}
  >
    Doctors
  </button>
</div>
```

**KV Store Keys**:
```
doctor:${doctorId} → { name, clinicId, specialization, fee, ... }
clinic:${clinicId}:doctors → [doctorId1, doctorId2, ...]
```

---

### Task 1.2: Add Fee Range Filter
**Priority**: 🔴 CRITICAL  
**Effort**: 3 hours  
**Files to Modify**:
- `/components/customer/vet/VetClinicListView.tsx` (filter sheet)

**Acceptance Criteria**:
- [ ] Add fee range slider in filter sheet (₹0 - ₹2000)
- [ ] Filter works on both clinic and doctor search
- [ ] Shows fee range on doctor/clinic cards
- [ ] Preserves other active filters
- [ ] Uses existing orange slider design

**Implementation Details**:
```typescript
// Add to existing filter sheet
const [feeRange, setFeeRange] = useState<[number, number]>([0, 2000]);

// In filter sheet (existing Sheet component)
<div className="mb-4">
  <label className="block text-sm font-medium mb-2">Consultation Fee</label>
  <input 
    type="range" 
    min="0" 
    max="2000" 
    step="100"
    value={feeRange[1]}
    onChange={(e) => setFeeRange([0, parseInt(e.target.value)])}
    className="w-full accent-[#FF8C42]"
  />
  <div className="flex justify-between text-xs text-gray-600">
    <span>₹0</span>
    <span>₹{feeRange[1]}</span>
  </div>
</div>

// Filter logic
filtered = filtered.filter(item => {
  const fee = item.consultationFee || item.fee || 0;
  return fee >= feeRange[0] && fee <= feeRange[1];
});
```

---

### Task 1.3: Add Experience Filter
**Priority**: 🔴 CRITICAL  
**Effort**: 2 hours  
**Files to Modify**:
- `/components/customer/vet/VetClinicListView.tsx`

**Acceptance Criteria**:
- [ ] Add experience filter (0-5, 5-10, 10-15, 15+ years)
- [ ] Show experience years on doctor cards
- [ ] Works with other filters
- [ ] Uses existing checkbox design

**Implementation Details**:
```typescript
const [experienceFilter, setExperienceFilter] = useState<string[]>([]);

// In filter sheet
<div className="mb-4">
  <label className="block text-sm font-medium mb-2">Experience</label>
  {['0-5 years', '5-10 years', '10-15 years', '15+ years'].map(range => (
    <label key={range} className="flex items-center gap-2 mb-2">
      <input 
        type="checkbox" 
        checked={experienceFilter.includes(range)}
        onChange={(e) => {
          if (e.target.checked) {
            setExperienceFilter([...experienceFilter, range]);
          } else {
            setExperienceFilter(experienceFilter.filter(r => r !== range));
          }
        }}
        className="accent-[#FF8C42]"
      />
      <span className="text-sm">{range}</span>
    </label>
  ))}
</div>

// Update doctor KV data to include experience_years field
doctor:${doctorId} → { ..., experience_years: 8 }
```

---

### Task 1.4: Display "Next Available" Slot
**Priority**: 🔴 CRITICAL  
**Effort**: 6 hours  
**Files to Modify**:
- `/components/customer/vet/VetClinicListView.tsx`
- `/components/customer/vet/VetDoctorDetails.tsx`
- `/supabase/functions/server/vendor-schedule-v2.tsx`

**Acceptance Criteria**:
- [ ] Show "Next Available: Today 3 PM" badge on doctor/clinic cards
- [ ] Calculate from real availability data
- [ ] Show "Book Now" for today's slots, "Book" for future
- [ ] Update in real-time when slots are booked
- [ ] Orange badge for immediate availability (<2 hours)

**Implementation Details**:
```typescript
// API: /doctor/${doctorId}/next-available
// Response: { nextSlot: "2025-11-20T15:00:00", isToday: true }

// In VetClinicListView.tsx - add to card
{doctor.nextAvailable && (
  <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
    doctor.nextAvailable.isToday 
      ? 'bg-[#FF8C42] text-white' 
      : 'bg-orange-50 text-[#FF8C42]'
  }`}>
    <Clock className="w-3 h-3" />
    Next: {doctor.nextAvailable.isToday ? 'Today' : 'Tomorrow'} {doctor.nextAvailable.time}
  </div>
)}

// Backend: Calculate next available from doctor_availability KV key
const getNextAvailable = async (doctorId: string) => {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  
  // Check today's slots
  const todayAvail = await kv.get(`doctor:${doctorId}:availability:${today}`);
  if (todayAvail?.slots) {
    const available = todayAvail.slots.find(s => s.status === 'available');
    if (available) return { time: available.start, isToday: true };
  }
  
  // Check tomorrow's slots
  const tomorrowAvail = await kv.get(`doctor:${doctorId}:availability:${tomorrow}`);
  if (tomorrowAvail?.slots) {
    const available = tomorrowAvail.slots.find(s => s.status === 'available');
    if (available) return { time: available.start, isToday: false };
  }
  
  return null;
};
```

**KV Store Keys**:
```
doctor:${doctorId}:availability:${date} → { slots: [{ start, end, status }] }
```

---

## **CATEGORY 2: SMART SCHEDULING**

### Task 2.1: Add Break Time Management
**Priority**: 🔴 CRITICAL  
**Effort**: 5 hours  
**Files to Modify**:
- `/components/vendor/VendorScheduleManagement.tsx`
- `/supabase/functions/server/vendor-schedule-v2.tsx`

**Acceptance Criteria**:
- [ ] Doctors can add multiple breaks (lunch, tea break)
- [ ] Breaks show as "unavailable" in slot display
- [ ] Breaks don't accept bookings
- [ ] Can edit/delete breaks
- [ ] Uses existing orange schedule UI

**Implementation Details**:
```typescript
// Add to VendorScheduleManagement.tsx
const [breaks, setBreaks] = useState<Break[]>([]);

interface Break {
  id: string;
  start: string; // "13:00"
  end: string;   // "14:00"
  type: 'lunch' | 'tea' | 'personal';
  label: string;
}

// UI: Add "Manage Breaks" button in schedule screen
<button 
  onClick={() => setShowBreakModal(true)}
  className="px-4 py-2 bg-orange-50 text-[#FF8C42] rounded-lg"
>
  <Coffee className="w-4 h-4 inline mr-2" />
  Manage Breaks
</button>

// Modal for adding breaks
<Dialog open={showBreakModal} onOpenChange={setShowBreakModal}>
  <DialogContent className="max-w-[400px]">
    <DialogHeader>
      <DialogTitle>Add Break Time</DialogTitle>
    </DialogHeader>
    
    <div className="space-y-3">
      <select className="w-full border rounded px-3 py-2">
        <option value="lunch">Lunch Break</option>
        <option value="tea">Tea Break</option>
        <option value="personal">Personal</option>
      </select>
      
      <div className="grid grid-cols-2 gap-3">
        <input type="time" placeholder="Start" className="border rounded px-3 py-2" />
        <input type="time" placeholder="End" className="border rounded px-3 py-2" />
      </div>
      
      <button className="w-full bg-[#FF8C42] text-white py-2 rounded-lg">
        Add Break
      </button>
    </div>
  </DialogContent>
</Dialog>

// API: POST /doctor/${doctorId}/breaks
// Payload: { breaks: [{ start, end, type, label }] }
```

**KV Store Keys**:
```
doctor:${doctorId}:breaks → [{ id, start, end, type, label, recurring: 'daily' }]
doctor:${doctorId}:availability:${date} → { slots: [...], breaks: [...] }
```

---

### Task 2.2: Add Buffer Time Between Appointments
**Priority**: 🔴 CRITICAL  
**Effort**: 4 hours  
**Files to Modify**:
- `/components/vendor/VendorScheduleManagement.tsx`
- `/supabase/functions/server/vendor-schedule-v2.tsx`

**Acceptance Criteria**:
- [ ] Doctors can set buffer time (0, 5, 10, 15 minutes)
- [ ] Buffer time automatically added after each appointment
- [ ] Prevents back-to-back bookings
- [ ] Shows in slot calculation
- [ ] Persists across sessions

**Implementation Details**:
```typescript
// Add to VendorScheduleManagement.tsx
const [bufferMinutes, setBufferMinutes] = useState(5);

// UI: Add buffer setting in schedule preferences
<div className="mb-4 p-4 bg-gray-50 rounded-lg">
  <label className="block text-sm font-medium mb-2">
    Buffer Time Between Appointments
  </label>
  <select 
    value={bufferMinutes}
    onChange={(e) => setBufferMinutes(parseInt(e.target.value))}
    className="w-full border rounded px-3 py-2"
  >
    <option value="0">No buffer</option>
    <option value="5">5 minutes</option>
    <option value="10">10 minutes (Recommended)</option>
    <option value="15">15 minutes</option>
  </select>
  <p className="text-xs text-gray-600 mt-2">
    Buffer time prevents overbooking and gives you time to prepare for next patient
  </p>
</div>

// Slot generation logic
const generateSlots = (startTime, endTime, slotDuration, bufferMinutes, breaks) => {
  const slots = [];
  let currentTime = startTime;
  
  while (currentTime < endTime) {
    const slotEnd = addMinutes(currentTime, slotDuration);
    
    // Check if slot overlaps with break
    const overlapsBreak = breaks.some(b => 
      (currentTime >= b.start && currentTime < b.end) ||
      (slotEnd > b.start && slotEnd <= b.end)
    );
    
    if (!overlapsBreak) {
      slots.push({ start: currentTime, end: slotEnd, status: 'available' });
    }
    
    // Add buffer time
    currentTime = addMinutes(slotEnd, bufferMinutes);
  }
  
  return slots;
};
```

**KV Store Keys**:
```
doctor:${doctorId}:preferences → { bufferMinutes: 10, slotDuration: 30 }
```

---

### Task 2.3: Add Holiday/Leave Calendar
**Priority**: 🔴 CRITICAL  
**Effort**: 5 hours  
**Files to Modify**:
- `/components/vendor/VendorScheduleManagement.tsx`

**Acceptance Criteria**:
- [ ] Doctors can mark full-day holidays
- [ ] Doctors can mark half-day leaves
- [ ] Shows in calendar view with orange background
- [ ] Prevents bookings on holidays
- [ ] Can set recurring holidays (every Sunday)

**Implementation Details**:
```typescript
// Add to VendorScheduleManagement.tsx
const [holidays, setHolidays] = useState<Holiday[]>([]);

interface Holiday {
  date: string;
  type: 'full_day' | 'half_day';
  reason: string;
  isRecurring: boolean;
  recurringDay?: number; // 0-6 for Sunday-Saturday
}

// UI: Add "Mark Holiday" button in calendar
<button 
  onClick={() => setShowHolidayModal(true)}
  className="px-4 py-2 bg-orange-50 text-[#FF8C42] rounded-lg"
>
  <CalendarOff className="w-4 h-4 inline mr-2" />
  Mark Holiday
</button>

// Modal for marking holidays
<Dialog open={showHolidayModal} onOpenChange={setShowHolidayModal}>
  <DialogContent className="max-w-[400px]">
    <DialogHeader>
      <DialogTitle>Mark Holiday / Leave</DialogTitle>
    </DialogHeader>
    
    <div className="space-y-3">
      <input 
        type="date" 
        min={new Date().toISOString().split('T')[0]}
        className="w-full border rounded px-3 py-2"
      />
      
      <select className="w-full border rounded px-3 py-2">
        <option value="full_day">Full Day Leave</option>
        <option value="half_day">Half Day Leave</option>
      </select>
      
      <input 
        type="text" 
        placeholder="Reason (optional)" 
        className="w-full border rounded px-3 py-2"
      />
      
      <label className="flex items-center gap-2">
        <input type="checkbox" className="accent-[#FF8C42]" />
        <span className="text-sm">Repeat every week (e.g., every Sunday)</span>
      </label>
      
      <button className="w-full bg-[#FF8C42] text-white py-2 rounded-lg">
        Mark Holiday
      </button>
    </div>
  </DialogContent>
</Dialog>

// Calendar UI: Show holidays with orange background
{isHoliday(date) && (
  <div className="absolute inset-0 bg-orange-100 opacity-30 pointer-events-none" />
)}
```

**KV Store Keys**:
```
doctor:${doctorId}:holidays → [{ date, type, reason, isRecurring, recurringDay }]
```

---

## **CATEGORY 3: HEALTH RECORDS MANAGEMENT**

### Task 3.1: Add Medical History Section
**Priority**: 🔴 CRITICAL  
**Effort**: 6 hours  
**Files to Modify**:
- `/components/customer/CustomerPetProfile.tsx` (or create new PetMedicalRecords.tsx)
- `/supabase/functions/server/index.tsx`

**Acceptance Criteria**:
- [ ] Add "Medical History" tab in pet profile
- [ ] List all past illnesses with dates
- [ ] List all surgeries with details
- [ ] Show chronic conditions (ongoing)
- [ ] Allow customer to add/edit entries
- [ ] Uses existing orange card design

**Implementation Details**:
```typescript
// Create new component or add tab to CustomerPetProfile.tsx
const [activeTab, setActiveTab] = useState<'overview' | 'medical' | 'bookings'>('overview');

// Medical History Data Structure
interface MedicalHistory {
  id: string;
  petId: string;
  type: 'illness' | 'surgery' | 'chronic' | 'allergy';
  condition: string;
  date: string;
  notes: string;
  treatedBy?: string; // Doctor name
  severity: 'mild' | 'moderate' | 'severe';
  status: 'resolved' | 'ongoing';
  createdAt: string;
}

// UI: Tab navigation
<div className="flex border-b mb-4">
  <button 
    className={`px-4 py-2 ${activeTab === 'medical' ? 'border-b-2 border-[#FF8C42] text-[#FF8C42]' : 'text-gray-600'}`}
    onClick={() => setActiveTab('medical')}
  >
    Medical History
  </button>
</div>

// Medical History List
<div className="space-y-3">
  {medicalHistory.map(record => (
    <div key={record.id} className="p-4 border border-gray-200 rounded-lg">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="font-medium">{record.condition}</h4>
          <p className="text-xs text-gray-600">{formatDate(record.date)}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded ${
          record.status === 'ongoing' 
            ? 'bg-orange-50 text-[#FF8C42]' 
            : 'bg-green-50 text-green-700'
        }`}>
          {record.status}
        </span>
      </div>
      {record.notes && (
        <p className="text-sm text-gray-700 mb-2">{record.notes}</p>
      )}
      {record.treatedBy && (
        <p className="text-xs text-gray-600">Treated by: {record.treatedBy}</p>
      )}
    </div>
  ))}
  
  <button 
    onClick={() => setShowAddMedicalHistory(true)}
    className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-[#FF8C42] hover:text-[#FF8C42]"
  >
    + Add Medical History
  </button>
</div>

// API Endpoints
// GET /pet/${petId}/medical-history
// POST /pet/${petId}/medical-history
// PUT /pet/${petId}/medical-history/${recordId}
// DELETE /pet/${petId}/medical-history/${recordId}
```

**KV Store Keys**:
```
pet:${petId}:medical_history → [{ id, type, condition, date, notes, ... }]
pet:${petId}:chronic_conditions → ['Diabetes', 'Arthritis']
pet:${petId}:allergies → ['Penicillin', 'Chicken']
```

---

### Task 3.2: Add Vaccination Records
**Priority**: 🔴 CRITICAL  
**Effort**: 5 hours  
**Files to Modify**:
- `/components/customer/CustomerPetProfile.tsx`

**Acceptance Criteria**:
- [ ] List all vaccines with dates
- [ ] Show upcoming vaccines (due dates)
- [ ] Alert for overdue vaccines (red badge)
- [ ] Can upload vaccination certificate
- [ ] Can add manual vaccine entries
- [ ] Shows breed-specific vaccine schedule

**Implementation Details**:
```typescript
interface Vaccination {
  id: string;
  petId: string;
  vaccineName: string;
  vaccineType: 'core' | 'non_core';
  administeredDate: string;
  dueDate?: string;
  nextDueDate?: string;
  administeredBy?: string; // Doctor name
  clinicName?: string;
  certificateUrl?: string;
  batchNumber?: string;
  status: 'completed' | 'upcoming' | 'overdue';
}

// UI: Vaccination tab
<div className="space-y-3">
  {/* Overdue vaccines - Red alert */}
  {overdueVaccines.length > 0 && (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle className="w-5 h-5 text-red-600" />
        <h4 className="font-medium text-red-900">Overdue Vaccinations</h4>
      </div>
      {overdueVaccines.map(v => (
        <div key={v.id} className="text-sm text-red-800 mb-1">
          • {v.vaccineName} - Due {formatDate(v.nextDueDate)}
        </div>
      ))}
      <button className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm">
        Book Vaccination Appointment
      </button>
    </div>
  )}
  
  {/* Upcoming vaccines - Orange alert */}
  {upcomingVaccines.length > 0 && (
    <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <Clock className="w-5 h-5 text-[#FF8C42]" />
        <h4 className="font-medium text-gray-900">Upcoming Vaccinations</h4>
      </div>
      {upcomingVaccines.map(v => (
        <div key={v.id} className="text-sm text-gray-700 mb-1">
          • {v.vaccineName} - Due {formatDate(v.nextDueDate)}
        </div>
      ))}
    </div>
  )}
  
  {/* Completed vaccines */}
  <h4 className="font-medium mt-4">Vaccination History</h4>
  {completedVaccines.map(v => (
    <div key={v.id} className="p-3 border border-gray-200 rounded-lg">
      <div className="flex items-start justify-between">
        <div>
          <h5 className="font-medium">{v.vaccineName}</h5>
          <p className="text-xs text-gray-600">
            Given on {formatDate(v.administeredDate)}
          </p>
          {v.administeredBy && (
            <p className="text-xs text-gray-600">By: {v.administeredBy}</p>
          )}
        </div>
        {v.certificateUrl && (
          <button className="text-[#FF8C42] text-xs">
            View Certificate
          </button>
        )}
      </div>
    </div>
  ))}
  
  <button className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600">
    + Add Vaccination Record
  </button>
</div>

// Breed-specific vaccine schedule
const VACCINE_SCHEDULES = {
  'dog': [
    { name: 'DHPP (Distemper, Hepatitis, Parainfluenza, Parvovirus)', weeks: [6, 9, 12, 16], yearly: true },
    { name: 'Rabies', weeks: [16], yearly: true },
    { name: 'Leptospirosis', weeks: [12, 16], yearly: true },
    { name: 'Bordetella', weeks: [16], yearly: true }
  ],
  'cat': [
    { name: 'FVRCP (Feline Viral Rhinotracheitis, Calicivirus, Panleukopenia)', weeks: [6, 9, 12, 16], yearly: true },
    { name: 'Rabies', weeks: [16], yearly: true },
    { name: 'FeLV (Feline Leukemia)', weeks: [12, 16], yearly: false }
  ]
};
```

**KV Store Keys**:
```
pet:${petId}:vaccinations → [{ id, vaccineName, administeredDate, nextDueDate, ... }]
pet:${petId}:vaccine_schedule → { species: 'dog', breed: 'labrador', schedule: [...] }
```

---

### Task 3.3: Add Lab Reports Storage
**Priority**: 🔴 CRITICAL  
**Effort**: 4 hours  
**Files to Modify**:
- `/components/customer/CustomerPetProfile.tsx`
- `/supabase/functions/server/index.tsx` (file upload endpoint)

**Acceptance Criteria**:
- [ ] Upload PDF/image lab reports
- [ ] Categorize reports (Blood, Urine, X-ray, etc.)
- [ ] View reports in-app (PDF viewer)
- [ ] Download reports
- [ ] Share with doctors
- [ ] Search reports by date/type

**Implementation Details**:
```typescript
interface LabReport {
  id: string;
  petId: string;
  reportType: 'blood' | 'urine' | 'xray' | 'ultrasound' | 'other';
  reportName: string;
  testDate: string;
  uploadedDate: string;
  fileUrl: string;
  fileType: 'pdf' | 'image';
  linkedAppointmentId?: string;
  notes?: string;
  abnormalFindings?: string[];
}

// UI: Lab Reports tab
<div className="space-y-3">
  {/* Upload button */}
  <button 
    onClick={() => setShowUploadReport(true)}
    className="w-full py-3 bg-[#FF8C42] text-white rounded-lg flex items-center justify-center gap-2"
  >
    <Upload className="w-4 h-4" />
    Upload Lab Report
  </button>
  
  {/* Filter by type */}
  <div className="flex gap-2 overflow-x-auto pb-2">
    {['All', 'Blood', 'Urine', 'X-ray', 'Ultrasound', 'Other'].map(type => (
      <button
        key={type}
        className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${
          selectedType === type 
            ? 'bg-[#FF8C42] text-white' 
            : 'bg-gray-100 text-gray-700'
        }`}
        onClick={() => setSelectedType(type)}
      >
        {type}
      </button>
    ))}
  </div>
  
  {/* Reports list */}
  {labReports.map(report => (
    <div key={report.id} className="p-4 border border-gray-200 rounded-lg">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h5 className="font-medium">{report.reportName}</h5>
          <p className="text-xs text-gray-600">
            {formatDate(report.testDate)} • {report.reportType}
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => window.open(report.fileUrl)}
            className="text-[#FF8C42] text-xs"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button 
            onClick={() => downloadReport(report)}
            className="text-gray-600 text-xs"
          >
            <Download className="w-4 h-4" />
          </button>
          <button 
            onClick={() => shareReport(report)}
            className="text-gray-600 text-xs"
          >
            <Share className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {report.abnormalFindings && report.abnormalFindings.length > 0 && (
        <div className="p-2 bg-orange-50 rounded text-xs">
          <span className="font-medium text-[#FF8C42]">⚠ Abnormal:</span>
          <span className="text-gray-700 ml-1">
            {report.abnormalFindings.join(', ')}
          </span>
        </div>
      )}
    </div>
  ))}
</div>

// Upload modal
<Dialog open={showUploadReport} onOpenChange={setShowUploadReport}>
  <DialogContent className="max-w-[400px]">
    <DialogHeader>
      <DialogTitle>Upload Lab Report</DialogTitle>
    </DialogHeader>
    
    <div className="space-y-3">
      <input 
        type="text" 
        placeholder="Report Name (e.g., Blood Test - Nov 2025)" 
        className="w-full border rounded px-3 py-2"
      />
      
      <select className="w-full border rounded px-3 py-2">
        <option value="">Select Report Type</option>
        <option value="blood">Blood Test</option>
        <option value="urine">Urine Test</option>
        <option value="xray">X-ray</option>
        <option value="ultrasound">Ultrasound</option>
        <option value="other">Other</option>
      </select>
      
      <input 
        type="date" 
        placeholder="Test Date" 
        className="w-full border rounded px-3 py-2"
      />
      
      <input 
        type="file" 
        accept=".pdf,.jpg,.jpeg,.png"
        className="w-full border rounded px-3 py-2"
      />
      
      <button className="w-full bg-[#FF8C42] text-white py-2 rounded-lg">
        Upload Report
      </button>
    </div>
  </DialogContent>
</Dialog>
```

**KV Store Keys**:
```
pet:${petId}:lab_reports → [{ id, reportType, reportName, fileUrl, ... }]
file:${fileId} → { url, type, uploadedAt, petId }
```

**Use Existing Supabase Storage**:
```typescript
// Reuse existing storage upload endpoint
POST /storage/upload-multiple
// Bucket: make-3dd53475-pet-records
// Path: ${petId}/lab-reports/${timestamp}-${filename}
```

---

## **CATEGORY 4: PAYMENT TRANSPARENCY**

### Task 4.1: Add Fee Breakdown Display
**Priority**: 🔴 CRITICAL  
**Effort**: 3 hours  
**Files to Modify**:
- `/components/customer/vet/VetPaymentScreen.tsx`
- `/components/customer/booking/BookingSummary.tsx`

**Acceptance Criteria**:
- [ ] Show consultation fee separately
- [ ] Show platform/convenience fee
- [ ] Show taxes (GST breakdown)
- [ ] Show total with clear math
- [ ] Highlight any discounts applied
- [ ] Uses existing orange payment design

**Implementation Details**:
```typescript
// Fee Structure
interface FeeBreakdown {
  consultationFee: number;
  platformFee: number;
  gst: number;
  discount: number;
  total: number;
}

// Calculate fees
const calculateFees = (consultationFee: number, discountPercent: number = 0) => {
  const platformFeePercent = 5; // 5% platform fee
  const gstPercent = 18; // 18% GST
  
  const platformFee = Math.round(consultationFee * platformFeePercent / 100);
  const subtotal = consultationFee + platformFee;
  const discount = Math.round(subtotal * discountPercent / 100);
  const afterDiscount = subtotal - discount;
  const gst = Math.round(afterDiscount * gstPercent / 100);
  const total = afterDiscount + gst;
  
  return { consultationFee, platformFee, gst, discount, total };
};

// UI: Fee breakdown in payment screen
<div className="p-4 bg-gray-50 rounded-lg mb-4">
  <h3 className="font-medium mb-3">Payment Breakdown</h3>
  
  <div className="space-y-2 text-sm">
    <div className="flex justify-between">
      <span className="text-gray-700">Consultation Fee</span>
      <span className="font-medium">₹{fees.consultationFee}</span>
    </div>
    
    <div className="flex justify-between">
      <span className="text-gray-700">Platform Fee (5%)</span>
      <span className="font-medium">₹{fees.platformFee}</span>
    </div>
    
    {fees.discount > 0 && (
      <div className="flex justify-between text-green-600">
        <span>Discount</span>
        <span>- ₹{fees.discount}</span>
      </div>
    )}
    
    <div className="flex justify-between">
      <span className="text-gray-700">GST (18%)</span>
      <span className="font-medium">₹{fees.gst}</span>
    </div>
    
    <div className="border-t border-gray-300 pt-2 mt-2"></div>
    
    <div className="flex justify-between text-base">
      <span className="font-semibold">Total Amount</span>
      <span className="font-bold text-[#FF8C42]">₹{fees.total}</span>
    </div>
  </div>
  
  <p className="text-xs text-gray-600 mt-3">
    💡 Platform fee helps us maintain quality service and support
  </p>
</div>

// Also show on booking confirmation
<div className="text-xs text-gray-600 mt-2">
  Includes: Consultation (₹{fees.consultationFee}) + Platform Fee (₹{fees.platformFee}) + GST (₹{fees.gst})
</div>
```

---

### Task 4.2: Add Multiple Payment Method Support
**Priority**: 🟡 HIGH  
**Effort**: 6 hours  
**Files to Modify**:
- `/components/customer/vet/VetPaymentScreen.tsx`
- `/supabase/functions/server/payment-endpoints.tsx`

**Acceptance Criteria**:
- [ ] UPI payment option
- [ ] Card payment option (existing)
- [ ] Wallet payment option
- [ ] "Pay at Clinic" option (if enabled by doctor)
- [ ] Show preferred method from previous booking
- [ ] Uses existing orange payment UI

**Implementation Details**:
```typescript
type PaymentMethod = 'upi' | 'card' | 'wallet' | 'pay_at_clinic';

const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('upi');

// UI: Payment method selector
<div className="mb-4">
  <h3 className="font-medium mb-3">Select Payment Method</h3>
  
  <div className="space-y-2">
    {/* UPI */}
    <button
      onClick={() => setSelectedMethod('upi')}
      className={`w-full p-4 border-2 rounded-lg flex items-center gap-3 ${
        selectedMethod === 'upi' 
          ? 'border-[#FF8C42] bg-orange-50' 
          : 'border-gray-200'
      }`}
    >
      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
        📱
      </div>
      <div className="flex-1 text-left">
        <div className="font-medium">UPI</div>
        <div className="text-xs text-gray-600">Pay via Google Pay, PhonePe, Paytm</div>
      </div>
      {selectedMethod === 'upi' && (
        <div className="w-5 h-5 bg-[#FF8C42] rounded-full flex items-center justify-center">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
    </button>
    
    {/* Card */}
    <button
      onClick={() => setSelectedMethod('card')}
      className={`w-full p-4 border-2 rounded-lg flex items-center gap-3 ${
        selectedMethod === 'card' 
          ? 'border-[#FF8C42] bg-orange-50' 
          : 'border-gray-200'
      }`}
    >
      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
        💳
      </div>
      <div className="flex-1 text-left">
        <div className="font-medium">Credit / Debit Card</div>
        <div className="text-xs text-gray-600">Visa, Mastercard, Amex</div>
      </div>
      {selectedMethod === 'card' && (
        <div className="w-5 h-5 bg-[#FF8C42] rounded-full flex items-center justify-center">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
    </button>
    
    {/* Pay at Clinic (if enabled) */}
    {doctor.allowPayAtClinic && (
      <button
        onClick={() => setSelectedMethod('pay_at_clinic')}
        className={`w-full p-4 border-2 rounded-lg flex items-center gap-3 ${
          selectedMethod === 'pay_at_clinic' 
            ? 'border-[#FF8C42] bg-orange-50' 
            : 'border-gray-200'
        }`}
      >
        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
          🏥
        </div>
        <div className="flex-1 text-left">
          <div className="font-medium">Pay at Clinic</div>
          <div className="text-xs text-gray-600">Pay in cash or card at clinic</div>
        </div>
        {selectedMethod === 'pay_at_clinic' && (
          <div className="w-5 h-5 bg-[#FF8C42] rounded-full flex items-center justify-center">
            <Check className="w-3 h-3 text-white" />
          </div>
        )}
      </button>
    )}
  </div>
</div>

// UPI payment flow
{selectedMethod === 'upi' && (
  <div className="mb-4">
    <input 
      type="text" 
      placeholder="Enter UPI ID (e.g., user@paytm)"
      className="w-full border rounded px-3 py-2 mb-2"
    />
    <p className="text-xs text-gray-600">
      You'll receive a payment request on your UPI app
    </p>
  </div>
)}

// Payment button
<button 
  onClick={handlePayment}
  className="w-full bg-[#FF8C42] text-white py-3 rounded-lg font-medium"
>
  {selectedMethod === 'pay_at_clinic' 
    ? 'Confirm Booking (Pay Later)' 
    : `Pay ₹${fees.total}`}
</button>
```

---

## **CATEGORY 5: NOTIFICATIONS & REMINDERS**

### Task 5.1: Add SMS Reminders (24h and 2h)
**Priority**: 🔴 CRITICAL  
**Effort**: 5 hours  
**Files to Modify**:
- Create `/supabase/functions/server/notification-scheduler.tsx`
- `/supabase/functions/server/index.tsx`

**Acceptance Criteria**:
- [ ] Send SMS 24 hours before appointment
- [ ] Send SMS 2 hours before appointment
- [ ] Include appointment details (doctor, time, clinic)
- [ ] Include OTP for verification
- [ ] Handle SMS delivery failures
- [ ] Uses existing SMS gateway

**Implementation Details**:
```typescript
// notification-scheduler.tsx
interface AppointmentReminder {
  bookingId: string;
  customerPhone: string;
  appointmentDate: string;
  appointmentTime: string;
  doctorName: string;
  clinicName: string;
  otp: string;
}

// Schedule reminders when booking is created
const scheduleReminders = async (booking: any) => {
  const appointmentDateTime = new Date(`${booking.date}T${booking.time}`);
  
  // 24h reminder
  const reminder24h = new Date(appointmentDateTime.getTime() - 24 * 60 * 60 * 1000);
  await kv.set(`reminder:24h:${booking.id}`, {
    bookingId: booking.id,
    customerPhone: booking.customerPhone,
    scheduledFor: reminder24h.toISOString(),
    type: '24h',
    sent: false
  });
  
  // 2h reminder
  const reminder2h = new Date(appointmentDateTime.getTime() - 2 * 60 * 60 * 1000);
  await kv.set(`reminder:2h:${booking.id}`, {
    bookingId: booking.id,
    customerPhone: booking.customerPhone,
    scheduledFor: reminder2h.toISOString(),
    type: '2h',
    sent: false
  });
};

// Cron job to send reminders (runs every 15 minutes)
app.get('/make-server-3dd53475/cron/send-reminders', async (c) => {
  const now = new Date();
  
  // Get all pending reminders
  const reminders24h = await kv.getByPrefix('reminder:24h:');
  const reminders2h = await kv.getByPrefix('reminder:2h:');
  
  for (const reminder of [...reminders24h, ...reminders2h]) {
    if (reminder.sent) continue;
    
    const scheduledTime = new Date(reminder.scheduledFor);
    if (scheduledTime <= now) {
      // Send SMS
      await sendSMS(reminder);
      
      // Mark as sent
      reminder.sent = true;
      await kv.set(`reminder:${reminder.type}:${reminder.bookingId}`, reminder);
    }
  }
  
  return c.json({ success: true });
});

// SMS templates
const SMS_TEMPLATES = {
  '24h': (data: AppointmentReminder) => 
    `Hi! Reminder: You have an appointment with ${data.doctorName} at ${data.clinicName} tomorrow at ${data.appointmentTime}. Your OTP: ${data.otp}. -Warmpawz`,
  
  '2h': (data: AppointmentReminder) => 
    `Hi! Your appointment with ${data.doctorName} is in 2 hours (${data.appointmentTime}). OTP: ${data.otp}. Please arrive 10 mins early. -Warmpawz`
};

// Send SMS function (reuse existing SMS integration)
const sendSMS = async (reminder: any) => {
  const booking = await kv.get(`booking:${reminder.bookingId}`);
  const message = SMS_TEMPLATES[reminder.type]({
    customerPhone: reminder.customerPhone,
    appointmentDate: booking.date,
    appointmentTime: booking.time,
    doctorName: booking.doctorName,
    clinicName: booking.clinicName,
    otp: booking.otp,
    bookingId: booking.id
  });
  
  // Use existing SMS gateway
  // await sendSMSViaGateway(reminder.customerPhone, message);
  
  console.log(`✅ SMS sent to ${reminder.customerPhone}: ${message}`);
};
```

**KV Store Keys**:
```
reminder:24h:${bookingId} → { bookingId, customerPhone, scheduledFor, sent }
reminder:2h:${bookingId} → { bookingId, customerPhone, scheduledFor, sent }
```

**Setup Cron Job**:
```bash
# Use Supabase Cron or external service (GitHub Actions, cron-job.org)
# Call: GET /cron/send-reminders every 15 minutes
```

---

### Task 5.2: Add Email Notifications
**Priority**: 🟡 HIGH  
**Effort**: 4 hours  
**Files to Modify**:
- `/supabase/functions/server/notification-scheduler.tsx`

**Acceptance Criteria**:
- [ ] Send booking confirmation email
- [ ] Send appointment reminder email (24h before)
- [ ] Include appointment details and directions
- [ ] Attach appointment card (PDF or calendar .ics file)
- [ ] Professional email template with Warmpawz branding
- [ ] Include orange color theme

**Implementation Details**:
```typescript
// Email templates
const EMAIL_TEMPLATES = {
  bookingConfirmation: (data: any) => ({
    subject: `Appointment Confirmed - ${data.doctorName} on ${formatDate(data.date)}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #FF8C42; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .details { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; }
          .button { background: #FF8C42; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🐾 Appointment Confirmed</h1>
          </div>
          
          <div class="content">
            <p>Hi ${data.customerName},</p>
            <p>Your appointment has been successfully booked!</p>
            
            <div class="details">
              <h3>Appointment Details</h3>
              <p><strong>Doctor:</strong> ${data.doctorName}</p>
              <p><strong>Clinic:</strong> ${data.clinicName}</p>
              <p><strong>Date:</strong> ${formatDate(data.date)}</p>
              <p><strong>Time:</strong> ${data.time}</p>
              <p><strong>Pet:</strong> ${data.petName}</p>
              <p><strong>Booking ID:</strong> ${data.bookingId}</p>
              <p><strong>OTP:</strong> <span style="font-size: 20px; color: #FF8C42; font-weight: bold;">${data.otp}</span></p>
            </div>
            
            <a href="${data.directionsUrl}" class="button">Get Directions</a>
            
            <div class="details">
              <h4>What to bring:</h4>
              <ul>
                <li>Pet vaccination records</li>
                <li>Previous medical reports (if any)</li>
                <li>List of current medications</li>
                <li>Your OTP: ${data.otp}</li>
              </ul>
            </div>
            
            <p><strong>Need to reschedule?</strong> Contact us at support@warmpawz.com</p>
          </div>
          
          <div class="footer">
            <p>Warmpawz - Your Pet's Health Partner 🐾</p>
            <p>Download our app | Follow us on social media</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),
  
  reminder24h: (data: any) => ({
    subject: `Reminder: Appointment Tomorrow with ${data.doctorName}`,
    html: `...similar template with reminder message...`
  })
};

// Send email function
const sendEmail = async (to: string, template: any) => {
  // Use SendGrid, AWS SES, or Supabase's built-in email
  // For now, log to console
  console.log(`✅ Email sent to ${to}:`, template.subject);
  
  // TODO: Integrate with email service
  // await emailService.send({
  //   to,
  //   subject: template.subject,
  //   html: template.html
  // });
};

// Send booking confirmation email
app.post('/make-server-3dd53475/customer/bookings/create', async (c) => {
  // ... existing booking creation logic ...
  
  // Send confirmation email
  if (customerEmail) {
    const emailTemplate = EMAIL_TEMPLATES.bookingConfirmation({
      customerName: booking.customerName,
      doctorName: booking.doctorName,
      clinicName: booking.clinicName,
      date: booking.date,
      time: booking.time,
      petName: booking.petName,
      bookingId: booking.id,
      otp: booking.otp,
      directionsUrl: `https://maps.google.com/?q=${clinicAddress}`
    });
    
    await sendEmail(customerEmail, emailTemplate);
  }
  
  // ... rest of booking creation ...
});
```

**Note**: For MVP, you can use console.log. Integrate actual email service (SendGrid/AWS SES) later.

---

### Task 5.3: Add In-App Notification Center
**Priority**: 🟡 HIGH  
**Effort**: 4 hours  
**Files to Modify**:
- Create `/components/customer/NotificationCenter.tsx`
- `/components/customer/CustomerHomeWrapper.tsx`

**Acceptance Criteria**:
- [ ] Bell icon with unread count badge
- [ ] List of notifications (appointment reminders, promotions, updates)
- [ ] Mark as read functionality
- [ ] Delete notification
- [ ] Group by date (Today, Yesterday, Earlier)
- [ ] Uses existing orange design

**Implementation Details**:
```typescript
// NotificationCenter.tsx
interface Notification {
  id: string;
  type: 'reminder' | 'booking' | 'prescription' | 'promotion';
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  actionUrl?: string;
  actionLabel?: string;
}

export function NotificationCenter({ phone }: { phone: string }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const unreadCount = notifications.filter(n => !n.isRead).length;
  
  // Fetch notifications
  useEffect(() => {
    loadNotifications();
  }, [phone]);
  
  const loadNotifications = async () => {
    const response = await fetch(
      `${API_BASE}/customer/notifications/${phone}`,
      { headers: { Authorization: `Bearer ${publicAnonKey}` } }
    );
    
    if (response.ok) {
      const data = await response.json();
      setNotifications(data.notifications || []);
    }
  };
  
  const markAsRead = async (id: string) => {
    await fetch(
      `${API_BASE}/customer/notifications/${id}/read`,
      { 
        method: 'PUT',
        headers: { Authorization: `Bearer ${publicAnonKey}` }
      }
    );
    
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
  };
  
  const deleteNotification = async (id: string) => {
    await fetch(
      `${API_BASE}/customer/notifications/${id}`,
      { 
        method: 'DELETE',
        headers: { Authorization: `Bearer ${publicAnonKey}` }
      }
    );
    
    setNotifications(prev => prev.filter(n => n.id !== id));
  };
  
  return (
    <>
      {/* Bell icon with badge */}
      <button 
        onClick={() => setOpen(true)}
        className="relative"
      >
        <Bell className="w-6 h-6 text-gray-700" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#FF8C42] text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>
      
      {/* Notification sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full max-w-[430px]">
          <SheetHeader>
            <SheetTitle>Notifications</SheetTitle>
          </SheetHeader>
          
          <div className="mt-4 space-y-4">
            {notifications.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                <p className="text-gray-600">No notifications</p>
              </div>
            ) : (
              notifications.map(notification => (
                <div 
                  key={notification.id}
                  className={`p-4 rounded-lg border ${
                    notification.isRead 
                      ? 'bg-white border-gray-200' 
                      : 'bg-orange-50 border-[#FF8C42]'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{notification.title}</h4>
                      <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {formatRelativeTime(notification.timestamp)}
                      </p>
                    </div>
                    
                    <button 
                      onClick={() => deleteNotification(notification.id)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="flex gap-2 mt-3">
                    {!notification.isRead && (
                      <button 
                        onClick={() => markAsRead(notification.id)}
                        className="text-xs text-[#FF8C42]"
                      >
                        Mark as read
                      </button>
                    )}
                    {notification.actionUrl && (
                      <button 
                        onClick={() => {/* Navigate to action URL */}}
                        className="text-xs text-[#FF8C42] font-medium"
                      >
                        {notification.actionLabel || 'View'}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
```

**API Endpoints**:
```
GET /customer/notifications/${phone}
PUT /customer/notifications/${id}/read
DELETE /customer/notifications/${id}
POST /customer/notifications (for creating notifications)
```

**KV Store Keys**:
```
customer:${phone}:notifications → [{ id, type, title, message, isRead, ... }]
```

---

# 🟡 HIGH PRIORITY TASKS (Week 5-8)

## **CATEGORY 6: DOCTOR ANALYTICS DASHBOARD**

### Task 6.1: Add Revenue Dashboard
**Priority**: 🟡 HIGH  
**Effort**: 6 hours  
**Files to Modify**:
- Create `/components/vendor/clinic/DoctorAnalytics.tsx`
- `/components/vendor/clinic/ClinicDashboard.tsx`

**Acceptance Criteria**:
- [ ] Show today's revenue
- [ ] Show week/month revenue
- [ ] Revenue trend chart (last 7 days)
- [ ] Breakdown by payment method
- [ ] Uses existing orange chart colors

**Implementation Details**:
```typescript
// DoctorAnalytics.tsx
interface RevenueData {
  today: number;
  week: number;
  month: number;
  trend: { date: string; amount: number }[];
  byPaymentMethod: { method: string; amount: number }[];
}

export function DoctorAnalytics({ doctorId }: { doctorId: string }) {
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [timeRange, setTimeRange] = useState<'week' | 'month'>('week');
  
  useEffect(() => {
    loadRevenue();
  }, [doctorId, timeRange]);
  
  const loadRevenue = async () => {
    const response = await fetch(
      `${API_BASE}/doctor/${doctorId}/analytics/revenue?range=${timeRange}`,
      { headers: { Authorization: `Bearer ${publicAnonKey}` } }
    );
    
    if (response.ok) {
      const data = await response.json();
      setRevenue(data.revenue);
    }
  };
  
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Revenue Analytics</h2>
      
      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="p-4 bg-orange-50 rounded-lg">
          <div className="text-xs text-gray-600 mb-1">Today</div>
          <div className="text-2xl font-bold text-[#FF8C42]">
            ₹{revenue?.today || 0}
          </div>
        </div>
        
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="text-xs text-gray-600 mb-1">This Week</div>
          <div className="text-2xl font-bold">₹{revenue?.week || 0}</div>
        </div>
        
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="text-xs text-gray-600 mb-1">This Month</div>
          <div className="text-2xl font-bold">₹{revenue?.month || 0}</div>
        </div>
      </div>
      
      {/* Time range selector */}
      <div className="flex gap-2 mb-4">
        <button 
          className={`px-4 py-2 rounded-lg ${
            timeRange === 'week' 
              ? 'bg-[#FF8C42] text-white' 
              : 'bg-gray-100'
          }`}
          onClick={() => setTimeRange('week')}
        >
          Last 7 Days
        </button>
        <button 
          className={`px-4 py-2 rounded-lg ${
            timeRange === 'month' 
              ? 'bg-[#FF8C42] text-white' 
              : 'bg-gray-100'
          }`}
          onClick={() => setTimeRange('month')}
        >
          Last 30 Days
        </button>
      </div>
      
      {/* Revenue trend chart - Use Recharts library */}
      {revenue?.trend && (
        <div className="mb-6">
          <h3 className="font-medium mb-3">Revenue Trend</h3>
          <LineChart width={400} height={200} data={revenue.trend}>
            <Line type="monotone" dataKey="amount" stroke="#FF8C42" strokeWidth={2} />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
          </LineChart>
        </div>
      )}
      
      {/* Payment method breakdown */}
      {revenue?.byPaymentMethod && (
        <div>
          <h3 className="font-medium mb-3">By Payment Method</h3>
          {revenue.byPaymentMethod.map(item => (
            <div key={item.method} className="flex justify-between items-center mb-2">
              <span className="text-sm">{item.method}</span>
              <span className="font-medium">₹{item.amount}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**API Endpoint**:
```
GET /doctor/${doctorId}/analytics/revenue?range=week
Response: { revenue: { today, week, month, trend, byPaymentMethod } }
```

**KV Store Calculation**:
```typescript
// Calculate from bookings
const bookings = await kv.getByPrefix(`booking:doctor:${doctorId}:`);
const completedBookings = bookings.filter(b => b.status === 'completed');

// Group by date
const revenueByDate = {};
completedBookings.forEach(booking => {
  const date = booking.date;
  revenueByDate[date] = (revenueByDate[date] || 0) + booking.totalAmount;
});

// Calculate today, week, month
const today = completedBookings
  .filter(b => b.date === currentDate)
  .reduce((sum, b) => sum + b.totalAmount, 0);
```

---

### Task 6.2: Add Appointment Analytics
**Priority**: 🟡 HIGH  
**Effort**: 4 hours  
**Files to Modify**:
- `/components/vendor/clinic/DoctorAnalytics.tsx`

**Acceptance Criteria**:
- [ ] Show total appointments (today, week, month)
- [ ] Show new vs returning patients
- [ ] Show no-show rate
- [ ] Show average consultation duration
- [ ] Slot utilization percentage

**Implementation Details**:
```typescript
interface AppointmentAnalytics {
  total: { today: number; week: number; month: number };
  newVsReturning: { new: number; returning: number };
  noShowRate: number;
  avgDuration: number;
  slotUtilization: number;
}

// UI: Appointment stats
<div className="space-y-4">
  <h3 className="font-medium">Appointment Analytics</h3>
  
  {/* Total appointments */}
  <div className="grid grid-cols-3 gap-3">
    <div className="p-3 bg-gray-50 rounded-lg text-center">
      <div className="text-2xl font-bold text-[#FF8C42]">{analytics.total.today}</div>
      <div className="text-xs text-gray-600">Today</div>
    </div>
    <div className="p-3 bg-gray-50 rounded-lg text-center">
      <div className="text-2xl font-bold">{analytics.total.week}</div>
      <div className="text-xs text-gray-600">This Week</div>
    </div>
    <div className="p-3 bg-gray-50 rounded-lg text-center">
      <div className="text-2xl font-bold">{analytics.total.month}</div>
      <div className="text-xs text-gray-600">This Month</div>
    </div>
  </div>
  
  {/* New vs Returning */}
  <div className="p-4 bg-gray-50 rounded-lg">
    <div className="flex justify-between mb-2">
      <span className="text-sm">New Patients</span>
      <span className="font-medium">{analytics.newVsReturning.new}</span>
    </div>
    <div className="flex justify-between">
      <span className="text-sm">Returning Patients</span>
      <span className="font-medium">{analytics.newVsReturning.returning}</span>
    </div>
  </div>
  
  {/* Performance metrics */}
  <div className="space-y-2">
    <div className="flex justify-between items-center">
      <span className="text-sm">Slot Utilization</span>
      <span className={`font-medium ${analytics.slotUtilization >= 80 ? 'text-green-600' : 'text-[#FF8C42]'}`}>
        {analytics.slotUtilization}%
      </span>
    </div>
    
    <div className="flex justify-between items-center">
      <span className="text-sm">No-show Rate</span>
      <span className={`font-medium ${analytics.noShowRate > 10 ? 'text-red-600' : 'text-green-600'}`}>
        {analytics.noShowRate}%
      </span>
    </div>
    
    <div className="flex justify-between items-center">
      <span className="text-sm">Avg. Consultation Time</span>
      <span className="font-medium">{analytics.avgDuration} min</span>
    </div>
  </div>
</div>
```

---

## **CATEGORY 7: REVIEW SYSTEM v2.0**

### Task 7.1: Add Category-wise Ratings
**Priority**: 🟡 HIGH  
**Effort**: 5 hours  
**Files to Modify**:
- Create `/components/customer/ReviewForm.tsx`
- `/components/customer/vet/VetDoctorDetails.tsx` (show review breakdown)

**Acceptance Criteria**:
- [ ] Ask for 5 category ratings (behavior, treatment, punctuality, environment, value)
- [ ] Show category-wise rating breakdown on doctor profile
- [ ] Calculate overall rating from categories
- [ ] Uses existing orange star design

**Implementation Details**:
```typescript
// ReviewForm.tsx
interface CategoryRatings {
  behavior: number;    // Doctor's behavior
  treatment: number;   // Treatment quality
  punctuality: number; // On-time vs delayed
  environment: number; // Clinic cleanliness
  value: number;       // Value for money
}

export function ReviewForm({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const [ratings, setRatings] = useState<CategoryRatings>({
    behavior: 0,
    treatment: 0,
    punctuality: 0,
    environment: 0,
    value: 0
  });
  const [reviewText, setReviewText] = useState('');
  
  const categories = [
    { key: 'behavior', label: 'Doctor Behavior', icon: '😊' },
    { key: 'treatment', label: 'Treatment Quality', icon: '💊' },
    { key: 'punctuality', label: 'Punctuality', icon: '⏰' },
    { key: 'environment', label: 'Clinic Environment', icon: '🏥' },
    { key: 'value', label: 'Value for Money', icon: '💰' }
  ];
  
  const overallRating = Object.values(ratings).reduce((a, b) => a + b, 0) / 5;
  
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-[400px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rate Your Experience</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Overall rating display */}
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <div className="text-4xl font-bold text-[#FF8C42] mb-1">
              {overallRating.toFixed(1)}
            </div>
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map(star => (
                <Star 
                  key={star}
                  className={`w-5 h-5 ${star <= overallRating ? 'fill-[#FF8C42] text-[#FF8C42]' : 'text-gray-300'}`}
                />
              ))}
            </div>
            <div className="text-xs text-gray-600 mt-1">Overall Rating</div>
          </div>
          
          {/* Category ratings */}
          {categories.map(category => (
            <div key={category.key} className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  {category.icon} {category.label}
                </span>
                <span className="text-sm text-[#FF8C42] font-medium">
                  {ratings[category.key as keyof CategoryRatings]}/5
                </span>
              </div>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setRatings({ ...ratings, [category.key]: star })}
                    className="focus:outline-none"
                  >
                    <Star 
                      className={`w-6 h-6 ${
                        star <= ratings[category.key as keyof CategoryRatings]
                          ? 'fill-[#FF8C42] text-[#FF8C42]' 
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          ))}
          
          {/* Review text */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Share Your Experience (Optional)
            </label>
            <textarea 
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Tell us about your visit..."
              className="w-full border rounded px-3 py-2 min-h-[100px]"
            />
          </div>
          
          {/* Submit button */}
          <button 
            onClick={handleSubmit}
            disabled={overallRating === 0}
            className="w-full bg-[#FF8C42] text-white py-3 rounded-lg font-medium disabled:opacity-50"
          >
            Submit Review
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Display category breakdown on doctor profile
export function CategoryRatingBreakdown({ doctorId }: { doctorId: string }) {
  const [breakdown, setBreakdown] = useState<any>(null);
  
  useEffect(() => {
    loadBreakdown();
  }, [doctorId]);
  
  const loadBreakdown = async () => {
    const response = await fetch(
      `${API_BASE}/doctor/${doctorId}/reviews/breakdown`,
      { headers: { Authorization: `Bearer ${publicAnonKey}` } }
    );
    
    if (response.ok) {
      const data = await response.json();
      setBreakdown(data.breakdown);
    }
  };
  
  if (!breakdown) return null;
  
  return (
    <div className="mb-6">
      <h3 className="font-medium mb-3">Rating Breakdown</h3>
      <div className="space-y-2">
        {Object.entries(breakdown.categories).map(([category, rating]) => (
          <div key={category} className="flex items-center gap-2">
            <span className="text-sm w-28 capitalize">{category}</span>
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#FF8C42]"
                style={{ width: `${(rating as number / 5) * 100}%` }}
              />
            </div>
            <span className="text-sm font-medium w-8">{(rating as number).toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**KV Store Keys**:
```
review:${reviewId} → { bookingId, doctorId, ratings: { behavior, treatment, ... }, reviewText, overall }
doctor:${doctorId}:reviews → [reviewId1, reviewId2, ...]
doctor:${doctorId}:rating_breakdown → { behavior: 4.5, treatment: 4.8, ... }
```

---

# 🟢 MEDIUM PRIORITY TASKS (Week 9-12)

## **CATEGORY 8: FOLLOW-UP INTELLIGENCE**

### Task 8.1: Add Follow-up Suggestions
**Priority**: 🟢 MEDIUM  
**Effort**: 4 hours  
**Files to Modify**:
- `/components/vendor/VendorPrescriptionModal.tsx`
- `/components/customer/BookingDetailModal.tsx`

**Acceptance Criteria**:
- [ ] Doctor can suggest follow-up date while prescribing
- [ ] Customer sees follow-up reminder
- [ ] One-click booking for follow-up
- [ ] Uses existing orange button design

**Implementation Details**:
```typescript
// In VendorPrescriptionModal.tsx - Add follow-up field
<div className="mb-4">
  <label className="block text-sm font-medium mb-2">
    Follow-up Recommended
  </label>
  <select 
    value={followUpDays}
    onChange={(e) => setFollowUpDays(parseInt(e.target.value))}
    className="w-full border rounded px-3 py-2"
  >
    <option value="0">No follow-up needed</option>
    <option value="7">After 1 week</option>
    <option value="14">After 2 weeks</option>
    <option value="30">After 1 month</option>
    <option value="90">After 3 months</option>
  </select>
  
  {followUpDays > 0 && (
    <p className="text-xs text-gray-600 mt-2">
      Follow-up due on: {calculateFollowUpDate(followUpDays)}
    </p>
  )}
</div>

// In customer's booking detail - show follow-up banner
{booking.followUpDate && new Date(booking.followUpDate) > new Date() && (
  <div className="p-4 bg-orange-50 border border-[#FF8C42] rounded-lg mb-4">
    <div className="flex items-center gap-2 mb-2">
      <Calendar className="w-5 h-5 text-[#FF8C42]" />
      <h4 className="font-medium">Follow-up Recommended</h4>
    </div>
    <p className="text-sm text-gray-700 mb-3">
      Dr. {booking.doctorName} recommends a follow-up visit on {formatDate(booking.followUpDate)}
    </p>
    <button 
      onClick={() => bookFollowUp(booking)}
      className="w-full bg-[#FF8C42] text-white py-2 rounded-lg"
    >
      Book Follow-up Appointment
    </button>
  </div>
)}
```

---

### Task 8.2: Add Follow-up Reminders
**Priority**: 🟢 MEDIUM  
**Effort**: 3 hours  
**Files to Modify**:
- `/supabase/functions/server/notification-scheduler.tsx`

**Acceptance Criteria**:
- [ ] Send reminder 3 days before follow-up due date
- [ ] Send reminder on follow-up due date
- [ ] SMS + In-app notification
- [ ] Include direct booking link

**Implementation Details**:
```typescript
// Schedule follow-up reminders when prescription is created
const scheduleFollowUpReminders = async (prescription: any) => {
  if (!prescription.followUpDate) return;
  
  const followUpDate = new Date(prescription.followUpDate);
  
  // Reminder 3 days before
  const reminder3Days = new Date(followUpDate.getTime() - 3 * 24 * 60 * 60 * 1000);
  await kv.set(`followup_reminder:3days:${prescription.bookingId}`, {
    bookingId: prescription.bookingId,
    customerPhone: prescription.customerPhone,
    doctorName: prescription.doctorName,
    scheduledFor: reminder3Days.toISOString(),
    sent: false
  });
  
  // Reminder on due date
  await kv.set(`followup_reminder:due:${prescription.bookingId}`, {
    bookingId: prescription.bookingId,
    customerPhone: prescription.customerPhone,
    doctorName: prescription.doctorName,
    scheduledFor: followUpDate.toISOString(),
    sent: false
  });
};

// SMS template
const FOLLOWUP_SMS = (data: any) =>
  `Hi! Your pet's follow-up visit with Dr. ${data.doctorName} is due on ${formatDate(data.followUpDate)}. Book now: [link] -Warmpawz`;
```

---

## **CATEGORY 9: VIDEO CONSULTATION ENHANCEMENTS**

### Task 9.1: Add Pre-call Tech Check
**Priority**: 🟢 MEDIUM  
**Effort**: 3 hours  
**Files to Modify**:
- `/components/customer/VideoCallInterface.tsx`

**Acceptance Criteria**:
- [ ] Check camera access before call
- [ ] Check microphone access
- [ ] Test internet speed
- [ ] Show warning if issues detected
- [ ] Uses existing orange design

**Implementation Details**:
```typescript
// Add pre-call check modal
export function PreCallTechCheck({ onComplete }: { onComplete: () => void }) {
  const [checks, setChecks] = useState({
    camera: 'pending',
    microphone: 'pending',
    internet: 'pending'
  });
  
  useEffect(() => {
    runChecks();
  }, []);
  
  const runChecks = async () => {
    // Check camera
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setChecks(prev => ({ ...prev, camera: 'success' }));
    } catch (e) {
      setChecks(prev => ({ ...prev, camera: 'failed' }));
    }
    
    // Check microphone
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setChecks(prev => ({ ...prev, microphone: 'success' }));
    } catch (e) {
      setChecks(prev => ({ ...prev, microphone: 'failed' }));
    }
    
    // Check internet (simple ping test)
    const start = Date.now();
    try {
      await fetch('https://www.google.com/generate_204', { mode: 'no-cors' });
      const latency = Date.now() - start;
      setChecks(prev => ({ ...prev, internet: latency < 200 ? 'success' : 'warning' }));
    } catch (e) {
      setChecks(prev => ({ ...prev, internet: 'failed' }));
    }
  };
  
  const allPassed = Object.values(checks).every(c => c === 'success' || c === 'warning');
  
  return (
    <Dialog open={true}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle>System Check</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3">
          <CheckItem icon="📹" label="Camera" status={checks.camera} />
          <CheckItem icon="🎤" label="Microphone" status={checks.microphone} />
          <CheckItem icon="📶" label="Internet" status={checks.internet} />
          
          {!allPassed && (
            <div className="p-3 bg-orange-50 border border-[#FF8C42] rounded-lg text-sm">
              <strong>⚠ Issues Detected:</strong>
              <ul className="mt-2 space-y-1 text-xs">
                {checks.camera === 'failed' && <li>• Camera access denied</li>}
                {checks.microphone === 'failed' && <li>• Microphone access denied</li>}
                {checks.internet === 'failed' && <li>• Internet connection unstable</li>}
              </ul>
            </div>
          )}
          
          <button 
            onClick={onComplete}
            disabled={!allPassed}
            className="w-full bg-[#FF8C42] text-white py-3 rounded-lg disabled:opacity-50"
          >
            {allPassed ? 'Join Call' : 'Fix Issues First'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CheckItem({ icon, label, status }: any) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{icon}</span>
        <span className="font-medium">{label}</span>
      </div>
      {status === 'pending' && <Loader className="w-5 h-5 animate-spin text-gray-400" />}
      {status === 'success' && <Check className="w-5 h-5 text-green-600" />}
      {status === 'warning' && <AlertTriangle className="w-5 h-5 text-orange-500" />}
      {status === 'failed' && <X className="w-5 h-5 text-red-600" />}
    </div>
  );
}
```

---

## 📊 PROGRESS TRACKING

### Weekly Checklist Template:
```
Week X (Date Range):
□ Task X.X completed
□ Task X.X completed
□ Task X.X completed

Total Tasks Completed: X/Y
Blockers: None / [List blockers]
Next Week Focus: [Categories]
```

---

## 🔄 IMPLEMENTATION WORKFLOW

### For Each Task:
1. **Read task requirements** ✅
2. **Identify files to modify** ✅
3. **Create feature branch** (git checkout -b feature/task-x-x)
4. **Implement changes** ✅
5. **Test locally** ✅
6. **Create PR** ✅
7. **Code review** ✅
8. **Merge to main** ✅
9. **Deploy to staging** ✅
10. **QA testing** ✅
11. **Deploy to production** ✅

---

## 🎯 SUCCESS CRITERIA

**After completing all critical tasks, Warmpawz will have**:
- ✅ Advanced doctor search (by name, fee, experience)
- ✅ Real-time slot availability display
- ✅ Smart scheduling (breaks, buffer, holidays)
- ✅ Comprehensive health records (medical history, vaccinations, lab reports)
- ✅ Transparent payment breakdown
- ✅ Multi-channel notifications (SMS, email, in-app)
- ✅ Doctor analytics dashboard
- ✅ Category-wise review system
- ✅ Follow-up intelligence
- ✅ Video call enhancements

**Result**: Warmpawz will match 85-90% of Practo's core features while maintaining its unique pet-focused advantages! 🐾

---

**Document Version**: 1.0  
**Last Updated**: November 20, 2025  
**Status**: Ready for Implementation  

**Let's start building! 🚀**
