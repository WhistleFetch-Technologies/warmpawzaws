import React from 'react';
import { Package, MapPin, Wallet, User, LogOut, Settings, ChevronRight } from 'lucide-react';
import { ShopLayout } from './ShopLayout';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { Card } from '../ui/card';

interface CustomerProfileLayoutProps {
  children: React.ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function CustomerProfileLayout({ children, currentPath, onNavigate }: CustomerProfileLayoutProps) {
  
  const MENU_ITEMS = [
    { icon: Package, label: 'My Orders', path: 'account/orders' },
    { icon: MapPin, label: 'Address Book', path: 'account/addresses' },
    { icon: Wallet, label: 'My Wallet', path: 'account/wallet' },
    { icon: Settings, label: 'Account Settings', path: 'account/settings' },
  ];

  return (
    <ShopLayout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Breadcrumb-ish Header */}
        <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">My Account</h1>
            <p className="text-sm text-muted-foreground">Manage your orders, addresses, and payment details.</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <aside className="w-full lg:w-64 shrink-0 space-y-6">
            {/* User Brief Profile */}
            <Card className="p-4 flex items-center gap-3 bg-white shadow-sm border-gray-200">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold text-lg">
                    RS
                </div>
                <div className="overflow-hidden">
                    <p className="font-medium truncate">Rahul Sharma</p>
                    <p className="text-xs text-muted-foreground truncate">+91 98765 43210</p>
                </div>
            </Card>

            {/* Menu */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <nav className="flex flex-col">
                    {MENU_ITEMS.map((item) => (
                        <button 
                            key={item.path} 
                            onClick={() => onNavigate(item.path)}
                            className={`flex items-center justify-between px-4 py-3.5 text-sm font-medium transition-colors hover:bg-gray-50 border-l-4 w-full text-left ${currentPath === item.path ? 'border-primary bg-blue-50/50 text-primary' : 'border-transparent text-gray-700'}`}
                        >
                            <div className="flex items-center gap-3">
                                <item.icon className={`h-4 w-4 ${currentPath === item.path ? 'text-primary' : 'text-gray-500'}`} />
                                {item.label}
                            </div>
                            {currentPath === item.path && <ChevronRight className="h-4 w-4" />}
                        </button>
                    ))}
                    
                    <Separator />
                    
                    <button className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors w-full text-left">
                        <LogOut className="h-4 w-4" />
                        Logout
                    </button>
                </nav>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>
    </ShopLayout>
  );
}
