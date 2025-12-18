import { useState, useEffect } from 'react';
import { Tag, Plus, Edit2, Trash2, Calendar, X, Loader2 } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface PromotionsManagementProps {
  sellerId: string;
}

export function PromotionsManagement({ sellerId }: PromotionsManagementProps) {
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadPromotions();
  }, [sellerId]);

  const loadPromotions = async () => {
    try {
      setLoading(true);
      // Use the admin endpoint to see all promotions (active and inactive)
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/ecommerce/admin/promotions?limit=100`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      
      if (res.ok) {
        const data = await res.json();
        // Client-side filter for sellerId if needed, though backend doesn't currently enforce it strict
        // For now, we assume the seller owns all promotions they see or backend will be updated later
        // We'll filter by sellerId if it exists on the record
        const allPromotions = data.promotions || [];
        const sellerPromotions = allPromotions.filter((p: any) => !p.sellerId || p.sellerId === sellerId);
        setPromotions(sellerPromotions);
      } else {
        console.error('Error response from server');
        // Don't show error toast on initial load as it might be empty
      }
    } catch (error) {
      console.error('Error loading promotions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-black">Promotions Management</h1>
          <p className="text-gray-500 mt-1">Create and manage promotional offers</p>
        </div>
        <button 
          className="bg-[#FF8C42] text-white px-4 py-2 rounded-lg hover:bg-[#E67A32] flex items-center gap-2"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus className="w-5 h-5" />
          Create Promotion
        </button>
      </div>

      {promotions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Tag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No promotions found</p>
          <p className="text-sm text-gray-400 mt-1">Create discount codes and special offers for your products</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {promotions.map((promo) => (
            <div key={promo.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-black">{promo.name}</h3>
                  <div className="inline-block bg-gray-100 px-2 py-1 rounded text-xs font-mono mt-1">
                    {promo.code || 'AUTOMATIC'}
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${promo.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {promo.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="text-sm text-gray-600 mb-3">
                {promo.type === 'percentage' ? `${promo.value}% OFF` : `₹${promo.value} OFF`}
              </div>
              <div className="text-xs text-gray-400 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(promo.validUntil).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreatePromotionModal 
          sellerId={sellerId} 
          onClose={() => setShowCreateModal(false)} 
          onSuccess={() => {
            setShowCreateModal(false);
            loadPromotions();
          }}
        />
      )}
    </div>
  );
}

function CreatePromotionModal({ sellerId, onClose, onSuccess }: { sellerId: string; onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    code: '', // Optional for auto-apply, but usually required for coupons
    type: 'percentage', // percentage | fixed
    value: '',
    minOrderAmount: '',
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    isActive: true,
    applicableTo: 'all' // all | specific_products
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        sellerId,
        value: parseFloat(formData.value),
        minOrderAmount: formData.minOrderAmount ? parseFloat(formData.minOrderAmount) : 0,
        validFrom: new Date(formData.validFrom).toISOString(),
        validUntil: new Date(formData.validUntil).toISOString()
      };

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/ecommerce/admin/promotions/create`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );

      if (res.ok) {
        toast.success('Promotion created successfully');
        onSuccess();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to create promotion');
      }
    } catch (error) {
      console.error('Error creating promotion:', error);
      toast.error('Failed to create promotion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h3 className="font-semibold text-gray-900">Create New Promotion</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Promotion Name</label>
            <input
              required
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#FF8C42] focus:border-[#FF8C42]"
              placeholder="e.g. Summer Sale"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#FF8C42] focus:border-[#FF8C42]"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (₹)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={formData.value}
                onChange={(e) => setFormData({...formData, value: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#FF8C42] focus:border-[#FF8C42]"
                placeholder={formData.type === 'percentage' ? '10' : '100'}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Coupon Code (Optional)</label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#FF8C42] focus:border-[#FF8C42]"
              placeholder="e.g. SUMMER2024"
            />
            <p className="text-xs text-gray-500 mt-1">Leave empty for automatic application</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valid From</label>
              <input
                required
                type="date"
                value={formData.validFrom}
                onChange={(e) => setFormData({...formData, validFrom: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#FF8C42] focus:border-[#FF8C42]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
              <input
                required
                type="date"
                value={formData.validUntil}
                onChange={(e) => setFormData({...formData, validUntil: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#FF8C42] focus:border-[#FF8C42]"
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#FF8C42] text-white px-4 py-2 rounded-lg hover:bg-[#E67A32] disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Promotion
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}