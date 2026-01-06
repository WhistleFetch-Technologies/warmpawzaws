'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, Folder } from 'lucide-react';
import { Button } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';
import { StatusBadge } from './StatusBadge';

interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  status: 'active' | 'inactive' | 'pending';
  parentId?: string;
  subCategories?: Category[];
  createdAt: string;
}

export function CategoriesTab() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/admin/catalog/categories');
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Loading categories...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1 relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <Button className="bg-[#FF8C42] hover:bg-[#FF7A2E]">
          <Plus className="w-4 h-4 mr-2" />
          Add Category
        </Button>
      </div>

      {filteredCategories.length === 0 ? (
        <div className="p-6 text-center text-gray-500">No categories found</div>
      ) : (
        <div className="space-y-3">
          {filteredCategories.map((category) => (
            <div key={category.id} className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {category.icon && <span className="text-2xl">{category.icon}</span>}
                    <h4 className="font-semibold text-gray-900">{category.name}</h4>
                    <StatusBadge status={category.status} />
                  </div>
                  
                  {category.description && (
                    <p className="text-sm text-gray-600 mb-2">{category.description}</p>
                  )}
                  
                  <div className="flex items-center gap-4 text-sm">
                    {category.subCategories && category.subCategories.length > 0 && (
                      <span className="text-gray-600">
                        {category.subCategories.length} sub-categories
                      </span>
                    )}
                    <span className="text-gray-500">
                      Created: {new Date(category.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-2 ml-4">
                  <Button size="sm" variant="outline">
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

