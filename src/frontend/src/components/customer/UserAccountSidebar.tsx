import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../../../components/ui/sheet';
import { Button } from '../../../../components/ui/button';
import { User, Settings, LogOut, CreditCard, MapPin, ShoppingBag } from 'lucide-react';

interface UserAccountSidebarProps {
  phone: string;
  onClose: () => void;
  onViewBooking: (bookingId: string) => void;
  onViewCustomerProfile: () => void;
  onNavigate: (path: string) => void;
}

export function UserAccountSidebar({ phone, onClose, onViewCustomerProfile, onNavigate }: UserAccountSidebarProps) {
  const menuItems = [
    { icon: User, label: 'My Profile', onClick: onViewCustomerProfile },
    { icon: ShoppingBag, label: 'My Orders', onClick: () => onNavigate('account/orders') },
    { icon: MapPin, label: 'Addresses', onClick: () => onNavigate('account/addresses') },
    { icon: CreditCard, label: 'Wallet', onClick: () => onNavigate('account/wallet') },
    { icon: Settings, label: 'Settings', onClick: () => onNavigate('account/settings') },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
      <div className="absolute right-0 top-0 h-full w-[80%] max-w-sm bg-white p-6 shadow-xl animate-in slide-in-from-right" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-[#FF8C42]">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-bold text-lg">My Account</h2>
            <p className="text-sm text-gray-500">{phone}</p>
          </div>
        </div>

        <div className="space-y-2">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={() => {
                item.onClick();
                onClose();
              }}
              className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors text-left"
            >
              <item.icon className="w-5 h-5 text-gray-400" />
              <span className="font-medium text-gray-700">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="absolute bottom-6 left-6 right-6">
          <Button variant="outline" className="w-full text-red-600 hover:bg-red-50 border-red-200">
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
