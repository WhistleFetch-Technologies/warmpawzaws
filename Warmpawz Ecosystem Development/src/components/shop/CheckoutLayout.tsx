import React from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';

interface CheckoutLayoutProps {
  children: React.ReactNode;
}

export function CheckoutLayout({ children }: CheckoutLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-neutral-950">
      {/* Simplified Header for Checkout */}
      <header className="bg-white dark:bg-neutral-900 border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/shop" className="flex items-center gap-2">
             {/* Logo */}
             <span className="text-2xl font-bold text-primary">Warmpawz</span>
          </Link>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-gray-100 px-3 py-1.5 rounded-full">
            <Lock className="h-3 w-3" />
            <span className="font-medium">100% Secure Checkout</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8">
        {children}
      </main>

      {/* Simple Footer */}
      <footer className="border-t py-6 bg-white dark:bg-neutral-900 text-center text-xs text-muted-foreground">
        <div className="container mx-auto px-4">
          <p>&copy; 2025 Warmpawz. All rights reserved.</p>
          <div className="flex justify-center gap-4 mt-2">
            <Link to="/terms" className="hover:underline">Terms</Link>
            <Link to="/privacy" className="hover:underline">Privacy</Link>
            <Link to="/help" className="hover:underline">Help</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
