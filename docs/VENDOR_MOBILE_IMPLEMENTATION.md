# 📱 Vendor Mobile App Implementation Guide

## Core Component: UnifiedVendorDashboard

This is the main entry point that replaces role-specific dashboards.

```tsx
// components/vendor/UnifiedVendorDashboard.tsx

'use client';

import { useMemo } from 'react';
import { useVendorCapabilities } from './hooks/useVendorCapabilities';

interface Props {
  vendorId: string;
  vendorData: VendorData;
}

export function UnifiedVendorDashboard({ vendorId, vendorData }: Props) {
  const { capabilities, roleId, roleName, loading } = useVendorCapabilities(vendorData);
  
  // Derive UI elements from capabilities
  const dashboardConfig = useMemo(() => ({
    stats: getStatsForCapabilities(capabilities),
    quickActions: getQuickActionsForCapabilities(capabilities),
    bottomNav: getBottomNavForCapabilities(capabilities),
    theme: getRoleTheme(roleId),
  }), [capabilities, roleId]);

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="min-h-screen bg-gray-50" style={{ maxWidth: 430 }}>
      {/* Dynamic Header */}
      <VendorHeader 
        businessName={vendorData.businessName}
        roleName={roleName}
        theme={dashboardConfig.theme}
        hasNotifications={capabilities.notifications}
      />
      
      {/* Online/Offline Toggle */}
      {capabilities.schedule && (
        <AvailabilityToggle vendorId={vendorId} />
      )}
      
      {/* Stats Cards */}
      <StatsGrid stats={dashboardConfig.stats} />
      
      {/* Quick Actions */}
      <QuickActionsBar 
        actions={dashboardConfig.quickActions}
        vendorId={vendorId}
      />
      
      {/* Today's Schedule */}
      {capabilities.bookings && (
        <TodaySchedule vendorId={vendorId} />
      )}
      
      {/* Service-Specific Widgets */}
      {capabilities.gps_tracking && <LiveTrackingWidget vendorId={vendorId} />}
      {capabilities.inventory && <LowStockAlert vendorId={vendorId} />}
      {capabilities.prescriptions && <PendingPrescriptions vendorId={vendorId} />}
      
      {/* Bottom Navigation */}
      <BottomNavigation tabs={dashboardConfig.bottomNav} />
    </div>
  );
}
```

---

## Stats Configuration

```tsx
// lib/dashboard-config.ts

interface StatConfig {
  id: string;
  label: string;
  icon: string;
  apiEndpoint: string;
  format: 'number' | 'currency' | 'percentage';
}

const STAT_DEFINITIONS: Record<string, StatConfig> = {
  bookings: {
    id: 'upcoming_bookings',
    label: 'Upcoming',
    icon: 'calendar',
    apiEndpoint: '/bookings/count?status=upcoming',
    format: 'number',
  },
  earnings: {
    id: 'today_earnings',
    label: "Today's Revenue",
    icon: 'indian-rupee',
    apiEndpoint: '/earnings/today',
    format: 'currency',
  },
  gps_tracking: {
    id: 'active_sessions',
    label: 'Active',
    icon: 'map-pin',
    apiEndpoint: '/tracking/active-count',
    format: 'number',
  },
  inventory: {
    id: 'low_stock',
    label: 'Low Stock',
    icon: 'alert-triangle',
    apiEndpoint: '/inventory/low-stock-count',
    format: 'number',
  },
  prescriptions: {
    id: 'pending_rx',
    label: 'Pending Rx',
    icon: 'pill',
    apiEndpoint: '/prescriptions/pending-count',
    format: 'number',
  },
  staff_management: {
    id: 'staff_online',
    label: 'Staff Online',
    icon: 'users',
    apiEndpoint: '/staff/online-count',
    format: 'number',
  },
};

export function getStatsForCapabilities(capabilities: Record<string, boolean>): StatConfig[] {
  const stats: StatConfig[] = [];
  
  // Priority order for stats
  const priority = ['bookings', 'earnings', 'gps_tracking', 'prescriptions', 'inventory', 'staff_management'];
  
  for (const capId of priority) {
    if (capabilities[capId] && STAT_DEFINITIONS[capId]) {
      stats.push(STAT_DEFINITIONS[capId]);
      if (stats.length >= 4) break; // Max 4 stats on mobile
    }
  }
  
  return stats;
}
```

---

## Quick Actions Configuration

```tsx
// lib/quick-actions-config.ts

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  route: string;
  requiresCapability: string;
}

const QUICK_ACTION_DEFINITIONS: QuickAction[] = [
  // Healthcare
  { id: 'new_rx', label: 'New Rx', icon: 'pill', route: '/prescription/new', requiresCapability: 'prescriptions' },
  { id: 'medical_records', label: 'Records', icon: 'file-text', route: '/medical-records', requiresCapability: 'medical_records' },
  
  // Operations
  { id: 'start_tracking', label: 'Track', icon: 'map-pin', route: '/tracking/start', requiresCapability: 'gps_tracking' },
  { id: 'photo_update', label: 'Photos', icon: 'camera', route: '/photos/upload', requiresCapability: 'photo_updates' },
  
  // Services
  { id: 'packages', label: 'Packages', icon: 'package', route: '/packages', requiresCapability: 'package_management' },
  { id: 'custom_service', label: 'Custom', icon: 'plus', route: '/services/custom', requiresCapability: 'custom_services' },
  
  // Center Management
  { id: 'staff', label: 'Staff', icon: 'users', route: '/staff', requiresCapability: 'staff_management' },
  { id: 'center_profile', label: 'Center', icon: 'building-2', route: '/center', requiresCapability: 'facility_management' },
  
  // Specialized
  { id: 'meal_plans', label: 'Meals', icon: 'utensils', route: '/meal-plans', requiresCapability: 'meal_plans' },
  { id: 'training', label: 'Programs', icon: 'graduation-cap', route: '/training', requiresCapability: 'training_programs' },
  { id: 'cctv', label: 'CCTV', icon: 'video', route: '/cctv', requiresCapability: 'cctv_access' },
  { id: 'adoption', label: 'Adoption', icon: 'heart', route: '/adoption', requiresCapability: 'adoption' },
];

export function getQuickActionsForCapabilities(capabilities: Record<string, boolean>): QuickAction[] {
  return QUICK_ACTION_DEFINITIONS
    .filter(action => capabilities[action.requiresCapability])
    .slice(0, 4); // Max 4 on mobile
}
```

---

## Bottom Navigation Configuration

```tsx
// lib/navigation-config.ts

interface NavTab {
  id: string;
  label: string;
  icon: string;
  route: string;
  requiresCapability?: string; // Optional - some tabs are always shown
}

const CORE_TABS: NavTab[] = [
  { id: 'home', label: 'Home', icon: 'home', route: '/' },
  { id: 'bookings', label: 'Bookings', icon: 'calendar', route: '/bookings', requiresCapability: 'bookings' },
];

const OPTIONAL_TABS: NavTab[] = [
  { id: 'services', label: 'Services', icon: 'briefcase', route: '/services', requiresCapability: 'services' },
  { id: 'chat', label: 'Chat', icon: 'message-circle', route: '/chat', requiresCapability: 'chat' },
  { id: 'earnings', label: 'Earnings', icon: 'indian-rupee', route: '/earnings', requiresCapability: 'earnings' },
];

const SETTINGS_TAB: NavTab = { id: 'settings', label: 'Settings', icon: 'settings', route: '/settings' };

export function getBottomNavForCapabilities(capabilities: Record<string, boolean>): NavTab[] {
  const tabs: NavTab[] = [...CORE_TABS];
  
  // Add optional tabs based on capabilities
  for (const tab of OPTIONAL_TABS) {
    if (!tab.requiresCapability || capabilities[tab.requiresCapability]) {
      tabs.push(tab);
    }
    if (tabs.length >= 4) break; // Reserve 1 slot for settings
  }
  
  tabs.push(SETTINGS_TAB);
  
  // If too many, replace last optional with "More"
  if (tabs.length > 5) {
    const moreTab: NavTab = { id: 'more', label: 'More', icon: 'more-horizontal', route: '/more' };
    return [...tabs.slice(0, 4), moreTab];
  }
  
  return tabs;
}
```

---

## Generic Labels System

```tsx
// lib/labels.ts

// Platform-wide generic labels (no hardcoded role-specific terms)
export const LABELS = {
  // Entities
  PROVIDER: 'Provider',
  CLIENT: 'Client',
  CENTER: 'Center',
  BUSINESS: 'Business',
  
  // Actions
  BOOKING: 'Booking',
  SESSION: 'Session',
  SERVICE: 'Service',
  
  // Time
  UPCOMING: 'Upcoming',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  
  // Status
  ONLINE: 'Online',
  OFFLINE: 'Offline',
  BUSY: 'Busy',
  
  // Service Styles
  AT_HOME: 'Home Visit',
  AT_CENTER: 'At Center',
  TELE: 'Video Session',
  
  // Actions
  ACCEPT: 'Accept',
  DECLINE: 'Decline',
  RESCHEDULE: 'Reschedule',
  START: 'Start',
  COMPLETE: 'Complete',
} as const;

// Dynamic label generation based on context
export function getServiceLabel(serviceStyle: string): string {
  switch (serviceStyle) {
    case 'at_home': return LABELS.AT_HOME;
    case 'at_center': return LABELS.AT_CENTER;
    case 'tele': return LABELS.TELE;
    default: return 'Service';
  }
}

export function getBookingActionLabel(status: string): string {
  switch (status) {
    case 'pending': return LABELS.ACCEPT;
    case 'confirmed': return LABELS.START;
    case 'in_progress': return LABELS.COMPLETE;
    default: return 'View';
  }
}
```

---

## Role Theme Configuration

```tsx
// lib/role-themes.ts

interface RoleTheme {
  accentColor: string;
  accentBg: string;
  icon: string;
  gradient: string;
}

// Themes based on role categories, not hardcoded role names
const ROLE_CATEGORY_THEMES: Record<string, RoleTheme> = {
  healthcare: {
    accentColor: '#EF4444',
    accentBg: '#FEE2E2',
    icon: '🩺',
    gradient: 'from-red-500 to-red-600',
  },
  grooming: {
    accentColor: '#8B5CF6',
    accentBg: '#EDE9FE',
    icon: '✂️',
    gradient: 'from-violet-500 to-violet-600',
  },
  training: {
    accentColor: '#10B981',
    accentBg: '#D1FAE5',
    icon: '🎓',
    gradient: 'from-emerald-500 to-emerald-600',
  },
  hospitality: {
    accentColor: '#F59E0B',
    accentBg: '#FEF3C7',
    icon: '🏨',
    gradient: 'from-amber-500 to-amber-600',
  },
  transport: {
    accentColor: '#3B82F6',
    accentBg: '#DBEAFE',
    icon: '🚗',
    gradient: 'from-blue-500 to-blue-600',
  },
  retail: {
    accentColor: '#14B8A6',
    accentBg: '#CCFBF1',
    icon: '🛍️',
    gradient: 'from-teal-500 to-teal-600',
  },
  specialist: {
    accentColor: '#EC4899',
    accentBg: '#FCE7F3',
    icon: '⭐',
    gradient: 'from-pink-500 to-pink-600',
  },
};

// Map role IDs to categories
const ROLE_TO_CATEGORY: Record<string, string> = {
  veterinarian: 'healthcare',
  veterinary_clinic: 'healthcare',
  pet_pharmacy: 'healthcare',
  nutritionist: 'healthcare',
  
  pet_groomer: 'grooming',
  groomers: 'grooming',
  
  pet_trainer: 'training',
  pet_behaviorist: 'training',
  
  pet_boarding: 'hospitality',
  pet_resort: 'hospitality',
  pet_cafe: 'hospitality',
  pet_sitter: 'hospitality',
  
  pet_walker: 'transport',
  pet_taxi: 'transport',
  pet_ambulance: 'transport',
  pet_relocation: 'transport',
  
  pet_products_store: 'retail',
  pet_breeder: 'retail',
  
  pet_photographer: 'specialist',
  pet_event_organizer: 'specialist',
  pet_shelter: 'specialist',
  pet_sunset_services: 'specialist',
  insurance: 'specialist',
};

export function getRoleTheme(roleId?: string): RoleTheme {
  if (!roleId) {
    return ROLE_CATEGORY_THEMES.specialist; // Default
  }
  
  const category = ROLE_TO_CATEGORY[roleId] || 'specialist';
  return ROLE_CATEGORY_THEMES[category];
}
```

---

## Service Catalog Browser (Generic)

```tsx
// components/vendor/ServiceCatalogBrowser.tsx

interface Props {
  vendorId: string;
  roleId: string;
  allowedServiceStyles: ('at_home' | 'at_center' | 'tele')[];
  onSelectServices: (services: Service[]) => void;
}

export function ServiceCatalogBrowser({ 
  vendorId, 
  roleId, 
  allowedServiceStyles,
  onSelectServices 
}: Props) {
  const [catalog, setCatalog] = useState<Category[]>([]);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Load catalog filtered by role and service styles
    fetchServiceCatalog(roleId, allowedServiceStyles);
  }, [roleId, allowedServiceStyles]);

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200"
          />
        </div>
      </div>

      {/* Service Style Filter Chips */}
      <div className="px-4 py-2 flex gap-2 overflow-x-auto">
        {allowedServiceStyles.map(style => (
          <Chip 
            key={style}
            label={LABELS[style.toUpperCase() as keyof typeof LABELS]}
            icon={getServiceStyleIcon(style)}
          />
        ))}
      </div>

      {/* Category Accordion */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {catalog.map(category => (
          <CategorySection
            key={category.id}
            category={category}
            selectedServices={selectedServices}
            onToggleService={(serviceId) => {
              setSelectedServices(prev => {
                const next = new Set(prev);
                if (next.has(serviceId)) {
                  next.delete(serviceId);
                } else {
                  next.add(serviceId);
                }
                return next;
              });
            }}
          />
        ))}
      </div>

      {/* Create Custom / Package Options */}
      <div className="p-4 border-t bg-white space-y-2">
        <Button 
          variant="outline" 
          className="w-full"
          onClick={() => navigateTo('/services/custom')}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Custom Service
        </Button>
        
        <Button 
          variant="outline"
          className="w-full"
          onClick={() => navigateTo('/packages/create')}
        >
          <Package className="w-4 h-4 mr-2" />
          Create Package Bundle
        </Button>
      </div>

      {/* Selection Summary */}
      {selectedServices.size > 0 && (
        <div className="p-4 bg-orange-50 border-t border-orange-200">
          <Button 
            className="w-full bg-orange-500 hover:bg-orange-600"
            onClick={() => onSelectServices(Array.from(selectedServices))}
          >
            Add {selectedServices.size} Services
          </Button>
        </div>
      )}
    </div>
  );
}
```

---

## Booking Card (Generic)

```tsx
// components/vendor/BookingCard.tsx

interface BookingCardProps {
  booking: Booking;
  onAction: (action: string) => void;
}

export function BookingCard({ booking, onAction }: BookingCardProps) {
  const theme = getRoleTheme(booking.roleId);
  
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: theme.accentBg }}
          >
            <span className="text-lg">{theme.icon}</span>
          </div>
          <div>
            <p className="font-semibold text-gray-900">{booking.clientName}</p>
            <p className="text-sm text-gray-500">{booking.petName} • {booking.petType}</p>
          </div>
        </div>
        
        {/* Service Style Badge */}
        <ServiceStyleBadge style={booking.serviceStyle} />
      </div>
      
      {/* Service Info */}
      <div className="bg-gray-50 rounded-xl p-3 mb-3">
        <p className="font-medium text-gray-900">{booking.serviceName}</p>
        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {formatTime(booking.startTime)}
          </span>
          <span className="flex items-center gap-1">
            <Timer className="w-4 h-4" />
            {booking.duration} mins
          </span>
        </div>
      </div>
      
      {/* Action Buttons (Generic labels) */}
      <div className="flex gap-2">
        {booking.status === 'pending' && (
          <>
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => onAction('decline')}
            >
              {LABELS.DECLINE}
            </Button>
            <Button 
              className="flex-1 bg-orange-500 hover:bg-orange-600"
              onClick={() => onAction('accept')}
            >
              {LABELS.ACCEPT}
            </Button>
          </>
        )}
        
        {booking.status === 'confirmed' && (
          <Button 
            className="flex-1 bg-green-500 hover:bg-green-600"
            onClick={() => onAction('start')}
          >
            {LABELS.START} Session
          </Button>
        )}
        
        {booking.status === 'in_progress' && (
          <Button 
            className="flex-1 bg-blue-500 hover:bg-blue-600"
            onClick={() => onAction('complete')}
          >
            {LABELS.COMPLETE}
          </Button>
        )}
      </div>
    </div>
  );
}
```

---

## Service Style Badge Component

```tsx
// components/ui/ServiceStyleBadge.tsx

const STYLE_CONFIG = {
  at_home: { 
    icon: '🏠', 
    label: 'Home', 
    bg: 'bg-blue-100', 
    text: 'text-blue-700' 
  },
  at_center: { 
    icon: '🏥', 
    label: 'Center', 
    bg: 'bg-green-100', 
    text: 'text-green-700' 
  },
  tele: { 
    icon: '📹', 
    label: 'Video', 
    bg: 'bg-purple-100', 
    text: 'text-purple-700' 
  },
};

export function ServiceStyleBadge({ style }: { style: string }) {
  const config = STYLE_CONFIG[style as keyof typeof STYLE_CONFIG] || STYLE_CONFIG.at_center;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}
```

---

## Summary

This implementation guide provides:

1. **Unified Dashboard** - One component for all vendor types
2. **Capability-Driven UI** - Features shown based on database capabilities
3. **Generic Labels** - No hardcoded role-specific terminology
4. **Service Catalog Integration** - Browse and select from platform catalog
5. **Theme System** - Role-based colors without hardcoding
6. **Mobile-First Design** - Optimized for 430px mobile screens

The key principle: **The database is the source of truth**. The mobile app simply renders what the database says.
