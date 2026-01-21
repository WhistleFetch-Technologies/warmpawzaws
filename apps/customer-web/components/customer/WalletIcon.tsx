'use client';

import React, { useState, useEffect } from 'react';
import { Coins, Wallet, Sparkles } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface WalletIconProps {
  customerPhone: string;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showBalance?: boolean;
  className?: string;
}

export function WalletIcon({ 
  customerPhone, 
  onClick, 
  size = 'md',
  showBalance = true,
  className = ''
}: WalletIconProps) {
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [hasBonus, setHasBonus] = useState(false);

  useEffect(() => {
    loadWalletBalance();
    // Refresh every 30 seconds
    const interval = setInterval(loadWalletBalance, 30000);
    return () => clearInterval(interval);
  }, [customerPhone]);

  const loadWalletBalance = async () => {
    try {
      const res = await apiClient.get<any>(`/customer/wallet?phone=${encodeURIComponent(customerPhone)}`);
      if (res.wallet) {
        setBalance(res.wallet.balance || 0);
        // Check if there are pending bonuses
        setHasBonus((res.wallet.pending_credits || 0) > 0);
      }
    } catch (e) {
      console.log('Could not load wallet balance');
    } finally {
      setLoading(false);
    }
  };

  const sizeClasses = {
    sm: 'h-8 px-2.5 text-xs gap-1.5',
    md: 'h-10 px-3 text-sm gap-2',
    lg: 'h-12 px-4 text-base gap-2',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const coinSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  if (loading) {
    return (
      <button 
        onClick={onClick}
        className={`flex items-center rounded-full bg-gradient-to-r from-amber-100 to-orange-100 
                    border border-amber-200/50 shadow-sm animate-pulse ${sizeClasses[size]} ${className}`}
      >
        <div className={`${coinSizes[size]} rounded-full bg-amber-200`} />
        {showBalance && <span className="text-gray-400">...</span>}
      </button>
    );
  }

  return (
    <button 
      onClick={onClick}
      className={`relative flex items-center rounded-full bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 
                  border border-amber-200/80 shadow-sm hover:shadow-md hover:scale-105 
                  transition-all duration-200 active:scale-95 ${sizeClasses[size]} ${className}`}
    >
      {/* Gold Coin Icon */}
      <div className={`relative ${coinSizes[size]} rounded-full bg-gradient-to-br from-yellow-400 via-amber-400 to-orange-500 
                       flex items-center justify-center shadow-md shadow-amber-400/30`}>
        {/* Inner shine */}
        <div className="absolute inset-0.5 rounded-full bg-gradient-to-br from-yellow-300/50 to-transparent" />
        
        {/* Coin symbol */}
        <span className="relative text-white font-bold" style={{ fontSize: size === 'sm' ? '10px' : size === 'md' ? '12px' : '14px' }}>
          ₹
        </span>
        
        {/* Sparkle for bonus */}
        {hasBonus && (
          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500 flex items-center justify-center animate-pulse">
            <Sparkles className="w-2 h-2 text-white" />
          </div>
        )}
      </div>
      
      {/* Balance Text */}
      {showBalance && (
        <span className="font-bold text-gray-800 tracking-tight">
          {balance >= 1000 
            ? `₹${(balance / 1000).toFixed(1)}K` 
            : `₹${balance.toLocaleString()}`}
        </span>
      )}
      
      {/* Subtle shine animation */}
      <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent 
                        -translate-x-full animate-[shimmer_3s_infinite]" />
      </div>
    </button>
  );
}

// Floating Wallet Badge - for corner placement
export function WalletBadge({ 
  customerPhone, 
  onClick,
  position = 'top-right',
  className = ''
}: WalletIconProps & { position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' }) {
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWalletBalance();
    const interval = setInterval(loadWalletBalance, 30000);
    return () => clearInterval(interval);
  }, [customerPhone]);

  const loadWalletBalance = async () => {
    try {
      const res = await apiClient.get<any>(`/customer/wallet?phone=${encodeURIComponent(customerPhone)}`);
      if (res.wallet) {
        setBalance(res.wallet.balance || 0);
      }
    } catch (e) {
      console.log('Could not load wallet balance');
    } finally {
      setLoading(false);
    }
  };

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  if (loading || balance === 0) return null;

  return (
    <button
      onClick={onClick}
      className={`fixed ${positionClasses[position]} z-40 flex items-center gap-2 
                  bg-white/90 backdrop-blur-md rounded-full pl-2 pr-3 py-2
                  border border-amber-200 shadow-lg shadow-amber-500/20
                  hover:shadow-xl hover:scale-105 transition-all duration-200 ${className}`}
    >
      {/* Animated Coin */}
      <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 via-amber-400 to-orange-500 
                      flex items-center justify-center shadow-md animate-[bounce_2s_infinite]">
        <span className="text-white font-bold text-sm">₹</span>
        <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent to-white/30" />
      </div>
      
      <div className="text-left">
        <p className="text-xs text-gray-500 leading-none">Wallet</p>
        <p className="font-bold text-gray-900 text-sm leading-tight">₹{balance.toLocaleString()}</p>
      </div>
    </button>
  );
}

// Compact wallet display for headers
export function WalletCompact({ 
  customerPhone, 
  onClick,
  className = ''
}: WalletIconProps) {
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWalletBalance();
  }, [customerPhone]);

  const loadWalletBalance = async () => {
    try {
      const res = await apiClient.get<any>(`/customer/wallet?phone=${encodeURIComponent(customerPhone)}`);
      if (res.wallet) {
        setBalance(res.wallet.balance || 0);
      }
    } catch (e) {
      console.log('Could not load wallet balance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-1.5 text-gray-700 hover:text-orange-600 transition-colors ${className}`}
    >
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
        <Wallet className="w-3.5 h-3.5 text-white" />
      </div>
      <span className="font-medium text-sm">
        {loading ? '...' : `₹${balance.toLocaleString()}`}
      </span>
    </button>
  );
}

export default WalletIcon;
