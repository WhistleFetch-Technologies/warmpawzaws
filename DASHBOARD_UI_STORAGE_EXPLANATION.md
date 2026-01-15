# Dashboard UI Configuration Storage - Complete Explanation

## 📊 Storage Method: **DATABASE SCHEMA**

The dashboard UI configuration is stored in a **PostgreSQL database table** called `platform_settings`.

## 🗄️ Database Schema

### Table: `platform_settings`

```sql
CREATE TABLE platform_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(255) UNIQUE NOT NULL,
  setting_value JSONB,  -- Stores JSON configuration
  setting_type VARCHAR(50),  -- e.g., 'json', 'ui_config'
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Storage Format

**Setting Key Format:**
```
platform:ui:dashboard:{roleId}
```

**Examples:**
- `platform:ui:dashboard:veterinarian`
- `platform:ui:dashboard:groomer`
- `platform:ui:dashboard:pet_ambulance`

**Setting Value (JSONB):**
```json
{
  "buttons": [
    {
      "id": "vet_consultation",
      "label": "Book Consultation",
      "icon": "🩺",
      "enabled": true,
      "launchPhase": "full",
      "rolloutPercentage": 100,
      "serviceId": "optional-service-id",
      "requiredRoleTypes": ["healthcare_provider"],
      "allowedServiceStyles": ["at_home", "clinic"]
    },
    ...
  ],
  "widgets": [...],  // Same as buttons (for backward compatibility)
  "layout": "default",
  "theme": "light"
}
```

## 🔄 Data Flow

```
┌─────────────────────────────────────────────────────────┐
│              Admin UI (Frontend)                         │
│  - User configures buttons                              │
│  - Clicks "Save Changes"                                │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ PUT /config/ui/dashboard
                     │ { roleId: "veterinarian", config: [...] }
                     ▼
┌─────────────────────────────────────────────────────────┐
│         Backend API (Lambda)                            │
│  - Receives config from frontend                         │
│  - Normalizes structure                                 │
│  - Calls upsert() function                              │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ SQL UPSERT
                     │ INSERT ... ON CONFLICT DO UPDATE
                     ▼
┌─────────────────────────────────────────────────────────┐
│      PostgreSQL Database (RDS)                           │
│  Table: platform_settings                               │
│  - setting_key: "platform:ui:dashboard:veterinarian"   │
│  - setting_value: { buttons: [...], ... } (JSONB)       │
│  - setting_type: "json"                                 │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ GET /config/ui/dashboard?roleId=...
                     ▼
┌─────────────────────────────────────────────────────────┐
│         Backend API (Lambda)                            │
│  - Queries platform_settings table                      │
│  - Returns config or defaults                           │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ JSON Response
                     ▼
┌─────────────────────────────────────────────────────────┐
│         Admin UI / Customer App (Frontend)              │
│  - Receives config                                      │
│  - Renders buttons based on enabled status              │
└─────────────────────────────────────────────────────────┘
```

## 📝 Code Implementation

### Saving Configuration (PUT)

```typescript
// backend/lambda/src/endpoints/ui-dashboard-config.ts

app.put('/config/ui/dashboard', async (c) => {
  const { roleId, config } = await c.req.json();
  
  const settingKey = `platform:ui:dashboard:${roleId}`;
  
  // Upsert to database
  await upsert(
    'platform_settings',
    {
      setting_key: settingKey,
      setting_value: configToSave,  // JSONB column
      setting_type: 'json',
      description: `Dashboard UI configuration for role ${roleId}`,
      updated_at: new Date().toISOString(),
    },
    'setting_key'  // Conflict column
  );
});
```

### Retrieving Configuration (GET)

```typescript
// backend/lambda/src/endpoints/ui-dashboard-config.ts

app.get('/config/ui/dashboard', async (c) => {
  const roleId = c.req.query('roleId');
  
  // Query database
  const configs = await query(
    `SELECT * FROM platform_settings 
     WHERE setting_key = $1`,
    [`platform:ui:dashboard:${roleId}`]
  );
  
  if (configs.rows.length > 0) {
    // Parse JSONB setting_value
    const settingValue = configs.rows[0].setting_value;
    return c.json({ success: true, config: settingValue });
  }
  
  // Return defaults if not found
  return c.json({ 
    success: true, 
    config: getDefaultButtonsForRole(roleId) 
  });
});
```

## 🎯 Default Values (Hardcoded in Backend)

When no configuration exists in the database, the backend returns **hardcoded defaults**:

```typescript
// backend/lambda/src/endpoints/ui-dashboard-config.ts

function getDefaultButtonsForRole(roleId: string): any[] {
  const defaultButtons: Record<string, any[]> = {
    veterinarian: [
      { id: 'vet_consultation', label: 'Book Consultation', ... },
      { id: 'vet_emergency', label: 'Emergency Care', ... },
      ...
    ],
    groomer: [...],
    walker: [...],
    trainer: [...],
  };
  
  return defaultButtons[roleId] || DEFAULT_DASHBOARD_BUTTONS;
}
```

**These defaults are:**
- ✅ Stored in **backend code** (TypeScript)
- ❌ NOT in database
- ❌ NOT in frontend
- ❌ NOT in a file

## 📋 Summary

| Component | Storage Location | Type |
|-----------|-----------------|------|
| **User Configuration** | PostgreSQL `platform_settings` table | Database (JSONB) |
| **Default Values** | Backend TypeScript code | Hardcoded in Lambda |
| **Frontend** | React/Next.js components | Renders from API response |

## 🔍 How to Verify

### Check Database Directly

```sql
-- View all dashboard configurations
SELECT 
  setting_key,
  setting_value->'buttons' as buttons,
  setting_type,
  updated_at
FROM platform_settings
WHERE setting_key LIKE 'platform:ui:dashboard:%';

-- View specific role config
SELECT setting_value
FROM platform_settings
WHERE setting_key = 'platform:ui:dashboard:veterinarian';
```

### Check via API

```bash
# Get config for a role
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/config/ui/dashboard?roleId=veterinarian"

# Response shows if it's from DB or defaults
{
  "success": true,
  "config": {
    "buttons": [...],  // From DB if exists, or defaults
    ...
  }
}
```

## ✅ Key Points

1. **Primary Storage**: PostgreSQL database (`platform_settings` table)
2. **Format**: JSONB (binary JSON) for flexible schema
3. **Key Pattern**: `platform:ui:dashboard:{roleId}`
4. **Defaults**: Hardcoded in backend TypeScript code
5. **No File Storage**: Everything is in database or code
6. **No Frontend Storage**: Frontend only displays, doesn't store

## 🔄 Migration Path

If you need to migrate configurations:

1. **Export from Database:**
   ```sql
   COPY (
     SELECT setting_key, setting_value::text
     FROM platform_settings
     WHERE setting_key LIKE 'platform:ui:dashboard:%'
   ) TO '/tmp/dashboard-configs.csv' WITH CSV HEADER;
   ```

2. **Import to New Database:**
   ```sql
   COPY platform_settings (setting_key, setting_value)
   FROM '/tmp/dashboard-configs.csv' WITH CSV HEADER;
   ```

## 🎯 Conclusion

**The dashboard UI configuration uses a DATABASE SCHEMA** (`platform_settings` table in PostgreSQL), not frontend code or files. Defaults are hardcoded in backend code as fallback when no database entry exists.
