# Warmpawz NextJS - Component Architecture & Best Practices

**Version:** 1.0.0  
**Status:** PHASE 0 Complete

---

## 🎨 Component Architecture Overview

This document defines component patterns, organization, and lifecycle management for all Next.js applications.

---

## 📐 Component Classification

### 1. **Presentational Components** (Dumb Components)

- Pure UI rendering
- No business logic
- Receive all data via props
- Example: `Button`, `Card`, `Badge`

```typescript
// components/ui/Card.tsx
import React from "react";

interface CardProps {
	children: React.ReactNode;
	className?: string;
	onClick?: () => void;
}

export function Card({ children, className, onClick }: CardProps) {
	return (
		<div
			className={`bg-white rounded-lg shadow-md p-4 ${className || ""}`}
			onClick={onClick}
		>
			{children}
		</div>
	);
}
```

### 2. **Container Components** (Smart Components)

- Connect to data sources (React Query, Zustand)
- Fetch data
- Handle business logic orchestration
- Pass data to presentational components

```typescript
// components/booking/BookingHistory.tsx
"use client"; // Client component

import { useQuery } from "@tanstack/react-query";
import { bookingApi } from "@/lib/api-client";
import BookingCard from "./BookingCard";

export function BookingHistory() {
	const { data, isLoading, error } = useQuery({
		queryKey: ["bookings", "user"],
		queryFn: () => bookingApi.list(),
	});

	if (isLoading) return <LoadingSpinner />;
	if (error) return <ErrorMessage error={error} />;

	return (
		<div className="space-y-4">
			{data?.map((booking) => (
				<BookingCard key={booking.id} booking={booking} />
			))}
		</div>
	);
}
```

### 3. **Layout Components**

- Structure page layout
- Navigation
- Example: `Navbar`, `Sidebar`, `Footer`

```typescript
// components/common/Layout.tsx
import Navbar from "./Navbar";
import Footer from "./Footer";

interface LayoutProps {
	children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
	return (
		<div className="flex flex-col min-h-screen">
			<Navbar />
			<main className="flex-1 container mx-auto py-8">{children}</main>
			<Footer />
		</div>
	);
}
```

### 4. **Page Components**

- Next.js App Router pages
- Route-level components
- Location: `app/*/page.tsx`

```typescript
// app/(protected)/bookings/page.tsx
"use client";

import { BookingHistory } from "@/components/booking/BookingHistory";

export default function BookingsPage() {
	return (
		<div>
			<h1>My Bookings</h1>
			<BookingHistory />
		</div>
	);
}
```

---

## 🏗️ Component Organization Strategy

### By Feature (Recommended)

```
components/
├── booking/          # All booking-related components
│   ├── BookingCard.tsx
│   ├── BookingForm.tsx
│   ├── BookingHistory.tsx
│   ├── BookingStatus.tsx
│   └── index.ts
│
├── vendor/           # All vendor-related components
│   ├── VendorCard.tsx
│   ├── VendorProfile.tsx
│   ├── VendorSearch.tsx
│   └── index.ts
│
├── common/           # Shared across features
│   ├── Navbar.tsx
│   ├── Footer.tsx
│   ├── LoadingSpinner.tsx
│   └── index.ts
│
└── ui/               # Base UI building blocks
    ├── Button.tsx
    ├── Input.tsx
    ├── Dialog.tsx
    └── index.ts
```

### Barrel Exports (index.ts)

```typescript
// components/booking/index.ts
export { BookingCard } from "./BookingCard";
export { BookingForm } from "./BookingForm";
export { BookingHistory } from "./BookingHistory";
export { BookingStatus } from "./BookingStatus";
```

Usage:

```typescript
import { BookingCard, BookingForm, BookingHistory } from "@/components/booking";
```

---

## 📋 Component Templates

### Template 1: Presentational Component

```typescript
// components/booking/BookingCard.tsx
import React from "react";
import { Booking } from "@warmpawz/api-contracts";
import { formatDate } from "@warmpawz/shared-libs";

interface BookingCardProps {
	booking: Booking;
	onViewDetails?: (id: string) => void;
	onCancel?: (id: string) => void;
}

/**
 * Displays a single booking card with status and actions.
 * This is a presentational component - no data fetching.
 */
export function BookingCard({
	booking,
	onViewDetails,
	onCancel,
}: BookingCardProps) {
	const statusColor = {
		pending: "bg-yellow-100 text-yellow-800",
		confirmed: "bg-green-100 text-green-800",
		cancelled: "bg-red-100 text-red-800",
		completed: "bg-blue-100 text-blue-800",
	}[booking.status];

	return (
		<div className="border rounded-lg p-4 hover:shadow-md transition">
			<div className="flex justify-between items-start mb-3">
				<div>
					<h3 className="font-semibold">{booking.serviceName}</h3>
					<p className="text-sm text-gray-600">{booking.vendorName}</p>
				</div>
				<span className={`px-3 py-1 rounded-full text-sm ${statusColor}`}>
					{booking.status}
				</span>
			</div>

			<div className="space-y-2 text-sm text-gray-600 mb-4">
				<p>📅 {formatDate(booking.scheduledAt)}</p>
				<p>💰 {booking.amount}</p>
			</div>

			<div className="flex gap-2">
				{onViewDetails && (
					<button
						onClick={() => onViewDetails(booking.id)}
						className="flex-1 bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
					>
						View Details
					</button>
				)}
				{onCancel && booking.status === "pending" && (
					<button
						onClick={() => onCancel(booking.id)}
						className="flex-1 border border-red-500 text-red-500 py-2 rounded hover:bg-red-50"
					>
						Cancel
					</button>
				)}
			</div>
		</div>
	);
}

export default BookingCard;
```

### Template 2: Container Component

```typescript
// components/booking/BookingHistory.tsx
"use client"; // This is a client component

import React, { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { bookingApi } from "@/lib/api-client";
import { BookingCard } from "./BookingCard";
import { LoadingSpinner } from "@/components/common";
import { ErrorMessage } from "@/components/common";

/**
 * Fetches and displays booking history.
 * This is a container component - handles data fetching and passes to presentational child.
 */
export function BookingHistory() {
	const router = useRouter();

	const {
		data: bookings,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["bookings", "history"],
		queryFn: async () => {
			const response = await bookingApi.list();
			return response.data;
		},
		staleTime: 5 * 60 * 1000, // 5 minutes
	});

	const handleViewDetails = useCallback(
		(bookingId: string) => {
			router.push(`/bookings/${bookingId}`);
		},
		[router]
	);

	const handleCancel = useCallback((bookingId: string) => {
		// Show confirmation dialog
		if (confirm("Are you sure you want to cancel this booking?")) {
			bookingApi.cancel(bookingId);
			// React Query will handle cache invalidation
		}
	}, []);

	if (isLoading) return <LoadingSpinner />;
	if (error) return <ErrorMessage error={error} />;
	if (!bookings?.length) {
		return <p className="text-center text-gray-500">No bookings yet</p>;
	}

	return (
		<div className="space-y-4">
			{bookings.map((booking) => (
				<BookingCard
					key={booking.id}
					booking={booking}
					onViewDetails={handleViewDetails}
					onCancel={handleCancel}
				/>
			))}
		</div>
	);
}

export default BookingHistory;
```

### Template 3: Form Component

```typescript
// components/booking/BookingForm.tsx
"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateBookingSchema } from "@warmpawz/api-contracts";
import { bookingApi } from "@/lib/api-client";

interface BookingFormProps {
	vendorId: string;
	onSuccess?: () => void;
}

export function BookingForm({ vendorId, onSuccess }: BookingFormProps) {
	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm({
		resolver: zodResolver(CreateBookingSchema),
	});

	const { mutate, isPending } = useMutation({
		mutationFn: (data) => bookingApi.create({ ...data, vendorId }),
		onSuccess: () => {
			onSuccess?.();
		},
	});

	return (
		<form onSubmit={handleSubmit((data) => mutate(data))} className="space-y-4">
			<div>
				<label className="block text-sm font-medium mb-2">Service</label>
				<select
					{...register("serviceId")}
					className="w-full border rounded px-3 py-2"
				>
					<option value="">Select a service</option>
				</select>
				{errors.serviceId && (
					<p className="text-red-500 text-sm mt-1">
						{errors.serviceId.message}
					</p>
				)}
			</div>

			<div>
				<label className="block text-sm font-medium mb-2">Date & Time</label>
				<input
					type="datetime-local"
					{...register("scheduledAt")}
					className="w-full border rounded px-3 py-2"
				/>
				{errors.scheduledAt && (
					<p className="text-red-500 text-sm mt-1">
						{errors.scheduledAt.message}
					</p>
				)}
			</div>

			<button
				type="submit"
				disabled={isPending}
				className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:opacity-50"
			>
				{isPending ? "Booking..." : "Book Service"}
			</button>
		</form>
	);
}

export default BookingForm;
```

### Template 4: Dialog/Modal Component

```typescript
// components/ui/Dialog.tsx
"use client";

import React, { ReactNode } from "react";
import { createPortal } from "react-dom";

interface DialogProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	children: ReactNode;
	actions?: ReactNode;
}

export function Dialog({
	isOpen,
	onClose,
	title,
	children,
	actions,
}: DialogProps) {
	if (!isOpen) return null;

	return createPortal(
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			{/* Backdrop */}
			<div className="absolute inset-0 bg-black/50" onClick={onClose} />

			{/* Modal */}
			<div className="relative bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
				<div className="flex justify-between items-center p-6 border-b">
					<h2 className="text-lg font-semibold">{title}</h2>
					<button
						onClick={onClose}
						className="text-gray-500 hover:text-gray-700"
					>
						✕
					</button>
				</div>

				<div className="p-6">{children}</div>

				{actions && <div className="flex gap-3 p-6 border-t">{actions}</div>}
			</div>
		</div>,
		document.body
	);
}

export default Dialog;
```

---

## 🪝 Custom Hooks Strategy

### Hook Categories

#### 1. Data-Fetching Hooks

```typescript
// hooks/useBooking.ts
import { useQuery } from "@tanstack/react-query";
import { bookingApi } from "@/lib/api-client";

export function useBooking(bookingId: string) {
	return useQuery({
		queryKey: ["booking", bookingId],
		queryFn: () => bookingApi.get(bookingId),
		staleTime: 5 * 60 * 1000,
	});
}
```

#### 2. Mutation Hooks

```typescript
// hooks/useCreateBooking.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bookingApi } from "@/lib/api-client";

export function useCreateBooking() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data) => bookingApi.create(data),
		onSuccess: (newBooking) => {
			// Invalidate list query
			queryClient.invalidateQueries({
				queryKey: ["bookings"],
			});
			// Optionally update cache directly
			queryClient.setQueryData(["booking", newBooking.id], newBooking);
		},
	});
}
```

#### 3. Authentication Hook

```typescript
// hooks/useAuth.ts
import { useContext } from "react";
import { AuthContext } from "@/context/AuthContext";

export function useAuth() {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within AuthProvider");
	}
	return context;
}
```

#### 4. Global State Hook (Zustand)

```typescript
// hooks/useFilters.ts
import { useFilterStore } from "@/stores/filterStore";

export function useFilters() {
	return useFilterStore((state) => ({
		filters: state.filters,
		setFilters: state.setFilters,
		clearFilters: state.clearFilters,
	}));
}
```

---

## 🔄 Data Flow Patterns

### Pattern 1: Simple Fetch & Display

```typescript
// Page Component
function BookingsPage() {
	return (
		<div>
			<h1>My Bookings</h1>
			<BookingHistory />
		</div>
	);
}

// Container Component
function BookingHistory() {
	const { data, isLoading } = useQuery({
		queryKey: ["bookings"],
		queryFn: bookingApi.list,
	});

	if (isLoading) return <Spinner />;

	return (
		<div>
			{data?.map((booking) => (
				<BookingCard key={booking.id} booking={booking} />
			))}
		</div>
	);
}

// Presentational Component
function BookingCard({ booking }) {
	return <div>{booking.serviceName}</div>;
}
```

### Pattern 2: With Mutation

```typescript
function BookingCard({ booking }) {
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const { mutate: cancelBooking } = useMutation({
		mutationFn: () => bookingApi.cancel(booking.id),
		onSuccess: () => setIsDialogOpen(false),
	});

	return (
		<div>
			<h3>{booking.serviceName}</h3>
			<button onClick={() => setIsDialogOpen(true)}>Cancel</button>
			<Dialog
				isOpen={isDialogOpen}
				onClose={() => setIsDialogOpen(false)}
				title="Cancel Booking?"
				actions={
					<>
						<button onClick={() => setIsDialogOpen(false)}>Keep</button>
						<button onClick={() => cancelBooking()}>Cancel Booking</button>
					</>
				}
			>
				<p>This action cannot be undone.</p>
			</Dialog>
		</div>
	);
}
```

### Pattern 3: With Global State

```typescript
function VendorSearch() {
	const { filters, setFilters } = useFilters();
	const { data: vendors } = useQuery({
		queryKey: ["vendors", filters],
		queryFn: () => vendorApi.search(filters),
	});

	return (
		<div>
			<FilterBar filters={filters} onFilterChange={setFilters} />
			{vendors?.map((vendor) => (
				<VendorCard key={vendor.id} vendor={vendor} />
			))}
		</div>
	);
}
```

---

## 🎯 Best Practices

### 1. Component Composition

```typescript
// ✅ Good: Small, focused components
function Button({ label, onClick }) {
  return <button onClick={onClick}>{label}</button>;
}

function PrimaryButton({ label, onClick }) {
  return <Button label={label} onClick={onClick} className="bg-blue-500" />;
}

// ❌ Bad: Too many responsibilities
function ComplexButton({ onClick, api, userId, showDialog, ... }) {
  // Too much logic
}
```

### 2. Props Drilling Prevention

```typescript
// ✅ Use Context instead of prop drilling
const BookingContext = createContext<BookingContextType | null>(null);

function BookingProvider({ children }) {
	const [booking, setBooking] = useState<Booking | null>(null);
	return (
		<BookingContext.Provider value={{ booking, setBooking }}>
			{children}
		</BookingContext.Provider>
	);
}

// ❌ Avoid deep prop drilling
<Page booking={booking} setBo={setBooking}>
	<Section booking={booking} setBooking={setBooking}>
		<Component booking={booking} setBooking={setBooking} />
	</Section>
</Page>;
```

### 3. Memoization (Use Sparingly)

```typescript
// ✅ Memoize if re-renders are expensive
const BookingCard = memo(
	({ booking, onCancel }: Props) => {
		return <div>{/* Complex rendering */}</div>;
	},
	(prev, next) => {
		return prev.booking.id === next.booking.id;
	}
);

// ❌ Don't memoize by default
const SimpleCard = memo(({ title }: Props) => {
	return <div>{title}</div>;
});
```

### 4. Event Handler Optimization

```typescript
// ✅ Use useCallback for stable references
function VendorCard({ vendor }) {
	const handleSelect = useCallback(() => {
		router.push(`/vendors/${vendor.id}`);
	}, [vendor.id, router]);

	return <Card onClick={handleSelect}>{vendor.name}</Card>;
}

// ❌ Inline functions cause unnecessary re-renders
function VendorCard({ vendor }) {
	return (
		<Card onClick={() => router.push(`/vendors/${vendor.id}`)}>
			{vendor.name}
		</Card>
	);
}
```

### 5. Conditional Rendering

```typescript
// ✅ Use early returns
function BookingDetails({ bookingId }) {
  const { data, isLoading, error } = useQuery({...});

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!data) return <NotFound />;

  return <DetailsView booking={data} />;
}

// ❌ Nested ternaries are hard to read
function BookingDetails({ bookingId }) {
  const { data, isLoading, error } = useQuery({...});
  return isLoading ? <Spinner /> : error ? <ErrorMessage /> : !data ? <NotFound /> : <DetailsView />;
}
```

### 6. Type Safety

```typescript
// ✅ Full TypeScript for Props
interface BookingCardProps {
	booking: Booking;
	onSelect?: (id: string) => void;
	isLoading?: boolean;
}

export function BookingCard({
	booking,
	onSelect,
	isLoading = false,
}: BookingCardProps) {
	// ...
}

// ❌ Using any or no types
export function BookingCard(props: any) {
	// ...
}
```

---

## 🧪 Component Testing Patterns

```typescript
// components/__tests__/BookingCard.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { BookingCard } from "../BookingCard";
import { mockBooking } from "@/tests/mocks";

describe("BookingCard", () => {
	it("renders booking details", () => {
		render(<BookingCard booking={mockBooking} />);

		expect(screen.getByText(mockBooking.serviceName)).toBeInTheDocument();
		expect(screen.getByText(mockBooking.vendorName)).toBeInTheDocument();
	});

	it("calls onCancel when cancel button is clicked", () => {
		const onCancel = jest.fn();
		render(<BookingCard booking={mockBooking} onCancel={onCancel} />);

		fireEvent.click(screen.getByText("Cancel"));
		expect(onCancel).toHaveBeenCalledWith(mockBooking.id);
	});

	it("disables cancel button for completed bookings", () => {
		const completedBooking = { ...mockBooking, status: "completed" };
		render(<BookingCard booking={completedBooking} />);

		expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
	});
});
```

---

## 📦 Component Library Structure

```
components/
├── ui/                          # Base components (Radix + Tailwind)
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Dialog.tsx
│   ├── Select.tsx
│   ├── Card.tsx
│   └── index.ts
│
├── common/                       # Shared across apps
│   ├── Navbar.tsx
│   ├── Footer.tsx
│   ├── LoadingSpinner.tsx
│   ├── ErrorMessage.tsx
│   └── index.ts
│
├── [feature]/                    # Feature-specific
│   ├── [ComponentName].tsx       # Presentational
│   ├── [ComponentName]Container.tsx  # Container (if needed)
│   ├── use[Feature].ts          # Custom hooks
│   └── index.ts                  # Barrel export
│
└── [feature]/__tests__/          # Tests
    └── [ComponentName].test.tsx
```

---

## ✅ Component Checklist

Before submitting a component PR:

- [ ] Component has clear, single responsibility
- [ ] Props are typed with TypeScript interfaces
- [ ] Component accepts `children` when appropriate
- [ ] Accessibility attributes included (aria-\*, role, etc.)
- [ ] Responsive design tested (mobile, tablet, desktop)
- [ ] Error states handled
- [ ] Loading states shown
- [ ] No hardcoded text (use i18n if needed)
- [ ] Tests written for business logic
- [ ] PropTypes or TypeScript checked
- [ ] No prop drilling (use Context if needed)
- [ ] No unnecessary re-renders
- [ ] Storybook story created (if UI component)

---

**END OF COMPONENT ARCHITECTURE DOCUMENT**
