# Component Inventory

## 📊 Visual Component Structure

```mermaid
graph TB
    subgraph "E-COMMERCE"
        ECDash[ECommerceDashboard<br/>📊 Overview & Stats]
        ECSellers[SellerManagement<br/>🏪 Seller Management]
        ECProducts[ProductApproval<br/>📦 Product Approval]
        ECServices[CustomServiceApproval<br/>✅ Service Approval]
        ECOrders[OrderManagementAdmin<br/>🛒 Order Management]
        ECCommission[CommissionSettings<br/>💰 Commission Settings]
        ECCategories[CategoryManagement<br/>📁 Category Management]
        ECAnalytics[ECommerceAnalytics<br/>📈 Analytics]
        ECPolicies[PolicyManagement<br/>⚖️ Policy Management]
    end
    
    subgraph "PLATFORM SETTINGS"
        PSCloud[AWSIntegrationsSettings<br/>☁️ AWS Services]
        PSCloud -->|Contains| PSCloudS3[S3 Configuration]
        PSCloud -->|Contains| PSCloudSNS[SNS SMS/Email]
        PSCloud -->|Contains| PSCloudSQS[SQS Queues]
        PSCloud -->|Contains| PSCloudChime[Chime Video]
        PSCloud -->|Contains| PSCloudBedrock[Bedrock AI]
        PSCloud -->|Contains| PSRazorpay[Razorpay Config]
        PSCloud -->|Contains| PSGoogleMaps[Google Maps]
        
        PSPayment[PaymentGatewayIntegration<br/>💳 Payment Gateways]
        PSPayment -->|Contains| PSPayRazorpay[Razorpay]
        PSPayment -->|Contains| PSPayStripe[Stripe]
        PSPayment -->|Contains| PSPayPaytm[Paytm]
        
        PSLogistics[LogisticsIntegration<br/>🚚 Logistics]
        PSLogistics -->|Contains| PSLogPartners[LogisticsSettings<br/>Partners & Config]
        PSLogistics -->|Contains| PSLogRules[DeliveryRulesManager<br/>Delivery Rules]
        
        PSLoyalty[RewardsLoyaltyManagement<br/>🎁 Loyalty & Rewards]
    end
    
    subgraph "CATALOG & SERVICES"
        CatMain[ServiceCatalogPage<br/>📚 Main Page]
        
        CatTabs[Tab Components]
        CatTabs --> CatTab1[CategoriesTab<br/>📁 Categories]
        CatTabs --> CatTab2[ProductServicesTab<br/>📦 Products/Services]
        CatTabs --> CatTab3[PricingInventoryTab<br/>💰 Pricing/Inventory]
        CatTabs --> CatTab4[BulkOperationsTab<br/>⚡ Bulk Operations]
        CatTabs --> CatTab5[ServiceCatalogTab<br/>📋 Service Catalog]
        CatTabs --> CatTab6[RegionActivePackagesTab<br/>🌍 Regional Packages]
        
        CatModals[Modal Components<br/>14 Modals]
        CatModals --> CatModal1[AddCategoryModal]
        CatModals --> CatModal2[EditCategoryModal]
        CatModals --> CatModal3[AddProductModal]
        CatModals --> CatModal4[EditProductModal]
        CatModals --> CatModal5[AddServiceModal]
        CatModals --> CatModal6[EditServiceModal]
        CatModals --> CatModal7[ServicePreviewModal]
        CatModals --> CatModal8[DeleteConfirmationModal]
        CatModals --> CatModal9[CreateRegionalPackageModal]
        CatModals --> CatModal10[CreateBulkOperationModal]
        CatModals --> CatModal11[BulkEditModal]
        CatModals --> CatModal12[PricingRulesModal]
        CatModals --> CatModal13[ImportServicesModal]
        CatModals --> CatModal14[ExportServicesModal]
        
        CatSelectors[Selector Components<br/>8 Selectors]
        CatSelectors --> CatSel1[CategorySelector]
        CatSelectors --> CatSel2[SubCategorySelector]
        CatSelectors --> CatSel3[RegionSelector]
        CatSelectors --> CatSel4[VendorTypeSelector]
        CatSelectors --> CatSel5[VendorRoleSelector]
        CatSelectors --> CatSel6[ServiceStyleSelector]
        CatSelectors --> CatSel7[TagsSelector]
        CatSelectors --> CatSel8[RegionalAvailabilitySelector]
        
        CatDisplay[Display Components<br/>5 Display]
        CatDisplay --> CatDisp1[StatusBadge]
        CatDisplay --> CatDisp2[MetricsCard]
        CatDisplay --> CatDisp3[ServiceSubscriptionPreview]
        CatDisplay --> CatDisp4[RegionalPackageList]
        CatDisplay --> CatDisp5[RegionalPricingEditor]
        
        CatUtils[Utility Components<br/>1 Utility]
        CatUtils --> CatUtil1[IconSelector]
    end
    
    style ECDash fill:#ffe6e6
    style ECSellers fill:#ffe6e6
    style ECProducts fill:#ffe6e6
    style ECServices fill:#ffe6e6
    style ECOrders fill:#ffe6e6
    style ECCommission fill:#ffe6e6
    style ECCategories fill:#ffe6e6
    style ECAnalytics fill:#ffe6e6
    style ECPolicies fill:#ffe6e6
    
    style PSCloud fill:#e6f3ff
    style PSPayment fill:#e6f3ff
    style PSLogistics fill:#e6f3ff
    style PSLoyalty fill:#e6f3ff
    
    style CatMain fill:#e6ffe6
    style CatTabs fill:#e6ffe6
    style CatModals fill:#fff4e6
    style CatSelectors fill:#fff4e6
    style CatDisplay fill:#fff4e6
    style CatUtils fill:#fff4e6
```

## Component Inventory

## 📦 E-Commerce Components

### Main Components (9 components)

1. **ECommerceDashboard** (`dashboard/ECommerceDashboard.tsx`)
   - Overview dashboard with stats
   - Quick actions
   - Performance metrics
   - Revenue tracking

2. **SellerManagement** (`sellerManagement/SellerManagement.tsx`)
   - Seller list and management
   - Seller approval/rejection
   - Seller performance tracking
   - Seller settings

3. **ProductApproval** (`productApproval/ProductApproval.tsx`)
   - Product approval workflow
   - Product review and moderation
   - Product status management

4. **CustomServiceApproval** (`customerServiceApproval/CustomServiceApproval.tsx`)
   - Custom service approval
   - Service review process
   - Service moderation

5. **OrderManagementAdmin** (`orderManagementAdmin/OrderManagementAdmin.tsx`)
   - Order management
   - Order tracking
   - Order status updates
   - Order fulfillment

6. **CommissionSettings** (`commissionSettings/CommissionSettings.tsx`)
   - Commission tier management
   - Commission rate configuration
   - Commission rules and policies

7. **CategoryManagement** (`categoryManagement/CategoryManagement.tsx`)
   - Category CRUD operations
   - Category hierarchy
   - Category settings

8. **ECommerceAnalytics** (`analytics/ECommerceAnalytics.tsx`)
   - Revenue analytics
   - Sales analytics
   - Product performance
   - Seller performance metrics

9. **PolicyManagement** (`policyManagement/PolicyManagement.tsx`)
   - E-commerce policies
   - Return/refund policies
   - Shipping policies
   - Terms and conditions

### Tabs in E-Commerce Page
- Dashboard
- Sellers
- Product Approval
- Service Approval
- Orders
- % Commission
- Categories
- Analytics
- Policies

---

## ⚙️ Platform Settings Components

### Main Integration Components (4 tabs)

1. **AWSIntegrationsSettings** (`integrations/awsIntegrationSettings/AWSIntegrationsSettings.tsx`)
   - **AWS Services Tab:**
     - S3 Configuration (bucket, region)
     - SNS Configuration (SMS, Email)
     - SQS Configuration (queue URL, region)
     - Chime Configuration (video calls)
     - Bedrock AI Configuration (model ID, region)
   - **Razorpay Tab:**
     - Payment gateway settings
     - Bank verification
     - API keys
   - **Google Maps Tab:**
     - Maps API key
     - Region settings
   - Password protected (Warmpawz2025)

2. **PaymentGatewayIntegration** (`integrations/paymentGatewayIntegration/PaymentGatewayIntegration.tsx`)
   - Razorpay configuration
   - Stripe configuration
   - Paytm configuration
   - Payment gateway settings
   - Settlement period configuration
   - Bank account verification

3. **LogisticsIntegration** (`integrations/logisticsIntegration/LogisticsIntegration.tsx`)
   - **Partners & Configuration Tab:**
     - LogisticsSettings component
     - Partner management (Shiprocket, Delhivery, BlueDart)
     - Partner configuration
     - API endpoints and keys
     - Region coverage
     - Category mapping
     - Pricing rules
   - **Delivery Rules Tab:**
     - DeliveryRulesManager component
     - Delivery rule configuration
     - Distance-based pricing
     - Time-based rules

4. **RewardsLoyaltyManagement** (`integrations/rewardsLoyaltyManagement/RewardsLoyaltyManagement.tsx`)
   - Loyalty points system
   - Rewards configuration
   - Redemption rules
   - Points calculation

### Sub-Components

- **LogisticsSettings** (`logisticsIntegration/logisticsSettings/LogisticsSettings.tsx`)
  - Partner list and management
  - Add/edit logistics partners
  - Partner enable/disable
  - Region coverage configuration
  - Pricing rules per partner

- **DeliveryRulesManager** (`logisticsIntegration/deliveryRulesManager/DeliveryRulesManager.tsx`)
  - Delivery rules configuration
  - Distance-based rules
  - Time-based rules
  - Cost calculation rules

### Tabs in Platform Settings Page
- Cloud & Maps (AWS, Razorpay, Google Maps)
- Payment Gateway (Razorpay, Stripe, Paytm)
- Logistics Integration (Partners, Delivery Rules)
- Loyalty & Rewards (Points, Rewards, Redemption)

---

## 📚 Catalog & Services Components

### Main Page Component

**ServiceCatalogPage** (`app/catalog/page.tsx`)
- Service catalog management
- Service CRUD operations
- Service filtering and search
- Service status management
- Service ordering/reordering

### Tab Components (6 tabs)

1. **CategoriesTab** (`catalog/CategoriesTab.tsx`)
   - Category management
   - Category hierarchy
   - Add/edit/delete categories
   - Category display order

2. **ProductServicesTab** (`catalog/ProductServicesTab.tsx`)
   - Product and service management
   - Product/service CRUD
   - Product/service listing

3. **PricingInventoryTab** (`catalog/PricingInventoryTab.tsx`)
   - Pricing management
   - Inventory tracking
   - Price rules
   - Stock management

4. **BulkOperationsTab** (`catalog/BulkOperationsTab.tsx`)
   - Bulk edit operations
   - Bulk import/export
   - Bulk status updates
   - Bulk pricing updates

5. **ServiceCatalogTab** (`catalog/ServiceCatalogTab.tsx`)
   - Service catalog listing
   - Service details
   - Service management

6. **RegionActivePackagesTab** (`catalog/RegionActivePackagesTab.tsx`)
   - Regional package management
   - Region-specific packages
   - Package activation by region

### Supporting Components (33 components)

**Modal Components:**
- `AddCategoryModal.tsx` - Add new category
- `EditCategoryModal.tsx` - Edit existing category
- `AddProductModal.tsx` - Add new product
- `EditProductModal.tsx` - Edit existing product
- `AddServiceModal.tsx` - Add new service
- `EditServiceModal.tsx` - Edit existing service
- `ServicePreviewModal.tsx` - Preview service details
- `DeleteConfirmationModal.tsx` - Delete confirmation
- `CreateRegionalPackageModal.tsx` - Create regional package
- `CreateBulkOperationModal.tsx` - Bulk operation creation
- `BulkEditModal.tsx` - Bulk edit interface
- `PricingRulesModal.tsx` - Pricing rules configuration
- `ImportServicesModal.tsx` - Import services
- `ExportServicesModal.tsx` - Export services

**Selector Components:**
- `CategorySelector.tsx` - Category selection
- `SubCategorySelector.tsx` - Sub-category selection
- `RegionSelector.tsx` - Region selection
- `VendorTypeSelector.tsx` - Vendor type selection
- `VendorRoleSelector.tsx` - Vendor role selection
- `ServiceStyleSelector.tsx` - Service style selection (centre/home/tele/ecommerce)
- `TagsSelector.tsx` - Tags selection
- `RegionalAvailabilitySelector.tsx` - Regional availability

**Display Components:**
- `StatusBadge.tsx` - Status badge display
- `MetricsCard.tsx` - Metrics display card
- `ServiceSubscriptionPreview.tsx` - Service subscription preview
- `RegionalPackageList.tsx` - Regional package listing
- `RegionalPricingEditor.tsx` - Regional pricing editor

**Utility Components:**
- `IconSelector.tsx` - Icon selection interface

### Features in Catalog & Services

- **Service Management:**
  - Create, edit, delete services
  - Service status (active/inactive/draft)
  - Publish status (published/unpublished/archived)
  - Service ordering/reordering
  - Service search and filtering

- **Category Management:**
  - Category hierarchy
  - Category CRUD
  - Category display order

- **Regional Management:**
  - Region-specific packages
  - Regional pricing
  - Regional availability

- **Bulk Operations:**
  - Bulk import/export
  - Bulk edit
  - Bulk status updates

---

## 📊 Component Summary

### E-Commerce: 9 Main Components
- Dashboard, Sellers, Products, Services, Orders, Commission, Categories, Analytics, Policies

### Platform Settings: 4 Main Integration Components
- AWS Integrations (S3, SNS, SQS, Chime, Bedrock)
- Payment Gateway (Razorpay, Stripe, Paytm)
- Logistics Integration (Partners, Delivery Rules)
- Loyalty & Rewards (Points, Rewards, Redemption)

### Catalog & Services: 1 Main Page + 6 Tab Components + 33 Supporting Components
- Service Catalog Management
- Categories, Products, Pricing, Bulk Operations, Regional Packages
- Multiple modals, selectors, and utility components

