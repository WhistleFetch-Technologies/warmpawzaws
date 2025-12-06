# 🌍 Region Management API Reference

## 📖 Complete API Documentation

All endpoints are prefixed with: `https://{projectId}.supabase.co/functions/v1/make-server-3dd53475`

---

## 🔓 Public Endpoints (No Auth Required)

### **GET /regions**
Get all regions (active and inactive)

#### Request
```bash
curl -X GET "https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/regions" \
  -H "Authorization: Bearer {publicAnonKey}"
```

#### Response
```json
{
  "success": true,
  "regions": [
    {
      "regionId": "india",
      "regionName": "India",
      "regionCode": "IN",
      "isActive": true,
      "phoneConfig": {
        "countryCode": "+91",
        "phoneLength": 10,
        "phoneFormat": "XXXXX XXXXX",
        "validationRegex": "^[6-9][0-9]{9}$",
        "placeholder": "+91 98765 43210",
        "displayFormat": "+91 XXXXX XXXXX"
      },
      "currency": {
        "code": "INR",
        "symbol": "₹",
        "symbolPosition": "before",
        "decimalPlaces": 2,
        "thousandsSeparator": ",",
        "decimalSeparator": "."
      },
      "localization": {
        "primaryLanguage": "en",
        "supportedLanguages": ["en", "hi"],
        "dateFormat": "DD/MM/YYYY",
        "timeFormat": "24h",
        "timezone": "Asia/Kolkata",
        "rtlSupport": false
      },
      "serviceCatalog": {
        "veterinary": true,
        "grooming": true,
        "training": true,
        "walking": true,
        "behavioral": true,
        "boarding": true,
        "adoption": true,
        "sunset": true,
        "insurance": true,
        "pharmacy": true,
        "petCafe": true
      },
      "popularBreeds": {
        "dogs": ["Labrador", "German Shepherd", "Golden Retriever"],
        "cats": ["Persian", "Siamese", "Maine Coon"]
      },
      "createdAt": "2024-11-27T00:00:00.000Z",
      "updatedAt": "2024-11-27T00:00:00.000Z"
    }
  ]
}
```

#### Use Cases
- Load all regions in Region Manager list view
- Display regions in dropdown for selection
- Admin dashboard region overview
- Analytics and reporting

---

### **GET /regions/active**
Get only active regions

#### Request
```bash
curl -X GET "https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/regions/active" \
  -H "Authorization: Bearer {publicAnonKey}"
```

#### Response
```json
{
  "success": true,
  "regions": [
    {
      "regionId": "india",
      "regionName": "India",
      "isActive": true,
      // ... full region object
    },
    {
      "regionId": "usa",
      "regionName": "United States",
      "isActive": true,
      // ... full region object
    }
  ]
}
```

#### Use Cases
- Customer app region selector
- Show only available markets
- Vendor registration region picker
- Filter active regions for booking

---

### **GET /regions/:regionId**
Get specific region by ID

#### Request
```bash
curl -X GET "https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/regions/india" \
  -H "Authorization: Bearer {publicAnonKey}"
```

#### Parameters
- `regionId` (path): Region identifier (india, usa, uae, singapore)

#### Response
```json
{
  "success": true,
  "region": {
    "regionId": "india",
    "regionName": "India",
    "regionCode": "IN",
    // ... full region object
  }
}
```

#### Error Response (404)
```json
{
  "success": false,
  "error": "Region not found"
}
```

#### Use Cases
- Load specific region configuration
- Region detail view
- Verify region exists
- Get region settings for current user

---

### **GET /region-services**
Get enabled services for a region

#### Request
```bash
curl -X GET "https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/region-services?regionId=india" \
  -H "Authorization: Bearer {publicAnonKey}"
```

#### Query Parameters
- `regionId` (optional): Region ID (defaults to "india")

#### Response
```json
{
  "success": true,
  "services": {
    "veterinary": true,
    "grooming": true,
    "training": true,
    "walking": true,
    "behavioral": true,
    "boarding": true,
    "adoption": true,
    "sunset": true,
    "insurance": true,
    "pharmacy": true,
    "petCafe": true
  },
  "regionId": "india",
  "regionName": "India"
}
```

#### Use Cases
- Filter available services in customer app
- Show/hide service cards based on region
- Validate service availability before booking
- Vendor registration service selection

---

## 🔐 Admin Endpoints (Auth Required)

### **POST /admin/regions/init-india**
Initialize India region from template

#### Request
```bash
curl -X POST "https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/regions/init-india" \
  -H "Authorization: Bearer {publicAnonKey}" \
  -H "Content-Type: application/json"
```

#### Response
```json
{
  "success": true,
  "message": "India region initialized successfully",
  "region": {
    "regionId": "india",
    // ... full region object
  }
}
```

#### Error Response (Conflict)
```json
{
  "success": false,
  "error": "India region already exists"
}
```

#### Use Cases
- First-time setup
- Region Manager "Create Region" button
- Automated deployment scripts
- Reset to default configuration

---

### **POST /admin/regions/init-usa**
Initialize USA region from template

#### Request
```bash
curl -X POST "https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/regions/init-usa" \
  -H "Authorization: Bearer {publicAnonKey}" \
  -H "Content-Type: application/json"
```

#### Response
```json
{
  "success": true,
  "message": "USA region initialized successfully",
  "region": {
    "regionId": "usa",
    "regionName": "United States",
    "regionCode": "US",
    "currency": {
      "code": "USD",
      "symbol": "$"
    },
    // ... full region object
  }
}
```

---

### **POST /admin/regions/init-uae**
Initialize UAE region from template

#### Request
```bash
curl -X POST "https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/regions/init-uae" \
  -H "Authorization: Bearer {publicAnonKey}" \
  -H "Content-Type: application/json"
```

#### Response
```json
{
  "success": true,
  "message": "UAE region initialized successfully",
  "region": {
    "regionId": "uae",
    "regionName": "United Arab Emirates",
    "regionCode": "AE",
    "currency": {
      "code": "AED",
      "symbol": "AED"
    },
    "localization": {
      "rtlSupport": true
    }
    // ... full region object
  }
}
```

---

### **POST /admin/regions/init-singapore**
Initialize Singapore region from template

#### Request
```bash
curl -X POST "https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/regions/init-singapore" \
  -H "Authorization: Bearer {publicAnonKey}" \
  -H "Content-Type: application/json"
```

#### Response
```json
{
  "success": true,
  "message": "Singapore region initialized successfully",
  "region": {
    "regionId": "singapore",
    "regionName": "Singapore",
    "regionCode": "SG",
    "currency": {
      "code": "SGD",
      "symbol": "S$"
    }
    // ... full region object
  }
}
```

---

### **POST /admin/regions**
Create custom region (not from template)

#### Request
```bash
curl -X POST "https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/regions" \
  -H "Authorization: Bearer {publicAnonKey}" \
  -H "Content-Type: application/json" \
  -d '{
    "regionId": "canada",
    "regionName": "Canada",
    "regionCode": "CA",
    "isActive": true,
    "phoneConfig": {
      "countryCode": "+1",
      "phoneLength": 10,
      "phoneFormat": "(XXX) XXX-XXXX",
      "validationRegex": "^[2-9][0-9]{9}$",
      "placeholder": "+1 (416) 555-0123",
      "displayFormat": "+1 (XXX) XXX-XXXX"
    },
    "currency": {
      "code": "CAD",
      "symbol": "C$",
      "symbolPosition": "before",
      "decimalPlaces": 2,
      "thousandsSeparator": ",",
      "decimalSeparator": "."
    }
    // ... other required fields
  }'
```

#### Response
```json
{
  "success": true,
  "message": "Region created successfully",
  "region": {
    "regionId": "canada",
    "regionName": "Canada",
    // ... full region object
  }
}
```

#### Use Cases
- Create region not in templates
- Custom market configuration
- Testing new region setups
- Special regional requirements

---

### **PUT /admin/regions/:regionId**
Update existing region

#### Request
```bash
curl -X PUT "https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/regions/india" \
  -H "Authorization: Bearer {publicAnonKey}" \
  -H "Content-Type: application/json" \
  -d '{
    "regionId": "india",
    "regionName": "India",
    "regionCode": "IN",
    "isActive": true,
    "serviceCatalog": {
      "veterinary": true,
      "grooming": true,
      "petCafe": false
    }
    // ... other fields
  }'
```

#### Parameters
- `regionId` (path): Region to update

#### Request Body
Full region object with modifications

#### Response
```json
{
  "success": true,
  "message": "Region updated successfully",
  "region": {
    "regionId": "india",
    "updatedAt": "2024-11-27T12:34:56.789Z",
    // ... full updated region object
  }
}
```

#### Use Cases
- Region Manager edit and save
- Update service availability
- Modify currency settings
- Change phone validation
- Update popular breeds

---

### **PATCH /admin/regions/:regionId/status**
Toggle region active status

#### Request
```bash
curl -X PATCH "https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/regions/india/status" \
  -H "Authorization: Bearer {publicAnonKey}" \
  -H "Content-Type: application/json" \
  -d '{
    "isActive": false
  }'
```

#### Parameters
- `regionId` (path): Region to update

#### Request Body
```json
{
  "isActive": true  // or false
}
```

#### Response
```json
{
  "success": true,
  "message": "Region status updated successfully",
  "region": {
    "regionId": "india",
    "isActive": false,
    "updatedAt": "2024-11-27T12:34:56.789Z"
  }
}
```

#### Use Cases
- Quick activate/deactivate from list view
- Maintenance mode for region
- Gradual rollout control
- Emergency deactivation

---

### **GET /admin/region-templates**
Get all available region templates

#### Request
```bash
curl -X GET "https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/region-templates" \
  -H "Authorization: Bearer {publicAnonKey}"
```

#### Response
```json
{
  "success": true,
  "templates": [
    {
      "id": "india",
      "name": "India",
      "description": "Indian Rupee, +91, Hindi/English",
      "flag": "🇮🇳"
    },
    {
      "id": "usa",
      "name": "United States",
      "description": "USD, +1, English",
      "flag": "🇺🇸"
    },
    {
      "id": "uae",
      "name": "United Arab Emirates",
      "description": "AED, +971, Arabic/English",
      "flag": "🇦🇪"
    },
    {
      "id": "singapore",
      "name": "Singapore",
      "description": "SGD, +65, English/Chinese",
      "flag": "🇸🇬"
    }
  ]
}
```

#### Use Cases
- Region Manager create view
- Show available templates
- Template selection UI
- Documentation

---

## 🔧 Integration Examples

### **Frontend: Load Regions in React**
```typescript
import { projectId, publicAnonKey } from './utils/supabase/info';

const loadRegions = async () => {
  const response = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/regions/active`,
    {
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
      },
    }
  );
  
  const data = await response.json();
  if (data.success) {
    setRegions(data.regions);
  }
};
```

---

### **Frontend: Create Region from Template**
```typescript
const createRegion = async (templateId: string) => {
  const response = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/regions/init-${templateId}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
      },
    }
  );
  
  const data = await response.json();
  if (data.success) {
    console.log('Region created:', data.region);
  }
};
```

---

### **Frontend: Update Region**
```typescript
const updateRegion = async (regionId: string, updates: Partial<Region>) => {
  const response = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/regions/${regionId}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    }
  );
  
  const data = await response.json();
  if (data.success) {
    console.log('Region updated:', data.region);
  }
};
```

---

### **Frontend: Toggle Region Status**
```typescript
const toggleRegionStatus = async (regionId: string, isActive: boolean) => {
  const response = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/regions/${regionId}/status`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isActive }),
    }
  );
  
  const data = await response.json();
  if (data.success) {
    console.log('Status toggled:', data.region.isActive);
  }
};
```

---

## 📊 Error Responses

### **400 Bad Request**
```json
{
  "success": false,
  "error": "Invalid request body"
}
```

### **404 Not Found**
```json
{
  "success": false,
  "error": "Region not found"
}
```

### **409 Conflict**
```json
{
  "success": false,
  "error": "Region already exists"
}
```

### **500 Internal Server Error**
```json
{
  "success": false,
  "error": "Failed to fetch regions"
}
```

---

## 🎯 Rate Limiting

Currently no rate limiting implemented. Future considerations:
- 100 requests per minute per IP
- 1000 requests per hour per API key
- Burst allowance for admin operations

---

## 🔐 Authentication

### **Public Endpoints**
Use `publicAnonKey` in Authorization header:
```
Authorization: Bearer {publicAnonKey}
```

### **Admin Endpoints**
Future: Will require admin role verification
Current: Use same `publicAnonKey`

---

## 📈 Best Practices

### **Caching**
- Cache region list for 1 hour
- Invalidate on region updates
- Use stale-while-revalidate strategy

### **Error Handling**
```typescript
try {
  const response = await fetch(endpoint);
  const data = await response.json();
  
  if (!data.success) {
    console.error('API Error:', data.error);
    // Show user-friendly message
  }
} catch (error) {
  console.error('Network Error:', error);
  // Show network error message
}
```

### **Loading States**
```typescript
const [loading, setLoading] = useState(false);

const fetchData = async () => {
  setLoading(true);
  try {
    // API call
  } finally {
    setLoading(false);
  }
};
```

---

## 🧪 Testing

### **Test Region Endpoints**
```bash
# List all regions
curl "https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/regions" \
  -H "Authorization: Bearer {key}"

# Get specific region
curl "https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/regions/india" \
  -H "Authorization: Bearer {key}"

# Create India region
curl -X POST "https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/regions/init-india" \
  -H "Authorization: Bearer {key}"

# Update region
curl -X PUT "https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/regions/india" \
  -H "Authorization: Bearer {key}" \
  -H "Content-Type: application/json" \
  -d '{"isActive": false}'
```

---

## 📞 Support

For API issues:
1. Check endpoint URL is correct
2. Verify Authorization header
3. Check request body format
4. Review error response
5. Check server logs

---

**API Version**: 1.0  
**Last Updated**: November 27, 2024  
**Status**: Production Ready ✅
