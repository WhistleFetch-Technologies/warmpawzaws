# Admin UI Testing Guide
**Date:** 2025-01-28  
**Status:** Ready for Testing

---

## Prerequisites

### 1. Start Backend Server
```bash
# Navigate to backend directory
cd backend/lambda

# Start the server (adjust port if needed)
npm run dev
# or
# The server should be running on the configured port (check your .env)
```

### 2. Start Admin Web Server
```bash
# Navigate to admin web directory
cd apps/admin-web

# Start the development server
npm run dev
# Server will run on http://localhost:3003
```

---

## Testing Methods

### Method 1: Automated API Testing

#### Setup
```bash
# Set the API base URL
export API_BASE_URL=http://localhost:3000  # Adjust port as needed

# Run the test script
node scripts/test-admin-ui.js
```

#### What It Tests
- ✅ Banner CRUD operations (Create, Read, Update, Delete)
- ✅ Loyalty Rules CRUD operations
- ✅ Loyalty Stats and Transactions
- ✅ Promotions CRUD operations
- ✅ API contract consistency

#### Expected Output
```
🚀 Starting Admin UI API Tests...
📍 Base URL: http://localhost:3000

📋 Testing Banner Management...
  [1] Creating banner...
      ✅ Banner created: <id>
  [2] Getting all banners...
      ✅ Retrieved banners: 1
  [3] Updating banner...
      ✅ Banner updated
  [4] Deleting banner...
      ✅ Banner deleted

🎁 Testing Loyalty & Rewards Management...
  [1] Creating loyalty rule...
      ✅ Loyalty rule created: <id>
  [2] Getting all loyalty rules...
      ✅ Retrieved rules: 1
  [3] Getting loyalty stats...
      ✅ Retrieved stats: {...}
  [4] Getting loyalty transactions...
      ✅ Retrieved transactions: 0
  [5] Updating loyalty rule...
      ✅ Rule updated
  [6] Deleting loyalty rule...
      ✅ Rule deleted

🎉 Testing Promotions Management...
  [1] Creating promotion...
      ✅ Promotion created: <id>
  [2] Getting all promotions...
      ✅ Retrieved promotions: 1
  [3] Updating promotion...
      ✅ Promotion updated
  [4] Deleting promotion...
      ✅ Promotion deleted

============================================================
📊 TEST SUMMARY
============================================================
...
Total: 14 passed, 0 failed
============================================================
```

---

### Method 2: Manual UI Testing

#### Step 1: Access Admin Portal
1. Open browser: `http://localhost:3003`
2. Login with UAT credentials:
   - **Email:** `admin@warmpawz.com`
   - **Password:** `Warmpawz2025`

#### Step 2: Test Banner Management

**Navigate:** Click "Banner Management" in sidebar or go to `/banners`

**Test Cases:**
1. **Create Banner**
   - Click "Create Banner" button
   - Fill form:
     - Title: "Test Banner"
     - Description: "Test description"
     - Image URL: "https://via.placeholder.com/800x200"
     - Link URL: "https://example.com"
     - Position: "Home Top"
     - Start Date: Today
     - End Date: 30 days from now
     - Active: Checked
   - Click "Create Banner"
   - ✅ Verify: Banner appears in list
   - ✅ Verify: Success message displays

2. **Edit Banner**
   - Click "Edit" on created banner
   - Change title to "Updated Test Banner"
   - Click "Save Changes"
   - ✅ Verify: Banner title updated in list
   - ✅ Verify: Success message displays

3. **Toggle Status**
   - Click "Deactivate" on active banner
   - ✅ Verify: Status changes to "Inactive"
   - Click "Activate" on inactive banner
   - ✅ Verify: Status changes to "Active"

4. **Delete Banner**
   - Click "Delete" on test banner
   - Confirm deletion
   - ✅ Verify: Banner removed from list
   - ✅ Verify: Success message displays

5. **Filter Banners**
   - Select position filter
   - ✅ Verify: List filters correctly
   - Select status filter
   - ✅ Verify: List filters correctly

6. **Mobile View**
   - Resize browser to mobile width (375px)
   - ✅ Verify: Layout is responsive
   - ✅ Verify: Forms are usable
   - ✅ Verify: Tables scroll horizontally

#### Step 3: Test Loyalty Management

**Navigate:** Click "Loyalty & Rewards" in sidebar or go to `/loyalty`

**Test Cases:**
1. **View Stats**
   - ✅ Verify: Stats cards display
   - ✅ Verify: Numbers are formatted correctly

2. **Create Loyalty Rule**
   - Click "Create Rule" button
   - Fill form:
     - Name: "Test Loyalty Rule"
     - Description: "Test description"
     - Points per Rupee: 1
     - Redemption Rate: 100
     - Min Points to Redeem: 100
     - Active: Checked
   - Click "Create Rule"
   - ✅ Verify: Rule appears in table
   - ✅ Verify: Success message displays

3. **Edit Loyalty Rule**
   - Click "Edit" on created rule
   - Change name to "Updated Test Rule"
   - Click "Update Rule"
   - ✅ Verify: Rule name updated in table
   - ✅ Verify: Success message displays

4. **Toggle Status**
   - Click "Deactivate" on active rule
   - ✅ Verify: Status badge changes
   - Click "Activate" on inactive rule
   - ✅ Verify: Status badge changes

5. **Delete Loyalty Rule**
   - Click "Delete" on test rule
   - Confirm deletion
   - ✅ Verify: Rule removed from table
   - ✅ Verify: Success message displays

6. **View Transactions**
   - Scroll to "Recent Transactions" section
   - ✅ Verify: Transactions table displays
   - Click "View All" (if implemented)
   - ✅ Verify: Full transaction list loads

7. **Mobile View**
   - Resize browser to mobile width
   - ✅ Verify: Stats cards stack vertically
   - ✅ Verify: Table is scrollable
   - ✅ Verify: Forms are usable

#### Step 4: Test Promotions Management

**Navigate:** Click "Marketing & Promotions" in sidebar or go to `/promotions`

**Test Cases:**
1. **Create Promotion**
   - Click "Create Promotion" button
   - Fill form with test data
   - Click "Create Promotion"
   - ✅ Verify: Promotion appears in list
   - ✅ Verify: Success message displays

2. **Edit Promotion**
   - Click "Edit" on created promotion
   - Modify fields
   - Click "Save Changes"
   - ✅ Verify: Changes saved
   - ✅ Verify: Success message displays

3. **Delete Promotion**
   - Click "Delete" on test promotion
   - Confirm deletion
   - ✅ Verify: Promotion removed
   - ✅ Verify: Success message displays

4. **Create Coupon**
   - Switch to "Coupons" tab
   - Click "Create Coupon"
   - Fill form
   - Click "Create Coupon"
   - ✅ Verify: Coupon appears in list

5. **Mobile View**
   - Resize browser to mobile width
   - ✅ Verify: Layout is responsive
   - ✅ Verify: Tabs work correctly

---

## Test Checklist Summary

### Banner Management ✅
- [ ] Create banner
- [ ] Edit banner
- [ ] Delete banner
- [ ] Toggle status
- [ ] Filter by position
- [ ] Filter by status
- [ ] Mobile responsive
- [ ] Error handling
- [ ] Success messages

### Loyalty Management ✅
- [ ] View stats
- [ ] Create rule
- [ ] Edit rule
- [ ] Delete rule
- [ ] Toggle status
- [ ] View transactions
- [ ] Mobile responsive
- [ ] Error handling
- [ ] Success messages

### Promotions Management ✅
- [ ] Create promotion
- [ ] Edit promotion
- [ ] Delete promotion
- [ ] Create coupon
- [ ] Edit coupon
- [ ] Delete coupon
- [ ] Mobile responsive
- [ ] Error handling
- [ ] Success messages

---

## Common Issues & Solutions

### Issue: API Tests Fail with "fetch failed"
**Solution:** 
- Ensure backend server is running
- Check API_BASE_URL is correct
- Verify CORS is configured

### Issue: UI Shows "Failed to fetch"
**Solution:**
- Check backend server is running
- Verify API endpoints are registered
- Check browser console for errors

### Issue: Forms Don't Submit
**Solution:**
- Check browser console for validation errors
- Verify all required fields are filled
- Check network tab for API errors

### Issue: Mobile Layout Broken
**Solution:**
- Clear browser cache
- Check Tailwind classes are correct
- Verify responsive breakpoints

---

## Testing Results Template

```markdown
## Test Results - [Date]

### Banner Management
- Create: ✅ / ❌
- Edit: ✅ / ❌
- Delete: ✅ / ❌
- Toggle: ✅ / ❌
- Filters: ✅ / ❌
- Mobile: ✅ / ❌

### Loyalty Management
- Stats: ✅ / ❌
- Create: ✅ / ❌
- Edit: ✅ / ❌
- Delete: ✅ / ❌
- Transactions: ✅ / ❌
- Mobile: ✅ / ❌

### Promotions Management
- Create: ✅ / ❌
- Edit: ✅ / ❌
- Delete: ✅ / ❌
- Coupons: ✅ / ❌
- Mobile: ✅ / ❌

### Issues Found
1. [Issue description]
2. [Issue description]

### Notes
[Any additional notes]
```

---

## Next Steps After Testing

1. **Document Issues** - Record all bugs and issues found
2. **Fix Critical Bugs** - Address blocking issues first
3. **Fix Minor Issues** - Address non-blocking issues
4. **Re-test** - Verify fixes work correctly
5. **Update Documentation** - Update this guide with findings

---

**Ready to test!** Follow the steps above to verify all functionality works correctly.

