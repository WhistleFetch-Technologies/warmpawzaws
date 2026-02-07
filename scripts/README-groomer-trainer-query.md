# Groomer and Trainer Vendors Query - Quick Start

## ✅ Recommended: Direct RDS Connection (Node.js)

**This is the recommended method** - uses AWS Secrets Manager for credentials and direct PostgreSQL connection:

```bash
# Uses AWS credentials from your environment
# Automatically fetches DB credentials from Secrets Manager
node scripts/list-groomer-trainer-vendors-direct.js
```

**Environment Variables (optional, defaults provided):**
- `DB_HOST` - RDS cluster endpoint (default: `warmpawz-dev-cluster.cluster-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com`)
- `DB_NAME` - Database name (default: `warmpawz`)
- `DB_SECRET_ARN` - AWS Secrets Manager ARN (default: `arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-dev-rds-master-20260106164510791100000002-WqZcjI`)
- `AWS_REGION` - AWS region (default: `ap-south-1`)

**Prerequisites:**
- AWS credentials configured (via `aws configure` or environment variables)
- IAM permissions to access Secrets Manager
- Network access to RDS cluster

---

## Alternative Options

### Option 2: SQL Query (Direct Database Access)

If you have direct access to the PostgreSQL database:

```bash
export DB_HOST=your-host
export DB_USER=your-user
export DB_PASSWORD=your-password
export DB_NAME=warmpawz

psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f scripts/list-groomer-trainer-vendors.sql
```

### Option 3: Simple Shell Script

```bash
export DB_HOST=your-host
export DB_USER=your-user
export DB_NAME=warmpawz

./scripts/list-groomer-trainer-vendors-simple.sh
```

### Option 4: RDS Data API (Requires HTTP Endpoint Enabled)

**Note:** This requires RDS HTTP endpoint to be enabled. If not enabled, use the direct connection method above.

```bash
export DB_CLUSTER_ARN=arn:aws:rds:ap-south-1:057442119249:cluster:warmpawz-dev-db
export DB_SECRET_ARN=arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-dev-rds-master-20260106164510791100000002-WqZcjI
node scripts/list-groomer-trainer-vendors-rds.js
```

### Option 5: API Access

```bash
# Set API URL
export API_BASE_URL=https://your-api-domain.com

# Run API script
node scripts/list-groomer-trainer-vendors-api.js
```

---

## What You'll Get

The query returns:
- **Vendor count** by role (groomer vs trainer, center vs solo)
- **Service details** for each vendor:
  - Service name, style (at_home, at_center, tele), price, duration
  - Enabled/disabled status
  - Custom services (🎨)
  - Packages (📋)
  - Publish status (draft/published)
- **Summary statistics**:
  - Total vendors by role
  - Total services
  - Enabled services
  - Custom services count
  - Packages count

---

## Example Output

```
📊 Found data for 19 service entries

📊 TOTAL VENDORS: 9

1. 🏢 VENDOR: srikant sharmas centre training
   ID: 55bdca98-71c9-48cb-95b6-41e8d23d2cf3
   Owner: srikant sharmas centre training
   Role: Trainer (Center) (trainer_center)
   Phone: 6123456000

   📦 Total Services: 9
   ✅ Enabled Services: 2
   🎨 Custom Services: 7
   📋 Packages: 0

   🏠 At Home Services (1):
      ✅ Daily training   [published]
         Price: ₹600.00 | Duration: 30 min
         Category: Uncategorized

   🏥 At Center Services (1):
      ✅ pet center   [published]
         Price: ₹1100.00 | Duration: 45 min
         Category: Uncategorized

   ❌ Disabled Services (7):
      - Test Service (at_center)
      ...

📊 SUMMARY STATISTICS

Total Vendors: 9

By Role:
  Groomer (Center): 3 vendor(s)
  Groomer (Solo): 3 vendor(s)
  Trainer (Center): 1 vendor(s)
  Trainer (Solo): 2 vendor(s)

Total Services: 13
Enabled Services: 6
Custom Services: 7
Packages: 0
```

---

## Troubleshooting

**If direct connection script fails:**

1. **"Error fetching DB credentials"**
   - Check AWS credentials: `aws sts get-caller-identity`
   - Verify `DB_SECRET_ARN` is correct
   - Ensure IAM permissions for Secrets Manager

2. **"getaddrinfo ENOTFOUND"**
   - Check `DB_HOST` is correct
   - Verify network access to RDS cluster
   - Check security group allows your IP

3. **"database does not exist"**
   - Verify `DB_NAME` (should be `warmpawz`, not `warmpawz_dev`)
   - Check database exists in RDS

4. **"column does not exist"**
   - Database schema may have changed
   - Check table structure matches query expectations

**If SQL query fails:**
- Check database connection
- Verify table names exist
- Check column names match schema

**If API query fails:**
- Verify API server is running
- Check `API_BASE_URL` is correct
- Verify endpoints are accessible

**If no results:**
- Check if vendors exist with groomer/trainer roles
- Verify vendors are marked as `is_active = true`
- Check role name matching (case-insensitive, uses ILIKE)

---

## Files

- `list-groomer-trainer-vendors-direct.js` - ✅ **Recommended** - Direct RDS connection via PostgreSQL
- `list-groomer-trainer-vendors-rds.js` - RDS Data API (requires HTTP endpoint)
- `list-groomer-trainer-vendors.sql` - Raw SQL query
- `list-groomer-trainer-vendors-simple.sh` - Shell script wrapper
- `list-groomer-trainer-vendors-api.js` - API-based query

---

**Ready to execute! Use `node scripts/list-groomer-trainer-vendors-direct.js`**
