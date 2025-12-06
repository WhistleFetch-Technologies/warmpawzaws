import React, { useState } from 'react';
import { Wallet, History, CreditCard, Plus } from 'lucide-react';
import { CustomerProfileLayout } from './CustomerProfileLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Badge } from '../ui/badge';

// Mock Transactions
const TRANSACTIONS = [
  { id: 'TXN-1001', date: 'Jan 24, 2025', description: 'Order #ORD-2025-001 Payment', amount: -2899, type: 'debit' },
  { id: 'TXN-1000', date: 'Jan 20, 2025', description: 'Wallet Top-up', amount: 5000, type: 'credit' },
  { id: 'TXN-999', date: 'Dec 15, 2024', description: 'Order #ORD-2024-892 Payment', amount: -499, type: 'debit' },
  { id: 'TXN-998', date: 'Dec 10, 2024', description: 'Refund for #ORD-2024-750', amount: 1250, type: 'credit' },
];

interface WalletPageProps {
  onNavigate: (path: string) => void;
}

export function WalletPage({ onNavigate }: WalletPageProps) {
  const [balance, setBalance] = useState(2852);
  const [transactions, setTransactions] = useState(TRANSACTIONS);
  const [isAddMoneyOpen, setIsAddMoneyOpen] = useState(false);
  const [amountToAdd, setAmountToAdd] = useState('');

  const handleAddMoney = () => {
    const amount = parseFloat(amountToAdd);
    if (amount > 0) {
      setBalance(prev => prev + amount);
      setTransactions([
        { 
            id: `TXN-${Math.floor(Math.random() * 10000)}`, 
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), 
            description: 'Wallet Top-up', 
            amount: amount, 
            type: 'credit' 
        },
        ...transactions
      ]);
      setAmountToAdd('');
      setIsAddMoneyOpen(false);
    }
  };

  return (
    <CustomerProfileLayout currentPath="account/wallet" onNavigate={onNavigate}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
           <h2 className="text-xl font-semibold">My Wallet</h2>
           <Button onClick={() => setIsAddMoneyOpen(true)} className="gap-2 bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Add Money
           </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {/* Balance Card */}
           <div className="md:col-span-2">
              <Card className="bg-gradient-to-br from-gray-900 to-gray-800 text-white border-none shadow-lg overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                  <CardContent className="p-8 relative z-10 flex flex-col justify-between h-[200px]">
                      <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2 text-gray-300">
                              <Wallet className="h-5 w-5" />
                              <span className="font-medium tracking-wider uppercase text-xs">Warmpawz Balance</span>
                          </div>
                          <CreditCard className="h-8 w-8 text-white/20" />
                      </div>
                      
                      <div>
                          <div className="text-4xl font-bold tracking-tight">₹ {balance.toLocaleString()}</div>
                          <p className="text-gray-400 text-sm mt-1">Available for next purchase</p>
                      </div>

                      <div className="flex gap-4 mt-4">
                           <div className="text-xs text-gray-400 font-mono">**** **** **** 8829</div>
                      </div>
                  </CardContent>
              </Card>
           </div>

           {/* Quick Stats or Promo */}
           <Card className="bg-orange-50 border-orange-100 flex flex-col justify-center">
              <CardContent className="p-6 text-center space-y-2">
                 <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-2">
                    <History className="h-6 w-6" />
                 </div>
                 <h3 className="font-bold text-orange-900">Cashback Earned</h3>
                 <div className="text-2xl font-bold text-orange-700">₹ 1,250</div>
                 <p className="text-xs text-orange-800/70">Lifetime earnings on orders</p>
              </CardContent>
           </Card>
        </div>

        {/* Transaction History */}
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Transaction History</CardTitle>
                <CardDescription>View all your wallet credits and debits.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {transactions.map((txn) => (
                            <TableRow key={txn.id}>
                                <TableCell className="font-medium text-muted-foreground text-xs whitespace-nowrap">{txn.date}</TableCell>
                                <TableCell>
                                    <div className="font-medium text-sm">{txn.description}</div>
                                    <div className="text-xs text-muted-foreground">{txn.id}</div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={txn.type === 'credit' ? 'outline' : 'secondary'} className={`text-[10px] uppercase ${txn.type === 'credit' ? 'border-green-200 text-green-700 bg-green-50' : ''}`}>
                                        {txn.type}
                                    </Badge>
                                </TableCell>
                                <TableCell className={`text-right font-bold ${txn.type === 'credit' ? 'text-green-600' : 'text-gray-900'}`}>
                                    {txn.type === 'credit' ? '+' : ''} ₹ {Math.abs(txn.amount).toLocaleString()}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

        {/* Add Money Dialog */}
        <Dialog open={isAddMoneyOpen} onOpenChange={setIsAddMoneyOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add Money to Wallet</DialogTitle>
                    <DialogDescription>
                        Top up your wallet for faster checkouts.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-3 gap-2">
                        {[500, 1000, 2000].map(amt => (
                            <Button key={amt} variant="outline" onClick={() => setAmountToAdd(amt.toString())} className={amountToAdd === amt.toString() ? 'border-primary bg-primary/5' : ''}>
                                + ₹{amt}
                            </Button>
                        ))}
                    </div>
                    <div className="space-y-2">
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-muted-foreground font-bold">₹</span>
                            <Input 
                                id="amount" 
                                type="number" 
                                placeholder="Enter amount" 
                                className="pl-8 text-lg font-bold"
                                value={amountToAdd}
                                onChange={(e) => setAmountToAdd(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleAddMoney} disabled={!amountToAdd || parseFloat(amountToAdd) <= 0} className="w-full">
                        Proceed to Pay ₹{amountToAdd || 0}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>
    </CustomerProfileLayout>
  );
}
