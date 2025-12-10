import { useState } from 'react';
import { CustomerApp } from './components/CustomerApp';
import { VendorApp } from './components/VendorApp';
import { AdminApp } from './components/AdminApp';
import { SoloProviderTestSuite } from './components/testing/SoloProviderTestSuite'; // ✅ TEST SUITE
import { DiagnosticTest } from './components/testing/DiagnosticTest'; // ✅ DIAGNOSTIC
import { SimpleBackendTest } from './components/testing/SimpleBackendTest'; // ✅ SIMPLE TEST
import { Button } from './components/ui/button';
import { Toaster } from './components/ui/sonner';
import { RegionProvider } from './hooks/useRegion';
import { CartProvider } from './context/CartContext';

export default function App() {
  const [activeApp, setActiveApp] = useState<'customer' | 'vendor' | 'admin' | 'test' | 'diagnostic' | 'simple'>('customer'); // ✅ ADD SIMPLE

  return (
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
            variant={activeApp === 'test' ? 'default' : 'outline'}
            onClick={() => setActiveApp('test')}
            className={activeApp === 'test' ? 'bg-blue-600' : ''}
          >
            🧪 Test Suite
          </Button>
          <Button
            size="sm"
            variant={activeApp === 'diagnostic' ? 'default' : 'outline'}
            onClick={() => setActiveApp('diagnostic')}
            className={activeApp === 'diagnostic' ? 'bg-green-600' : ''}
          >
            🧪 Diagnostic
          </Button>
          <Button
            size="sm"
            variant={activeApp === 'simple' ? 'default' : 'outline'}
            onClick={() => setActiveApp('simple')}
            className={activeApp === 'simple' ? 'bg-red-600' : ''}
          >
            🧪 Simple Test
          </Button>
        </div>

        {/* Render Active App */}
        {activeApp === 'customer' && <CustomerApp />}
        {activeApp === 'vendor' && <VendorApp />}
        {activeApp === 'admin' && <AdminApp />}
        {activeApp === 'test' && <SoloProviderTestSuite />}
        {activeApp === 'diagnostic' && <DiagnosticTest />}
        {activeApp === 'simple' && <SimpleBackendTest />}
        </div>
      </CartProvider>
    </RegionProvider>
  );
}