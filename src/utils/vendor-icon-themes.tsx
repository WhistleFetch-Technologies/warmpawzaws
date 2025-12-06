/**
 * VENDOR ICON THEMING SYSTEM
 * 
 * Dynamically assigns role-appropriate icons across the vendor app
 * to create a cohesive, themed experience for each vendor type.
 */

import {
  // Grooming Icons
  Scissors, Sparkles, Droplet, Brush, Wind, Bath,
  
  // Veterinary Icons
  Stethoscope, Heart, Pill, Syringe, Microscope, Cross, HeartPulse, Activity,
  
  // Building/Clinic Icons
  Building2, Hospital, Home, Hotel, Store,
  
  // Training Icons
  Target, Award, Whistle, BookOpen, TrendingUp, GraduationCap, Trophy,
  
  // Walking Icons
  Footprints, TreePine, MapPin, Clock, Sun, Compass, Map,
  
  // Sitting/Care Icons
  Moon, Star, Shield, Baby, UserCheck, Eye,
  
  // Transport Icons
  Truck, Car, Navigation, Route, Bike,
  
  // Cafe/Food Icons
  Coffee, Cake, UtensilsCrossed, IceCream, Cookie, Wine,
  
  // Photography Icons
  Camera, Image, Aperture, Frame, Film, Focus,
  
  // Emergency/Ambulance Icons
  Ambulance, Siren, Phone, AlertCircle, Zap,
  
  // Sunset/Memorial Icons  
  Heart as HeartIcon, Flower, CloudRain, Sparkle,
  
  // Common/Generic Icons
  Package, Calendar, Users, DollarSign, MessageSquare, 
  Bell, Settings, FileText, CheckCircle, XCircle,
  BarChart3, PieChart, LineChart, TrendingDown
} from 'lucide-react';

export interface VendorIconTheme {
  // Primary role identifier icon
  roleIcon: any;
  
  // Dashboard stat icons
  stats: {
    revenue: any;
    bookings: any;
    customers: any;
    rating: any;
    pending: any;
    completed: any;
  };
  
  // Service-related icons
  services: {
    active: any;
    featured: any;
    scheduled: any;
  };
  
  // Navigation/Action icons
  actions: {
    calendar: any;
    messages: any;
    notifications: any;
    settings: any;
  };
}

/**
 * Icon theme mappings for each vendor role
 */
export const VENDOR_ICON_THEMES: Record<string, VendorIconTheme> = {
  
  // ============================================
  // PET GROOMER THEME (Scissors, Sparkles, Bath)
  // ============================================
  'pet_groomer': {
    roleIcon: Scissors,
    stats: {
      revenue: DollarSign,
      bookings: Scissors,
      customers: Users,
      rating: Sparkles,
      pending: Clock,
      completed: CheckCircle,
    },
    services: {
      active: Brush,
      featured: Sparkles,
      scheduled: Calendar,
    },
    actions: {
      calendar: Calendar,
      messages: MessageSquare,
      notifications: Bell,
      settings: Settings,
    }
  },
  
  // ============================================
  // VETERINARIAN THEME (Stethoscope, Heart, Medical)
  // ============================================
  'veterinarian': {
    roleIcon: Stethoscope,
    stats: {
      revenue: DollarSign,
      bookings: Calendar,
      customers: Heart,
      rating: Award,
      pending: Clock,
      completed: CheckCircle,
    },
    services: {
      active: Activity,
      featured: HeartPulse,
      scheduled: Calendar,
    },
    actions: {
      calendar: Calendar,
      messages: MessageSquare,
      notifications: Bell,
      settings: Settings,
    }
  },
  
  // ============================================
  // VETERINARY CLINIC THEME (Hospital, Building, Cross)
  // ============================================
  'veterinary_clinic': {
    roleIcon: Hospital,
    stats: {
      revenue: DollarSign,
      bookings: Calendar,
      customers: Users,
      rating: Award,
      pending: Clock,
      completed: CheckCircle,
    },
    services: {
      active: Cross,
      featured: HeartPulse,
      scheduled: Calendar,
    },
    actions: {
      calendar: Calendar,
      messages: MessageSquare,
      notifications: Bell,
      settings: Settings,
    }
  },
  
  // ============================================
  // PET TRAINER THEME (Target, Award, Training)
  // ============================================
  'pet_trainer': {
    roleIcon: Target,
    stats: {
      revenue: DollarSign,
      bookings: BookOpen,
      customers: Users,
      rating: Trophy,
      pending: Clock,
      completed: Award,
    },
    services: {
      active: GraduationCap,
      featured: Trophy,
      scheduled: Calendar,
    },
    actions: {
      calendar: Calendar,
      messages: MessageSquare,
      notifications: Bell,
      settings: Settings,
    }
  },
  
  // ============================================
  // DOG WALKER THEME (Footprints, Nature, Outdoor)
  // ============================================
  'pet_walker': {
    roleIcon: Footprints,
    stats: {
      revenue: DollarSign,
      bookings: MapPin,
      customers: Users,
      rating: Star,
      pending: Clock,
      completed: CheckCircle,
    },
    services: {
      active: Compass,
      featured: Sun,
      scheduled: Calendar,
    },
    actions: {
      calendar: Calendar,
      messages: MessageSquare,
      notifications: Bell,
      settings: Settings,
    }
  },
  
  // ============================================
  // PET SITTER THEME (Home, Care, Night)
  // ============================================
  'pet_sitter': {
    roleIcon: Home,
    stats: {
      revenue: DollarSign,
      bookings: Moon,
      customers: Users,
      rating: Star,
      pending: Clock,
      completed: CheckCircle,
    },
    services: {
      active: Shield,
      featured: Heart,
      scheduled: Calendar,
    },
    actions: {
      calendar: Calendar,
      messages: MessageSquare,
      notifications: Bell,
      settings: Settings,
    }
  },
  
  // ============================================
  // PET BOARDER THEME (Hotel, Accommodation)
  // ============================================
  'pet_boarder': {
    roleIcon: Hotel,
    stats: {
      revenue: DollarSign,
      bookings: Calendar,
      customers: Users,
      rating: Star,
      pending: Clock,
      completed: CheckCircle,
    },
    services: {
      active: Home,
      featured: Shield,
      scheduled: Calendar,
    },
    actions: {
      calendar: Calendar,
      messages: MessageSquare,
      notifications: Bell,
      settings: Settings,
    }
  },
  
  // ============================================
  // PET CAFE THEME (Coffee, Food, Social)
  // ============================================
  'pet_cafe': {
    roleIcon: Coffee,
    stats: {
      revenue: DollarSign,
      bookings: UtensilsCrossed,
      customers: Users,
      rating: Star,
      pending: Clock,
      completed: CheckCircle,
    },
    services: {
      active: Cookie,
      featured: IceCream,
      scheduled: Calendar,
    },
    actions: {
      calendar: Calendar,
      messages: MessageSquare,
      notifications: Bell,
      settings: Settings,
    }
  },
  
  // ============================================
  // PET TRANSPORT THEME (Vehicle, Route, Navigation)
  // ============================================
  'pet_transport': {
    roleIcon: Truck,
    stats: {
      revenue: DollarSign,
      bookings: Route,
      customers: Users,
      rating: Star,
      pending: Clock,
      completed: CheckCircle,
    },
    services: {
      active: Car,
      featured: Navigation,
      scheduled: Calendar,
    },
    actions: {
      calendar: Calendar,
      messages: MessageSquare,
      notifications: Bell,
      settings: Settings,
    }
  },
  
  // ============================================
  // PET PHOTOGRAPHER THEME (Camera, Creative)
  // ============================================
  'pet_photographer': {
    roleIcon: Camera,
    stats: {
      revenue: DollarSign,
      bookings: Image,
      customers: Users,
      rating: Star,
      pending: Clock,
      completed: CheckCircle,
    },
    services: {
      active: Aperture,
      featured: Frame,
      scheduled: Calendar,
    },
    actions: {
      calendar: Calendar,
      messages: MessageSquare,
      notifications: Bell,
      settings: Settings,
    }
  },
  
  // ============================================
  // AMBULANCE SERVICE THEME (Emergency, Medical)
  // ============================================
  'ambulance_service': {
    roleIcon: Ambulance,
    stats: {
      revenue: DollarSign,
      bookings: Phone,
      customers: Users,
      rating: Award,
      pending: AlertCircle,
      completed: CheckCircle,
    },
    services: {
      active: Zap,
      featured: Siren,
      scheduled: Calendar,
    },
    actions: {
      calendar: Calendar,
      messages: MessageSquare,
      notifications: Bell,
      settings: Settings,
    }
  },
  
  // ============================================
  // PET SUNSET SERVICES THEME (Compassionate, Memorial)
  // ============================================
  'sunset_services': {
    roleIcon: HeartIcon,
    stats: {
      revenue: DollarSign,
      bookings: Calendar,
      customers: Users,
      rating: Star,
      pending: Clock,
      completed: CheckCircle,
    },
    services: {
      active: Flower,
      featured: Sparkle,
      scheduled: Calendar,
    },
    actions: {
      calendar: Calendar,
      messages: MessageSquare,
      notifications: Bell,
      settings: Settings,
    }
  },
  
  // ============================================
  // DEFAULT THEME (Generic/Fallback)
  // ============================================
  'default': {
    roleIcon: Package,
    stats: {
      revenue: DollarSign,
      bookings: Calendar,
      customers: Users,
      rating: Star,
      pending: Clock,
      completed: CheckCircle,
    },
    services: {
      active: Package,
      featured: Star,
      scheduled: Calendar,
    },
    actions: {
      calendar: Calendar,
      messages: MessageSquare,
      notifications: Bell,
      settings: Settings,
    }
  }
};

/**
 * Get icon theme for a vendor role
 * @param roleId - Vendor role ID (e.g., 'pet_groomer', 'veterinarian')
 * @returns Icon theme configuration
 */
export function getVendorIconTheme(roleId: string | undefined): VendorIconTheme {
  if (!roleId) return VENDOR_ICON_THEMES['default'];
  return VENDOR_ICON_THEMES[roleId] || VENDOR_ICON_THEMES['default'];
}

/**
 * Get role-specific icon component
 * @param roleId - Vendor role ID
 * @returns Lucide icon component
 */
export function getRoleIcon(roleId: string | undefined): any {
  const theme = getVendorIconTheme(roleId);
  return theme.roleIcon;
}

/**
 * Get role-specific color scheme
 * Provides consistent color theming across the vendor app
 */
export function getRoleColorScheme(roleId: string | undefined): {
  primary: string;
  light: string;
  dark: string;
} {
  const colorSchemes: Record<string, any> = {
    'pet_groomer': {
      primary: 'bg-purple-500',
      light: 'bg-purple-50',
      dark: 'text-purple-700'
    },
    'veterinarian': {
      primary: 'bg-red-500',
      light: 'bg-red-50',
      dark: 'text-red-700'
    },
    'veterinary_clinic': {
      primary: 'bg-blue-600',
      light: 'bg-blue-50',
      dark: 'text-blue-700'
    },
    'pet_trainer': {
      primary: 'bg-green-500',
      light: 'bg-green-50',
      dark: 'text-green-700'
    },
    'pet_walker': {
      primary: 'bg-emerald-500',
      light: 'bg-emerald-50',
      dark: 'text-emerald-700'
    },
    'pet_sitter': {
      primary: 'bg-indigo-500',
      light: 'bg-indigo-50',
      dark: 'text-indigo-700'
    },
    'pet_boarder': {
      primary: 'bg-cyan-500',
      light: 'bg-cyan-50',
      dark: 'text-cyan-700'
    },
    'pet_cafe': {
      primary: 'bg-amber-500',
      light: 'bg-amber-50',
      dark: 'text-amber-700'
    },
    'pet_transport': {
      primary: 'bg-slate-600',
      light: 'bg-slate-50',
      dark: 'text-slate-700'
    },
    'pet_photographer': {
      primary: 'bg-pink-500',
      light: 'bg-pink-50',
      dark: 'text-pink-700'
    },
    'ambulance_service': {
      primary: 'bg-red-600',
      light: 'bg-red-50',
      dark: 'text-red-700'
    },
    'sunset_services': {
      primary: 'bg-gray-500',
      light: 'bg-gray-50',
      dark: 'text-gray-700'
    },
    'default': {
      primary: 'bg-[#FF8C42]',
      light: 'bg-orange-50',
      dark: 'text-orange-700'
    }
  };
  
  return colorSchemes[roleId || 'default'] || colorSchemes['default'];
}