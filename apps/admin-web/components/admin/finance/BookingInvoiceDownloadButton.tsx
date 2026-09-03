'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@warmpawz/ui';
import { FileText, Loader2 } from 'lucide-react';
import { downloadBookingInvoice } from '@/lib/finance/booking-invoice-download';

export function BookingInvoiceDownloadButton({
  bookingId,
  className,
  label = 'Download Invoice',
}: {
  bookingId: string;
  className?: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!bookingId || loading) return;
    setLoading(true);
    try {
      await downloadBookingInvoice(bookingId);
      toast.success('Invoice downloaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to download invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className ?? 'h-8 text-xs'}
      disabled={!bookingId || loading}
      onClick={(e: React.MouseEvent) => void onClick(e)}
    >
      {loading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-1 h-3.5 w-3.5" />}
      {label}
    </Button>
  );
}
