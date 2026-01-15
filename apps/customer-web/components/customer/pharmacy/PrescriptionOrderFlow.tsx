'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

// 2D Sketch-style SVG Icons
const Icons = {
  pill: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  ),
  store: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <path d="M9 22V12h6v10" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  mapPin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M12 21s-8-7.5-8-12a8 8 0 1116 0c0 4.5-8 12-8 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  ),
  truck: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
  creditCard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  cash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M6 12h.01M18 12h.01" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  receipt: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2-3 2-3-2z" />
      <path d="M8 10h8M8 14h4" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
    </svg>
  ),
  arrowLeft: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  ),
};

// Types
interface Prescription {
  id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  vet_name?: string;
  prescription_date: string;
}

interface Pharmacy {
  id: string;
  name: string;
  distance: number;
  deliveryFee: number;
  eta: { minutes: number; rangeMin: number; rangeMax: number };
  rating?: number;
  orderCount?: number;
}

interface Invoice {
  items: Array<{ name: string; price: number; quantity: number }>;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  deliveryFee: number;
  total: number;
}

interface PrescriptionOrderFlowProps {
  prescriptionId: string;
  customerId: string;
  onBack: () => void;
}

type FlowStep = 'prescription' | 'searching' | 'confirmed' | 'invoice' | 'payment' | 'tracking';

export default function PrescriptionOrderFlow({ prescriptionId, customerId, onBack }: PrescriptionOrderFlowProps) {
  const [step, setStep] = useState<FlowStep>('prescription');
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [confirmedPharmacy, setConfirmedPharmacy] = useState<Pharmacy | null>(null);
  const [order, setOrder] = useState<any>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod'>('online');
  const [loading, setLoading] = useState(true);
  const [searchProgress, setSearchProgress] = useState(0);
  const [trackingStatus, setTrackingStatus] = useState<any>(null);

  // Fetch prescription details
  useEffect(() => {
    const fetchPrescription = async () => {
      try {
        const response = await apiClient.get(`/prescriptions/${prescriptionId}`);
        if (response && (response as any).success) {
          setPrescription((response as any).prescription);
        }
      } catch (error) {
        console.error('Error fetching prescription:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPrescription();
  }, [prescriptionId]);

  // Start order broadcast
  const handleOrderMedicine = async () => {
    setStep('searching');
    setSearchProgress(0);

    // Simulate search progress
    const progressInterval = setInterval(() => {
      setSearchProgress((prev) => Math.min(prev + 10, 90));
    }, 300);

    try {
      const response = await apiClient.post('/pharmacy/orders/from-prescription', {
        prescriptionId,
        customerId,
        customerLocation: {
          // In production, get from browser or stored address
          latitude: 28.6139,
          longitude: 77.2090,
        },
        deliveryAddress: {
          // In production, get from user profile or selection
          line1: 'Customer Address',
          city: 'Mumbai',
        },
      });

      clearInterval(progressInterval);
      setSearchProgress(100);

      if (response && (response as any).success) {
        setOrder((response as any).order);
        setPharmacies((response as any).pharmacies || []);

        // Simulate pharmacy confirmation (in production, wait for real response)
        setTimeout(() => {
          if ((response as any).pharmacies.length > 0) {
            setConfirmedPharmacy((response as any).pharmacies[0]);
            setStep('confirmed');
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Error creating order:', error);
      clearInterval(progressInterval);
    }
  };

  // Wait for invoice
  useEffect(() => {
    if (step !== 'confirmed' || !order) return;

    // Poll for order status (invoice)
    const checkInvoice = setInterval(async () => {
      try {
        const response = await apiClient.get(`/pharmacy/orders/${order.id}/track`);
        if (response && (response as any).order?.status === 'invoice_generated') {
          // Mock invoice for demo
          setInvoice({
            items: order.prescription?.medications?.map((m: any) => ({
              name: m.name,
              price: 120 + Math.floor(Math.random() * 100),
              quantity: 1,
            })) || [],
            subtotal: 350,
            taxRate: 5,
            taxAmount: 18,
            deliveryFee: confirmedPharmacy?.deliveryFee || 40,
            total: 408,
          });
          setStep('invoice');
          clearInterval(checkInvoice);
        }
      } catch (error) {
        console.error('Error checking invoice:', error);
      }
    }, 3000);

    // For demo, simulate invoice after 5 seconds
    const demoTimeout = setTimeout(() => {
      if (confirmedPharmacy) {
        setInvoice({
          items: [
            { name: 'Amoxicillin 500mg', price: 120, quantity: 10 },
            { name: 'Metronidazole 200mg', price: 85, quantity: 14 },
            { name: 'Probiotics', price: 180, quantity: 1 },
          ],
          subtotal: 385,
          taxRate: 5,
          taxAmount: 19,
          deliveryFee: confirmedPharmacy.deliveryFee,
          total: 385 + 19 + confirmedPharmacy.deliveryFee,
        });
        setStep('invoice');
      }
    }, 5000);

    return () => {
      clearInterval(checkInvoice);
      clearTimeout(demoTimeout);
    };
  }, [step, order, confirmedPharmacy]);

  // Process payment
  const handlePayment = async () => {
    try {
      const response = await apiClient.post(`/pharmacy/orders/${order.id}/payment`, {
        paymentMethod,
        paymentId: paymentMethod === 'online' ? 'pay_demo_123' : null,
      });

      if (response && (response as any).success) {
        setStep('tracking');
        // Start tracking
        setTrackingStatus({
          status: 'payment_confirmed',
          timeline: [
            { label: 'Order Placed', completed: true, time: new Date().toLocaleTimeString() },
            { label: 'Pharmacy Confirmed', completed: true },
            { label: 'Invoice Sent', completed: true },
            { label: 'Payment Confirmed', completed: true, current: true },
            { label: 'Preparing Order', completed: false },
            { label: 'Out for Delivery', completed: false },
            { label: 'Delivered', completed: false },
          ],
        });
      }
    } catch (error) {
      console.error('Error processing payment:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              {Icons.arrowLeft}
            </button>
            <h1 className="text-lg font-semibold text-slate-800">Order Medicine</h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Step 1: Prescription View */}
        {step === 'prescription' && prescription && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                    {Icons.receipt}
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-800">Prescription</h2>
                    <p className="text-sm text-slate-500">{prescription.vet_name || 'Your Veterinarian'}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 text-slate-700 mb-2">
                    {Icons.pill}
                    <span className="font-medium">{prescription.medication_name}</span>
                  </div>
                  <div className="text-sm text-slate-500 space-y-1">
                    <p>Dosage: {prescription.dosage}</p>
                    <p>Frequency: {prescription.frequency}</p>
                    <p>Duration: {prescription.duration}</p>
                  </div>
                </div>

                {prescription.instructions && (
                  <div className="text-sm text-slate-600">
                    <span className="font-medium">Instructions:</span>
                    <p className="mt-1">{prescription.instructions}</p>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleOrderMedicine}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {Icons.store}
              <span>Order Medicine</span>
            </button>
          </div>
        )}

        {/* Step 2: Searching Pharmacies */}
        {step === 'searching' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 relative">
              <div className="absolute inset-0 border-4 border-slate-100 rounded-full" />
              <div 
                className="absolute inset-0 border-4 border-emerald-500 rounded-full transition-all duration-300"
                style={{
                  clipPath: `polygon(0 0, 100% 0, 100% ${searchProgress}%, 0 ${searchProgress}%)`,
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-emerald-600">
                {Icons.search}
              </div>
            </div>

            <h2 className="text-lg font-semibold text-slate-800 mb-2">Finding Nearby Pharmacies</h2>
            <p className="text-slate-500 text-sm mb-6">Searching within 20 km radius...</p>

            {pharmacies.length > 0 && (
              <div className="text-left space-y-2">
                {pharmacies.slice(0, 3).map((pharmacy, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg animate-pulse">
                    <div className="w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center">
                      {Icons.store}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700">{pharmacy.name}</p>
                      <p className="text-xs text-slate-400">{pharmacy.distance} km • Checking...</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Pharmacy Confirmed */}
        {step === 'confirmed' && confirmedPharmacy && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
              {Icons.check}
            </div>

            <h2 className="text-lg font-semibold text-slate-800 mb-1">Pharmacy Confirmed!</h2>
            <p className="text-slate-500 text-sm mb-6">Your order has been accepted</p>

            <div className="bg-slate-50 rounded-xl p-4 text-left mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                  {Icons.store}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{confirmedPharmacy.name}</p>
                  <div className="flex items-center gap-1 text-amber-500">
                    {Icons.star}
                    <span className="text-sm text-slate-600">{confirmedPharmacy.rating || 4.8}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-1">{Icons.mapPin} {confirmedPharmacy.distance} km</span>
                <span className="flex items-center gap-1">{Icons.clock} {confirmedPharmacy.eta.rangeMin}-{confirmedPharmacy.eta.rangeMax} min</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-slate-500">
              <div className="w-5 h-5 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
              <span className="text-sm">Calculating your invoice...</span>
            </div>
          </div>
        )}

        {/* Step 4: Invoice & Payment Selection */}
        {step === 'invoice' && invoice && confirmedPharmacy && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                  {Icons.receipt}
                  Your Invoice
                </h2>
                <p className="text-sm text-slate-500">{confirmedPharmacy.name}</p>
              </div>

              <div className="p-4 space-y-3">
                {invoice.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between py-2 border-b border-slate-100 last:border-0">
                    <div>
                      <p className="text-slate-700">{item.name}</p>
                      <p className="text-xs text-slate-400">Qty: {item.quantity}</p>
                    </div>
                    <span className="font-medium text-slate-800">₹{item.price}</span>
                  </div>
                ))}

                <div className="pt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="text-slate-700">₹{invoice.subtotal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tax ({invoice.taxRate}%)</span>
                    <span className="text-slate-700">₹{invoice.taxAmount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Delivery</span>
                    <span className="text-slate-700">₹{invoice.deliveryFee}</span>
                  </div>
                  <div className="flex justify-between pt-3 border-t border-slate-100 text-lg font-semibold">
                    <span className="text-slate-800">Total</span>
                    <span className="text-slate-800">₹{invoice.total}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ETA */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                {Icons.truck}
              </div>
              <div>
                <p className="font-medium text-slate-800">Estimated Delivery</p>
                <p className="text-sm text-slate-500">{confirmedPharmacy.eta.rangeMin}-{confirmedPharmacy.eta.rangeMax} minutes</p>
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <h3 className="font-medium text-slate-800 mb-4">Choose Payment Method</h3>
              <div className="space-y-3">
                <button
                  onClick={() => setPaymentMethod('online')}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    paymentMethod === 'online'
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    paymentMethod === 'online' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {Icons.creditCard}
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-slate-800">Pay Now</p>
                    <p className="text-sm text-slate-500">UPI / Card / Netbanking</p>
                  </div>
                  {paymentMethod === 'online' && (
                    <div className="ml-auto text-emerald-600">{Icons.check}</div>
                  )}
                </button>

                <button
                  onClick={() => setPaymentMethod('cod')}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    paymentMethod === 'cod'
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    paymentMethod === 'cod' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {Icons.cash}
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-slate-800">Cash on Delivery</p>
                    <p className="text-sm text-slate-500">Pay when order arrives</p>
                  </div>
                  {paymentMethod === 'cod' && (
                    <div className="ml-auto text-emerald-600">{Icons.check}</div>
                  )}
                </button>
              </div>
            </div>

            <button
              onClick={handlePayment}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors"
            >
              {paymentMethod === 'online' ? `Pay ₹${invoice.total}` : 'Confirm Order'}
            </button>
          </div>
        )}

        {/* Step 5: Order Tracking */}
        {step === 'tracking' && trackingStatus && confirmedPharmacy && (
          <div className="space-y-6">
            {/* Live Map Placeholder */}
            <div className="bg-slate-100 rounded-2xl h-48 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-300 animate-pulse" />
              <div className="relative z-10 text-center">
                <div className="flex items-center justify-center gap-8 text-slate-400 mb-2">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow">
                      {Icons.store}
                    </div>
                    <span className="text-xs mt-1">Pharmacy</span>
                  </div>
                  <div className="flex-1 border-t-2 border-dashed border-slate-300 relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white shadow-lg animate-bounce">
                      {Icons.truck}
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow text-emerald-600">
                      {Icons.mapPin}
                    </div>
                    <span className="text-xs mt-1">You</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Status */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold text-slate-800">{order?.orderNumber || 'Order'}</p>
                  <p className="text-sm text-slate-500">{confirmedPharmacy.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-emerald-600">₹{invoice?.total}</p>
                  <p className="text-xs text-slate-400">{paymentMethod === 'cod' ? 'COD' : 'Paid'}</p>
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-4">
                {trackingStatus.timeline.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                      item.completed
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-100 text-slate-400 border-2 border-slate-200'
                    }`}>
                      {item.completed ? Icons.check : idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${item.current ? 'text-emerald-600' : 'text-slate-700'}`}>
                        {item.label}
                      </p>
                      {item.time && <p className="text-xs text-slate-400">{item.time}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact Buttons */}
            <div className="flex gap-3">
              <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors">
                {Icons.phone}
                <span className="text-sm font-medium">Call Pharmacy</span>
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors">
                {Icons.phone}
                <span className="text-sm font-medium">Call Delivery</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
