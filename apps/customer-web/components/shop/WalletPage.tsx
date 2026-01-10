"use client";

// Placeholder component - to be implemented
interface WalletPageProps {
  onNavigate?: (path: string) => void;
}

export function WalletPage({ onNavigate }: WalletPageProps = {}) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Wallet</h1>
      <p className="text-gray-500">Wallet page coming soon</p>
    </div>
  );
}

