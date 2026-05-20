'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import {
  VENDOR_MIN_PAYOUT_REQUEST_HELP_TEXT,
  VENDOR_MIN_PAYOUT_REQUEST_RS,
} from '@/lib/vendor-payout';
import { VendorDynamicNavigation } from './navigation/VendorDynamicNavigation';
import { CAPABILITY_ROUTES, getCapabilitiesByCategory } from '@/lib/capability-routes';
import { MealPlansComingSoonPanel } from './MealPlansComingSoonPanel';

// ============================================================================
// TYPES
// ============================================================================

interface Vendor {
  id: string;
  business_name: string;
  owner_name: string;
  phone: string;
  email: string;
  role_id: string;
  vendor_type?: 'solo' | 'business';
  status: string;
  tier: string;
  rating: number;
  total_reviews: number;
  metadata: Record<string, any>;
}

interface Capability {
  id: string;
  name: string;
  display_name: string;
  icon: string;
  description: string;
  category: 'core' | 'services' | 'specialized' | 'operations' | 'finance' | 'communication';
  route: string;
}

interface DashboardStats {
  todayBookings: number;
  pendingBookings: number;
  completedToday: number;
  earnings: number;
  pendingSettlement: number;
  rating: number;
  totalReviews: number;
}

interface Booking {
  id: string;
  customer_name: string;
  service_name: string;
  booking_date: string;
  booking_time: string;
  status: string;
  total_amount: number;
  service_style: string;
}

// ============================================================================
// CAPABILITY DEFINITIONS (45+ capabilities)
// Convert CAPABILITY_ROUTES to Capability format for compatibility
// ============================================================================

const ALL_CAPABILITIES: Capability[] = Object.values(CAPABILITY_ROUTES).map(route => ({
  id: route.name,
  name: route.name,
  display_name: route.display_name,
  icon: route.icon,
  description: route.description,
  category: route.category,
  route: route.route,
}));

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function VendorCapabilityDashboard({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);
  const [activeSection, setActiveSection] = useState<string>('dashboard');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, [vendorId]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load vendor profile with role and capabilities
      const [vendorResponse, statsResponse, bookingsResponse] = await Promise.all([
        apiClient.get<any>(`/vendor/${vendorId}/profile`),
        apiClient.get<any>(`/vendor/${vendorId}/dashboard`),
        apiClient.get<any>(`/vendor/${vendorId}/bookings/today`),
      ]);

      if (vendorResponse.vendor || vendorResponse.success) {
        setVendor(vendorResponse.vendor || vendorResponse);
      }

      // Get capabilities for the role
      if (vendorResponse.vendor?.role_id) {
        const roleResponse = await apiClient.get<any>(`/config/roles/${vendorResponse.vendor.role_id}`);
        if (roleResponse.capabilities) {
          setCapabilities(roleResponse.capabilities);
        }
      }

      if (statsResponse.stats || statsResponse.success) {
        setStats(statsResponse.stats || statsResponse);
      }

      if (bookingsResponse.bookings) {
        setTodayBookings(bookingsResponse.bookings);
      }
    } catch (err: any) {
      console.error('Error loading dashboard:', err);
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  // Filter capabilities based on vendor's role and type
  // Solo vendors: Get all role-based capabilities except staff management
  // Business vendors: Get all role-based capabilities including staff management
  const enabledCapabilities = ALL_CAPABILITIES.filter(cap => {
    // Core capabilities always shown (dashboard, bookings, profile, etc.)
    if (cap.category === 'core') {
      return true;
    }
    
    // Check if capability is in role permissions
    if (!capabilities.includes(cap.name)) {
      return false;
    }
    
    // Staff capability only for business vendors
    // Solo vendors manage themselves directly without staff management structure
    // All other capabilities (services, bookings, earnings, etc.) are available to solo vendors
    if (cap.name === 'staff' && vendor?.vendor_type === 'solo') {
      return false;
    }
    
    return true;
  });

  const groupedCapabilities = enabledCapabilities.reduce((acc, cap) => {
    if (!acc[cap.category]) acc[cap.category] = [];
    acc[cap.category].push(cap);
    return acc;
  }, {} as Record<string, Capability[]>);

  const categoryLabels: Record<string, string> = {
    core: 'Core',
    services: 'Services',
    specialized: 'Specialized',
    operations: 'Operations',
    finance: 'Finance',
    communication: 'Communication',
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center p-8 bg-white rounded-2xl shadow-lg max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button onClick={loadDashboardData} className="px-6 py-3 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Top Header */}
      <header className="bg-gradient-to-r from-orange-500 to-orange-600 text-white sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img 
                src="/warmpawz-logo.svg" 
                alt="Warmpawz" 
                className="w-12 h-12 rounded-2xl object-contain bg-white/20 p-2"
              />
              <div>
                <h1 className="text-xl font-bold">{vendor?.business_name || 'Vendor Dashboard'}</h1>
                <p className="text-sm text-orange-100">{vendor?.owner_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {vendor?.tier && (
                <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                  {vendor.tier} Tier
                </span>
              )}
              <button className="p-2 hover:bg-white/10 rounded-full transition">
                <span className="text-2xl">🔔</span>
              </button>
              <button className="p-2 hover:bg-white/10 rounded-full transition">
                <span className="text-2xl">⚙️</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
        {/* Sidebar Navigation */}
        <aside className="w-64 flex-shrink-0">
          <VendorDynamicNavigation 
            enabledCapabilities={enabledCapabilities}
            vendorType={vendor?.vendor_type}
          />
        </aside>

        {/* Main Content */}
        <main className="flex-1 space-y-6">
          {/* Stats Section - Always visible on dashboard */}
          {activeSection === 'dashboard' && stats && (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon="📅" value={stats.todayBookings} label="Today's Bookings" color="blue" />
                <StatCard icon="⏳" value={stats.pendingBookings} label="Pending" color="yellow" />
                <StatCard icon="✅" value={stats.completedToday} label="Completed" color="green" />
                <StatCard icon="💰" value={`₹${(stats.earnings || 0).toLocaleString()}`} label="Earnings" color="emerald" />
              </div>

              {/* Pending Settlement Banner */}
              {(stats.pendingSettlement || 0) > 0 && (
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm">Pending Settlement</p>
                    <p className="text-3xl font-bold mt-2">₹{stats.pendingSettlement.toLocaleString()}</p>
                    <p className="text-green-100 text-sm mt-1">Expected within 7 days</p>
                  </div>
                  <button className="px-4 py-2 bg-white text-green-600 rounded-xl font-semibold hover:bg-green-50 transition">
                    View Details
                  </button>
                </div>
              )}

              {/* Today's Bookings */}
              <div className="bg-white rounded-2xl shadow-sm">
                <div className="p-6 border-b">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">Today's Bookings</h2>
                    <button 
                      onClick={() => setActiveSection('bookings')}
                      className="text-orange-500 text-sm font-medium hover:text-orange-600"
                    >
                      View All →
                    </button>
                  </div>
                </div>
                
                {todayBookings.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="text-5xl mb-4">📅</div>
                    <h3 className="text-lg font-semibold text-gray-900">No bookings today</h3>
                    <p className="text-gray-500 mt-2">Enjoy your day off!</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {todayBookings.map((booking) => (
                      <BookingCard key={booking.id} booking={booking} />
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Actions based on capabilities */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {enabledCapabilities
                    .filter(cap => ['services', 'bookings', 'schedule', 'earnings', 'chat', 'profile', 'analytics', 'reviews'].includes(cap.name))
                    .slice(0, 8)
                    .map((cap) => (
                      <button
                        key={cap.id}
                        onClick={() => router.push(cap.route)}
                        className="flex flex-col items-center p-4 bg-gray-50 rounded-xl hover:bg-orange-50 transition group"
                      >
                        <span className="text-3xl mb-2">{cap.icon}</span>
                        <span className="text-sm text-gray-700 group-hover:text-orange-600 font-medium">{cap.display_name}</span>
                      </button>
                    ))}
                </div>
              </div>
            </>
          )}

          {/* Dynamic Section Content - Only show on dashboard route */}
          {activeSection === 'dashboard' && (
            <div className="text-center py-12">
              <p className="text-gray-500">Use navigation menu to access different sections</p>
            </div>
          )}
        </main>
      </div>

      {/* Bottom Navigation for Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg lg:hidden z-30 safe-area-bottom">
        <div className="flex justify-around py-2">
          {['dashboard', 'bookings', 'services', 'earnings', 'profile'].map((section) => {
            const cap = ALL_CAPABILITIES.find(c => c.name === section);
            if (!cap) return null;
            return (
              <button
                key={section}
                onClick={() => setActiveSection(section)}
                className={`flex flex-col items-center justify-center min-h-[44px] min-w-[3rem] px-2 gap-0.5 ${
                  activeSection === section ? 'text-orange-500' : 'text-gray-500'
                }`}
              >
                <span className="text-lg">{cap.icon}</span>
                <span className="text-[10px]">{cap.display_name}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function StatCard({ icon, value, label, color }: { icon: string; value: string | number; label: string; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    green: 'bg-green-50 text-green-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  };

  return (
    <div className={`${colorClasses[color]} rounded-2xl p-6`}>
      <div className="text-3xl mb-2">{icon}</div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm opacity-80 mt-1">{label}</p>
    </div>
  );
}

function BookingCard({ booking }: { booking: Booking }) {
  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-green-100 text-green-700',
    in_progress: 'bg-blue-100 text-blue-700',
    completed: 'bg-gray-100 text-gray-700',
    cancelled: 'bg-red-100 text-red-700',
  };

  return (
    <div className="p-4 hover:bg-gray-50 transition">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center text-xl">
            🐾
          </div>
          <div>
            <h3 className="font-medium text-gray-900">{booking.customer_name}</h3>
            <p className="text-sm text-gray-500">{booking.service_name}</p>
            <p className="text-xs text-gray-400 mt-1">{booking.service_style}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">{booking.booking_time}</p>
          <p className="text-sm text-gray-500">₹{booking.total_amount}</p>
          <span className={`text-xs px-2 py-1 rounded-full ${statusColors[booking.status] || 'bg-gray-100 text-gray-700'}`}>
            {booking.status.replace('_', ' ')}
          </span>
        </div>
      </div>
    </div>
  );
}

function CapabilitySection({ capability, vendorId, vendor }: { capability?: Capability; vendorId: string; vendor: Vendor | null }) {
  if (!capability) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-xl font-semibold text-gray-900">Section Not Available</h2>
        <p className="text-gray-500 mt-2">This capability is not enabled for your role.</p>
      </div>
    );
  }

  // Render specific section based on capability
  return (
    <div className="bg-white rounded-2xl shadow-sm">
      <div className="p-6 border-b">
        <div className="flex items-center gap-4">
          <span className="text-3xl">{capability.icon}</span>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{capability.display_name}</h2>
            <p className="text-sm text-gray-500">{capability.description}</p>
          </div>
        </div>
      </div>
      
      <div className="p-6">
        {/* Render specific content based on capability type */}
        {capability.name === 'services' && <ServicesSection vendorId={vendorId} />}
        {capability.name === 'staff' && <StaffSection vendorId={vendorId} />}
        {capability.name === 'bookings' && <BookingsSection vendorId={vendorId} />}
        {capability.name === 'earnings' && <EarningsSection vendorId={vendorId} />}
        {capability.name === 'schedule' && <ScheduleSection vendorId={vendorId} />}
        {capability.name === 'profile' && <ProfileSection vendor={vendor} />}
        {capability.name === 'prescriptions' && <PrescriptionsSection vendorId={vendorId} />}
        {capability.name === 'medical_records' && <MedicalRecordsSection vendorId={vendorId} />}
        {capability.name === 'vaccination' && <VaccinationSection vendorId={vendorId} />}
        {capability.name === 'diagnostics' && <DiagnosticsSection vendorId={vendorId} />}
        {capability.name === 'pricing' && <PricingSection vendorId={vendorId} />}
        {capability.name === 'reviews' && <ReviewsSection vendorId={vendorId} />}
        {capability.name === 'analytics' && <AnalyticsSection vendorId={vendorId} />}
        {capability.name === 'reports' && <ReportsSection vendorId={vendorId} />}
        {capability.name === 'cafe_tables' && <CafeTablesSection vendorId={vendorId} />}
        {capability.name === 'rooms' && <RoomsSection vendorId={vendorId} />}
        {capability.name === 'insurance_plans' && <InsurancePlansSection vendorId={vendorId} />}
        {capability.name === 'adoption' && <AdoptionSection vendorId={vendorId} />}
        {capability.name === 'meal_plans' && <MealPlansSection vendorId={vendorId} />}
        {capability.name === 'walking' && <WalkingSection vendorId={vendorId} />}
        {capability.name === 'ambulance' && <AmbulanceSection vendorId={vendorId} />}
        {/* DETACHED: Package Management - 500 errors */}
        {false && capability.name === 'holiday_packages' && <HolidaysSection vendorId={vendorId} />}
        {capability.name === 'products' && <ProductsSection vendorId={vendorId} />}
        {capability.name === 'training_programs' && <TrainingSection vendorId={vendorId} />}
        {capability.name === 'chat' && <ChatSection vendorId={vendorId} />}
        {capability.name === 'video_call' && <VideoCallSection vendorId={vendorId} />}
        {capability.name === 'notifications' && <NotificationsSection vendorId={vendorId} />}
        {capability.name === 'settlements' && <SettlementsSection vendorId={vendorId} />}
        {capability.name === 'bank_account' && <BankAccountSection vendorId={vendorId} />}
        {capability.name === 'orders' && <OrdersSection vendorId={vendorId} />}
        {false && capability.name === 'packages' && <PackagesSection vendorId={vendorId} />}
        {capability.name === 'subscriptions' && <SubscriptionsSection vendorId={vendorId} />}
        {capability.name === 'inventory' && <InventorySection vendorId={vendorId} />}
        {capability.name === 'gps_tracking' && <GPSTrackingSection vendorId={vendorId} />}
        {capability.name === 'centre_booking' && <CentreBookingSection vendorId={vendorId} />}
        {capability.name === 'home_services' && <HomeServicesSection vendorId={vendorId} />}
        {capability.name === 'tele_consultation' && <TeleConsultationSection vendorId={vendorId} />}
        {capability.name === 'reservations' && <ReservationsSection vendorId={vendorId} />}
        {capability.name === 'checkin_checkout' && <CheckinCheckoutSection vendorId={vendorId} />}
        {capability.name === 'route_tracking' && <RouteTrackingSection vendorId={vendorId} />}
        {capability.name === 'service_radius' && <ServiceRadiusSection vendorId={vendorId} />}
        {capability.name === 'tour_schedule' && <TourScheduleSection vendorId={vendorId} />}
        {capability.name === 'menu' && <MenuSection vendorId={vendorId} />}
        {capability.name === 'vehicles' && <VehiclesSection vendorId={vendorId} />}
        {capability.name === 'boarding' && <BoardingSection vendorId={vendorId} />}
        {capability.name === 'policies' && <PoliciesSection vendorId={vendorId} />}
        {capability.name === 'claims' && <ClaimsSection vendorId={vendorId} />}
        {capability.name === 'pet_profiles' && <PetProfilesSection vendorId={vendorId} />}
        {capability.name === 'lineage' && <LineageSection vendorId={vendorId} />}
        {capability.name === 'progress_tracking' && <ProgressTrackingSection vendorId={vendorId} />}
        {capability.name === 'food_delivery' && <FoodDeliverySection vendorId={vendorId} />}
        {capability.name === 'seller_hub' && <SellerHubSection vendorId={vendorId} />}
        {capability.name === 'settings' && <SettingsSection vendorId={vendorId} />}
        {capability.name === 'test_catalog' && <TestCatalogSection vendorId={vendorId} />}
        
        {/* Skip dashboard - it's the main dashboard itself */}
        {capability.name === 'dashboard' && null}
        
        {/* Default sections for remaining capabilities */}
        {!['services', 'staff', 'bookings', 'earnings', 'schedule', 'profile', 'prescriptions', 'medical_records', 'vaccination', 'diagnostics', 'pricing', 'reviews', 'analytics', 'reports', 'cafe_tables', 'rooms', 'insurance_plans', 'adoption', 'meal_plans', 'walking', 'ambulance', 'holiday_packages', 'products', 'training_programs', 'chat', 'video_call', 'notifications', 'settlements', 'bank_account', 'orders', 'packages', 'subscriptions', 'inventory', 'gps_tracking', 'centre_booking', 'home_services', 'tele_consultation', 'reservations', 'checkin_checkout', 'route_tracking', 'service_radius', 'tour_schedule', 'menu', 'vehicles', 'boarding', 'policies', 'claims', 'pet_profiles', 'lineage', 'progress_tracking', 'food_delivery', 'seller_hub', 'settings', 'test_catalog', 'dashboard'].includes(capability.name) && (
          <DefaultCapabilitySection capability={capability} vendorId={vendorId} />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SPECIALIZED SECTIONS
// ============================================================================

function ServicesSection({ vendorId }: { vendorId: string }) {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadServices();
  }, [vendorId]);

  const loadServices = async () => {
    try {
      const data = await apiClient.get<any>(`/vendor/${vendorId}/services`);
      setServices(data?.services || []);
    } catch (err) {
      console.error('Error loading services:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-gray-500">{services.length} services configured</p>
        <button className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition">
          + Add Service
        </button>
      </div>
      
      {services.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-xl">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="font-semibold text-gray-900">No services yet</h3>
          <p className="text-gray-500">Add your first service to start accepting bookings</p>
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((service) => (
            <div key={service.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <h4 className="font-medium text-gray-900">{service.name}</h4>
                <p className="text-sm text-gray-500">{service.duration} mins • ₹{service.price}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs ${service.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {service.is_active ? 'Active' : 'Inactive'}
                </span>
                <button className="p-2 hover:bg-gray-200 rounded-lg transition">✏️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StaffSection({ vendorId }: { vendorId: string }) {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStaff();
  }, [vendorId]);

  const loadStaff = async () => {
    try {
      const data = await apiClient.get<any>(`/vendor/${vendorId}/staff`);
      setStaff(data?.staff || []);
    } catch (err) {
      console.error('Error loading staff:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-gray-500">{staff.length} team members</p>
        <button className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition">
          + Add Staff
        </button>
      </div>
      
      {staff.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <div className="text-5xl mb-4">👥</div>
          <h3 className="font-semibold text-gray-900">No staff members</h3>
          <p className="text-gray-500">Add team members to assign services</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {staff.map((member) => (
            <div key={member.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-xl">
                👤
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">{member.name}</h4>
                <p className="text-sm text-gray-500">{member.role}</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs ${member.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {member.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BookingsSection({ vendorId }: { vendorId: string }) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadBookings();
  }, [vendorId, filter]);

  const loadBookings = async () => {
    try {
      const data = await apiClient.get<any>(`/vendor/${vendorId}/bookings?status=${filter}`);
      setBookings(data?.bookings || []);
    } catch (err) {
      console.error('Error loading bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto">
        {['all', 'pending', 'confirmed', 'in_progress', 'completed'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-full whitespace-nowrap transition ${
              filter === status
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {status.replace('_', ' ').charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
          </button>
        ))}
      </div>

      {bookings.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <div className="text-5xl mb-4">📅</div>
          <h3 className="font-semibold text-gray-900">No bookings found</h3>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <BookingCard key={booking.id} booking={booking} />
          ))}
        </div>
      )}
    </div>
  );
}

function EarningsSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [earnings, setEarnings] = useState<any>(null);
  const [minPayoutRequestAmount, setMinPayoutRequestAmount] = useState(VENDOR_MIN_PAYOUT_REQUEST_RS);
  const [tierInfo, setTierInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [requestingPayout, setRequestingPayout] = useState(false);

  useEffect(() => {
    loadEarnings();
  }, [vendorId]);

  const loadEarnings = async () => {
    try {
      const [dayRes, monthRes, totalRes, tierRes, settlementsRes] = await Promise.all([
        apiClient.get<any>(`/vendor/${vendorId}/earnings?period=day`).catch(() => ({})),
        apiClient.get<any>(`/vendor/${vendorId}/earnings?period=month`).catch(() => ({})),
        apiClient.get<any>(`/vendor/${vendorId}/earnings?period=lifetime`).catch(() => ({})),
        apiClient.get<any>(`/vendor/${vendorId}/tier`).catch(() => null),
        apiClient.get<any>(`/vendor/${vendorId}/settlements?limit=5`).catch(() => null),
      ]);
      const e = (r: any) => r?.earnings;
      const sum = settlementsRes?.summary;
      setMinPayoutRequestAmount(
        Number(sum?.minPayoutRequestAmount ?? sum?.min_payout_request_amount) ||
          VENDOR_MIN_PAYOUT_REQUEST_RS,
      );
      const netPending =
        Number(
          sum?.availableForPayout ??
            sum?.available_for_payout ??
            sum?.pendingAmount ??
            sum?.pending_amount ??
            NaN
        );
      const fallbackPending = e(totalRes)?.pendingSettlement ?? 0;
      setEarnings({
        today: e(dayRes)?.thisPeriod ?? e(dayRes)?.totalEarnings ?? 0,
        thisWeek: 0,
        thisMonth: e(monthRes)?.thisPeriod ?? e(monthRes)?.totalEarnings ?? 0,
        total: e(totalRes)?.totalEarnings ?? 0,
        pending: Number.isFinite(netPending) ? netPending : fallbackPending,
        transactions: e(totalRes)?.transactions ?? []
      });
      
      if (tierRes?.tier) {
        setTierInfo(tierRes.tier);
      }
    } catch (err) {
      console.error('Error loading earnings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPayout = async () => {
    if (!earnings?.pending || earnings.pending <= 0) return;
    if (earnings.pending < minPayoutRequestAmount) {
      toast.error(VENDOR_MIN_PAYOUT_REQUEST_HELP_TEXT);
      return;
    }
    if (!confirm(`Request payout of ₹${earnings.pending.toLocaleString()}?`)) return;
    
    setRequestingPayout(true);
    try {
      const response = await apiClient.post<any>('/settlements/request', { vendorId, amount: earnings.pending });
      if (response?.success) {
        toast.success(
          response?.message ||
            'Payout request submitted. You will be notified when it is processed.'
        );
        loadEarnings();
      } else {
        toast.error(response?.error || 'Failed to request payout');
      }
    } catch (err) {
      console.error('Error requesting payout:', err);
      toast.error('Failed to request payout');
    } finally {
      setRequestingPayout(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Tier Info Banner */}
      {tierInfo && (
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Current Tier</p>
              <p className="text-xl font-bold">{tierInfo.name || tierInfo.current || 'Bronze'}</p>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-90">Commission Rate</p>
              <p className="text-xl font-bold">{((tierInfo.commissionRate || 0.15) * 100).toFixed(0)}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Earnings Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-green-50 rounded-xl p-4">
          <p className="text-sm text-green-600">Today</p>
          <p className="text-2xl font-bold text-green-700">₹{(earnings?.today || 0).toLocaleString()}</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-4">
          <p className="text-sm text-purple-600">This Month</p>
          <p className="text-2xl font-bold text-purple-700">₹{(earnings?.thisMonth || 0).toLocaleString()}</p>
        </div>
        <div className="bg-orange-50 rounded-xl p-4">
          <p className="text-sm text-orange-600">Total Earnings</p>
          <p className="text-2xl font-bold text-orange-700">₹{(earnings?.total || 0).toLocaleString()}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-sm text-blue-600">Pending Payout</p>
          <p className="text-2xl font-bold text-blue-700">₹{(earnings?.pending || 0).toLocaleString()}</p>
          <p className="text-xs text-amber-900/80 mt-1 leading-snug">{VENDOR_MIN_PAYOUT_REQUEST_HELP_TEXT}</p>
          {(earnings?.pending || 0) > 0 && (
            <button
              onClick={handleRequestPayout}
              disabled={
                requestingPayout || (earnings?.pending || 0) < minPayoutRequestAmount
              }
              className="mt-2 text-blue-600 text-sm font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {requestingPayout ? 'Requesting...' : 'Request Payout →'}
            </button>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-gray-50 rounded-xl p-4">
        <h3 className="font-semibold text-gray-900 mb-4">Recent Transactions</h3>
        {earnings?.transactions?.length > 0 ? (
          <div className="space-y-3">
            {earnings.transactions.slice(0, 5).map((txn: any) => (
              <div key={txn.id} className="flex items-center justify-between py-3 border-b last:border-0">
                <div>
                  <p className="font-medium text-gray-900">{txn.description || txn.serviceName || 'Transaction'}</p>
                  <p className="text-sm text-gray-500">{new Date(txn.date || txn.created_at).toLocaleDateString()}</p>
                </div>
                <p className={`font-semibold ${txn.type === 'credit' || txn.type === 'booking' ? 'text-green-600' : 'text-red-600'}`}>
                  {txn.type === 'credit' || txn.type === 'booking' ? '+' : '-'}₹{(txn.amount || 0).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No transactions yet</p>
        )}
      </div>

      {/* View Full Dashboard Button */}
      <button 
        onClick={() => router.push('/earnings')}
        className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition"
      >
        View Full Earnings Dashboard
      </button>
    </div>
  );
}

function ScheduleSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [stats, setStats] = useState<{ totalSlots: number; daysConfigured: number }>({ totalSlots: 0, daysConfigured: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadScheduleStats();
  }, [vendorId]);

  const loadScheduleStats = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/schedule`).catch(() => ({ schedule: {}, totalSlots: 0 }));
      const schedule = response.schedule || {};
      
      // Count days with configured slots
      const daysConfigured = Object.keys(schedule).filter((day) => {
        const slots = schedule[parseInt(day)];
        return slots && Array.isArray(slots) && slots.length > 0;
      }).length;

      setStats({
        totalSlots: response.totalSlots || 0,
        daysConfigured,
      });
    } catch (err) {
      console.error('Error loading schedule stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{stats.totalSlots}</p>
          <p className="text-sm text-gray-500">Time slots configured</p>
          {stats.daysConfigured > 0 && (
            <p className="text-sm text-gray-400 mt-1">{stats.daysConfigured} day{stats.daysConfigured !== 1 ? 's' : ''} active</p>
          )}
        </div>
      </div>
      <button 
        onClick={() => router.push('/schedule')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        Manage Schedule
      </button>
    </div>
  );
}

function ProfileSection({ vendor }: { vendor: Vendor | null }) {
  const router = useRouter();
  
  if (!vendor) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-24 h-24 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl flex items-center justify-center text-4xl overflow-hidden">
          {vendor.logo_url ? (
            <img src={vendor.logo_url} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            '🏪'
          )}
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">{vendor.business_name}</h3>
          <p className="text-gray-500">{vendor.owner_name}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-yellow-500">⭐</span>
            <span className="font-medium">{vendor.rating || 0}</span>
            <span className="text-gray-400">({vendor.total_reviews || 0} reviews)</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-gray-50 rounded-xl">
          <p className="text-sm text-gray-500">Phone</p>
          <p className="font-medium text-gray-900">{vendor.phone}</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-xl">
          <p className="text-sm text-gray-500">Email</p>
          <p className="font-medium text-gray-900">{vendor.email}</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-xl">
          <p className="text-sm text-gray-500">Status</p>
          <p className="font-medium text-green-600 capitalize">{vendor.status}</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-xl">
          <p className="text-sm text-gray-500">Tier</p>
          <p className="font-medium text-orange-600">{vendor.tier || 'Standard'}</p>
        </div>
      </div>

      {/* ✅ Navigate to the enhanced profile page */}
      <button 
        onClick={() => router.push('/profile')}
        className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition"
      >
        Edit Profile
      </button>
    </div>
  );
}

// ============================================================================
// NEW SECTIONS FOR CAPABILITIES WITH FULL PAGES
// ============================================================================

function PrescriptionsSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPrescriptionsCount();
  }, [vendorId]);

  const loadPrescriptionsCount = async () => {
    try {
      const bookingsRes = await apiClient.get<any>(`/vendor/${vendorId}/bookings`).catch(() => ({ bookings: [] }));
      const bookings = bookingsRes.bookings || [];
      
      let totalCount = 0;
      const prescriptionPromises = bookings.slice(0, 10).map((booking: any) =>
        apiClient.get<any>(`/prescriptions/booking/${booking.id}`).catch(() => ({ success: false, prescriptions: [] }))
      );
      const results = await Promise.all(prescriptionPromises);
      results.forEach((result) => {
        if (result.success && result.prescriptions) {
          totalCount += result.prescriptions.length;
        }
      });
      setCount(totalCount);
    } catch (err) {
      console.error('Error loading prescriptions count:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{count}</p>
          <p className="text-sm text-gray-500">Total prescriptions</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/medical/prescriptions')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        View All Prescriptions
      </button>
    </div>
  );
}

function MedicalRecordsSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecordsCount();
  }, [vendorId]);

  const loadRecordsCount = async () => {
    try {
      const bookingsRes = await apiClient.get<any>(`/vendor/${vendorId}/bookings`).catch(() => ({ bookings: [] }));
      const bookings = bookingsRes.bookings || [];
      
      let totalCount = 0;
      const recordPromises = bookings.slice(0, 10).map((booking: any) =>
        apiClient.get<any>(`/bookings/${booking.id}/medical-records`).catch(() => ({ success: false, records: [] }))
      );
      const results = await Promise.all(recordPromises);
      results.forEach((result) => {
        if (result.success && result.records) {
          totalCount += result.records.length;
        }
      });
      setCount(totalCount);
    } catch (err) {
      console.error('Error loading medical records count:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{count}</p>
          <p className="text-sm text-gray-500">Total medical records</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/medical/records')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        View All Records
      </button>
    </div>
  );
}

function VaccinationSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVaccinationCount();
  }, [vendorId]);

  const loadVaccinationCount = async () => {
    try {
      const bookingsRes = await apiClient.get<any>(`/vendor/${vendorId}/bookings`).catch(() => ({ bookings: [] }));
      const bookings = bookingsRes.bookings || [];
      
      let totalCount = 0;
      const recordPromises = bookings.slice(0, 10).map((booking: any) =>
        apiClient.get<any>(`/bookings/${booking.id}/medical-records`).catch(() => ({ success: false, records: [] }))
      );
      const results = await Promise.all(recordPromises);
      results.forEach((result) => {
        if (result.success && result.records) {
          const vaccinationRecords = result.records.filter((record: any) => 
            record.record_type?.toLowerCase().includes('vaccination') ||
            record.record_type?.toLowerCase().includes('vaccine')
          );
          totalCount += vaccinationRecords.length;
        }
      });
      setCount(totalCount);
    } catch (err) {
      console.error('Error loading vaccination count:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{count}</p>
          <p className="text-sm text-gray-500">Total vaccination records</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/medical/vaccination')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        View All Vaccinations
      </button>
    </div>
  );
}

function PricingSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [servicesCount, setServicesCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadServicesCount();
  }, [vendorId]);

  const loadServicesCount = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/services`).catch(() => ({ services: [] }));
      const list = Array.isArray(response.services) ? response.services : (response.allServices || []);
      setServicesCount(list.length);
    } catch (err) {
      console.error('Error loading services count:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{servicesCount}</p>
          <p className="text-sm text-gray-500">Services configured</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/services/pricing')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        Manage Pricing
      </button>
    </div>
  );
}

function ReviewsSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [stats, setStats] = useState<{ total: number; avgRating: number }>({ total: 0, avgRating: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReviewsStats();
  }, [vendorId]);

  const loadReviewsStats = async () => {
    try {
      const response = await apiClient
        .get<any>(`/reviews/vendor/${encodeURIComponent(vendorId)}?limit=100`)
        .catch(() => ({ reviews: [], summary: { averageRating: 0 } }));
      setStats({
        total: response.reviews?.length || 0,
        avgRating: response.summary?.averageRating ?? response.averageRating ?? 0,
      });
    } catch (err) {
      console.error('Error loading reviews stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-sm text-gray-500">Total reviews</p>
          {stats.avgRating > 0 && (
            <p className="text-sm text-orange-600 mt-1">⭐ {stats.avgRating.toFixed(1)} average</p>
          )}
        </div>
      </div>
      <button 
        onClick={() => router.push('/operations/reviews')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        View All Reviews
      </button>
    </div>
  );
}

function AnalyticsSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-lg font-semibold text-gray-900">Business Analytics</p>
          <p className="text-sm text-gray-500">View performance metrics and insights</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/operations/analytics')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        View Analytics
      </button>
    </div>
  );
}

function ReportsSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-lg font-semibold text-gray-900">Business Reports</p>
          <p className="text-sm text-gray-500">Generate and download reports</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/operations/reports')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        View Reports
      </button>
    </div>
  );
}

// ============================================================================
// SPECIALIZED SECTIONS - FUNCTIONAL IMPLEMENTATIONS
// ============================================================================

function CafeTablesSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTablesCount();
  }, [vendorId]);

  const loadTablesCount = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/tables`).catch(() => ({ tables: [], count: 0 }));
      setCount(response.count || response.tables?.length || 0);
    } catch (err) {
      console.error('Error loading tables count:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{count}</p>
          <p className="text-sm text-gray-500">Cafe tables configured</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/cafe/tables')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        Manage Tables
      </button>
    </div>
  );
}

function RoomsSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRoomsCount();
  }, [vendorId]);

  const loadRoomsCount = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/rooms`).catch(() => ({ rooms: [], count: 0 }));
      setCount(response.count || response.rooms?.length || 0);
    } catch (err) {
      console.error('Error loading rooms count:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{count}</p>
          <p className="text-sm text-gray-500">Resort rooms configured</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/resort/rooms')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        Manage Rooms
      </button>
    </div>
  );
}

function InsurancePlansSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlansCount();
  }, [vendorId]);

  const loadPlansCount = async () => {
    try {
      // Note: Insurance plans might be global, but we can filter by vendor if needed
      const response = await apiClient.get<any>(`/insurance/plans?vendorId=${vendorId}`).catch(() => ({ plans: [], total: 0 }));
      setCount(response.total || response.plans?.length || 0);
    } catch (err) {
      console.error('Error loading insurance plans count:', err);
      // Try alternative endpoint
      try {
        const altResponse = await apiClient.get<any>(`/vendor/${vendorId}/insurance/plans`).catch(() => ({ plans: [] }));
        setCount(altResponse.plans?.length || 0);
      } catch (altErr) {
        console.error('Error loading insurance plans (alt):', altErr);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{count}</p>
          <p className="text-sm text-gray-500">Insurance plans available</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/insurance/plans')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        Manage Plans
      </button>
    </div>
  );
}

function AdoptionSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAdoptionCount();
  }, [vendorId]);

  const loadAdoptionCount = async () => {
    try {
      // Try adoption-specific endpoint
      const response = await apiClient.get<any>(`/vendor/${vendorId}/adoption/listings`).catch(() => null);
      if (response && (response.listings || response.count !== undefined)) {
        setCount(response.count || response.listings?.length || 0);
      } else {
        // Alternative: count pets with adoption status
        const petsRes = await apiClient.get<any>(`/vendor/${vendorId}/pets?status=adoption`).catch(() => ({ pets: [] }));
        setCount(petsRes.pets?.length || 0);
      }
    } catch (err) {
      console.error('Error loading adoption count:', err);
      // If no API exists yet, show 0 with link to services
      setCount(0);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{count}</p>
          <p className="text-sm text-gray-500">Adoption listings active</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/services')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        Manage Listings
      </button>
    </div>
  );
}

function MealPlansSection({ vendorId: _vendorId }: { vendorId: string }) {
  return (
    <div className="space-y-4">
      <MealPlansComingSoonPanel />
    </div>
  );
}

function WalkingSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWalkingCount();
  }, [vendorId]);

  const loadWalkingCount = async () => {
    try {
      // Walking sessions are typically tracked through bookings with walking service type
      const bookingsRes = await apiClient.get<any>(`/vendor/${vendorId}/bookings`).catch(() => ({ bookings: [] }));
      const walkingBookings = (bookingsRes.bookings || []).filter((b: any) => 
        b.service_category?.toLowerCase().includes('walking') ||
        b.service_name?.toLowerCase().includes('walking') ||
        b.service_type?.toLowerCase().includes('walking')
      );
      setCount(walkingBookings.length);
    } catch (err) {
      console.error('Error loading walking count:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{count}</p>
          <p className="text-sm text-gray-500">Walking sessions booked</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/bookings')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        View Bookings
      </button>
    </div>
  );
}

function AmbulanceSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAmbulanceCount();
  }, [vendorId]);

  const loadAmbulanceCount = async () => {
    try {
      // Try ambulance-specific endpoint
      const response = await apiClient.get<any>(`/vendor/${vendorId}/ambulance/dispatches`).catch(() => null);
      if (response && (response.dispatches || response.count !== undefined)) {
        setCount(response.count || response.dispatches?.length || 0);
      } else {
        // Alternative: count bookings with ambulance/emergency service type
        const bookingsRes = await apiClient.get<any>(`/vendor/${vendorId}/bookings`).catch(() => ({ bookings: [] }));
        const ambulanceBookings = (bookingsRes.bookings || []).filter((b: any) => 
          b.service_category?.toLowerCase().includes('ambulance') ||
          b.service_category?.toLowerCase().includes('emergency') ||
          b.service_name?.toLowerCase().includes('ambulance') ||
          b.service_type?.toLowerCase().includes('ambulance')
        );
        setCount(ambulanceBookings.length);
      }
    } catch (err) {
      console.error('Error loading ambulance count:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{count}</p>
          <p className="text-sm text-gray-500">Emergency dispatches</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/bookings')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        View Dispatches
      </button>
    </div>
  );
}

function DiagnosticsSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTestsCount();
  }, [vendorId]);

  const loadTestsCount = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/diagnostics/tests`).catch(() => ({ tests: [] }));
      setCount(response.tests?.length || 0);
    } catch (err) {
      console.error('Error loading tests count:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{count}</p>
          <p className="text-sm text-gray-500">Diagnostic tests available</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/services/tests')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        Manage Tests
      </button>
    </div>
  );
}

function HolidaysSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPackagesCount();
  }, [vendorId]);

  const loadPackagesCount = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/holiday-packages`).catch(() => ({ packages: [], count: 0 }));
      setCount(response.count || response.packages?.length || 0);
    } catch (err) {
      console.error('Error loading holiday packages count:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{count}</p>
          <p className="text-sm text-gray-500">Holiday packages created</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/packages')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        Manage Packages
      </button>
    </div>
  );
}

function ProductsSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProductsCount();
  }, [vendorId]);

  const loadProductsCount = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/products?limit=1`).catch(() => ({ products: [], total: 0 }));
      // Try to get total from response
      setCount(response.total || response.products?.length || 0);
      // If we got products but no total, we might need a separate count query
      if (response.products && response.products.length > 0 && !response.total) {
        const fullResponse = await apiClient.get<any>(`/vendor/${vendorId}/products?limit=1000`).catch(() => ({ products: [] }));
        setCount(fullResponse.products?.length || 0);
      }
    } catch (err) {
      console.error('Error loading products count:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{count}</p>
          <p className="text-sm text-gray-500">Products in catalog</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/products')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        Manage Products
      </button>
    </div>
  );
}

function TrainingSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrainingCount();
  }, [vendorId]);

  const loadTrainingCount = async () => {
    try {
      // Training might be tracked through bookings with training service type
      // Or through training_progress table
      const response = await apiClient.get<any>(`/vendor/${vendorId}/trainings`).catch(() => null);
      if (response && (response.trainings || response.count !== undefined)) {
        setCount(response.count || response.trainings?.length || 0);
      } else {
        // Alternative: count training-related bookings
        const bookingsRes = await apiClient.get<any>(`/vendor/${vendorId}/bookings`).catch(() => ({ bookings: [] }));
        const trainingBookings = (bookingsRes.bookings || []).filter((b: any) => 
          b.service_category?.toLowerCase().includes('training') ||
          b.service_name?.toLowerCase().includes('training')
        );
        setCount(trainingBookings.length);
      }
    } catch (err) {
      console.error('Error loading training count:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{count}</p>
          <p className="text-sm text-gray-500">Training programs active</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/services')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        Manage Training
      </button>
    </div>
  );
}

// ============================================================================
// PHASE 5: ADDITIONAL FUNCTIONAL SECTIONS (10 capabilities)
// ============================================================================

function ChatSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChatStats();
  }, [vendorId]);

  const loadChatStats = async () => {
    try {
      const bookingsRes = await apiClient.get<any>(`/vendor/${vendorId}/bookings?status=all`).catch(() => ({ bookings: [] }));
      const bookings = bookingsRes.bookings || [];
      let totalUnread = 0;
      const chatPromises = bookings.slice(0, 10).map((booking: any) =>
        apiClient.get<any>(`/chat/booking/${booking.id}/conversation`).catch(() => ({ messages: [] }))
      );
      const results = await Promise.all(chatPromises);
      results.forEach((result) => {
        if (result.messages) {
          const unread = result.messages.filter((msg: any) => !msg.is_read && msg.sender_type !== 'vendor');
          totalUnread += unread.length;
        }
      });
      setUnreadCount(totalUnread);
    } catch (err) {
      console.error('Error loading chat stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{unreadCount}</p>
          <p className="text-sm text-gray-500">Unread messages</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/communication/messages')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        View Messages
      </button>
    </div>
  );
}

function VideoCallSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [upcomingCount, setUpcomingCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVideoCallStats();
  }, [vendorId]);

  const loadVideoCallStats = async () => {
    try {
      const bookingsRes = await apiClient.get<any>(`/vendor/${vendorId}/bookings?status=confirmed`).catch(() => ({ bookings: [] }));
      const upcomingBookings = (bookingsRes.bookings || []).filter((b: any) => {
        const bookingDate = new Date(b.booking_date + ' ' + b.booking_time);
        const now = new Date();
        return bookingDate > now && (b.service_style === 'tele_consultation' || b.service_type?.toLowerCase().includes('video'));
      });
      setUpcomingCount(upcomingBookings.length);
    } catch (err) {
      console.error('Error loading video call stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{upcomingCount}</p>
          <p className="text-sm text-gray-500">Upcoming video calls</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/communication/video')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        View Calls
      </button>
    </div>
  );
}

function NotificationsSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotificationsStats();
  }, [vendorId]);

  const loadNotificationsStats = async () => {
    try {
      const response = await apiClient.get<any>(`/notifications?userId=${vendorId}&userType=vendor&limit=1`).catch(() => ({ unreadCount: 0 }));
      setUnreadCount(response.unreadCount || 0);
    } catch (err) {
      console.error('Error loading notifications stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{unreadCount}</p>
          <p className="text-sm text-gray-500">Unread notifications</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/communication/notifications')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        View Notifications
      </button>
    </div>
  );
}

function SettlementsSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [settlements, setSettlements] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [bankVerified, setBankVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettlementsData();
  }, [vendorId]);

  const loadSettlementsData = async () => {
    try {
      const [settlementsRes, summaryRes, bankRes] = await Promise.all([
        apiClient.get<any>(`/vendor/${vendorId}/settlements?limit=5`).catch(() => ({ settlements: [] })),
        apiClient.get<any>(`/vendor/${vendorId}/settlements?summary=true`).catch(() => ({ summary: {} })),
        apiClient.get<any>(`/vendor/${vendorId}/bank-details`).catch(() => null)
      ]);
      
      setSettlements(settlementsRes.settlements || []);
      setSummary(summaryRes.summary || {});
      
      if (bankRes?.bankDetails) {
        setBankVerified(bankRes.bankDetails.bank_verified || bankRes.bankDetails.is_verified || false);
      }
    } catch (err) {
      console.error('Error loading settlements data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'processing': return 'bg-blue-100 text-blue-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'failed': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      {/* Bank Verification Warning */}
      {!bankVerified && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800 font-medium">⚠️ Bank account not verified</p>
          <p className="text-xs text-amber-700 mt-1">Add and verify your bank account to receive settlements.</p>
          <button
            onClick={() => router.push('/finance/bank')}
            className="mt-2 text-amber-700 text-sm font-medium hover:underline"
          >
            Add Bank Account →
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-green-50 rounded-lg p-3">
          <p className="text-xs text-green-600">Total Settled</p>
          <p className="text-lg font-bold text-green-700">₹{(summary?.total_settled || 0).toLocaleString()}</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-3">
          <p className="text-xs text-yellow-600">Pending</p>
          <p className="text-lg font-bold text-yellow-700">₹{(summary?.pending_amount || 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Recent Settlements */}
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-2">Recent Settlements</h4>
        {settlements.length > 0 ? (
          <div className="space-y-2">
            {settlements.slice(0, 3).map((settlement: any) => (
              <div key={settlement.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium text-gray-900 text-sm">₹{(settlement.net_amount || settlement.amount || 0).toLocaleString()}</p>
                  <p className="text-xs text-gray-500">
                    {settlement.period_start ? new Date(settlement.period_start).toLocaleDateString() : 'Processing'}
                  </p>
                </div>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(settlement.status)}`}>
                  {settlement.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-3 text-sm">No settlements yet</p>
        )}
      </div>

      {/* View Full Dashboard Button */}
      <button 
        onClick={() => router.push('/settlements')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        View Full Settlements Dashboard
      </button>
    </div>
  );
}

function BankAccountSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<{ verified: boolean; accountNumber?: string }>({ verified: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBankAccountStatus();
  }, [vendorId]);

  const loadBankAccountStatus = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/bank-details`).catch(() => ({ bankDetails: null }));
      const bankDetails = response.bankDetails || response;
      if (bankDetails) {
        setStatus({
          verified: bankDetails.verification_status === 'verified' || bankDetails.is_verified === true,
          accountNumber: bankDetails.account_number ? `****${bankDetails.account_number.slice(-4)}` : undefined,
        });
      }
    } catch (err) {
      console.error('Error loading bank account status:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className={`text-lg font-semibold ${status.verified ? 'text-green-600' : 'text-orange-600'}`}>
            {status.verified ? '✓ Verified' : 'Not Verified'}
          </p>
          {status.accountNumber && <p className="text-sm text-gray-500 mt-1">Account: {status.accountNumber}</p>}
        </div>
      </div>
      <button 
        onClick={() => router.push('/finance/bank')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        Manage Bank Account
      </button>
    </div>
  );
}

function OrdersSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [stats, setStats] = useState<{ pending: number; total: number }>({ pending: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrdersStats();
  }, [vendorId]);

  const loadOrdersStats = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/orders/stats`).catch(() => ({ stats: { pending: 0, total: 0 } }));
      const statsData = response.stats || {};
      setStats({ pending: statsData.pending || 0, total: statsData.total || 0 });
    } catch (err) {
      console.error('Error loading orders stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
          <p className="text-sm text-gray-500">Pending orders</p>
          {stats.total > 0 && <p className="text-sm text-gray-400 mt-1">{stats.total} total orders</p>}
        </div>
      </div>
      <button 
        onClick={() => router.push('/pharmacy/orders')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        View Orders
      </button>
    </div>
  );
}

function PackagesSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPackagesCount();
  }, [vendorId]);

  const loadPackagesCount = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/packages`).catch(() => null);
      if (response && (response.packages || response.count !== undefined)) {
        setCount(response.count || response.packages?.length || 0);
      } else {
        const servicesRes = await apiClient.get<any>(`/vendor/${vendorId}/services`).catch(() => ({ services: [] }));
        const list = Array.isArray(servicesRes.services) ? servicesRes.services : (servicesRes.allServices || []);
        const packageServices = list.filter((s: any) =>
          s.is_package === true || s.service_type?.toLowerCase().includes('package')
        );
        setCount(packageServices.length);
      }
    } catch (err) {
      console.error('Error loading packages count:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{count}</p>
          <p className="text-sm text-gray-500">Service packages</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/services/packages')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        Manage Packages
      </button>
    </div>
  );
}

function SubscriptionsSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubscriptionsCount();
  }, [vendorId]);

  const loadSubscriptionsCount = async () => {
    try {
      const response = await apiClient.get<any>(`/subscriptions/plans/vendor/${vendorId}`).catch(() => ({ plans: [] }));
      setCount(response.plans?.length || response.total || 0);
    } catch (err) {
      console.error('Error loading subscriptions count:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{count}</p>
          <p className="text-sm text-gray-500">Active subscription plans</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/services/subscriptions')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        Manage Subscriptions
      </button>
    </div>
  );
}

function InventorySection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [stats, setStats] = useState<{ total: number; lowStock: number }>({ total: 0, lowStock: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInventoryStats();
  }, [vendorId]);

  const loadInventoryStats = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/products`).catch(() => ({ products: [] }));
      const products = response.products || [];
      const lowStock = products.filter((p: any) => 
        p.stock_quantity !== undefined && p.stock_quantity < (p.min_stock || 10)
      ).length;
      setStats({ total: products.length, lowStock });
    } catch (err) {
      console.error('Error loading inventory stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-sm text-gray-500">Products in inventory</p>
          {stats.lowStock > 0 && <p className="text-sm text-orange-600 mt-1">⚠️ {stats.lowStock} low stock</p>}
        </div>
      </div>
      <button 
        onClick={() => router.push('/pharmacy/inventory')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        Manage Inventory
      </button>
    </div>
  );
}

function GPSTrackingSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [activeCount, setActiveCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGPSTrackingStats();
  }, [vendorId]);

  const loadGPSTrackingStats = async () => {
    try {
      const bookingsRes = await apiClient.get<any>(`/vendor/${vendorId}/bookings?status=in_progress`).catch(() => ({ bookings: [] }));
      const activeBookings = (bookingsRes.bookings || []).filter((b: any) => 
        b.service_style === 'home_services' || b.service_style === 'at_home'
      );
      setActiveCount(activeBookings.length);
    } catch (err) {
      console.error('Error loading GPS tracking stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
          <p className="text-sm text-gray-500">Active tracking sessions</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/schedule/gps')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        View Tracking
      </button>
    </div>
  );
}

// ============================================================================
// PHASE 6: COMPLETE REMAINING DEFAULT SECTIONS (21 capabilities)
// ============================================================================

// Service Styles (Booking Routes) - 8 capabilities
function CentreBookingSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookingCount();
  }, [vendorId]);

  const loadBookingCount = async () => {
    try {
      const bookingsRes = await apiClient.get<any>(`/vendor/${vendorId}/bookings?status=all`).catch(() => ({ bookings: [] }));
      const bookings = bookingsRes.bookings || [];
      const filteredBookings = bookings.filter((b: any) => 
        b.service_style === 'centre_booking' || b.service_style === 'centre' || b.service_type === 'centre' || b.booking_type === 'centre'
      );
      setCount(filteredBookings.length);
    } catch (err) {
      console.error('Error loading centre bookings count:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{count}</p>
          <p className="text-sm text-gray-500">Centre bookings</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/bookings/centre')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        View Centre Bookings
      </button>
    </div>
  );
}

function HomeServicesSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [count, setCount] = useState<number>(0);
  const [todayCount, setTodayCount] = useState<number>(0);
  const [radius, setRadius] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [vendorId]);

  const loadData = async () => {
    try {
      // Load bookings
      const bookingsRes = await apiClient.get<any>(`/vendor/${vendorId}/bookings?status=all`).catch(() => ({ bookings: [] }));
      const bookings = bookingsRes.bookings || [];
      const filteredBookings = bookings.filter((b: any) => 
        b.service_style === 'home_services' || b.service_style === 'home' || b.service_style === 'at_home' || b.service_type === 'home'
      );
      setCount(filteredBookings.length);
      
      // Count today's bookings
      const today = new Date().toISOString().split('T')[0];
      const todayBookings = filteredBookings.filter((b: any) => 
        (b.booking_date || b.scheduledDate || '').startsWith(today)
      );
      setTodayCount(todayBookings.length);
      
      // Load home service settings
      const settingsRes = await apiClient.get<any>(`/vendor/${vendorId}/home-service-settings`).catch(() => ({ settings: null }));
      if (settingsRes.settings) {
        setRadius(settingsRes.settings.serviceRadius);
        setIsOnline(settingsRes.settings.isOnline);
      }
    } catch (err) {
      console.error('Error loading home services data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      {/* Online Status */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          <span className={`text-sm font-medium ${isOnline ? 'text-green-700' : 'text-gray-600'}`}>
            {isOnline ? 'Online - Receiving Bookings' : 'Offline'}
          </span>
        </div>
        {radius && (
          <span className="text-xs text-gray-500">{radius} km radius</span>
        )}
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <p className="text-2xl font-bold text-green-700">{todayCount}</p>
          <p className="text-xs text-green-600">Today's Visits</p>
        </div>
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <p className="text-2xl font-bold text-blue-700">{count}</p>
          <p className="text-xs text-blue-600">Total Bookings</p>
        </div>
      </div>
      
      {/* Actions */}
      <div className="space-y-2">
        <button 
          onClick={() => router.push('/bookings/home')}
          className="w-full py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition"
        >
          View Home Bookings
        </button>
        <button 
          onClick={() => router.push('/schedule/radius')}
          className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition"
        >
          ⚙️ Configure Location & Radius
        </button>
      </div>
    </div>
  );
}

function TeleConsultationSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookingCount();
  }, [vendorId]);

  const loadBookingCount = async () => {
    try {
      const bookingsRes = await apiClient.get<any>(`/vendor/${vendorId}/bookings?status=all`).catch(() => ({ bookings: [] }));
      const bookings = bookingsRes.bookings || [];
      const filteredBookings = bookings.filter((b: any) => 
        b.service_style === 'tele_consultation' || b.service_style === 'tele' || b.service_style === 'video' || b.service_type === 'tele'
      );
      setCount(filteredBookings.length);
    } catch (err) {
      console.error('Error loading tele consultation count:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{count}</p>
          <p className="text-sm text-gray-500">Tele consultations</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/bookings/tele')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        View Tele Consultations
      </button>
    </div>
  );
}

function ReservationsSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookingCount();
  }, [vendorId]);

  const loadBookingCount = async () => {
    try {
      const bookingsRes = await apiClient.get<any>(`/vendor/${vendorId}/bookings?status=all`).catch(() => ({ bookings: [] }));
      const bookings = bookingsRes.bookings || [];
      const filteredBookings = bookings.filter((b: any) => 
        b.service_style === 'reservations' || b.service_type?.toLowerCase().includes('reservation') || b.service?.category?.toLowerCase().includes('cafe')
      );
      setCount(filteredBookings.length);
    } catch (err) {
      console.error('Error loading reservations count:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{count}</p>
          <p className="text-sm text-gray-500">Table reservations</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/bookings/reservations')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        View Reservations
      </button>
    </div>
  );
}

function CheckinCheckoutSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookingCount();
  }, [vendorId]);

  const loadBookingCount = async () => {
    try {
      const bookingsRes = await apiClient.get<any>(`/vendor/${vendorId}/bookings?status=all`).catch(() => ({ bookings: [] }));
      const bookings = bookingsRes.bookings || [];
      const filteredBookings = bookings.filter((b: any) => 
        b.service_style === 'checkin_checkout' || b.service_style === 'checkin' || b.service?.category?.toLowerCase().includes('resort') || b.service?.category?.toLowerCase().includes('boarding')
      );
      setCount(filteredBookings.length);
    } catch (err) {
      console.error('Error loading checkin/checkout count:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{count}</p>
          <p className="text-sm text-gray-500">Check-in/Check-out bookings</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/bookings/checkin')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        View Check-ins
      </button>
    </div>
  );
}

function RouteTrackingSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [activeCount, setActiveCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRouteTrackingStats();
  }, [vendorId]);

  const loadRouteTrackingStats = async () => {
    try {
      const bookingsRes = await apiClient.get<any>(`/vendor/${vendorId}/bookings?status=in_progress`).catch(() => ({ bookings: [] }));
      const activeBookings = (bookingsRes.bookings || []).filter((b: any) => 
        b.service_style === 'home_services' || b.service_style === 'walking'
      );
      setActiveCount(activeBookings.length);
    } catch (err) {
      console.error('Error loading route tracking stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
          <p className="text-sm text-gray-500">Active route tracking</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/bookings/routes')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        View Routes
      </button>
    </div>
  );
}

function ServiceRadiusSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [radius, setRadius] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadServiceRadius();
  }, [vendorId]);

  const loadServiceRadius = async () => {
    try {
      const vendorRes = await apiClient.get<any>(`/vendor/${vendorId}/profile`).catch(() => ({ vendor: null }));
      const vendor = vendorRes.vendor || vendorRes;
      setRadius(vendor?.service_radius || vendor?.coverage_radius || null);
    } catch (err) {
      console.error('Error loading service radius:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{radius ? `${radius} km` : 'Not Set'}</p>
          <p className="text-sm text-gray-500">Service coverage radius</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/schedule/radius')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        Configure Radius
      </button>
    </div>
  );
}

function TourScheduleSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [upcomingCount, setUpcomingCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTourScheduleStats();
  }, [vendorId]);

  const loadTourScheduleStats = async () => {
    try {
      const packagesRes = await apiClient.get<any>(`/vendor/${vendorId}/holiday-packages`).catch(() => ({ packages: [] }));
      const packages = packagesRes.packages || packagesRes.holidayPackages || [];
      const today = new Date();
      const upcoming = packages.filter((pkg: any) => {
        if (!pkg.start_date) return false;
        const startDate = new Date(pkg.start_date);
        return startDate >= today;
      });
      setUpcomingCount(upcoming.length);
    } catch (err) {
      console.error('Error loading tour schedule stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{upcomingCount}</p>
          <p className="text-sm text-gray-500">Upcoming tours</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/holidays/schedule')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        View Tour Schedule
      </button>
    </div>
  );
}

// Specialized Services - 9 capabilities
function MenuSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMenuCount();
  }, [vendorId]);

  const loadMenuCount = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/cafe/menu`).catch(() => null);
      if (response && (response.menu || response.items || response.count !== undefined)) {
        setCount(response.count || response.items?.length || response.menu?.length || 0);
      } else {
        const servicesRes = await apiClient.get<any>(`/vendor/${vendorId}/services`).catch(() => ({ services: [] }));
        const list = Array.isArray(servicesRes.services) ? servicesRes.services : (servicesRes.allServices || []);
        const menuServices = list.filter((s: any) =>
          s.category?.toLowerCase().includes('cafe') || s.service_category?.toLowerCase().includes('menu')
        );
        setCount(menuServices.length);
      }
    } catch (err) {
      console.error('Error loading menu count:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{count}</p>
          <p className="text-sm text-gray-500">Menu items</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/services/menu')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        Manage Menu
      </button>
    </div>
  );
}

function VehiclesSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVehiclesCount();
  }, [vendorId]);

  const loadVehiclesCount = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/ambulance/vehicles`).catch(() => ({ vehicles: [] }));
      setCount(response.vehicles?.length || response.count || 0);
    } catch (err) {
      console.error('Error loading vehicles count:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{count}</p>
          <p className="text-sm text-gray-500">Ambulance vehicles</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/ambulance/vehicles')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        Manage Vehicles
      </button>
    </div>
  );
}

function BoardingSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBoardingCount();
  }, [vendorId]);

  const loadBoardingCount = async () => {
    try {
      const bookingsRes = await apiClient.get<any>(`/vendor/${vendorId}/bookings?status=all`).catch(() => ({ bookings: [] }));
      const bookings = bookingsRes.bookings || [];
      const boardingBookings = bookings.filter((b: any) => 
        b.service?.category?.toLowerCase().includes('boarding') || b.service_type?.toLowerCase().includes('boarding')
      );
      setCount(boardingBookings.length);
    } catch (err) {
      console.error('Error loading boarding count:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{count}</p>
          <p className="text-sm text-gray-500">Boarding bookings</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/resort/boarding')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        Manage Boarding
      </button>
    </div>
  );
}

function PoliciesSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPoliciesCount();
  }, [vendorId]);

  const loadPoliciesCount = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/insurance/policies`).catch(() => ({ policies: [] }));
      setCount(response.policies?.length || response.count || 0);
    } catch (err) {
      console.error('Error loading policies count:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{count}</p>
          <p className="text-sm text-gray-500">Active insurance policies</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/insurance/policies')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        Manage Policies
      </button>
    </div>
  );
}

function ClaimsSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [stats, setStats] = useState<{ pending: number; total: number }>({ pending: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClaimsStats();
  }, [vendorId]);

  const loadClaimsStats = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/insurance/claims`).catch(() => ({ claims: [] }));
      const claims = response.claims || [];
      const pending = claims.filter((c: any) => c.status === 'pending' || c.status === 'processing').length;
      setStats({ pending, total: claims.length });
    } catch (err) {
      console.error('Error loading claims stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
          <p className="text-sm text-gray-500">Pending claims</p>
          {stats.total > 0 && <p className="text-sm text-gray-400 mt-1">{stats.total} total</p>}
        </div>
      </div>
      <button 
        onClick={() => router.push('/insurance/claims')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        Manage Claims
      </button>
    </div>
  );
}

function PetProfilesSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPetProfilesCount();
  }, [vendorId]);

  const loadPetProfilesCount = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/adoption/pets`).catch(() => ({ pets: [] }));
      setCount(response.pets?.length || response.count || 0);
    } catch (err) {
      console.error('Error loading pet profiles count:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{count}</p>
          <p className="text-sm text-gray-500">Pet profiles</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/adoption/pets')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        Manage Pet Profiles
      </button>
    </div>
  );
}

function LineageSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLineageCount();
  }, [vendorId]);

  const loadLineageCount = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/adoption/lineage`).catch(() => ({ lineage: [] }));
      setCount(response.lineage?.length || response.count || 0);
    } catch (err) {
      console.error('Error loading lineage count:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{count}</p>
          <p className="text-sm text-gray-500">Lineage records</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/adoption/lineage')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        Manage Lineage
      </button>
    </div>
  );
}

function ProgressTrackingSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [activeCount, setActiveCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProgressTrackingStats();
  }, [vendorId]);

  const loadProgressTrackingStats = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/training/progress`).catch(() => ({ progress: [] }));
      const progress = response.progress || response.trainingProgress || [];
      const active = progress.filter((p: any) => p.status === 'active' || p.status === 'in_progress');
      setActiveCount(active.length);
    } catch (err) {
      console.error('Error loading progress tracking stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
          <p className="text-sm text-gray-500">Active training sessions</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/training/progress')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        View Progress
      </button>
    </div>
  );
}

function FoodDeliverySection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [activeCount, setActiveCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFoodDeliveryStats();
  }, [vendorId]);

  const loadFoodDeliveryStats = async () => {
    try {
      const ordersRes = await apiClient.get<any>(`/vendor/${vendorId}/orders?status=processing`).catch(() => ({ orders: [] }));
      const orders = ordersRes.orders || [];
      const deliveryOrders = orders.filter((o: any) => 
        o.order_type?.toLowerCase().includes('delivery') || o.service_category?.toLowerCase().includes('nutrition')
      );
      setActiveCount(deliveryOrders.length);
    } catch (err) {
      console.error('Error loading food delivery stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
          <p className="text-sm text-gray-500">Active delivery orders</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/nutrition/delivery')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        View Deliveries
      </button>
    </div>
  );
}

// E-commerce - 1 capability
function SellerHubSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [stats, setStats] = useState<{ products: number; orders: number }>({ products: 0, orders: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSellerHubStats();
  }, [vendorId]);

  const loadSellerHubStats = async () => {
    try {
      const [productsRes, ordersRes] = await Promise.all([
        apiClient.get<any>(`/vendor/${vendorId}/products`).catch(() => ({ products: [] })),
        apiClient.get<any>(`/vendor/${vendorId}/orders/stats`).catch(() => ({ stats: { total: 0 } })),
      ]);
      setStats({
        products: productsRes.products?.length || 0,
        orders: ordersRes.stats?.total || 0,
      });
    } catch (err) {
      console.error('Error loading seller hub stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{stats.products}</p>
          <p className="text-sm text-gray-500">Products listed</p>
          {stats.orders > 0 && <p className="text-sm text-gray-400 mt-1">{stats.orders} orders</p>}
        </div>
      </div>
      <button 
        onClick={() => router.push('/seller')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        Open Seller Hub
      </button>
    </div>
  );
}

// Operations - 1 capability
function SettingsSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-lg font-semibold text-gray-900">Settings</p>
          <p className="text-sm text-gray-500">Configure app settings</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/settings')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        Open Settings
      </button>
    </div>
  );
}

// Test Catalog (already has full page, enhance dashboard section)
function TestCatalogSection({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTestCatalogCount();
  }, [vendorId]);

  const loadTestCatalogCount = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/services/tests`).catch(() => ({ tests: [] }));
      setCount(response.tests?.length || response.count || 0);
    } catch (err) {
      console.error('Error loading test catalog count:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{count}</p>
          <p className="text-sm text-gray-500">Diagnostic tests</p>
        </div>
      </div>
      <button 
        onClick={() => router.push('/services/tests')}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        Manage Test Catalog
      </button>
    </div>
  );
}

// ============================================================================
// DEFAULT CAPABILITY SECTION - Standard Design Pattern
// ============================================================================

function DefaultCapabilitySection({ capability, vendorId }: { capability: Capability; vendorId: string }) {
  const router = useRouter();
  const route = capability.route || '/';

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-lg font-semibold text-gray-900">{capability.display_name}</p>
          <p className="text-sm text-gray-500">{capability.description}</p>
        </div>
      </div>
      <button 
        onClick={() => router.push(route)}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
      >
        {capability.category === 'communication' ? 'Open' : capability.category === 'finance' ? 'View Details' : 'Get Started'}
      </button>
    </div>
  );
}

