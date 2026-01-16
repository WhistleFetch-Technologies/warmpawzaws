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
    return <div className="p-8 text-center text-gray-500">Loading categories...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1 relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
          />
        </div>
        <Button className="bg-[#FF8C42] hover:bg-[#FF7A2E] ml-4">
          <Plus className="w-4 h-4 mr-2" />
          Add Category
        </Button>
      </div>

      {filteredCategories.length === 0 ? (
        <div className="p-12 text-center text-gray-500 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <Folder className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No categories found</p>
          <p className="text-sm text-gray-400 mt-1">Try adjusting your search or add a new category</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCategories.map((category) => (
            <div key={category.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg hover:border-[#FF8C42]/30 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {category.icon && <span className="text-2xl">{category.icon}</span>}
                    <h4 className="font-semibold text-gray-900 text-lg">{category.name}</h4>
                    <StatusBadge status={category.status} />
                  </div>
                  
                  {category.description && (
                    <p className="text-sm text-gray-600 mb-3">{category.description}</p>
                  )}
                  
                  <div className="flex items-center gap-4 text-sm">
                    {category.subCategories && category.subCategories.length > 0 && (
                      <span className="text-gray-600 bg-gray-100 px-2 py-1 rounded-md">
                        {category.subCategories.length} sub-categories
                      </span>
                    )}
                    <span className="text-gray-500">
                      Created: {category.createdAt ? new Date(category.createdAt).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-2 ml-6">
                  <Button size="sm" variant="outline" className="hover:bg-gray-50">
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50 hover:border-red-200">
                    <Trash2 className="w-4 h-4 mr-2" />
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

