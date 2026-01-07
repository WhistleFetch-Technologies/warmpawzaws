# 🧩 Components Documentation

## Overview

This document describes the shared components used across the Warmpawz web applications.

---

## 📦 Shared Components

### AdminLayout

**Location:** `apps/admin-web/components/AdminLayout.tsx`

**Purpose:** Provides a consistent sidebar navigation layout for all Admin Web pages.

**Props:**
```typescript
interface AdminLayoutProps {
  children: React.ReactNode;
}
```

**Usage:**
```tsx
import { AdminLayout } from '@/components/AdminLayout';

export default function MyPage() {
  return (
    <AdminLayout>
      <div>Page content here</div>
    </AdminLayout>
  );
}
```

**Features:**
- Fixed sidebar navigation
- Active route highlighting
- Responsive design
- Menu items:
  - Dashboard
  - Analytics
  - Vendors
  - Roles & Capabilities
  - Service Catalog
  - Settlements
  - Reports
  - Integrations
  - Governance
  - Logistics
  - Refunds

**Styling:**
- Sidebar: Dark slate background (`bg-slate-900`)
- Active item: Orange highlight (`bg-orange-500`)
- Responsive: Collapses on mobile

---

### VideoCall

**Location:** `packages/ui/src/components/VideoCall.tsx`

**Purpose:** Reusable video call component for tele-consultation services using AWS Chime SDK.

**Props:**
```typescript
interface VideoCallProps {
  bookingId: string;
  participantType: 'customer' | 'vendor';
  onEndCall?: () => void;
  onError?: (error: string) => void;
}
```

**Usage:**
```tsx
import { VideoCall } from '@warmpawz/ui/components/VideoCall';

function ConsultationPage({ bookingId }: { bookingId: string }) {
  return (
    <VideoCall
      bookingId={bookingId}
      participantType="customer"
      onEndCall={() => router.push('/bookings')}
      onError={(error) => console.error(error)}
    />
  );
}
```

**Features:**
- AWS Chime SDK integration
- Mute/unmute audio
- Toggle video on/off
- Call duration display
- Connection status indicators
- Automatic cleanup on unmount

**States:**
- `isConnecting` - Initial connection state
- `isConnected` - Call active state
- `isMuted` - Audio mute state
- `isVideoOff` - Video off state
- `callDuration` - Call duration in seconds

**Methods:**
- `initializeCall()` - Sets up AWS Chime meeting
- `toggleMute()` - Toggles audio mute
- `toggleVideo()` - Toggles video
- `endCall()` - Ends the call and cleans up
- `cleanup()` - Cleans up streams and intervals

**API Integration:**
- `GET /video-call/:bookingId/meeting-info` - Get meeting credentials
- `POST /video-call/:bookingId/end` - End call recording

**Dependencies:**
- AWS Chime SDK (to be integrated)
- React hooks (useState, useEffect, useRef)

---

## 🎨 Design System

### Colors

**Primary:**
- Orange: `#f97316` (Tailwind: `orange-500`)
- Used for: Buttons, active states, highlights

**Backgrounds:**
- Light: `#f8fafc` (Tailwind: `slate-50`)
- Dark: `#0f172a` (Tailwind: `slate-900`)

**Text:**
- Primary: `#1e293b` (Tailwind: `slate-800`)
- Secondary: `#64748b` (Tailwind: `slate-500`)

### Typography

**Headings:**
- H1: `text-2xl font-bold`
- H2: `text-xl font-semibold`
- H3: `text-lg font-medium`

**Body:**
- Default: `text-base`
- Small: `text-sm`
- Tiny: `text-xs`

### Spacing

- Consistent use of Tailwind spacing scale
- Padding: `p-4`, `p-6`, `p-8`
- Margin: `m-4`, `m-6`, `m-8`
- Gap: `gap-2`, `gap-4`, `gap-6`

### Buttons

**Primary:**
```tsx
<button className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600">
  Button Text
</button>
```

**Secondary:**
```tsx
<button className="bg-slate-200 text-slate-800 px-4 py-2 rounded-lg hover:bg-slate-300">
  Button Text
</button>
```

**Danger:**
```tsx
<button className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600">
  Button Text
</button>
```

---

## 📱 Responsive Design

### Breakpoints

- Mobile: `< 640px` (sm)
- Tablet: `640px - 1024px` (md)
- Desktop: `> 1024px` (lg)

### Mobile-First Approach

All components are designed mobile-first:
1. Base styles for mobile
2. `md:` prefix for tablet
3. `lg:` prefix for desktop

**Example:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Responsive grid */}
</div>
```

---

## 🔧 Component Patterns

### Loading States

```tsx
{loading ? (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
  </div>
) : (
  <div>Content</div>
)}
```

### Error States

```tsx
{error && (
  <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
    {error}
  </div>
)}
```

### Empty States

```tsx
{items.length === 0 ? (
  <div className="text-center py-12 text-slate-500">
    <p>No items found</p>
  </div>
) : (
  <div>Items list</div>
)}
```

### Modal Pattern

```tsx
{showModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 max-w-md w-full">
      <h2 className="text-xl font-bold mb-4">Modal Title</h2>
      <div>Modal content</div>
      <button onClick={() => setShowModal(false)}>Close</button>
    </div>
  </div>
)}
```

---

## 📚 Best Practices

### 1. Component Structure
- Keep components focused and single-purpose
- Extract reusable logic into custom hooks
- Use TypeScript for type safety

### 2. State Management
- Use React hooks (useState, useEffect)
- Lift state up when needed
- Avoid prop drilling

### 3. Performance
- Use React.memo for expensive components
- Lazy load heavy components
- Optimize re-renders

### 4. Accessibility
- Use semantic HTML
- Add ARIA labels where needed
- Ensure keyboard navigation works

### 5. Error Handling
- Always handle errors gracefully
- Show user-friendly error messages
- Log errors for debugging

---

**Last Updated:** January 6, 2026

