import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Button } from '../../ui/button';
import { Switch } from '../../ui/switch';
import { Badge } from '../../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner';

export function LoyaltyRulesManagement() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/loyalty/rules`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      const data = await response.json();
      setRules(data.rules || []);
    } catch (error) {
      toast.error('Failed to load rules');
    } finally {
      setLoading(false);
    }
  };

  const toggleRule = async (ruleId: string, currentState: boolean) => {
    try {
      const rule = rules.find(r => r.id === ruleId);
      if (!rule) return;

      const updatedRule = { ...rule, isActive: !currentState };
      
      // Optimistic update
      setRules(rules.map(r => r.id === ruleId ? updatedRule : r));

      await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/loyalty/rules`,
        {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updatedRule)
        }
      );
      toast.success('Rule updated');
    } catch (error) {
      toast.error('Failed to update rule');
      loadRules(); // Revert
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Loyalty Rules Engine</h2>
          <p className="text-muted-foreground">Configure point rewards for customer and vendor actions.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Add Rule
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rules.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rules.filter(r => r.isActive).length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configured Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Points Logic</TableHead>
                <TableHead>Limits</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <Switch 
                      checked={rule.isActive}
                      onCheckedChange={() => toggleRule(rule.id, rule.isActive)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {rule.name}
                    <div className="text-xs text-muted-foreground">{rule.description}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{rule.category}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{rule.actionKey}</TableCell>
                  <TableCell>
                    {rule.type === 'fixed' && (
                      <span className="font-bold text-green-600">{rule.points} pts</span>
                    )}
                    {rule.type === 'percentage_spend' && (
                      <span className="font-bold text-blue-600">{rule.points} pts / ₹{rule.spendUnit}</span>
                    )}
                    {rule.type === 'multiplier' && (
                      <span className="font-bold text-purple-600">{rule.points}x Multiplier</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">
                      <div>Freq: {rule.frequency}</div>
                      {rule.period && (
                        <div>Max {rule.maxCountPerPeriod} per {rule.period}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
