'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

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
// ============================================================================

const ALL_CAPABILITIES: Capability[] = [
  // Core Operations
  { id: 'dashboard', name: 'dashboard', display_name: 'Dashboard', icon: '📊', description: 'View overview and stats', category: 'core', route: '/' },
  { id: 'bookings', name: 'bookings', display_name: 'Bookings', icon: '📅', description: 'Manage appointments', category: 'core', route: '/bookings' },
  { id: 'services', name: 'services', display_name: 'Services', icon: '📋', description: 'Manage your services', category: 'services', route: '/services' },
  { id: 'staff', name: 'staff', display_name: 'Staff', icon: '👥', description: 'Manage team members', category: 'operations', route: '/staff' },
  { id: 'schedule', name: 'schedule', display_name: 'Schedule', icon: '🗓️', description: 'Manage availability', category: 'operations', route: '/schedule' },
  { id: 'profile', name: 'profile', display_name: 'Profile', icon: '👤', description: 'Update your profile', category: 'core', route: '/profile' },
  
  // Finance & Payments
  { id: 'earnings', name: 'earnings', display_name: 'Earnings', icon: '💰', description: 'View earnings', category: 'finance', route: '/earnings' },
  { id: 'settlements', name: 'settlements', display_name: 'Settlements', icon: '💳', description: 'View payouts', category: 'finance', route: '/settlements' },
  { id: 'bank_account', name: 'bank_account', display_name: 'Bank Account', icon: '🏦', description: 'Manage bank details', category: 'finance', route: '/bank' },
  { id: 'pricing', name: 'pricing', display_name: 'Pricing', icon: '💵', description: 'Manage service pricing', category: 'finance', route: '/pricing' },
  
  // Communication
  { id: 'chat', name: 'chat', display_name: 'Messages', icon: '💬', description: 'Customer messages', category: 'communication', route: '/messages' },
  { id: 'notifications', name: 'notifications', display_name: 'Notifications', icon: '🔔', description: 'View alerts', category: 'communication', route: '/notifications' },
  { id: 'video_call', name: 'video_call', display_name: 'Video Calls', icon: '📹', description: 'Tele consultations', category: 'communication', route: '/video' },
  
  // Service Styles
  { id: 'centre_booking', name: 'centre_booking', display_name: 'Centre Booking', icon: '🏥', description: 'In-centre appointments', category: 'services', route: '/centre-bookings' },
  { id: 'home_services', name: 'home_services', display_name: 'Home Services', icon: '🏠', description: 'At-home visits', category: 'services', route: '/home-services' },
  { id: 'tele_consultation', name: 'tele_consultation', display_name: 'Tele Consultation', icon: '📞', description: 'Online consultations', category: 'services', route: '/tele-consultations' },
  
  // Medical & Prescriptions (Vet specific)
  { id: 'prescriptions', name: 'prescriptions', display_name: 'Prescriptions', icon: '📜', description: 'Issue prescriptions', category: 'specialized', route: '/prescriptions' },
  { id: 'medical_records', name: 'medical_records', display_name: 'Medical Records', icon: '📁', description: 'Patient records', category: 'specialized', route: '/medical-records' },
  { id: 'vaccination', name: 'vaccination', display_name: 'Vaccination', icon: '💉', description: 'Vaccination records', category: 'specialized', route: '/vaccination' },
  
  // Diagnostics
  { id: 'diagnostics', name: 'diagnostics', display_name: 'Diagnostics', icon: '🔬', description: 'Lab tests & results', category: 'specialized', route: '/diagnostics' },
  { id: 'test_catalog', name: 'test_catalog', display_name: 'Test Catalog', icon: '🧪', description: 'Available tests', category: 'specialized', route: '/test-catalog' },
  
  // Pharmacy
  { id: 'pharmacy', name: 'pharmacy', display_name: 'Pharmacy', icon: '💊', description: 'Medicine inventory', category: 'specialized', route: '/pharmacy' },
  { id: 'inventory', name: 'inventory', display_name: 'Inventory', icon: '📦', description: 'Stock management', category: 'specialized', route: '/inventory' },
  
  // Ambulance
  { id: 'ambulance', name: 'ambulance', display_name: 'Ambulance', icon: '🚑', description: 'Emergency dispatch', category: 'specialized', route: '/ambulance' },
  { id: 'vehicles', name: 'vehicles', display_name: 'Vehicles', icon: '🚐', description: 'Fleet management', category: 'specialized', route: '/vehicles' },
  
  // Pet Cafe
  { id: 'cafe_tables', name: 'cafe_tables', display_name: 'Tables', icon: '🪑', description: 'Table management', category: 'specialized', route: '/tables' },
  { id: 'menu', name: 'menu', display_name: 'Menu', icon: '🍽️', description: 'Food & drinks menu', category: 'specialized', route: '/menu' },
  { id: 'reservations', name: 'reservations', display_name: 'Reservations', icon: '📝', description: 'Table reservations', category: 'specialized', route: '/reservations' },
  
  // Resort & Boarding
  { id: 'rooms', name: 'rooms', display_name: 'Rooms', icon: '🛏️', description: 'Room management', category: 'specialized', route: '/rooms' },
  { id: 'boarding', name: 'boarding', display_name: 'Boarding', icon: '🏨', description: 'Pet boarding', category: 'specialized', route: '/boarding' },
  { id: 'checkin_checkout', name: 'checkin_checkout', display_name: 'Check-in/Out', icon: '✅', description: 'Guest management', category: 'specialized', route: '/checkin' },
  
  // Insurance
  { id: 'insurance_plans', name: 'insurance_plans', display_name: 'Insurance Plans', icon: '📋', description: 'Plan management', category: 'specialized', route: '/insurance-plans' },
  { id: 'policies', name: 'policies', display_name: 'Policies', icon: '📄', description: 'Active policies', category: 'specialized', route: '/policies' },
  { id: 'claims', name: 'claims', display_name: 'Claims', icon: '🎫', description: 'Process claims', category: 'specialized', route: '/claims' },
  
  // Adoption & Breeding
  { id: 'adoption', name: 'adoption', display_name: 'Adoption', icon: '🏠', description: 'Pet adoption listings', category: 'specialized', route: '/adoption' },
  { id: 'pet_profiles', name: 'pet_profiles', display_name: 'Pet Profiles', icon: '🐾', description: 'Manage pet listings', category: 'specialized', route: '/pet-profiles' },
  { id: 'lineage', name: 'lineage', display_name: 'Lineage', icon: '🌳', description: 'Pedigree records', category: 'specialized', route: '/lineage' },
  
  // Training & Behaviour
  { id: 'training_programs', name: 'training_programs', display_name: 'Training Programs', icon: '🎓', description: 'Training packages', category: 'specialized', route: '/training' },
  { id: 'progress_tracking', name: 'progress_tracking', display_name: 'Progress Tracking', icon: '📈', description: 'Training progress', category: 'specialized', route: '/progress' },
  { id: 'packages', name: 'packages', display_name: 'Packages', icon: '📦', description: 'Session packages', category: 'services', route: '/packages' },
  
  // Nutrition & Food
  { id: 'meal_plans', name: 'meal_plans', display_name: 'Meal Plans', icon: '🍲', description: 'Diet plans', category: 'specialized', route: '/meal-plans' },
  { id: 'food_delivery', name: 'food_delivery', display_name: 'Food Delivery', icon: '🚚', description: 'Delivery orders', category: 'specialized', route: '/food-delivery' },
  { id: 'subscriptions', name: 'subscriptions', display_name: 'Subscriptions', icon: '🔄', description: 'Meal subscriptions', category: 'specialized', route: '/subscriptions' },
  
  // Walker
  { id: 'walking', name: 'walking', display_name: 'Walking Sessions', icon: '🚶', description: 'Walk bookings', category: 'specialized', route: '/walking' },
  { id: 'route_tracking', name: 'route_tracking', display_name: 'Route Tracking', icon: '🗺️', description: 'GPS routes', category: 'specialized', route: '/routes' },
  
  // Holidays
  { id: 'holiday_packages', name: 'holiday_packages', display_name: 'Holiday Packages', icon: '✈️', description: 'Tour packages', category: 'specialized', route: '/holidays' },
  { id: 'tour_schedule', name: 'tour_schedule', display_name: 'Tour Schedule', icon: '📆', description: 'Upcoming tours', category: 'specialized', route: '/tours' },
  
  // Operations
  { id: 'reviews', name: 'reviews', display_name: 'Reviews', icon: '⭐', description: 'Customer feedback', category: 'operations', route: '/reviews' },
  { id: 'analytics', name: 'analytics', display_name: 'Analytics', icon: '📊', description: 'Business insights', category: 'operations', route: '/analytics' },
  { id: 'reports', name: 'reports', display_name: 'Reports', icon: '📑', description: 'Generate reports', category: 'operations', route: '/reports' },
  { id: 'settings', name: 'settings', display_name: 'Settings', icon: '⚙️', description: 'App settings', category: 'operations', route: '/settings' },
  
  // GPS & Tracking
  { id: 'gps_tracking', name: 'gps_tracking', display_name: 'GPS Tracking', icon: '📍', description: 'Live location', category: 'operations', route: '/gps' },
  { id: 'service_radius', name: 'service_radius', display_name: 'Service Radius', icon: '🎯', description: 'Coverage area', category: 'operations', route: '/radius' },
  
  // E-commerce / Seller Hub
  { id: 'products', name: 'products', display_name: 'Products', icon: '🛍️', description: 'Product catalog', category: 'specialized', route: '/products' },
  { id: 'orders', name: 'orders', display_name: 'Orders', icon: '📦', description: 'Order management', category: 'specialized', route: '/orders' },
  { id: 'seller_hub', name: 'seller_hub', display_name: 'Seller Hub', icon: '🏪', description: 'E-commerce management', category: 'specialized', route: '/seller' },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function VendorCapabilityDashboard({ vendorId }: { vendorId: string }) {
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

  // Filter capabilities based on vendor's role
  const enabledCapabilities = ALL_CAPABILITIES.filter(cap => 
    capabilities.includes(cap.name) || 
    cap.category === 'core' // Core capabilities always shown
  );

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
        <div className="text-center p-6 bg-white rounded-2xl shadow-lg max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button onClick={loadDashboardData} className="px-6 py-2 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition">
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
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl">
                🐾
              </div>
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
          <nav className="bg-white rounded-2xl shadow-sm p-4 sticky top-24 space-y-2">
            {Object.entries(groupedCapabilities).map(([category, caps]) => (
              <div key={category} className="mb-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">
                  {categoryLabels[category]}
                </h3>
                {caps.map((cap) => (
                  <button
                    key={cap.id}
                    onClick={() => setActiveSection(cap.name)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition ${
                      activeSection === cap.name
                        ? 'bg-orange-500 text-white'
                        : 'text-gray-700 hover:bg-orange-50'
                    }`}
                  >
                    <span className="text-xl">{cap.icon}</span>
                    <span className="text-sm font-medium">{cap.display_name}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>
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
                    <p className="text-3xl font-bold mt-1">₹{stats.pendingSettlement.toLocaleString()}</p>
                    <p className="text-green-100 text-sm mt-1">Expected within 7 days</p>
                  </div>
                  <button className="px-6 py-3 bg-white text-green-600 rounded-xl font-semibold hover:bg-green-50 transition">
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
                    <p className="text-gray-500 mt-1">Enjoy your day off!</p>
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
                  {enabledCapabilities.slice(0, 8).map((cap) => (
                    <button
                      key={cap.id}
                      onClick={() => setActiveSection(cap.name)}
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

          {/* Dynamic Section Content */}
          {activeSection !== 'dashboard' && (
            <CapabilitySection 
              capability={enabledCapabilities.find(c => c.name === activeSection)} 
              vendorId={vendorId}
              vendor={vendor}
            />
          )}
        </main>
      </div>

      {/* Bottom Navigation for Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg lg:hidden">
        <div className="flex justify-around py-2">
          {['dashboard', 'bookings', 'services', 'earnings', 'profile'].map((section) => {
            const cap = ALL_CAPABILITIES.find(c => c.name === section);
            if (!cap) return null;
            return (
              <button
                key={section}
                onClick={() => setActiveSection(section)}
                className={`flex flex-col items-center py-2 px-4 ${
                  activeSection === section ? 'text-orange-500' : 'text-gray-500'
                }`}
              >
                <span className="text-2xl">{cap.icon}</span>
                <span className="text-xs mt-1">{cap.display_name}</span>
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
    <div className={`${colorClasses[color]} rounded-2xl p-5`}>
      <div className="text-3xl mb-2">{icon}</div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm opacity-80">{label}</p>
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
        <div className="flex items-center gap-3">
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
        {capability.name === 'cafe_tables' && <CafeTablesSection vendorId={vendorId} />}
        {capability.name === 'rooms' && <RoomsSection vendorId={vendorId} />}
        {capability.name === 'insurance_plans' && <InsurancePlansSection vendorId={vendorId} />}
        {capability.name === 'adoption' && <AdoptionSection vendorId={vendorId} />}
        {capability.name === 'meal_plans' && <MealPlansSection vendorId={vendorId} />}
        {capability.name === 'walking' && <WalkingSection vendorId={vendorId} />}
        {capability.name === 'ambulance' && <AmbulanceSection vendorId={vendorId} />}
        {capability.name === 'diagnostics' && <DiagnosticsSection vendorId={vendorId} />}
        {capability.name === 'holiday_packages' && <HolidaysSection vendorId={vendorId} />}
        {capability.name === 'products' && <ProductsSection vendorId={vendorId} />}
        {capability.name === 'training_programs' && <TrainingSection vendorId={vendorId} />}
        
        {/* Default placeholder for other capabilities */}
        {!['services', 'staff', 'bookings', 'earnings', 'schedule', 'profile', 'cafe_tables', 'rooms', 'insurance_plans', 'adoption', 'meal_plans', 'walking', 'ambulance', 'diagnostics', 'holiday_packages', 'products', 'training_programs'].includes(capability.name) && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">{capability.icon}</div>
            <h3 className="text-lg font-semibold text-gray-900">{capability.display_name}</h3>
            <p className="text-gray-500 mt-2">Coming soon...</p>
          </div>
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
      const response = await apiClient.get<any>(`/vendor/${vendorId}/services`);
      setServices(response.services || []);
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
        <div className="text-center py-12 bg-gray-50 rounded-xl">
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
      const response = await apiClient.get<any>(`/vendor/${vendorId}/staff`);
      setStaff(response.staff || []);
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
      const response = await apiClient.get<any>(`/vendor/${vendorId}/bookings?status=${filter}`);
      setBookings(response.bookings || []);
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
  const [earnings, setEarnings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEarnings();
  }, [vendorId]);

  const loadEarnings = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/earnings`);
      setEarnings(response);
    } catch (err) {
      console.error('Error loading earnings:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8"><span className="animate-spin">⏳</span> Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-green-50 rounded-xl p-4">
          <p className="text-sm text-green-600">Today</p>
          <p className="text-2xl font-bold text-green-700">₹{earnings?.today || 0}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-sm text-blue-600">This Week</p>
          <p className="text-2xl font-bold text-blue-700">₹{earnings?.week || 0}</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-4">
          <p className="text-sm text-purple-600">This Month</p>
          <p className="text-2xl font-bold text-purple-700">₹{earnings?.month || 0}</p>
        </div>
        <div className="bg-orange-50 rounded-xl p-4">
          <p className="text-sm text-orange-600">Total</p>
          <p className="text-2xl font-bold text-orange-700">₹{earnings?.total || 0}</p>
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Recent Transactions</h3>
        {earnings?.transactions?.length > 0 ? (
          <div className="space-y-3">
            {earnings.transactions.map((txn: any) => (
              <div key={txn.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium text-gray-900">{txn.description}</p>
                  <p className="text-sm text-gray-500">{txn.date}</p>
                </div>
                <p className={`font-semibold ${txn.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                  {txn.type === 'credit' ? '+' : '-'}₹{txn.amount}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No transactions yet</p>
        )}
      </div>
    </div>
  );
}

function ScheduleSection({ vendorId }: { vendorId: string }) {
  return (
    <div className="text-center py-12">
      <div className="text-5xl mb-4">🗓️</div>
      <h3 className="font-semibold text-gray-900">Schedule Management</h3>
      <p className="text-gray-500 mt-2">Configure your working hours and availability</p>
      <button className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition">
        Set Schedule
      </button>
    </div>
  );
}

function ProfileSection({ vendor }: { vendor: Vendor | null }) {
  if (!vendor) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6">
        <div className="w-24 h-24 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl flex items-center justify-center text-4xl">
          🏪
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
          <p className="font-medium text-green-600">{vendor.status}</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-xl">
          <p className="text-sm text-gray-500">Tier</p>
          <p className="font-medium text-orange-600">{vendor.tier || 'Standard'}</p>
        </div>
      </div>

      <button className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition">
        Edit Profile
      </button>
    </div>
  );
}

// Specialized Section Stubs (to be fully implemented)
function CafeTablesSection({ vendorId }: { vendorId: string }) {
  return <SpecializedPlaceholder icon="🪑" title="Table Management" description="Manage your cafe tables and seating capacity" />;
}

function RoomsSection({ vendorId }: { vendorId: string }) {
  return <SpecializedPlaceholder icon="🛏️" title="Room Management" description="Configure rooms, pricing, and availability" />;
}

function InsurancePlansSection({ vendorId }: { vendorId: string }) {
  return <SpecializedPlaceholder icon="📋" title="Insurance Plans" description="Manage insurance plans and policies" />;
}

function AdoptionSection({ vendorId }: { vendorId: string }) {
  return <SpecializedPlaceholder icon="🏠" title="Adoption Listings" description="Manage pet profiles for adoption" />;
}

function MealPlansSection({ vendorId }: { vendorId: string }) {
  return <SpecializedPlaceholder icon="🍲" title="Meal Plans" description="Create and manage diet plans" />;
}

function WalkingSection({ vendorId }: { vendorId: string }) {
  return <SpecializedPlaceholder icon="🚶" title="Walking Sessions" description="Manage pet walking bookings" />;
}

function AmbulanceSection({ vendorId }: { vendorId: string }) {
  return <SpecializedPlaceholder icon="🚑" title="Ambulance Dispatch" description="Emergency dispatch management" />;
}

function DiagnosticsSection({ vendorId }: { vendorId: string }) {
  return <SpecializedPlaceholder icon="🔬" title="Diagnostics" description="Manage lab tests and results" />;
}

function HolidaysSection({ vendorId }: { vendorId: string }) {
  return <SpecializedPlaceholder icon="✈️" title="Holiday Packages" description="Create and manage tour packages" />;
}

function ProductsSection({ vendorId }: { vendorId: string }) {
  return <SpecializedPlaceholder icon="🛍️" title="Products" description="Manage your product catalog" />;
}

function TrainingSection({ vendorId }: { vendorId: string }) {
  return <SpecializedPlaceholder icon="🎓" title="Training Programs" description="Manage training packages and progress" />;
}

function SpecializedPlaceholder({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="text-center py-12">
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="text-gray-500 mt-2">{description}</p>
      <button className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition">
        Get Started
      </button>
    </div>
  );
}

