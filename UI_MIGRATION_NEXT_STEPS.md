# UI Component Migration - Next Steps

## ✅ Completed

1. ✅ Migrated all UI components from `warmpawz_mono` to `warmpawzecodev`
2. ✅ Updated core components with improved spacing and consistency
3. ✅ Added design tokens file
4. ✅ Updated package.json files with required dependencies
5. ✅ Updated imports in key files (AdminRolesPage, loyalty, banners)

## 🚀 Immediate Next Steps

### 1. Install Dependencies

```bash
# Install UI package dependencies
cd packages/ui
npm install

# Install admin-web dependencies
cd ../../apps/admin-web
npm install
```

### 2. Update Remaining Import Statements

The following files still use old imports (`@/components/ui/*`). Update them to use `@warmpawz/ui`:

**Files to update:**
- Any remaining files in `apps/admin-web/app/**/*.tsx`
- Any remaining files in `apps/admin-web/components/**/*.tsx`

**Find files that need updating:**
```bash
cd apps/admin-web
grep -r "from '@/components/ui" --include="*.tsx" --include="*.ts"
```

**Update pattern:**
```typescript
// OLD
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';

// NEW
import { Button, Card, CardHeader } from '@warmpawz/ui';
```

### 3. Test the Application

```bash
cd apps/admin-web
npm run dev
```

**Test checklist:**
- [ ] Admin dashboard loads without errors
- [ ] Buttons render correctly with proper spacing
- [ ] Cards have proper padding (px-6, gap-6)
- [ ] Dialogs open and close correctly
- [ ] Forms (Input, Select, Textarea) work properly
- [ ] Tables display correctly
- [ ] Tabs component works
- [ ] Accordion component works
- [ ] Check console for any import errors

### 4. Build Verification

```bash
cd apps/admin-web
npm run build
```

This will verify:
- All imports resolve correctly
- TypeScript types are correct
- No missing dependencies

## 📋 Component Usage Examples

### Button
```typescript
import { Button } from '@warmpawz/ui';

<Button variant="default">Primary</Button>
<Button variant="outline">Secondary</Button>
<Button variant="destructive">Delete</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
```

### Card
```typescript
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@warmpawz/ui';

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>Content</CardContent>
  <CardFooter>Footer</CardFooter>
</Card>
```

### Dialog
```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@warmpawz/ui';

<Dialog>
  <DialogTrigger>Open</DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
    </DialogHeader>
  </DialogContent>
</Dialog>
```

### Form Components
```typescript
import { Input, Label, Textarea, Select, Checkbox, Switch } from '@warmpawz/ui';

<Label>Name</Label>
<Input placeholder="Enter name" />
<Textarea placeholder="Enter description" />
<Select>...</Select>
<Checkbox />
<Switch />
```

## 🔧 Available Components

All these components are now available from `@warmpawz/ui`:

- ✅ `Button` - Improved spacing and variants
- ✅ `Card` - Better padding (px-6, gap-6)
- ✅ `Input` - Enhanced styling
- ✅ `Badge` - Complete badge component
- ✅ `Dialog` - Full dialog implementation
- ✅ `Label` - Radix UI label
- ✅ `Textarea` - Styled textarea
- ✅ `Checkbox` - Radix UI checkbox
- ✅ `Select` - Improved select component
- ✅ `Table` - Complete table component
- ✅ `Tabs` - Tabs component
- ✅ `Accordion` - Accordion component
- ✅ `Switch` - Switch component
- ✅ `useIsMobile` - Mobile detection hook
- ✅ `cn` - Utility function for className merging

## 🎨 Design Tokens

Design tokens are available at:
```typescript
import { WARM_ORANGE, BUTTON_VARIANTS, SPACING, TYPOGRAPHY } from '@/assets/design-tokens';
```

## 🐛 Troubleshooting

### Import Errors
If you see import errors:
1. Verify `@warmpawz/ui` is in `package.json` dependencies
2. Run `npm install` in both `packages/ui` and `apps/admin-web`
3. Check that `packages/ui/src/index.ts` exports the component

### Type Errors
If TypeScript complains:
1. Ensure all Radix UI packages are installed
2. Check that `packages/ui/package.json` has correct peer dependencies
3. Restart TypeScript server in your IDE

### Styling Issues
If components don't look right:
1. Verify `tailwind.config.js` includes the UI package in content paths
2. Check that `globals.css` has the correct CSS variables
3. Ensure Tailwind preset is loaded

## 📝 Migration Status

### Files Updated ✅
- `apps/admin-web/components/admin/AdminRolesPage.tsx`
- `apps/admin-web/app/loyalty/page.tsx`
- `apps/admin-web/app/banners/page.tsx`

### Files Still Using Old Imports
Run the grep command above to find remaining files.

## 🎯 Future Improvements

1. **Remove Old Components**: Once all files are migrated, consider removing `apps/admin-web/components/ui/*` (keep backups)
2. **Add More Components**: Consider migrating additional components from warmpawz_mono:
   - `drawer.tsx`
   - `dropdown-menu.tsx`
   - `popover.tsx`
   - `tooltip.tsx`
   - `skeleton.tsx`
   - `progress.tsx`
3. **Documentation**: Create Storybook or component documentation
4. **Testing**: Add component tests

## 📚 Resources

- **Design Tokens**: `apps/admin-web/assets/design-tokens.ts`
- **UI Package**: `packages/ui/src/`
- **Tailwind Preset**: `packages/ui/tailwind.preset.js`

---

**Last Updated**: After UI migration from warmpawz_mono
**Status**: ✅ Core migration complete, remaining files need import updates

