import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { TestTube, Home, Calendar, Clock, CheckCircle } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface DiagnosticsBookingProps {
  customerId: string;
  petId: string;
  onBack: () => void;
  onSuccess: (bookingId: string) => void;
}

export function DiagnosticsBooking({ customerId, petId, onBack, onSuccess }: DiagnosticsBookingProps) {
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [collectionType, setCollectionType] = useState<'home' | 'center'>('home');
  const [loading, setLoading] = useState(false);

  // Mock tests
  const tests = [
    { id: 't1', name: 'Complete Blood Count (CBC)', price: 800, tat: '24 hrs' },
    { id: 't2', name: 'Kidney Function Test (KFT)', price: 1200, tat: '24 hrs' },
    { id: 't3', name: 'Liver Function Test (LFT)', price: 1100, tat: '24 hrs' },
    { id: 't4', name: 'Thyroid Profile', price: 1500, tat: '48 hrs' },
  ];

  const toggleTest = (id: string) => {
    if (selectedTests.includes(id)) {
      setSelectedTests(selectedTests.filter(t => t !== id));
    } else {
      setSelectedTests([...selectedTests, id]);
    }
  };

  const handleBooking = async () => {
    if (selectedTests.length === 0) {
      toast.error("Please select at least one test");
      return;
    }

    try {
      setLoading(true);
      // Mock API call - in real app, replace with actual endpoint
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/integrated-services/diagnostics/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          customerId,
          petId,
          tests: selectedTests,
          collectionType
        })
      });

      if (response.ok) {
        toast.success("Diagnostics booked successfully!");
        onSuccess("diag_" + Date.now());
      } else {
        toast.error("Booking failed");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error booking diagnostics");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white p-4 border-b sticky top-0 z-10 flex items-center gap-3">
        <button onClick={onBack}><TestTube className="w-6 h-6 text-gray-600" /></button>
        <h1 className="text-lg font-bold text-gray-900">Book Lab Tests</h1>
      </div>

      <div className="p-4 flex-1 space-y-6">
        {/* Collection Type */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-semibold mb-3">Sample Collection</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setCollectionType('home')}
              className={`p-3 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${
                collectionType === 'home' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <Home className={`w-6 h-6 ${collectionType === 'home' ? 'text-blue-600' : 'text-gray-400'}`} />
              <span className={`text-sm font-medium ${collectionType === 'home' ? 'text-blue-700' : 'text-gray-600'}`}>Home Visit</span>
            </button>
            <button
              onClick={() => setCollectionType('center')}
              className={`p-3 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${
                collectionType === 'center' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <TestTube className={`w-6 h-6 ${collectionType === 'center' ? 'text-blue-600' : 'text-gray-400'}`} />
              <span className={`text-sm font-medium ${collectionType === 'center' ? 'text-blue-700' : 'text-gray-600'}`}>Visit Lab</span>
            </button>
          </div>
        </div>

        {/* Test Selection */}
        <div>
          <h3 className="font-semibold mb-3">Select Tests</h3>
          <div className="space-y-3">
            {tests.map(test => (
              <div 
                key={test.id}
                onClick={() => toggleTest(test.id)}
                className={`bg-white p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start justify-between ${
                  selectedTests.includes(test.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div>
                  <h4 className="font-medium text-gray-900">{test.name}</h4>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> TAT: {test.tat}</span>
                  </div>
                  <p className="font-bold text-gray-900 mt-2">₹{test.price}</p>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  selectedTests.includes(test.id) ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                }`}>
                  {selectedTests.includes(test.id) && <CheckCircle className="w-4 h-4 text-white" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t p-4 shadow-lg sticky bottom-0">
        <div className="flex justify-between items-center mb-3">
          <div>
            <p className="text-sm text-gray-500">{selectedTests.length} Tests Selected</p>
            <p className="text-xl font-bold text-gray-900">
              ₹{tests.filter(t => selectedTests.includes(t.id)).reduce((s, t) => s + t.price, 0) + (collectionType === 'home' ? 150 : 0)}
            </p>
            {collectionType === 'home' && <p className="text-xs text-blue-600">+₹150 Home Collection</p>}
          </div>
          <Button 
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 h-12"
            onClick={handleBooking}
            disabled={loading || selectedTests.length === 0}
          >
            {loading ? 'Booking...' : 'Book Tests'}
          </Button>
        </div>
      </div>
    </div>
  );
}
