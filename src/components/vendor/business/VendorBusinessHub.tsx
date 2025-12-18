import { useState } from 'react';
import { InventoryManager } from '../../admin/inventory/InventoryManager';
import { VetSpecializedServicesManager } from '../clinic/VetSpecializedServicesManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Briefcase, TrendingUp, Package, Settings, ArrowLeft, Stethoscope, Ambulance, Microscope } from 'lucide-react';
import { Button } from '../../ui/button';

interface VendorBusinessHubProps {
  vendorId: string;
  vendorData?: any;
  onBack: () => void;
}

/**
 * Vendor Business Hub - Universal Management Interface
 * 
 * For Vets: Shows Pharmacy, Diagnostics, Ambulance services
 * For Others: Shows Inventory management
 */
export function VendorBusinessHub({ vendorId, vendorData, onBack }: VendorBusinessHubProps) {
  const isVet = vendorData?.roleId?.includes('vet') || vendorData?.serviceCategory === 'veterinary';
  const [activeTab, setActiveTab] = useState(isVet ? 'vet-services' : 'inventory');

  return (
    <div className="min-h-screen bg-[#FF8C42] gray-50">
      <div className="w-full max-w-[430px] mx-auto bg-[#FF8C42] white min-h-screen">
        {/* Header */}
        <div className="bg-[#FF8C42] gradient-to-r from-slate-900 to-slate-800 p-6 text-white shadow-lg">
          <div className="flex items-center gap-4 mb-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onBack} 
              className="text-white/70 hover:text-white hover:bg-[#FF8C42] white/10"
            >
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <div>
              <h2 className="text-xl font-bold">Business Hub</h2>
              <p className="text-white/70 text-sm">
                {isVet ? 'Manage vet services & equipment' : 'Manage inventory & store settings'}
              </p>
            </div>
          </div>
          
          {!isVet && (
            <div className="flex gap-4 text-xs text-white/60 border-t border-white/10 pt-4 mt-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-[#FF8C42] yellow-500 rounded-full"></div>
                5 Low Stock
              </div>
              <div className="flex items-center gap-2">
                <Package className="w-3 h-3" />
                48 Products
              </div>
            </div>
          )}
        </div>

        <div className="p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className={`bg-gray-100 p-1 rounded-xl w-full grid ${isVet ? 'grid-cols-2' : 'grid-cols-2'} h-auto`}>
              {/* For Vets: Show Specialized Services Tab */}
              {isVet && (
                <TabsTrigger 
                  value="vet-services"
                  className="flex items-center justify-center gap-2 py-2.5 data-[state=active]:bg-[#FF8C42] white data-[state=active]:shadow-sm rounded-lg transition-all"
                >
                  <Stethoscope className="w-4 h-4" />
                  Services
                </TabsTrigger>
              )}
              
              {/* For All: Show Inventory Tab */}
              <TabsTrigger 
                value="inventory"
                className="flex items-center justify-center gap-2 py-2.5 data-[state=active]:bg-[#FF8C42] white data-[state=active]:shadow-sm rounded-lg transition-all"
              >
                <Package className="w-4 h-4" />
                {isVet ? 'Pharmacy' : 'Inventory'}
              </TabsTrigger>
              
              <TabsTrigger 
                value="analytics"
                disabled
                className="flex items-center justify-center gap-2 py-2.5 opacity-50 cursor-not-allowed"
              >
                <TrendingUp className="w-4 h-4" />
                Analytics
              </TabsTrigger>
            </TabsList>

            {/* ✅ VET SPECIALIZED SERVICES TAB */}
            {isVet && (
              <TabsContent value="vet-services" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <VetSpecializedServicesManager
                  vendorId={vendorId}
                  vendorData={vendorData}
                  onBack={() => {}} // Empty since we're in a tab
                />
              </TabsContent>
            )}

            {/* INVENTORY TAB */}
            <TabsContent value="inventory" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="pb-20">
                {isVet && (
                  <div className="mb-4 p-4 bg-[#FF8C42] blue-50 border border-blue-200 rounded-lg">
                    <h3 className="font-semibold text-blue-900 mb-1">Pharmacy Inventory</h3>
                    <p className="text-sm text-blue-700">
                      Manage medicines, vaccines, and medical supplies
                    </p>
                  </div>
                )}
                <InventoryManager />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}