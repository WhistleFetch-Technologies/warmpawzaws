import { useState, useEffect } from 'react';
import { Briefcase, Plus, X, Edit2, Trash2, Camera, Award, Calendar, DollarSign, Star } from 'lucide-react';
// ✅ FIX: Removed Supabase imports - using API Gateway now
import { toast } from 'sonner';

interface PortfolioItem {
  id: string;
  vendorId: string;
  title: string;
  description: string;
  category: 'grooming' | 'training' | 'photography' | 'event' | 'other';
  imageUrls: string[];
  completedDate: string;
  clientName?: string;
  petName?: string;
  petBreed?: string;
  price?: number;
  duration?: string;
  tags: string[];
  featured: boolean;
  createdAt: string;
}

interface VendorPortfolioManagementProps {
  vendorId: string;
  vendorData?: any;
  onBack?: () => void;
}

export function VendorPortfolioManagement({ vendorId, vendorData, onBack }: VendorPortfolioManagementProps) {
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [formData, setFormData] = useState<Partial<PortfolioItem>>({
    title: '',
    description: '',
    category: 'grooming',
    imageUrls: [],
    completedDate: new Date().toISOString().split('T')[0],
    tags: [],
    featured: false
  });

  useEffect(() => {
    fetchPortfolio();
  }, [vendorId]);

  const fetchPortfolio = async () => {
    try {
      setLoading(true);
      
      // ✅ FIX: Use API Gateway URL instead of Supabase
      const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || '';
      if (!API_GATEWAY_URL) {
        throw new Error('API Gateway URL not configured');
      }
      
      const { apiCallJson } = await import('@warmpawz/api-client/http');
      
      // TODO: Create portfolio endpoint if it doesn't exist
      // For now, using placeholder - would need: GET /vendor/portfolio/:vendorId
      try {
        const portfolioData = await apiCallJson<any>(
          `${API_GATEWAY_URL}/make-server-3dd53475/vendor/portfolio/${vendorId}`
        );
        
        if (portfolioData.success) {
          setPortfolio(portfolioData.portfolioItems || portfolioData.items || portfolioData.data?.items || []);
        } else {
          setPortfolio([]);
        }
      } catch (portfolioError) {
        console.warn('Portfolio endpoint not available yet');
        setPortfolio([]);
      }
    } catch (error: any) {
      console.error('Error fetching portfolio:', error);
      const errorMessage = error?.message || 'Failed to load portfolio. Please try again.';
      toast.error(errorMessage);
      setPortfolio([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.description) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      // ✅ FIX: Use API Gateway URL instead of Supabase
      const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || '';
      if (!API_GATEWAY_URL) {
        throw new Error('API Gateway URL not configured');
      }
      
      const { apiCallJson } = await import('@warmpawz/api-client/http');
      
      const endpoint = editingItem 
        ? `${API_GATEWAY_URL}/make-server-3dd53475/vendor/portfolio/${vendorId}/${editingItem.id}`
        : `${API_GATEWAY_URL}/make-server-3dd53475/vendor/portfolio/${vendorId}`;

      const portfolioData = await apiCallJson<any>(
        endpoint,
        {
          method: editingItem ? 'PUT' : 'POST',
          body: JSON.stringify(formData)
        }
      );

      if (portfolioData.success) {
        toast.success(editingItem ? 'Portfolio item updated successfully' : 'Portfolio item added successfully');
        setModalOpen(false);
        setEditingItem(null);
        setFormData({
          title: '',
          description: '',
          category: 'grooming',
          imageUrls: [],
          completedDate: new Date().toISOString().split('T')[0],
          tags: [],
          featured: false
        });
        await fetchPortfolio(); // ✅ Ensure portfolio reloads
      } else {
        toast.error(portfolioData.error || portfolioData.message || 'Failed to save portfolio item');
      }
    } catch (error: any) {
      console.error('Error saving portfolio:', error);
      const errorMessage = error?.message || 'Network error. Please check your connection and try again.';
      toast.error(errorMessage);
    }
  };

  const handleDelete = async (itemId: string) => {
    const item = portfolio.find(p => p.id === itemId);
    const itemTitle = item?.title || 'this portfolio item';
    
    if (!confirm(`Are you sure you want to delete "${itemTitle}"? This action cannot be undone.`)) {
      return;
    }

    try {
      // ✅ FIX: Use API Gateway URL instead of Supabase
      const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || '';
      if (!API_GATEWAY_URL) {
        throw new Error('API Gateway URL not configured');
      }
      
      const { apiCallJson } = await import('@warmpawz/api-client/http');
      
      const deleteData = await apiCallJson<any>(
        `${API_GATEWAY_URL}/make-server-3dd53475/vendor/portfolio/${vendorId}/${itemId}`,
        {
          method: 'DELETE'
        }
      );

      if (deleteData.success) {
        toast.success(`Portfolio item "${itemTitle}" deleted successfully`);
        await fetchPortfolio(); // ✅ Ensure portfolio reloads
      } else {
        toast.error(deleteData.error || deleteData.message || 'Failed to delete portfolio item');
      }
    } catch (error: any) {
      console.error('Error deleting portfolio item:', error);
      const errorMessage = error?.message || 'Network error. Please check your connection and try again.';
      toast.error(errorMessage);
    }
  };

  const handleEdit = (item: PortfolioItem) => {
    setEditingItem(item);
    setFormData(item);
    setModalOpen(true);
  };

  const categories = [
    { id: 'all', label: 'All Work' },
    { id: 'grooming', label: 'Grooming' },
    { id: 'training', label: 'Training' },
    { id: 'photography', label: 'Photography' },
    { id: 'event', label: 'Events' },
    { id: 'other', label: 'Other' }
  ];

  const filteredPortfolio = filterCategory === 'all'
    ? portfolio
    : portfolio.filter(item => item.category === filterCategory);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Briefcase className="w-12 h-12 text-orange-500 animate-pulse mx-auto mb-3" />
          <p className="text-gray-600">Loading portfolio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[430px] mx-auto bg-white min-h-screen">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {onBack && (
                  <button onClick={onBack} className="text-gray-600">
                    <X className="w-6 h-6" />
                  </button>
                )}
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Portfolio</h1>
                  <p className="text-sm text-gray-500">{portfolio.length} projects</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingItem(null);
                  setFormData({
                    title: '',
                    description: '',
                    category: 'grooming',
                    imageUrls: [],
                    completedDate: new Date().toISOString().split('T')[0],
                    tags: [],
                    featured: false
                  });
                  setModalOpen(true);
                }}
                className="bg-orange-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-orange-600"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            {/* Category Filter */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setFilterCategory(cat.id)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    filterCategory === cat.id
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Portfolio Grid */}
        <div className="p-4">
          {filteredPortfolio.length === 0 ? (
            <div className="text-center py-12">
              <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Portfolio Items</h3>
              <p className="text-gray-500 mb-4">Showcase your best work to attract customers</p>
              <button
                onClick={() => setModalOpen(true)}
                className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600"
              >
                Add First Project
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPortfolio.map(item => (
                <div key={item.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  {item.imageUrls && item.imageUrls.length > 0 && (
                    <div className="relative aspect-video bg-gray-100">
                      <img
                        src={item.imageUrls[0]}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                      {item.featured && (
                        <div className="absolute top-3 right-3 bg-yellow-500 text-white px-2 py-1 rounded-full flex items-center gap-1 text-xs font-medium">
                          <Star className="w-3 h-3 fill-current" />
                          Featured
                        </div>
                      )}
                      {item.imageUrls.length > 1 && (
                        <div className="absolute bottom-3 right-3 bg-black bg-opacity-60 text-white px-2 py-1 rounded-full text-xs">
                          +{item.imageUrls.length - 1} more
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                        <span className="inline-block px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full capitalize">
                          {item.category}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-2 hover:bg-red-50 rounded-lg text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{item.description}</p>

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {item.petName && (
                        <div className="flex items-center gap-1">
                          <Award className="w-3 h-3" />
                          {item.petName}
                        </div>
                      )}
                      {item.completedDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(item.completedDate).toLocaleDateString()}
                        </div>
                      )}
                      {item.price && (
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          ₹{item.price}
                        </div>
                      )}
                    </div>

                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {item.tags.map((tag, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add/Edit Modal */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">
                    {editingItem ? 'Edit Project' : 'Add Project'}
                  </h2>
                  <button onClick={() => setModalOpen(false)}>
                    <X className="w-6 h-6 text-gray-400" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                    placeholder="e.g., Golden Retriever Full Grooming"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                    rows={4}
                    placeholder="Describe the project..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as PortfolioItem['category'] })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  >
                    <option value="grooming">Grooming</option>
                    <option value="training">Training</option>
                    <option value="photography">Photography</option>
                    <option value="event">Event</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pet Name
                    </label>
                    <input
                      type="text"
                      value={formData.petName || ''}
                      onChange={(e) => setFormData({ ...formData, petName: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-2"
                      placeholder="Optional"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Completed Date
                    </label>
                    <input
                      type="date"
                      value={formData.completedDate}
                      onChange={(e) => setFormData({ ...formData, completedDate: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client Name
                  </label>
                  <input
                    type="text"
                    value={formData.clientName || ''}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                    placeholder="Optional"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="featured"
                    checked={formData.featured}
                    onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                    className="rounded"
                  />
                  <label htmlFor="featured" className="text-sm text-gray-700">
                    Mark as featured project
                  </label>
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                  >
                    {editingItem ? 'Update' : 'Add'} Project
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
