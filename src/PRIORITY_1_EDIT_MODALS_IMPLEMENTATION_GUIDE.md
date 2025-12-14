# 🚨 PRIORITY 1 - EDIT MODALS IMPLEMENTATION GUIDE

**Status:** ⚠️ **PARTIALLY IMPLEMENTED** - DELETE works, EDIT needs modals  
**Date:** December 14, 2024

---

## 📋 CURRENT STATUS

### ✅ What's Working:
- DELETE operations for all 3 capabilities (Ambulance, Diagnostics, Emergency Protocols)
- Backend PUT endpoints exist for all 3
- State management for editing is in place (`editingAmbulance`, `editingDiagnostic`, `editingProtocol`)
- Edit buttons are wired up and call handlers

### ❌ What's Missing:
- **Edit modals** - Currently showing "Edit functionality coming soon" toast
- **Pre-filled forms** - No forms to display existing data
- **Save handlers** - `handleSaveAmbulance`, `handleSaveDiagnostic`, `handleSaveProtocol` not called from UI

---

## 🎯 IMPLEMENTATION PLAN

### Option 1: Simple Inline Edit (Recommended - 2 hours)

Instead of building complex modals, convert the Edit button to toggle an inline edit mode:

```typescript
// Add state
const [editMode, setEditMode] = useState<{type: string, id: string} | null>(null);

// Update handleEditAmbulance
const handleEditAmbulance = (ambulance: AmbulanceService) => {
  setEditMode({ type: 'ambulance', id: ambulance.id });
  setEditingAmbulance(ambulance);
};

// In the ambulance card, replace the display with form inputs when in edit mode
{editMode?.id === ambulance.id ? (
  <div className="space-y-2">
    <Input 
      value={editingAmbulance?.vehicleNumber} 
      onChange={(e) => setEditingAmbulance({...editingAmbulance!, vehicleNumber: e.target.value})}
      placeholder="Vehicle Number"
    />
    <Input 
      value={editingAmbulance?.driverName} 
      onChange={(e) => setEditingAmbulance({...editingAmbulance!, driverName: e.target.value})}
      placeholder="Driver Name"
    />
    {/* More inputs... */}
    <div className="flex gap-2">
      <Button onClick={() => handleSaveAmbulance(editingAmbulance!)}>Save</Button>
      <Button variant="outline" onClick={() => { setEditMode(null); setEditingAmbulance(null); }}>Cancel</Button>
    </div>
  </div>
) : (
  // Existing display code
)}
```

**Pros:**
- Fast implementation
- No modal complexity
- Better mobile UX
- Saves screen real estate

**Cons:**
- Card expands when editing
- May feel less polished than modal

---

### Option 2: Full Modal Implementation (Complex - 6-8 hours)

Create separate modal components for each service type:

```typescript
// Create /components/vendor/clinic/AmbulanceEditModal.tsx

export function AmbulanceEditModal({ 
  ambulance, 
  onSave, 
  onClose 
}: {
  ambulance: AmbulanceService | null;
  onSave: (data: Partial<AmbulanceService>) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    vehicleNumber: ambulance?.vehicleNumber || '',
    driverName: ambulance?.driverName || '',
    driverPhone: ambulance?.driverPhone || '',
    basePrice: ambulance?.basePrice || 0,
    pricePerKm: ambulance?.pricePerKm || 0,
    availability: ambulance?.availability || 'available',
    currentLocation: ambulance?.currentLocation || ''
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-semibold mb-4">
          {ambulance ? 'Edit Ambulance' : 'Add Ambulance'}
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Vehicle Number</label>
            <Input
              value={formData.vehicleNumber}
              onChange={(e) => setFormData({...formData, vehicleNumber: e.target.value})}
              placeholder="DL-01-AB-1234"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Driver Name</label>
            <Input
              value={formData.driverName}
              onChange={(e) => setFormData({...formData, driverName: e.target.value})}
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Driver Phone</label>
            <Input
              value={formData.driverPhone}
              onChange={(e) => setFormData({...formData, driverPhone: e.target.value})}
              placeholder="+91 9876543210"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Base Price (₹)</label>
              <Input
                type="number"
                value={formData.basePrice}
                onChange={(e) => setFormData({...formData, basePrice: parseFloat(e.target.value)})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Price per KM (₹)</label>
              <Input
                type="number"
                value={formData.pricePerKm}
                onChange={(e) => setFormData({...formData, pricePerKm: parseFloat(e.target.value)})}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Availability</label>
            <select
              value={formData.availability}
              onChange={(e) => setFormData({...formData, availability: e.target.value as any})}
              className="w-full border rounded-lg p-2"
            >
              <option value="available">Available</option>
              <option value="busy">Busy</option>
              <option value="offline">Offline</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Current Location (Optional)</label>
            <Input
              value={formData.currentLocation}
              onChange={(e) => setFormData({...formData, currentLocation: e.target.value})}
              placeholder="Sector 12, Gurgaon"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button 
            onClick={() => onSave(formData)}
            className="flex-1 bg-red-600 hover:bg-red-700"
          >
            {ambulance ? 'Update' : 'Add'} Ambulance
          </Button>
          <Button 
            onClick={onClose}
            variant="outline"
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
```

Then in `VetSpecializedServicesManager.tsx`:

```typescript
import { AmbulanceEditModal } from './AmbulanceEditModal';
import { DiagnosticEditModal } from './DiagnosticEditModal';
import { ProtocolEditModal } from './ProtocolEditModal';

// In render:
{showAddModal && activeTab === 'ambulance' && (
  <AmbulanceEditModal
    ambulance={editingAmbulance}
    onSave={handleSaveAmbulance}
    onClose={() => {
      setShowAddModal(false);
      setEditingAmbulance(null);
    }}
  />
)}
```

**Pros:**
- Clean separation of concerns
- Reusable modal components
- Professional feel
- Better for complex forms

**Cons:**
- More code to write
- 3 separate modal components needed
- More testing required

---

## 🔧 BACKEND VERIFICATION

All backend endpoints are ready:

### 1. Ambulance Services
✅ `PUT /vendor/:vendorId/ambulance-services/:ambulanceId`
- Location: `/supabase/functions/server/vet-specialized-services.tsx:382`
- Status: Working

### 2. Diagnostic Tests
✅ `PUT /vendor/:vendorId/diagnostic-tests/:testId`
- Location: `/supabase/functions/server/vet-specialized-services.tsx:534`
- Status: Working

### 3. Emergency Protocols
✅ `PUT /vendor/:vendorId/emergency-protocols/:protocolId`
- Location: `/supabase/functions/server/vet-specialized-services.tsx:685`
- Status: Working

---

## 📝 IMPLEMENTATION CHECKLIST

### For Option 1 (Inline Edit - Recommended):

- [ ] Add `editMode` state
- [ ] Update `handleEditAmbulance` to set edit mode
- [ ] Add conditional rendering in ambulance card
- [ ] Add form inputs for all fields
- [ ] Wire up Save button to `handleSaveAmbulance`
- [ ] Add Cancel button to reset state
- [ ] Repeat for diagnostics (8 fields)
- [ ] Repeat for protocols (6 fields + arrays)
- [ ] Test all three edit flows
- [ ] Handle validation errors

**Estimated Time:** 2-3 hours

### For Option 2 (Modal):

- [ ] Create `AmbulanceEditModal.tsx` component
- [ ] Create `DiagnosticEditModal.tsx` component
- [ ] Create `ProtocolEditModal.tsx` component
- [ ] Add form state management to each
- [ ] Add field validation
- [ ] Wire up to main component
- [ ] Handle array fields (equipment, steps)
- [ ] Test modal open/close
- [ ] Test save/cancel flows
- [ ] Handle mobile responsiveness

**Estimated Time:** 6-8 hours

---

## 🎯 RECOMMENDATION

**Choose Option 1** (Inline Edit) because:
1. **Faster implementation** - 2-3 hours vs 6-8 hours
2. **Mobile-first design** - Better UX on small screens
3. **Less complexity** - No modal state management
4. **Already have DELETE working** - Just need edit UI
5. **Can iterate to modals later** if needed

---

## 🚀 QUICK START (Option 1)

Here's the exact code to add to `VetSpecializedServicesManager.tsx`:

```typescript
// 1. Add this state near the top
const [editMode, setEditMode] = useState<{ type: ActiveTab; id: string } | null>(null);

// 2. Update handleEditAmbulance
const handleEditAmbulance = (ambulance: AmbulanceService) => {
  setEditingAmbulance({...ambulance}); // Clone to avoid mutation
  setEditMode({ type: 'ambulance', id: ambulance.id });
};

// 3. In renderAmbulanceServices(), replace the ambulance card content:
{editMode?.id === ambulance.id && editMode?.type === 'ambulance' ? (
  <div className="space-y-3">
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">Vehicle Number</label>
      <Input
        value={editingAmbulance?.vehicleNumber || ''}
        onChange={(e) => setEditingAmbulance({...editingAmbulance!, vehicleNumber: e.target.value})}
        className="text-sm"
      />
    </div>
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">Driver Name</label>
      <Input
        value={editingAmbulance?.driverName || ''}
        onChange={(e) => setEditingAmbulance({...editingAmbulance!, driverName: e.target.value})}
        className="text-sm"
      />
    </div>
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">Driver Phone</label>
      <Input
        value={editingAmbulance?.driverPhone || ''}
        onChange={(e) => setEditingAmbulance({...editingAmbulance!, driverPhone: e.target.value})}
        className="text-sm"
      />
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Base Price</label>
        <Input
          type="number"
          value={editingAmbulance?.basePrice || 0}
          onChange={(e) => setEditingAmbulance({...editingAmbulance!, basePrice: parseFloat(e.target.value) || 0})}
          className="text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Price/KM</label>
        <Input
          type="number"
          value={editingAmbulance?.pricePerKm || 0}
          onChange={(e) => setEditingAmbulance({...editingAmbulance!, pricePerKm: parseFloat(e.target.value) || 0})}
          className="text-sm"
        />
      </div>
    </div>
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">Availability</label>
      <select
        value={editingAmbulance?.availability || 'available'}
        onChange={(e) => setEditingAmbulance({...editingAmbulance!, availability: e.target.value as any})}
        className="w-full border rounded-lg p-2 text-sm"
      >
        <option value="available">Available</option>
        <option value="busy">Busy</option>
        <option value="offline">Offline</option>
      </select>
    </div>
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">Current Location</label>
      <Input
        value={editingAmbulance?.currentLocation || ''}
        onChange={(e) => setEditingAmbulance({...editingAmbulance!, currentLocation: e.target.value})}
        className="text-sm"
        placeholder="Optional"
      />
    </div>
    <div className="flex gap-2 pt-2 border-t">
      <Button 
        size="sm" 
        className="flex-1 bg-green-600 hover:bg-green-700"
        onClick={() => {
          handleSaveAmbulance(editingAmbulance!);
          setEditMode(null);
        }}
      >
        <Check className="w-3 h-3 mr-1" />
        Save
      </Button>
      <Button 
        size="sm" 
        variant="outline"
        className="flex-1"
        onClick={() => {
          setEditMode(null);
          setEditingAmbulance(null);
        }}
      >
        <X className="w-3 h-3 mr-1" />
        Cancel
      </Button>
    </div>
  </div>
) : (
  // ... existing display code ...
)}
```

**This pattern repeats for diagnostics and protocols with their respective fields.**

---

## ✅ CONCLUSION

**Current State:** DELETE works perfectly ✅  
**Missing:** EDIT modals/forms ❌  
**Recommendation:** Implement Option 1 (Inline Edit) for fastest path to 100% CRUD  
**Time Required:** 2-3 hours  
**Result:** Full CRUD for all 3 vet specialized services  

Once complete, you'll have:
- ✅ CREATE (if add modals exist)
- ✅ READ (list view works)
- ✅ UPDATE (inline edit)
- ✅ DELETE (already working)

**Status:** Ready to implement! 🚀
