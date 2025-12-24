import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import {
  ArrowLeft,
  Video,
  Home,
  Building2,
  FlaskConical,
  Pill,
  Star,
  Zap,
  Bell,
  Phone,
  Search,
  MapPin,
  Clock,
  Calendar,
  Truck,
  Dog,
  Coffee,
  Camera,
  Briefcase
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { CustomerNotificationModal } from './CustomerNotificationModal';

interface UniversalServicesLandingProps {
  roleId: string;
  roleName: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  customerId: string;
  phone: string;
}

// Dynamic Icon Map
const ICON_MAP: any = {
  'Video': Video,
  'Building2': Building2,
  'Home': Home,
  'FlaskConical': FlaskConical,
  'Pill': Pill,
  'Search': Search,
  'MapPin': MapPin,
  'Clock': Clock,
  'Calendar': Calendar,
  'Truck': Truck,
  'Dog': Dog,
  'Coffee': Coffee,
  'Camera': Camera,
  'Briefcase': Briefcase
};

// Default Buttons per Category
const DEFAULT_BUTTONS: any = {
  'transport': [
    { id: 'book_ride', label: 'Book Ride', icon: 'Truck', enabled: true },
    { id: 'schedule_later', label: 'Schedule Later', icon: 'Calendar', enabled: true }
  ],
  'lifestyle': [
    { id: 'visit_center', label: 'Visit Center', icon: 'Building2', enabled: true },
    { id: 'book_event', label: 'Book Event', icon: 'Calendar', enabled: true }
  ],
  'shelter': [
    { id: 'adopt', label: 'Adopt', icon: 'Dog', enabled: true },
    { id: 'donate', label: 'Donate', icon: 'Heart', enabled: true },
    { id: 'volunteer', label: 'Volunteer', icon: 'Users', enabled: true }
  ],
  'default': [
    { id: 'clinic_visit', label: 'Visit Center', icon: 'Building2', enabled: true },
    { id: 'home_visit', label: 'Home Visit', icon: 'Home', enabled: true }
  ]
};

export function UniversalServicesLanding({ 
  roleId, 
  roleName, 
  onBack, 
  onNavigate, 
  customerId, 
  phone 
}: UniversalServicesLandingProps) {
  const [loading, setLoading] = useState(true);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [serviceButtons, setServiceButtons] = useState<any[]>([]);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  
  // Theme colors based on role (can be expanded)
  const getThemeColor = () => {
    if (roleId.includes('shelter') || roleId.includes('adoption')) return 'bg-pink-500';
    if (roleId.includes('transport') || roleId.includes('taxi')) return 'bg-blue-500';
    if (roleId.includes('cafe') || roleId.includes('food')) return 'bg-amber-500';
    if (roleId.includes('training') || roleId.includes('walker')) return 'bg-green-500';
    return 'bg-[#FF8C42]'; // Default Orange
  };

  const themeBg = getThemeColor();

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        loadUnreadNotifications(),
        loadPromotions(),
        loadUiConfig()
      ]);
      setLoading(false);
    };
    
    loadData();
  }, [roleId]);

  const loadPromotions = async () => {
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/marketing/promotions?roleId=${roleId}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setPromotions(data.promotions || []);
      }
    } catch (error) {
      console.error('Error loading promotions:', error);
    }
  };

  const loadUiConfig = async () => {
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/config/ui/dashboard?roleId=${roleId}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      
      if (res.ok) {
        const data = await res.json();
        if (data.config && data.config.length > 0) {
            setServiceButtons(data.config.filter((btn: any) => btn.enabled));
            return;
        }
      }
      
      // Fallback logic
      let category = 'default';
      if (roleId.includes('taxi') || roleId.includes('ambulance')) category = 'transport';
      if (roleId.includes('cafe') || roleId.includes('resort')) category = 'lifestyle';
      if (roleId.includes('shelter')) category = 'shelter';
      
      setServiceButtons(DEFAULT_BUTTONS[category] || DEFAULT_BUTTONS['default']);
      
    } catch (error) {
      console.error('Error loading UI config:', error);
      setServiceButtons(DEFAULT_BUTTONS['default']);
    }
  };

  const loadUnreadNotifications = async () => {
    try {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/notifications/${cleanPhone}?limit=50`,
        {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const unreadCount = (data.notifications || []).filter((n: any) => !n.read).length;
        setUnreadNotifications(unreadCount);
      }
    } catch (error) {
      console.error('Error loading unread notifications:', error);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${themeBg}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${themeBg} max-w-md mx-auto pb-24`}>
      {/* Header */}
      <div className="px-6 pt-12 pb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack}
              className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-2xl font-bold text-white">{roleName}</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowNotificationModal(true)}
              className="relative w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <Bell className="w-5 h-5 text-white" />
              {unreadNotifications > 0 && (
                <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1 font-bold border-2 border-white">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
             <div className="text-2xl font-bold text-white">Top</div>
             <div className="text-xs text-white/80">Rated</div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
             <div className="text-2xl font-bold text-white">Verified</div>
             <div className="text-xs text-white/80">Partners</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-t-[32px] px-6 pt-8 min-h-[calc(100vh-180px)]">
        
        <div className="space-y-8">
          {/* Dynamic Promotions */}
          {promotions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-orange-500" />
                <h2 className="font-bold text-slate-900 text-lg">Offers</h2>
              </div>
              
              <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 scrollbar-hide">
                {promotions.map((promo, index) => (
                  <div 
                    key={promo.id}
                    className={`min-w-[260px] rounded-2xl p-5 text-white shadow-lg bg-gradient-to-r from-blue-500 to-purple-600`}
                  >
                    <div className="bg-white/20 w-fit px-2 py-1 rounded-lg text-xs font-medium mb-3 backdrop-blur-sm">
                      {promo.discountPercentage ? `${promo.discountPercentage}% OFF` : promo.discountAmount ? `₹${promo.discountAmount} OFF` : 'Special Offer'}
                    </div>
                    <h3 className="font-bold text-lg leading-tight mb-1">{promo.title || promo.name}</h3>
                    <p className="text-white/80 text-sm mb-4">{promo.description || promo.subtitle || ''}</p>
                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-xs text-white/70">
                        {promo.endDate ? `Valid until ${new Date(promo.endDate).toLocaleDateString()}` : 'Limited time'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search / Problem Grid Link */}
          <div 
            onClick={() => onNavigate('problem_grid')}
            className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
          >
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-orange-500">
                    <Search className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-bold text-gray-900">Find {roleName}</h3>
                    <p className="text-xs text-gray-500">Search by specific needs or problems</p>
                </div>
             </div>
             <div className="text-orange-500">
                 <ArrowLeft className="w-5 h-5 rotate-180" />
             </div>
          </div>

          {/* Service Buttons */}
          <div>
            <h2 className="font-bold text-slate-900 text-lg mb-4">Services</h2>
            <div className="grid grid-cols-2 gap-3">
              {serviceButtons.map((btn) => {
                const IconComp = ICON_MAP[btn.icon] || Building2;
                return (
                  <button
                    key={btn.id}
                    onClick={() => onNavigate(btn.id)} // Map to view
                    className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all text-left group"
                  >
                    <div className={`w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                      <IconComp className={`w-5 h-5 text-gray-600`} />
                    </div>
                    <h3 className="font-semibold text-slate-900 text-sm mb-0.5">{btn.label}</h3>
                    <p className="text-xs text-slate-500">Book now</p>
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* Notification Modal */}
      {showNotificationModal && (
        <CustomerNotificationModal
          phone={phone}
          onClose={() => setShowNotificationModal(false)}
          onNotificationClick={() => {}}
          onNotificationsRead={() => loadUnreadNotifications()}
        />
      )}
    </div>
  );
}
