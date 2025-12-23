# Deployment Guide

**Date**: 2025-01-22  
**Status**: ✅ Ready for Deployment

## 🚀 Quick Deploy

### Deploy Both (Backend + Frontend)
```bash
./DEPLOY_ALL.sh
```

### Deploy Backend Only
```bash
./DEPLOY_BACKEND.sh
```

### Deploy Frontend Only
```bash
./DEPLOY_FRONTEND.sh
```

---

## 📦 Backend Deployment (Supabase)

### Prerequisites
1. **Supabase CLI**: Will be installed automatically via npx
2. **Authentication**: Login required

### Step-by-Step

#### 1. Login to Supabase
```bash
npx supabase login
```
This will open your browser for authentication.

#### 2. Deploy Function
```bash
./DEPLOY_BACKEND.sh
```

Or manually:
```bash
npx supabase functions deploy make-server-3dd53475 \
  --project-ref vpvpbdwtyugbknrntkho \
  --no-verify-jwt
```

### Function Details
- **Function**: `make-server-3dd53475`
- **Project**: `vpvpbdwtyugbknrntkho`
- **URL**: `https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475`

### Verify Deployment
```bash
curl https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/health \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

---

## 🖥️ Frontend Deployment

### Prerequisites
1. **Build completed**: ✅ Already built in `build/` directory
2. **Deployment CLI**: Vercel or Netlify

### Option 1: Vercel (Recommended)

#### Install Vercel CLI
```bash
npm install -g vercel
```

#### Login
```bash
vercel login
```

#### Deploy
```bash
vercel --prod
```

### Option 2: Netlify

#### Install Netlify CLI
```bash
npm install -g netlify-cli
```

#### Login
```bash
netlify login
```

#### Deploy
```bash
netlify deploy --prod --dir=build
```

### Option 3: Manual Upload

Upload all files from `build/` directory to:
- AWS S3 + CloudFront
- Google Cloud Storage
- Azure Static Web Apps
- Any static hosting provider

### Frontend Build Details
- **Framework**: React 19 with Vite
- **Build Location**: `build/` directory
- **Size**: ~4.9 MB (gzipped: ~1 MB)
- **API Endpoint**: Configured to use deployed backend

---

## 🔧 Troubleshooting

### Backend Issues

**Error: Access token not provided**
```bash
# Solution: Login first
npx supabase login
```

**Error: Function directory not found**
```bash
# Solution: The script will create it automatically
# Or manually:
mkdir -p supabase/functions/make-server-3dd53475
cp -r src/supabase/functions/server/* supabase/functions/make-server-3dd53475/
```

### Frontend Issues

**Error: No CLI found**
```bash
# Install Vercel CLI
npm install -g vercel

# OR Install Netlify CLI
npm install -g netlify-cli
```

**Error: Build directory not found**
```bash
# Build the frontend first
npm run build
```

---

## 📊 Deployment Status

### Backend ✅
- [x] SQL-based endpoints ready
- [x] Deployment script ready
- [x] Function structure prepared
- [ ] Deployed (requires login)

### Frontend ✅
- [x] Production build complete
- [x] Build optimized
- [x] Ready for deployment
- [ ] Deployed (requires CLI installation)

---

## 🔗 Important URLs

- **Backend Dashboard**: https://supabase.com/dashboard/project/vpvpbdwtyugbknrntkho/functions
- **Backend URL**: https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475
- **Project Dashboard**: https://supabase.com/dashboard/project/vpvpbdwtyugbknrntkho

---

## ✅ Post-Deployment Checklist

- [ ] Verify backend health endpoint
- [ ] Test API endpoints
- [ ] Verify frontend loads
- [ ] Test critical user flows
- [ ] Check browser console for errors
- [ ] Verify API connectivity
- [ ] Monitor logs

---

## 📝 Notes

1. **Backend**: Requires Supabase authentication (interactive login)
2. **Frontend**: Build is ready, just needs hosting deployment
3. **Both**: Can be deployed independently or together

---

**Ready to deploy?** Run `./DEPLOY_ALL.sh` or follow the individual steps above!
