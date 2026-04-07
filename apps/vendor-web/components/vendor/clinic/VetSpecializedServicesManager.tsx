'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { 
  ArrowLeft,
  Ambulance,
  Stethoscope,
  Syringe,
  Pill,
  Activity,
  AlertCircle,
  Plus,
  Edit,
  Trash2,
  Clock,
  Phone,
  MapPin,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface VetSpecializedServicesManagerProps {
  vendorId: string;
  vendorData?: any;
  onBack: () => void;
}

interface SpecializedService {
  id: string;
  type: 'ambulance' | 'diagnostic' | 'emergency' | 'pharmacy' | 'surgery';
  name: string;
  description: string;
  price: number;
  isActive: boolean;
  availability: string;
}

export function VetSpecializedServicesManager({ vendorId, onBack }: VetSpecializedServicesManagerProps) {
  const [services, setServices] = useState<SpecializedService[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('ambulance');

  useEffect(() => {
    loadServices();
  }, [vendorId]);

  const loadServices = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/${vendorId}/specialized-services`);
      
      if (response.success && response.services) {
        setServices(response.services);
      } else {
        // Mock data for demo
        setServices([
          {
            id: '1',
            type: 'ambulance',
            name: 'Pet Ambulance Service',
            description: '24/7 emergency pet pickup and transport',
            price: 1500,
            isActive: true,
            availability: '24/7'
          },
          {
            id: '2',
            type: 'diagnostic',
            name: 'X-Ray & Imaging',
            description: 'Digital X-ray, ultrasound, and imaging services',
            price: 2000,
            isActive: true,
            availability: '9 AM - 8 PM'
          },
          {
            id: '3',
            type: 'emergency',
            name: 'Emergency Critical Care',
            description: 'ICU and critical care for pets',
            price: 5000,
            isActive: true,
            availability: '24/7'
          },
          {
            id: '4',
            type: 'surgery',
            name: 'Surgical Procedures',
            description: 'Minor and major surgical procedures',
            price: 10000,
            isActive: true,
            availability: 'By Appointment'
          }
        ]);
      }
    } catch (error) {
      console.error('Error loading services:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleService = async (serviceId: string) => {
    try {
      const service = services.find(s => s.id === serviceId);
      if (!service) return;

      // Optimistic update
      setServices(services.map(s => 
        s.id === serviceId ? { ...s, isActive: !s.isActive } : s
      ));

      await apiClient.put<any>(`/vendor/${vendorId}/specialized-services/${serviceId}`, {
        isActive: !service.isActive
      });

      toast.success(`Service ${service.isActive ? 'disabled' : 'enabled'}`);
    } catch (error) {
      // Revert on error
      setServices(services.map(s => 
        s.id === serviceId ? { ...s, isActive: !s.isActive } : s
      ));
      toast.error('Failed to update service');
    }
  };

  const getServiceIcon = (type: string) => {
    switch (type) {
      case 'ambulance': return <Ambulance className="w-6 h-6" />;
      case 'diagnostic': return <Stethoscope className="w-6 h-6" />;
      case 'emergency': return <AlertCircle className="w-6 h-6" />;
      case 'pharmacy': return <Pill className="w-6 h-6" />;
      case 'surgery': return <Syringe className="w-6 h-6" />;
      default: return <Activity className="w-6 h-6" />;
    }
  };

  const serviceTypes = [
    { id: 'ambulance', label: 'Ambulance', icon: Ambulance, color: 'bg-red-500' },
    { id: 'diagnostic', label: 'Diagnostic', icon: Stethoscope, color: 'bg-blue-500' },
    { id: 'emergency', label: 'Emergency', icon: AlertCircle, color: 'bg-orange-500' },
    { id: 'surgery', label: 'Surgery', icon: Syringe, color: 'bg-purple-500' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 vendor-app-column">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading specialized services...</p>
        </div>
      </div>
    );
  }

  const filteredServices = activeTab === 'all' 
    ? services 
    : services.filter(s => s.type === activeTab);

  return (
    <div className="min-h-screen bg-gray-50 vendor-app-column">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B2C] text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Specialized Services</h1>
            <p className="text-sm text-white/80">Manage your clinic's specialized offerings</p>
          </div>
        </div>

        {/* Service Type Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
          {serviceTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setActiveTab(type.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm whitespace-nowrap transition-all ${
                activeTab === type.id
                  ? 'bg-white text-[#FF8C42] font-semibold'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              <type.icon className="w-4 h-4" />
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Services Grid */}
      <div className="p-4 space-y-4">
        {filteredServices.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <Activity className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No Services Found</h3>
            <p className="text-gray-500 mb-4">Add your first specialized service</p>
            <button className="bg-[#FF8C42] text-white px-6 py-2 rounded-lg font-medium">
              <Plus className="w-4 h-4 inline mr-2" />
              Add Service
            </button>
          </div>
        ) : (
          filteredServices.map((service) => (
            <div
              key={service.id}
              className={`bg-white rounded-xl border-2 p-4 transition-all ${
                service.isActive ? 'border-green-200' : 'border-gray-200 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    service.type === 'ambulance' ? 'bg-red-100 text-red-600' :
                    service.type === 'diagnostic' ? 'bg-blue-100 text-blue-600' :
                    service.type === 'emergency' ? 'bg-orange-100 text-orange-600' :
                    'bg-purple-100 text-purple-600'
                  }`}>
                    {getServiceIcon(service.type)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{service.name}</h3>
                    <p className="text-sm text-gray-500 capitalize">{service.type}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleService(service.id)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    service.isActive ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      service.isActive ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-3">{service.description}</p>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{service.availability}</span>
                  </div>
                </div>
                <p className="font-semibold text-[#FF8C42]">₹{service.price.toLocaleString()}</p>
              </div>

              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                <button className="flex-1 py-2 text-sm font-medium text-gray-600 hover:text-[#FF8C42] flex items-center justify-center gap-1">
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
                <button className="flex-1 py-2 text-sm font-medium text-gray-600 hover:text-red-500 flex items-center justify-center gap-1">
                  <Trash2 className="w-4 h-4" />
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating Add Button */}
      <button className="fixed bottom-6 right-6 w-14 h-14 bg-[#FF8C42] text-white rounded-full shadow-lg flex items-center justify-center hover:bg-[#FF7A29] transition-colors">
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
