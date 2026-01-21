'use client';

import React from 'react';
import {
  Home, Phone, Building2, Scissors, Sparkles, UtensilsCrossed,
  Package, MapPin, Dog, Cat, Bone, ShoppingBag, Heart,
  Stethoscope, Pill, GraduationCap, Camera, Truck, Shield,
  Video, BookOpen, Wheat
} from 'lucide-react';

// Map icon string identifiers to Lucide React components
export const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  // Service style icons
  'home': Home,
  'at_home': Home,
  'phone': Phone,
  'tele': Phone,
  'video': Video,
  'building': Building2,
  'clinic': Building2,
  'at_center': Scissors,
  'scissors': Scissors,
  'spa': Sparkles,
  
  // Pet type icons
  'dog': Dog,
  'cat': Cat,
  'pet': Heart,
  
  // Product/category icons
  'food': UtensilsCrossed,
  'bone': Bone,
  'package': Package,
  'location': MapPin,
  'shopping': ShoppingBag,
  'health': Stethoscope,
  'medicine': Pill,
  'training': GraduationCap,
  'camera': Camera,
  'delivery': Truck,
  'insurance': Shield,
  'nutrition': Wheat,
  'book': BookOpen,
};

// Get icon component from string identifier
export function getIcon(iconKey: string | undefined, fallback?: React.ComponentType<{ className?: string }>): React.ComponentType<{ className?: string }> {
  if (!iconKey) return fallback || Package;
  
  const key = iconKey.toLowerCase().replace(/[^a-z_]/g, '');
  return iconMap[key] || fallback || Package;
}

// Render icon from string with consistent styling
export function renderIcon(
  iconKey: string | undefined, 
  className: string = 'w-6 h-6',
  fallback?: React.ComponentType<{ className?: string }>
): React.ReactNode {
  const IconComponent = getIcon(iconKey, fallback);
  return <IconComponent className={className} />;
}

// Map service style to icon component
export function getServiceStyleIcon(serviceStyle: string | undefined): React.ComponentType<{ className?: string }> {
  switch (serviceStyle) {
    case 'at_home':
      return Home;
    case 'at_center':
      return Scissors;
    case 'tele':
    case 'video':
      return Phone;
    case 'clinic':
      return Building2;
    default:
      return Sparkles;
  }
}

// Map pet type to icon component
export function getPetIcon(petType: string | undefined): React.ComponentType<{ className?: string }> {
  switch (petType?.toLowerCase()) {
    case 'dog':
      return Dog;
    case 'cat':
      return Cat;
    default:
      return Heart;
  }
}
