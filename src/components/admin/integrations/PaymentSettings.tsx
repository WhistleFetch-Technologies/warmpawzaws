import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../ui/card';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Button } from '../../ui/button';
import { Switch } from '../../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { useAdminIntegrations } from '../../../hooks/useAdminIntegrations';
import { CreditCard, Settings, Trash2, Plus, Banknote, ShieldCheck, Lock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../ui/dialog';
import { Badge } from '../../ui/badge';
import { Separator } from '../../ui/separator';

export function PaymentSettings() {
  const { fetchGateways, saveGateway, deleteGateway, fetchPayoutRules, savePayoutRules, loading } = useAdminIntegrations();
  const [gateways, setGateways] = useState<any[]>([]);
  const [rules, setRules] = useState<any>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentGateway, setCurrentGateway] = useState<any>({ id: '', name: '', type: 'stripe', enabled: true, apiKey: '', secretKey: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const gData = await fetchGateways();
    if (gData.success) setGateways(gData.gateways);
    
    const rData = await fetchPayoutRules();
    if (rData.success) setRules(rData.rules);
  };

  const handleSaveGateway = async () => {
    await saveGateway(currentGateway);
    setIsModalOpen(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this gateway?')) {
      await deleteGateway(id);
      loadData();
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* LEFT: PAYOUT RULES */}
        <Card className="md:col-span-1 h-fit border-l-4 border-l-green-500 shadow-sm">
          <CardHeader className="pb-4 bg-slate-50/50 border-b">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <Banknote className="h-5 w-5 text-green-700" />
              </div>
              <CardTitle className="text-lg">Financial Rules</CardTitle>
            </div>
            <CardDescription>Global commission & tax settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
             <div className="space-y-4">
               <div className="space-y-2">
                  <Label className="flex justify-between">
                    Platform Commission
                    <span className="text-xs text-muted-foreground bg-slate-100 px-1.5 py-0.5 rounded">Per Transaction</span>
                  </Label>
                  <div className="relative">
                    <Input 
                      type="number" 
                      value={rules.defaultCommission || 0} 
                      onChange={e => setRules({...rules, defaultCommission: parseFloat(e.target.value)})} 
                      className="pr-8 font-medium"
                    />
                    <div className="absolute right-3 top-2.5 text-slate-400 text-sm font-bold">%</div>
                  </div>
               </div>

               <div className="space-y-2">
                  <Label>Payout Hold Period</Label>
                  <div className="relative">
                    <Input 
                      type="number" 
                      value={rules.holdPeriodDays || 7} 
                      onChange={e => setRules({...rules, holdPeriodDays: parseInt(e.target.value)})} 
                      className="pr-12 font-medium"
                    />
                     <div className="absolute right-3 top-2.5 text-slate-400 text-sm">Days</div>
                  </div>
               </div>

               <div className="space-y-2">
                  <Label>GST / Tax Rate</Label>
                  <div className="relative">
                    <Input 
                      type="number" 
                      value={rules.taxRate || 18} 
                      onChange={e => setRules({...rules, taxRate: parseFloat(e.target.value)})} 
                      className="pr-8 font-medium"
                    />
                     <div className="absolute right-3 top-2.5 text-slate-400 text-sm font-bold">%</div>
                  </div>
               </div>
             </div>
             
             <Separator />
             
             <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border">
                <div className="space-y-0.5">
                  <Label className="text-base text-slate-900">Auto Payouts</Label>
                  <p className="text-xs text-muted-foreground">Process automatically</p>
                </div>
                <Switch 
                  checked={rules.autoPayout} 
                  onCheckedChange={(c) => setRules({...rules, autoPayout: c})} 
                />
             </div>

             <Button onClick={() => savePayoutRules(rules)} disabled={loading} className="w-full" variant="outline">
               Save Rules
             </Button>
          </CardContent>
        </Card>

        {/* RIGHT: GATEWAYS LIST */}
        <div className="md:col-span-2 space-y-6">
           <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Payment Gateways</h3>
                <p className="text-sm text-slate-500">Manage connected payment providers and processors.</p>
              </div>
              <Button onClick={() => {
                setCurrentGateway({ id: '', name: '', type: 'stripe', enabled: true, apiKey: '', secretKey: '' });
                setIsModalOpen(true);
              }} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" /> Add Gateway
              </Button>
           </div>

           <div className="grid gap-4">
              {gateways.map((g) => (
                <Card key={g.id} className="group hover:shadow-md transition-all duration-200 border-l-4 border-l-transparent hover:border-l-blue-500">
                  <CardContent className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${g.enabled ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                        <CreditCard className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-lg text-slate-900">{g.name}</h4>
                          <Badge variant={g.enabled ? 'default' : 'secondary'} className={g.enabled ? "bg-blue-600 hover:bg-blue-700" : ""}>
                            {g.enabled ? 'Active' : 'Disabled'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                          <span className="uppercase font-medium tracking-wide text-xs">{g.type}</span>
                          <span className="text-slate-300">•</span>
                          <span className="font-mono text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">ID: {g.id}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                       <Button variant="ghost" size="sm" onClick={() => { setCurrentGateway(g); setIsModalOpen(true); }} className="hover:bg-slate-100">
                        <Settings className="w-4 h-4 mr-2" /> Configure
                       </Button>
                       <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(g.id)}>
                        <Trash2 className="w-4 h-4" />
                       </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {gateways.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-slate-400">
                  <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                    <ShieldCheck className="w-8 h-8 text-slate-300" />
                  </div>
                  <h3 className="font-semibold text-slate-900 text-lg">No Payment Gateways</h3>
                  <p className="text-sm text-slate-500 mb-6 max-w-sm text-center">Connect Stripe, Razorpay or PayPal to start accepting secure payments from customers.</p>
                  <Button variant="outline" onClick={() => {
                    setCurrentGateway({ id: '', name: '', type: 'stripe', enabled: true, apiKey: '', secretKey: '' });
                    setIsModalOpen(true);
                  }}>Configure First Gateway</Button>
                </div>
              )}
           </div>
        </div>
      </div>

      {/* EDIT MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b bg-slate-50/50">
            <DialogTitle className="flex items-center gap-2 text-xl">
               <div className="p-2 bg-blue-100 rounded-lg">
                 <ShieldCheck className="w-5 h-5 text-blue-600" />
               </div>
               {currentGateway.id ? 'Edit Gateway' : 'Connect Gateway'}
            </DialogTitle>
            <DialogDescription className="ml-11">
              Configure secure payment processing credentials.
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select value={currentGateway.type} onValueChange={v => setCurrentGateway({...currentGateway, type: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stripe">Stripe</SelectItem>
                      <SelectItem value="razorpay">Razorpay</SelectItem>
                      <SelectItem value="paypal">PayPal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                 <div className="space-y-2">
                  <Label>Unique ID</Label>
                  <Input 
                    value={currentGateway.id} 
                    onChange={e => setCurrentGateway({...currentGateway, id: e.target.value})} 
                    disabled={!!currentGateway.id && gateways.some(g => g.id === currentGateway.id)} 
                    placeholder="stripe_main" 
                    className="font-mono text-sm bg-slate-50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input 
                  value={currentGateway.name} 
                  onChange={e => setCurrentGateway({...currentGateway, name: e.target.value})} 
                  placeholder="e.g. Credit Card (Stripe)" 
                />
              </div>
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 items-start">
               <Lock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
               <div className="space-y-1">
                 <h4 className="text-sm font-medium text-amber-900">Security Notice</h4>
                 <p className="text-xs text-amber-700 leading-relaxed">
                   API keys are stored in an encrypted vault. Never share these keys publicly or commit them to source control.
                 </p>
               </div>
            </div>

            <div className="space-y-4 p-4 bg-slate-50 rounded-lg border">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-slate-500 font-bold">Public Key / App ID</Label>
                <Input 
                  value={currentGateway.apiKey} 
                  onChange={e => setCurrentGateway({...currentGateway, apiKey: e.target.value})} 
                  className="font-mono text-sm bg-white"
                  placeholder="pk_live_..."
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-slate-500 font-bold">Secret Key</Label>
                <Input 
                  type="password" 
                  value={currentGateway.secretKey} 
                  onChange={e => setCurrentGateway({...currentGateway, secretKey: e.target.value})} 
                  className="font-mono text-sm bg-white"
                  placeholder="sk_live_..."
                />
              </div>
            </div>

             <div className="flex items-center justify-between p-3 rounded-lg border bg-white">
                <div className="space-y-0.5">
                  <Label className="cursor-pointer text-slate-900" htmlFor="gw-enable">Transaction Status</Label>
                  <p className="text-xs text-slate-500">Enable this gateway for customer payments</p>
                </div>
                <Switch 
                  id="gw-enable"
                  checked={currentGateway.enabled} 
                  onCheckedChange={(c) => setCurrentGateway({...currentGateway, enabled: c})} 
                />
             </div>
          </div>

          <DialogFooter className="p-6 pt-4 border-t bg-slate-50/50">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveGateway} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              {loading ? 'Saving...' : 'Save Configuration'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
