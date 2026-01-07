'use client';

interface SalesOverviewProps {
  salesStats: any;
  orderStats: any;
  period: string;
}

export function SalesOverview({ salesStats, orderStats, period }: SalesOverviewProps) {
  const stats = salesStats || {};
  const orders = orderStats || {};

  const cards = [
    {
      title: 'Total Revenue',
      value: `₹${(parseFloat(String(stats.total_revenue || 0))).toLocaleString('en-IN')}`,
      change: '+12%',
      icon: '💰',
      color: 'bg-green-50 text-green-700',
    },
    {
      title: 'Total Orders',
      value: stats.total_orders || orders.total || 0,
      change: '+8%',
      icon: '📦',
      color: 'bg-blue-50 text-blue-700',
    },
    {
      title: 'Completed Orders',
      value: stats.completed_orders || orders.delivered || 0,
      change: '+5%',
      icon: '✅',
      color: 'bg-purple-50 text-purple-700',
    },
    {
      title: 'Avg Order Value',
      value: `₹${(parseFloat(String(stats.avg_order_value || 0))).toLocaleString('en-IN')}`,
      change: '+3%',
      icon: '📊',
      color: 'bg-orange-50 text-orange-700',
    },
    {
      title: 'Unique Customers',
      value: stats.unique_customers || 0,
      change: '+15%',
      icon: '👥',
      color: 'bg-indigo-50 text-indigo-700',
    },
    {
      title: 'Cancelled Orders',
      value: stats.cancelled_orders || orders.cancelled || 0,
      change: '-2%',
      icon: '❌',
      color: 'bg-red-50 text-red-700',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      {cards.map((card, index) => (
        <div key={index} className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">{card.icon}</span>
            <span className={`text-xs px-2 py-1 rounded-full ${card.color}`}>
              {card.change}
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-1">{card.title}</p>
          <p className="text-xl font-bold text-gray-900">{card.value}</p>
        </div>
      ))}
    </div>
  );
}

