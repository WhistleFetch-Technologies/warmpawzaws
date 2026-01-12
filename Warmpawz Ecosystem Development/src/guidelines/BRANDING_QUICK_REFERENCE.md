# 🎨 Warmpawz Branding - Quick Reference Card

**For Developers & Designers**

---

## 🎨 COLOR PALETTE (Hex Codes)

### Primary Colors
```
🟠 Orange:  #FF8C42  (Primary brand color)
🩷 Pink:    #FF6B9D  (Secondary brand color)
🟡 Yellow:  #FFC857  (Loyalty/Rewards)
🟣 Purple:  #9B59B6  (Premium features)
```

### Service Colors
```
Veterinary:    #26C6DA  (Teal)
Grooming:      #FF6B9D  (Pink)
Training:      #9B59B6  (Purple)
Boarding:      #FF8C42  (Orange)
Walking:       #4CAF50  (Green)
Nutrition:     #FFC857  (Yellow)
Pharmacy:      #2196F3  (Blue)
Adoption:      #E91E63  (Deep Pink)
Insurance:     #673AB7  (Deep Purple)
```

### Semantic Colors
```
✅ Success:   #10B981
⚠️  Warning:   #F59E0B
❌ Error:     #EF4444
ℹ️  Info:      #3B82F6
```

---

## 🔤 TYPOGRAPHY

### Font
```css
font-family: 'Inter', sans-serif;
```

### Sizes (DO NOT USE TAILWIND CLASSES)
```
Headings: Use defaults from globals.css
Body:     16px (1rem)
Small:    14px (0.875rem)
Tiny:     12px (0.75rem)
```

### Weights
```
Normal:    400
Medium:    500
Semibold:  600 (headings)
Bold:      700 (emphasis)
```

---

## 📏 SPACING SCALE

```
4px   (1)
8px   (2)
12px  (3)
16px  (4) ← Base unit
24px  (6)
32px  (8)
48px  (12)
```

**Usage:**
```tsx
gap-4     // 16px
p-6       // 24px
mb-8      // 32px
```

---

## 🔘 BUTTONS

### Primary (Orange Gradient)
```tsx
<Button className="bg-gradient-to-r from-orange-500 to-pink-500">
  Book Now
</Button>
```

### Secondary (Outline)
```tsx
<Button variant="outline" className="border-orange-500 text-orange-500">
  View Details
</Button>
```

### Destructive
```tsx
<Button variant="destructive">
  Cancel Booking
</Button>
```

---

## 🃏 CARDS

### Standard Card
```tsx
<Card className="rounded-xl hover:shadow-md transition-shadow">
  <CardContent className="p-6">
    {/* Content */}
  </CardContent>
</Card>
```

### Service Card (with colored accent)
```tsx
<Card className="rounded-xl border-t-4 border-teal-500">
  <CardContent className="p-6">
    <Badge className="bg-teal-100 text-teal-700">Veterinary</Badge>
    {/* Rest of content */}
  </CardContent>
</Card>
```

---

## 🏷️ BADGES

### Status Badges
```tsx
// Active/Available
<Badge className="bg-green-100 text-green-700">Active</Badge>

// Pending
<Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>

// Completed
<Badge className="bg-blue-100 text-blue-700">Completed</Badge>

// Cancelled
<Badge className="bg-red-100 text-red-700">Cancelled</Badge>
```

### Service Type Badges
```tsx
<Badge className="bg-teal-100 text-teal-700">Veterinary</Badge>
<Badge className="bg-pink-100 text-pink-700">Grooming</Badge>
<Badge className="bg-purple-100 text-purple-700">Training</Badge>
```

---

## 📐 BORDER RADIUS

```tsx
rounded-lg    // 8px  (buttons, inputs)
rounded-xl    // 16px (cards, containers)
rounded-full  // 9999px (badges, avatars)
```

---

## 🌓 SHADOWS

```tsx
shadow-sm     // Subtle
shadow-md     // Medium (hover states)
shadow-lg     // Large (modals)
shadow-xl     // Extra large (dropdowns)
```

---

## 🎨 GRADIENTS

### Primary (Orange → Pink)
```tsx
className="bg-gradient-to-r from-orange-500 to-pink-500"
```

### Loyalty (Yellow → Orange)
```tsx
className="bg-gradient-to-r from-yellow-400 to-orange-400"
```

### Premium (Purple → Deep Purple)
```tsx
className="bg-gradient-to-r from-purple-500 to-purple-700"
```

### Success (Green)
```tsx
className="bg-gradient-to-r from-green-500 to-emerald-500"
```

---

## 🎭 ICONS

### Sizes
```tsx
w-4 h-4   // 16px (inline)
w-5 h-5   // 20px (default)
w-6 h-6   // 24px (large)
```

### Service Icons (Lucide React)
```
Veterinary:  Stethoscope
Grooming:    Scissors
Training:    GraduationCap
Boarding:    Home
Walking:     Footprints
Nutrition:   Apple
Pharmacy:    Pill
Adoption:    Heart
Insurance:   Shield
Emergency:   Siren
```

---

## ✍️ WRITING STYLE

### Headings ✅
```
"Find Your Perfect Groomer"
"Book Vet Visits in Minutes"
"Today's Bookings"
```

### Headings ❌
```
"Groomers"
"Bookings"
"Click Here"
```

### Buttons ✅
```
"Book Appointment"
"Add Pet Profile"
"View Details"
```

### Buttons ❌
```
"Submit"
"Click Here"
"OK"
```

### Error Messages ✅
```
"Oops! Please add your pet's name to continue"
"This time slot is unavailable. Try another?"
```

### Error Messages ❌
```
"Error: Name field is required"
"Invalid input"
```

---

## 📱 LAYOUT

### Page Container
```tsx
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  {/* Content */}
</div>
```

### Section Spacing
```tsx
<section className="mb-12">
  {/* Section content */}
</section>
```

### Grid
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {/* Cards */}
</div>
```

---

## ✨ ANIMATIONS

### Duration
```
Fast:  150ms
Base:  300ms
Slow:  500ms
```

### Common Transitions
```tsx
// Hover lift
className="transition-all duration-300 hover:-translate-y-1 hover:shadow-md"

// Color change
className="transition-colors duration-200 hover:bg-orange-100"

// Shadow change
className="transition-shadow duration-300 hover:shadow-lg"
```

---

## 🎯 COMMON PATTERNS

### Loading State
```tsx
<div className="flex items-center justify-center p-8">
  <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
</div>
```

### Empty State
```tsx
<div className="text-center py-12">
  <Icon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
  <h3 className="text-gray-600 mb-2">No bookings yet</h3>
  <p className="text-gray-500 text-sm">Book your first service to get started!</p>
  <Button className="mt-4 bg-gradient-to-r from-orange-500 to-pink-500">
    Browse Services
  </Button>
</div>
```

### Success Message
```tsx
<div className="bg-green-50 border border-green-200 rounded-lg p-4">
  <div className="flex items-center gap-2">
    <CheckCircle className="w-5 h-5 text-green-600" />
    <div>
      <h4 className="font-semibold text-green-900">Success!</h4>
      <p className="text-sm text-green-700">Your booking is confirmed</p>
    </div>
  </div>
</div>
```

### Error Message
```tsx
<div className="bg-red-50 border border-red-200 rounded-lg p-4">
  <div className="flex items-center gap-2">
    <XCircle className="w-5 h-5 text-red-600" />
    <div>
      <h4 className="font-semibold text-red-900">Oops!</h4>
      <p className="text-sm text-red-700">Please try again or contact support</p>
    </div>
  </div>
</div>
```

---

## 🔒 TRUST INDICATORS

### Verified Badge
```tsx
<div className="flex items-center gap-1">
  <CheckCircle className="w-4 h-4 text-green-600" />
  <span className="text-sm text-green-700">Verified</span>
</div>
```

### Rating Display
```tsx
<div className="flex items-center gap-2">
  <div className="flex">
    {[1,2,3,4,5].map(star => (
      <Star key={star} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
    ))}
  </div>
  <span className="text-sm text-gray-600">4.8 (128 reviews)</span>
</div>
```

---

## 📊 DATA DISPLAY

### Stat Card
```tsx
<Card className="p-6">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm text-gray-600">Total Bookings</p>
      <p className="text-3xl font-bold text-orange-600">247</p>
    </div>
    <Calendar className="w-12 h-12 text-orange-400 opacity-20" />
  </div>
</Card>
```

### Progress Bar
```tsx
<div className="w-full bg-gray-200 rounded-full h-2">
  <div 
    className="bg-gradient-to-r from-orange-500 to-pink-500 h-2 rounded-full"
    style={{ width: '75%' }}
  />
</div>
```

---

## 🚫 COMMON MISTAKES TO AVOID

❌ Using pure black (`#000000`) → Use `text-gray-900`  
❌ Typography classes (`text-2xl`, `font-bold`) → Use CSS defaults  
❌ Inconsistent border radius → Stick to `rounded-lg` or `rounded-xl`  
❌ Too many colors in one component → Max 3 colors  
❌ Generic button text → Use specific actions  
❌ Missing hover states → All interactive elements need hover  
❌ No loading states → Always show feedback  

---

## ✅ CHECKLIST

Before committing a component, verify:
- [ ] Uses brand colors from palette
- [ ] Has appropriate hover/active states
- [ ] Includes loading state if async
- [ ] Error states are helpful, not blaming
- [ ] Touch targets are 44px minimum
- [ ] Text contrast meets WCAG AA (4.5:1)
- [ ] Uses Inter font family
- [ ] Spacing follows 4px grid
- [ ] Border radius is consistent
- [ ] Icons are from Lucide React

---

## 📞 QUICK IMPORTS

```tsx
// UI Components
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Input } from './components/ui/input';

// Icons (most used)
import { 
  Heart, Star, Calendar, Clock, MapPin, Phone,
  CheckCircle, XCircle, AlertCircle, Info,
  Loader2, ChevronRight, Menu, X
} from 'lucide-react';

// Branding Assets
import { COLORS, GRADIENTS, SERVICE_ICONS } from '../guidelines/Assets';
import logoImage from 'figma:asset/da6636b92da744b3db8eed5288ca6da9ab889afe.png';
```

---

**Remember:** Warmth, Trust, Clarity ❤️🐾
