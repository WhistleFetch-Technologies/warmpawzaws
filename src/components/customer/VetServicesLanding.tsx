import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import {
  ArrowLeft,
  Stethoscope,
  Video,
  Home,
  FlaskConical,
  Pill,
  Star,
  TrendingUp,
  Zap,
  Bell,
  Phone,
  RefreshCw,
  Building2,
  Scissors
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { FollowUpModal } from './FollowUpModal';
import { CustomerNotificationModal } from './CustomerNotificationModal';
import { VET_PROBLEMS } from './ProblemGridSection';

interface VetServicesLandingProps {
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  customerId: string;
  phone: string;
}

// Icon mapping for dynamic config
const ICON_MAP: any = {
  'Video': Video,
  'Building2': Building2,
  'Home': Home,
  'FlaskConical': FlaskConical,
  'Pill': Pill,
  'RefreshCw': RefreshCw,
  'Scissors': Scissors
};

// Color mapping for dynamic config
const STYLE_MAP: any = {
  'tele_consultation': { color: 'text-blue-600', bg: 'bg-blue-50' },
  'clinic_visit': { color: 'text-orange-600', bg: 'bg-orange-50' },
  'home_visit': { color: 'text-green-600', bg: 'bg-green-50' },
  'lab_collection': { color: 'text-purple-600', bg: 'bg-purple-50' },
  'medicine_delivery': { color: 'text-red-600', bg: 'bg-red-50' },
  'followup': { color: 'text-cyan-600', bg: 'bg-cyan-50' },
  'grooming_center': { color: 'text-pink-600', bg: 'bg-pink-50' },
  'grooming_home': { color: 'text-teal-600', bg: 'bg-teal-50' }
};

export function VetServicesLanding({ onBack, onNavigate, customerId, phone }: VetServicesLandingProps) {
  const [loading, setLoading] = useState(true);
  const [followUpEligible, setFollowUpEligible] = useState<any[]>([]);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  
  // New Dynamic State
  const [promotions, setPromotions] = useState<any[]>([]);
  const [serviceButtons, setServiceButtons] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        loadFollowUpEligibility(),
        loadUnreadNotifications(),
        loadPromotions(),
        loadUiConfig()
      ]);
      setLoading(false);
    };
    
    loadData();
    
    const interval = setInterval(loadUnreadNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadPromotions = async () => {
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/marketing/promotions?roleId=veterinarian`,
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
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/config/ui/dashboard?roleId=veterinarian`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      if (res.ok) {
        const data = await res.json();
        const config = data.config || [];
        // Filter enabled buttons
        setServiceButtons(config.filter((btn: any) => btn.enabled));
      } else {
        // Fallback to defaults if API fails (prevents empty screen)
        setServiceButtons([
          { id: 'tele_consultation', label: 'Tele Consultation', icon: 'Video', enabled: true },
          { id: 'clinic_visit', label: 'Clinic Visit', icon: 'Building2', enabled: true },
          { id: 'home_visit', label: 'Home Visit', icon: 'Home', enabled: true },
          { id: 'lab_collection', label: 'Lab Tests', icon: 'FlaskConical', enabled: true },
          { id: 'medicine_delivery', label: 'Pharmacy', icon: 'Pill', enabled: true }
        ]);
      }
    } catch (error) {
      console.error('Error loading UI config:', error);
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

  const handleNotificationClick = (notification: any) => {
    if (notification.type === 'chat_message' && notification.bookingId) {
      const booking = followUpEligible.find(b => b.bookingId === notification.bookingId);
      if (booking) {
        setShowNotificationModal(false);
        setShowFollowUpModal(true);
      }
    }
    setShowNotificationModal(false);
  };

  const loadFollowUpEligibility = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/bookings/follow-up-eligible/${phone}`,
        {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setFollowUpEligible(data.bookings || []);
      }
    } catch (error) {
      console.error('Error loading follow-up eligibility:', error);
    }
  };

  // Add Follow-Up button dynamically if eligible
  const finalButtons = [...serviceButtons];
  if (followUpEligible.length > 0 && !finalButtons.some(b => b.id === 'followup')) {
    finalButtons.push({
      id: 'followup',
      label: 'Follow-Up',
      icon: 'RefreshCw',
      enabled: true
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FF8C42]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FF8C42] max-w-md mx-auto pb-24">
      {/* Header - Orange Background */}
      <div className="px-6 pt-12 pb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack}
              className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-2xl font-bold text-white">Vet Services</h1>
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

        {/* Stats / Quick Info in Header */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
            <div className="text-2xl font-bold text-white">500+</div>
            <div className="text-xs text-white/80">Expert Vets</div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
             <div className="text-2xl font-bold text-white">24/7</div>
             <div className="text-xs text-white/80">Support</div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
             <div className="flex items-center gap-1 text-2xl font-bold text-white">
               4.9 <Star className="w-4 h-4 fill-white" />
             </div>
             <div className="text-xs text-white/80">Rating</div>
          </div>
        </div>
      </div>

      {/* Main Content - White Card with Top Radius */}
      <div className="bg-white rounded-t-[32px] px-6 pt-8 min-h-[calc(100vh-180px)]">
        
        {/* Emergency Banner - High Contrast in White Section */}
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center justify-between shadow-sm mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <Phone className="w-5 h-5 text-red-600 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-red-900 text-sm">Medical Emergency?</h3>
              <p className="text-red-700 text-xs">24/7 Vet Support</p>
            </div>
          </div>
          <Button size="sm" className="bg-red-600 text-white hover:bg-red-700 border-none shadow-sm text-xs h-8">
            Call Now
          </Button>
        </div>

        <div className="space-y-8">
          {/* Dynamic Spotlight Deals */}
          {promotions.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-orange-500" />
                <h2 className="font-bold text-slate-900 text-lg">Featured Offers</h2>
              </div>
              
              <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 scrollbar-hide">
                {promotions.map((promo, index) => (
                  <div 
                    key={promo.id}
                    className={`min-w-[260px] rounded-2xl p-5 text-white shadow-lg ${
                      index % 2 === 0 ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : 'bg-gradient-to-r from-green-500 to-teal-600'
                    }`}
                  >
                    <div className="bg-white/20 w-fit px-2 py-1 rounded-lg text-xs font-medium mb-3 backdrop-blur-sm">
                      {promo.discountType === 'percentage' ? `${promo.discountValue}% OFF` : `₹${promo.discountValue} OFF`}
                    </div>
                    <h3 className="font-bold text-lg leading-tight mb-1">{promo.title}</h3>
                    <p className="text-white/80 text-sm mb-4">{promo.subtitle}</p>
                    <div className="flex items-center justify-between mt-auto">
                      <div>
                        <span className="text-sm font-mono bg-black/20 px-2 py-1 rounded">{promo.code}</span>
                      </div>
                      <Button size="sm" className="bg-white text-slate-900 hover:bg-white/90 border-none h-8 text-xs font-bold">
                        Claim
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Health Problems Grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-900 text-lg">Consult by Problem</h2>
              <button 
                onClick={() => onNavigate('problem_grid')}
                className="text-sm text-orange-600 font-medium"
              >
                View All
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {VET_PROBLEMS.map((problem) => {
                const isViewAll = problem.id === 'view_all';
                return (
                  <button
                    key={problem.id}
                    onClick={() => {
                      if (isViewAll) {
                        onNavigate('problem_grid');
                      } else {
                        onNavigate('problem_selected', { problemId: problem.id });
                      }
                    }}
                    className="group flex flex-col items-center gap-2"
                  >
                    <div className={`
                      w-full aspect-square rounded-2xl flex items-center justify-center text-2xl shadow-sm transition-all
                      ${isViewAll 
                        ? 'bg-orange-50 border border-orange-100 text-orange-600' 
                        : 'bg-white border border-slate-100 group-hover:border-orange-200 group-hover:shadow-md'
                      }
                    `}>
                      {problem.icon}
                    </div>
                    <span className={`text-[10px] font-medium text-center leading-tight line-clamp-2 ${isViewAll ? 'text-orange-600' : 'text-slate-600'}`}>
                      {problem.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic Service Types Grid */}
          <div>
            <h2 className="font-bold text-slate-900 text-lg mb-4">All Services</h2>
            <div className="grid grid-cols-2 gap-3">
              {finalButtons.map((service) => {
                const IconComp = ICON_MAP[service.icon] || Building2;
                const styles = STYLE_MAP[service.id] || { color: 'text-gray-600', bg: 'bg-gray-50' };
                
                // Special case for followup badge
                const badge = service.id === 'followup' && followUpEligible.length > 0 
                  ? `${followUpEligible.length} Active` 
                  : null;

                return (
                  <button
                    key={service.id}
                    onClick={() => {
                      if (service.id === 'followup') {
                        setShowFollowUpModal(true);
                      } else {
                        onNavigate(service.id);
                      }
                    }}
                    className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all text-left group"
                  >
                    <div className={`w-10 h-10 rounded-xl ${styles.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                      <IconComp className={`w-5 h-5 ${styles.color}`} />
                    </div>
                    <h3 className="font-semibold text-slate-900 text-sm mb-0.5">{service.label}</h3>
                    <p className="text-xs text-slate-500">
                      {service.id === 'tele_consultation' ? 'Video call expert' : 
                       service.id === 'clinic_visit' ? 'Nearby clinics' :
                       service.id === 'home_visit' ? 'Vet at doorstep' : 'Book appointment'}
                    </p>
                    {badge && (
                      <span className="inline-block mt-2 px-2 py-0.5 bg-cyan-100 text-cyan-700 text-[10px] font-bold rounded-full">
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Follow-Up Modal */}
      {showFollowUpModal && (
        <FollowUpModal
          onClose={() => setShowFollowUpModal(false)}
          bookings={followUpEligible}
          customerPhone={phone}
          onNavigate={onNavigate}
        />
      )}

      {/* Notification Modal */}
      {showNotificationModal && (
        <CustomerNotificationModal
          phone={phone}
          onClose={() => setShowNotificationModal(false)}
          onNotificationClick={handleNotificationClick}
          onNotificationsRead={() => loadUnreadNotifications()}
        />
      )}
    </div>
  );
}
