import { useState, useEffect, useRef } from 'react';
import { Package, AlertTriangle, TrendingUp, Search, Download, Edit2, Check, Upload } from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';
import { toast } from 'sonner@2.0.3';

interface InventoryManagementProps {
  sellerId: string;
}

export function InventoryManagement({ sellerId }: InventoryManagementProps) {
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingStock, setEditingStock] = useState<string | null>(null);
  const [stockValues, setStockValues] = useState<any>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadInventory();
  }, [sellerId]);

  const loadInventory = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `${getApiBaseUrl()}/ecommerce/inventory/${sellerId}`,
        { headers: getAuthHeaders() }
      );
      
      if (res.ok) {
        const data = await res.json();
        setInventory(data.inventory);
      }
    } catch (error) {
      console.error('Error loading inventory:', error);
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Product ID', 'Product Name', 'SKU', 'Current Stock', 'Low Stock Threshold', 'Header', 'Size', 'Weight', 'Dimensions (LxWxH)', 'Images (Pipe Separated)'];
    const csvContent = [
      headers.join(','),
      ...inventory.map(item => {
        const name = `"${(item.productName || '').replace(/"/g, '""')}"`;
        const header = `"${(item.header || '').replace(/"/g, '""')}"`;
        const sku = `"${(item.sku || '').replace(/"/g, '""')}"`;
        const size = `"${(item.size || '').replace(/"/g, '""')}"`;
        const images = `"${(item.images?.join('|') || item.image || '').replace(/"/g, '""')}"`;
        
        const dims = item.dimensions 
          ? `${item.dimensions.length || ''}x${item.dimensions.width || ''}x${item.dimensions.height || ''}`
          : '';

        return [
          item.productId, 
          name, 
          sku, 
          item.stock, 
          item.lowStockThreshold,
          header,
          size,
          item.weight || '',
          dims,
          images
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `inventory_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const parseCSVLine = (text: string) => {
    const result = [];
    let cell = '';
    let inQuote = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (char === ',' && !inQuote) {
        result.push(cell);
        cell = '';
      } else {
        cell += char;
      }
    }
    result.push(cell);
    return result;
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      try {
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        // Skip header
        const dataLines = lines.slice(1);
        
        const updates = [];
        
        for (const line of dataLines) {
          const cols = parseCSVLine(line);
          // Expected format: ID, Name, SKU, Stock, Threshold, Header, Size, Weight, Dimensions, Images
          if (cols.length >= 4) {
            const productId = cols[0];
            const stock = parseInt(cols[3]);
            
            if (productId && !isNaN(stock)) {
              const update: any = {
                productId,
                stock,
                lowStockThreshold: cols.length > 4 && !isNaN(parseInt(cols[4])) ? parseInt(cols[4]) : undefined,
              };

              // Parse optional extended fields if present
              if (cols.length > 5) update.header = cols[5].replace(/^"|"$/g, '');
              if (cols.length > 6) update.size = cols[6].replace(/^"|"$/g, '');
              if (cols.length > 7) update.weight = cols[7];
              if (cols.length > 8) {
                const [l, w, h] = cols[8].split('x');
                if (l || w || h) {
                  update.dimensions = {
                    length: l || '',
                    width: w || '',
                    height: h || ''
                  };
                }
              }
              if (cols.length > 9) {
                 const imgStr = cols[9].replace(/^"|"$/g, '');
                 if (imgStr) {
                   update.images = imgStr.split('|').filter(url => url.trim());
                 }
              }

              updates.push(update);
            }
          }
        }

        if (updates.length > 0) {
          const toastId = toast.loading('Updating inventory...');
          const res = await fetch(
            `${getApiBaseUrl()}/ecommerce/inventory/bulk-update`,
            {
              method: 'POST',
              headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ updates })
            }
          );
          
          if (res.ok) {
            const result = await res.json();
            toast.dismiss(toastId);
            toast.success(`Updated ${result.updated} items successfully`);
            if (result.failed > 0) {
              toast.warning(`${result.failed} items failed to update`);
            }
            loadInventory();
          } else {
            toast.dismiss(toastId);
            toast.error('Failed to process bulk update');
          }
        } else {
          toast.info('No valid updates found in CSV');
        }
      } catch (error) {
        console.error('Error parsing CSV:', error);
        toast.error('Failed to parse CSV file');
      }
      
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleUpdateStock = async (productId: string) => {
    try {
      const newStock = stockValues[productId];
      if (newStock === undefined || newStock === '') return;

      const res = await fetch(
        `${getApiBaseUrl()}/ecommerce/inventory/${productId}`,
        {
          method: 'PUT',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ stock: parseInt(newStock) })
        }
      );

      if (res.ok) {
        toast.success('Stock updated successfully');
        setEditingStock(null);
        loadInventory();
      } else {
        toast.error('Failed to update stock');
      }
    } catch (error) {
      console.error('Error updating stock:', error);
      toast.error('Failed to update stock');
    }
  };

  const filteredInventory = inventory.filter(item =>
    item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const lowStockItems = inventory.filter(item => item.isLowStock);
  const outOfStockItems = inventory.filter(item => item.stock === 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-black">Inventory Management</h1>
          <p className="text-gray-500 mt-1">Track and manage your product stock levels</p>
        </div>
        <div className="flex gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportCSV}
            accept=".csv"
            className="hidden"
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <Upload className="w-5 h-5" />
            Import CSV
          </button>
          <button 
            onClick={handleExportCSV}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Items</p>
              <p className="text-black text-2xl mt-1">{inventory.length}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Low Stock Items</p>
              <p className="text-black text-2xl mt-1">{lowStockItems.length}</p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Out of Stock</p>
              <p className="text-black text-2xl mt-1">{outOfStockItems.length}</p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <Package className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by product name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
          />
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Stock
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Low Stock Alert
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No inventory items found
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item) => (
                  <tr key={item.productId} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-black">{item.productName}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600 font-mono">{item.sku}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {editingStock === item.productId ? (
                        <div className="flex items-center justify-center gap-2">
                          <input
                            type="number"
                            min="0"
                            value={stockValues[item.productId] ?? item.stock}
                            onChange={(e) => setStockValues({ ...stockValues, [item.productId]: e.target.value })}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                            autoFocus
                          />
                          <button
                            onClick={() => handleUpdateStock(item.productId)}
                            className="p-1 bg-green-50 text-green-600 rounded hover:bg-green-100"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className={`font-semibold ${
                          item.stock === 0 ? 'text-red-600' :
                          item.isLowStock ? 'text-yellow-600' :
                          'text-black'
                        }`}>
                          {item.stock}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm text-gray-600">{item.lowStockThreshold}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                        item.stock === 0 ? 'bg-red-100 text-red-700' :
                        item.isLowStock ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {item.stock === 0 ? (
                          <>
                            <Package className="w-3 h-3" />
                            Out of Stock
                          </>
                        ) : item.isLowStock ? (
                          <>
                            <AlertTriangle className="w-3 h-3" />
                            Low Stock
                          </>
                        ) : (
                          <>
                            <TrendingUp className="w-3 h-3" />
                            In Stock
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {editingStock === item.productId ? (
                        <button
                          onClick={() => setEditingStock(null)}
                          className="text-gray-600 hover:text-gray-800 text-sm"
                        >
                          Cancel
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingStock(item.productId);
                            setStockValues({ ...stockValues, [item.productId]: item.stock });
                          }}
                          className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors inline-flex items-center gap-1"
                        >
                          <Edit2 className="w-4 h-4" />
                          Update
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-900">Low Stock Alert</p>
              <p className="text-sm text-yellow-700 mt-1">
                {lowStockItems.length} product(s) are running low on stock:
              </p>
              <ul className="mt-2 space-y-1">
                {lowStockItems.slice(0, 3).map(item => (
                  <li key={item.productId} className="text-sm text-yellow-700">
                    • {item.productName} - Only {item.stock} left
                  </li>
                ))}
                {lowStockItems.length > 3 && (
                  <li className="text-sm text-yellow-700">
                    • And {lowStockItems.length - 3} more...
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
