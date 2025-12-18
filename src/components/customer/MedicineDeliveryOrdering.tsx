import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Upload, Pill, FileText, CheckCircle, Search, Plus, Minus, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface MedicineDeliveryProps {
  customerId: string;
  petId?: string;
  onBack: () => void;
  onSuccess: (orderId: string) => void;
}

export function MedicineDeliveryOrdering({ customerId, petId, onBack, onSuccess }: MedicineDeliveryProps) {
  const [mode, setMode] = useState<'prescription' | 'search'>('prescription');
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [orderProcessing, setOrderProcessing] = useState(false);

  // Mock medicines
  const medicines = [
      { id: '1', name: 'Apoquel 16mg', type: 'Tablet', price: 120, prescriptionRequired: true },
      { id: '2', name: 'NexGard Spectra', type: 'Chewable', price: 450, prescriptionRequired: false },
      { id: '3', name: 'Bravecto', type: 'Tablet', price: 890, prescriptionRequired: false },
      { id: '4', name: 'Cani-V-4', type: 'Supplement', price: 350, prescriptionRequired: false },
  ];

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setPrescriptionFile(file);
          // Simulate upload or call upload endpoint
      }
  };

  const addToCart = (med: any) => {
      const existing = cart.find(i => i.id === med.id);
      if (existing) {
          setCart(cart.map(i => i.id === med.id ? { ...i, qty: i.qty + 1 } : i));
      } else {
          setCart([...cart, { ...med, qty: 1 }]);
      }
  };

  const removeFromCart = (id: string) => {
      const existing = cart.find(i => i.id === id);
      if (existing.qty > 1) {
          setCart(cart.map(i => i.id === id ? { ...i, qty: i.qty - 1 } : i));
      } else {
          setCart(cart.filter(i => i.id !== id));
      }
  };

  const placeOrder = async () => {
      if (cart.length === 0 && !prescriptionFile) {
          toast.error("Please add medicines or upload a prescription");
          return;
      }

      setOrderProcessing(true);
      try {
          // 1. Upload prescription if exists
          let prescriptionUrl = null;
          if (prescriptionFile) {
              // Mock upload
              prescriptionUrl = "https://mock.url/prescription.jpg";
          }

          // 2. Create Order
          const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/integrated-services/medicine/order`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${publicAnonKey}`
              },
              body: JSON.stringify({
                  customerId,
                  petId,
                  items: cart,
                  prescriptionUrl,
                  deliveryType: 'standard' // or express
              })
          });

          if (response.ok) {
              const data = await response.json();
              toast.success("Order placed successfully!");
              onSuccess(data.orderId);
          } else {
              toast.error("Failed to place order");
          }
      } catch (e) {
          console.error(e);
          toast.error("Error placing order");
      } finally {
          setOrderProcessing(false);
      }
  };

  return (
    <div className="min-h-screen bg-[#FF8C42] gray-50 flex flex-col">
      <div className="bg-[#FF8C42] white p-4 border-b sticky top-0 z-10 flex items-center gap-3">
        <button onClick={onBack}><Pill className="w-6 h-6 text-gray-600" /></button>
        <h1 className="text-lg font-bold text-gray-900">Pet Pharmacy</h1>
      </div>

      <div className="p-4 flex-1 space-y-6">
          {/* Quick Action: Upload Prescription */}
          <div className="bg-[#FF8C42] blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex gap-3">
                  <FileText className="w-10 h-10 text-blue-600" />
                  <div className="flex-1">
                      <h3 className="font-bold text-blue-900">Have a Prescription?</h3>
                      <p className="text-sm text-blue-700 mb-3">Upload your vet's prescription and we'll fulfill it for you.</p>
                      
                      <div className="relative">
                          <input type="file" id="rx-upload" className="hidden" onChange={handleUpload} accept="image/*,.pdf" />
                          <Button 
                            variant="outline" 
                            className="w-full bg-white border-blue-300 text-blue-700 hover:bg-[#FF8C42] blue-50"
                            onClick={() => document.getElementById('rx-upload')?.click()}
                          >
                              {prescriptionFile ? (
                                  <><CheckCircle className="w-4 h-4 mr-2 text-green-500" /> {prescriptionFile.name}</>
                              ) : (
                                  <><Upload className="w-4 h-4 mr-2" /> Upload Prescription</>
                              )}
                          </Button>
                      </div>
                  </div>
              </div>
          </div>

          {/* Search & Catalog */}
          <div>
              <div className="relative mb-4">
                  <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Search for medicines..." 
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
              </div>

              <h3 className="font-bold text-gray-900 mb-3">Popular Medicines</h3>
              <div className="space-y-3">
                  {medicines.map(med => {
                      const inCart = cart.find(i => i.id === med.id);
                      return (
                          <div key={med.id} className="bg-[#FF8C42] white p-3 rounded-xl border border-gray-100 flex items-center justify-between shadow-sm">
                              <div>
                                  <h4 className="font-semibold text-gray-900">{med.name}</h4>
                                  <div className="flex items-center gap-2 mt-1">
                                      <span className="text-xs bg-[#FF8C42] gray-100 px-2 py-0.5 rounded text-gray-600">{med.type}</span>
                                      {med.prescriptionRequired && <span className="text-xs bg-[#FF8C42] red-100 text-red-600 px-2 py-0.5 rounded">Rx Required</span>}
                                  </div>
                                  <p className="text-sm font-bold text-gray-900 mt-1">₹{med.price}</p>
                              </div>
                              
                              {inCart ? (
                                  <div className="flex items-center gap-3 bg-[#FF8C42] blue-50 px-2 py-1 rounded-lg">
                                      <button onClick={() => removeFromCart(med.id)} className="w-6 h-6 flex items-center justify-center text-blue-600 font-bold">-</button>
                                      <span className="font-semibold text-blue-900">{inCart.qty}</span>
                                      <button onClick={() => addToCart(med)} className="w-6 h-6 flex items-center justify-center text-blue-600 font-bold">+</button>
                                  </div>
                              ) : (
                                  <Button size="sm" className="bg-blue-600 hover:bg-[#FF8C42] blue-700 h-8" onClick={() => addToCart(med)}>
                                      ADD
                                  </Button>
                              )}
                          </div>
                      );
                  })}
              </div>
          </div>
      </div>

      {/* Cart Footer */}
      {(cart.length > 0 || prescriptionFile) && (
          <div className="bg-[#FF8C42] white border-t p-4 shadow-lg sticky bottom-0">
              <div className="flex justify-between items-center mb-3">
                  <div>
                      <p className="text-sm text-gray-500">{cart.length} Items</p>
                      <p className="text-xl font-bold text-gray-900">₹{cart.reduce((sum, i) => sum + (i.price * i.qty), 0)}</p>
                  </div>
                  <Button 
                    className="bg-blue-600 hover:bg-[#FF8C42] blue-700 text-white px-8 h-12 text-lg"
                    onClick={placeOrder}
                    disabled={orderProcessing}
                  >
                      {orderProcessing ? 'Processing...' : (
                          <span className="flex items-center gap-2">Checkout <ShoppingCart className="w-5 h-5" /></span>
                      )}
                  </Button>
              </div>
          </div>
      )}
    </div>
  );
}
