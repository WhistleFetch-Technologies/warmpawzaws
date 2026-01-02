/**
 * VENDOR PAYOUT RECORDS
 * 
 * Shows payout history with staff revenue breakup
 * Displays in vendor dashboard
 */

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { 
  Wallet, CheckCircle2, Clock, AlertCircle, ChevronDown, ChevronUp, 
  Users, DollarSign, TrendingUp, Building2
} from 'lucide-react';
import { toast } from 'sonner';

interface PayoutRecord {
  payoutId: string;
  vendorId: string;
  amount: number;
  totalAmount: number;
  commissionRate: number;
  commissionAmount: number;
  bookingIds: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  staffBreakup?: Array<{
    staffId: string;
    staffName: string;
    bookingId: string;
    bookingAmount: number;
    platformCommission: number;
    vendorEarnings: number;
    staffRevenue: number;
    isCenterBased: boolean;
    completedAt: string;
  }>;
  totalStaffRevenue?: number;
  createdAt: string;
  processedAt?: string;
  completedAt?: string;
  razorpayPayoutId?: string;
  transactionId?: string;
}

interface VendorPayoutRecordsProps {
  vendorId: string;
}

export function VendorPayoutRecords({ vendorId }: VendorPayoutRecordsProps) {
  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [expandedPayouts, setExpandedPayouts] = useState<Set<string>>(new Set());
  const [isCenterBased, setIsCenterBased] = useState(false);

  useEffect(() => {
    loadPayouts();
  }, [vendorId]);

  const loadPayouts = async () => {
    setLoading(true);
    try {
      // ✅ FIX: Use API Gateway URL instead of Supabase
      const { apiCallJson } = await import('@warmpawz/api-client/http');
      const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || '';
      if (!API_GATEWAY_URL) {
        throw new Error('API Gateway URL not configured');
      }

      const data = await apiCallJson<any>(
        `${API_GATEWAY_URL}/make-server-3dd53475/vendor/payouts/${vendorId}`
      );

      if (data.success) {
        setPayouts(data.payouts || data.data?.payouts || []);
        setSummary(data.summary || data.data?.summary);
        setIsCenterBased(data.isCenterBased || false);
      } else {
        toast.error(data.error || data.message || 'Failed to load payout records');
      }
    } catch (error: any) {
      console.error('Error loading payouts:', error);
      toast.error(error?.message || 'Failed to load payout records');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (payoutId: string) => {
    const newExpanded = new Set(expandedPayouts);
    if (newExpanded.has(payoutId)) {
      newExpanded.delete(payoutId);
    } else {
      newExpanded.add(payoutId);
    }
    setExpandedPayouts(newExpanded);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-700">Completed</Badge>;
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-700">Processing</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-700">Failed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Pending Payout</span>
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
              <div className="text-2xl font-semibold text-gray-900">
                ₹{summary.totalPending?.toLocaleString() || '0'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Processing</span>
                <TrendingUp className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-2xl font-semibold text-gray-900">
                ₹{summary.totalProcessing?.toLocaleString() || '0'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Completed</span>
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <div className="text-2xl font-semibold text-gray-900">
                ₹{summary.totalCompleted?.toLocaleString() || '0'}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payout Records */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Payout History</h3>
        
        {payouts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Payouts Yet</h3>
              <p className="text-gray-600">
                Your payouts will appear here once they are processed automatically.
              </p>
            </CardContent>
          </Card>
        ) : (
          payouts.map((payout) => (
            <Card key={payout.payoutId}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle className="text-lg">
                        Payout #{payout.payoutId.slice(-8)}
                      </CardTitle>
                      {getStatusBadge(payout.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>Amount: <strong className="text-gray-900">₹{payout.amount.toLocaleString()}</strong></span>
                      <span>•</span>
                      <span>{new Date(payout.createdAt).toLocaleDateString()}</span>
                      {payout.completedAt && (
                        <>
                          <span>•</span>
                          <span>Completed: {new Date(payout.completedAt).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpand(payout.payoutId)}
                  >
                    {expandedPayouts.has(payout.payoutId) ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>

              {expandedPayouts.has(payout.payoutId) && (
                <CardContent>
                  <div className="space-y-4">
                    {/* Payout Details */}
                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm text-gray-600">Total Booking Amount</p>
                        <p className="text-lg font-semibold">₹{payout.totalAmount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Platform Commission ({payout.commissionRate}%)</p>
                        <p className="text-lg font-semibold text-red-600">
                          -₹{payout.commissionAmount.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Vendor Earnings</p>
                        <p className="text-lg font-semibold text-green-600">
                          ₹{payout.amount.toLocaleString()}
                        </p>
                      </div>
                      {payout.razorpayPayoutId && (
                        <div>
                          <p className="text-sm text-gray-600">Transaction ID</p>
                          <p className="text-sm font-mono">{payout.razorpayPayoutId}</p>
                        </div>
                      )}
                    </div>

                    {/* Staff Revenue Breakup */}
                    {payout.staffBreakup && payout.staffBreakup.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Users className="w-5 h-5 text-gray-600" />
                          <h4 className="font-semibold text-gray-900">Staff Revenue Breakup</h4>
                          {isCenterBased && (
                            <Badge variant="outline" className="ml-2">
                              <Building2 className="w-3 h-3 mr-1" />
                              Center-Based (Tracking Only)
                            </Badge>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          {payout.staffBreakup.map((staff, index) => (
                            <div
                              key={index}
                              className="p-3 bg-blue-50 rounded-lg border border-blue-100"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <p className="font-medium text-gray-900">{staff.staffName}</p>
                                  <p className="text-xs text-gray-500">
                                    Booking: {staff.bookingId.slice(-8)}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-semibold text-gray-900">
                                    ₹{staff.staffRevenue.toLocaleString()}
                                  </p>
                                  {isCenterBased && (
                                    <p className="text-xs text-gray-500">(Tracking)</p>
                                  )}
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-3 gap-2 text-xs text-gray-600 mt-2 pt-2 border-t border-blue-200">
                                <div>
                                  <span className="font-medium">Booking:</span> ₹{staff.bookingAmount.toLocaleString()}
                                </div>
                                <div>
                                  <span className="font-medium">Commission:</span> ₹{staff.platformCommission.toLocaleString()}
                                </div>
                                <div>
                                  <span className="font-medium">Vendor:</span> ₹{staff.vendorEarnings.toLocaleString()}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900">Total Staff Revenue</span>
                            <span className="text-lg font-semibold text-gray-900">
                              ₹{payout.totalStaffRevenue?.toLocaleString() || '0'}
                            </span>
                          </div>
                          {isCenterBased && (
                            <p className="text-xs text-gray-500 mt-1">
                              Note: For center-based vendors, staff revenue is for tracking only. 
                              Actual staff payouts are handled by the center.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Booking IDs */}
                    <div>
                      <p className="text-sm font-medium text-gray-900 mb-2">
                        Bookings Included ({payout.bookingIds.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {payout.bookingIds.map((bookingId) => (
                          <Badge key={bookingId} variant="outline" className="font-mono text-xs">
                            {bookingId.slice(-8)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

