import { Button } from '../../../../components/ui/button';
import { Card } from '../../../../components/ui/card';
import { Search, User, Menu, Calendar, Sparkles } from 'lucide-react';
import { Input } from '../../../../components/ui/input';

interface CustomerHomeProps {
  phone: string;
  refreshKey?: number;
  onNavigate: (service: string) => void;
  onProfileClick: () => void;
  onSidebarOpen: () => void;
  onPetClick: (petId: string) => void;
  onAddPet: () => void;
  onViewBooking: (bookingId: string) => void;
}

export function CustomerHome({ phone, onNavigate, onProfileClick, onSidebarOpen }: CustomerHomeProps) {
  const services = [
    { id: 'vet', name: 'Veterinary', icon: '🩺', color: 'bg-blue-100 text-blue-600' },
    { id: 'grooming', name: 'Grooming', icon: '✂️', color: 'bg-pink-100 text-pink-600' },
    { id: 'training', name: 'Training', icon: '🦴', color: 'bg-yellow-100 text-yellow-600' },
    { id: 'boarding', name: 'Boarding', icon: '🏠', color: 'bg-green-100 text-green-600' },
    { id: 'walking', name: 'Walking', icon: '🐕', color: 'bg-orange-100 text-orange-600' },
    { id: 'shop', name: 'Shop', icon: '🛍️', color: 'bg-purple-100 text-purple-600' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white p-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onSidebarOpen}>
              <Menu className="w-6 h-6" />
            </Button>
            <div>
              <p className="text-xs text-gray-500">Location</p>
              <p className="font-bold text-sm flex items-center">
                Bangalore <span className="text-xs ml-1">▼</span>
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onProfileClick}>
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-gray-500" />
            </div>
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input 
            placeholder="Search for services, pets, etc." 
            className="pl-10 bg-gray-50 border-gray-200"
          />
        </div>
      </div>

      {/* Services Grid */}
      <div className="p-4">
        <h2 className="font-bold text-lg mb-4">Our Services</h2>
        <div className="grid grid-cols-3 gap-3">
          {services.map((service) => (
            <button
              key={service.id}
              onClick={() => onNavigate(service.id)}
              className="flex flex-col items-center p-3 bg-white rounded-xl shadow-sm border border-gray-100 active:scale-95 transition-transform"
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl mb-2 ${service.color}`}>
                {service.icon}
              </div>
              <span className="text-xs font-medium text-gray-700">{service.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-4 pt-0">
        <div className="bg-[#FF8C42] rounded-xl p-4 text-white flex items-center justify-between shadow-lg shadow-orange-200">
          <div>
            <h3 className="font-bold text-lg">Book a Service</h3>
            <p className="text-sm opacity-90">Get the best care for your pet</p>
          </div>
          <Button 
            onClick={() => onNavigate('services')}
            className="bg-white text-[#FF8C42] hover:bg-orange-50"
          >
            Book Now
          </Button>
        </div>
      </div>

      {/* Recent Activity / Promo */}
      <div className="p-4 pt-0">
        <h2 className="font-bold text-lg mb-4">Trending</h2>
        <Card className="p-4 flex gap-4 items-center">
          <div className="w-16 h-16 bg-purple-100 rounded-lg flex items-center justify-center text-2xl">
            🎁
          </div>
          <div>
            <h3 className="font-bold">Welcome Package</h3>
            <p className="text-xs text-gray-500">Get 20% off on your first grooming session</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
