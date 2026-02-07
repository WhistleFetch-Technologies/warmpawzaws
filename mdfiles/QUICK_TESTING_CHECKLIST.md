# 🧪 Quick Testing Checklist for All 22 Roles

## URL
**Vendor App:** https://d1s6ykkj381k58.cloudfront.net/auth

## Test Credentials
- **Phone:** `9611377119`
- **OTP:** `123456`

---

## Testing Instructions

For **each role** below, complete this flow:

1. ✅ Enter phone number → Send OTP
2. ✅ Enter OTP `123456` → Verify
3. ✅ Select the role
4. ✅ Verify form loads with sections
5. ✅ Check Google Maps location picker appears
6. ✅ Fill required fields and test submit (optional)

---

## Roles to Test (22 Total)

### Service Providers
- [ ] 1. **Veterinary Clinic** - Full medical services
- [ ] 2. **Veterinarian** - Solo vet services (has 11 fields instead of 10)
- [ ] 3. **Pet Groomer** - Grooming services
- [ ] 4. **Pet Trainer** - Training services
- [ ] 5. **Pet Behaviorist** - Behavioral consultation
- [ ] 6. **Nutritionist** - Pet nutrition services
- [ ] 7. **Pet Walker** - Walking services
- [ ] 8. **Pet Sitter** - Pet sitting services

### Accommodation & Boarding
- [ ] 9. **Pet Boarding** - Standard boarding
- [ ] 10. **Pet Resort** - Premium resort facilities
- [ ] 11. **Pet Cafe** - Pet-friendly cafe

### Emergency & Specialty
- [ ] 12. **Pet Ambulance** - Emergency transport
- [ ] 13. **Pet Taxi** - Regular pet transportation
- [ ] 14. **Pet Relocation** - Pet moving services

### Retail & Products
- [ ] 15. **Pet Products Store** - Pet supplies retail
- [ ] 16. **Pet Pharmacy** - Veterinary medicines

### Other Services
- [ ] 17. **Pet Shelter** - Animal shelter
- [ ] 18. **Pet Breeder** - Professional breeding
- [ ] 19. **Pet Photographer** - Pet photography
- [ ] 20. **Pet Event Organizer** - Events & shows
- [ ] 21. **Pet Sunset Services** - End-of-life services
- [ ] 22. **Insurance** - Pet insurance

---

## Expected Form Structure for Each Role

### Section 1: Business Information (6 fields)
- Business Name ✅
- Contact Person Name ✅
- Phone Number ✅
- Email ✅
- Business Type (dropdown) ✅
- GST Number (optional) ✅

### Section 2: Location Information (4 fields)
- Address ✅
- City ✅
- State ✅
- PIN Code ✅

### Google Maps Integration
- Location picker should appear ✅
- Should allow pinning location ✅
- Should show preview ✅

---

## Known Issues
None! All systems operational. ✅

---

## If You Find Any Issues

1. **Note the role name**
2. **Note the specific error message**
3. **Check browser console for detailed logs**
4. **Take screenshot if needed**

---

## Quick Browser Test Commands

Open browser console and check:

```javascript
// Check runtime config
console.log('Runtime Config:', window.__WARMPAWZ_RUNTIME_CONFIG__);

// Check API base URL
console.log('API Base URL:', window.__WARMPAWZ_RUNTIME_CONFIG__.apiBaseUrl);

// Check Google Maps API Key
console.log('Google Maps Key Available:', !!window.__WARMPAWZ_RUNTIME_CONFIG__.googleMapsApiKey);
```

Expected output:
```
Runtime Config: { apiBaseUrl: "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com", uatMode: true, googleMapsApiKey: "AIzaSy..." }
API Base URL: https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com
Google Maps Key Available: true
```

---

**Happy Testing! 🎉**
