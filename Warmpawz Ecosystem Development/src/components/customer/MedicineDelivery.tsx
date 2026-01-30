import { useState } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { ArrowLeft, Pill, Upload, Check, Package, Truck, MapPin } from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';
import { toast } from 'sonner@2.0.3';

interface MedicineDeliveryProps {
  onBack: () => void;
  customerId: string;
  petProfiles: any[];
}

export function MedicineDelivery({ onBack, customerId, petProfiles }: MedicineDeliveryProps) {
  const [step, setStep] = useState<'pets' | 'upload' | 'verification' | 'confirm' | 'tracking'>('pets');
  const [selectedPet, setSelectedPet] = useState<any>(null);
  const [prescriptionUploaded, setPrescriptionUploaded] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('123 Pet Street, Koramangala, Bangalore');
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<any>(null);

  const createMedicineOrder = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${getApiBaseUrl()}/vet/medicine-order`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: (getAuthHeaders().Authorization || "") },
          body: JSON.stringify({
            customerId,
            petId: selectedPet.id,
            prescriptionUrl: 'https://example.com/prescription.pdf',
            deliveryAddress,
            medicines: [
              { name: 'Amoxicillin', quantity: 2 },
              { name: 'Vitamin Supplement', quantity: 1 }
            ]
          })
        }
      );
      if (response.ok) {
        const data = await response.json();
        setOrder(data.order);
        toast.success('Order placed! Awaiting pharmacy verification');
        setStep('verification');
      }
    } catch (error) {
      console.error('Error creating medicine order:', error);
      toast.error('Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'pets') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
        <div className="px-6 pt-3 pb-2 flex justify-between items-center text-black bg-white">
          <span>09:41</span>
          <div className="flex gap-1 items-center">
            <div className="w-4 h-3 bg-black/30"></div>
            <div className="w-4 h-3 bg-black/30"></div>
            <div className="w-6 h-3 bg-black/30"></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 px-6 pt-4 pb-8">
          <div className="flex items-center mb-6">
            <button onClick={onBack} className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-white flex-1 ml-4">Medicine Delivery</h1>
          </div>
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Pill className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white">Order Medicines</h3>
                <p className="text-white/80 text-sm">Free delivery on orders above ₹499</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex-1 -mt-4 bg-white rounded-t-[32px] px-6 pt-6 pb-24">
          <h2 className="mb-4">Select Pet Profile</h2>
          <div className="space-y-3">
            {petProfiles.map((pet: any) => (
              <button key={pet.id} onClick={() => { setSelectedPet(pet); setStep('upload'); }} className="w-full">
                <Card className="p-4 border-gray-200 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center text-2xl">
                      {pet.icon}
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="mb-1">{pet.name}</h3>
                      <p className="text-sm text-gray-500">{pet.breed} • {pet.age}</p>
                    </div>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white flex justify-center pb-2 max-w-md mx-auto">
          <div className="w-32 h-1 bg-black rounded-full"></div>
        </div>
      </div>
    );
  }

  if (step === 'upload') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
        <div className="px-6 pt-3 pb-2 flex justify-between items-center text-black bg-white">
          <span>09:41</span>
          <div className="flex gap-1 items-center">
            <div className="w-4 h-3 bg-black/30"></div>
            <div className="w-4 h-3 bg-black/30"></div>
            <div className="w-6 h-3 bg-black/30"></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 px-6 pt-4 pb-8">
          <div className="flex items-center mb-6">
            <button onClick={() => setStep('pets')} className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-white flex-1 ml-4">Upload Prescription</h1>
          </div>
        </div>

        <div className="flex-1 -mt-4 bg-white rounded-t-[32px] px-6 pt-6 pb-24 overflow-y-auto">
          <Card className="p-6 border-2 border-dashed border-gray-300 text-center mb-6">
            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="mb-2">Upload Prescription</h3>
            <p className="text-sm text-gray-500 mb-4">Upload a clear photo or PDF of the prescription</p>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={() => {
                setPrescriptionUploaded(true);
                toast.success('Prescription uploaded!');
              }}
              className="hidden"
              id="prescription-upload"
            />
            <label htmlFor="prescription-upload">
              <Button className="bg-red-600 hover:bg-red-700" asChild>
                <span>Choose File</span>
              </Button>
            </label>
          </Card>

          {prescriptionUploaded && (
            <Card className="p-4 border-gray-200 bg-green-50 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                  <Check className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm mb-1">Prescription Uploaded</h4>
                  <p className="text-xs text-gray-500">prescription.pdf</p>
                </div>
              </div>
            </Card>
          )}

          <div className="mb-6">
            <label className="block mb-2">Delivery Address</label>
            <Input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} />
          </div>

          <Button
            onClick={() => setStep('confirm')}
            disabled={!prescriptionUploaded}
            className="w-full bg-red-600 hover:bg-red-700"
          >
            Continue
          </Button>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white flex justify-center pb-2 max-w-md mx-auto">
          <div className="w-32 h-1 bg-black rounded-full"></div>
        </div>
      </div>
    );
  }

  if (step === 'confirm') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
        <div className="px-6 pt-3 pb-2 flex justify-between items-center text-black bg-white">
          <span>09:41</span>
          <div className="flex gap-1 items-center">
            <div className="w-4 h-3 bg-black/30"></div>
            <div className="w-4 h-3 bg-black/30"></div>
            <div className="w-6 h-3 bg-black/30"></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 px-6 pt-4 pb-8">
          <div className="flex items-center mb-6">
            <button onClick={() => setStep('upload')} className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-white flex-1 ml-4">Confirm Order</h1>
          </div>
        </div>

        <div className="flex-1 -mt-4 bg-white rounded-t-[32px] px-6 pt-6 pb-24 overflow-y-auto">
          <Card className="p-4 border-2 border-blue-200 bg-blue-50 mb-6">
            <div className="flex items-start gap-3">
              <div className="text-2xl">ℹ️</div>
              <div>
                <h4 className="text-sm mb-1">Pharmacy Verification Required</h4>
                <p className="text-xs text-gray-600">
                  Our pharmacy will verify your prescription and confirm the availability and final charges within 30 minutes.
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 border-gray-200 mb-6">
            <h3 className="mb-3">Order Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Pet</span>
                <span>{selectedPet.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Prescription</span>
                <span className="text-green-600">Uploaded ✓</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Delivery Address</span>
                <span className="text-xs text-right max-w-[200px]">{deliveryAddress}</span>
              </div>
            </div>
          </Card>

          <Button onClick={createMedicineOrder} disabled={loading} className="w-full bg-red-600 hover:bg-red-700">
            {loading ? 'Placing Order...' : 'Place Order'}
          </Button>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white flex justify-center pb-2 max-w-md mx-auto">
          <div className="w-32 h-1 bg-black rounded-full"></div>
        </div>
      </div>
    );
  }

  if (step === 'verification') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
        <div className="px-6 pt-3 pb-2 flex justify-between items-center text-black bg-white">
          <span>09:41</span>
          <div className="flex gap-1 items-center">
            <div className="w-4 h-3 bg-black/30"></div>
            <div className="w-4 h-3 bg-black/30"></div>
            <div className="w-6 h-3 bg-black/30"></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 px-6 pt-4 pb-8">
          <div className="flex items-center mb-6">
            <button onClick={onBack} className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-white flex-1 ml-4">Order Status</h1>
          </div>
        </div>

        <div className="flex-1 -mt-4 bg-white rounded-t-[32px] px-6 pt-6 pb-24 overflow-y-auto">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Package className="w-10 h-10 text-yellow-600" />
            </div>
            <h2 className="mb-2">Verifying Prescription</h2>
            <p className="text-gray-500">Pharmacy is checking medicine availability</p>
          </div>

          <Card className="p-4 border-gray-200 mb-6">
            <h3 className="mb-4">Order Timeline</h3>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm mb-1">Order Placed</h4>
                  <p className="text-xs text-gray-500">Just now</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm mb-1">Verification in Progress</h4>
                  <p className="text-xs text-gray-500">Est. 30 minutes</p>
                </div>
              </div>

              <div className="flex gap-3 opacity-50">
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm mb-1">Payment</h4>
                  <p className="text-xs text-gray-500">Pending</p>
                </div>
              </div>

              <div className="flex gap-3 opacity-50">
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                  <Truck className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm mb-1">Shipped</h4>
                  <p className="text-xs text-gray-500">Pending</p>
                </div>
              </div>
            </div>
          </Card>

          <Button onClick={() => setStep('tracking')} className="w-full bg-red-600 hover:bg-red-700">
            Track Delivery (Demo)
          </Button>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white flex justify-center pb-2 max-w-md mx-auto">
          <div className="w-32 h-1 bg-black rounded-full"></div>
        </div>
      </div>
    );
  }

  if (step === 'tracking') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
        <div className="px-6 pt-3 pb-2 flex justify-between items-center text-black bg-white">
          <span>09:41</span>
          <div className="flex gap-1 items-center">
            <div className="w-4 h-3 bg-black/30"></div>
            <div className="w-4 h-3 bg-black/30"></div>
            <div className="w-6 h-3 bg-black/30"></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 px-6 pt-4 pb-8">
          <div className="flex items-center mb-6">
            <button onClick={() => setStep('verification')} className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-white flex-1 ml-4">Track Delivery</h1>
          </div>
        </div>

        <div className="flex-1 -mt-4 bg-white rounded-t-[32px] px-6 pt-6 pb-24 overflow-y-auto">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Truck className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="mb-2">Out for Delivery</h2>
            <p className="text-gray-500">Expected delivery by 6:00 PM today</p>
          </div>

          <Card className="p-4 border-gray-200 mb-6">
            <h3 className="mb-3">Order Details</h3>
            <div className="space-y-3">
              <div className="p-3 bg-red-50 rounded-xl">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-sm">Amoxicillin 250mg</h4>
                  <span className="text-sm">₹180</span>
                </div>
                <p className="text-xs text-gray-500">Quantity: 2 strips</p>
              </div>

              <div className="p-3 bg-red-50 rounded-xl">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-sm">Vitamin Supplement</h4>
                  <span className="text-sm">₹320</span>
                </div>
                <p className="text-xs text-gray-500">Quantity: 1 bottle</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t flex justify-between items-center">
              <span>Total Amount</span>
              <span className="text-2xl text-red-600">₹500</span>
            </div>
          </Card>

          <Card className="p-4 border-gray-200 mb-6">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm mb-1">Delivery Address</h4>
                <p className="text-xs text-gray-600">{deliveryAddress}</p>
              </div>
            </div>
          </Card>

          <Button onClick={onBack} className="w-full bg-red-600 hover:bg-red-700">
            Back to Home
          </Button>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white flex justify-center pb-2 max-w-md mx-auto">
          <div className="w-32 h-1 bg-black rounded-full"></div>
        </div>
      </div>
    );
  }

  return null;
}
