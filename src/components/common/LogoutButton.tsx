import { Button } from '../ui/button';
import { LogOut } from 'lucide-react';
import { useLogout } from '../../hooks/useLogout';
import { toast } from 'sonner@2.0.3';

interface LogoutButtonProps {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  showIcon?: boolean;
  redirectTo?: string;
}

export function LogoutButton({ 
  variant = 'outline', 
  size = 'default',
  className = '',
  showIcon = true,
  redirectTo
}: LogoutButtonProps) {
  const { logout } = useLogout();

  const handleLogout = async () => {
    try {
      toast.loading('Logging out...');
      await logout({ redirectTo });
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Failed to logout');
      console.error('Logout error:', error);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleLogout}
      className={className}
    >
      {showIcon && <LogOut className="w-4 h-4 mr-2" />}
      Logout
    </Button>
  );
}

