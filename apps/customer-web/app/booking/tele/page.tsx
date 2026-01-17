'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { InstantTeleQueue } from '@/components/customer/InstantTeleQueue';
import { apiClient } from '@/lib/api-client';

export default function TeleConsultationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [petId, setPetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const roleId = searchParams.get('roleId') || 'veterinarian';
  const category = searchParams.get('category') || 'vet';
  const serviceId = searchParams.get('serviceId') || undefined;

  useEffect(() => {
    // Get customer ID from context/localStorage
    if (typeof window !== 'undefined') {
      const customerSession = localStorage.getItem('customer_session') || localStorage.getItem('customerData');
      
      if (customerSession) {
        try {
          const customer = typeof customerSession === 'string' ? JSON.parse(customerSession) : customerSession;
          setCustomerId(customer.id || customer.customerId);
        } catch (e) {
          // Try alternative storage keys
          const phone = localStorage.getItem('customer_phone');
          if (phone) {
            // Load customer by phone
            loadCustomerByPhone(phone);
          }
        }
        
        // Get pet ID from params or load default
        const petIdParam = searchParams.get('petId');
        if (petIdParam) {
          setPetId(petIdParam);
          setLoading(false);
        } else {
          // Will be loaded after customer ID is set
        }
      } else {
        // Try to get from phone
        const phone = localStorage.getItem('customer_phone');
        if (phone) {
          loadCustomerByPhone(phone);
        } else {
          setLoading(false);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (customerId && !petId) {
      loadDefaultPet(customerId);
    }
  }, [customerId]);

  const loadCustomerByPhone = async (phone: string) => {
    try {
      const response = await apiClient.get<any>(`/customer/profile?phone=${encodeURIComponent(phone)}`);
      const customerIdFromResponse = response.profile?.id || response.id || response.customerId;
      if (customerIdFromResponse) {
        setCustomerId(customerIdFromResponse);
      }
    } catch (error) {
      console.error('Error loading customer:', error);
      setLoading(false);
    }
  };

  const loadDefaultPet = async (customerId: string) => {
    try {
      const response = await apiClient.get<any>(`/customer/${customerId}/pets`);
      if (response.pets && response.pets.length > 0) {
        setPetId(response.pets[0].id);
      }
    } catch (error) {
      console.error('Error loading pets:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!customerId || !petId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <h2 className="text-xl font-semibold mb-2">Setup Required</h2>
          <p className="text-gray-600 mb-4">
            {!customerId ? 'Please login first' : 'Please add a pet to your profile'}
          </p>
          <button
            onClick={() => router.push(!customerId ? '/auth' : '/pets')}
            className="px-4 py-2 bg-[#FF8C42] text-white rounded-lg hover:bg-[#FF7A29]"
          >
            {!customerId ? 'Login' : 'Add Pet'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.back()}
          className="mb-4 text-gray-600 hover:text-gray-800 flex items-center gap-2"
        >
          ← Back
        </button>
        
        <InstantTeleQueue
          customerId={customerId}
          petId={petId}
          roleId={roleId}
          category={category}
          serviceId={serviceId}
          onQueueJoined={(queueId) => {
            console.log('Joined queue:', queueId);
          }}
          onAccepted={(bookingId, meetingId) => {
            router.push(`/video/${bookingId}${meetingId ? `?meetingId=${meetingId}` : ''}`);
          }}
        />
      </div>
    </div>
  );
}
