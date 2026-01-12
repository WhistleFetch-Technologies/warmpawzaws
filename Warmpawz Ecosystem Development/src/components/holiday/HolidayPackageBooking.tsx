import React, { useState, useEffect } from 'react';
import { Calendar, Users, DollarSign, CheckCircle } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

/**
 * 🎫 HOLIDAY PACKAGE BOOKING COMPONENT
 * Phase 7B: Rule 13 - Complete booking flow
 */

interface HolidayPackageBookingProps {
  packageId: string;
  customerId: string;
}

export default function HolidayPackageBooking({ packageId, customerId }: HolidayPackageBookingProps) {
  const [pkg, setPkg] = useState<any>(null);
  const [formData, setFormData] = useState({
    selectedStartDate: '',
    selectedEndDate: '',
    adults: 1,
    children: 0,
    pets: [{ petId: '', petName: '', breed: '' }],
    specialRequests: '',
    dietaryRequirements: '',
    medicalConditions: '',
  });
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    fetchPackage();
  }, [packageId]);

  const fetchPackage = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/holiday-packages/${packageId}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      const data = await response.json();
      if (data.success) setPkg(data.data.package);
    } catch (error) {
      console.error('Error fetching package:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    if (!pkg) return 0;
    const { basePrice, pricePerPet, pricePerAdult, pricePerChild } = pkg.pricing;
    return (
      basePrice +
      formData.pets.length * pricePerPet +
      formData.adults * pricePerAdult +
      formData.children * pricePerChild
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBooking(true);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/holiday-packages/${packageId}/book`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            customerId,
            ...formData,
            travelers: {
              adults: formData.adults,
              children: formData.children,
              pets: formData.pets,
            },
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        alert('Booking successful!');
        window.location.href = `/bookings/${data.data.booking.bookingId}`;
      } else {
        alert('Booking failed: ' + data.error);
      }
    } catch (error) {
      console.error('Error booking:', error);
      alert('Booking failed');
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>;
  }

  if (!pkg) {
    return <div className="p-12 text-center">Package not found</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg p-8 shadow-sm">
          <h1 className="text-gray-900 mb-6">Book {pkg.packageName}</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={formData.selectedStartDate}
                  onChange={(e) => setFormData({ ...formData, selectedStartDate: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={formData.selectedEndDate}
                  onChange={(e) => setFormData({ ...formData, selectedEndDate: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-700 mb-2">Adults</label>
                <input
                  type="number"
                  min="1"
                  value={formData.adults}
                  onChange={(e) => setFormData({ ...formData, adults: parseInt(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-2">Children</label>
                <input
                  type="number"
                  min="0"
                  value={formData.children}
                  onChange={(e) => setFormData({ ...formData, children: parseInt(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 mb-2">Pet Details</label>
              {formData.pets.map((pet, index) => (
                <div key={index} className="grid grid-cols-3 gap-4 mb-3">
                  <input
                    type="text"
                    placeholder="Pet ID"
                    value={pet.petId}
                    onChange={(e) => {
                      const newPets = [...formData.pets];
                      newPets[index].petId = e.target.value;
                      setFormData({ ...formData, pets: newPets });
                    }}
                    className="border border-gray-300 rounded-lg px-4 py-2"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Pet Name"
                    value={pet.petName}
                    onChange={(e) => {
                      const newPets = [...formData.pets];
                      newPets[index].petName = e.target.value;
                      setFormData({ ...formData, pets: newPets });
                    }}
                    className="border border-gray-300 rounded-lg px-4 py-2"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Breed"
                    value={pet.breed}
                    onChange={(e) => {
                      const newPets = [...formData.pets];
                      newPets[index].breed = e.target.value;
                      setFormData({ ...formData, pets: newPets });
                    }}
                    className="border border-gray-300 rounded-lg px-4 py-2"
                    required
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setFormData({ ...formData, pets: [...formData.pets, { petId: '', petName: '', breed: '' }] })}
                className="text-orange-500 hover:text-orange-600 text-sm"
              >
                + Add Another Pet
              </button>
            </div>

            <div>
              <label className="block text-gray-700 mb-2">Special Requests (Optional)</label>
              <textarea
                value={formData.specialRequests}
                onChange={(e) => setFormData({ ...formData, specialRequests: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2"
                rows={3}
              />
            </div>

            <div className="bg-orange-50 rounded-lg p-6">
              <h3 className="text-gray-900 mb-4">Pricing Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-gray-600">
                  <span>Base Price</span>
                  <span>₹{pkg.pricing.basePrice}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Pets ({formData.pets.length})</span>
                  <span>₹{formData.pets.length * pkg.pricing.pricePerPet}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Adults ({formData.adults})</span>
                  <span>₹{formData.adults * pkg.pricing.pricePerAdult}</span>
                </div>
                {formData.children > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Children ({formData.children})</span>
                    <span>₹{formData.children * pkg.pricing.pricePerChild}</span>
                  </div>
                )}
                <div className="border-t border-orange-200 pt-2 mt-2 flex justify-between text-gray-900">
                  <span>Total Amount</span>
                  <span className="text-xl">₹{calculateTotal()}</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={booking}
              className="w-full bg-orange-500 text-white py-3 rounded-lg hover:bg-orange-600 transition-colors disabled:bg-gray-400"
            >
              {booking ? 'Booking...' : 'Confirm Booking'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
