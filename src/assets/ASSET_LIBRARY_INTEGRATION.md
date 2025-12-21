# Warmpawz Asset Library Integration Guide

## Overview

This asset library contains high-fidelity design components and assets matching the mobile design system. All components are production-ready and can be integrated throughout the application.

## Quick Start

### 1. Import Design Tokens

```typescript
import { WARM_ORANGE, WHITE, BLACK, LOGO_CIRCULAR_ORANGE } from '@/assets/design-tokens';
```

### 2. Use Pre-built Components

```typescript
import { WarmpawzButton } from '@/components/shared/design-system/WarmpawzButton';
import { ServiceCard } from '@/components/shared/design-system/ServiceCard';
import { BottomNavBar } from '@/components/shared/design-system/BottomNavBar';
import { ServiceConfigCard } from '@/components/shared/design-system/ServiceConfigCard';
import { DateSelector } from '@/components/shared/design-system/DateSelector';
import { LocationSelector } from '@/components/shared/design-system/LocationSelector';
```

## Available Components

### 1. WarmpawzButton

Button component matching the high-fidelity design.

**Variants:**
- `solid` - Solid orange button (primary)
- `outlined` - Outlined orange button (secondary)
- `icon` - Button with icon
- `disabled` - Disabled state

**Example:**
```tsx
<WarmpawzButton variant="solid" onClick={handleClick}>
  Get started
</WarmpawzButton>

<WarmpawzButton variant="outlined" icon={Phone} iconPosition="left">
  Get started
</WarmpawzButton>
```

### 2. ServiceCard

Service/role selection card with default and selected states.

**Example:**
```tsx
<ServiceCard
  title="Veterinarian"
  description="Medical care for pets"
  selected={isSelected}
  onClick={() => setSelected(true)}
  icon={Stethoscope}
/>
```

### 3. BottomNavBar

Mobile bottom navigation bar matching the design system.

**Example:**
```tsx
<BottomNavBar
  items={[
    { id: 'home', label: 'Home', icon: Home },
    { id: 'catalog', label: 'Catalog', icon: Package },
    { id: 'promos', label: 'Promos', icon: Gift },
    { id: 'payouts', label: 'Payouts', icon: DollarSign },
  ]}
  activeId={activeTab}
  onItemClick={setActiveTab}
/>
```

### 4. ServiceConfigCard

Service configuration card with toggles, inputs, and badges.

**Example:**
```tsx
<ServiceConfigCard
  serviceName="General Consultation"
  suggestedPrice="₹2500"
  isActive={isActive}
  onToggleActive={setIsActive}
  price={price}
  onPriceChange={setPrice}
  timeDuration={duration}
  onTimeDurationChange={setDuration}
  locationOptions={{
    atClinic: true,
    atHome: false,
    onToggleClinic: setAtClinic,
    onToggleHome: setAtHome,
  }}
/>
```

### 5. DateSelector

Date/time selector (Today, Week, Month).

**Example:**
```tsx
<DateSelector
  options={['Today', 'Week', 'Month']}
  selected={selectedPeriod}
  onSelect={setSelectedPeriod}
/>
```

### 6. LocationSelector

Location/map selector with pin and location details.

**Example:**
```tsx
<LocationSelector
  onLocationSelect={(location) => {
    console.log('Selected:', location);
  }}
  initialLocation={{
    lat: 19.0885,
    lng: 72.883382,
    address: 'Mumbai, Maharashtra, India',
  }}
/>
```

## Design Tokens

### Colors
- `WARM_ORANGE` - #FF8C42 (Primary brand color)
- `WHITE` - #FFFFFF
- `BLACK` - #000000
- `DARK_ORANGE_GOLD` - #E67A2E

### Logo Assets
- `LOGO_CIRCULAR_ORANGE` - Base64 encoded SVG logo

### Typography
- Font Family: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- Font Sizes: 12px, 14px, 16px, 18px, 20px, 24px
- Font Weights: 400 (normal), 500 (medium), 600 (semibold)

### Spacing
- xs: 4px
- sm: 8px
- md: 16px
- lg: 24px
- xl: 32px
- 2xl: 48px

### Border Radius
- sm: 4px
- md: 8px
- lg: 12px
- xl: 16px
- full: 9999px

## Integration Examples

### Replace Existing Buttons

**Before:**
```tsx
<button className="bg-orange-500 text-white px-4 py-2 rounded">
  Get started
</button>
```

**After:**
```tsx
<WarmpawzButton variant="solid">
  Get started
</WarmpawzButton>
```

### Replace Service Selection

**Before:**
```tsx
<div className="border rounded p-4">
  <h3>Veterinarian</h3>
</div>
```

**After:**
```tsx
<ServiceCard
  title="Veterinarian"
  description="Medical care for pets"
  selected={selected}
  onClick={() => setSelected(true)}
/>
```

### Replace Navigation

**Before:**
```tsx
<nav className="flex justify-around">
  <a href="/home">Home</a>
  <a href="/catalog">Catalog</a>
</nav>
```

**After:**
```tsx
<BottomNavBar
  items={navItems}
  activeId={activeTab}
  onItemClick={setActiveTab}
/>
```

## Asset Library Manager

Access the visual asset library:

```tsx
import { AssetLibraryManager } from '@/assets/asset-library';

// In your admin/content management page
<AssetLibraryManager />
```

This provides:
- Visual preview of all assets
- Code snippets for each component
- Usage examples
- Search and filter capabilities

## Migration Checklist

- [ ] Replace all button components with `WarmpawzButton`
- [ ] Update service/role selection cards to use `ServiceCard`
- [ ] Replace bottom navigation with `BottomNavBar`
- [ ] Update service configuration UI with `ServiceConfigCard`
- [ ] Replace date/time selectors with `DateSelector`
- [ ] Update location/map components with `LocationSelector`
- [ ] Replace logo imports with `LOGO_CIRCULAR_ORANGE`
- [ ] Update color references to use design tokens
- [ ] Test all components on mobile and web
- [ ] Verify accessibility (WCAG AA compliance)

## Best Practices

1. **Always use design tokens** - Don't hardcode colors or spacing
2. **Use semantic variants** - Choose the right button variant for the context
3. **Maintain consistency** - Use the same components throughout the app
4. **Test on mobile** - All components are mobile-first
5. **Accessibility** - All components include proper ARIA labels and keyboard navigation

## Support

For questions or issues with the asset library, refer to:
- Design tokens: `src/assets/design-tokens.ts`
- Component source: `src/components/shared/design-system/`
- Asset library: `src/assets/asset-library.tsx`

