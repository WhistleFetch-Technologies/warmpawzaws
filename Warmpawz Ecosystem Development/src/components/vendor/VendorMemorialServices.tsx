import { useState, useEffect } from 'react';
import { ArrowLeft, Heart, Plus, Calendar, Package, Image as ImageIcon, Edit2, Trash2, Eye, CheckCircle, Clock, XCircle } from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';
import { toast } from 'sonner@2.0.3';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface MemorialService {
  id: string;
  vendorId: string;
  customerId: string;
  customerName: string;
  petId?: string;
  petName: string;
  petType: string;
  petBreed?: string;
  serviceType: 'cremation' | 'burial' | 'memorial_ceremony' | 'urn_selection' | 'pawprint' | 'photo_frame' | 'remembrance_box';
  packageName: string;
  packageDescription: string;
  price: number;
  cremationType?: 'private' | 'communal' | 'partitioned';
  ashesReturn: boolean;
  urnType?: string;
  ceremoniesIncluded: string[];
  memorialItems: {
    type: string;
    description: string;
    quantity: number;
  }[];
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  scheduledDate: string;
  completedDate?: string;
  notes?: string;
  specialRequests?: string;
  createdAt: string;
  updatedAt: string;
}

interface MemorialTribute {
  id: string;
  vendorId: string;
  serviceId: string;
  petName: string;
  petImage?: string;
  dateOfBirth?: string;
  dateOfPassing: string;
  epitaph: string;
  memories: {
    text: string;
    author: string;
    date: string;
  }[];
  photos: string[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MemorialProduct {
  id: string;
  vendorId: string;
  name: string;
  type: 'urn' | 'casket' | 'photo_frame' | 'jewelry' | 'pawprint_kit' | 'memorial_stone' | 'other';
  description: string;
  material: string;
  size: string;
  images: string[];
  price: number;
  inStock: boolean;
  customizable: boolean;
  customizationOptions?: string[];
  createdAt: string;
  updatedAt: string;
}

interface VendorMemorialServicesProps {
  vendorId: string;
  vendorData?: any;
  onBack?: () => void;
}

export function VendorMemorialServices({ vendorId, vendorData, onBack }: VendorMemorialServicesProps) {
  const [activeTab, setActiveTab] = useState<'services' | 'tributes' | 'products'>('services');
  const [services, setServices] = useState<MemorialService[]>([]);
  const [tributes, setTributes] = useState<MemorialTribute[]>([]);
  const [products, setProducts] = useState<MemorialProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [tributeModalOpen, setTributeModalOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<MemorialService | null>(null);
  const [editingProduct, setEditingProduct] = useState<MemorialProduct | null>(null);

  const API_BASE = `${getApiBaseUrl()}/vendor/memorial`;

  useEffect(() => {
    loadData();
  }, [vendorId, activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'services') {
        await loadServices();
      } else if (activeTab === 'tributes') {
        await loadTributes();
      } else if (activeTab === 'products') {
        await loadProducts();
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadServices = async () => {
    const response = await fetch(`${API_BASE}/${vendorId}/services`, {
      headers: getAuthHeaders()
    });
    if (response.ok) {
      const data = await response.json();
      setServices(data.services || []);
    }
  };

  const loadTributes = async () => {
    const response = await fetch(`${API_BASE}/${vendorId}/tributes`, {
      headers: getAuthHeaders()
    });
    if (response.ok) {
      const data = await response.json();
      setTributes(data.tributes || []);
    }
  };

  const loadProducts = async () => {
    const response = await fetch(`${API_BASE}/${vendorId}/products`, {
      headers: getAuthHeaders()
    });
    if (response.ok) {
      const data = await response.json();
      setProducts(data.products || []);
    }
  };

  const handleStatusUpdate = async (serviceId: string, status: string) => {
    try {
      const response = await fetch(`${API_BASE}/${vendorId}/services/${serviceId}/status`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });

      if (response.ok) {
        toast.success('Status updated successfully');
        loadServices();
      } else {
        toast.error('Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const response = await fetch(`${API_BASE}/${vendorId}/products/${productId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        toast.success('Product deleted successfully');
        loadProducts();
      } else {
        toast.error('Failed to delete product');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-purple-100 text-purple-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return <Calendar className="w-4 h-4" />;
      case 'in_progress': return <Clock className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'cancelled': return <XCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const stats = {
    scheduled: services.filter(s => s.status === 'scheduled').length,
    inProgress: services.filter(s => s.status === 'in_progress').length,
    completed: services.filter(s => s.status === 'completed').length,
    totalProducts: products.length,
    inStockProducts: products.filter(p => p.inStock).length,
    totalTributes: tributes.length
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 px-6 py-8 text-white">
        <div className="flex items-center justify-between mb-6">
          {onBack && (
            <button onClick={onBack} className="flex items-center gap-2 text-purple-200 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
              Back to Dashboard
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 mb-6">
          <Heart className="w-8 h-8" />
          <div>
            <h1 className="text-2xl">Memorial Services Management</h1>
            <p className="text-purple-200 text-sm">Compassionate care and remembrance</p>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <p className="text-purple-200 text-sm">Scheduled</p>
            <p className="text-2xl mt-1">{stats.scheduled}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <p className="text-purple-200 text-sm">In Progress</p>
            <p className="text-2xl mt-1">{stats.inProgress}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <p className="text-purple-200 text-sm">Completed</p>
            <p className="text-2xl mt-1">{stats.completed}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <p className="text-purple-200 text-sm">Products</p>
            <p className="text-2xl mt-1">{stats.totalProducts}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <p className="text-purple-200 text-sm">In Stock</p>
            <p className="text-2xl mt-1">{stats.inStockProducts}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <p className="text-purple-200 text-sm">Tributes</p>
            <p className="text-2xl mt-1">{stats.totalTributes}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex gap-6 px-6">
          <button
            onClick={() => setActiveTab('services')}
            className={`py-4 px-2 border-b-2 transition-colors ${
              activeTab === 'services'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5" />
              <span>Memorial Services</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('tributes')}
            className={`py-4 px-2 border-b-2 transition-colors ${
              activeTab === 'tributes'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              <span>Tributes & Memories</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`py-4 px-2 border-b-2 transition-colors ${
              activeTab === 'products'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              <span>Memorial Products</span>
            </div>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Services Tab */}
            {activeTab === 'services' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl text-gray-900">Memorial Services</h2>
                  <Button
                    onClick={() => {
                      setEditingService(null);
                      setServiceModalOpen(true);
                    }}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Service
                  </Button>
                </div>

                {services.length === 0 ? (
                  <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                    <Heart className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg text-gray-900 mb-2">No Memorial Services</h3>
                    <p className="text-gray-600 mb-4">Start by adding your first memorial service</p>
                    <Button
                      onClick={() => setServiceModalOpen(true)}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      Add Service
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {services.map((service) => (
                      <div key={service.id} className="bg-white rounded-lg border border-gray-200 p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg text-gray-900">{service.customerName}</h3>
                              <Badge className={getStatusColor(service.status)}>
                                <span className="flex items-center gap-1">
                                  {getStatusIcon(service.status)}
                                  {service.status}
                                </span>
                              </Badge>
                            </div>
                            <p className="text-purple-600 mb-2">🐾 {service.petName} ({service.petType})</p>
                            <div className="grid md:grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="text-gray-600">Service:</span>
                                <span className="text-gray-900 ml-2">{service.packageName}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Type:</span>
                                <span className="text-gray-900 ml-2">{service.serviceType.replace('_', ' ')}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Scheduled:</span>
                                <span className="text-gray-900 ml-2">{new Date(service.scheduledDate).toLocaleDateString()}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Price:</span>
                                <span className="text-gray-900 ml-2">₹{service.price.toLocaleString()}</span>
                              </div>
                            </div>
                            {service.specialRequests && (
                              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                                <p className="text-sm text-gray-700">
                                  <strong>Special Requests:</strong> {service.specialRequests}
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 ml-4">
                            {service.status === 'scheduled' && (
                              <Button
                                size="sm"
                                onClick={() => handleStatusUpdate(service.id, 'in_progress')}
                                className="bg-purple-600 hover:bg-purple-700 text-white"
                              >
                                Start Service
                              </Button>
                            )}
                            {service.status === 'in_progress' && (
                              <Button
                                size="sm"
                                onClick={() => handleStatusUpdate(service.id, 'completed')}
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                Mark Complete
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingService(service);
                                setServiceModalOpen(true);
                              }}
                            >
                              <Edit2 className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tributes Tab */}
            {activeTab === 'tributes' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl text-gray-900">Memorial Tributes</h2>
                  <Button
                    onClick={() => setTributeModalOpen(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Tribute
                  </Button>
                </div>

                {tributes.length === 0 ? (
                  <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                    <ImageIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg text-gray-900 mb-2">No Memorial Tributes</h3>
                    <p className="text-gray-600 mb-4">Create beautiful tributes for beloved pets</p>
                    <Button
                      onClick={() => setTributeModalOpen(true)}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      Create Tribute
                    </Button>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tributes.map((tribute) => (
                      <div key={tribute.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        {tribute.petImage && (
                          <div className="h-48 bg-gray-200">
                            <img src={tribute.petImage} alt={tribute.petName} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="p-4">
                          <h3 className="text-lg text-gray-900 mb-2">{tribute.petName}</h3>
                          {tribute.dateOfBirth && (
                            <p className="text-sm text-gray-600">
                              {new Date(tribute.dateOfBirth).toLocaleDateString()} - {new Date(tribute.dateOfPassing).toLocaleDateString()}
                            </p>
                          )}
                          <p className="text-sm text-gray-700 italic mt-3 line-clamp-3">{tribute.epitaph}</p>
                          <div className="mt-4 flex items-center justify-between">
                            <Badge variant={tribute.isPublic ? "default" : "secondary"}>
                              {tribute.isPublic ? 'Public' : 'Private'}
                            </Badge>
                            <Button size="sm" variant="ghost">
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Products Tab */}
            {activeTab === 'products' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl text-gray-900">Memorial Products</h2>
                  <Button
                    onClick={() => {
                      setEditingProduct(null);
                      setProductModalOpen(true);
                    }}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Product
                  </Button>
                </div>

                {products.length === 0 ? (
                  <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                    <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg text-gray-900 mb-2">No Memorial Products</h3>
                    <p className="text-gray-600 mb-4">Add products like urns, photo frames, and memorial stones</p>
                    <Button
                      onClick={() => setProductModalOpen(true)}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      Add Product
                    </Button>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {products.map((product) => (
                      <div key={product.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h3 className="text-lg text-gray-900 mb-1">{product.name}</h3>
                              <Badge variant="secondary" className="mb-2">
                                {product.type.replace('_', ' ')}
                              </Badge>
                            </div>
                            <Badge variant={product.inStock ? "default" : "destructive"}>
                              {product.inStock ? 'In Stock' : 'Out of Stock'}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>
                          <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                            <div>
                              <span className="text-gray-600">Material:</span>
                              <p className="text-gray-900">{product.material}</p>
                            </div>
                            <div>
                              <span className="text-gray-600">Size:</span>
                              <p className="text-gray-900">{product.size}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                            <span className="text-lg text-gray-900">₹{product.price.toLocaleString()}</span>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingProduct(product);
                                  setProductModalOpen(true);
                                }}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteProduct(product.id)}
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals would go here - simplified for now */}
      {(serviceModalOpen || tributeModalOpen || productModalOpen) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg text-gray-900">
                {serviceModalOpen && (editingService ? 'Edit Service' : 'Add Service')}
                {tributeModalOpen && 'Create Tribute'}
                {productModalOpen && (editingProduct ? 'Edit Product' : 'Add Product')}
              </h3>
              <button
                onClick={() => {
                  setServiceModalOpen(false);
                  setTributeModalOpen(false);
                  setProductModalOpen(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <p className="text-sm text-gray-600">Form implementation to be added based on requirements</p>
          </div>
        </div>
      )}
    </div>
  );
}
