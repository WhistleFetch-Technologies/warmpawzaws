'use client';

interface OrderTrendsProps {
  data: Array<{
    date: string;
    pending: number;
    confirmed: number;
    processing: number;
    shipped: number;
    delivered: number;
    cancelled: number;
  }>;
  period: string;
}

export function OrderTrends({ data, period }: OrderTrendsProps) {
  const getNumber = (value: number | string | undefined): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseInt(value, 10) || 0;
    return 0;
  };

  const maxOrders = Math.max(
    ...data.map(d => {
      const pending = getNumber(d.pending);
      const confirmed = getNumber(d.confirmed);
      const processing = getNumber(d.processing);
      const shipped = getNumber(d.shipped);
      const delivered = getNumber(d.delivered);
      const cancelled = getNumber(d.cancelled);
      return pending + confirmed + processing + shipped + delivered + cancelled;
    }),
    1
  );

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Trends</h3>
      <div className="h-64 flex items-end justify-between gap-1">
        {data.length > 0 ? (
          data.map((item, index) => {
            const getNumber = (value: number | string | undefined): number => {
              if (typeof value === 'number') return value;
              if (typeof value === 'string') return parseInt(value, 10) || 0;
              return 0;
            };
            
            const pending = getNumber(item.pending);
            const confirmed = getNumber(item.confirmed);
            const processing = getNumber(item.processing);
            const shipped = getNumber(item.shipped);
            const delivered = getNumber(item.delivered);
            const cancelled = getNumber(item.cancelled);
            
            const total = pending + confirmed + processing + shipped + delivered + cancelled;
            const height = total > 0 ? (total / maxOrders) * 100 : 0;
            const pendingHeight = total > 0 ? (pending / total) * height : 0;
            const confirmedHeight = total > 0 ? (confirmed / total) * height : 0;
            const processingHeight = total > 0 ? (processing / total) * height : 0;
            const shippedHeight = total > 0 ? (shipped / total) * height : 0;
            const deliveredHeight = total > 0 ? (delivered / total) * height : 0;
            const cancelledHeight = total > 0 ? (cancelled / total) * height : 0;

            return (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div className="w-full bg-gray-100 rounded-t-lg relative" style={{ height: '200px' }}>
                  {/* Stacked bars */}
                  {deliveredHeight > 0 && (
                    <div
                      className="absolute bottom-0 w-full bg-green-500 rounded-t-lg"
                      style={{ height: `${deliveredHeight}%` }}
                    />
                  )}
                  {shippedHeight > 0 && (
                    <div
                      className="absolute bottom-0 w-full bg-indigo-500"
                      style={{ height: `${shippedHeight}%`, bottom: `${deliveredHeight}%` }}
                    />
                  )}
                  {processingHeight > 0 && (
                    <div
                      className="absolute bottom-0 w-full bg-purple-500"
                      style={{ height: `${processingHeight}%`, bottom: `${deliveredHeight + shippedHeight}%` }}
                    />
                  )}
                  {confirmedHeight > 0 && (
                    <div
                      className="absolute bottom-0 w-full bg-blue-500"
                      style={{ height: `${confirmedHeight}%`, bottom: `${deliveredHeight + shippedHeight + processingHeight}%` }}
                    />
                  )}
                  {pendingHeight > 0 && (
                    <div
                      className="absolute bottom-0 w-full bg-yellow-500"
                      style={{ height: `${pendingHeight}%`, bottom: `${deliveredHeight + shippedHeight + processingHeight + confirmedHeight}%` }}
                    />
                  )}
                  {cancelledHeight > 0 && (
                    <div
                      className="absolute bottom-0 w-full bg-red-500 rounded-t-lg"
                      style={{ height: `${cancelledHeight}%`, bottom: `${deliveredHeight + shippedHeight + processingHeight + confirmedHeight + pendingHeight}%` }}
                    />
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  {new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </p>
                <p className="text-xs font-medium text-gray-700 mt-1">{total}</p>
              </div>
            );
          })
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <p>No order data available</p>
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-500 rounded"></div>
          <span>Pending</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded"></div>
          <span>Confirmed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-purple-500 rounded"></div>
          <span>Processing</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-indigo-500 rounded"></div>
          <span>Shipped</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <span>Delivered</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded"></div>
          <span>Cancelled</span>
        </div>
      </div>
    </div>
  );
}

