/**
 * ========================================
 * CUSTOMER WALLET PAGE - REAL API INTEGRATION
 * ========================================
 * 
 * ✅ FIXED: Removed mock data
 * ✅ FIXED: Uses real API calls
 * ✅ FIXED: Uses authenticatedFetch
 * 
 * Features:
 * - View wallet balance
 * - View transaction history
 * - Add money to wallet
 * - Filter transactions
 * - Download statement
 */

import React, { useState, useEffect } from 'react';
import { Wallet, History, CreditCard, Plus, Download, Filter, Loader2, AlertCircle } from 'lucide-react';
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
import { authenticatedGet, authenticatedPost, getCurrentUserId } from '../../utils/authenticatedFetch';
import { projectId } from '../../utils/supabase/info';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  status?: string;
}

interface WalletData {
  balance: number;
  transactions: Transaction[];
}

interface WalletPageProps {
  onNavigate: (path: string) => void;
}

export function WalletPage({ onNavigate }: WalletPageProps) {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddMoneyOpen, setIsAddMoneyOpen] = useState(false);
  const [amountToAdd, setAmountToAdd] = useState('');
  const [addingMoney, setAddingMoney] = useState(false);

  // Fetch wallet data on mount
  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const customerId = await getCurrentUserId();
      if (!customerId) {
        throw new Error('Please login to view your wallet');
      }

      // Fetch wallet data from real API
      const walletData = await authenticatedGet(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/${customerId}/wallet`,
        true // Require auth
      );

      setBalance(walletData.balance || 0);
      setTransactions(walletData.transactions || []);
    } catch (err: any) {
      console.error('Error fetching wallet data:', err);
      setError(err.message || 'Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMoney = async () => {
    const amount = parseFloat(amountToAdd);
    
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (amount < 10) {
      alert('Minimum top-up amount is ₹10');
      return;
    }

    setAddingMoney(true);

    try {
      const customerId = await getCurrentUserId();
      if (!customerId) {
        throw new Error('Please login to add money');
      }

      // Initiate wallet top-up
      const initiateResponse = await authenticatedPost(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/${customerId}/wallet/topup/initiate`,
        { amount }
      );

      // Load Razorpay script if not already loaded
      if (!window.Razorpay) {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);
        await new Promise((resolve) => {
          script.onload = resolve;
        });
      }

      // Open Razorpay checkout
      const options = {
        key: initiateResponse.razorpayKeyId,
        amount: initiateResponse.amount,
        currency: initiateResponse.currency,
        name: 'Warmpawz Wallet',
        description: 'Add money to wallet',
        order_id: initiateResponse.orderId,
        handler: async (response: any) => {
          try {
            // Verify payment
            const verifyResponse = await authenticatedPost(
              `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/${customerId}/wallet/topup/verify`,
              {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              }
            );

            if (verifyResponse.success) {
              // Refresh wallet data
              await fetchWalletData();
              setAmountToAdd('');
              setIsAddMoneyOpen(false);
              alert('Money added successfully!');
            } else {
              throw new Error('Payment verification failed');
            }
          } catch (err: any) {
            console.error('Payment verification error:', err);
            alert('Payment verification failed. Please contact support.');
          }
        },
        prefill: {
          name: 'Customer',
          email: 'customer@example.com'
        },
        theme: {
          color: '#FF8C42'
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();

    } catch (err: any) {
      console.error('Error initiating top-up:', err);
      alert(err.message || 'Failed to initiate payment');
    } finally {
      setAddingMoney(false);
    }
  };

  // Download statement
  const handleDownloadStatement = () => {
    const csv = [
      ['Date', 'Description', 'Amount', 'Type', 'Balance'],
      ...transactions.map(txn => [
        txn.date,
        txn.description,
        txn.amount.toString(),
        txn.type,
        ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wallet-statement-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Loading state
  if (loading) {
    return (
      <CustomerProfileLayout currentPath="account/wallet" onNavigate={onNavigate}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-[#FF8C42]" />
            <p className="text-gray-600">Loading wallet...</p>
          </div>
        </div>
      </CustomerProfileLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <CustomerProfileLayout currentPath="account/wallet" onNavigate={onNavigate}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <h3 className="text-lg font-semibold mb-2">Failed to Load Wallet</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={fetchWalletData}>
              Try Again
            </Button>
          </div>
        </div>
      </CustomerProfileLayout>
    );
  }

  return (
    <CustomerProfileLayout currentPath="account/wallet" onNavigate={onNavigate}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
           <h2 className="text-xl font-semibold">My Wallet</h2>
           <div className="flex gap-2">
             <Button 
               variant="outline" 
               onClick={handleDownloadStatement}
               className="gap-2"
             >
               <Download className="h-4 w-4" /> Statement
             </Button>
             <Button 
               onClick={() => setIsAddMoneyOpen(true)} 
               className="gap-2 bg-[#FF8C42] hover:bg-[#FF7029]"
             >
               <Plus className="h-4 w-4" /> Add Money
             </Button>
           </div>
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
                              <span className="text-sm">Available Balance</span>
                          </div>
                          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1 text-xs">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            Active
                          </div>
                      </div>
                      <div>
                          <div className="text-4xl font-bold mb-1">₹{balance.toFixed(2)}</div>
                          <div className="text-sm text-gray-400">{transactions.length} transactions</div>
                      </div>
                  </CardContent>
              </Card>
           </div>

           {/* Quick Stats */}
           <div className="space-y-4">
              <Card>
                  <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                          <div className="p-3 bg-green-50 rounded-full">
                              <CreditCard className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                              <div className="text-2xl font-semibold">
                                ₹{transactions.filter(t => t.type === 'credit').reduce((sum, t) => sum + t.amount, 0).toFixed(0)}
                              </div>
                              <div className="text-sm text-gray-600">Total Added</div>
                          </div>
                      </div>
                  </CardContent>
              </Card>
              <Card>
                  <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                          <div className="p-3 bg-red-50 rounded-full">
                              <History className="h-5 w-5 text-red-600" />
                          </div>
                          <div>
                              <div className="text-2xl font-semibold">
                                ₹{Math.abs(transactions.filter(t => t.type === 'debit').reduce((sum, t) => sum + t.amount, 0)).toFixed(0)}
                              </div>
                              <div className="text-sm text-gray-600">Total Spent</div>
                          </div>
                      </div>
                  </CardContent>
              </Card>
           </div>
        </div>

        {/* Transactions */}
        <Card>
           <CardHeader>
               <div className="flex items-center justify-between">
                   <div>
                       <CardTitle>Transaction History</CardTitle>
                       <CardDescription>Your recent wallet transactions</CardDescription>
                   </div>
               </div>
           </CardHeader>
           <CardContent>
               {transactions.length === 0 ? (
                 <div className="text-center py-12">
                   <History className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                   <p className="text-gray-600">No transactions yet</p>
                   <p className="text-sm text-gray-500 mt-2">Add money to get started</p>
                 </div>
               ) : (
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
                         {transactions.map((transaction) => (
                             <TableRow key={transaction.id}>
                                 <TableCell className="font-medium">{transaction.date}</TableCell>
                                 <TableCell>{transaction.description}</TableCell>
                                 <TableCell>
                                     <Badge variant={transaction.type === 'credit' ? 'default' : 'secondary'}>
                                         {transaction.type === 'credit' ? 'Credit' : 'Debit'}
                                     </Badge>
                                 </TableCell>
                                 <TableCell className={`text-right font-semibold ${transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                                     {transaction.type === 'credit' ? '+' : '-'}₹{Math.abs(transaction.amount).toFixed(2)}
                                 </TableCell>
                             </TableRow>
                         ))}
                     </TableBody>
                 </Table>
               )}
           </CardContent>
        </Card>

        {/* Add Money Dialog */}
        <Dialog open={isAddMoneyOpen} onOpenChange={setIsAddMoneyOpen}>
           <DialogContent>
               <DialogHeader>
                   <DialogTitle>Add Money to Wallet</DialogTitle>
                   <DialogDescription>
                       Enter the amount you want to add to your wallet. Minimum amount is ₹10.
                   </DialogDescription>
               </DialogHeader>
               <div className="space-y-4 py-4">
                   <div className="space-y-2">
                       <label htmlFor="amount" className="text-sm font-medium">Amount (₹)</label>
                       <Input
                           id="amount"
                           type="number"
                           placeholder="Enter amount"
                           value={amountToAdd}
                           onChange={(e) => setAmountToAdd(e.target.value)}
                           min="10"
                       />
                   </div>
                   <div className="grid grid-cols-3 gap-2">
                       {[500, 1000, 2000].map((amount) => (
                           <Button
                               key={amount}
                               variant="outline"
                               onClick={() => setAmountToAdd(amount.toString())}
                           >
                               ₹{amount}
                           </Button>
                       ))}
                   </div>
               </div>
               <DialogFooter>
                   <Button 
                     variant="outline" 
                     onClick={() => setIsAddMoneyOpen(false)}
                     disabled={addingMoney}
                   >
                       Cancel
                   </Button>
                   <Button 
                     onClick={handleAddMoney}
                     disabled={addingMoney || !amountToAdd || parseFloat(amountToAdd) < 10}
                     className="bg-[#FF8C42] hover:bg-[#FF7029]"
                   >
                       {addingMoney ? (
                         <>
                           <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                           Processing...
                         </>
                       ) : (
                         <>Add ₹{amountToAdd || '0'}</>
                       )}
                   </Button>
               </DialogFooter>
           </DialogContent>
        </Dialog>
      </div>
    </CustomerProfileLayout>
  );
}

// TypeScript declaration for Razorpay
declare global {
  interface Window {
    Razorpay: any;
  }
}
