"use client";

// Placeholder component - to be implemented
interface AddressBookPageProps {
  onNavigate?: (path: string) => void;
}

export function AddressBookPage({ onNavigate }: AddressBookPageProps = {}) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Address Book</h1>
      <p className="text-gray-500">Address book page coming soon</p>
    </div>
  );
}

