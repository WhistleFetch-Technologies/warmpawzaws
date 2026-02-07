"use client";

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';

interface ProblemCategoryMapperProps {
  onBack?: () => void;
}

export function ProblemCategoryMapper({ onBack }: ProblemCategoryMapperProps = {}) {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>('/admin/problem-categories');
      setCategories(response.categories || response || []);
    } catch (error: any) {
      console.error('Error loading categories:', error);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) {
      toast.error('Please enter a category name');
      return;
    }

    try {
      await apiClient.post('/admin/problem-categories', { name: newCategory });
      toast.success('Category added');
      setNewCategory('');
      loadCategories();
    } catch (error: any) {
      console.error('Error adding category:', error);
      toast.error('Failed to add category');
    }
  };

  return (
    <div className="p-6">
      {onBack && (
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full" aria-label="Go back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="text-sm font-medium text-gray-600">Back</span>
        </div>
      )}
      <h1 className="text-2xl font-bold mb-4">Problem Category Mapper</h1>
      <p className="text-gray-600 mb-6">Manage problem categories for pet health issues</p>
      
      <Card className="p-4 mb-4">
        <div className="flex gap-2">
          <Input
            placeholder="Enter new category..."
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleAddCategory}>Add Category</Button>
        </div>
      </Card>

      {loading ? (
        <Card className="p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#FF8C42] border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading categories...</p>
        </Card>
      ) : categories.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-600">No categories found. Add one to get started.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {categories.map((category) => (
            <Card key={category.id} className="p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">{category.name}</span>
                <Button variant="outline" size="sm">Edit</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

