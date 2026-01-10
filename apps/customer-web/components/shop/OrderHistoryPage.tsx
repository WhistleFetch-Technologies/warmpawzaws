"use client";

// Placeholder component - to be implemented
interface OrderHistoryPageProps {
  onNavigate?: (path: string) => void;
}

export function OrderHistoryPage({ onNavigate }: OrderHistoryPageProps = {}) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Order History</h1>
      <p className="text-gray-500">Order history page coming soon</p>
    </div>
  );
}

