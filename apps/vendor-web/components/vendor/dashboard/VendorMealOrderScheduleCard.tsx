'use client';

import { Clock, Phone, User, UtensilsCrossed } from 'lucide-react';
import { formatVendorMealDeliveryBadge, type MealDeliveryEffective } from '@warmpawz/shared-types';
import type { ScheduleItem } from './types';

interface VendorMealOrderScheduleCardProps {
  order: ScheduleItem;
  onOpen: () => void;
}

function mealOrderStatusLabel(status: string): string {
  const known: MealDeliveryEffective[] = [
    'pending',
    'confirmed',
    'preparing',
    'ready_for_pickup',
    'picked_up',
    'on_the_way',
    'delivered',
    'cancelled',
    'failed',
  ];
  if (known.includes(status as MealDeliveryEffective)) {
    return formatVendorMealDeliveryBadge(status as MealDeliveryEffective);
  }
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function VendorMealOrderScheduleCard({ order, onOpen }: VendorMealOrderScheduleCardProps) {
  const statusLabel = mealOrderStatusLabel(order.status);

  return (
    <div className="bg-white border-2 border-gray-200 rounded-xl p-3 hover:border-lime-500 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 bg-lime-100 rounded-xl flex items-center justify-center">
            <UtensilsCrossed className="w-6 h-6 text-lime-700" />
          </div>
          <span className="text-xs font-medium text-lime-700">Meal order</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Clock className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-sm font-semibold text-gray-900 truncate">{order.time}</span>
            </div>
            <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700 shrink-0">
              {statusLabel}
            </span>
          </div>

          <div className="flex items-center gap-1 mb-1 flex-wrap">
            <User className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-500">Customer:</span>
            <span className="text-sm font-medium text-gray-900">{order.customerName}</span>
          </div>

          <div className="text-sm font-medium text-gray-900 mb-1">{order.petName}</div>

          <div className="flex items-center gap-1 mb-2">
            <span className="text-xs text-gray-500">Order:</span>
            <span className="text-xs font-medium text-lime-700">{order.serviceName}</span>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={onOpen}
              className="flex-1 min-w-[80px] py-1.5 px-3 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium"
            >
              Manage
            </button>
            {order.customerPhone ? (
              <a
                href={`tel:${order.customerPhone}`}
                className="flex-1 min-w-[80px] py-1.5 px-3 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium flex items-center justify-center gap-1"
              >
                <Phone className="w-3.5 h-3.5" /> Call
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
