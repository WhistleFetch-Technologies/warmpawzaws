'use client';

interface RevenueChartProps {
  data: Array<{ date: string; revenue: number; orders_count: number }>;
  period: string;
}

export function RevenueChart({ data, period }: RevenueChartProps) {
  const maxRevenue = Math.max(...data.map(d => typeof d.revenue === 'number' ? d.revenue : parseFloat(String(d.revenue || 0))), 1);

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h3>
      <div className="h-64 flex items-end justify-between gap-2">
        {data.length > 0 ? (
          data.map((item, index) => {
            const height = ((typeof item.revenue === 'number' ? item.revenue : parseFloat(String(item.revenue || 0))) / maxRevenue) * 100;
            return (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div className="w-full bg-gray-100 rounded-t-lg relative" style={{ height: '200px' }}>
                  <div
                    className="absolute bottom-0 w-full bg-orange-500 rounded-t-lg transition-all"
                    style={{ height: `${height}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  {new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </p>
                <p className="text-xs font-medium text-gray-700 mt-1">
                  ₹{(typeof item.revenue === 'number' ? item.revenue : parseFloat(String(item.revenue || 0))).toLocaleString('en-IN')}
                </p>
              </div>
            );
          })
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <p>No revenue data available</p>
          </div>
        )}
      </div>
    </div>
  );
}

