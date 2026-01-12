# Warmpawz Branding Guidelines

**Source:** Figma Design System  
**URL:** https://www.figma.com/make/3iZpBgWT8zlJKMY9qC5cn0/Refine-UI-with-Branding-Guidelines  
**Last Updated:** December 2024

---

## 🎨 Brand Identity

### Mission
Warmpawz is a comprehensive multi-vendor pet marketplace that connects pet owners with trusted service providers, creating a warm, caring community for pets and their families.

### Brand Values
- **Warmth**: Creating a welcoming, caring environment
- **Trust**: Building reliable connections between owners and providers
- **Quality**: Ensuring the highest standards in pet care
- **Community**: Fostering connections among pet lovers
- **Innovation**: Leveraging technology to improve pet care

---

## 🎯 Design Principles

### 1. Warm & Welcoming
- Use rounded corners and soft shadows
- Favor gradients over flat colors for key elements
- Incorporate playful animations that delight without distracting
- Use warm color palette (oranges, pinks) as primary brand colors

### 2. Clear & Accessible
- Minimum font size: 14px for body text
- Touch targets minimum 44px × 44px
- WCAG AA contrast ratios (4.5:1 minimum)
- Clear visual hierarchy with consistent spacing

### 3. Trust & Professionalism
- Use verified badges for approved vendors
- Display ratings and reviews prominently
- Show real photos over illustrations where trust matters
- Maintain clean, uncluttered layouts

### 4. Mobile-First
- Design for small screens first
- Progressive enhancement for larger devices
- Thumb-friendly navigation zones
- Bottom navigation for primary actions

---

## 🎨 Color System

### Primary Colors
Use the **warm orange palette** (`#FF8C42`) as the main brand color:
- Primary actions (Book Now, Add to Cart)
- Navigation active states
- Primary CTAs
- Brand elements

```css
background: linear-gradient(135deg, #FF8C42 0%, #FF6B9D 100%);
```

### Secondary Colors
Use the **vibrant pink palette** (`#FF6B9D`) for:
- Secondary actions
- Grooming services
- Playful elements
- Accent highlights

### Service-Specific Colors
Each service category has a dedicated color:
- **Veterinary**: Teal (`#26C6DA`) - Medical, clinical feel
- **Grooming**: Pink (`#FF6B9D`) - Care, pampering
- **Training**: Purple (`#9B59B6`) - Education, growth
- **Boarding**: Orange (`#FF8C42`) - Home, comfort
- **Walking**: Green (`#4CAF50`) - Outdoor, active
- **Nutrition**: Yellow (`#FFC857`) - Food, health
- **Pharmacy**: Blue (`#2196F3`) - Medical, prescriptions
- **Adoption**: Deep Pink (`#E91E63`) - Love, connection
- **Insurance**: Deep Purple (`#673AB7`) - Protection, security

**Rule:** Always use service-specific colors for service cards, badges, and category indicators.

---

## ✍️ Typography

### Font Family
Use **Inter** for all text (already in design system):
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

### Type Scale
- **Headings**: Use the scale from `globals.css` - do NOT override with Tailwind classes
- **Body**: 16px base (1rem)
- **Small**: 14px (0.875rem) for labels, captions
- **Tiny**: 12px (0.75rem) for timestamps, metadata

### Font Weights
- **Headings**: 600 (Semibold) or 700 (Bold)
- **Body**: 400 (Normal)
- **Emphasis**: 500 (Medium)
- **Labels**: 500 (Medium)

**IMPORTANT:** Do NOT use Tailwind typography classes (`text-2xl`, `font-bold`, `leading-none`) unless specifically requested. The design system handles this via CSS.

---

## 📐 Spacing & Layout

### Spacing Scale
Use the **4px base unit** system:
- xs: 4px
- sm: 8px
- md: 12px
- base: 16px
- lg: 24px
- xl: 32px
- 2xl: 48px

### Layout Grid
- **Columns**: 12-column grid
- **Gutter**: 16px
- **Max Width**: 1280px for content containers
- **Margins**: 16px on mobile, 24px on tablet, 32px on desktop

### Content Containers
```tsx
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  {/* Content */}
</div>
```

---

## 🎯 Component Guidelines

### Buttons

#### Primary Button
- **Background**: Orange gradient (`#FF8C42` to `#FF6B9D`)
- **Color**: White
- **Border Radius**: 8px (rounded-lg)
- **Padding**: 12px 24px
- **Font Weight**: 600 (Semibold)
- **Shadow**: Medium shadow on hover

```tsx
<Button className="bg-gradient-to-r from-orange-500 to-pink-500">
  Book Now
</Button>
```

#### Secondary Button
- **Background**: Transparent
- **Border**: 2px solid Orange
- **Color**: Orange
- **Hover**: Light orange background

```tsx
<Button variant="outline" className="border-orange-500 text-orange-500">
  View Details
</Button>
```

#### Destructive Button
- **Background**: Red
- **Color**: White
- **Use**: Cancel booking, delete actions

### Cards

#### Service Card
- **Background**: White
- **Border**: 1px solid gray-200
- **Border Radius**: 16px (rounded-xl)
- **Shadow**: Subtle on rest, medium on hover
- **Padding**: 24px
- **Hover Effect**: Lift with shadow transition

```tsx
<Card className="rounded-xl hover:shadow-md transition-shadow">
  <CardContent className="p-6">
    {/* Content */}
  </CardContent>
</Card>
```

#### Vendor Card
Must include:
- Service-specific color accent (top border or icon)
- Vendor photo/logo
- Rating stars (yellow)
- Distance from user
- Price range indicator
- Verified badge if applicable

### Badges

#### Status Badges
- **Active/Available**: Green background, green text
- **Pending**: Yellow background, yellow text
- **Completed**: Blue background, blue text
- **Cancelled**: Red background, red text

```tsx
<Badge className="bg-green-100 text-green-700">Active</Badge>
```

#### Service Type Badges
Use service-specific colors:
```tsx
<Badge className="bg-teal-100 text-teal-700">Veterinary</Badge>
<Badge className="bg-pink-100 text-pink-700">Grooming</Badge>
```

### Icons
- **Size**: Use Lucide React icons
- **Default Size**: 20px (w-5 h-5)
- **Large**: 24px (w-6 h-6) for feature cards
- **Small**: 16px (w-4 h-4) for inline text
- **Color**: Match text color or use service-specific colors

---

## 📱 Navigation Patterns

### Bottom Navigation (Mobile)
- **Position**: Fixed bottom
- **Items**: Maximum 4-5 items
- **Active State**: Orange color with label
- **Icons**: 24px with labels below

```tsx
<nav className="fixed bottom-0 left-0 right-0 bg-white border-t">
  <div className="flex justify-around">
    {/* Nav items */}
  </div>
</nav>
```

### Top Navigation (Desktop)
- **Height**: 64px
- **Background**: White with subtle shadow
- **Logo**: Left-aligned
- **Actions**: Right-aligned
- **Search**: Center (if applicable)

### Sidebar (Vendor/Admin Apps)
- **Width**: 256px (expanded), 64px (collapsed)
- **Background**: White or light gray
- **Active Item**: Orange background with rounded corners
- **Hover**: Light gray background

---

## 🖼️ Imagery Guidelines

### Photos
- **Preference**: Real photos of pets and services over stock images
- **Quality**: High resolution, well-lit
- **Aspect Ratio**: 
  - Cards: 16:9 or 4:3
  - Profiles: 1:1 (square)
  - Banners: 21:9 or 16:9
- **Fallback**: Use ImageWithFallback component

### Illustrations
- **Style**: Rounded, friendly, warm
- **Colors**: Brand palette with soft gradients
- **Use Cases**: Empty states, onboarding, errors

### Vendor Photos
- **Must Show**: Actual facility or staff
- **Avoid**: Generic stock photos
- **Verification**: Show "Verified Photo" badge

---

## ✨ Animation & Interaction

### Transitions
- **Duration**: 300ms (base), 150ms (fast), 500ms (slow)
- **Easing**: `cubic-bezier(0.4, 0, 0.2, 1)`
- **Properties**: Transform, opacity, shadow, colors

### Hover States
- **Cards**: Lift with shadow (`translateY(-4px)` + shadow)
- **Buttons**: Slight scale (`scale(1.02)`) + color lightening
- **Icons**: Color change only

### Loading States
- **Skeleton**: Gray pulse animation
- **Spinners**: Orange circular spinner
- **Progress**: Orange-to-pink gradient progress bar

### Microinteractions
- **Success**: Green checkmark with scale animation
- **Error**: Red shake animation
- **Add to Cart**: Bounce animation
- **Like/Favorite**: Heart fill animation

---

## 🎭 Voice & Tone

### General Tone
- Warm and friendly, never corporate
- Professional but approachable
- Empathetic and caring
- Encouraging and positive

### Writing Style

#### Headings
- Action-oriented: "Find Your Perfect Groomer"
- Benefit-focused: "Book Vet Visits in Minutes"
- Clear and specific: "Today's Bookings" (not "Bookings")

#### Buttons
Use action verbs:
- ✅ "Book Appointment"
- ✅ "Add Pet"
- ✅ "View Details"
- ❌ "Click Here"
- ❌ "Submit"

#### Error Messages
- Helpful, not blaming
- Solution-oriented
- Examples:
  - ✅ "Oops! Please add your pet's name to continue"
  - ❌ "Error: Name field is required"

#### Success Messages
- Celebratory and encouraging
- Examples:
  - ✅ "🎉 Booking confirmed! Your pup will love this!"
  - ❌ "Booking created successfully"

---

## 📋 Feature-Specific Guidelines

### Loyalty & Rewards
- **Color**: Golden yellow gradient (`#FFC857`)
- **Icon**: Coins with shine effect
- **Widget**: Animated golden coin button
- **Points Display**: Always show "Pawints" (not "Points")

### Ratings & Reviews
- **Stars**: Yellow (`#FFC857`)
- **Out of**: Show "4.8/5.0" format
- **Reviews Count**: Always include count "(128 reviews)"

### Booking Cards
Must show:
1. Service type badge (colored)
2. Date and time prominently
3. Status badge
4. Pet name and photo
5. Vendor name with avatar
6. Price paid
7. Quick actions (View, Reschedule, Cancel)

### Vendor Cards
Must show:
1. Service-specific colored accent
2. Verified badge (if applicable)
3. Rating with review count
4. Distance from user (if location enabled)
5. Price range (₹, ₹₹, ₹₹₹)
6. Response time or availability

### Pet Profiles
- **Photo**: Circular avatar with border
- **Species Icon**: Show alongside name
- **Colors**: Use soft, pet-friendly pastels
- **Quick Stats**: Age, breed, weight in compact format

---

## 🔒 Trust & Safety Indicators

### Verification Badges
- **Verified Vendor**: Green checkmark in circle
- **Background Verified**: Blue shield
- **Licensed**: Gold star badge

### Safety Features
- **Emergency Contact**: Always visible in red
- **Live GPS Tracking**: Show real-time when active
- **Insurance Badge**: Display if service is insured

---

## 📊 Data Visualization

### Charts
- **Library**: Recharts
- **Colors**: Use brand palette
- **Tooltips**: Show on hover with rounded corners
- **Grid**: Subtle gray lines
- **Axes**: Clear labels in gray-600

### Statistics Cards
- **Number**: Large, bold, in brand color
- **Label**: Below number in gray
- **Icon**: Top-right corner
- **Background**: White with subtle gradient

---

## ♿ Accessibility

### Minimum Requirements
- ✅ WCAG AA compliance (4.5:1 contrast)
- ✅ Keyboard navigation support
- ✅ Screen reader labels on all interactive elements
- ✅ Focus indicators visible (2px orange outline)
- ✅ Touch targets minimum 44px × 44px

### Color Blindness
- Don't rely solely on color to convey information
- Use icons, text labels, or patterns alongside colors
- Test with accessibility tools

### Motion
- Respect `prefers-reduced-motion`
- Provide option to disable animations
- Keep animations subtle and purposeful

---

## 🚫 Don'ts

### Visual Don'ts
- ❌ Don't use more than 3 colors in a single component
- ❌ Don't use flat design for primary CTAs (use gradients)
- ❌ Don't use drop shadows heavier than `shadow-lg`
- ❌ Don't mix border radius styles (stick to 8px/16px)
- ❌ Don't use pure black (`#000`) - use `gray-900` instead

### Content Don'ts
- ❌ Don't use technical jargon without explanation
- ❌ Don't blame users in error messages
- ❌ Don't use ALL CAPS except for badges/labels
- ❌ Don't say "Click here" or "Learn more" (be specific)
- ❌ Don't use exclamation marks excessively!!!

### Pattern Don'ts
- ❌ Don't have more than one primary action per screen
- ❌ Don't use modals for critical flows (use dedicated pages)
- ❌ Don't hide important actions in overflow menus
- ❌ Don't use carousels for critical information
- ❌ Don't auto-play videos with sound

---

## 📦 Component Library Reference

### Available Components
Refer to `/components/ui/` for pre-built components:
- `Button`, `Card`, `Badge`, `Input`, `Select`
- `Dialog`, `Sheet`, `Tabs`, `Accordion`
- `Table`, `Calendar`, `Avatar`, `Progress`
- Custom: `GoldenCoinWidget`, `SearchBar`

### Usage
Always import from component library:
```tsx
import { Button } from './components/ui/button';
import { Card, CardContent } from './components/ui/card';
```

---

## 🎨 Quick Reference

### Most Used Classes
```tsx
// Primary gradient button
className="bg-gradient-to-r from-orange-500 to-pink-500 text-white"

// Card hover effect
className="hover:shadow-md transition-shadow duration-300"

// Service badge
className="bg-teal-100 text-teal-700 rounded-full px-3 py-1"

// Status indicator (active)
className="flex items-center gap-2 text-green-600"

// Page container
className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
```

---

## 📞 Questions?

For clarification on branding guidelines:
1. Check `/guidelines/Assets.tsx` for design tokens
2. Review existing components in `/components/ui/`
3. Look at `CustomerHomeComplete.tsx` for reference implementation

**Remember:** Consistency is key. When in doubt, favor warmth, clarity, and trust-building elements.
