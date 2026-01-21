# Remaining Pages Refactoring Guide

This guide provides the pattern to refactor the remaining pages (`loyalty` and `promotions`) to use the reusable hooks.

---

## Refactoring Pattern

### Step 1: Update Imports

**Before:**
```typescript
import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
```

**After:**
```typescript
import React, { useState } from 'react';
import { useApiData, useCrud, useFormModal, useNotifications } from '@/hooks';
import { validateRequired } from '@/lib/utils';
import { formatDateForInput } from '@/lib/utils';
```

---

### Step 2: Replace State Management

**Before:**
```typescript
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);
const [success, setSuccess] = useState(null);
const [showModal, setShowModal] = useState(false);
const [editingItem, setEditingItem] = useState(null);
const [saving, setSaving] = useState(false);
const [formData, setFormData] = useState(initialData);
```

**After:**
```typescript
// Data fetching
const { data, loading, error: dataError, refetch } = useApiData<ItemType>({
  endpoint: '/admin/endpoint',
  dataKey: 'items',
  params: { /* filters if any */ },
});

// Notifications
const notifications = useNotifications({ autoClearSuccess: true });

// CRUD operations
const { saving, deleting, error: crudError, success: crudSuccess, create, update, remove } = useCrud({
  endpoint: '/admin/endpoint',
  onSuccess: (message) => {
    notifications.setSuccess(message);
    refetch();
  },
  onError: (err) => {
    notifications.setError(err.message || 'Operation failed');
  },
});

// Form modal
const modal = useFormModal({
  initialFormData: { /* default values */ },
  getDefaultFormData: () => ({ /* default values */ }),
  mapItemToFormData: (item) => ({ /* map item to form */ }),
});

// Combine errors
const error = dataError || crudError || notifications.error;
const success = crudSuccess || notifications.success;
```

---

### Step 3: Replace Data Loading

**Before:**
```typescript
useEffect(() => {
  loadData();
}, []);

const loadData = async () => {
  try {
    setLoading(true);
    setError(null);
    const response = await apiClient.get('/admin/endpoint');
    setData(response.items || []);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

**After:**
```typescript
// Already handled by useApiData hook
// Just use: data, loading, error, refetch
```

---

### Step 4: Replace CRUD Operations

**Before:**
```typescript
const handleCreate = () => {
  setEditingItem(null);
  setFormData(initialData);
  setShowModal(true);
};

const handleEdit = (item) => {
  setEditingItem(item);
  setFormData(mapItemToForm(item));
  setShowModal(true);
};

const handleSave = async () => {
  try {
    setSaving(true);
    if (editingItem) {
      await apiClient.put(`/admin/endpoint/${editingItem.id}`, formData);
    } else {
      await apiClient.post('/admin/endpoint', formData);
    }
    setShowModal(false);
    loadData();
  } catch (err) {
    setError(err.message);
  } finally {
    setSaving(false);
  }
};

const handleDelete = async (id) => {
  if (!confirm('Are you sure?')) return;
  try {
    await apiClient.delete(`/admin/endpoint/${id}`);
    loadData();
  } catch (err) {
    setError(err.message);
  }
};
```

**After:**
```typescript
const handleSave = async () => {
  // Validate
  const validation = validateRequired(modal.formData, ['required', 'fields']);
  if (!validation.isValid) {
    notifications.setError(Object.values(validation.errors)[0]);
    return;
  }

  // Save
  if (modal.editingItem) {
    await update(modal.editingItem.id, modal.formData);
  } else {
    await create(modal.formData);
  }

  // Close modal if successful
  if (!crudError) {
    modal.closeModal();
  }
};

const handleDelete = async (item) => {
  await remove(item);
};
```

---

### Step 5: Update UI References

**Before:**
```typescript
onClick={handleCreate}
onClick={() => handleEdit(item)}
onClick={() => handleDelete(item.id)}
onClick={() => setShowModal(false)}
onClick={() => setError(null)}
value={formData.field}
onChange={(e) => setFormData({ ...formData, field: e.target.value })}
{showModal && ...}
{editingItem ? 'Edit' : 'Create'}
```

**After:**
```typescript
onClick={modal.openCreate}
onClick={() => modal.openEdit(item)}
onClick={() => handleDelete(item)}
onClick={modal.closeModal}
onClick={notifications.clearError}
value={modal.formData.field}
onChange={(e) => modal.setFormData({ ...modal.formData, field: e.target.value })}
{modal.isOpen && ...}
{modal.editingItem ? 'Edit' : 'Create'}
```

---

### Step 6: Update Error/Success Messages

**Before:**
```typescript
{error && (
  <div>
    <span>{error}</span>
    <button onClick={() => setError(null)}>✕</button>
  </div>
)}
{success && (
  <div>
    <span>{success}</span>
    <button onClick={() => setSuccess(null)}>✕</button>
  </div>
)}
```

**After:**
```typescript
{error && (
  <div>
    <span>{error}</span>
    <button onClick={notifications.clearError}>✕</button>
  </div>
)}
{success && (
  <div>
    <span>{success}</span>
    <button onClick={notifications.clearSuccess}>✕</button>
  </div>
)}
```

---

## Example: Loyalty Page Refactoring

### Key Changes Needed

1. **Replace data loading** with `useApiData`
2. **Replace CRUD operations** with `useCrud`
3. **Replace modal state** with `useFormModal`
4. **Replace notifications** with `useNotifications`
5. **Update all UI references** to use hook methods

### Special Considerations

- If the page has filters, pass them to `useApiData` params
- If the page has custom payload transformation, use `transformCreate` and `transformUpdate` in `useCrud`
- If the page has date formatting, use `formatDateForInput` from utils

---

## Example: Promotions Page Refactoring

### Key Changes Needed

Same as loyalty page, plus:

- Handle both promotions and coupons (may need two separate hooks or combined)
- Handle filter states
- Handle custom validation if needed

---

## Verification Checklist

After refactoring, verify:

- ✅ No TypeScript errors
- ✅ No linting errors
- ✅ All CRUD operations work
- ✅ Error handling works
- ✅ Success messages appear
- ✅ Loading states work
- ✅ Modal opens/closes correctly
- ✅ Form data persists correctly
- ✅ Data refreshes after mutations

---

## Quick Reference

### Hook Exports
```typescript
import {
  useApiData,
  useCrud,
  useFormModal,
  useNotifications,
} from '@/hooks';
```

### Utility Exports
```typescript
import {
  validateRequired,
  formatDateForInput,
  formatDateReadable,
  formatCurrency,
  formatPercentage,
} from '@/lib/utils';
```

---

**Status:** Pattern established, ready to apply to remaining pages

