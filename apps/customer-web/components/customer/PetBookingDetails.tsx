'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Clock, MapPin, Star, Copy, Check, Navigation, Route, Timer, TrendingUp, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { projectId, publicAnonKey } from '@/lib/supabase/info';
import { WalkerActiveSession } from './WalkerActiveSession';
import { BookingDetailModal } from './BookingDetailModal';

interface BookingSession {
  id: string;
  date: string;
  timeSlot: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  otp?: string;
  startTime?: string;
  endTime?: string;
  distance?: number;
  duration?: number;
  route?: Array<{ lat: number; lng: number }>;
  rating?: number;
  feedback?: string;
}

interface Booking {
  id: string;
  serviceType: string;
  petId: string;
  petName: string;
  petPhoto?: string;
  vendorId: string;
  vendorName: string;
  vendorPhoto?: string;
  startDate: string;
  endDate?: string;
  duration: string;
  frequency: 'single' | 'weekly' | 'monthly';
  schedule: 'morning' | 'evening' | 'anytime';
  sessionsPerDay?: number;
  totalSessions: number;
  completedSessions: number;
  upcomingSessions: number;
  status: 'active' | 'completed' | 'cancelled';
  price: number;
  sessions: BookingSession[];
}

export function PetBookingDetails({
  bookingId,
  petId,
  phone,
  onBack,
  onReorderMedicine
}: {
  bookingId: string;
  petId: string;
  phone: string;
  onBack: () => void;
  onReorderMedicine?: (medications: any[]) => void;
}) {
  // Simply render the BookingDetailModal which has all the enhanced features
  return (
    <BookingDetailModal
      bookingId={bookingId}
      petId={petId}
      phone={phone}
      onClose={onBack}
      onReorderMedicine={onReorderMedicine}
    />
  );
}