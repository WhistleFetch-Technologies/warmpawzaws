"use client";

// Placeholder component - to be implemented
interface OrderTrackingPageProps {
  orderId: string;
  onBack?: () => void;
}

export function OrderTrackingPage({ orderId, onBack }: OrderTrackingPageProps) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Order Tracking</h1>
      <p className="text-gray-500">Order tracking page coming soon</p>
      {onBack && (
        <button onClick={onBack} className="mt-4 text-blue-600">Back</button>
      )}
    </div>
  );
}

