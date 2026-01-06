# 🚀 Quick Test Start Guide

## Start Testing in 3 Steps

### Step 1: Start Development Server

**Option A: Admin Web**
```bash
cd apps/admin-web
npm run dev
```
Open: http://localhost:3000

**Option B: Vendor Web**
```bash
cd apps/vendor-web
npm run dev
```
Open: http://localhost:3001

**Option C: Customer Web**
```bash
cd apps/customer-web
npm run dev
```
Open: http://localhost:3002

---

### Step 2: Open Browser DevTools

1. Open browser (Chrome/Firefox)
2. Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
3. Go to **Network** tab
4. Filter by **Fetch/XHR**

---

### Step 3: Test a Screen

1. Navigate to any screen (e.g., `/catalog` for Admin)
2. Check Network tab for API calls
3. Verify:
   - ✅ API call is made
   - ✅ Response received
   - ✅ Data displays in UI
   - ✅ No console errors

---

## 🧪 Quick Test Checklist

### Test Each Screen:

- [ ] Page loads without errors
- [ ] API call appears in Network tab
- [ ] Response status is 200 (or expected)
- [ ] Data displays correctly
- [ ] Loading state shows (if applicable)
- [ ] Error handling works (if API fails)

---

## 📝 Document Results

Update `TESTING_EXECUTION_LOG.md` with:
- ✅ Passed tests
- ❌ Failed tests
- 🐛 Issues found
- 📝 Notes

---

## 🐛 Common Issues

### API Call Fails
- Check API base URL in `.env.local`
- Verify backend is running
- Check CORS configuration

### No Data Displays
- Check API response format
- Verify data structure matches expected
- Check browser console for errors

### Page Doesn't Load
- Check if dev server is running
- Verify port is not in use
- Check for TypeScript errors

---

**Ready to test!** 🎯

