# Frontend Local Development Setup

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

The frontend will be available at:
- **Local URL:** http://localhost:3000
- The browser should open automatically

## Development Server Details

- **Framework:** React 19 with Vite
- **Port:** 3000
- **Hot Reload:** Enabled (automatic refresh on file changes)
- **Build Tool:** Vite 6.4.1

## Available Scripts

### Development
```bash
npm run dev
```
Starts the development server with hot module replacement.

### Production Build
```bash
npm run build
```
Creates an optimized production build in the `build/` directory.

## Project Structure

```
src/
├── components/          # React components
│   ├── admin/          # Admin portal components
│   ├── customer/       # Customer app components
│   ├── vendor/         # Vendor app components
│   └── ui/             # Shared UI components
├── App.tsx             # Main app component
├── main.tsx           # Entry point
└── utils/             # Utility functions
```

## Configuration

### Vite Config
- **Entry:** `src/main.tsx`
- **HTML Template:** `index.html`
- **Output Directory:** `build/`
- **Port:** 3000

### API Configuration
The frontend connects to the deployed Supabase Edge Function:
```
https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475
```

This is configured in:
- `src/utils/supabase/info.tsx` - Project ID and keys
- Component files use `API_BASE` variable

## Troubleshooting

### Port Already in Use
If port 3000 is already in use:
1. Kill the process using port 3000:
   ```bash
   lsof -ti:3000 | xargs kill -9
   ```
2. Or change the port in `vite.config.ts`:
   ```typescript
   server: {
     port: 3001, // Change to available port
   }
   ```

### Dependencies Issues
If you encounter dependency errors:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Build Errors
Check for TypeScript errors:
```bash
npx tsc --noEmit
```

## Development Tips

1. **Hot Reload:** Changes to files automatically refresh the browser
2. **Console Logs:** Check browser console for runtime errors
3. **Network Tab:** Monitor API calls in browser DevTools
4. **React DevTools:** Install React DevTools browser extension for debugging

## Environment Variables

If you need environment variables, create a `.env` file:
```env
VITE_SUPABASE_URL=https://vpvpbdwtyugbknrntkho.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

Access in code:
```typescript
import.meta.env.VITE_SUPABASE_URL
```

## Next Steps

1. ✅ Frontend is running on http://localhost:3000
2. ✅ Backend is deployed and accessible
3. ⚠️  Verify API connections are working
4. ⚠️  Test authentication flows
5. ⚠️  Test booking flows

---

**Status:** ✅ Frontend Development Server Running  
**URL:** http://localhost:3000

