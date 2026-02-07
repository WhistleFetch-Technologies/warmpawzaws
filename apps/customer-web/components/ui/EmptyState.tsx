'use client';

import { 
  Calendar, 
  Package, 
  Heart, 
  ShoppingBag, 
  Search, 
  MapPin,
  Bell,
  FileText,
  Users,
  Star,
  Clock,
  PawPrint,
  Building2,
  Stethoscope,
  Scissors,
  GraduationCap,
  Home,
  Camera
} from 'lucide-react';
import { Button } from './button';

export type EmptyStateType = 
  | 'bookings'
  | 'orders'
  | 'pets'
  | 'cart'
  | 'search'
  | 'location'
  | 'notifications'
  | 'prescriptions'
  | 'providers'
  | 'reviews'
  | 'schedule'
  | 'clinics'
  | 'grooming'
  | 'training'
  | 'boarding'
  | 'gallery'
  | 'generic';

interface EmptyStateProps {
  type?: EmptyStateType;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  className?: string;
}

const iconMap: Record<EmptyStateType, React.ReactNode> = {
  bookings: <Calendar className="w-12 h-12 text-gray-300" />,
  orders: <ShoppingBag className="w-12 h-12 text-gray-300" />,
  pets: <PawPrint className="w-12 h-12 text-gray-300" />,
  cart: <ShoppingBag className="w-12 h-12 text-gray-300" />,
  search: <Search className="w-12 h-12 text-gray-300" />,
  location: <MapPin className="w-12 h-12 text-gray-300" />,
  notifications: <Bell className="w-12 h-12 text-gray-300" />,
  prescriptions: <FileText className="w-12 h-12 text-gray-300" />,
  providers: <Users className="w-12 h-12 text-gray-300" />,
  reviews: <Star className="w-12 h-12 text-gray-300" />,
  schedule: <Clock className="w-12 h-12 text-gray-300" />,
  clinics: <Stethoscope className="w-12 h-12 text-gray-300" />,
  grooming: <Scissors className="w-12 h-12 text-gray-300" />,
  training: <GraduationCap className="w-12 h-12 text-gray-300" />,
  boarding: <Building2 className="w-12 h-12 text-gray-300" />,
  gallery: <Camera className="w-12 h-12 text-gray-300" />,
  generic: <Package className="w-12 h-12 text-gray-300" />,
};

/**
 * EmptyState - Unified empty state component
 * Use consistent 2D Lucide icons across the app for professional look
 */
export function EmptyState({
  type = 'generic',
  title,
  description,
  actionLabel,
  onAction,
  icon,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}>
      {/* Icon Container */}
      <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
        {icon || iconMap[type]}
      </div>
      
      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      
      {/* Description */}
      {description && (
        <p className="text-sm text-gray-500 max-w-xs mb-6">{description}</p>
      )}
      
      {/* Action Button */}
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export default EmptyState;
