# Frontend Deployment Guide - Step by Step

## ✅ Prerequisites

- ✅ Frontend built successfully (`build/` directory created)
- ✅ Backend deployed and running
- ✅ Build output ready: `build/` folder

## 🚀 Deployment Options

### Option 1: Vercel (Recommended - Easiest)

#### Step 1: Install Vercel CLI
```bash
npm i -g vercel
```

#### Step 2: Login to Vercel
```bash
vercel login
```

#### Step 3: Deploy
```bash
# From project root
vercel --prod

# Or specify build directory
vercel --prod --cwd build
```

#### Step 4: Configure (if needed)
- Set build command: `npm run build`
- Set output directory: `build`
- Set framework preset: `Vite`

**Benefits:**
- ✅ Automatic HTTPS
- ✅ Global CDN
- ✅ Automatic deployments on git push
- ✅ Free tier available
- ✅ Easy custom domains

---

### Option 2: Netlify

#### Step 1: Install Netlify CLI
```bash
npm i -g netlify-cli
```

#### Step 2: Login
```bash
netlify login
```

#### Step 3: Deploy
```bash
# Deploy build directory
netlify deploy --prod --dir=build

# Or initialize and deploy
netlify init
netlify deploy --prod
```

#### Step 4: Create netlify.toml (Optional)
Create `netlify.toml` in project root:
```toml
[build]
  command = "npm run build"
  publish = "build"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**Benefits:**
- ✅ Free tier available
- ✅ Easy deployment
- ✅ Automatic HTTPS
- ✅ Form handling
- ✅ Serverless functions support

---

### Option 3: Supabase Hosting

#### Step 1: Install Supabase CLI (if not already)
```bash
npm i -g supabase
```

#### Step 2: Link Project
```bash
supabase link --project-ref vpvpbdwtyugbknrntkho
```

#### Step 3: Deploy to Supabase Storage
```bash
# Upload build files to Supabase Storage
# Or use Supabase Hosting (if available)
```

**Note:** Supabase Hosting may require additional setup. Check Supabase dashboard for hosting options.

---

### Option 4: Manual Upload (Any Static Host)

#### Step 1: Prepare Build
```bash
# Build is already done, files are in build/
cd build
```

#### Step 2: Upload to Host
Upload all files from `build/` directory to your hosting provider:
- **AWS S3 + CloudFront**
- **Google Cloud Storage**
- **Azure Static Web Apps**
- **GitHub Pages**
- **Any web server (Apache/Nginx)**

#### Step 3: Configure Server
Ensure your server is configured to:
- Serve `index.html` for all routes (SPA routing)
- Serve static assets with proper MIME types
- Enable HTTPS

**Example Nginx Config:**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

### Option 5: GitHub Pages

#### Step 1: Install gh-pages
```bash
npm install --save-dev gh-pages
```

#### Step 2: Add Script to package.json
```json
{
  "scripts": {
    "deploy": "npm run build && gh-pages -d build"
  }
}
```

#### Step 3: Deploy
```bash
npm run deploy
```

**Note:** Requires GitHub repository and proper configuration.

---

## 🔧 Post-Deployment Configuration

### 1. Environment Variables
Ensure these are set in your hosting platform:
- `VITE_SUPABASE_URL` (if using Vite env vars)
- `VITE_SUPABASE_ANON_KEY` (if using Vite env vars)

### 2. API Endpoint Configuration
Verify frontend is pointing to correct backend:
- Backend URL: `https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475`

### 3. CORS Configuration
Backend should already allow CORS, but verify if needed.

### 4. Custom Domain (Optional)
- Configure DNS records
- Set up SSL certificate (usually automatic with Vercel/Netlify)

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] Frontend loads correctly
- [ ] API calls work (check browser console)
- [ ] OTP generation works
- [ ] Service management works
- [ ] CRM features accessible
- [ ] No console errors
- [ ] Mobile responsive
- [ ] All routes work (SPA routing)

---

## 🐛 Troubleshooting

### Issue: 404 on refresh
**Solution:** Configure server to serve `index.html` for all routes (SPA routing)

### Issue: API calls failing
**Solution:** 
- Check CORS settings
- Verify backend URL is correct
- Check environment variables

### Issue: Assets not loading
**Solution:**
- Check base path in vite.config.ts
- Verify asset paths are relative
- Check server MIME types

### Issue: Build too large
**Solution:**
- Enable code splitting
- Use dynamic imports
- Optimize images
- Enable gzip compression

---

## 📝 Quick Start (Recommended: Vercel)

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Login
vercel login

# 3. Deploy
vercel --prod

# Done! 🎉
```

---

## 🎯 Recommended Approach

**For Production:** Use **Vercel** or **Netlify**
- Easiest setup
- Automatic HTTPS
- Global CDN
- Free tier available
- Great developer experience

**For Development/Testing:** Use **Vercel** preview deployments
- Automatic preview URLs on PR
- Easy rollback
- Team collaboration

---

## 📞 Need Help?

1. Check hosting provider documentation
2. Review build output for errors
3. Test locally first: `npm run build && npm run preview`
4. Check browser console for runtime errors

---

**Ready to deploy?** Choose an option above and follow the steps!

