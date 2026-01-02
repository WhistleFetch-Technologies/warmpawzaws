import { useState, useEffect } from 'react';
import { ArrowLeft, Heart, Package, Image as ImageIcon, DollarSign, Calendar, Search } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner';

interface MemorialService {
  id: string;
  customerName: string;
  petName: string;
  petType: string;
  serviceType: 'cremation' | 'burial' | 'memorial_ceremony' | 'urn_selection' | 'pawprint' | 'photo_frame' | 'remembrance_box';
  packageName: string;
  packageDescription: string;
  price: number;
  status: 'scheduled' | 'in_progress' | 'completed';
  scheduledDate: string;
}

interface MemorialProduct {
  id: string;
  name: string;
  type: 'urn' | 'casket' | 'photo_frame' | 'jewelry' | 'pawprint_kit' | 'memorial_stone' | 'other';
  description: string;
  material: string;
  size: string;
  images: string[];
  price: number;
  inStock: boolean;
  customizable: boolean;
}

interface MemorialServicesViewProps {
  vendorId: string;
  vendorName?: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

export function MemorialServicesView({ vendorId, vendorName, onBack, onNavigate }: MemorialServicesViewProps) {
  const [activeTab, setActiveTab] = useState<'services' | 'products'>('services');
  const [services, setServices] = useState<MemorialService[]>([]);
  const [products, setProducts] = useState<MemorialProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    if (activeTab === 'services') {
      loadServices();
    } else {
      loadProducts();
    }
  }, [vendorId, activeTab]);

  const loadServices = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/customer/memorial/${vendorId}/services`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        // ✅ FIX: Handle standardized response format
        const servicesList = data.services || data.data?.services || [];
        setServices(servicesList);
        console.log('✅ Loaded memorial services:', servicesList.length);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to load services:', errorData);
        setServices([]);
      }
    } catch (error: any) {
      console.error('Error loading services:', error);
      const errorMessage = error?.message || 'Failed to load memorial services';
      toast.error(errorMessage);
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/customer/memorial/${vendorId}/products`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        // ✅ FIX: Handle standardized response format
        const productsList = data.products || data.data?.products || [];
        setProducts(productsList);
        console.log('✅ Loaded memorial products:', productsList.length);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to load products:', errorData);
        setProducts([]);
      }
    } catch (error: any) {
      console.error('Error loading products:', error);
      const errorMessage = error?.message || 'Failed to load memorial products';
      toast.error(errorMessage);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredServices = services.filter(service =>
    !searchQuery ||
    service.petName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    service.packageName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProducts = products.filter(product =>
    !searchQuery ||
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center max-w-md mx-auto">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-lg">Memorial Services</h1>
            {vendorName && <p className="text-sm text-gray-600">{vendorName}</p>}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('services')}
            className={`flex-1 py-3 text-center font-medium transition-colors ${
              activeTab === 'services'
                ? 'text-pink-600 border-b-2 border-pink-600'
                : 'text-gray-600'
            }`}
          >
            Services
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`flex-1 py-3 text-center font-medium transition-colors ${
              activeTab === 'products'
                ? 'text-pink-600 border-b-2 border-pink-600'
                : 'text-gray-600'
            }`}
          >
            Products
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {activeTab === 'services' ? (
          filteredServices.length === 0 ? (
            <div className="text-center py-12">
              <Heart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No memorial services available</p>
            </div>
          ) : (
            filteredServices.map((service) => (
              <div
                key={service.id}
                className="bg-white rounded-xl p-4 border border-gray-200"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">{service.packageName}</h3>
                      <p className="text-sm text-gray-600 mt-1">{service.packageDescription}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-pink-600">₹{service.price}</div>
                      <div className="text-xs text-gray-500 capitalize">{service.serviceType.replace('_', ' ')}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <span>🐾</span>
                      <span>{service.petName} ({service.petType})</span>
                    </div>
                    {service.scheduledDate && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(service.scheduledDate).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  <div className={`inline-block px-2 py-1 text-xs rounded-full ${
                    service.status === 'completed' ? 'bg-green-100 text-green-700' :
                    service.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {service.status.replace('_', ' ')}
                  </div>
                </div>
              </div>
            ))
          )
        ) : (
          filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No memorial products available</p>
            </div>
          ) : (
            filteredProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => onNavigate('product-detail', { product, vendorId })}
                className="bg-white rounded-xl p-4 border border-gray-200 hover:border-pink-500 transition-colors cursor-pointer"
              >
                <div className="flex gap-3">
                  {product.images && product.images.length > 0 ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-gradient-to-br from-pink-100 to-pink-200 rounded-lg flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-pink-400" />
                    </div>
                  )}
                  
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold">{product.name}</h3>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{product.description}</p>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-pink-600">₹{product.price}</div>
                        {!product.inStock && (
                          <div className="text-xs text-red-600">Out of Stock</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                      <span>{product.material}</span>
                      {product.size && (
                        <>
                          <span>•</span>
                          <span>{product.size}</span>
                        </>
                      )}
                      {product.customizable && (
                        <>
                          <span>•</span>
                          <span className="text-pink-600">Customizable</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}

