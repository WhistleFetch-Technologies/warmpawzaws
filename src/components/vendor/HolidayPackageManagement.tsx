import React, { useState, useEffect } from 'react';
import { Plus, Edit, MapPin } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { Button } from '../ui/button';

/**
 * 🏖️ HOLIDAY PACKAGE VENDOR MANAGEMENT
 * Phase 7B: Rule 13 - Create & manage holiday packages
 */

export default function HolidayPackageManagement({ vendorId }: { vendorId: string }) {
  const [packages, setPackages] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    packageName: '',
    description: '',
    destination: '',
    packageType: 'beach',
    days: '3',
    nights: '2',
    basePrice: '',
    pricePerPet: '',
    pricePerAdult: '',
    pricePerChild: '',
    inclusions: '',
    isGroupTour: false,
  });

  useEffect(() => {
    fetchPackages();
  }, [vendorId]);

  const fetchPackages = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/holiday-packages`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      const data = await response.json();
      if (data.success) setPackages(data.data.packages || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const createPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/holiday-packages/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            vendorId,
            packageName: form.packageName,
            description: form.description,
            destination: form.destination,
            packageType: form.packageType,
            duration: {
              days: parseInt(form.days),
              nights: parseInt(form.nights),
            },
            pricing: {
              basePrice: parseFloat(form.basePrice),
              pricePerPet: parseFloat(form.pricePerPet),
              pricePerAdult: parseFloat(form.pricePerAdult),
              pricePerChild: parseFloat(form.pricePerChild),
              currency: 'INR',
            },
            inclusions: form.inclusions.split('\n').filter((i) => i.trim()),
            exclusions: [],
            isGroupTour: form.isGroupTour,
            availableDates: [],
            itinerary: [],
            requirements: {},
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        alert('Package created!');
        setShowCreate(false);
        fetchPackages();
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-gray-900">Holiday Package Management</h1>
          <Button onClick={() => setShowCreate(true)}
            className="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create Package
          </Button>
        </div>

        {/* Packages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages.map((pkg) => (
            <div key={pkg.packageId} className="bg-white rounded-lg p-6 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-gray-900 mb-2">{pkg.packageName}</h3>
                  <div className="flex items-center gap-2 text-gray-600 text-sm">
                    <MapPin className="w-4 h-4" />
                    <span>{pkg.destination}</span>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${
                  pkg.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {pkg.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-gray-600 text-sm mb-4">{pkg.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-orange-600">From ₹{pkg.pricing.basePrice}</span>
                <span className="text-gray-600 text-sm">
                  {pkg.duration.days}D/{pkg.duration.nights}N
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Create Package Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-gray-900 mb-4">Create Holiday Package</h2>
              <form onSubmit={createPackage} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 mb-2">Package Name</label>
                    <input
                      type="text"
                      value={form.packageName}
                      onChange={(e) => setForm({ ...form, packageName: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Destination</label>
                    <input
                      type="text"
                      value={form.destination}
                      onChange={(e) => setForm({ ...form, destination: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    rows={3}
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-gray-700 mb-2">Type</label>
                    <select
                      value={form.packageType}
                      onChange={(e) => setForm({ ...form, packageType: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    >
                      <option value="beach">Beach</option>
                      <option value="mountain">Mountain</option>
                      <option value="city">City</option>
                      <option value="wildlife">Wildlife</option>
                      <option value="adventure">Adventure</option>
                      <option value="luxury">Luxury</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Days</label>
                    <input
                      type="number"
                      value={form.days}
                      onChange={(e) => setForm({ ...form, days: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Nights</label>
                    <input
                      type="number"
                      value={form.nights}
                      onChange={(e) => setForm({ ...form, nights: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 mb-2">Base Price (₹)</label>
                    <input
                      type="number"
                      value={form.basePrice}
                      onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Per Pet (₹)</label>
                    <input
                      type="number"
                      value={form.pricePerPet}
                      onChange={(e) => setForm({ ...form, pricePerPet: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Per Adult (₹)</label>
                    <input
                      type="number"
                      value={form.pricePerAdult}
                      onChange={(e) => setForm({ ...form, pricePerAdult: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Per Child (₹)</label>
                    <input
                      type="number"
                      value={form.pricePerChild}
                      onChange={(e) => setForm({ ...form, pricePerChild: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">Inclusions (one per line)</label>
                  <textarea
                    value={form.inclusions}
                    onChange={(e) => setForm({ ...form, inclusions: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    rows={4}
                    placeholder="Accommodation&#10;Meals&#10;Transportation"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.isGroupTour}
                    onChange={(e) => setForm({ ...form, isGroupTour: e.target.checked })}
                    className="rounded"
                  />
                  <label className="text-gray-700">Group Tour</label>
                </div>

                <div className="flex gap-3">
                  <Button type="submit" className="flex-1 bg-orange-500 text-white py-2 rounded-lg hover:bg-orange-600">
                    Create Package
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
