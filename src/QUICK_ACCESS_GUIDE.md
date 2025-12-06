# 🚀 QUICK ACCESS GUIDE - START HERE!

## 🎯 I WANT TO TEST DOCTOR SEARCH (Customer Side)

### ⚡ **FASTEST PATH**:
```
1. Open app
2. Click "Customer" 
3. Enter phone: 9876543210
4. Click "Vet Services" card
5. Click "Book Vet Visit" button
6. ✅ YOU'RE HERE! (Doctor Search Screen)
```

### 🎨 **WHAT YOU'LL SEE**:
- Orange header saying "Find Veterinarians"
- Two buttons: "Doctors" | "Clinics"
- Search bar
- Filter button
- List of doctor cards with "Next Available" badges

### ✅ **QUICK TESTS**:
1. Type "john" → see results
2. Click Filters → move slider to ₹500 → Apply
3. Toggle to "Clinics" → see clinic list
4. Check "Next Available" badges (orange = today)

---

## 🎯 I WANT TO TEST SMART SCHEDULING (Vendor Side)

### ⚡ **FASTEST PATH**:
```
1. Open app
2. Click "Vendor"
3. Login: 9999999999
4. Scroll down on dashboard
5. Find "Staff Management" card
6. Click "Manage Staff/Doctors"
7. Find any staff card
8. Click purple "Schedule" button (has calendar icon)
9. ✅ YOU'RE HERE! (Schedule Management Modal)
```

### 🎨 **WHAT YOU'LL SEE**:
- Orange header saying "Schedule Management"
- Three tabs: Breaks | Buffer Time | Holidays
- Add buttons and forms

### ✅ **QUICK TESTS**:

**BREAKS TAB** (already selected):
1. Click "Add Break"
2. Fill: Lunch, 13:00-14:00, Daily
3. Save → see in list
4. Try Edit and Delete buttons

**BUFFER TIME TAB**:
1. Click "Buffer Time" tab
2. Change slot duration to 45 min
3. Change buffer to 10 min
4. Click "Save Preferences"

**HOLIDAYS TAB**:
1. Click "Holidays" tab
2. Click "Add Holiday"
3. Pick date, Full Day, reason "Christmas"
4. Save → see in list

---

## 🆘 TROUBLESHOOTING

### "I don't see any doctors/clinics!"
**Reason**: Database is empty  
**Fix**: Need to onboard vendors first via vendor portal  
**Workaround**: Check console for errors (F12)

### "I don't see Schedule button!"
**Reason**: No staff members added yet  
**Fix**:
1. Stay on Staff Management page
2. Click "Add New Doctor" button (orange)
3. Fill form (photo required!)
4. Save
5. Now you'll see Schedule button on that card

### "Schedule modal doesn't open!"
**Reason**: Integration issue  
**Fix**:
1. Check browser console (F12)
2. Look for errors
3. Verify StaffScheduleManagement component is imported
4. Check props match (staffId, staffName, vendorId, onClose)

### "API calls failing!"
**Reason**: Backend not deployed or wrong endpoint  
**Fix**:
1. Check Network tab (F12 → Network)
2. Look for failed requests (red)
3. Verify endpoint: `/make-server-3dd53475/staff/...`
4. Check Response for error details

---

## 📱 UI ELEMENT FINDER

### Customer Search Screen:

| Element | Location | Color | Description |
|---------|----------|-------|-------------|
| Header | Top | Orange #FF8C42 | "Find Veterinarians" |
| Doctors/Clinics Toggle | Below header | Orange (active) / Gray | Switch views |
| Search Bar | Below toggle | White | Type to search |
| Filter Button | Top right | White | Opens bottom sheet |
| Filter Count Badge | On filter button | Orange | Shows active filter count |
| Doctor Cards | Scrollable list | White | Doctor info cards |
| Next Available Badge | On each card | Orange/Light Orange | Shows next slot |
| Clear Search (X) | In search bar | Gray | Clears search text |

### Vendor Schedule Modal:

| Element | Location | Color | Description |
|---------|----------|-------|-------------|
| Header | Top | Orange #FF8C42 | "Schedule Management" |
| Close Button (X) | Top right | White | Closes modal |
| Breaks Tab | Below header | Orange (active) | Manage breaks |
| Buffer Time Tab | Below header | Purple (inactive) | Slot settings |
| Holidays Tab | Below header | Green (inactive) | Manage holidays |
| Add Break Button | In Breaks tab | Orange | Opens add form |
| Edit Button | On break card | Pencil icon | Opens edit form |
| Delete Button | On break card | Trash icon, Red | Deletes break |
| Save Preferences | In Buffer tab | Orange | Saves settings |
| Add Holiday Button | In Holidays tab | Orange | Opens holiday form |

---

## 🎬 VIDEO WALKTHROUGH SCRIPT

### For Customer Search:
```
"Starting from the home screen...
Click Customer... Enter phone 9876543210... 
Click Vet Services... Click Book Vet Visit...
Now we're on the Doctor Search screen.
See the orange header? Two toggle buttons?
Let me search for 'john'... <type>... results appear!
Now let me filter... Click Filters... 
Move fee slider to 500... Apply...
Results updated! See the filter badge showing '1'?
Each doctor card shows Next Available slot - see this orange badge?
That means this doctor is available today!
Let me toggle to Clinics... <click>... 
Now showing clinics instead of individual doctors.
Back to Doctors... <click>..."
```

### For Vendor Schedule:
```
"Starting from vendor login...
Enter phone 9999999999... Dashboard loads...
Scrolling down to Staff Management...
Click Manage Staff...
Here's our staff list - see the purple Schedule button?
<click Schedule>... Modal opens!
Three tabs here: Breaks, Buffer Time, Holidays.
Breaks is selected. Let me add a lunch break...
<click Add Break>... Dialog opens...
Type: Lunch Break, Start: 13:00, End: 14:00, Recurring Daily...
<click Add Break>... Toast notification! Break added!
See it in the list now? Let me edit it...
<click Edit>... Change end time to 14:30... <click Save>...
Updated! Now let me check Buffer Time...
<click Buffer Time tab>... Here we can set slot duration...
Change to 45 minutes... Buffer time 10 minutes...
<click Save Preferences>... Saved!
Now Holidays tab... <click>...
<click Add Holiday>... Pick December 25... Full Day... Christmas...
<click Add Holiday>... Holiday added!
Let me close this... <click X>... Back to Staff Management!"
```

---

## 🏁 SUCCESS CRITERIA

### ✅ You've successfully tested Customer Search when:
- [ ] Search bar filters results
- [ ] Filters apply and show count badge
- [ ] Clear filters works
- [ ] Toggle switches between Doctors/Clinics
- [ ] Next Available badges display on cards
- [ ] No console errors

### ✅ You've successfully tested Vendor Schedule when:
- [ ] Modal opens on Schedule button click
- [ ] Can add, edit, delete breaks
- [ ] Can modify and save buffer settings
- [ ] Can add and delete holidays
- [ ] All tabs work smoothly
- [ ] Modal closes properly
- [ ] No console errors

---

## 📞 NEED HELP?

1. **Check Console First** (F12 → Console)
2. **Check UAT_NAVIGATION_GUIDE.md** for detailed steps
3. **Check IMPLEMENTATION_PROGRESS.md** for latest status
4. **Check API endpoints** in Network tab (F12 → Network)

---

**🎉 YOU'RE READY TO TEST! START WITH EITHER PATH ABOVE!**

**Quick Tip**: Open browser DevTools (F12) before testing to see console logs and network requests - it helps with debugging!
