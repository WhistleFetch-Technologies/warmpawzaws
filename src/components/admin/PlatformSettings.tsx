import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { CloudIntegrations } from './integrations/CloudIntegrations';
import { PaymentSettings } from './integrations/PaymentSettings';
import { LogisticsSettings } from './integrations/LogisticsSettings';
import { CreditCard, Truck, Cloud, ArrowLeft, Settings } from 'lucide-react';

interface PlatformSettingsProps {
  onBack?: () => void;
}

export function PlatformSettings({ onBack }: PlatformSettingsProps) {
  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* Header Section */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto max-w-6xl px-6 py-4">
          <div className="flex items-center gap-4">
            {onBack && (
              <Button variant="ghost" size="icon" onClick={onBack} className="-ml-2 hover:bg-orange-50 hover:text-orange-600">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Settings className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Platform Settings</h1>
                <p className="text-sm text-slate-500">Manage global configurations, integrations, and service partners.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto max-w-6xl px-6 py-8">
        <Tabs defaultValue="cloud" className="space-y-8">
          <TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-white border rounded-xl shadow-sm">
            <TabsTrigger 
              value="cloud" 
              className="flex flex-col md:flex-row items-center gap-3 py-3 md:py-4 px-4 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 data-[state=active]:border-orange-200 border border-transparent rounded-lg transition-all"
            >
              <div className="p-2 bg-slate-100 rounded-md group-data-[state=active]:bg-white">
                <Cloud className="w-5 h-5 text-slate-600 group-data-[state=active]:text-orange-600" />
              </div>
              <div className="text-center md:text-left">
                <div className="font-semibold text-slate-900 group-data-[state=active]:text-orange-900">Cloud & Maps</div>
                <div className="text-xs text-slate-500 hidden md:block mt-0.5">AWS S3, SQS, Google Maps</div>
              </div>
            </TabsTrigger>
            
            <TabsTrigger 
              value="payments" 
              className="flex flex-col md:flex-row items-center gap-3 py-3 md:py-4 px-4 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 data-[state=active]:border-orange-200 border border-transparent rounded-lg transition-all"
            >
              <div className="p-2 bg-slate-100 rounded-md group-data-[state=active]:bg-white">
                <CreditCard className="w-5 h-5 text-slate-600 group-data-[state=active]:text-orange-600" />
              </div>
              <div className="text-center md:text-left">
                <div className="font-semibold text-slate-900 group-data-[state=active]:text-orange-900">Payments & Payouts</div>
                <div className="text-xs text-slate-500 hidden md:block mt-0.5">Gateways, Commissions, Tax</div>
              </div>
            </TabsTrigger>
            
            <TabsTrigger 
              value="logistics" 
              className="flex flex-col md:flex-row items-center gap-3 py-3 md:py-4 px-4 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 data-[state=active]:border-orange-200 border border-transparent rounded-lg transition-all"
            >
               <div className="p-2 bg-slate-100 rounded-md group-data-[state=active]:bg-white">
                <Truck className="w-5 h-5 text-slate-600 group-data-[state=active]:text-orange-600" />
              </div>
              <div className="text-center md:text-left">
                <div className="font-semibold text-slate-900 group-data-[state=active]:text-orange-900">Logistics Network</div>
                <div className="text-xs text-slate-500 hidden md:block mt-0.5">Partners, Territories, Fleet</div>
              </div>
            </TabsTrigger>
          </TabsList>

          <div className="min-h-[500px]">
            <TabsContent value="cloud" className="m-0 focus-visible:ring-0 outline-none">
              <CloudIntegrations />
            </TabsContent>
            
            <TabsContent value="payments" className="m-0 focus-visible:ring-0 outline-none">
              <PaymentSettings />
            </TabsContent>
            
            <TabsContent value="logistics" className="m-0 focus-visible:ring-0 outline-none">
              <LogisticsSettings />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
