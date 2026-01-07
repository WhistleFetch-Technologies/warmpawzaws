/**
 * Reusable hook for managing form modals
 * Handles modal state, form data, and editing item
 */

import { useState, useCallback, useEffect } from 'react';

export interface UseFormModalOptions<TFormData, TItem = any> {
  initialFormData: TFormData;
  getDefaultFormData?: () => TFormData;
  mapItemToFormData?: (item: TItem) => TFormData;
}

export interface UseFormModalReturn<TFormData, TItem> {
  isOpen: boolean;
  formData: TFormData;
  editingItem: TItem | null;
  openModal: () => void;
  closeModal: () => void;
  openCreate: () => void;
  openEdit: (item: TItem) => void;
  setFormData: React.Dispatch<React.SetStateAction<TFormData>>;
  resetForm: () => void;
}

export function useFormModal<TFormData extends Record<string, any>, TItem = any>({
  initialFormData,
  getDefaultFormData,
  mapItemToFormData,
}: UseFormModalOptions<TFormData, TItem>): UseFormModalReturn<TFormData, TItem> {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<TFormData>(initialFormData);
  const [editingItem, setEditingItem] = useState<TItem | null>(null);

  const getDefaultData = useCallback((): TFormData => {
    if (getDefaultFormData) {
      return getDefaultFormData();
    }
    return { ...initialFormData };
  }, [getDefaultFormData, initialFormData]);

  const resetForm = useCallback(() => {
    setFormData(getDefaultData());
    setEditingItem(null);
  }, [getDefaultData]);

  const openModal = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    resetForm();
  }, [resetForm]);

  const openCreate = useCallback(() => {
    setEditingItem(null);
    setFormData(getDefaultData());
    setIsOpen(true);
  }, [getDefaultData]);

  const openEdit = useCallback(
    (item: TItem) => {
      setEditingItem(item);
      if (mapItemToFormData) {
        setFormData(mapItemToFormData(item));
      } else {
        // Default: assume form data matches item structure
        setFormData(item as unknown as TFormData);
      }
      setIsOpen(true);
    },
    [mapItemToFormData]
  );

  return {
    isOpen,
    formData,
    editingItem,
    openModal,
    closeModal,
    openCreate,
    openEdit,
    setFormData,
    resetForm,
  };
}

