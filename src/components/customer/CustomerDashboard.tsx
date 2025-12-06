import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { 
  Search, 
  Bell, 
  User,
  Dog,
  Scissors,
  Stethoscope,
  ShoppingBag,
  GraduationCap,
  Home,
  MapPin,
  Calendar,
  Heart,
  Coffee,
  Bike,
  Plus,
  Users,
  ShoppingCart
} from 'lucide-react';
import { createClient } from '../../utils/supabase/client';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { VetServiceRouter } from './VetServiceRouter';
import { CustomerAIChatbot } from './CustomerAIChatbot'; // ✅ NEW ENHANCED BOT
import { ProductBrowsing } from './shop/ProductBrowsing';
import { CartPage } from './shop/CartPage';
import { CheckoutPage } from './shop/CheckoutPage';
import { OrderSuccess } from './shop/OrderSuccess';
import { OrderHistory } from './shop/OrderHistory';
import { OrderDetail } from './shop/OrderDetail';

interface CustomerDashboardProps {
  session: any;
  journeyStage?: string | null;
}

export function CustomerDashboard({ session, journeyStage }: CustomerDashboardProps) {
  const [profile, setProfile] = useState<any>(null);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePet, setActivePet] = useState(0);
  const [currentView, setCurrentView] = useState<'dashboard' | 'vet_services' | 'shop' | 'cart' | 'checkout' | 'order_success' | 'order_history' | 'order_detail'>('dashboard');
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadProfile();
    loadDeals();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/profile`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setProfile(data.customer);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDeals = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/deals`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setDeals(data.deals || []);
      }
    } catch (error) {
      console.error('Error loading deals:', error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const pets = [
    { name: 'Oreo', icon: '🐶', active: true },
    { name: 'Sky', icon: '🦊', active: false },
    { name: 'Blue', icon: '🐟', active: false },
    { name: 'Ginger', icon: '🐱', active: false },
  ];

  const services = [
    { icon: Stethoscope, label: 'Vet', color: '#6B9FFF' },
    { icon: Scissors, label: 'Grooming', color: '#7FD47F' },
    { icon: ShoppingBag, label: 'Store', color: '#E89FFF' },
    { icon: Calendar, label: 'Appointment', color: '#FF9F9F' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FF8C42]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  // Show Vet Services if user has selected Vet
  if (currentView === 'vet_services') {
    return (
      <VetServiceRouter
        onBack={() => setCurrentView('dashboard')}
        customerId={session.user.id}
        session={session}
      />
    );
  }

  // Show Shop if user has selected Store
  if (currentView === 'shop') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="sticky top-0 z-40 bg-white border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setCurrentView('dashboard')}>
               <Home className="w-5 h-5" />
            </Button>
            <h1 className="font-semibold text-lg">Pet Shop</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setCurrentView('cart')}>
            <ShoppingCart className="w-5 h-5" />
          </Button>
        </div>
        <ProductBrowsing 
          customerId={session.user.id} 
          onProductClick={(id) => {
            // ProductBrowsing handles internal state for detail view
            // We could lift state up if we wanted deep linking, but internal is fine for now
          }} 
          onOrdersClick={() => setCurrentView('order_history')}
        />
        {/* AI Chat Bot Overlay */}
        <CustomerAIChatbot 
          customerId={session.user.id} 
          customerName={profile?.name || 'Priya'} 
          customerPhone={profile?.phone}
        />
      </div>
    );
  }

  // Show Cart
  if (currentView === 'cart') {
    return (
      <CartPage 
        customerId={session.user.id}
        onBack={() => setCurrentView('shop')}
        onCheckout={() => setCurrentView('checkout')}
      />
    );
  }

  // Show Checkout
  if (currentView === 'checkout') {
    return (
      <CheckoutPage 
        customerId={session.user.id}
        customerPhone={profile?.phone}
        onBack={() => setCurrentView('cart')}
        onOrderPlaced={(order) => {
          setLastOrder(order);
          setCurrentView('order_success');
        }}
      />
    );
  }

  // Show Order Success
  if (currentView === 'order_success' && lastOrder) {
    return (
      <OrderSuccess 
        order={lastOrder}
        onContinueShopping={() => setCurrentView('shop')}
        onViewOrder={(orderId) => {
          setSelectedOrderId(orderId);
          setCurrentView('order_detail');
        }}
      />
    );
  }

  // Show Order History
  if (currentView === 'order_history') {
    return (
      <OrderHistory 
        customerPhone={profile?.phone}
        onBack={() => setCurrentView('shop')}
        onViewOrder={(orderId) => {
          setSelectedOrderId(orderId);
          setCurrentView('order_detail');
        }}
      />
    );
  }

  // Show Order Detail
  if (currentView === 'order_detail' && selectedOrderId) {
    return (
      <OrderDetail 
        orderId={selectedOrderId}
        onBack={() => setCurrentView('order_history')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#FF8C42] flex flex-col max-w-md mx-auto relative">
      {/* Status Bar */}
      <div className="px-6 pt-3 pb-2 flex justify-between items-center text-black">
        <span>09:41</span>
        <div className="flex gap-1 items-center">
          <div className="w-4 h-3 bg-black/30"></div>
          <div className="w-4 h-3 bg-black/30"></div>
          <div className="w-6 h-3 bg-black/30"></div>
        </div>
      </div>

      {/* Header Section */}
      <div className="px-6 pt-2 pb-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-black">Hi, {profile?.name || 'Priya'}!</h2>
              <p className="text-black/70 text-sm">How's Oreo today?</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-[#FF8C42]/30">
              <Search className="w-5 h-5 text-white" />
            </button>
            <button className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-[#FF8C42]/30">
              <Bell className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Pet Icons - Horizontal Scroll */}
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide">
          {pets.map((pet, index) => (
            <button
              key={index}
              onClick={() => setActivePet(index)}
              className={`flex-shrink-0 flex flex-col items-center gap-1 ${
                activePet === index ? '' : 'opacity-60'
              }`}
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl ${
                activePet === index 
                  ? 'bg-white border-2 border-white shadow-lg' 
                  : 'bg-[#FF9F66]'
              }`}>
                {pet.icon}
              </div>
              <span className="text-xs text-black">{pet.name}</span>
            </button>
          ))}
          <button className="flex-shrink-0 flex flex-col items-center gap-1">
            <div className="w-16 h-16 bg-[#FF9F66] rounded-2xl flex items-center justify-center">
              <Plus className="w-6 h-6 text-[#FF8C42]" />
            </div>
            <span className="text-xs text-black">Add Pet</span>
          </button>
        </div>
      </div>

      {/* Main Content - White Background */}
      <div className="flex-1 bg-white rounded-t-[32px] px-6 pt-6 pb-24">
        {/* Pet Dashboard Card */}
        <Card className="mb-6 p-4 bg-white border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">🐶</span>
              <div>
                <h3 className="font-semibold">Oreo's Dashboard</h3>
                <p className="text-sm text-gray-500">Golden Retriever | 6 years old</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs">Active</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* Weight */}
            <div className="bg-purple-50 rounded-xl p-3">
              <div className="flex items-center gap-1 text-purple-600 mb-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
                <span className="text-xs">Weight</span>
              </div>
              <p className="font-semibold">12.5 kg</p>
              <span className="text-xs text-green-600">+0.5%</span>
            </div>

            {/* Checkup */}
            <div className="bg-red-50 rounded-xl p-3">
              <div className="flex items-center gap-1 text-red-600 mb-2">
                <Calendar className="w-4 h-4" />
                <span className="text-xs">Checkup</span>
              </div>
              <p className="font-semibold">Oct 15</p>
              <span className="text-xs text-gray-500">14 days ago</span>
            </div>

            {/* Mood */}
            <div className="bg-green-50 rounded-xl p-3">
              <div className="flex items-center gap-1 text-green-600 mb-2">
                <Heart className="w-4 h-4" />
                <span className="text-xs">Mood</span>
              </div>
              <p className="font-semibold">Happy</p>
              <span className="text-lg">😊</span>
            </div>
          </div>
        </Card>

        {/* Today's Hot Deals */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="flex items-center gap-1">
              <span>⚡</span>
              <span>Today's Hot Deals</span>
            </h3>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide">
            {/* Deal Card 1 - Blue */}
            <Card className="min-w-[240px] flex-shrink-0 bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none p-4 shadow-lg">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-sm opacity-90 mb-1">Vet Checkup</div>
                  <div className="text-3xl mb-1">50% OFF</div>
                  <div className="text-sm opacity-90">First checkup</div>
                </div>
                <div className="p-2 bg-white/20 rounded-lg">
                  <Stethoscope className="w-6 h-6" />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs">
                  <span className="line-through opacity-60">₹998</span>
                  <span className="ml-2 font-semibold">₹499</span>
                </div>
                <Button size="sm" className="bg-white text-blue-600 hover:bg-white/90 h-8">
                  Book Now
                </Button>
              </div>
            </Card>

            {/* Deal Card 2 - Green */}
            <Card className="min-w-[240px] flex-shrink-0 bg-gradient-to-br from-green-500 to-green-600 text-white border-none p-4 shadow-lg">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-sm opacity-90 mb-1">Spa Grooming</div>
                  <div className="text-3xl mb-1">30% OFF</div>
                  <div className="text-sm opacity-90">Premium package</div>
                </div>
                <div className="p-2 bg-white/20 rounded-lg">
                  <Scissors className="w-6 h-6" />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs">
                  <span className="line-through opacity-60">₹1140</span>
                  <span className="ml-2 font-semibold">₹799</span>
                </div>
                <Button size="sm" className="bg-white text-green-600 hover:bg-white/90 h-8">
                  Book Now
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* Quick Services */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3>Quick Services</h3>
            <button className="text-sm text-[#FF8C42]">See All</button>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {services.map((service, index) => (
              <button
                key={index}
                onClick={() => {
                  if (service.label === 'Vet') {
                    setCurrentView('vet_services');
                  } else if (service.label === 'Store') {
                    setCurrentView('shop');
                  }
                }}
                className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${service.color}20` }}
                >
                  <service.icon className="w-6 h-6" style={{ color: service.color }} />
                </div>
                <span className="text-xs text-center">{service.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t max-w-md mx-auto">
        <div className="px-4 py-3 flex items-center justify-around">
          <button 
            className={`flex flex-col items-center gap-1 ${currentView === 'dashboard' ? 'text-[#FF8C42]' : 'text-gray-400'}`}
            onClick={() => setCurrentView('dashboard')}
          >
            <Home className="w-5 h-5" />
            <span className="text-xs">Home</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-gray-400">
            <Stethoscope className="w-5 h-5" />
            <span className="text-xs">Services</span>
          </button>
          <button 
            className={`flex flex-col items-center gap-1 ${currentView === 'shop' ? 'text-[#FF8C42]' : 'text-gray-400'}`}
            onClick={() => setCurrentView('shop')}
          >
            <ShoppingCart className="w-5 h-5" />
            <span className="text-xs">Store</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-gray-400">
            <Users className="w-5 h-5" />
            <span className="text-xs">Community</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-gray-400" onClick={handleSignOut}>
            <User className="w-5 h-5" />
            <span className="text-xs">Profile</span>
          </button>
        </div>

        {/* Home Indicator */}
        <div className="flex justify-center pb-2">
          <div className="w-32 h-1 bg-black rounded-full"></div>
        </div>
      </div>

      {/* AI Chat Bot Overlay */}
      <CustomerAIChatbot 
        customerId={session.user.id} 
        customerName={profile?.name || 'Priya'} 
        customerPhone={profile?.phone}
      />
    </div>
  );
}