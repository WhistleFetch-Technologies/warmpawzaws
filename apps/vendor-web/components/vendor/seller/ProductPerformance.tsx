'use client';

interface Product {
  id: string;
  name: string;
  price: number;
  images?: string[];
  units_sold: number;
  total_quantity: number;
  revenue: number;
}

interface Category {
  category: string;
  product_count: number;
  units_sold: number;
  revenue: number;
}

interface ProductPerformanceProps {
  topProducts: Product[];
  productByCategory: Category[];
  period: string;
}

export function ProductPerformance({ topProducts, productByCategory, period }: ProductPerformanceProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Top Products */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Selling Products</h3>
        <div className="space-y-3">
          {topProducts.length > 0 ? (
            topProducts.map((product, index) => (
              <div key={product.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                  {product.images && product.images.length > 0 ? (
                    <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <span className="text-xl">🛍️</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{product.name}</p>
                  <p className="text-xs text-gray-500">
                    {product.units_sold} units sold • ₹{parseFloat(String(product.revenue || 0)).toLocaleString('en-IN')} revenue
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-orange-600">#{index + 1}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-400 py-8">No product data available</p>
          )}
        </div>
      </div>

      {/* Performance by Category */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance by Category</h3>
        <div className="space-y-3">
          {productByCategory.length > 0 ? (
            productByCategory.map((category, index) => {
              const maxRevenue = Math.max(...productByCategory.map(c => parseFloat(String(c.revenue || 0))), 1);
              const width = (parseFloat(String(category.revenue || 0)) / maxRevenue) * 100;
              
              return (
                <div key={index} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-900">{category.category || 'Uncategorized'}</p>
                    <p className="text-sm font-semibold text-orange-600">
                      ₹{parseFloat(String(category.revenue || 0)).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-orange-500 h-2 rounded-full transition-all"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                    <span>{category.product_count} products</span>
                    <span>{category.units_sold} units sold</span>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-center text-gray-400 py-8">No category data available</p>
          )}
        </div>
      </div>
    </div>
  );
}

