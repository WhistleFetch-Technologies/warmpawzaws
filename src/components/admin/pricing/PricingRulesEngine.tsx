"use client";

import { useState } from 'react';
import { 
  Plus, Trash2, Save, TrendingUp, Clock, Calendar, AlertCircle, 
  Check, DollarSign, Percent, Info 
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Switch } from '../../ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { toast } from 'sonner@2.0.3';

interface PricingRule {
  id: string;
  name: string;
  serviceType: string; // 'walker', 'vet', 'grooming', 'all'
  type: 'surge' | 'discount' | 'fixed';
  value: number; // e.g. 1.5 for 1.5x multiplier, 100 for +100 flat
  unit: 'multiplier' | 'flat';
  conditions: {
    daysOfWeek?: number[]; // 0-6
    timeStart?: string; // HH:mm
    timeEnd?: string; // HH:mm
    isHoliday?: boolean;
    demandLevel?: 'high' | 'medium' | 'low';
  };
  isActive: boolean;
}

export function PricingRulesEngine() {
  const [rules, setRules] = useState<PricingRule[]>([
    {
      id: '1',
      name: 'Weekend Surge',
      serviceType: 'all',
      type: 'surge',
      value: 1.2,
      unit: 'multiplier',
      conditions: {
        daysOfWeek: [0, 6], // Sun, Sat
        timeStart: '09:00',
        timeEnd: '18:00'
      },
      isActive: true
    },
    {
      id: '2',
      name: 'Emergency Vet Surcharge',
      serviceType: 'vet',
      type: 'fixed',
      value: 500,
      unit: 'flat',
      conditions: {
        timeStart: '22:00',
        timeEnd: '06:00'
      },
      isActive: true
    }
  ]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newRule, setNewRule] = useState<Partial<PricingRule>>({
    name: '',
    serviceType: 'all',
    type: 'surge',
    unit: 'multiplier',
    conditions: { daysOfWeek: [] },
    isActive: true
  });

  const handleToggleRule = (id: string) => {
    setRules(rules.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r));
    toast.success('Rule status updated');
  };

  const handleDeleteRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
    toast.success('Rule deleted');
  };

  const handleSaveRule = () => {
    if (!newRule.name || !newRule.value) {
      toast.error('Please fill in all required fields');
      return;
    }

    const rule: PricingRule = {
      id: Date.now().toString(),
      name: newRule.name,
      serviceType: newRule.serviceType || 'all',
      type: newRule.type || 'surge',
      value: Number(newRule.value),
      unit: newRule.unit || 'multiplier',
      conditions: newRule.conditions || {},
      isActive: true
    };

    setRules([...rules, rule]);
    setShowAddForm(false);
    setNewRule({
      name: '',
      serviceType: 'all',
      type: 'surge',
      unit: 'multiplier',
      conditions: { daysOfWeek: [] },
      isActive: true
    });
    toast.success('Pricing rule created successfully');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-[#FF8C42]" />
            Dynamic Pricing Rules
          </h2>
          <p className="text-sm text-gray-500">Configure surge pricing, discounts, and time-based rates.</p>
        </div>
        <Button onClick={() => setShowAddForm(true)} className="bg-[#FF8C42] hover:bg-[#e67a30]">
          <Plus className="w-4 h-4 mr-2" />
          Create Rule
        </Button>
      </div>

      {showAddForm && (
        <div className="bg-white p-6 rounded-xl border border-orange-200 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900">New Pricing Rule</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>Cancel</Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Rule Name</label>
              <Input 
                placeholder="e.g. Weekend Peak" 
                value={newRule.name}
                onChange={e => setNewRule({...newRule, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Service Category</label>
              <Select 
                value={newRule.serviceType} 
                onValueChange={v => setNewRule({...newRule, serviceType: v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Services</SelectItem>
                  <SelectItem value="walker">Dog Walking</SelectItem>
                  <SelectItem value="vet">Veterinary</SelectItem>
                  <SelectItem value="grooming">Grooming</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select 
                value={newRule.type} 
                onValueChange={v => setNewRule({...newRule, type: v as any})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="surge">Surge (Increase)</SelectItem>
                  <SelectItem value="discount">Discount (Decrease)</SelectItem>
                  <SelectItem value="fixed">Fixed Fee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Value</label>
              <Input 
                type="number" 
                step="0.1"
                placeholder="1.5"
                value={newRule.value || ''}
                onChange={e => setNewRule({...newRule, value: parseFloat(e.target.value)})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Unit</label>
              <Select 
                value={newRule.unit} 
                onValueChange={v => setNewRule({...newRule, unit: v as any})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="multiplier">Multiplier (x)</SelectItem>
                  <SelectItem value="flat">Flat Amount (₹)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" /> Time Conditions (Optional)
            </label>
            <div className="flex items-center gap-4">
              <Input 
                type="time" 
                value={newRule.conditions?.timeStart || ''}
                onChange={e => setNewRule({
                  ...newRule, 
                  conditions: { ...newRule.conditions, timeStart: e.target.value }
                })}
              />
              <span className="text-gray-400">to</span>
              <Input 
                type="time" 
                value={newRule.conditions?.timeEnd || ''}
                onChange={e => setNewRule({
                  ...newRule, 
                  conditions: { ...newRule.conditions, timeEnd: e.target.value }
                })}
              />
            </div>
          </div>

          <Button onClick={handleSaveRule} className="w-full bg-gray-900 text-white hover:bg-gray-800">
            <Save className="w-4 h-4 mr-2" />
            Save Rule
          </Button>
        </div>
      )}

      <div className="grid gap-4">
        {rules.map((rule) => (
          <div key={rule.id} className={`bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between ${!rule.isActive ? 'opacity-60 bg-gray-50' : 'border-gray-200'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                rule.type === 'surge' ? 'bg-orange-100 text-orange-600' :
                rule.type === 'discount' ? 'bg-green-100 text-green-600' :
                'bg-blue-100 text-blue-600'
              }`}>
                {rule.type === 'surge' ? <TrendingUp className="w-5 h-5" /> :
                 rule.type === 'discount' ? <Percent className="w-5 h-5" /> :
                 <DollarSign className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{rule.name}</h3>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span className="capitalize px-2 py-0.5 bg-gray-100 rounded-full text-xs">
                    {rule.serviceType === 'all' ? 'All Services' : rule.serviceType}
                  </span>
                  <span>
                    {rule.unit === 'multiplier' ? `${rule.value}x` : `₹${rule.value}`} 
                    {' '}{rule.type}
                  </span>
                  {rule.conditions.timeStart && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {rule.conditions.timeStart} - {rule.conditions.timeEnd}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 mr-4">
                <span className={`text-xs ${rule.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                  {rule.isActive ? 'Active' : 'Inactive'}
                </span>
                <Switch 
                  checked={rule.isActive} 
                  onCheckedChange={() => handleToggleRule(rule.id)}
                />
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-gray-400 hover:text-red-500"
                onClick={() => handleDeleteRule(rule.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">How Pricing Rules Work</p>
          <p>Rules are applied in order of specificity. Category-specific rules override "All Services" rules. Multipliers are applied to the base service price.</p>
        </div>
      </div>
    </div>
  );
}