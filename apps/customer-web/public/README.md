# Public Assets

Place the following files in this directory:

- `logo.png` - Warmpawz logo (the orange circle with paw and dog/cat silhouettes)
- `favicon.ico` - Favicon for browser tab (can be generated from logo.png)

The logo should be:
- Format: PNG with transparency
- Recommended size: 512x512 pixels minimum
- Used in: Header, Auth page, Welcome screen

---

## Push Notification Icons

The Firebase messaging service worker references notification icons at:
- /icons/icon-192x192.webp  (192×192 px, PNG)
- /icons/badge-72x72.webp   (72×72 px, PNG, monochrome recommended)

To enable icons in push notifications:
1. Create a folder: public/icons/
2. Place icon-192x192.png (app icon, 192×192) in that folder
3. Place badge-72x72.png (monochrome badge, 72×72) in that folder
4. Uncomment the icon and badge lines in firebase-messaging-sw.js

Until these files are added, notifications display without icons (non-breaking).

