/**
 * Reusable hook for CRUD operations
 * Provides create, update, delete operations with consistent error handling
 */

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export interface UseCrudOptions<T, TCreate = T, TUpdate = Partial<T>> {
  endpoint: string;
  onSuccess?: (message: string) => void;
  onError?: (error: Error) => void;
  transformCreate?: (data: TCreate) => any; // Transform data before sending
  transformUpdate?: (data: TUpdate) => any;
  getItemId?: (item: T) => string | number; // Extract ID from item
  confirmDelete?: (item: T) => boolean | Promise<boolean>; // Custom delete confirmation
}

export interface UseCrudReturn<T, TCreate = T, TUpdate = Partial<T>> {
  saving: boolean;
  deleting: boolean;
  error: string | null;
  success: string | null;
  create: (data: TCreate) => Promise<T | null>;
  update: (id: string | number, data: TUpdate) => Promise<T | null>;
  remove: (id: string | number | T) => Promise<boolean>;
  clearMessages: () => void;
}

export function useCrud<T = any, TCreate = T, TUpdate = Partial<T>>({
  endpoint,
  onSuccess,
  onError,
  transformCreate,
  transformUpdate,
  getItemId = (item: any) => item.id,
  confirmDelete,
}: UseCrudOptions<T, TCreate, TUpdate>): UseCrudReturn<T, TCreate, TUpdate> {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  const create = useCallback(
    async (data: TCreate): Promise<T | null> => {
      try {
        setSaving(true);
        setError(null);
        setSuccess(null);

        const payload = transformCreate ? transformCreate(data) : data;
        const response = await apiClient.post<T>(endpoint, payload);

        const successMessage = 'Created successfully';
        setSuccess(successMessage);
        onSuccess?.(successMessage);

        return response;
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to create';
        setError(errorMessage);
        onError?.(err);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [endpoint, transformCreate, onSuccess, onError]
  );

  const update = useCallback(
    async (id: string | number, data: TUpdate): Promise<T | null> => {
      try {
        setSaving(true);
        setError(null);
        setSuccess(null);

        const payload = transformUpdate ? transformUpdate(data) : data;
        const response = await apiClient.put<T>(`${endpoint}/${id}`, payload);

        const successMessage = 'Updated successfully';
        setSuccess(successMessage);
        onSuccess?.(successMessage);

        return response;
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to update';
        setError(errorMessage);
        onError?.(err);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [endpoint, transformUpdate, onSuccess, onError]
  );

  const remove = useCallback(
    async (idOrItem: string | number | T): Promise<boolean> => {
      // Handle both ID and item object
      const item = typeof idOrItem === 'object' ? idOrItem : null;
      const id = typeof idOrItem === 'object' ? getItemId(idOrItem) : idOrItem;

      // Custom confirmation
      if (confirmDelete && item) {
        const confirmed = await confirmDelete(item);
        if (!confirmed) return false;
      } else if (!confirmDelete) {
        // Default browser confirmation
        if (!window.confirm('Are you sure you want to delete this item?')) {
          return false;
        }
      }

      try {
        setDeleting(true);
        setError(null);
        setSuccess(null);

        await apiClient.delete(`${endpoint}/${id}`);

        const successMessage = 'Deleted successfully';
        setSuccess(successMessage);
        onSuccess?.(successMessage);

        return true;
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to delete';
        setError(errorMessage);
        onError?.(err);
        return false;
      } finally {
        setDeleting(false);
      }
    },
    [endpoint, getItemId, confirmDelete, onSuccess, onError]
  );

  return {
    saving,
    deleting,
    error,
    success,
    create,
    update,
    remove,
    clearMessages,
  };
}

