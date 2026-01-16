# 🎨 PIXEL-PERFECT DESIGN COMPARISON REPORT
## Warmpawz Ecosystem Development - Complete Visual & Functional Audit

**Generated:** 2026-01-06T19:19:43.892Z  
**Reference Design:** [Figma - Warmpawz Ecosystem Development](https://www.figma.com/design/YdfuhU9EWz4XDMwBgZf3Q0/Warmpawz-Ecosystem-Development)  
**Total Screens Analyzed:** 197  
**Analysis Method:** Static code analysis + Component extraction + API endpoint detection

---

## 📊 EXECUTIVE SUMMARY

### Overall Platform Health

| Metric | Value | Status |
|--------|-------|--------|
| **Total Screens** | 197 | ✅ |
| **Total Violations** | 899 | ⚠️ |
| **Hardcoded Colors** | 368 | ❌ |
| **Non-Standard Spacing** | 531 | ⚠️ |
| **API Integration Rate** | 15% | ⚠️ |

### App-by-App Breakdown

#### CUSTOMER-MOBILE

- **Screens:** 76
- **Average Match %:** 87%
- **Total Violations:** 304
- **API Integration:** 0% (0/76)

#### VENDOR-MOBILE

- **Screens:** 49
- **Average Match %:** 94%
- **Total Violations:** 63
- **API Integration:** 0% (0/49)

#### ADMIN-WEB

- **Screens:** 20
- **Average Match %:** 83%
- **Total Violations:** 164
- **API Integration:** 60% (12/20)

#### CUSTOMER-WEB

- **Screens:** 32
- **Average Match %:** 84%
- **Total Violations:** 220
- **API Integration:** 16% (5/32)

#### VENDOR-WEB

- **Screens:** 20
- **Average Match %:** 82%
- **Total Violations:** 148
- **API Integration:** 25% (5/20)


---

## 📱 COMPLETE SCREEN-BY-SCREEN ANALYSIS

### CUSTOMER-MOBILE (76 screens)

#### 1. BookingReceipt

**File Path:** `apps/WarmpawzCustomer/src/screens/bookings/BookingReceiptScreen.tsx`

### 1️⃣ Matching Percentage: **90%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -0%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView
```

### 3️⃣ Colors & Styles (0 unique)

*No color classes detected*

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration
- ❌ Color styling

### 6️⃣ Violations (0)

✅ No violations detected

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 2. Community

**File Path:** `apps/WarmpawzCustomer/src/screens/community/CommunityScreen.tsx`

### 1️⃣ Matching Percentage: **90%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -0%
- Missing API Integration: -10%

### 2️⃣ Components Used (3)

```
SafeAreaView, TouchableOpacity, ScrollView
```

### 3️⃣ Colors & Styles (0 unique)

*No color classes detected*

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration
- ❌ Color styling

### 6️⃣ Violations (0)

✅ No violations detected

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 3. OrderInvoice

**File Path:** `apps/WarmpawzCustomer/src/screens/orders/OrderInvoiceScreen.tsx`

### 1️⃣ Matching Percentage: **90%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -0%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView
```

### 3️⃣ Colors & Styles (0 unique)

*No color classes detected*

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration
- ❌ Color styling

### 6️⃣ Violations (0)

✅ No violations detected

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 4. AppointmentList

**File Path:** `apps/WarmpawzCustomer/src/screens/appointments/AppointmentListScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
TouchableOpacity, SafeAreaView, ActivityIndicator, FlatList, RefreshControl
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#f3f4f6
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#f3f4f6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 5. BookingFeedback

**File Path:** `apps/WarmpawzCustomer/src/screens/bookings/BookingFeedbackScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
SafeAreaView, TouchableOpacity, ScrollView, TextInput, ActivityIndicator
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#9ca3af
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#9ca3af` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 6. BookingList

**File Path:** `apps/WarmpawzCustomer/src/screens/bookings/BookingListScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
TouchableOpacity, SafeAreaView, ActivityIndicator, FlatList, RefreshControl
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#FFF4E6
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#FFF4E6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 7. LiveTrackingDashboard

**File Path:** `apps/WarmpawzCustomer/src/screens/logistics/LiveTrackingDashboardScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (7)

```
ActiveBooking, TouchableOpacity, SafeAreaView, ActivityIndicator, MapView, FlatList, RefreshControl
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#fff7ed
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#fff7ed` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 8. PrescriptionView

**File Path:** `apps/WarmpawzCustomer/src/screens/medical/PrescriptionViewScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#f3f4f6
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#f3f4f6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 9. OrderHistory

**File Path:** `apps/WarmpawzCustomer/src/screens/orders/OrderHistoryScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
TouchableOpacity, SafeAreaView, ActivityIndicator, FlatList, RefreshControl
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#f3f4f6
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#f3f4f6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 10. OrderTracking

**File Path:** `apps/WarmpawzCustomer/src/screens/orders/OrderTrackingScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
DeliveryAgent, SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#e5e7eb
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#e5e7eb` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 11. MedicalRecords

**File Path:** `apps/WarmpawzCustomer/src/screens/pets/MedicalRecordsScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
TouchableOpacity, SafeAreaView, ActivityIndicator, FlatList
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#f3f4f6
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#f3f4f6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 12. PetProfileDashboard

**File Path:** `apps/WarmpawzCustomer/src/screens/pets/PetProfileDashboardScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#f3f4f6
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#f3f4f6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 13. NutritionistService

**File Path:** `apps/WarmpawzCustomer/src/screens/services/NutritionistServiceScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView, TextInput
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#fbbf24
```

### 4️⃣ Layout Classes & Component Placement (3)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 2 classes

**Sample Layout Classes:**
```
flex, w-left, w-up
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#fbbf24` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 14. ProblemDiscovery

**File Path:** `apps/WarmpawzCustomer/src/screens/services/ProblemDiscoveryScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#fff7ed
```

### 4️⃣ Layout Classes & Component Placement (2)

**Layout Type:**
- Flex: 1 classes
- Grid: 1 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
grid, flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#fff7ed` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 15. ServiceSearch

**File Path:** `apps/WarmpawzCustomer/src/screens/services/ServiceSearchScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
TouchableOpacity, SafeAreaView, TextInput, ActivityIndicator, FlatList
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#f3f4f6
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#f3f4f6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 16. AddAddress

**File Path:** `apps/WarmpawzCustomer/src/screens/settings/AddAddressScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
SafeAreaView, TouchableOpacity, ScrollView, TextInput, ActivityIndicator
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#9ca3af
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#9ca3af` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 17. HelpSupport

**File Path:** `apps/WarmpawzCustomer/src/screens/settings/HelpSupportScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
SafeAreaView, TouchableOpacity, ScrollView, TextInput, ActivityIndicator
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#f3f4f6
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#f3f4f6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 18. ShoppingCart

**File Path:** `apps/WarmpawzCustomer/src/screens/shop/ShoppingCartScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#dc2626
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#dc2626` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 19. Wishlist

**File Path:** `apps/WarmpawzCustomer/src/screens/shop/WishlistScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
TouchableOpacity, SafeAreaView, ActivityIndicator, FlatList, RefreshControl
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#f3f4f6
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#f3f4f6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 20. VendorProfile

**File Path:** `apps/WarmpawzCustomer/src/screens/vendors/VendorProfileScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
TouchableOpacity, SafeAreaView, ActivityIndicator, ScrollView, FlatList
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#f3f4f6
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#f3f4f6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 21. TransactionHistory

**File Path:** `apps/WarmpawzCustomer/src/screens/wallet/TransactionHistoryScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
SafeAreaView, ActivityIndicator, TouchableOpacity, FlatList, RefreshControl
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#f3f4f6
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#f3f4f6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 22. AppointmentDetail

**File Path:** `apps/WarmpawzCustomer/src/screens/appointments/AppointmentDetailScreen.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -4%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView
```

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 2
```
#fee2e2, #dc2626
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (2)

**Hardcoded Colors (2):**
- ❌ `#fee2e2` - Use design token instead
- ❌ `#dc2626` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 23. AppointmentReschedule

**File Path:** `apps/WarmpawzCustomer/src/screens/appointments/AppointmentRescheduleScreen.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -4%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
SafeAreaView, TouchableOpacity, ScrollView, TextInput, ActivityIndicator
```

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 2
```
#fff7ed, #9ca3af
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (2)

**Hardcoded Colors (2):**
- ❌ `#fff7ed` - Use design token instead
- ❌ `#9ca3af` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 24. CustomerAuth

**File Path:** `apps/WarmpawzCustomer/src/screens/auth/CustomerAuthScreen.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -4%
- Missing API Integration: -10%

### 2️⃣ Components Used (6)

```
KeyboardAvoidingView, SvgXml, ScrollView, TextInput, TouchableOpacity, ActivityIndicator
```

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 2
```
#FFD700, #3b82f6
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (2)

**Hardcoded Colors (2):**
- ❌ `#FFD700` - Use design token instead
- ❌ `#3b82f6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 25. BookingCreation

**File Path:** `apps/WarmpawzCustomer/src/screens/bookings/BookingCreationScreen.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -4%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
SafeAreaView, ScrollView, TouchableOpacity, TextInput, ActivityIndicator
```

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 2
```
#ffffff, #FFF4E6
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (2)

**Hardcoded Colors (2):**
- ❌ `#ffffff` - Use design token instead
- ❌ `#FFF4E6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 26. BookingOTP

**File Path:** `apps/WarmpawzCustomer/src/screens/bookings/BookingOTPScreen.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -4%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
SafeAreaView, TouchableOpacity, TextInput, ActivityIndicator
```

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 2
```
#fff7ed, #9ca3af
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (2)

**Hardcoded Colors (2):**
- ❌ `#fff7ed` - Use design token instead
- ❌ `#9ca3af` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 27. BookingTimeline

**File Path:** `apps/WarmpawzCustomer/src/screens/bookings/BookingTimelineScreen.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -4%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView
```

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 2
```
#e5e7eb, #d1d5db
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (2)

**Hardcoded Colors (2):**
- ❌ `#e5e7eb` - Use design token instead
- ❌ `#d1d5db` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 28. VideoConsultation

**File Path:** `apps/WarmpawzCustomer/src/screens/consultation/VideoConsultationScreen.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -4%
- Missing API Integration: -10%

### 2️⃣ Components Used (3)

```
SafeAreaView, ActivityIndicator, TouchableOpacity
```

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 2
```
#1a1a1a, #dc2626
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (2)

**Hardcoded Colors (2):**
- ❌ `#1a1a1a` - Use design token instead
- ❌ `#dc2626` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 29. GPSTracking

**File Path:** `apps/WarmpawzCustomer/src/screens/logistics/GPSTrackingScreen.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -4%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
LocationPoint, SafeAreaView, TouchableOpacity, MapView, ActivityIndicator
```

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 2
```
#f3f4f6, #dc2626
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (2)

**Hardcoded Colors (2):**
- ❌ `#f3f4f6` - Use design token instead
- ❌ `#dc2626` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 30. MapsRoute

**File Path:** `apps/WarmpawzCustomer/src/screens/logistics/MapsRouteScreen.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -4%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
SafeAreaView, TouchableOpacity, ActivityIndicator, MapView, ScrollView
```

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 2
```
#dc2626, #f3f4f6
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (2)

**Hardcoded Colors (2):**
- ❌ `#dc2626` - Use design token instead
- ❌ `#f3f4f6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 31. NotificationCenter

**File Path:** `apps/WarmpawzCustomer/src/screens/notifications/NotificationCenterScreen.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -4%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
TouchableOpacity, SafeAreaView, ActivityIndicator, FlatList, RefreshControl
```

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 2
```
#f3f4f6, #f0f9ff
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (2)

**Hardcoded Colors (2):**
- ❌ `#f3f4f6` - Use design token instead
- ❌ `#f0f9ff` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 32. CustomerUserProfile

**File Path:** `apps/WarmpawzCustomer/src/screens/onboarding/CustomerUserProfileScreen.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -4%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
SafeAreaView, ScrollView, TouchableOpacity, TextInput, ActivityIndicator
```

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 2
```
#ffffff, #FFF4E6
```

### 4️⃣ Layout Classes & Component Placement (2)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex, hidden
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (2)

**Hardcoded Colors (2):**
- ❌ `#ffffff` - Use design token instead
- ❌ `#FFF4E6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 33. OrderReturn

**File Path:** `apps/WarmpawzCustomer/src/screens/orders/OrderReturnScreen.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -4%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
SafeAreaView, TouchableOpacity, ScrollView, TextInput, ActivityIndicator
```

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 2
```
#fff7ed, #9ca3af
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (2)

**Hardcoded Colors (2):**
- ❌ `#fff7ed` - Use design token instead
- ❌ `#9ca3af` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 34. ServiceDetail

**File Path:** `apps/WarmpawzCustomer/src/screens/services/ServiceDetailScreen.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -4%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView
```

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 2
```
#FFF4E6, #ffffff
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (2)

**Hardcoded Colors (2):**
- ❌ `#FFF4E6` - Use design token instead
- ❌ `#ffffff` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 35. ChangePassword

**File Path:** `apps/WarmpawzCustomer/src/screens/settings/ChangePasswordScreen.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -4%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
SafeAreaView, TouchableOpacity, ScrollView, TextInput, ActivityIndicator
```

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 2
```
#f3f4f6, #9ca3af
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (2)

**Hardcoded Colors (2):**
- ❌ `#f3f4f6` - Use design token instead
- ❌ `#9ca3af` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 36. WalletTopUp

**File Path:** `apps/WarmpawzCustomer/src/screens/wallet/WalletTopUpScreen.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -4%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
SafeAreaView, TouchableOpacity, ScrollView, TextInput, ActivityIndicator
```

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 2
```
#fff7ed, #9ca3af
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (2)

**Hardcoded Colors (2):**
- ❌ `#fff7ed` - Use design token instead
- ❌ `#9ca3af` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 37. BookingCheckIn

**File Path:** `apps/WarmpawzCustomer/src/screens/bookings/BookingCheckInScreen.tsx`

### 1️⃣ Matching Percentage: **84%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -6%
- Missing API Integration: -10%

### 2️⃣ Components Used (3)

```
SafeAreaView, ActivityIndicator, TouchableOpacity
```

### 3️⃣ Colors & Styles (3 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 3
```
#dcfce7, #fef3c7, #9ca3af
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (3)

**Hardcoded Colors (3):**
- ❌ `#dcfce7` - Use design token instead
- ❌ `#fef3c7` - Use design token instead
- ❌ `#9ca3af` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 38. OrderSuccess

**File Path:** `apps/WarmpawzCustomer/src/screens/orders/OrderSuccessScreen.tsx`

### 1️⃣ Matching Percentage: **84%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -6%
- Missing API Integration: -10%

### 2️⃣ Components Used (3)

```
SafeAreaView, ScrollView, TouchableOpacity
```

### 3️⃣ Colors & Styles (3 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 3
```
#dcfce7, #16a34a, #f3f4f6
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (3)

**Hardcoded Colors (3):**
- ❌ `#dcfce7` - Use design token instead
- ❌ `#16a34a` - Use design token instead
- ❌ `#f3f4f6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 39. CouponApply

**File Path:** `apps/WarmpawzCustomer/src/screens/payments/CouponApplyScreen.tsx`

### 1️⃣ Matching Percentage: **84%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -6%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
SafeAreaView, TouchableOpacity, ScrollView, TextInput, ActivityIndicator
```

### 3️⃣ Colors & Styles (3 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 3
```
#9ca3af, #dcfce7, #fff7ed
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (3)

**Hardcoded Colors (3):**
- ❌ `#9ca3af` - Use design token instead
- ❌ `#dcfce7` - Use design token instead
- ❌ `#fff7ed` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 40. CustomerProfile

**File Path:** `apps/WarmpawzCustomer/src/screens/profile/CustomerProfileScreen.tsx`

### 1️⃣ Matching Percentage: **84%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -6%
- Missing API Integration: -10%

### 2️⃣ Components Used (6)

```
UserProfile, SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView, TextInput
```

### 3️⃣ Colors & Styles (3 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 3
```
#E5E7EB, #F9FAFB, #F3F4F6
```

### 4️⃣ Layout Classes & Component Placement (2)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex, hidden
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (3)

**Hardcoded Colors (3):**
- ❌ `#E5E7EB` - Use design token instead
- ❌ `#F9FAFB` - Use design token instead
- ❌ `#F3F4F6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 41. EditProfile

**File Path:** `apps/WarmpawzCustomer/src/screens/profile/EditProfileScreen.tsx`

### 1️⃣ Matching Percentage: **84%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -6%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView, TextInput
```

### 3️⃣ Colors & Styles (3 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 3
```
#f3f4f6, #fff7ed, #9ca3af
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (3)

**Hardcoded Colors (3):**
- ❌ `#f3f4f6` - Use design token instead
- ❌ `#fff7ed` - Use design token instead
- ❌ `#9ca3af` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 42. InsuranceServices

**File Path:** `apps/WarmpawzCustomer/src/screens/services/InsuranceServicesScreen.tsx`

### 1️⃣ Matching Percentage: **84%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -6%
- Missing API Integration: -10%

### 2️⃣ Components Used (6)

```
InsuranceProvider, InsurancePlan, ScrollView, TouchableOpacity, ActivityIndicator, SafeAreaView
```

### 3️⃣ Colors & Styles (3 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 3
```
#F9FAFB, #E5E7EB, #FEE2E2
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (3)

**Hardcoded Colors (3):**
- ❌ `#F9FAFB` - Use design token instead
- ❌ `#E5E7EB` - Use design token instead
- ❌ `#FEE2E2` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 43. PetCafeServices

**File Path:** `apps/WarmpawzCustomer/src/screens/services/PetCafeServicesScreen.tsx`

### 1️⃣ Matching Percentage: **84%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -6%
- Missing API Integration: -10%

### 2️⃣ Components Used (6)

```
TablePackage, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, SafeAreaView
```

### 3️⃣ Colors & Styles (3 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 3
```
#FEE2E2, #F9FAFB, #E5E7EB
```

### 4️⃣ Layout Classes & Component Placement (2)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex, hidden
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (3)

**Hardcoded Colors (3):**
- ❌ `#FEE2E2` - Use design token instead
- ❌ `#F9FAFB` - Use design token instead
- ❌ `#E5E7EB` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 44. WalkerService

**File Path:** `apps/WarmpawzCustomer/src/screens/services/WalkerServiceScreen.tsx`

### 1️⃣ Matching Percentage: **84%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -6%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
ScrollView, TouchableOpacity, ActivityIndicator, SafeAreaView
```

### 3️⃣ Colors & Styles (3 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 3
```
#F9FAFB, #E5E7EB, #FEE2E2
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (3)

**Hardcoded Colors (3):**
- ❌ `#F9FAFB` - Use design token instead
- ❌ `#E5E7EB` - Use design token instead
- ❌ `#FEE2E2` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 45. AddressBook

**File Path:** `apps/WarmpawzCustomer/src/screens/settings/AddressBookScreen.tsx`

### 1️⃣ Matching Percentage: **84%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -6%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
TouchableOpacity, SafeAreaView, ActivityIndicator, FlatList
```

### 3️⃣ Colors & Styles (3 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 3
```
#f3f4f6, #fee2e2, #dc2626
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (3)

**Hardcoded Colors (3):**
- ❌ `#f3f4f6` - Use design token instead
- ❌ `#fee2e2` - Use design token instead
- ❌ `#dc2626` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 46. EditAddress

**File Path:** `apps/WarmpawzCustomer/src/screens/settings/EditAddressScreen.tsx`

### 1️⃣ Matching Percentage: **84%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -6%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView, TextInput
```

### 3️⃣ Colors & Styles (3 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 3
```
#fee2e2, #dc2626, #9ca3af
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (3)

**Hardcoded Colors (3):**
- ❌ `#fee2e2` - Use design token instead
- ❌ `#dc2626` - Use design token instead
- ❌ `#9ca3af` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 47. PaymentMethods

**File Path:** `apps/WarmpawzCustomer/src/screens/settings/PaymentMethodsScreen.tsx`

### 1️⃣ Matching Percentage: **84%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -6%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
TouchableOpacity, SafeAreaView, ActivityIndicator, FlatList
```

### 3️⃣ Colors & Styles (3 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 3
```
#f3f4f6, #fee2e2, #dc2626
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (3)

**Hardcoded Colors (3):**
- ❌ `#f3f4f6` - Use design token instead
- ❌ `#fee2e2` - Use design token instead
- ❌ `#dc2626` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 48. Settings

**File Path:** `apps/WarmpawzCustomer/src/screens/settings/SettingsScreen.tsx`

### 1️⃣ Matching Percentage: **84%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -6%
- Missing API Integration: -10%

### 2️⃣ Components Used (3)

```
SafeAreaView, TouchableOpacity, ScrollView
```

### 3️⃣ Colors & Styles (3 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 3
```
#e5e7eb, #fee2e2, #dc2626
```

### 4️⃣ Layout Classes & Component Placement (2)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex, hidden
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (3)

**Hardcoded Colors (3):**
- ❌ `#e5e7eb` - Use design token instead
- ❌ `#fee2e2` - Use design token instead
- ❌ `#dc2626` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 49. ProductDetail

**File Path:** `apps/WarmpawzCustomer/src/screens/shop/ProductDetailScreen.tsx`

### 1️⃣ Matching Percentage: **84%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -6%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView
```

### 3️⃣ Colors & Styles (3 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 3
```
#dcfce7, #16a34a, #f3f4f6
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (3)

**Hardcoded Colors (3):**
- ❌ `#dcfce7` - Use design token instead
- ❌ `#16a34a` - Use design token instead
- ❌ `#f3f4f6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 50. BookingConfirmation

**File Path:** `apps/WarmpawzCustomer/src/screens/bookings/BookingConfirmationScreen.tsx`

### 1️⃣ Matching Percentage: **82%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -8%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView
```

### 3️⃣ Colors & Styles (4 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 4
```
#dcfce7, #16a34a, #fee2e2, #dc2626
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (4)

**Hardcoded Colors (4):**
- ❌ `#dcfce7` - Use design token instead
- ❌ `#16a34a` - Use design token instead
- ❌ `#fee2e2` - Use design token instead
- ❌ `#dc2626` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 51. PackageBooking

**File Path:** `apps/WarmpawzCustomer/src/screens/bookings/PackageBookingScreen.tsx`

### 1️⃣ Matching Percentage: **82%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -8%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator
```

### 3️⃣ Colors & Styles (4 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 4
```
#fff7ed, #dcfce7, #16a34a, #9ca3af
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (4)

**Hardcoded Colors (4):**
- ❌ `#fff7ed` - Use design token instead
- ❌ `#dcfce7` - Use design token instead
- ❌ `#16a34a` - Use design token instead
- ❌ `#9ca3af` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 52. ServiceBookingFlow

**File Path:** `apps/WarmpawzCustomer/src/screens/bookings/ServiceBookingFlowScreen.tsx`

### 1️⃣ Matching Percentage: **82%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -8%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator
```

### 3️⃣ Colors & Styles (4 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 4
```
#e5e7eb, #fff7ed, #f3f4f6, #9ca3af
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (4)

**Hardcoded Colors (4):**
- ❌ `#e5e7eb` - Use design token instead
- ❌ `#fff7ed` - Use design token instead
- ❌ `#f3f4f6` - Use design token instead
- ❌ `#9ca3af` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 53. Chat

**File Path:** `apps/WarmpawzCustomer/src/screens/chat/ChatScreen.tsx`

### 1️⃣ Matching Percentage: **82%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -8%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
SafeAreaView, TouchableOpacity, KeyboardAvoidingView, FlatList, TextInput
```

### 3️⃣ Colors & Styles (4 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 4
```
#16a34a, #e5e7eb, #f3f4f6, #9ca3af
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (4)

**Hardcoded Colors (4):**
- ❌ `#16a34a` - Use design token instead
- ❌ `#e5e7eb` - Use design token instead
- ❌ `#f3f4f6` - Use design token instead
- ❌ `#9ca3af` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 54. RescheduleBooking

**File Path:** `apps/WarmpawzCustomer/src/screens/bookings/RescheduleBookingScreen.tsx`

### 1️⃣ Matching Percentage: **80%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -10%
- Missing API Integration: -10%

### 2️⃣ Components Used (6)

```
TimeSlot, SafeAreaView, TouchableOpacity, ActivityIndicator, ScrollView, TextInput
```

### 3️⃣ Colors & Styles (5 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 5
```
#F9FAFB, #E5E7EB, #DBEAFE, #93C5FD, #FEE2E2
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (5)

**Hardcoded Colors (5):**
- ❌ `#F9FAFB` - Use design token instead
- ❌ `#E5E7EB` - Use design token instead
- ❌ `#DBEAFE` - Use design token instead
- ❌ `#93C5FD` - Use design token instead
- ❌ `#FEE2E2` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 55. ResortServices

**File Path:** `apps/WarmpawzCustomer/src/screens/services/ResortServicesScreen.tsx`

### 1️⃣ Matching Percentage: **80%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -10%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
ScrollView, TouchableOpacity, ActivityIndicator, TextInput, SafeAreaView
```

### 3️⃣ Colors & Styles (5 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 5
```
#F0FDFA, #F9FAFB, #E5E7EB, #FEF3C7, #92400E
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (5)

**Hardcoded Colors (5):**
- ❌ `#F0FDFA` - Use design token instead
- ❌ `#F9FAFB` - Use design token instead
- ❌ `#E5E7EB` - Use design token instead
- ❌ `#FEF3C7` - Use design token instead
- ❌ `#92400E` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 56. Addresses

**File Path:** `apps/WarmpawzCustomer/src/screens/settings/AddressesScreen.tsx`

### 1️⃣ Matching Percentage: **80%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -10%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
SafeAreaView, TouchableOpacity, ActivityIndicator, ScrollView, TextInput
```

### 3️⃣ Colors & Styles (5 unique)

**Approved Design Tokens:** 1
```
#EF4444
```

**⚠️ Hardcoded Colors:** 4
```
#F9FAFB, #E5E7EB, #F3F4F6, #FEE2E2
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (5)

**Hardcoded Colors (5):**
- ❌ `#F9FAFB` - Use design token instead
- ❌ `#E5E7EB` - Use design token instead
- ❌ `#EF4444` - Use design token instead
- ❌ `#F3F4F6` - Use design token instead
- ❌ `#FEE2E2` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 57. Checkout

**File Path:** `apps/WarmpawzCustomer/src/screens/shop/CheckoutScreen.tsx`

### 1️⃣ Matching Percentage: **80%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -10%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
SafeAreaView, TouchableOpacity, ScrollView, TextInput, ActivityIndicator
```

### 3️⃣ Colors & Styles (5 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 5
```
#fff7ed, #f3f4f6, #dcfce7, #16a34a, #9ca3af
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (5)

**Hardcoded Colors (5):**
- ❌ `#fff7ed` - Use design token instead
- ❌ `#f3f4f6` - Use design token instead
- ❌ `#dcfce7` - Use design token instead
- ❌ `#16a34a` - Use design token instead
- ❌ `#9ca3af` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 58. Subscriptions

**File Path:** `apps/WarmpawzCustomer/src/screens/subscriptions/SubscriptionsScreen.tsx`

### 1️⃣ Matching Percentage: **80%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -10%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView
```

### 3️⃣ Colors & Styles (5 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 5
```
#16a34a, #f59e0b, #dc2626, #f3f4f6, #fee2e2
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (5)

**Hardcoded Colors (5):**
- ❌ `#16a34a` - Use design token instead
- ❌ `#f59e0b` - Use design token instead
- ❌ `#dc2626` - Use design token instead
- ❌ `#f3f4f6` - Use design token instead
- ❌ `#fee2e2` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 59. PharmacyStore

**File Path:** `apps/WarmpawzCustomer/src/screens/services/PharmacyStoreScreen.tsx`

### 1️⃣ Matching Percentage: **78%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -12%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
ScrollView, TouchableOpacity, TextInput, ActivityIndicator, SafeAreaView
```

### 3️⃣ Colors & Styles (6 unique)

**Approved Design Tokens:** 1
```
#EF4444
```

**⚠️ Hardcoded Colors:** 5
```
#F9FAFB, #E5E7EB, #3B82F6, #FEF3C7, #92400E
```

### 4️⃣ Layout Classes & Component Placement (2)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex, hidden
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (6)

**Hardcoded Colors (6):**
- ❌ `#F9FAFB` - Use design token instead
- ❌ `#E5E7EB` - Use design token instead
- ❌ `#EF4444` - Use design token instead
- ❌ `#3B82F6` - Use design token instead
- ❌ `#FEF3C7` - Use design token instead
- ❌ `#92400E` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 60. EmergencyBooking

**File Path:** `apps/WarmpawzCustomer/src/screens/bookings/EmergencyBookingScreen.tsx`

### 1️⃣ Matching Percentage: **76%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -14%
- Missing API Integration: -10%

### 2️⃣ Components Used (6)

```
EmergencyService, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator, TextInput
```

### 3️⃣ Colors & Styles (7 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 6
```
#fee2e2, #dc2626, #991b1b, #fff7ed, #f3f4f6, #9ca3af
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (7)

**Hardcoded Colors (7):**
- ❌ `#fee2e2` - Use design token instead
- ❌ `#ef4444` - Use design token instead
- ❌ `#dc2626` - Use design token instead
- ❌ `#991b1b` - Use design token instead
- ❌ `#fff7ed` - Use design token instead
- ❌ `#f3f4f6` - Use design token instead
- ❌ `#9ca3af` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 61. PaymentFailureRecovery

**File Path:** `apps/WarmpawzCustomer/src/screens/payments/PaymentFailureRecoveryScreen.tsx`

### 1️⃣ Matching Percentage: **76%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -14%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator
```

### 3️⃣ Colors & Styles (7 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 7
```
#fee2e2, #fca5a5, #dc2626, #991b1b, #fff7ed, #f3f4f6, #9ca3af
```

### 4️⃣ Layout Classes & Component Placement (2)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
block, flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (7)

**Hardcoded Colors (7):**
- ❌ `#fee2e2` - Use design token instead
- ❌ `#fca5a5` - Use design token instead
- ❌ `#dc2626` - Use design token instead
- ❌ `#991b1b` - Use design token instead
- ❌ `#fff7ed` - Use design token instead
- ❌ `#f3f4f6` - Use design token instead
- ❌ `#9ca3af` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 62. CustomerPets

**File Path:** `apps/WarmpawzCustomer/src/screens/pets/CustomerPetsPageScreen.tsx`

### 1️⃣ Matching Percentage: **76%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -14%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
TouchableOpacity, SafeAreaView, ActivityIndicator, FlatList, RefreshControl
```

### 3️⃣ Colors & Styles (7 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 7
```
#F9FAFB, #E5E7EB, #DBEAFE, #FCE7F3, #F3F4F6, #1E40AF, #BE185D
```

### 4️⃣ Layout Classes & Component Placement (2)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex, hidden
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (7)

**Hardcoded Colors (7):**
- ❌ `#F9FAFB` - Use design token instead
- ❌ `#E5E7EB` - Use design token instead
- ❌ `#DBEAFE` - Use design token instead
- ❌ `#FCE7F3` - Use design token instead
- ❌ `#F3F4F6` - Use design token instead
- ❌ `#1E40AF` - Use design token instead
- ❌ `#BE185D` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 63. Wallet

**File Path:** `apps/WarmpawzCustomer/src/screens/wallet/WalletScreen.tsx`

### 1️⃣ Matching Percentage: **76%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -14%
- Missing API Integration: -10%

### 2️⃣ Components Used (6)

```
WalletData, SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView, TextInput
```

### 3️⃣ Colors & Styles (7 unique)

**Approved Design Tokens:** 1
```
#EF4444
```

**⚠️ Hardcoded Colors:** 6
```
#10B981, #F9FAFB, #E5E7EB, #F3F4F6, #FEE2E2, #F59E0B
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (7)

**Hardcoded Colors (7):**
- ❌ `#10B981` - Use design token instead
- ❌ `#EF4444` - Use design token instead
- ❌ `#F9FAFB` - Use design token instead
- ❌ `#E5E7EB` - Use design token instead
- ❌ `#F3F4F6` - Use design token instead
- ❌ `#FEE2E2` - Use design token instead
- ❌ `#F59E0B` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 64. ReferralSystem

**File Path:** `apps/WarmpawzCustomer/src/screens/rewards/ReferralSystemScreen.tsx`

### 1️⃣ Matching Percentage: **74%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -16%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
ReferralProfile, SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView
```

### 3️⃣ Colors & Styles (8 unique)

**Approved Design Tokens:** 1
```
#EF4444
```

**⚠️ Hardcoded Colors:** 7
```
#10B981, #F59E0B, #6B7280, #F9FAFB, #E5E7EB, #D1D5DB, #F3F4F6
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (8)

**Hardcoded Colors (8):**
- ❌ `#10B981` - Use design token instead
- ❌ `#F59E0B` - Use design token instead
- ❌ `#EF4444` - Use design token instead
- ❌ `#6B7280` - Use design token instead
- ❌ `#F9FAFB` - Use design token instead
- ❌ `#E5E7EB` - Use design token instead
- ❌ `#D1D5DB` - Use design token instead
- ❌ `#F3F4F6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 65. Notifications

**File Path:** `apps/WarmpawzCustomer/src/screens/notifications/NotificationsScreen.tsx`

### 1️⃣ Matching Percentage: **72%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -18%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView, RefreshControl
```

### 3️⃣ Colors & Styles (9 unique)

**Approved Design Tokens:** 1
```
#EF4444
```

**⚠️ Hardcoded Colors:** 8
```
#3B82F6, #10B981, #F59E0B, #EC4899, #6B7280, #F9FAFB, #E5E7EB, #F3F4F6
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (9)

**Hardcoded Colors (9):**
- ❌ `#3B82F6` - Use design token instead
- ❌ `#10B981` - Use design token instead
- ❌ `#F59E0B` - Use design token instead
- ❌ `#EF4444` - Use design token instead
- ❌ `#EC4899` - Use design token instead
- ❌ `#6B7280` - Use design token instead
- ❌ `#F9FAFB` - Use design token instead
- ❌ `#E5E7EB` - Use design token instead
- ❌ `#F3F4F6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 66. CustomerOnboarding

**File Path:** `apps/WarmpawzCustomer/src/screens/onboarding/CustomerOnboardingScreen.tsx`

### 1️⃣ Matching Percentage: **72%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -18%
- Missing API Integration: -10%

### 2️⃣ Components Used (3)

```
SafeAreaView, ScrollView, TouchableOpacity
```

### 3️⃣ Colors & Styles (9 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 9
```
#3b82f6, #eff6ff, #10b981, #f0fdf4, #8b5cf6, #faf5ff, #93c5fd, #dbeafe, #1e40af
```

### 4️⃣ Layout Classes & Component Placement (2)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex, hidden
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (9)

**Hardcoded Colors (9):**
- ❌ `#3b82f6` - Use design token instead
- ❌ `#eff6ff` - Use design token instead
- ❌ `#10b981` - Use design token instead
- ❌ `#f0fdf4` - Use design token instead
- ❌ `#8b5cf6` - Use design token instead
- ❌ `#faf5ff` - Use design token instead
- ❌ `#93c5fd` - Use design token instead
- ❌ `#dbeafe` - Use design token instead
- ❌ `#1e40af` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 67. CustomerPetProfile

**File Path:** `apps/WarmpawzCustomer/src/screens/pets/CustomerPetProfileScreen.tsx`

### 1️⃣ Matching Percentage: **72%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -18%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
TouchableOpacity, SafeAreaView, ScrollView, TextInput, ActivityIndicator
```

### 3️⃣ Colors & Styles (9 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 9
```
#ffffff, #FFF4E6, #EFF6FF, #3B82F6, #FEF2F2, #DC2626, #FFE0B2, #BFDBFE, #1E40AF
```

### 4️⃣ Layout Classes & Component Placement (2)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex, hidden
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (9)

**Hardcoded Colors (9):**
- ❌ `#ffffff` - Use design token instead
- ❌ `#FFF4E6` - Use design token instead
- ❌ `#EFF6FF` - Use design token instead
- ❌ `#3B82F6` - Use design token instead
- ❌ `#FEF2F2` - Use design token instead
- ❌ `#DC2626` - Use design token instead
- ❌ `#FFE0B2` - Use design token instead
- ❌ `#BFDBFE` - Use design token instead
- ❌ `#1E40AF` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 68. ServiceDiscovery

**File Path:** `apps/WarmpawzCustomer/src/screens/services/ServiceDiscoveryScreen.tsx`

### 1️⃣ Matching Percentage: **72%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -18%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
FlatList, TouchableOpacity, TextInput, ActivityIndicator, SafeAreaView
```

### 3️⃣ Colors & Styles (9 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 9
```
#FEE2E2, #DBEAFE, #E9D5FF, #D1FAE5, #FEF3C7, #FFE4D6, #FCE7F3, #E0E7FF, #FFF4E6
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (9)

**Hardcoded Colors (9):**
- ❌ `#FEE2E2` - Use design token instead
- ❌ `#DBEAFE` - Use design token instead
- ❌ `#E9D5FF` - Use design token instead
- ❌ `#D1FAE5` - Use design token instead
- ❌ `#FEF3C7` - Use design token instead
- ❌ `#FFE4D6` - Use design token instead
- ❌ `#FCE7F3` - Use design token instead
- ❌ `#E0E7FF` - Use design token instead
- ❌ `#FFF4E6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 69. RewardsLoyalty

**File Path:** `apps/WarmpawzCustomer/src/screens/rewards/RewardsLoyaltyScreen.tsx`

### 1️⃣ Matching Percentage: **70%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -20%
- Missing API Integration: -10%

### 2️⃣ Components Used (6)

```
LoyaltyProfile, RewardItem, SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView
```

### 3️⃣ Colors & Styles (10 unique)

**Approved Design Tokens:** 1
```
#EF4444
```

**⚠️ Hardcoded Colors:** 9
```
#9333EA, #6B7280, #F59E0B, #9CA3AF, #CD7F32, #10B981, #F9FAFB, #E5E7EB, #F3F4F6
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (10)

**Hardcoded Colors (10):**
- ❌ `#9333EA` - Use design token instead
- ❌ `#6B7280` - Use design token instead
- ❌ `#F59E0B` - Use design token instead
- ❌ `#9CA3AF` - Use design token instead
- ❌ `#CD7F32` - Use design token instead
- ❌ `#10B981` - Use design token instead
- ❌ `#EF4444` - Use design token instead
- ❌ `#F9FAFB` - Use design token instead
- ❌ `#E5E7EB` - Use design token instead
- ❌ `#F3F4F6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 70. ShopDashboard

**File Path:** `apps/WarmpawzCustomer/src/screens/services/ShopDashboardScreen.tsx`

### 1️⃣ Matching Percentage: **70%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -20%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
TouchableOpacity, TextInput, ScrollView, ActivityIndicator, SafeAreaView
```

### 3️⃣ Colors & Styles (10 unique)

**Approved Design Tokens:** 1
```
#EF4444
```

**⚠️ Hardcoded Colors:** 9
```
#667eea, #f5576c, #4facfe, #F9FAFB, #E5E7EB, #DBEAFE, #1E40AF, #10B981, #FEE2E2
```

### 4️⃣ Layout Classes & Component Placement (2)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex, hidden
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (10)

**Hardcoded Colors (10):**
- ❌ `#667eea` - Use design token instead
- ❌ `#f5576c` - Use design token instead
- ❌ `#4facfe` - Use design token instead
- ❌ `#EF4444` - Use design token instead
- ❌ `#F9FAFB` - Use design token instead
- ❌ `#E5E7EB` - Use design token instead
- ❌ `#DBEAFE` - Use design token instead
- ❌ `#1E40AF` - Use design token instead
- ❌ `#10B981` - Use design token instead
- ❌ `#FEE2E2` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 71. CustomerHavePetJourney

**File Path:** `apps/WarmpawzCustomer/src/screens/onboarding/CustomerHavePetJourneyScreen.tsx`

### 1️⃣ Matching Percentage: **68%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -22%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
TextInput, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator
```

### 3️⃣ Colors & Styles (11 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 11
```
#ffffff, #FFF4E6, #EFF6FF, #BFDBFE, #1E40AF, #1E3A8A, #FFE0B2, #B8621B, #F0FDF4, #BBF7D0
```

### 4️⃣ Layout Classes & Component Placement (2)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex, hidden
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (11)

**Hardcoded Colors (11):**
- ❌ `#ffffff` - Use design token instead
- ❌ `#FFF4E6` - Use design token instead
- ❌ `#EFF6FF` - Use design token instead
- ❌ `#BFDBFE` - Use design token instead
- ❌ `#1E40AF` - Use design token instead
- ❌ `#1E3A8A` - Use design token instead
- ❌ `#FFE0B2` - Use design token instead
- ❌ `#B8621B` - Use design token instead
- ❌ `#F0FDF4` - Use design token instead
- ❌ `#BBF7D0` - Use design token instead
- ❌ `#065F46` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 72. CustomerPlanningJourney

**File Path:** `apps/WarmpawzCustomer/src/screens/onboarding/CustomerPlanningJourneyScreen.tsx`

### 1️⃣ Matching Percentage: **66%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -24%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator
```

### 3️⃣ Colors & Styles (12 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 12
```
#ffffff, #FFF4E6, #FFE0B2, #B8621B, #F0FDF4, #BBF7D0, #065F46, #047857, #FEF2F2, #FECACA
```

### 4️⃣ Layout Classes & Component Placement (2)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex, hidden
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (12)

**Hardcoded Colors (12):**
- ❌ `#ffffff` - Use design token instead
- ❌ `#FFF4E6` - Use design token instead
- ❌ `#FFE0B2` - Use design token instead
- ❌ `#B8621B` - Use design token instead
- ❌ `#F0FDF4` - Use design token instead
- ❌ `#BBF7D0` - Use design token instead
- ❌ `#065F46` - Use design token instead
- ❌ `#047857` - Use design token instead
- ❌ `#FEF2F2` - Use design token instead
- ❌ `#FECACA` - Use design token instead
- ❌ `#991B1B` - Use design token instead
- ❌ `#DC2626` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 73. CancelBooking

**File Path:** `apps/WarmpawzCustomer/src/screens/bookings/CancelBookingScreen.tsx`

### 1️⃣ Matching Percentage: **64%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -26%
- Missing API Integration: -10%

### 2️⃣ Components Used (6)

```
RefundPreview, SafeAreaView, TouchableOpacity, ActivityIndicator, ScrollView, TextInput
```

### 3️⃣ Colors & Styles (13 unique)

**Approved Design Tokens:** 1
```
#EF4444
```

**⚠️ Hardcoded Colors:** 12
```
#F9FAFB, #E5E7EB, #F0FDF4, #10B981, #FEE2E2, #065F46, #991B1B, #047857, #DC2626, #FEF3C7
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (13)

**Hardcoded Colors (13):**
- ❌ `#F9FAFB` - Use design token instead
- ❌ `#E5E7EB` - Use design token instead
- ❌ `#F0FDF4` - Use design token instead
- ❌ `#10B981` - Use design token instead
- ❌ `#FEE2E2` - Use design token instead
- ❌ `#EF4444` - Use design token instead
- ❌ `#065F46` - Use design token instead
- ❌ `#991B1B` - Use design token instead
- ❌ `#047857` - Use design token instead
- ❌ `#DC2626` - Use design token instead
- ❌ `#FEF3C7` - Use design token instead
- ❌ `#FCD34D` - Use design token instead
- ❌ `#92400E` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 74. CustomerHome

**File Path:** `apps/WarmpawzCustomer/src/screens/home/CustomerHomeScreen.tsx`

### 1️⃣ Matching Percentage: **64%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -26%
- Missing API Integration: -10%

### 2️⃣ Components Used (3)

```
ActivityIndicator, ScrollView, TouchableOpacity
```

### 3️⃣ Colors & Styles (13 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 12
```
#3b82f6, #f97316, #ec4899, #8b5cf6, #10b981, #6366f1, #f59e0b, #e9d5ff, #fce7f3, #d1fae5
```

### 4️⃣ Layout Classes & Component Placement (2)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex, hidden
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (13)

**Hardcoded Colors (13):**
- ❌ `#3b82f6` - Use design token instead
- ❌ `#f97316` - Use design token instead
- ❌ `#ec4899` - Use design token instead
- ❌ `#8b5cf6` - Use design token instead
- ❌ `#10b981` - Use design token instead
- ❌ `#6366f1` - Use design token instead
- ❌ `#ef4444` - Use design token instead
- ❌ `#f59e0b` - Use design token instead
- ❌ `#e9d5ff` - Use design token instead
- ❌ `#fce7f3` - Use design token instead
- ❌ `#d1fae5` - Use design token instead
- ❌ `#fee2e2` - Use design token instead
- ❌ `#dc2626` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 75. BookingDetail

**File Path:** `apps/WarmpawzCustomer/src/screens/bookings/BookingDetailScreen.tsx`

### 1️⃣ Matching Percentage: **62%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -28%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView
```

### 3️⃣ Colors & Styles (14 unique)

**Approved Design Tokens:** 1
```
#EF4444
```

**⚠️ Hardcoded Colors:** 13
```
#3B82F6, #10B981, #6B7280, #F59E0B, #F0FDF4, #FEF3C7, #065F46, #047857, #92400E, #F9FAFB
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (14)

**Hardcoded Colors (14):**
- ❌ `#3B82F6` - Use design token instead
- ❌ `#10B981` - Use design token instead
- ❌ `#6B7280` - Use design token instead
- ❌ `#EF4444` - Use design token instead
- ❌ `#F59E0B` - Use design token instead
- ❌ `#F0FDF4` - Use design token instead
- ❌ `#FEF3C7` - Use design token instead
- ❌ `#065F46` - Use design token instead
- ❌ `#047857` - Use design token instead
- ❌ `#92400E` - Use design token instead
- ❌ `#F9FAFB` - Use design token instead
- ❌ `#E5E7EB` - Use design token instead
- ❌ `#FEE2E2` - Use design token instead
- ❌ `#DBEAFE` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 76. OrderDetail

**File Path:** `apps/WarmpawzCustomer/src/screens/orders/OrderDetailScreen.tsx`

### 1️⃣ Matching Percentage: **60%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -30%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView
```

### 3️⃣ Colors & Styles (15 unique)

**Approved Design Tokens:** 1
```
#EF4444
```

**⚠️ Hardcoded Colors:** 14
```
#F59E0B, #3B82F6, #8B5CF6, #10B981, #6B7280, #E5E7EB, #9CA3AF, #F9FAFB, #FEE2E2, #FECACA
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (15)

**Hardcoded Colors (15):**
- ❌ `#F59E0B` - Use design token instead
- ❌ `#3B82F6` - Use design token instead
- ❌ `#8B5CF6` - Use design token instead
- ❌ `#10B981` - Use design token instead
- ❌ `#EF4444` - Use design token instead
- ❌ `#6B7280` - Use design token instead
- ❌ `#E5E7EB` - Use design token instead
- ❌ `#9CA3AF` - Use design token instead
- ❌ `#F9FAFB` - Use design token instead
- ❌ `#FEE2E2` - Use design token instead
- ❌ `#FECACA` - Use design token instead
- ❌ `#991B1B` - Use design token instead
- ❌ `#7F1D1D` - Use design token instead
- ❌ `#F0F9FF` - Use design token instead
- ❌ `#F3F4F6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

### VENDOR-MOBILE (49 screens)

#### 1. About

**File Path:** `apps/WarmpawzVendor/src/screens/about/AboutScreen.tsx`

### 1️⃣ Matching Percentage: **90%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -0%
- Missing API Integration: -10%

### 2️⃣ Components Used (3)

```
SafeAreaView, TouchableOpacity, ScrollView
```

### 3️⃣ Colors & Styles (0 unique)

*No color classes detected*

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration
- ❌ Color styling

### 6️⃣ Violations (0)

✅ No violations detected

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 2. VendorAuth

**File Path:** `apps/WarmpawzVendor/src/screens/auth/VendorAuthScreen.tsx`

### 1️⃣ Matching Percentage: **90%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -0%
- Missing API Integration: -10%

### 2️⃣ Components Used (7)

```
GradientBackground, KeyboardAvoidingView, ScrollView, TouchableOpacity, WarmPawzLogo, TextInput, ActivityIndicator
```

### 3️⃣ Colors & Styles (0 unique)

*No color classes detected*

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration
- ❌ Color styling

### 6️⃣ Violations (0)

✅ No violations detected

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 3. BookingActions

**File Path:** `apps/WarmpawzVendor/src/screens/bookings/BookingActionsScreen.tsx`

### 1️⃣ Matching Percentage: **90%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -0%
- Missing API Integration: -10%

### 2️⃣ Components Used (3)

```
SafeAreaView, TouchableOpacity, ScrollView
```

### 3️⃣ Colors & Styles (0 unique)

*No color classes detected*

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration
- ❌ Color styling

### 6️⃣ Violations (0)

✅ No violations detected

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 4. DataExport

**File Path:** `apps/WarmpawzVendor/src/screens/export/DataExportScreen.tsx`

### 1️⃣ Matching Percentage: **90%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -0%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator
```

### 3️⃣ Colors & Styles (0 unique)

*No color classes detected*

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration
- ❌ Color styling

### 6️⃣ Violations (0)

✅ No violations detected

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 5. VendorLanding

**File Path:** `apps/WarmpawzVendor/src/screens/landing/VendorLandingScreen.tsx`

### 1️⃣ Matching Percentage: **90%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -0%
- Missing API Integration: -10%

### 2️⃣ Components Used (6)

```
ActivityIndicator, GradientBackground, SafeAreaView, ScrollView, StatusIcon, TouchableOpacity
```

### 3️⃣ Colors & Styles (0 unique)

*No color classes detected*

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration
- ❌ Color styling

### 6️⃣ Violations (0)

✅ No violations detected

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 6. RealTimeUpdates

**File Path:** `apps/WarmpawzVendor/src/screens/realtime/RealTimeUpdatesScreen.tsx`

### 1️⃣ Matching Percentage: **90%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -0%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
WebSocket, TouchableOpacity, SafeAreaView, FlatList, ActivityIndicator
```

### 3️⃣ Colors & Styles (0 unique)

*No color classes detected*

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration
- ❌ Color styling

### 6️⃣ Violations (0)

✅ No violations detected

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 7. VendorSchedule

**File Path:** `apps/WarmpawzVendor/src/screens/schedule/VendorScheduleScreen.tsx`

### 1️⃣ Matching Percentage: **90%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -0%
- Missing API Integration: -10%

### 2️⃣ Components Used (6)

```
TouchableOpacity, SafeAreaView, ActivityIndicator, ScrollView, RefreshControl, FlatList
```

### 3️⃣ Colors & Styles (0 unique)

*No color classes detected*

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration
- ❌ Color styling

### 6️⃣ Violations (0)

✅ No violations detected

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 8. Settings

**File Path:** `apps/WarmpawzVendor/src/screens/settings/SettingsScreen.tsx`

### 1️⃣ Matching Percentage: **90%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -0%
- Missing API Integration: -10%

### 2️⃣ Components Used (3)

```
SafeAreaView, TouchableOpacity, ScrollView
```

### 3️⃣ Colors & Styles (0 unique)

*No color classes detected*

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration
- ❌ Color styling

### 6️⃣ Violations (0)

✅ No violations detected

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 9. StaffDashboard

**File Path:** `apps/WarmpawzVendor/src/screens/staff/StaffDashboardScreen.tsx`

### 1️⃣ Matching Percentage: **90%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -0%
- Missing API Integration: -10%

### 2️⃣ Components Used (6)

```
SafeAreaView, ActivityIndicator, ScrollView, RefreshControl, FlatList, TouchableOpacity
```

### 3️⃣ Colors & Styles (0 unique)

*No color classes detected*

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration
- ❌ Color styling

### 6️⃣ Violations (0)

✅ No violations detected

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 10. StaffEarnings

**File Path:** `apps/WarmpawzVendor/src/screens/staff/StaffEarningsScreen.tsx`

### 1️⃣ Matching Percentage: **90%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -0%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView, RefreshControl
```

### 3️⃣ Colors & Styles (0 unique)

*No color classes detected*

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration
- ❌ Color styling

### 6️⃣ Violations (0)

✅ No violations detected

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 11. PerformanceMetrics

**File Path:** `apps/WarmpawzVendor/src/screens/analytics/PerformanceMetricsScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#ffffff
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#ffffff` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 12. BookingCheckIn

**File Path:** `apps/WarmpawzVendor/src/screens/bookings/BookingCheckInScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
SafeAreaView, TouchableOpacity, ScrollView, TextInput, ActivityIndicator
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#ffffff
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#ffffff` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 13. BookingDetail

**File Path:** `apps/WarmpawzVendor/src/screens/bookings/BookingDetailScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
BookingCompletionScreen, SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#ffffff
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#ffffff` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 14. FileUpload

**File Path:** `apps/WarmpawzVendor/src/screens/bookings/FileUploadScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
UploadedFile, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#ffffff
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#ffffff` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 15. Chat

**File Path:** `apps/WarmpawzVendor/src/screens/chat/ChatScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (7)

```
WebSocket, SafeAreaView, ActivityIndicator, TouchableOpacity, KeyboardAvoidingView, FlatList, TextInput
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#ffffff
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#ffffff` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 16. VendorDashboard

**File Path:** `apps/WarmpawzVendor/src/screens/dashboard/VendorDashboardScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (6)

```
TouchableOpacity, SafeAreaView, ActivityIndicator, ScrollView, RefreshControl, FlatList
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#FFF4E6
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#FFF4E6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 17. FinancialSummary

**File Path:** `apps/WarmpawzVendor/src/screens/financial/FinancialSummaryScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#ffffff
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#ffffff` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 18. Help

**File Path:** `apps/WarmpawzVendor/src/screens/help/HelpScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
SafeAreaView, TouchableOpacity, ScrollView, TextInput
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#ffffff
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#ffffff` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 19. LocationSharing

**File Path:** `apps/WarmpawzVendor/src/screens/location/LocationSharingScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (3)

```
SafeAreaView, TouchableOpacity, MapView
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#E6F7E6
```

### 4️⃣ Layout Classes & Component Placement (2)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex, hidden
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#E6F7E6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 20. Logout

**File Path:** `apps/WarmpawzVendor/src/screens/logout/LogoutScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (3)

```
SafeAreaView, TouchableOpacity, ActivityIndicator
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#ffffff
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#ffffff` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 21. ConnectionStatus

**File Path:** `apps/WarmpawzVendor/src/screens/network/ConnectionStatusScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (3)

```
SafeAreaView, TouchableOpacity, ScrollView
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#FFF4E6
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#FFF4E6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 22. NotificationCenter

**File Path:** `apps/WarmpawzVendor/src/screens/notifications/NotificationCenterScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
TouchableOpacity, SafeAreaView, ActivityIndicator, FlatList, RefreshControl
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#FFF4E6
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#FFF4E6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 23. NotificationsSettings

**File Path:** `apps/WarmpawzVendor/src/screens/notifications/NotificationsSettingsScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (3)

```
SafeAreaView, TouchableOpacity, ScrollView
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#ffffff
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#ffffff` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 24. Payouts

**File Path:** `apps/WarmpawzVendor/src/screens/payouts/PayoutsScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
SafeAreaView, ActivityIndicator, TouchableOpacity, FlatList, RefreshControl
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#ffffff
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#ffffff` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 25. Preferences

**File Path:** `apps/WarmpawzVendor/src/screens/preferences/PreferencesScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (3)

```
SafeAreaView, TouchableOpacity, ScrollView
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#ffffff
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#ffffff` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 26. Privacy

**File Path:** `apps/WarmpawzVendor/src/screens/privacy/PrivacyScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (3)

```
SafeAreaView, TouchableOpacity, ScrollView
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#ffffff
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#ffffff` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 27. Profile

**File Path:** `apps/WarmpawzVendor/src/screens/profile/ProfileScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView, TextInput
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#ffffff
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#ffffff` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 28. RouteOptimization

**File Path:** `apps/WarmpawzVendor/src/screens/routing/RouteOptimizationScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
SafeAreaView, TouchableOpacity, MapView, ActivityIndicator
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#ffffff
```

### 4️⃣ Layout Classes & Component Placement (2)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex, hidden
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#ffffff` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 29. Security

**File Path:** `apps/WarmpawzVendor/src/screens/security/SecurityScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
SafeAreaView, TouchableOpacity, ScrollView, TextInput, ActivityIndicator
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#ffffff
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#ffffff` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 30. TaxDocuments

**File Path:** `apps/WarmpawzVendor/src/screens/tax/TaxDocumentsScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
TouchableOpacity, ActivityIndicator, SafeAreaView, FlatList
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#ffffff
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#ffffff` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 31. GPSTracking

**File Path:** `apps/WarmpawzVendor/src/screens/tracking/GPSTrackingScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
LocationPoint, SafeAreaView, TouchableOpacity, MapView
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#ffffff
```

### 4️⃣ Layout Classes & Component Placement (2)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex, hidden
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#ffffff` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 32. RouteTracking

**File Path:** `apps/WarmpawzVendor/src/screens/tracking/RouteTrackingScreen.tsx`

### 1️⃣ Matching Percentage: **88%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -2%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
GPSTrackingScreen, SafeAreaView, TouchableOpacity, MapView, ScrollView
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 1
```
#ffffff
```

### 4️⃣ Layout Classes & Component Placement (2)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex, hidden
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (1)

**Hardcoded Colors (1):**
- ❌ `#ffffff` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 33. Account

**File Path:** `apps/WarmpawzVendor/src/screens/account/AccountScreen.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -4%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView
```

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 2
```
#ffffff, #FFF4E6
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (2)

**Hardcoded Colors (2):**
- ❌ `#ffffff` - Use design token instead
- ❌ `#FFF4E6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 34. RevenueAnalytics

**File Path:** `apps/WarmpawzVendor/src/screens/analytics/RevenueAnalyticsScreen.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -4%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView
```

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 2
```
#FFF4E6, #ffffff
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (2)

**Hardcoded Colors (2):**
- ❌ `#FFF4E6` - Use design token instead
- ❌ `#ffffff` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 35. BookingCompletion

**File Path:** `apps/WarmpawzVendor/src/screens/bookings/BookingCompletionScreen.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -4%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
SafeAreaView, TouchableOpacity, ScrollView, TextInput, ActivityIndicator
```

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 2
```
#ffffff, #FFF4E6
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (2)

**Hardcoded Colors (2):**
- ❌ `#ffffff` - Use design token instead
- ❌ `#FFF4E6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 36. StaffAssignment

**File Path:** `apps/WarmpawzVendor/src/screens/bookings/StaffAssignmentScreen.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -4%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
TouchableOpacity, SafeAreaView, ActivityIndicator, FlatList
```

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 2
```
#ffffff, #FFF4E6
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (2)

**Hardcoded Colors (2):**
- ❌ `#ffffff` - Use design token instead
- ❌ `#FFF4E6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 37. StartService

**File Path:** `apps/WarmpawzVendor/src/screens/bookings/StartServiceScreen.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -4%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
SafeAreaView, TouchableOpacity, TextInput, ActivityIndicator
```

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 2
```
#ffffff, #FFF4E6
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (2)

**Hardcoded Colors (2):**
- ❌ `#ffffff` - Use design token instead
- ❌ `#FFF4E6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 38. VendorBookingManagement

**File Path:** `apps/WarmpawzVendor/src/screens/bookings/VendorBookingManagementScreen.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -4%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
TouchableOpacity, SafeAreaView, ActivityIndicator, FlatList, RefreshControl
```

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 2
```
#FFF4E6, #ffffff
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (2)

**Hardcoded Colors (2):**
- ❌ `#FFF4E6` - Use design token instead
- ❌ `#ffffff` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 39. CommissionBreakdown

**File Path:** `apps/WarmpawzVendor/src/screens/earnings/CommissionBreakdownScreen.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -4%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView
```

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 2
```
#ffffff, #FFF4E6
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (2)

**Hardcoded Colors (2):**
- ❌ `#ffffff` - Use design token instead
- ❌ `#FFF4E6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 40. Earnings

**File Path:** `apps/WarmpawzVendor/src/screens/earnings/EarningsScreen.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -4%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView, RefreshControl
```

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 2
```
#FFF4E6, #ffffff
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (2)

**Hardcoded Colors (2):**
- ❌ `#FFF4E6` - Use design token instead
- ❌ `#ffffff` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 41. OfflineMode

**File Path:** `apps/WarmpawzVendor/src/screens/offline/OfflineModeScreen.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -4%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator
```

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 2
```
#ffffff, #FFF4E6
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (2)

**Hardcoded Colors (2):**
- ❌ `#ffffff` - Use design token instead
- ❌ `#FFF4E6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 42. VendorOnboarding

**File Path:** `apps/WarmpawzVendor/src/screens/onboarding/VendorOnboardingScreen.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -4%
- Missing API Integration: -10%

### 2️⃣ Components Used (7)

```
TextInput, TouchableOpacity, SafeAreaView, ActivityIndicator, GradientBackground, ScrollView, StatusIcon
```

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 2
```
#ffffff, #FFF4E6
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (2)

**Hardcoded Colors (2):**
- ❌ `#ffffff` - Use design token instead
- ❌ `#FFF4E6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 43. Reports

**File Path:** `apps/WarmpawzVendor/src/screens/reports/ReportsScreen.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -4%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView
```

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 2
```
#FFF4E6, #ffffff
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (2)

**Hardcoded Colors (2):**
- ❌ `#FFF4E6` - Use design token instead
- ❌ `#ffffff` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 44. VendorServiceManagement

**File Path:** `apps/WarmpawzVendor/src/screens/services/VendorServiceManagementScreen.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -4%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
SafeAreaView, ActivityIndicator, ScrollView, TouchableOpacity, TextInput
```

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 2
```
#ffffff, #FFF4E6
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (2)

**Hardcoded Colors (2):**
- ❌ `#ffffff` - Use design token instead
- ❌ `#FFF4E6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 45. TransactionHistory

**File Path:** `apps/WarmpawzVendor/src/screens/transactions/TransactionHistoryScreen.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -4%
- Missing API Integration: -10%

### 2️⃣ Components Used (5)

```
SafeAreaView, ActivityIndicator, TouchableOpacity, FlatList, RefreshControl
```

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 2
```
#FFF4E6, #ffffff
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (2)

**Hardcoded Colors (2):**
- ❌ `#FFF4E6` - Use design token instead
- ❌ `#ffffff` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 46. EmergencyAlert

**File Path:** `apps/WarmpawzVendor/src/screens/emergency/EmergencyAlertScreen.tsx`

### 1️⃣ Matching Percentage: **84%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -6%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
SafeAreaView, TouchableOpacity, ScrollView, TextInput
```

### 3️⃣ Colors & Styles (3 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 3
```
#FFF4E6, #ffffff, #F0F0F0
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (3)

**Hardcoded Colors (3):**
- ❌ `#FFF4E6` - Use design token instead
- ❌ `#ffffff` - Use design token instead
- ❌ `#F0F0F0` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 47. VendorRoleSelection

**File Path:** `apps/WarmpawzVendor/src/screens/onboarding/VendorRoleSelectionScreen.tsx`

### 1️⃣ Matching Percentage: **84%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -6%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
ActivityIndicator, SafeAreaView, ScrollView, TouchableOpacity
```

### 3️⃣ Colors & Styles (3 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 3
```
#3b82f6, #8b5cf6, #10b981
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (3)

**Hardcoded Colors (3):**
- ❌ `#3b82f6` - Use design token instead
- ❌ `#8b5cf6` - Use design token instead
- ❌ `#10b981` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 48. VideoCall

**File Path:** `apps/WarmpawzVendor/src/screens/video/VideoCallScreen.tsx`

### 1️⃣ Matching Percentage: **84%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -6%
- Missing API Integration: -10%

### 2️⃣ Components Used (3)

```
SafeAreaView, ActivityIndicator, TouchableOpacity
```

### 3️⃣ Colors & Styles (3 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 3
```
#000000, #ffffff, #1a1a1a
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (3)

**Hardcoded Colors (3):**
- ❌ `#000000` - Use design token instead
- ❌ `#ffffff` - Use design token instead
- ❌ `#1a1a1a` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 49. StaffManagement

**File Path:** `apps/WarmpawzVendor/src/screens/staff/StaffManagementScreen.tsx`

### 1️⃣ Matching Percentage: **78%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -12%
- Missing API Integration: -10%

### 2️⃣ Components Used (6)

```
SafeAreaView, ActivityIndicator, TouchableOpacity, FlatList, ScrollView, TextInput
```

### 3️⃣ Colors & Styles (6 unique)

**Approved Design Tokens:** 0
**⚠️ Hardcoded Colors:** 6
```
#ffffff, #EFF6FF, #3B82F6, #FEF2F2, #DC2626, #FFF4E6
```

### 4️⃣ Layout Classes & Component Placement (1)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 0 classes

**Sample Layout Classes:**
```
flex
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (6)

**Hardcoded Colors (6):**
- ❌ `#ffffff` - Use design token instead
- ❌ `#EFF6FF` - Use design token instead
- ❌ `#3B82F6` - Use design token instead
- ❌ `#FEF2F2` - Use design token instead
- ❌ `#DC2626` - Use design token instead
- ❌ `#FFF4E6` - Use design token instead

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

### ADMIN-WEB (20 screens)

#### 1. page

**File Path:** `apps/admin-web/app/page.tsx`

### 1️⃣ Matching Percentage: **92%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -8%

### 2️⃣ Components Used (1)

```
AdminApp
```

### 3️⃣ Colors & Styles (13 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (40)

**Layout Type:**
- Flex: 2 classes
- Grid: 0 classes
- Spacing: 8 classes
- Sizing: 13 classes

**Sample Layout Classes:**
```
flex, block, flex-col, items-center, justify-center, gap-2, space-y-4, p-4, px-4, py-2, p-8, p-2, py-3, py-4, mt-4, mb-8, mb-4, mt-2, mb-6, mt-1, mb-2, mb-1, mt-6, min-h-screen, h-12
```

### 5️⃣ Missing Items

✅ No missing items detected

### 6️⃣ Violations (4)

**Non-Standard Spacing (4):**
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ✅ Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**API Endpoints Used (1):**
- ✅ `post /admin/auth/login`

**API Contract Issues:**
- ⚠️ Invalid HTTP method: post

---

#### 2. page

**File Path:** `apps/admin-web/app/logistics/page.tsx`

### 1️⃣ Matching Percentage: **90%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -0%
- Missing API Integration: -10%

### 2️⃣ Components Used (1)

```
AdminLogisticsPage
```

### 3️⃣ Colors & Styles (0 unique)

*No color classes detected*

### 4️⃣ Layout Classes & Component Placement (0)

*No layout classes detected*

### 5️⃣ Missing Items

- ❌ API Integration
- ❌ Color styling
- ❌ Layout classes

### 6️⃣ Violations (0)

✅ No violations detected

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 3. page

**File Path:** `apps/admin-web/app/refunds/page.tsx`

### 1️⃣ Matching Percentage: **90%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -0%
- Missing API Integration: -10%

### 2️⃣ Components Used (1)

```
AdminRefundsPage
```

### 3️⃣ Colors & Styles (0 unique)

*No color classes detected*

### 4️⃣ Layout Classes & Component Placement (0)

*No layout classes detected*

### 5️⃣ Missing Items

- ❌ API Integration
- ❌ Color styling
- ❌ Layout classes

### 6️⃣ Violations (0)

✅ No violations detected

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 4. page

**File Path:** `apps/admin-web/app/roles/page.tsx`

### 1️⃣ Matching Percentage: **90%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -0%
- Missing API Integration: -10%

### 2️⃣ Components Used (1)

```
AdminRolesPage
```

### 3️⃣ Colors & Styles (0 unique)

*No color classes detected*

### 4️⃣ Layout Classes & Component Placement (0)

*No layout classes detected*

### 5️⃣ Missing Items

- ❌ API Integration
- ❌ Color styling
- ❌ Layout classes

### 6️⃣ Violations (0)

✅ No violations detected

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 5. page

**File Path:** `apps/admin-web/app/vendors/page.tsx`

### 1️⃣ Matching Percentage: **90%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -0%
- Missing API Integration: -10%

### 2️⃣ Components Used (1)

```
AdminVendorsPage
```

### 3️⃣ Colors & Styles (0 unique)

*No color classes detected*

### 4️⃣ Layout Classes & Component Placement (0)

*No layout classes detected*

### 5️⃣ Missing Items

- ❌ API Integration
- ❌ Color styling
- ❌ Layout classes

### 6️⃣ Violations (0)

✅ No violations detected

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 6. AdminSettlements

**File Path:** `apps/admin-web/components/admin/AdminSettlementsPage.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -14%

### 2️⃣ Components Used (1)

```
SettlementStats
```

### 3️⃣ Colors & Styles (22 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (35)

**Layout Type:**
- Flex: 1 classes
- Grid: 1 classes
- Spacing: 11 classes
- Sizing: 12 classes

**Sample Layout Classes:**
```
flex, grid, hidden, items-center, justify-between, justify-center, gap-3, gap-4, p-6, p-3, px-4, py-2, p-4, p-1, px-2, py-1, py-12, mb-6, mt-4, w-100, w-700, w-sm, w-10, h-10, w-fit
```

### 5️⃣ Missing Items

✅ No missing items detected

### 6️⃣ Violations (7)

**Non-Standard Spacing (7):**
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ✅ Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**API Endpoints Used (2):**
- ✅ `post /settlements/calculate-daily`
- ✅ `post /settlements/process-payouts`

**API Contract Issues:**
- ⚠️ Invalid HTTP method: post
- ⚠️ Invalid HTTP method: post

---

#### 7. AdminRoles

**File Path:** `apps/admin-web/components/admin/AdminRolesPage.tsx`

### 1️⃣ Matching Percentage: **82%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -18%

### 2️⃣ Components Used (2)

```
RoleDetailModal, AddRoleModal
```

### 3️⃣ Colors & Styles (15 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (48)

**Layout Type:**
- Flex: 1 classes
- Grid: 1 classes
- Spacing: 12 classes
- Sizing: 14 classes

**Sample Layout Classes:**
```
flex, grid, block, items-center, justify-center, justify-between, items-start, gap-4, space-y-4, gap-2, gap-3, p-6, px-4, py-2, p-4, px-2, py-1, p-2, pt-3, px-3, p-3, pt-4, mb-6, mt-2, mt-4
```

### 5️⃣ Missing Items

✅ No missing items detected

### 6️⃣ Violations (9)

**Non-Standard Spacing (9):**
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ✅ Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**API Endpoints Used (1):**
- ✅ `post /admin/roles`

**API Contract Issues:**
- ⚠️ Invalid HTTP method: post

---

#### 8. AdminLogistics

**File Path:** `apps/admin-web/components/admin/AdminLogisticsPage.tsx`

### 1️⃣ Matching Percentage: **80%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -20%

### 2️⃣ Components Used (3)

```
LogisticsStats, ShipmentOrder, OrderDetailModal
```

### 3️⃣ Colors & Styles (27 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (43)

**Layout Type:**
- Flex: 1 classes
- Grid: 1 classes
- Spacing: 14 classes
- Sizing: 13 classes

**Sample Layout Classes:**
```
flex, grid, hidden, items-center, justify-between, justify-center, gap-4, gap-2, space-y-2, gap-3, p-6, px-4, py-2, p-4, p-1, px-2, py-1, p-2, px-3, py-12, p-3, pt-4, mb-6, mt-4, mb-4
```

### 5️⃣ Missing Items

✅ No missing items detected

### 6️⃣ Violations (10)

**Non-Standard Spacing (10):**
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ✅ Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**API Endpoints Used (1):**
- ✅ `post /logistics/cancel-order`

**API Contract Issues:**
- ⚠️ Invalid HTTP method: post

---

#### 9. page

**File Path:** `apps/admin-web/app/notifications/page.tsx`

### 1️⃣ Matching Percentage: **78%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -22%

### 2️⃣ Components Used (0)

*No components detected in code*

### 3️⃣ Colors & Styles (31 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (49)

**Layout Type:**
- Flex: 1 classes
- Grid: 1 classes
- Spacing: 18 classes
- Sizing: 10 classes

**Sample Layout Classes:**
```
flex, grid, block, items-center, justify-center, justify-between, items-start, space-y-4, gap-4, gap-3, gap-2, px-8, py-6, px-4, py-2, p-8, p-4, p-12, p-6, p-3, px-3, py-1, pt-4, p-0, py-3
```

### 5️⃣ Missing Items

- ❌ Component structure

### 6️⃣ Violations (11)

**Non-Standard Spacing (11):**
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ✅ Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**API Endpoints Used (1):**
- ✅ `post /admin/notifications`

**API Contract Issues:**
- ⚠️ Invalid HTTP method: post

---

#### 10. page

**File Path:** `apps/admin-web/app/promotions/page.tsx`

### 1️⃣ Matching Percentage: **78%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -22%

### 2️⃣ Components Used (0)

*No components detected in code*

### 3️⃣ Colors & Styles (27 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (46)

**Layout Type:**
- Flex: 2 classes
- Grid: 1 classes
- Spacing: 19 classes
- Sizing: 9 classes

**Sample Layout Classes:**
```
flex, hidden, grid, block, flex-wrap, items-center, justify-center, justify-between, gap-3, gap-4, gap-2, space-y-6, px-8, py-6, p-3, px-4, py-2, p-8, p-4, p-6, px-6, py-4, py-12, px-2, py-1
```

### 5️⃣ Missing Items

- ❌ Component structure

### 6️⃣ Violations (11)

**Non-Standard Spacing (11):**
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ✅ Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**API Endpoints Used (1):**
- ✅ `post /admin/promotions`

**API Contract Issues:**
- ⚠️ Invalid HTTP method: post

---

#### 11. page

**File Path:** `apps/admin-web/app/regions/page.tsx`

### 1️⃣ Matching Percentage: **78%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -22%

### 2️⃣ Components Used (0)

*No components detected in code*

### 3️⃣ Colors & Styles (27 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (43)

**Layout Type:**
- Flex: 1 classes
- Grid: 1 classes
- Spacing: 18 classes
- Sizing: 8 classes

**Sample Layout Classes:**
```
flex, hidden, grid, block, items-center, justify-center, justify-between, gap-2, space-y-4, gap-4, gap-3, px-8, py-6, px-4, py-2, p-8, p-4, px-6, py-4, py-12, px-2, py-1, p-2, p-6, py-3
```

### 5️⃣ Missing Items

- ❌ Component structure

### 6️⃣ Violations (11)

**Non-Standard Spacing (11):**
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ✅ Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**API Endpoints Used (1):**
- ✅ `post /admin/regions`

**API Contract Issues:**
- ⚠️ Invalid HTTP method: post

---

#### 12. page

**File Path:** `apps/admin-web/app/reports/page.tsx`

### 1️⃣ Matching Percentage: **78%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -22%

### 2️⃣ Components Used (1)

```
ReportTemplate
```

### 3️⃣ Colors & Styles (30 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (50)

**Layout Type:**
- Flex: 2 classes
- Grid: 1 classes
- Spacing: 18 classes
- Sizing: 6 classes

**Sample Layout Classes:**
```
flex, grid, block, inline, flex-wrap, items-center, justify-center, justify-between, items-start, gap-8, gap-2, space-y-2, gap-3, space-y-4, space-y-3, px-8, py-6, p-8, p-4, p-6, p-2, px-3, py-1, p-3, py-12
```

### 5️⃣ Missing Items

✅ No missing items detected

### 6️⃣ Violations (11)

**Non-Standard Spacing (11):**
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ✅ Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**API Endpoints Used (2):**
- ✅ `post /admin/reports/generate`
- ✅ `post /admin/reports/save`

**API Contract Issues:**
- ⚠️ Invalid HTTP method: post
- ⚠️ Invalid HTTP method: post

---

#### 13. page

**File Path:** `apps/admin-web/app/settlements/page.tsx`

### 1️⃣ Matching Percentage: **76%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -24%

### 2️⃣ Components Used (2)

```
SettlementSummary, SettlementDetail
```

### 3️⃣ Colors & Styles (40 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (52)

**Layout Type:**
- Flex: 2 classes
- Grid: 1 classes
- Spacing: 20 classes
- Sizing: 14 classes

**Sample Layout Classes:**
```
flex, grid, hidden, flex-wrap, items-center, justify-center, justify-between, gap-3, gap-6, gap-4, gap-2, px-8, py-6, p-3, px-4, py-2, p-8, p-4, p-6, px-6, py-4, py-12, px-2, py-1, p-2
```

### 5️⃣ Missing Items

✅ No missing items detected

### 6️⃣ Violations (12)

**Non-Standard Spacing (12):**
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ✅ Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**API Endpoints Used (3):**
- ✅ `post /settlements/process`
- ✅ `post /settlements/auto-process`

**API Contract Issues:**
- ⚠️ Invalid HTTP method: post
- ⚠️ Invalid HTTP method: post
- ⚠️ Invalid HTTP method: post

---

#### 14. page

**File Path:** `apps/admin-web/app/tiers/page.tsx`

### 1️⃣ Matching Percentage: **76%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -24%

### 2️⃣ Components Used (0)

*No components detected in code*

### 3️⃣ Colors & Styles (29 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (54)

**Layout Type:**
- Flex: 1 classes
- Grid: 1 classes
- Spacing: 18 classes
- Sizing: 15 classes

**Sample Layout Classes:**
```
flex, grid, block, items-center, justify-center, justify-between, gap-6, space-y-2, space-y-1, gap-1, space-y-6, gap-4, gap-2, gap-3, px-8, py-6, px-4, py-2, p-8, p-4, p-6, p-1, p-0, py-3, p-2
```

### 5️⃣ Missing Items

- ❌ Component structure

### 6️⃣ Violations (12)

**Non-Standard Spacing (12):**
- ⚠️ `gap-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ✅ Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**API Endpoints Used (1):**
- ✅ `post /admin/tiers`

**API Contract Issues:**
- ⚠️ Invalid HTTP method: post

---

#### 15. page

**File Path:** `apps/admin-web/app/governance/page.tsx`

### 1️⃣ Matching Percentage: **74%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -26%

### 2️⃣ Components Used (2)

```
GovernanceStatus, StatusIndicator
```

### 3️⃣ Colors & Styles (33 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (54)

**Layout Type:**
- Flex: 1 classes
- Grid: 1 classes
- Spacing: 21 classes
- Sizing: 14 classes

**Sample Layout Classes:**
```
flex, grid, block, hidden, items-center, justify-center, justify-between, gap-2, gap-3, gap-6, gap-8, gap-4, space-y-4, p-2, px-8, py-6, p-3, px-4, py-2, p-8, p-4, p-6, py-3, px-3, py-1
```

### 5️⃣ Missing Items

✅ No missing items detected

### 6️⃣ Violations (13)

**Non-Standard Spacing (13):**
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ✅ Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**API Endpoints Used (2):**
- ✅ `post /admin/governance/invalidate-cache`
- ✅ `post /admin/governance/propagate`

**API Contract Issues:**
- ⚠️ Invalid HTTP method: post
- ⚠️ Invalid HTTP method: post

---

#### 16. AdminVendors

**File Path:** `apps/admin-web/components/admin/AdminVendorsPage.tsx`

### 1️⃣ Matching Percentage: **74%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -16%
- Missing API Integration: -10%

### 2️⃣ Components Used (1)

```
VendorDetailModal
```

### 3️⃣ Colors & Styles (27 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (43)

**Layout Type:**
- Flex: 1 classes
- Grid: 1 classes
- Spacing: 11 classes
- Sizing: 14 classes

**Sample Layout Classes:**
```
flex, grid, hidden, block, items-center, justify-between, justify-center, gap-3, gap-4, space-y-4, p-6, p-3, px-4, py-2, p-4, px-2, py-1, px-3, p-2, pt-4, mb-6, mb-4, mb-3, mb-1, mt-6
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (8)

**Non-Standard Spacing (8):**
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 17. page

**File Path:** `apps/admin-web/app/catalog/page.tsx`

### 1️⃣ Matching Percentage: **72%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -28%

### 2️⃣ Components Used (1)

```
ServiceCatalogItem
```

### 3️⃣ Colors & Styles (33 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (55)

**Layout Type:**
- Flex: 3 classes
- Grid: 1 classes
- Spacing: 22 classes
- Sizing: 14 classes

**Sample Layout Classes:**
```
flex, grid, hidden, block, flex-wrap, flex-col, items-center, justify-center, justify-between, gap-2, gap-6, gap-4, gap-1, space-y-6, gap-3, px-8, py-6, px-4, py-2, p-2, p-8, p-4, p-6, px-6, py-4
```

### 5️⃣ Missing Items

✅ No missing items detected

### 6️⃣ Violations (14)

**Non-Standard Spacing (14):**
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ✅ Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**API Endpoints Used (1):**
- ✅ `post /admin/service-catalog`

**API Contract Issues:**
- ⚠️ Invalid HTTP method: post

---

#### 18. AdminRefunds

**File Path:** `apps/admin-web/components/admin/AdminRefundsPage.tsx`

### 1️⃣ Matching Percentage: **72%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -18%
- Missing API Integration: -10%

### 2️⃣ Components Used (3)

```
RefundStats, RefundRequest, RefundDetailModal
```

### 3️⃣ Colors & Styles (33 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (47)

**Layout Type:**
- Flex: 1 classes
- Grid: 1 classes
- Spacing: 13 classes
- Sizing: 13 classes

**Sample Layout Classes:**
```
flex, grid, hidden, block, items-center, justify-between, justify-center, gap-4, gap-3, space-y-4, p-6, px-4, py-2, p-4, p-1, px-2, py-1, px-3, py-12, p-2, p-3, pt-4, mb-6, mt-4, mb-4
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (9)

**Non-Standard Spacing (9):**
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 19. page

**File Path:** `apps/admin-web/app/analytics/page.tsx`

### 1️⃣ Matching Percentage: **68%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -22%
- Missing API Integration: -10%

### 2️⃣ Components Used (1)

```
ChartData
```

### 3️⃣ Colors & Styles (22 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (48)

**Layout Type:**
- Flex: 2 classes
- Grid: 1 classes
- Spacing: 18 classes
- Sizing: 11 classes

**Sample Layout Classes:**
```
flex, grid, flex-col, items-end, items-center, justify-between, justify-center, gap-1, gap-3, gap-4, gap-6, gap-2, space-y-4, p-1, px-8, py-6, p-3, px-4, py-2, p-8, p-4, p-6, px-2, py-0, p-2
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (11)

**Non-Standard Spacing (11):**
- ⚠️ `gap-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 20. page

**File Path:** `apps/admin-web/app/integrations/page.tsx`

### 1️⃣ Matching Percentage: **68%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -22%
- Missing API Integration: -10%

### 2️⃣ Components Used (6)

```
AWSConfig, RazorpayConfig, GoogleMapsConfig, ShiprocketConfig, SMSConfig, StatusBadge
```

### 3️⃣ Colors & Styles (27 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (47)

**Layout Type:**
- Flex: 2 classes
- Grid: 1 classes
- Spacing: 16 classes
- Sizing: 12 classes

**Sample Layout Classes:**
```
flex, hidden, grid, block, flex-wrap, items-center, justify-center, justify-between, space-y-4, gap-4, gap-2, gap-6, gap-3, px-2, py-1, px-8, py-6, px-4, py-2, p-8, p-4, p-6, px-3, p-2, p-3
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (11)

**Non-Standard Spacing (11):**
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

### CUSTOMER-WEB (32 screens)

#### 1. page

**File Path:** `apps/customer-web/app/pets/page.tsx`

### 1️⃣ Matching Percentage: **92%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -8%

### 2️⃣ Components Used (0)

*No components detected in code*

### 3️⃣ Colors & Styles (10 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (34)

**Layout Type:**
- Flex: 1 classes
- Grid: 1 classes
- Spacing: 8 classes
- Sizing: 12 classes

**Sample Layout Classes:**
```
flex, grid, items-center, justify-center, justify-between, items-start, gap-4, space-y-4, gap-3, p-6, px-4, py-2, py-12, p-4, p-3, mb-6, mb-4, mt-2, mt-6, min-h-screen, h-12, w-12, max-w-4xl, w-sm, w-md
```

### 5️⃣ Missing Items

- ❌ Component structure

### 6️⃣ Violations (4)

**Non-Standard Spacing (4):**
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ✅ Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**API Endpoints Used (1):**
- ✅ `post /pets/create`

**API Contract Issues:**
- ⚠️ Invalid HTTP method: post

---

#### 2. page

**File Path:** `apps/customer-web/app/booking/[serviceId]/page.tsx`

### 1️⃣ Matching Percentage: **90%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -0%
- Missing API Integration: -10%

### 2️⃣ Components Used (1)

```
BookingPageClient
```

### 3️⃣ Colors & Styles (0 unique)

*No color classes detected*

### 4️⃣ Layout Classes & Component Placement (0)

*No layout classes detected*

### 5️⃣ Missing Items

- ❌ API Integration
- ❌ Color styling
- ❌ Layout classes

### 6️⃣ Violations (0)

✅ No violations detected

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 3. page

**File Path:** `apps/customer-web/app/bookings/page.tsx`

### 1️⃣ Matching Percentage: **90%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -0%
- Missing API Integration: -10%

### 2️⃣ Components Used (1)

```
MyBookings
```

### 3️⃣ Colors & Styles (0 unique)

*No color classes detected*

### 4️⃣ Layout Classes & Component Placement (0)

*No layout classes detected*

### 5️⃣ Missing Items

- ❌ API Integration
- ❌ Color styling
- ❌ Layout classes

### 6️⃣ Violations (0)

✅ No violations detected

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 4. page

**File Path:** `apps/customer-web/app/page.tsx`

### 1️⃣ Matching Percentage: **90%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -0%
- Missing API Integration: -10%

### 2️⃣ Components Used (2)

```
CustomerSession, CustomerApp
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (8)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 3 classes

**Sample Layout Classes:**
```
flex, items-center, justify-center, mb-4, min-h-screen, h-12, w-12, rounded-full
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (0)

✅ No violations detected

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 5. page

**File Path:** `apps/customer-web/app/tracking/[bookingId]/page.tsx`

### 1️⃣ Matching Percentage: **90%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -0%
- Missing API Integration: -10%

### 2️⃣ Components Used (1)

```
TrackingPageClient
```

### 3️⃣ Colors & Styles (0 unique)

*No color classes detected*

### 4️⃣ Layout Classes & Component Placement (0)

*No layout classes detected*

### 5️⃣ Missing Items

- ❌ API Integration
- ❌ Color styling
- ❌ Layout classes

### 6️⃣ Violations (0)

✅ No violations detected

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 6. page

**File Path:** `apps/customer-web/app/video/[bookingId]/page.tsx`

### 1️⃣ Matching Percentage: **90%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -0%
- Missing API Integration: -10%

### 2️⃣ Components Used (1)

```
VideoPageClient
```

### 3️⃣ Colors & Styles (0 unique)

*No color classes detected*

### 4️⃣ Layout Classes & Component Placement (0)

*No layout classes detected*

### 5️⃣ Missing Items

- ❌ API Integration
- ❌ Color styling
- ❌ Layout classes

### 6️⃣ Violations (0)

✅ No violations detected

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 7. page

**File Path:** `apps/customer-web/app/auth/page.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -14%

### 2️⃣ Components Used (0)

*No components detected in code*

### 3️⃣ Colors & Styles (12 unique)

**Approved Design Tokens:** 1
```
#FF8C42
```

**⚠️ Hardcoded Colors:** 1
```
#1a1a1a
```

### 4️⃣ Layout Classes & Component Placement (56)

**Layout Type:**
- Flex: 2 classes
- Grid: 0 classes
- Spacing: 10 classes
- Sizing: 20 classes

**Sample Layout Classes:**
```
flex, block, hidden, inline, flex-col, items-center, justify-center, items-start, gap-3, space-y-4, gap-2, space-y-1, px-6, pt-8, pb-6, p-4, p-3, pl-4, pr-2, py-4, pr-4, p-2, py-2, px-4, mb-6
```

### 5️⃣ Missing Items

- ❌ Component structure

### 6️⃣ Violations (7)

**Hardcoded Colors (1):**
- ❌ `#1a1a1a` - Use design token instead

**Non-Standard Spacing (6):**
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ✅ Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**API Endpoints Used (2):**
- ✅ `post /auth/otp/send`
- ✅ `post /customer/profile`

**API Contract Issues:**
- ⚠️ Invalid HTTP method: post
- ⚠️ Invalid HTTP method: post

---

#### 8. Booking

**File Path:** `apps/customer-web/app/booking/[serviceId]/BookingPageClient.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -4%
- Missing API Integration: -10%

### 2️⃣ Components Used (1)

```
BookingFlow
```

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (10)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 2 classes
- Sizing: 1 classes

**Sample Layout Classes:**
```
flex, inline, block, items-center, justify-center, px-6, py-2, mt-4, min-h-screen, rounded-full
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (2)

**Non-Standard Spacing (2):**
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 9. page

**File Path:** `apps/customer-web/app/orders/page.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -4%
- Missing API Integration: -10%

### 2️⃣ Components Used (1)

```
MyOrders
```

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (10)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 2 classes
- Sizing: 1 classes

**Sample Layout Classes:**
```
flex, inline, block, items-center, justify-center, px-6, py-2, mt-4, min-h-screen, rounded-full
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (2)

**Non-Standard Spacing (2):**
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 10. page

**File Path:** `apps/customer-web/app/settings/page.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -4%
- Missing API Integration: -10%

### 2️⃣ Components Used (1)

```
CustomerSettings
```

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (10)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 2 classes
- Sizing: 1 classes

**Sample Layout Classes:**
```
flex, inline, block, items-center, justify-center, px-6, py-2, mt-4, min-h-screen, rounded-full
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (2)

**Non-Standard Spacing (2):**
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 11. page

**File Path:** `apps/customer-web/app/wallet/page.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -4%
- Missing API Integration: -10%

### 2️⃣ Components Used (1)

```
CustomerWallet
```

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (10)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 2 classes
- Sizing: 1 classes

**Sample Layout Classes:**
```
flex, inline, block, items-center, justify-center, px-6, py-2, mt-4, min-h-screen, rounded-full
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (2)

**Non-Standard Spacing (2):**
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 12. page

**File Path:** `apps/customer-web/app/chat/page.tsx`

### 1️⃣ Matching Percentage: **80%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -10%
- Missing API Integration: -10%

### 2️⃣ Components Used (0)

*No components detected in code*

### 3️⃣ Colors & Styles (14 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (45)

**Layout Type:**
- Flex: 2 classes
- Grid: 0 classes
- Spacing: 10 classes
- Sizing: 18 classes

**Sample Layout Classes:**
```
flex, hidden, block, flex-col, items-center, justify-center, items-start, justify-between, gap-3, gap-4, space-y-4, p-4, p-8, p-3, py-2, px-4, py-3, p-2, mt-4, mb-4, mt-2, m-0, mt-1, min-h-screen, h-12
```

### 5️⃣ Missing Items

- ❌ API Integration
- ❌ Component structure

### 6️⃣ Violations (5)

**Non-Standard Spacing (5):**
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 13. page

**File Path:** `apps/customer-web/app/notifications/page.tsx`

### 1️⃣ Matching Percentage: **80%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -10%
- Missing API Integration: -10%

### 2️⃣ Components Used (0)

*No components detected in code*

### 3️⃣ Colors & Styles (6 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (28)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 7 classes
- Sizing: 10 classes

**Sample Layout Classes:**
```
flex, items-center, justify-center, justify-between, items-start, space-y-3, gap-3, p-6, px-3, py-1, py-12, p-4, p-3, mb-6, mb-4, mt-1, min-h-screen, h-12, w-12, max-w-2xl, w-sm, w-md, w-2, h-2, rounded-full
```

### 5️⃣ Missing Items

- ❌ API Integration
- ❌ Component structure

### 6️⃣ Violations (5)

**Non-Standard Spacing (5):**
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 14. CenterBooking

**File Path:** `apps/customer-web/components/customer/booking/CenterBookingPage.tsx`

### 1️⃣ Matching Percentage: **80%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -10%
- Missing API Integration: -10%

### 2️⃣ Components Used (2)

```
ArrowLeft, CalendarSlotPicker
```

### 3️⃣ Colors & Styles (7 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (34)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 10 classes
- Sizing: 15 classes

**Sample Layout Classes:**
```
flex, items-center, justify-center, gap-3, space-y-6, space-y-3, gap-4, p-0, px-4, py-4, p-3, px-6, py-6, p-5, p-4, mb-4, min-h-screen, w-full, w-10, h-10, w-5, h-5, w-sm, h-16, w-12
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (5)

**Non-Standard Spacing (5):**
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-5` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 15. page

**File Path:** `apps/customer-web/app/profile/page.tsx`

### 1️⃣ Matching Percentage: **78%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -12%
- Missing API Integration: -10%

### 2️⃣ Components Used (1)

```
CustomerProfile
```

### 3️⃣ Colors & Styles (11 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (35)

**Layout Type:**
- Flex: 1 classes
- Grid: 1 classes
- Spacing: 8 classes
- Sizing: 11 classes

**Sample Layout Classes:**
```
flex, block, grid, items-center, justify-center, justify-between, gap-4, space-y-4, gap-3, space-y-3, gap-2, p-6, p-4, pb-6, p-3, py-3, p-2, mb-6, mb-1, mt-6, mt-4, min-h-screen, h-12, w-12, max-w-2xl
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (6)

**Non-Standard Spacing (6):**
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 16. page

**File Path:** `apps/customer-web/app/rewards/page.tsx`

### 1️⃣ Matching Percentage: **78%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -22%

### 2️⃣ Components Used (1)

```
RewardsBalance
```

### 3️⃣ Colors & Styles (36 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (58)

**Layout Type:**
- Flex: 1 classes
- Grid: 1 classes
- Spacing: 16 classes
- Sizing: 15 classes

**Sample Layout Classes:**
```
flex, inline, hidden, grid, items-center, justify-center, justify-between, items-start, gap-2, gap-4, space-y-4, pb-8, px-4, py-8, p-2, py-2, p-4, pt-4, p-1, py-3, py-6, pb-2, p-5, px-6, p-12
```

### 5️⃣ Missing Items

✅ No missing items detected

### 6️⃣ Violations (11)

**Non-Standard Spacing (11):**
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-5` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ✅ Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**API Endpoints Used (1):**
- ✅ `post /rewards/redeem`

**API Contract Issues:**
- ⚠️ Invalid HTTP method: post

---

#### 17. page

**File Path:** `apps/customer-web/app/shop/page.tsx`

### 1️⃣ Matching Percentage: **78%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -22%

### 2️⃣ Components Used (0)

*No components detected in code*

### 3️⃣ Colors & Styles (19 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (67)

**Layout Type:**
- Flex: 2 classes
- Grid: 1 classes
- Spacing: 18 classes
- Sizing: 24 classes

**Sample Layout Classes:**
```
flex, grid, hidden, flex-col, items-center, justify-center, justify-between, gap-3, gap-4, gap-1, space-y-4, space-y-2, p-0, px-4, py-4, py-2, p-2, py-3, p-3, pb-2, px-3, pb-8, p-4, py-16, px-2
```

### 5️⃣ Missing Items

- ❌ Component structure

### 6️⃣ Violations (11)

**Non-Standard Spacing (11):**
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ✅ Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**API Endpoints Used (1):**
- ✅ `post /ecommerce/orders`

**API Contract Issues:**
- ⚠️ Invalid HTTP method: post

---

#### 18. page

**File Path:** `apps/customer-web/app/referrals/page.tsx`

### 1️⃣ Matching Percentage: **76%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -14%
- Missing API Integration: -10%

### 2️⃣ Components Used (1)

```
ReferralStats
```

### 3️⃣ Colors & Styles (35 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (42)

**Layout Type:**
- Flex: 1 classes
- Grid: 1 classes
- Spacing: 13 classes
- Sizing: 10 classes

**Sample Layout Classes:**
```
flex, grid, items-center, justify-center, justify-between, items-start, gap-4, space-y-1, space-y-4, space-y-3, pb-8, px-4, py-8, p-4, py-6, p-6, py-3, px-6, py-12, px-3, py-1, px-2, py-0, mt-4, mb-2
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (7)

**Non-Standard Spacing (7):**
- ⚠️ `py-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 19. Tracking

**File Path:** `apps/customer-web/app/tracking/[bookingId]/TrackingPageClient.tsx`

### 1️⃣ Matching Percentage: **76%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -14%
- Missing API Integration: -10%

### 2️⃣ Components Used (1)

```
TrackingData
```

### 3️⃣ Colors & Styles (25 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (52)

**Layout Type:**
- Flex: 2 classes
- Grid: 0 classes
- Spacing: 12 classes
- Sizing: 22 classes

**Sample Layout Classes:**
```
flex, hidden, flex-col, items-center, justify-center, justify-between, gap-4, gap-2, space-y-3, p-4, p-6, px-6, py-2, p-0, px-4, py-4, p-2, pt-0, py-3, mt-4, mb-4, mb-2, mt-6, m-1, mt-2
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (7)

**Non-Standard Spacing (7):**
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `m-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 20. page

**File Path:** `apps/customer-web/app/subscriptions/page.tsx`

### 1️⃣ Matching Percentage: **74%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -16%
- Missing API Integration: -10%

### 2️⃣ Components Used (0)

*No components detected in code*

### 3️⃣ Colors & Styles (15 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (34)

**Layout Type:**
- Flex: 1 classes
- Grid: 1 classes
- Spacing: 12 classes
- Sizing: 8 classes

**Sample Layout Classes:**
```
flex, grid, items-center, justify-center, justify-between, items-start, gap-2, space-y-4, gap-4, p-6, p-2, px-4, py-2, py-12, px-6, px-3, py-1, p-4, p-3, mb-6, mb-4, mt-4, mb-1, min-h-screen, h-12
```

### 5️⃣ Missing Items

- ❌ API Integration
- ❌ Component structure

### 6️⃣ Violations (8)

**Non-Standard Spacing (8):**
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 21. CreateBooking

**File Path:** `apps/customer-web/components/customer/CreateBookingPage.tsx`

### 1️⃣ Matching Percentage: **74%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -16%
- Missing API Integration: -10%

### 2️⃣ Components Used (2)

```
ArrowLeft, MapPin
```

### 3️⃣ Colors & Styles (10 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (37)

**Layout Type:**
- Flex: 1 classes
- Grid: 1 classes
- Spacing: 13 classes
- Sizing: 11 classes

**Sample Layout Classes:**
```
flex, block, grid, items-center, justify-center, gap-3, space-y-6, space-y-2, gap-4, space-y-4, gap-2, p-0, px-4, py-4, p-3, py-6, p-6, py-3, p-4, p-1, pl-10, pr-4, pt-4, p-2, min-h-screen
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (8)

**Non-Standard Spacing (8):**
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 22. page

**File Path:** `apps/customer-web/app/insurance/page.tsx`

### 1️⃣ Matching Percentage: **72%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -28%

### 2️⃣ Components Used (1)

```
InsurancePlan
```

### 3️⃣ Colors & Styles (37 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (55)

**Layout Type:**
- Flex: 1 classes
- Grid: 1 classes
- Spacing: 20 classes
- Sizing: 14 classes

**Sample Layout Classes:**
```
flex, grid, block, items-center, justify-center, justify-between, items-start, space-y-6, gap-6, space-y-2, space-y-1, gap-1, space-y-4, gap-4, gap-2, gap-3, pb-8, p-0, px-4, py-4, p-1, py-3, p-4, py-6, p-6
```

### 5️⃣ Missing Items

✅ No missing items detected

### 6️⃣ Violations (14)

**Non-Standard Spacing (14):**
- ⚠️ `gap-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ✅ Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**API Endpoints Used (2):**
- ✅ `post /insurance/policies`
- ✅ `post /insurance/claims`

**API Contract Issues:**
- ⚠️ Invalid HTTP method: post
- ⚠️ Invalid HTTP method: post

---

#### 23. Video

**File Path:** `apps/customer-web/app/video/[bookingId]/VideoPageClient.tsx`

### 1️⃣ Matching Percentage: **72%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -18%
- Missing API Integration: -10%

### 2️⃣ Components Used (1)

```
VideoCallData
```

### 3️⃣ Colors & Styles (11 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (49)

**Layout Type:**
- Flex: 2 classes
- Grid: 0 classes
- Spacing: 13 classes
- Sizing: 18 classes

**Sample Layout Classes:**
```
flex, hidden, flex-col, items-center, justify-center, justify-between, gap-3, space-y-2, gap-2, gap-6, space-y-4, p-4, p-6, px-6, py-2, px-8, py-4, p-3, p-2, px-4, py-3, mt-4, mb-4, mb-2, mb-6
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (9)

**Non-Standard Spacing (9):**
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 24. CustomerBookings

**File Path:** `apps/customer-web/components/customer/CustomerBookingsPage.tsx`

### 1️⃣ Matching Percentage: **70%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -20%
- Missing API Integration: -10%

### 2️⃣ Components Used (1)

```
ArrowLeft
```

### 3️⃣ Colors & Styles (25 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (50)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 16 classes
- Sizing: 18 classes

**Sample Layout Classes:**
```
flex, items-center, justify-between, justify-center, items-start, gap-3, gap-2, space-x-6, space-y-4, space-y-2, p-0, px-4, py-4, p-3, py-2, p-2, py-3, py-6, py-12, p-4, p-12, px-6, px-2, py-1, mb-2
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (10)

**Non-Standard Spacing (10):**
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 25. CustomerServices

**File Path:** `apps/customer-web/components/customer/CustomerServicesPage.tsx`

### 1️⃣ Matching Percentage: **70%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -20%
- Missing API Integration: -10%

### 2️⃣ Components Used (2)

```
ArrowLeft, MapPin
```

### 3️⃣ Colors & Styles (12 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (44)

**Layout Type:**
- Flex: 2 classes
- Grid: 0 classes
- Spacing: 17 classes
- Sizing: 13 classes

**Sample Layout Classes:**
```
flex, flex-wrap, items-center, justify-center, justify-between, gap-3, space-y-4, gap-4, gap-1, p-0, px-4, py-4, p-3, py-6, py-2, pl-10, pr-4, py-3, p-1, py-12, p-4, p-12, p-2, px-2, py-1
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (10)

**Non-Standard Spacing (10):**
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 26. MultiPetBooking

**File Path:** `apps/customer-web/components/customer/MultiPetBookingPage.tsx`

### 1️⃣ Matching Percentage: **70%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -20%
- Missing API Integration: -10%

### 2️⃣ Components Used (2)

```
DollarSign, ChevronRight
```

### 3️⃣ Colors & Styles (14 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (52)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 15 classes
- Sizing: 17 classes

**Sample Layout Classes:**
```
flex, items-center, justify-center, justify-between, items-start, gap-4, space-y-6, space-y-2, gap-2, space-y-3, gap-1, gap-3, px-6, pt-12, pb-6, p-0, p-4, py-6, p-5, p-2, py-8, py-2, p-1, pt-3, pt-2
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (10)

**Non-Standard Spacing (10):**
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-5` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 27. SearchResults

**File Path:** `apps/customer-web/components/customer/SearchResultsPage.tsx`

### 1️⃣ Matching Percentage: **70%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -20%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
MapPin, DollarSign, SearchAutocomplete, SearchFilters
```

### 3️⃣ Colors & Styles (16 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (45)

**Layout Type:**
- Flex: 2 classes
- Grid: 0 classes
- Spacing: 17 classes
- Sizing: 13 classes

**Sample Layout Classes:**
```
flex, flex-wrap, items-start, items-center, justify-center, gap-4, gap-2, gap-1, space-y-2, space-y-4, p-6, p-4, px-3, py-1, p-2, p-1, px-2, px-4, py-2, p-0, py-4, py-6, py-12, p-12, mb-2
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (10)

**Non-Standard Spacing (10):**
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 28. PackageBooking

**File Path:** `apps/customer-web/components/customer/PackageBookingPage.tsx`

### 1️⃣ Matching Percentage: **68%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -22%
- Missing API Integration: -10%

### 2️⃣ Components Used (2)

```
PackageItem, ChevronRight
```

### 3️⃣ Colors & Styles (15 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (58)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 19 classes
- Sizing: 19 classes

**Sample Layout Classes:**
```
flex, block, hidden, items-center, justify-center, items-start, justify-between, gap-4, gap-2, space-y-4, gap-1, space-y-6, space-y-3, px-6, pt-12, pb-6, p-0, p-4, p-2, p-1, px-4, py-2, py-6, py-12, p-12
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (11)

**Non-Standard Spacing (11):**
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-5` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 29. page

**File Path:** `apps/customer-web/app/medical-records/page.tsx`

### 1️⃣ Matching Percentage: **66%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -24%
- Missing API Integration: -10%

### 2️⃣ Components Used (1)

```
MedicalRecord
```

### 3️⃣ Colors & Styles (34 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (64)

**Layout Type:**
- Flex: 2 classes
- Grid: 0 classes
- Spacing: 18 classes
- Sizing: 18 classes

**Sample Layout Classes:**
```
flex, hidden, flex-wrap, items-center, justify-center, justify-between, items-start, gap-3, gap-2, space-y-6, space-y-4, space-y-3, space-y-2, pb-8, p-0, px-4, py-4, py-2, p-3, pb-2, p-2, p-1, py-3, p-4, py-6
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (12)

**Non-Standard Spacing (12):**
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-5` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 30. page

**File Path:** `apps/customer-web/app/donations/page.tsx`

### 1️⃣ Matching Percentage: **62%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -28%
- Missing API Integration: -10%

### 2️⃣ Components Used (1)

```
DonationCampaign
```

### 3️⃣ Colors & Styles (31 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (57)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 19 classes
- Sizing: 15 classes

**Sample Layout Classes:**
```
flex, hidden, block, items-center, justify-center, justify-between, items-start, space-y-6, gap-6, gap-2, space-y-4, space-y-2, gap-3, pb-8, px-4, py-8, p-1, py-3, p-4, py-6, p-12, p-6, p-2, px-2, py-0
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (14)

**Non-Standard Spacing (14):**
- ⚠️ `gap-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 31. page

**File Path:** `apps/customer-web/app/events/page.tsx`

### 1️⃣ Matching Percentage: **62%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -28%
- Missing API Integration: -10%

### 2️⃣ Components Used (0)

*No components detected in code*

### 3️⃣ Colors & Styles (32 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (55)

**Layout Type:**
- Flex: 2 classes
- Grid: 1 classes
- Spacing: 20 classes
- Sizing: 13 classes

**Sample Layout Classes:**
```
flex, grid, flex-wrap, items-center, justify-center, justify-between, items-start, gap-3, gap-4, space-y-1, space-y-4, gap-2, pb-8, p-0, px-4, py-4, p-1, py-3, p-4, py-6, p-3, py-2, p-6, px-2, py-1
```

### 5️⃣ Missing Items

- ❌ API Integration
- ❌ Component structure

### 6️⃣ Violations (14)

**Non-Standard Spacing (14):**
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-5` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 32. page

**File Path:** `apps/customer-web/app/search/page.tsx`

### 1️⃣ Matching Percentage: **62%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -28%
- Missing API Integration: -10%

### 2️⃣ Components Used (1)

```
SearchContent
```

### 3️⃣ Colors & Styles (16 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (51)

**Layout Type:**
- Flex: 2 classes
- Grid: 1 classes
- Spacing: 20 classes
- Sizing: 15 classes

**Sample Layout Classes:**
```
flex, grid, hidden, flex-col, items-center, justify-center, items-start, justify-between, justify-around, gap-3, gap-2, gap-6, gap-1, p-0, px-4, py-4, p-3, p-2, py-3, pl-12, p-1, px-6, py-2, py-6, py-12
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (14)

**Non-Standard Spacing (14):**
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

### VENDOR-WEB (20 screens)

#### 1. page

**File Path:** `apps/vendor-web/app/auth/page.tsx`

### 1️⃣ Matching Percentage: **90%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -0%
- Missing API Integration: -10%

### 2️⃣ Components Used (0)

*No components detected in code*

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (8)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 3 classes

**Sample Layout Classes:**
```
flex, items-center, justify-center, mt-4, min-h-screen, h-12, w-12, rounded-full
```

### 5️⃣ Missing Items

- ❌ API Integration
- ❌ Component structure

### 6️⃣ Violations (0)

✅ No violations detected

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 2. page

**File Path:** `apps/vendor-web/app/onboarding/page.tsx`

### 1️⃣ Matching Percentage: **90%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -0%
- Missing API Integration: -10%

### 2️⃣ Components Used (1)

```
VendorOnboardingFlow
```

### 3️⃣ Colors & Styles (0 unique)

*No color classes detected*

### 4️⃣ Layout Classes & Component Placement (0)

*No layout classes detected*

### 5️⃣ Missing Items

- ❌ API Integration
- ❌ Color styling
- ❌ Layout classes

### 6️⃣ Violations (0)

✅ No violations detected

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 3. page

**File Path:** `apps/vendor-web/app/page.tsx`

### 1️⃣ Matching Percentage: **90%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -0%
- Missing API Integration: -10%

### 2️⃣ Components Used (2)

```
VendorSession, VendorApp
```

### 3️⃣ Colors & Styles (1 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (8)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 0 classes
- Sizing: 3 classes

**Sample Layout Classes:**
```
flex, items-center, justify-center, mt-4, min-h-screen, h-12, w-12, rounded-full
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (0)

✅ No violations detected

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 4. VendorLanding

**File Path:** `apps/vendor-web/components/vendor/VendorLandingPage.tsx`

### 1️⃣ Matching Percentage: **90%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -0%
- Missing API Integration: -10%

### 2️⃣ Components Used (9)

```
EnhancedVendorOnboarding, VendorApplicationSubmitted, VendorApplicationUnderReview, VendorClarificationRequested, VendorApplicationRejected, VendorServiceSelection, VendorAvailabilitySetup, VendorSetupCompleted, VendorDashboard
```

### 3️⃣ Colors & Styles (3 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (8)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 1 classes
- Sizing: 4 classes

**Sample Layout Classes:**
```
flex, items-center, justify-center, p-4, min-h-screen, w-full, w-12, h-12
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (0)

✅ No violations detected

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 5. page

**File Path:** `apps/vendor-web/app/settings/page.tsx`

### 1️⃣ Matching Percentage: **86%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -4%
- Missing API Integration: -10%

### 2️⃣ Components Used (1)

```
VendorSettingsPage
```

### 3️⃣ Colors & Styles (2 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (10)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 2 classes
- Sizing: 1 classes

**Sample Layout Classes:**
```
flex, inline, block, items-center, justify-center, px-6, py-2, mt-4, min-h-screen, rounded-full
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (2)

**Non-Standard Spacing (2):**
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 6. page

**File Path:** `apps/vendor-web/app/earnings/page.tsx`

### 1️⃣ Matching Percentage: **82%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -8%
- Missing API Integration: -10%

### 2️⃣ Components Used (1)

```
EarningsSummary
```

### 3️⃣ Colors & Styles (13 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (29)

**Layout Type:**
- Flex: 1 classes
- Grid: 1 classes
- Spacing: 8 classes
- Sizing: 7 classes

**Sample Layout Classes:**
```
flex, grid, items-center, justify-center, justify-between, gap-3, gap-4, space-y-3, p-6, p-3, px-4, py-2, p-4, py-8, mb-6, mt-1, mb-8, mt-2, mb-4, min-h-screen, h-12, w-12, max-w-6xl, w-sm, w-600
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (4)

**Non-Standard Spacing (4):**
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 7. page

**File Path:** `apps/vendor-web/app/services/page.tsx`

### 1️⃣ Matching Percentage: **80%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -20%

### 2️⃣ Components Used (0)

*No components detected in code*

### 3️⃣ Colors & Styles (18 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (47)

**Layout Type:**
- Flex: 2 classes
- Grid: 1 classes
- Spacing: 15 classes
- Sizing: 13 classes

**Sample Layout Classes:**
```
flex, grid, flex-col, items-center, justify-center, justify-between, items-start, items-end, gap-3, gap-4, gap-2, gap-1, space-y-4, p-6, p-3, px-4, py-2, py-12, px-6, p-4, p-2, p-1, px-2, py-0, pt-4
```

### 5️⃣ Missing Items

- ❌ Component structure

### 6️⃣ Violations (10)

**Non-Standard Spacing (10):**
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ✅ Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**API Endpoints Used (1):**
- ✅ `post /vendor-services/create`

**API Contract Issues:**
- ⚠️ Invalid HTTP method: post

---

#### 8. page

**File Path:** `apps/vendor-web/app/bank-details/page.tsx`

### 1️⃣ Matching Percentage: **78%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -22%

### 2️⃣ Components Used (1)

```
BankAccount
```

### 3️⃣ Colors & Styles (35 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (48)

**Layout Type:**
- Flex: 1 classes
- Grid: 1 classes
- Spacing: 17 classes
- Sizing: 11 classes

**Sample Layout Classes:**
```
flex, block, grid, items-center, justify-center, justify-between, items-start, space-y-4, gap-4, gap-2, gap-3, py-8, px-4, p-4, p-6, py-2, py-12, p-2, px-2, py-0, px-3, py-1, p-3, py-3, px-6
```

### 5️⃣ Missing Items

✅ No missing items detected

### 6️⃣ Violations (11)

**Non-Standard Spacing (11):**
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ✅ Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**API Endpoints Used (2):**
- ✅ `post /vendor/bank-accounts`
- ✅ `post /vendor/upi-accounts`

**API Contract Issues:**
- ⚠️ Invalid HTTP method: post
- ⚠️ Invalid HTTP method: post

---

#### 9. page

**File Path:** `apps/vendor-web/app/schedule/page.tsx`

### 1️⃣ Matching Percentage: **78%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -12%
- Missing API Integration: -10%

### 2️⃣ Components Used (1)

```
ScheduleConfig
```

### 3️⃣ Colors & Styles (15 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (42)

**Layout Type:**
- Flex: 1 classes
- Grid: 1 classes
- Spacing: 9 classes
- Sizing: 17 classes

**Sample Layout Classes:**
```
flex, grid, block, items-center, justify-center, justify-between, space-y-2, gap-3, gap-4, space-y-3, gap-2, p-6, px-4, py-2, p-3, p-4, p-2, mb-6, mt-1, mb-4, mt-4, mb-1, min-h-screen, h-12, w-12
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (6)

**Non-Standard Spacing (6):**
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 10. page

**File Path:** `apps/vendor-web/app/staff/page.tsx`

### 1️⃣ Matching Percentage: **78%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -22%

### 2️⃣ Components Used (0)

*No components detected in code*

### 3️⃣ Colors & Styles (16 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (44)

**Layout Type:**
- Flex: 2 classes
- Grid: 1 classes
- Spacing: 16 classes
- Sizing: 10 classes

**Sample Layout Classes:**
```
flex, grid, flex-wrap, items-center, justify-center, justify-between, items-start, gap-3, gap-4, space-y-2, gap-1, gap-2, space-y-4, p-6, p-3, px-4, py-2, py-12, px-6, p-4, px-2, py-1, p-1, py-0, p-2
```

### 5️⃣ Missing Items

- ❌ Component structure

### 6️⃣ Violations (11)

**Non-Standard Spacing (11):**
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ✅ Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**API Endpoints Used (1):**
- ✅ `post /staff/create`

**API Contract Issues:**
- ⚠️ Invalid HTTP method: post

---

#### 11. page

**File Path:** `apps/vendor-web/app/packages/page.tsx`

### 1️⃣ Matching Percentage: **76%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -24%

### 2️⃣ Components Used (0)

*No components detected in code*

### 3️⃣ Colors & Styles (33 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (56)

**Layout Type:**
- Flex: 1 classes
- Grid: 1 classes
- Spacing: 19 classes
- Sizing: 13 classes

**Sample Layout Classes:**
```
flex, grid, block, items-center, justify-center, justify-between, items-start, gap-6, space-y-2, gap-2, space-y-6, gap-3, gap-4, space-y-4, py-8, px-4, py-2, p-4, p-12, px-6, py-3, p-6, px-2, py-1, pt-4
```

### 5️⃣ Missing Items

- ❌ Component structure

### 6️⃣ Violations (12)

**Non-Standard Spacing (12):**
- ⚠️ `gap-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ✅ Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**API Endpoints Used (1):**
- ✅ `post /vendor/packages`

**API Contract Issues:**
- ⚠️ Invalid HTTP method: post

---

#### 12. page

**File Path:** `apps/vendor-web/app/subscriptions/page.tsx`

### 1️⃣ Matching Percentage: **76%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -24%

### 2️⃣ Components Used (1)

```
SubscriptionPlan
```

### 3️⃣ Colors & Styles (33 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (57)

**Layout Type:**
- Flex: 1 classes
- Grid: 1 classes
- Spacing: 19 classes
- Sizing: 14 classes

**Sample Layout Classes:**
```
flex, grid, block, items-center, justify-center, justify-between, items-start, gap-6, space-y-2, gap-2, space-y-6, gap-4, gap-3, space-y-4, py-8, px-4, py-2, p-4, p-12, px-6, py-3, p-6, px-2, py-1, pt-4
```

### 5️⃣ Missing Items

✅ No missing items detected

### 6️⃣ Violations (12)

**Non-Standard Spacing (12):**
- ⚠️ `gap-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ✅ Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**API Endpoints Used (1):**
- ✅ `post /vendor/subscriptions/plans`

**API Contract Issues:**
- ⚠️ Invalid HTTP method: post

---

#### 13. page

**File Path:** `apps/vendor-web/app/bookings/page.tsx`

### 1️⃣ Matching Percentage: **74%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -16%
- Missing API Integration: -10%

### 2️⃣ Components Used (0)

*No components detected in code*

### 3️⃣ Colors & Styles (27 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (34)

**Layout Type:**
- Flex: 2 classes
- Grid: 0 classes
- Spacing: 13 classes
- Sizing: 10 classes

**Sample Layout Classes:**
```
flex, hidden, flex-wrap, items-center, justify-center, justify-between, gap-4, gap-2, p-6, p-4, p-2, px-4, py-2, py-12, px-6, py-3, py-4, px-3, py-1, mb-6, mb-4, w-100, w-700, min-h-screen, h-12
```

### 5️⃣ Missing Items

- ❌ API Integration
- ❌ Component structure

### 6️⃣ Violations (8)

**Non-Standard Spacing (8):**
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 14. VendorServiceConfiguration

**File Path:** `apps/vendor-web/components/vendor/VendorServiceConfigurationScreen.tsx`

### 1️⃣ Matching Percentage: **74%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -16%
- Missing API Integration: -10%

### 2️⃣ Components Used (1)

```
DollarSign
```

### 3️⃣ Colors & Styles (9 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (30)

**Layout Type:**
- Flex: 1 classes
- Grid: 0 classes
- Spacing: 9 classes
- Sizing: 10 classes

**Sample Layout Classes:**
```
flex, block, items-center, justify-center, justify-between, gap-3, space-y-4, gap-2, space-y-3, p-4, p-6, p-3, p-2, px-3, py-2, py-3, mb-6, mb-4, mb-1, min-h-screen, w-full, w-12, h-12, w-6, h-6
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (8)

**Non-Standard Spacing (8):**
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 15. VendorEarnings

**File Path:** `apps/vendor-web/components/vendor/VendorEarningsPage.tsx`

### 1️⃣ Matching Percentage: **72%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -18%
- Missing API Integration: -10%

### 2️⃣ Components Used (1)

```
EarningsStats
```

### 3️⃣ Colors & Styles (18 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (35)

**Layout Type:**
- Flex: 1 classes
- Grid: 1 classes
- Spacing: 12 classes
- Sizing: 9 classes

**Sample Layout Classes:**
```
flex, grid, items-center, justify-center, justify-between, gap-4, gap-3, gap-2, p-6, p-1, px-3, py-1, p-4, p-3, py-12, p-2, px-2, mb-6, mt-4, mt-1, mt-2, w-100, w-700, h-64, h-8
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (9)

**Non-Standard Spacing (9):**
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 16. VendorBookings

**File Path:** `apps/vendor-web/components/vendor/VendorBookingsPage.tsx`

### 1️⃣ Matching Percentage: **70%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -20%
- Missing API Integration: -10%

### 2️⃣ Components Used (0)

*No components detected in code*

### 3️⃣ Colors & Styles (24 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (38)

**Layout Type:**
- Flex: 2 classes
- Grid: 0 classes
- Spacing: 14 classes
- Sizing: 9 classes

**Sample Layout Classes:**
```
flex, flex-col, items-center, justify-between, justify-center, items-start, gap-4, space-y-4, gap-2, gap-3, p-6, p-2, p-4, p-1, px-4, py-2, py-12, px-2, py-1, p-3, px-3, mb-6, mt-4, mt-2, mt-1
```

### 5️⃣ Missing Items

- ❌ API Integration
- ❌ Component structure

### 6️⃣ Violations (10)

**Non-Standard Spacing (10):**
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 17. VendorServices

**File Path:** `apps/vendor-web/components/vendor/VendorServicesPage.tsx`

### 1️⃣ Matching Percentage: **70%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -20%
- Missing API Integration: -10%

### 2️⃣ Components Used (1)

```
ServiceModal
```

### 3️⃣ Colors & Styles (18 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (39)

**Layout Type:**
- Flex: 1 classes
- Grid: 1 classes
- Spacing: 14 classes
- Sizing: 7 classes

**Sample Layout Classes:**
```
flex, grid, block, items-center, justify-center, justify-between, gap-2, gap-4, gap-3, space-y-4, p-6, px-4, py-2, p-2, py-12, px-6, p-4, p-3, px-2, py-1, px-3, pt-4, mb-6, mt-4, mt-2
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (10)

**Non-Standard Spacing (10):**
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 18. VendorSettings

**File Path:** `apps/vendor-web/components/vendor/VendorSettingsPage.tsx`

### 1️⃣ Matching Percentage: **68%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -22%
- Missing API Integration: -10%

### 2️⃣ Components Used (4)

```
VendorProfile, BankDetails, ScheduleManager, NotificationPreferences
```

### 3️⃣ Colors & Styles (17 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (47)

**Layout Type:**
- Flex: 1 classes
- Grid: 1 classes
- Spacing: 14 classes
- Sizing: 15 classes

**Sample Layout Classes:**
```
flex, grid, block, hidden, items-center, justify-center, justify-between, gap-2, gap-4, gap-1, space-y-3, space-y-6, p-6, p-1, px-4, py-2, p-2, p-4, px-3, px-6, py-1, p-3, px-2, mb-6, mb-4
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (11)

**Non-Standard Spacing (11):**
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

#### 19. page

**File Path:** `apps/vendor-web/app/settlements/page.tsx`

### 1️⃣ Matching Percentage: **66%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -24%
- Missing API Integration: -10%

### 2️⃣ Components Used (1)

```
SettlementSummary
```

### 3️⃣ Colors & Styles (33 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (50)

**Layout Type:**
- Flex: 2 classes
- Grid: 1 classes
- Spacing: 18 classes
- Sizing: 11 classes

**Sample Layout Classes:**
```
flex, grid, hidden, flex-wrap, items-center, justify-center, justify-between, items-start, gap-4, gap-2, gap-6, gap-1, gap-3, space-y-1, py-8, px-4, py-2, p-4, p-6, p-12, p-2, px-2, py-0, px-3, py-1
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (12)

**Non-Standard Spacing (12):**
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Static/Display screen)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Static/Display screen functionality
- Screen appears to be static or not fully integrated

---

#### 20. VendorStaff

**File Path:** `apps/vendor-web/components/vendor/VendorStaffPage.tsx`

### 1️⃣ Matching Percentage: **66%**

**Breakdown:**
- Base Score: 100%
- Violations Deduction: -24%
- Missing API Integration: -10%

### 2️⃣ Components Used (1)

```
StaffModal
```

### 3️⃣ Colors & Styles (24 unique)

**Approved Design Tokens:** 0
### 4️⃣ Layout Classes & Component Placement (46)

**Layout Type:**
- Flex: 2 classes
- Grid: 1 classes
- Spacing: 16 classes
- Sizing: 9 classes

**Sample Layout Classes:**
```
flex, grid, block, flex-wrap, items-center, justify-center, justify-between, items-start, gap-2, gap-4, gap-3, space-y-2, gap-1, space-y-4, p-6, px-4, py-2, p-2, py-12, px-6, p-4, p-3, px-2, py-1, p-1
```

### 5️⃣ Missing Items

- ❌ API Integration

### 6️⃣ Violations (12)

**Non-Standard Spacing (12):**
- ⚠️ `gap-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `gap-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-6` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-2` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `py-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `p-1` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- ⚠️ `px-3` - Use spacing from design system (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

### 7️⃣ API Contract & Integration Status

**Integration Status:** ❌ Not Integrated

**Should Have API:** ✅ Yes (Dynamic data required)

**⚠️ Missing API Endpoints:**
- Expected endpoints for Dynamic data required functionality
- Screen appears to be static or not fully integrated

---

## 📋 SUMMARY TABLES

### Top 20 Screens with Most Violations

| Rank | Screen | App | Violations | Match % |
|------|--------|-----|------------|----------|
| 1 | OrderDetail | customer-mobile | 15 | 60% |
| 2 | BookingDetail | customer-mobile | 14 | 62% |
| 3 | page | admin-web | 14 | 72% |
| 4 | page | customer-web | 14 | 62% |
| 5 | page | customer-web | 14 | 62% |
| 6 | page | customer-web | 14 | 72% |
| 7 | page | customer-web | 14 | 62% |
| 8 | CancelBooking | customer-mobile | 13 | 64% |
| 9 | CustomerHome | customer-mobile | 13 | 64% |
| 10 | page | admin-web | 13 | 74% |
| 11 | CustomerPlanningJourney | customer-mobile | 12 | 66% |
| 12 | page | admin-web | 12 | 76% |
| 13 | page | admin-web | 12 | 76% |
| 14 | page | customer-web | 12 | 66% |
| 15 | page | vendor-web | 12 | 76% |
| 16 | page | vendor-web | 12 | 66% |
| 17 | page | vendor-web | 12 | 76% |
| 18 | VendorStaff | vendor-web | 12 | 66% |
| 19 | CustomerHavePetJourney | customer-mobile | 11 | 68% |
| 20 | page | admin-web | 11 | 68% |

### Screens Missing API Integration

| Screen | App | Should Have | Status |
|--------|-----|-------------|--------|
| BookingCheckIn | customer-mobile | ✅ Yes | ❌ Missing |
| BookingConfirmation | customer-mobile | ✅ Yes | ❌ Missing |
| BookingCreation | customer-mobile | ✅ Yes | ❌ Missing |
| BookingDetail | customer-mobile | ✅ Yes | ❌ Missing |
| BookingFeedback | customer-mobile | ✅ Yes | ❌ Missing |
| BookingList | customer-mobile | ✅ Yes | ❌ Missing |
| BookingOTP | customer-mobile | ✅ Yes | ❌ Missing |
| BookingReceipt | customer-mobile | ✅ Yes | ❌ Missing |
| BookingTimeline | customer-mobile | ✅ Yes | ❌ Missing |
| CancelBooking | customer-mobile | ✅ Yes | ❌ Missing |
| EmergencyBooking | customer-mobile | ✅ Yes | ❌ Missing |
| PackageBooking | customer-mobile | ✅ Yes | ❌ Missing |
| RescheduleBooking | customer-mobile | ✅ Yes | ❌ Missing |
| ServiceBookingFlow | customer-mobile | ✅ Yes | ❌ Missing |
| LiveTrackingDashboard | customer-mobile | ✅ Yes | ❌ Missing |
| CustomerOnboarding | customer-mobile | ✅ Yes | ❌ Missing |
| CustomerUserProfile | customer-mobile | ✅ Yes | ❌ Missing |
| OrderDetail | customer-mobile | ✅ Yes | ❌ Missing |
| OrderHistory | customer-mobile | ✅ Yes | ❌ Missing |
| OrderInvoice | customer-mobile | ✅ Yes | ❌ Missing |
| OrderReturn | customer-mobile | ✅ Yes | ❌ Missing |
| OrderSuccess | customer-mobile | ✅ Yes | ❌ Missing |
| OrderTracking | customer-mobile | ✅ Yes | ❌ Missing |
| PaymentFailureRecovery | customer-mobile | ✅ Yes | ❌ Missing |
| CustomerPetProfile | customer-mobile | ✅ Yes | ❌ Missing |
| PetProfileDashboard | customer-mobile | ✅ Yes | ❌ Missing |
| CustomerProfile | customer-mobile | ✅ Yes | ❌ Missing |
| EditProfile | customer-mobile | ✅ Yes | ❌ Missing |
| InsuranceServices | customer-mobile | ✅ Yes | ❌ Missing |
| NutritionistService | customer-mobile | ✅ Yes | ❌ Missing |

### Color Compliance Summary

| App | Screens | Hardcoded Colors | Compliance % |
|-----|---------|------------------|--------------|
| customer-mobile | 76 | 304 | 60% |
| vendor-mobile | 49 | 63 | 87% |
| admin-web | 20 | 0 | 100% |
| customer-web | 32 | 1 | 100% |
| vendor-web | 20 | 0 | 100% |
