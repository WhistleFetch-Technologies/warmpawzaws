'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowRight, ArrowLeft, LogOut, Search, ChevronDown, ChevronUp,
  Stethoscope, Building2, Pill, Ambulance, FlaskConical, Apple,
  Scissors, Sparkles,
  GraduationCap, Brain,
  Dog, Home, Hotel, TreePalm,
  ShoppingBag, Heart,
  Coffee, Palmtree, Camera, Calendar, Plane,
  Shield, HeartHandshake, Sunset, Car, Package
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface VendorRoleSelectionProps {
  onRoleSelect: (role: string) => void;
}

interface Role {
  id: string;
  name: string;
  display_name: string;
  description: string;
  icon: string;
  features: string[];
  vendorTypes: string[];
  serviceStyles: string[];
  selectedServiceStyles?: string[];
  customer_service?: string | null;
  vendorConfiguration?: 'solo' | 'business' | null;
  pricingControl: {
    canControlPrice: boolean;
    canControlDuration: boolean;
    priceRangeMin?: number | null;
    priceRangeMax?: number | null;
  };
  capabilities: string[];
  order: number;
  isActive: boolean;
  category?: string;
}

// Display category keys (must match backend config.category for role config)
const DISPLAY_CATEGORY_KEYS = ['healthcare', 'grooming', 'training', 'petcare', 'retail', 'lifestyle', 'specialty'] as const;

// Category definitions with icons and metadata – all vendor roles aligned to these categories
const ROLE_CATEGORIES = {
  healthcare: {
    name: 'Healthcare Services',
    icon: Stethoscope,
    color: 'blue',
    description: 'Medical care & health services for pets',
    roles: [
      'veterinarian', 'veterinary_clinic', 'vet_solo', 'pet_pharmacy', 'pet_ambulance', 'diagnostics', 'diagnostic_center',
      'nutritionist', 'pet_nutritionist', 'nutritionist_center',
    ],
  },
  grooming: {
    name: 'Grooming & Wellness',
    icon: Scissors,
    color: 'pink',
    description: 'Grooming, spa & wellness services',
    roles: ['pet_groomer', 'grooming_salon', 'grooming_solo', 'groomer_center', 'groomer_solo'],
  },
  training: {
    name: 'Training & Behavior',
    icon: GraduationCap,
    color: 'indigo',
    description: 'Training, behavior modification & education',
    roles: ['pet_trainer', 'training_solo', 'pet_behaviorist', 'behaviorist_solo', 'behaviorist_center', 'trainer_center', 'trainer_solo'],
  },
  petcare: {
    name: 'Pet Care Services',
    icon: Dog,
    color: 'green',
    description: 'Walking, sitting, boarding & daily care',
    roles: [
      'pet_walker', 'walker_solo', 'pet_sitter', 'sitter_solo', 'pet_sitter_saas', 'pet_sitter_solo',
      'pet_boarding', 'pet_resort', 'pet_boarding_daycare', 'pet_boarding_daycare_center',
    ],
  },
  retail: {
    name: 'Retail & Products',
    icon: ShoppingBag,
    color: 'purple',
    description: 'Pet products, food & supplies',
    roles: ['pet_products_store', 'product_seller', 'pet_product', 'pet_breeder', 'ecommerce_seller', 'e_commerce_seller'],
  },
  lifestyle: {
    name: 'Lifestyle & Experiences',
    icon: Coffee,
    color: 'orange',
    description: 'Cafes, travel, photography & events',
    roles: [
      'pet_cafe', 'cafes', 'pet_holiday', 'pet_holiday_planner', 'holiday', 'pet_photographer', 'photography',
      'event_organizer',
    ],
  },
  specialty: {
    name: 'Specialty Services',
    icon: Shield,
    color: 'teal',
    description: 'Insurance, transport, relocation & more',
    roles: [
      'insurance', 'pet_insurance', 'pet_shelter', 'pet_adoption_center', 'pet_taxi', 'pet_transport',
      'pet_relocation', 'relocation', 'pet_sunset_services', 'sunset',
    ],
  },
};

// Role-specific icons mapping
const ROLE_ICONS: Record<string, any> = {
  // Healthcare
  'veterinarian': Stethoscope,
  'veterinary_clinic': Building2,
  'vet_solo': Stethoscope,
  'pet_pharmacy': Pill,
  'pet_ambulance': Ambulance,
  'diagnostics': FlaskConical,
  'nutritionist': Apple,
  'pet_nutritionist': Apple,
  // Grooming
  'pet_groomer': Scissors,
  'grooming_salon': Sparkles,
  'grooming_solo': Scissors,
  // Training
  'pet_trainer': GraduationCap,
  'training_solo': GraduationCap,
  'trainer_solo': GraduationCap,
  'trainer_center': GraduationCap,
  'pet_behaviorist': Brain,
  'behaviorist_solo': Brain,
  'behaviorist_center': Brain,
  // Pet Care
  'pet_walker': Dog,
  'walker_solo': Dog,
  'pet_sitter': Home,
  'sitter_solo': Home,
  'pet_boarding': Hotel,
  'pet_resort': TreePalm,
  // Retail
  'pet_products_store': ShoppingBag,
  'product_seller': ShoppingBag,
  'pet_product': Package,
  'pet_breeder': Heart,
  // Lifestyle
  'pet_cafe': Coffee,
  'cafes': Coffee,
  'pet_holiday': Palmtree,
  'pet_holiday_planner': Plane,
  'holiday': Palmtree,
  'pet_photographer': Camera,
  'photography': Camera,
  'event_organizer': Calendar,
  // Specialty
  'insurance': Shield,
  'pet_insurance': Shield,
  'pet_shelter': HeartHandshake,
  'pet_sunset_services': Sunset,
  'sunset': Sunset,
  'pet_taxi': Car,
  'pet_transport': Car,
  'pet_relocation': Plane,
  'relocation': Plane,
  // Variants / alternate role names
  'diagnostic_center': FlaskConical,
  'groomer_center': Scissors,
  'groomer_solo': Scissors,
  'trainer_center': GraduationCap,
  'trainer_solo': GraduationCap,
  'nutritionist_center': Apple,
  'pet_adoption_center': HeartHandshake,
  'pet_boarding_daycare': Hotel,
  'pet_boarding_daycare_center': Hotel,
  'pet_sitter_solo': Home,
  'pet_sitter_saas': Home,
  'ecommerce_seller': ShoppingBag,
  'e_commerce_seller': ShoppingBag,
  // product_seller, pet_product, sunset already defined above
};

function getFallbackRoles(): Role[] {
  return [
    {
      id: 'veterinarian',
      name: 'Veterinarian',
      display_name: 'Veterinarian',
      description: 'Provide medical care and consultations for pets',
      icon: 'healthcare',
      features: ['Prescriptions', 'Consultations', 'Medical Records'],
      vendorTypes: ['healthcare_provider'],
      serviceStyles: ['at_clinic', 'video_consultation', 'home_visit'],
      pricingControl: { canControlPrice: true, canControlDuration: true },
      capabilities: ['prescriptions', 'medical_records', 'bookings'],
      order: 1,
      isActive: true
    },
    {
      id: 'pet_groomer',
      name: 'Pet Groomer',
      display_name: 'Pet Groomer',
      description: 'Professional grooming services for pets',
      icon: 'grooming',
      features: ['At Center', 'Home Service'],
      vendorTypes: ['service_provider'],
      serviceStyles: ['at_center', 'at_home'],
      pricingControl: { canControlPrice: true, canControlDuration: true },
      capabilities: ['bookings', 'gallery'],
      order: 2,
      isActive: true
    },
    {
      id: 'pet_products_store',
      name: 'Pet Store',
      display_name: 'Pet Store',
      description: 'Sell pet products and supplies',
      icon: 'retail',
      features: ['Inventory', 'Delivery', 'Pickup'],
      vendorTypes: ['seller'],
      serviceStyles: ['delivery', 'pickup'],
      pricingControl: { canControlPrice: true, canControlDuration: false },
      capabilities: ['catalog', 'inventory', 'orders'],
      order: 3,
      isActive: true
    },
    {
      id: 'behaviorist_solo',
      name: 'behaviorist_solo',
      display_name: 'Behaviorist (Solo)',
      description: 'Pet behavior modification and training services',
      icon: 'training',
      features: ['Programs', 'Progress', 'Home & Center', 'Online'],
      vendorTypes: ['service_provider'],
      serviceStyles: ['at_home', 'at_center', 'online'],
      pricingControl: { canControlPrice: true, canControlDuration: true },
      capabilities: ['bookings', 'progress_tracking', 'chat', 'staff', 'schedule', 'custom_services', 'packages'],
      order: 10,
      isActive: true
    },
    {
      id: 'behaviorist_center',
      name: 'behaviorist_center',
      display_name: 'Behaviorist Center',
      description: 'Behavior center with multiple behaviorists',
      icon: 'training',
      features: ['Programs', 'Progress', 'Home & Center', 'Online'],
      vendorTypes: ['service_provider'],
      serviceStyles: ['at_home', 'at_center', 'online'],
      pricingControl: { canControlPrice: true, canControlDuration: true },
      capabilities: ['bookings', 'progress_tracking', 'chat', 'staff', 'schedule', 'custom_services', 'packages'],
      order: 11,
      isActive: true
    }
  ];
}

// Service style labels and icons
const SERVICE_STYLE_CONFIG: Record<string, { label: string; icon: any; description: string }> = {
  'at_center': { label: 'At Center', icon: Building2, description: 'Service at your location' },
  'at_clinic': { label: 'Clinic Visit', icon: Building2, description: 'Pet visits your clinic' },
  'at_home': { label: 'Home Visit', icon: Home, description: 'You visit customer\'s home' },
  'home_visit': { label: 'Home Visit', icon: Home, description: 'You visit customer\'s home' },
  'tele': { label: 'Tele Consult', icon: Stethoscope, description: 'Remote consultation' },
  'video_consultation': { label: 'Video Call', icon: Camera, description: 'Video consultation' },
  'online': { label: 'Online', icon: Package, description: 'Online services' },
  'delivery': { label: 'Delivery', icon: Car, description: 'Home delivery available' },
  'pickup': { label: 'Pickup', icon: ShoppingBag, description: 'Store pickup' },
  'outdoor': { label: 'Outdoor', icon: TreePalm, description: 'Outdoor services' },
};

// Enhanced role descriptions with service info
const ROLE_ENHANCED_INFO: Record<string, { tagline: string; services: string[] }> = {
  'veterinarian': { tagline: 'Provide medical care & consultations', services: ['Clinic visits', 'Home visits', 'Video consultations', 'Prescriptions'] },
  'veterinary_clinic': { tagline: 'Full-service veterinary hospital', services: ['Emergency care', 'Surgery', 'Diagnostics', 'Multi-doctor team'] },
  'pet_pharmacy': { tagline: 'Pet medicines & healthcare products', services: ['Prescription fulfillment', 'OTC medicines', 'Home delivery'] },
  'pet_ambulance': { tagline: '24/7 emergency pet transport', services: ['Emergency pickup', 'Hospital transfers', 'GPS tracking'] },
  'diagnostics': { tagline: 'Lab tests & diagnostic services', services: ['Blood tests', 'X-rays', 'Home sample collection'] },
  'nutritionist': { tagline: 'Custom diet & nutrition plans', services: ['Diet consultation', 'Meal planning', 'Supplement advice'] },
  'pet_nutritionist': { tagline: 'Specialized pet nutrition expert', services: ['Diet charts', 'Weight management', 'Allergy diets'] },
  'pet_groomer': { tagline: 'Professional grooming services', services: ['Bath & brush', 'Haircuts', 'Nail trimming', 'Home service'] },
  'grooming_salon': { tagline: 'Full-service grooming salon', services: ['Spa treatments', 'Breed-specific cuts', 'Walk-in welcome'] },
  'pet_trainer': { tagline: 'Obedience & behavior training', services: ['Basic obedience', 'Puppy training', 'Group classes'] },
  'pet_behaviorist': { tagline: 'Behavior modification specialist', services: ['Aggression therapy', 'Anxiety treatment', 'Video sessions'] },
  'behaviorist_solo': { tagline: 'Behavior modification specialist', services: ['Aggression therapy', 'Anxiety treatment', 'Video sessions'] },
  'behaviorist_center': { tagline: 'Behavior center with multiple behaviorists', services: ['Aggression therapy', 'Anxiety treatment', 'Group programs'] },
  'pet_walker': { tagline: 'Daily walks & exercise', services: ['Solo walks', 'Group walks', 'GPS tracking', 'Photo updates'] },
  'pet_sitter': { tagline: 'In-home pet care & sitting', services: ['Day care', 'Overnight stays', 'Feeding & medication'] },
  'pet_boarding': { tagline: 'Safe boarding & daycare', services: ['Overnight boarding', 'Day care', 'CCTV monitoring'] },
  'pet_resort': { tagline: 'Luxury pet resort experience', services: ['Premium suites', 'Spa services', 'Play areas', 'Live updates'] },
  'pet_products_store': { tagline: 'Pet food, toys & supplies', services: ['Wide selection', 'Home delivery', 'Store pickup'] },
  'pet_breeder': { tagline: 'Certified pet breeding', services: ['Healthy puppies/kittens', 'Pedigree certification', 'Health guarantee'] },
  'pet_cafe': { tagline: 'Pet-friendly cafe experience', services: ['Table reservations', 'Pet menu', 'Events & meetups'] },
  'pet_holiday': { tagline: 'Pet-friendly travel & holidays', services: ['Travel packages', 'Pet-friendly stays', 'Adventure trips'] },
  'pet_holiday_planner': { tagline: 'Plan perfect pet vacations', services: ['Itinerary planning', 'Pet-friendly hotels', 'Transport arrangement'] },
  'pet_photographer': { tagline: 'Professional pet photography', services: ['Studio sessions', 'Outdoor shoots', 'Event coverage'] },
  'event_organizer': { tagline: 'Pet events & shows', services: ['Dog shows', 'Pet meetups', 'Birthday parties'] },
  'insurance': { tagline: 'Pet health insurance', services: ['Health coverage', 'Accident protection', 'Claims management'] },
  'pet_shelter': { tagline: 'Pet adoption & rescue', services: ['Adoption services', 'Fostering', 'Donations welcome'] },
  'pet_sunset_services': { tagline: 'Compassionate end-of-life care', services: ['Cremation', 'Memorial services', 'Grief support'] },
  'pet_taxi': { tagline: 'Safe pet transportation', services: ['Vet visits', 'Airport transfers', 'AC vehicles'] },
  'pet_relocation': { tagline: 'Pet relocation services', services: ['Domestic moves', 'International shipping', 'Documentation'] },
};

export function VendorRoleSelection({ onRoleSelect }: VendorRoleSelectionProps) {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    healthcare: true, // Start with healthcare expanded
  });

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      let data: any;
      try {
        data = await apiClient.get('/vendor/onboarding/roles') as any;
      } catch (_) {
        data = await apiClient.get('/config/roles') as any;
      }
      // Support both shapes: { roles } and { data: { roles } } (error fallback from backend)
      const rawRoles = (data?.data?.roles ?? data?.roles ?? []) as any[];
      const normalized = rawRoles.map((r: any) => ({
        ...r,
        id: r.id,
        name: r.name ?? r.display_name,
        display_name: r.display_name ?? r.name,
        description: r.description ?? '',
        icon: r.icon ?? (r.config?.category ?? 'other'),
        features: r.features ?? r.config?.features ?? [],
        vendorTypes: r.vendorTypes ?? r.vendor_types_supported ?? r.config?.vendorTypes ?? [],
        serviceStyles: r.serviceStyles ?? r.config?.serviceStyles ?? r.config?.service_styles ?? [],
        selectedServiceStyles: r.selectedServiceStyles ?? r.serviceStyles ?? r.config?.serviceStyles ?? [],
        vendorConfiguration: r.vendorConfiguration ?? r.config?.vendorConfiguration ?? r.config?.vendor_configuration ?? null,
        pricingControl: r.pricingControl ?? r.config?.pricingControl ?? { canControlPrice: true, canControlDuration: true },
        capabilities: r.capabilities ?? [],
        order: r.order ?? 999,
        isActive: r.isActive !== false && r.is_active !== false,
        category: r.category ?? r.config?.category,
      }));
      const activeRoles = normalized.filter((r: Role) => r.isActive !== false);
      // Dedupe by stable key: prefer role name (behaviorist_solo, trainer_solo) so API roles with UUID id still show once
      const uniqueRoles = Array.from(
        new Map(activeRoles.map((r: Role) => [(r.name || r.id || '').toString(), r])).values()
      );
      let finalRoles = uniqueRoles as Role[];
      // If API returned empty (e.g. roles table issue), show fallback so UI is never blank
      if (finalRoles.length === 0) {
        finalRoles = getFallbackRoles();
      }
      setRoles(finalRoles);
    } catch (err) {
      console.error('Error fetching roles:', err);
      setError('Failed to load roles. Please try again.');
      setRoles(getFallbackRoles());
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    // Clear all vendor-related localStorage
    localStorage.removeItem('vendorPhone');
    localStorage.removeItem('authToken');
    localStorage.removeItem('vendorData');
    localStorage.removeItem('vendorRole');
    localStorage.removeItem('vendorApplicationStatus');
    localStorage.removeItem('vendorSelectedRole');
    localStorage.removeItem('vendorId');
    localStorage.removeItem('vendorType');
    localStorage.removeItem('vendorOnboardingComplete');
    // Redirect to auth page
    router.push('/auth');
  };

  const toggleCategory = (categoryKey: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryKey]: !prev[categoryKey]
    }));
  };

  // Group roles by category: prefer API role.category when it matches a display category, else match by role id/name
  const groupedRoles = useMemo(() => {
    const groups: Record<string, Role[]> = {};
    DISPLAY_CATEGORY_KEYS.forEach(key => { groups[key] = []; });
    groups['other'] = [];

    roles.forEach(role => {
      const roleCategory = (role as Role & { category?: string }).category;
      // Prefer name for category matching so API roles with UUID id but canonical name (e.g. behaviorist_solo) group correctly
      const roleIdOrName = role.name || role.id;

      // 1) Use API category when it's one of our display categories
      if (roleCategory && DISPLAY_CATEGORY_KEYS.includes(roleCategory as typeof DISPLAY_CATEGORY_KEYS[number]) && groups[roleCategory]) {
        groups[roleCategory].push(role);
        return;
      }

      // 2) Fallback: match by role name/id against ROLE_CATEGORIES
      let assigned = false;
      for (const [key, category] of Object.entries(ROLE_CATEGORIES)) {
        if (category.roles.includes(roleIdOrName)) {
          groups[key].push(role);
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        groups['other'].push(role);
      }
    });

    return groups;
  }, [roles]);

  // Filter roles based on search
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groupedRoles;

    const query = searchQuery.toLowerCase();
    const filtered: Record<string, Role[]> = {};

    Object.entries(groupedRoles).forEach(([key, categoryRoles]) => {
      const matchingRoles = categoryRoles.filter(role => {
        const displayName = (role.display_name || role.name).toLowerCase();
        const description = (role.description || '').toLowerCase();
        const enhancedInfo = ROLE_ENHANCED_INFO[role.name || role.id];
        const tagline = enhancedInfo?.tagline?.toLowerCase() || '';
        const services = enhancedInfo?.services?.join(' ').toLowerCase() || '';
        
        return displayName.includes(query) || 
               description.includes(query) || 
               tagline.includes(query) ||
               services.includes(query);
      });
      if (matchingRoles.length > 0) {
        filtered[key] = matchingRoles;
      }
    });

    return filtered;
  }, [groupedRoles, searchQuery]);

  // Auto-expand categories with search results
  useEffect(() => {
    if (searchQuery.trim()) {
      const expanded: Record<string, boolean> = {};
      Object.keys(filteredGroups).forEach(key => {
        expanded[key] = true;
      });
      setExpandedCategories(expanded);
    }
  }, [filteredGroups, searchQuery]);

  const getCategoryConfig = (key: string) => {
    return ROLE_CATEGORIES[key as keyof typeof ROLE_CATEGORIES] || {
      name: 'Other Services',
      icon: Package,
      color: 'gray',
      description: 'Additional services',
    };
  };

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
      blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', iconBg: 'bg-blue-500' },
      pink: { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', iconBg: 'bg-pink-500' },
      indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', iconBg: 'bg-indigo-500' },
      green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', iconBg: 'bg-green-500' },
      purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', iconBg: 'bg-purple-500' },
      orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', iconBg: 'bg-orange-500' },
      teal: { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', iconBg: 'bg-teal-500' },
      gray: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', iconBg: 'bg-gray-500' },
    };
    return colors[color] || colors.gray;
  };

  const getRoleIcon = (roleIdOrName: string) => {
    return ROLE_ICONS[roleIdOrName] || Package;
  };

  const totalResults = Object.values(filteredGroups).reduce((sum, roles) => sum + roles.length, 0);

  return (
    <div className="min-h-screen bg-[#FF8C42] flex flex-col vendor-auth-column">
      {/* Header with Back/Logout */}
      <div className="px-4 pt-3 pb-2 flex justify-between items-center">
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-black/80 hover:text-black transition-colors px-2 py-1.5 rounded-lg hover:bg-black/10"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-medium">Back</span>
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-black/80 hover:text-black transition-colors px-2 py-1.5 rounded-lg hover:bg-black/10"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-xs font-medium">Logout</span>
        </button>
      </div>

      {/* Orange Top Section */}
      <div className="flex flex-col items-center pt-4 pb-4 px-6">
        {/* Paw Logo */}
        <div className="mb-3 w-16 h-16 flex items-center justify-center">
          <svg width="64" height="64" viewBox="0 0 120 120" fill="none">
            <ellipse cx="60" cy="75" rx="22" ry="26" fill="black"/>
            <path d="M60 70C58 68 54 68 52 70C50 72 50 75 52 77L60 85L68 77C70 75 70 72 68 70C66 68 62 68 60 70Z" fill="#FF8C42"/>
            <ellipse cx="40" cy="45" rx="10" ry="14" transform="rotate(-15 40 45)" fill="black"/>
            <ellipse cx="50" cy="35" rx="10" ry="14" transform="rotate(-5 50 35)" fill="black"/>
            <ellipse cx="70" cy="35" rx="10" ry="14" transform="rotate(5 70 35)" fill="black"/>
            <ellipse cx="80" cy="45" rx="10" ry="14" transform="rotate(15 80 45)" fill="black"/>
          </svg>
        </div>
        
        <h1 className="text-black text-center text-2xl font-bold">Choose Your Role</h1>
        <p className="text-black/70 text-center text-xs mt-1">
          Select how you want to serve pet parents
        </p>
      </div>

      {/* White Bottom Section */}
      <div className="flex-1 bg-white rounded-t-[32px] px-4 py-5 overflow-hidden flex flex-col">
        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search roles, services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent placeholder:text-gray-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          )}
        </div>

        {/* Search Results Count */}
        {searchQuery && (
          <p className="text-xs text-gray-500 mb-3 px-1">
            Found {totalResults} role{totalResults !== 1 ? 's' : ''} matching "{searchQuery}"
          </p>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF8C42]"></div>
          </div>
        ) : error && roles.length === 0 ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
            <p className="text-red-700 text-center text-xs">{error}</p>
          </div>
        ) : (
          /* Scrollable Categories */
          <div className="flex-1 overflow-y-auto space-y-3 pb-4">
            {Object.entries(filteredGroups).map(([categoryKey, categoryRoles]) => {
              if (categoryRoles.length === 0) return null;
              
              const config = getCategoryConfig(categoryKey);
              const colorClasses = getColorClasses(config.color);
              const isExpanded = expandedCategories[categoryKey];
              const CategoryIcon = config.icon;

              return (
                <div key={categoryKey} className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(categoryKey)}
                    className={`w-full flex items-center justify-between p-3.5 ${colorClasses.bg} hover:opacity-90 transition-opacity`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 ${colorClasses.iconBg} rounded-xl flex items-center justify-center shadow-sm`}>
                        <CategoryIcon className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-left">
                        <h2 className={`font-semibold text-sm ${colorClasses.text}`}>{config.name}</h2>
                        <p className="text-xs text-gray-500">{config.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${colorClasses.bg} ${colorClasses.text} border ${colorClasses.border}`}>
                        {categoryRoles.length}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Roles List */}
                  {isExpanded && (
                    <div className="divide-y divide-gray-100">
                      {categoryRoles.map((role) => {
                        const roleKey = role.name || role.id;
                        const RoleIcon = getRoleIcon(roleKey);
                        const enhancedInfo = ROLE_ENHANCED_INFO[roleKey];
                        const serviceStyles = role.selectedServiceStyles || role.serviceStyles || [];
                        const vendorConfig = role.vendorConfiguration;

                        return (
                          <button
                            key={role.id || roleKey}
                            onClick={() => onRoleSelect(role.id)}
                            className="w-full p-3.5 bg-white hover:bg-gray-50 transition-colors text-left group"
                          >
                            <div className="flex items-start gap-3">
                              {/* Role Icon */}
                              <div className={`w-11 h-11 ${colorClasses.iconBg} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform`}>
                                <RoleIcon className="w-5 h-5 text-white" />
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                  <h3 className="text-gray-900 font-semibold text-sm">
                                    {role.display_name || role.name}
                                  </h3>
                                  {vendorConfig && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                      vendorConfig === 'solo'
                                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                        : 'bg-purple-100 text-purple-700 border border-purple-200'
                                    }`}>
                                      {vendorConfig === 'solo' ? '👤 Solo' : '🏢 Business'}
                                    </span>
                                  )}
                                </div>
                                
                                {/* Tagline */}
                                <p className="text-[11px] text-gray-600 mb-2 leading-tight">
                                  {enhancedInfo?.tagline || role.description}
                                </p>
                                
                                {/* Service Styles */}
                                {serviceStyles.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mb-2">
                                    {serviceStyles.slice(0, 4).map((style, idx) => {
                                      const styleConfig = SERVICE_STYLE_CONFIG[style];
                                      const StyleIcon = styleConfig?.icon || Package;
                                      return (
                                        <span 
                                          key={idx}
                                          className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-700"
                                          title={styleConfig?.description}
                                        >
                                          <StyleIcon className="w-3 h-3" />
                                          {styleConfig?.label || style}
                                        </span>
                                      );
                                    })}
                                    {serviceStyles.length > 4 && (
                                      <span className="text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-500">
                                        +{serviceStyles.length - 4}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Key Services */}
                                {enhancedInfo?.services && (
                                  <div className="flex flex-wrap gap-1">
                                    {enhancedInfo.services.slice(0, 3).map((service, idx) => (
                                      <span 
                                        key={idx}
                                        className={`text-[9px] px-1.5 py-0.5 rounded-full border ${colorClasses.border} ${colorClasses.bg} ${colorClasses.text}`}
                                      >
                                        {service}
                                      </span>
                                    ))}
                                    {enhancedInfo.services.length > 3 && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-500">
                                        +{enhancedInfo.services.length - 3} more
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Arrow */}
                              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#FF8C42] flex-shrink-0 mt-1 group-hover:translate-x-0.5 transition-all" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* No Results */}
            {Object.keys(filteredGroups).length === 0 && (
              <div className="text-center py-8">
                <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No roles found for "{searchQuery}"</p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-[#FF8C42] text-sm mt-2 hover:underline"
                >
                  Clear search
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-gray-100">
          <p className="text-center text-[10px] text-gray-400 leading-tight">
            Join 15,000+ pet professionals on WARMPAWZ<br />
            © 2025 WARMPAWZ Inc. All rights reserved
          </p>
        </div>
      </div>

      {/* Home Indicator */}
      <div className="flex justify-center py-3 bg-white">
        <div className="w-32 h-1 bg-black rounded-full"></div>
      </div>
    </div>
  );
}
