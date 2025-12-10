# 🚀 Logistics Integration - Quick Start Guide

## 🎯 For Admin: 5-Minute Setup

### Step 1: Configure Logistics Partners (2 min)

1. **Go to**: Admin Dashboard → Platform Settings → Logistics Integration
2. **Configure Shiprocket**:
   - Tab: "Shiprocket Integration"
   - Email: `ketan.hirani@gmail.com`
   - Password: (already configured)
   - Click "Test Connection"
   - Save

3. **Configure Delhivery**:
   - Tab: "Delhivery Integration"
   - API Token: Get from [Delhivery Dashboard](https://dashboard.delhivery.com)
   - Pickup Location: Your warehouse address
   - Click "Test Connection"
   - Save

---

### Step 2: Create Delivery Rules (3 min)

**Go to**: Partners & Configuration → Delivery Rules tab

#### Rule 1: COD Orders (Priority 10)
```
Name: "COD Orders via Delhivery"
Priority: 10
Conditions:
  - Payment Method: COD
  - Delivery Type: Pan India, Intercity
Primary Partner: Delhivery
```

#### Rule 2: Prepaid E-commerce (Priority 20)
```
Name: "Prepaid Ecommerce via Shiprocket"
Priority: 20
Conditions:
  - Order Type: Ecommerce
  - Payment Method: Prepaid
  - Delivery Type: Pan India, Intercity
Primary Partner: Shiprocket
```

#### Rule 3: Food Delivery (Priority 5)
```
Name: "Food - Hyperlocal Partner"
Priority: 5
Conditions:
  - Order Type: Food, Fresh
  - Delivery Type: Hyperlocal
  - Distance: 0-10 km
Primary Partner: Hyperlocal Partner
```

Click **Save All Rules**

---

### Step 3: Test Routing

1. Click **Test Routing** button
2. Set test order:
   - Order Type: Ecommerce
   - Payment: COD
   - Amount: ₹500
3. Click **Run Test**
4. Verify: Should route to **Delhivery**

---

## 📱 For Customers: Track Your Order

### Method 1: From Order History
1. Go to Profile → Orders
2. Click on order
3. Click "Track Shipment"
4. View real-time updates

### Method 2: Direct Tracking
1. Use tracking link from email/SMS
2. Enter AWB number
3. View delivery status

---

## 🏪 For Vendors: Process Orders

### When Order Received:
1. Pack the order
2. System automatically creates shipment with best partner
3. Print shipping label from order details
4. Hand over to courier

### Partner Selection is Automatic:
- ✅ COD orders → Delhivery
- ✅ Prepaid orders → Shiprocket
- ✅ Food orders → Hyperlocal Partner
- ✅ Based on your configured rules

---

## 🔧 Common Scenarios

### Scenario 1: Customer Orders Pet Food (₹600, Prepaid)
**Flow**:
- Order Type: Ecommerce
- Payment: Prepaid
- Weight: 1.5 kg
- Route: Bangalore → Mumbai

**Routing Decision**:
- Rule Match: "Prepaid Ecommerce via Shiprocket"
- **Partner**: Shiprocket
- Create shipment → AWB generated → Tracking link sent

---

### Scenario 2: Customer Orders Restaurant Food (₹300, COD)
**Flow**:
- Order Type: Food
- Payment: COD
- Distance: 5 km
- Route: Within Bangalore

**Routing Decision**:
- Rule Match: "Food - Hyperlocal Partner" (Priority 5)
- **Partner**: Hyperlocal Partner
- If unavailable, fallback to Delhivery

---

### Scenario 3: Customer Returns Damaged Product
**Flow**:
1. Customer: "Request Return" → Reason: Damaged
2. System: Check return policy → Eligible (7-day window)
3. Vendor: Approve return
4. System: Create reverse shipment → Schedule pickup
5. Courier: Pickup from customer
6. Warehouse: Quality check
7. System: Process refund to wallet

---

## 📊 Monitor Performance

### Admin Analytics (Coming Soon)
- Partner comparison (Shiprocket vs Delhivery)
- Average delivery time
- Return rate
- Cost per delivery

### View Shipment Status:
- **Order Created** - Shipment created, pending pickup
- **Picked Up** - Courier collected package
- **In Transit** - On the way
- **Out for Delivery** - Last mile delivery
- **Delivered** - Successfully delivered
- **RTO** - Return to Origin

---

## ⚠️ Troubleshooting

### Shipment creation failed?
**Check**:
1. Pickup address configured in partner settings
2. Delivery pincode is serviceable (use "Check Pincode" tool)
3. API credentials are valid

### Wrong partner selected?
**Check**:
1. Rule priorities (lower number = higher priority)
2. Rule conditions match order type
3. Partner is enabled

### Tracking not updating?
**Wait**: Updates may take 1-2 hours
**Or**: Click "Refresh" in tracking page

---

## 🎓 Pro Tips

1. **Priority Matters**: 
   - Rule with priority 5 runs before priority 10
   - Create specific rules with lower priority
   - Generic fallback rules with higher priority

2. **Test Before Production**:
   - Use "Test Routing" to verify rule logic
   - Test with small orders first

3. **Monitor Returns**:
   - Set appropriate return windows
   - Enable quality checks for high-value items

4. **Optimize Costs**:
   - Use cost simulator to compare partners
   - Set free delivery thresholds

---

## 📞 Support

**For Integration Issues**:
- Check LOGISTICS_INTEGRATION_COMPLETE.md for detailed docs
- Review partner API documentation
- Contact Shiprocket/Delhivery support for partner-specific issues

**For Rule Configuration**:
- Use Test Routing feature
- Check rule priority conflicts
- Verify condition matching logic

---

**Quick Links**:
- [Shiprocket API Docs](https://shiprocket.freshdesk.com/support/solutions/articles/43000337456)
- [Delhivery B2C API](https://one.delhivery.com/developer-portal/documents/b2c/)

---

*Last Updated: December 9, 2025*
