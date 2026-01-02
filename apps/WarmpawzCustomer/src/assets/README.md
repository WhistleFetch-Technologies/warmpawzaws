# Assets Directory

This directory contains image assets for the Warmpawz Customer Mobile App.

## Logo Assets

### Required Logo Files

1. **`logo.png`** or **`logo.svg`**
   - Main logo: Black paw print with dog and cat silhouettes
   - Text: "Warmpawz" in stylized yellow/gold font
   - Usage: Login, OTP, and other authentication screens
   - Recommended size: 200x200px (or scalable SVG)

2. **`logo-white.png`** (optional)
   - White version for dark backgrounds
   - Same design as main logo but inverted colors

### Logo Specifications

- **Design:** Black paw print outline with white interior
- **Animals:** Dog silhouette (sitting, left side) + Cat head (right side)
- **Text:** "Warmpawz" in cursive/stylized font with yellow outline
- **Format:** PNG (with transparency) or SVG (preferred for scalability)

### Current Status

- ✅ Logo placeholder implemented in `CustomerAuthScreen.tsx`
- ⏳ Waiting for actual logo asset from design team
- 📝 To replace: Update logo placeholder in auth screens when asset is available

### Usage

```typescript
// In CustomerAuthScreen.tsx
// Replace this placeholder:
<View style={styles.logoPlaceholder}>
  <Text style={styles.logoPaw}>🐾</Text>
  ...
</View>

// With actual image:
<Image 
  source={require('../assets/logo.png')} 
  style={styles.logoImage}
  resizeMode="contain"
/>
```

## Directory Structure

```
src/assets/
├── images/
│   ├── logo.png          (Main logo - TO BE ADDED)
│   ├── logo-white.png    (Optional - TO BE ADDED)
│   └── README.md         (This file)
```

## Notes

- All image assets should be optimized for mobile
- Use PNG for logos with transparency
- Use SVG for scalable graphics (if supported)
- Keep file sizes minimal for faster app loading

