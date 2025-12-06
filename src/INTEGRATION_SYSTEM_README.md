# Universal Integration Management System

This system allows administrators to configure external integrations (AWS, Google Maps, Payments, Logistics) dynamically without code changes. The configurations are stored in the backend KV store and consumed by the application at runtime.

## 1. Admin Portal
Navigate to **Platform Settings** in the Admin Dashboard to configure:

### ☁️ Cloud & Maps
- **AWS**: Configure S3 (Storage), SQS (Queues), SNS (Notifications), Elasticsearch.
- **Google Maps**: Set API Key and Region bias.

### 💳 Payments & Payouts
- **Gateways**: Add/Edit/Delete payment gateways (Stripe, Razorpay, PayPal).
- **Rules**: Set Platform Commission %, Hold Period, and Tax Rate.
- **Auto-Payout**: Toggle automatic payout processing.

### 🚚 Logistics Network
- **Partners**: Manage delivery partners (Dunzo, Shadowfax, etc.).
- **Routing**: Define which partner handles which region/pincode.

## 2. Developer Usage

### Unified File Upload
Use the `UnifiedUpload` component to automatically handle file uploads based on the active AWS S3 configuration.

```tsx
import { UnifiedUpload } from '../components/common/UnifiedUpload';

<UnifiedUpload 
  label="Upload Medical Report"
  path="medical-reports"
  onUploadComplete={(url) => console.log('Uploaded to:', url)} 
/>
```

- If **S3 is Enabled**: Uploads to the configured S3 bucket (via backend signed URL generation).
- If **S3 is Disabled**: Falls back to Supabase Storage (or mock local URL for dev).

### Backend Integration Hook
Use `useAdminIntegrations` to fetch settings in other parts of the app.

```tsx
import { useAdminIntegrations } from '../hooks/useAdminIntegrations';

const { fetchSettings, fetchGateways } = useAdminIntegrations();

// Check if Maps is enabled
const settings = await fetchSettings();
if (settings.googleMaps.enabled) {
  // Initialize Google Maps
}
```

## 3. Backend Architecture
- **Endpoints**: `/supabase/functions/server/admin-integration-endpoints.tsx`
- **Storage**: Supabase KV Store (`admin:settings:*`)
- **Security**: All admin endpoints are protected by `supaBase publicAnonKey` (production should use Admin Role check).
