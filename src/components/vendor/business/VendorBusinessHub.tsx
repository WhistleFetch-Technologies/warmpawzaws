import { useState } from 'react';
import { InventoryManager } from '../../admin/inventory/InventoryManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Briefcase, TrendingUp, Package, Settings, ArrowLeft } from 'lucide-react';
import { Button } from '../../ui/button';

interface VendorBusinessHubProps {
  vendorId: string;
  onBack: () => void;
}

export function VendorBusinessHub({ vendorId, onBack }: VendorBusinessHubProps) {
  const [activeTab, setActiveTab] = useState('inventory');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[430px] mx-auto bg-white min-h-screen">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white shadow-lg">
          <div className="flex items-center gap-4 mb-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onBack} 
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <div>
              <h2 className="text-xl font-bold">Business Hub</h2>
              <p className="text-white/70 text-sm">Manage inventory & store settings</p>
            </div>
          </div>
          
          <div className="flex gap-4 text-xs text-white/60 border-t border-white/10 pt-4 mt-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              5 Low Stock
            </div>
            <div className="flex items-center gap-2">
              <Package className="w-3 h-3" />
              48 Products
            </div>
          </div>
        </div>

        <div className="p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-gray-100 p-1 rounded-xl w-full grid grid-cols-2 h-auto">
              <TabsTrigger 
                value="inventory"
                className="flex items-center justify-center gap-2 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg transition-all"
              >
                <Package className="w-4 h-4" />
                Inventory
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

            <TabsContent value="inventory" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Reuse the InventoryManager component but wrap it to fit mobile context if needed */}
              <div className="pb-20">
                <InventoryManager />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}