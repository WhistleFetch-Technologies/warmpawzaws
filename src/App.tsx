import { useState } from 'react';
import { CustomerApp } from './components/CustomerApp';
import { VendorApp } from './components/VendorApp';
import { AdminApp } from './components/AdminApp';
import { RoleMigrationPanel } from './components/admin/RoleMigrationPanel';
import { Button } from './components/ui/button';
import { Toaster } from './components/ui/sonner';
import { RegionProvider } from './hooks/useRegion';
import { CartProvider } from './context/CartContext';
import { QueryProvider } from './providers/QueryProvider';

export default function App() {
  const [activeApp, setActiveApp] = useState<'customer' | 'vendor' | 'admin' | 'migration'>('customer');

  return (
    <QueryProvider>
      <RegionProvider>
        <CartProvider>
          <div className="min-h-screen bg-gray-50">
            <Toaster position="top-right" />
      
        {/* App Switcher - Development Only */}
        <div className="fixed top-4 right-4 z-50 flex gap-2 bg-white p-2 rounded-lg shadow-lg border">
          <Button
            size="sm"
            variant={activeApp === 'customer' ? 'default' : 'outline'}
            onClick={() => setActiveApp('customer')}
            className={activeApp === 'customer' ? 'bg-[#FF8C42]' : ''}
          >
            Customer App
          </Button>
          <Button
            size="sm"
            variant={activeApp === 'vendor' ? 'default' : 'outline'}
            onClick={() => setActiveApp('vendor')}
            className={activeApp === 'vendor' ? 'bg-[#FF8C42]' : ''}
          >
            Vendor App
          </Button>
          <Button
            size="sm"
            variant={activeApp === 'admin' ? 'default' : 'outline'}
            onClick={() => setActiveApp('admin')}
            className={activeApp === 'admin' ? 'bg-[#FF8C42]' : ''}
          >
            Admin Portal
          </Button>
          <Button
            size="sm"
            variant={activeApp === 'migration' ? 'default' : 'outline'}
            onClick={() => setActiveApp('migration')}
            className={activeApp === 'migration' ? 'bg-purple-600 hover:bg-purple-700' : ''}
          >
            🔄 Migration
          </Button>
        </div>

        {/* Render Active App */}
        {activeApp === 'customer' && <CustomerApp />}
        {activeApp === 'vendor' && <VendorApp />}
        {activeApp === 'admin' && <AdminApp />}
        {activeApp === 'migration' && <RoleMigrationPanel />}
        </div>
      </CartProvider>
    </RegionProvider>
    </QueryProvider>
  );
}