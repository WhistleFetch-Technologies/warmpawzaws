# 🔍 AWS OPENSEARCH SETUP GUIDE

This guide covers setting up AWS OpenSearch for the Warmpawz platform with automatic SQL fallback.

---

## 📊 CURRENT IMPLEMENTATION STATUS

✅ **Search System**: Intelligent fallback implemented  
- **Primary**: AWS OpenSearch (when `ENABLE_OPENSEARCH=true`)  
- **Fallback**: PostgreSQL full-text search (always available)  
- **Graceful Degradation**: Automatic fallback on OpenSearch failure

**Performance**:
- OpenSearch: ~10-50ms (with fuzzy search, autocomplete)
- SQL Fallback: ~50-200ms (adequate for production)

---

## 🚀 OPTION 1: DEPLOY AWS OPENSEARCH (RECOMMENDED)

### **Step 1: Provision OpenSearch Cluster**

```bash
# Using AWS CDK (recommended)
cd infrastructure/cdk

# Add to lib/opensearch-stack.ts:
import * as opensearch from 'aws-cdk-lib/aws-opensearchservice';

export class OpenSearchStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const domain = new opensearch.Domain(this, 'WarmpawzSearch', {
      version: opensearch.EngineVersion.OPENSEARCH_2_11,
      capacity: {
        dataNodes: 2,
        dataNodeInstanceType: 't3.small.search', // Start small
      },
      ebs: {
        volumeSize: 20,
        volumeType: ec2.EbsDeviceVolumeType.GP3,
      },
      zoneAwareness: {
        enabled: true,
        availabilityZoneCount: 2,
      },
      enforceHttps: true,
      nodeToNodeEncryption: true,
      encryptionAtRest: {
        enabled: true,
      },
      accessPolicies: [/* Lambda IAM role policy */],
    });

    new cdk.CfnOutput(this, 'OpenSearchEndpoint', {
      value: domain.domainEndpoint,
    });
  }
}

# Deploy
npm run cdk deploy OpenSearchStack
```

### **Step 2: Create Indexes**

```bash
# Run the index creation script
node backend/lambda/scripts/create-opensearch-indexes.js
```

**Index Schema** (automatically created):

```json
{
  "warmpawz-vendors": {
    "mappings": {
      "properties": {
        "id": { "type": "keyword" },
        "business_name": { "type": "text", "analyzer": "standard" },
        "owner_name": { "type": "text" },
        "category": { "type": "keyword" },
        "specialization": { "type": "text" },
        "city": { "type": "keyword" },
        "state": { "type": "keyword" },
        "rating": { "type": "float" },
        "completed_bookings": { "type": "integer" },
        "is_active": { "type": "boolean" },
        "status": { "type": "keyword" },
        "location": { "type": "geo_point" }
      }
    }
  },
  "warmpawz-services": {
    "mappings": {
      "properties": {
        "id": { "type": "keyword" },
        "service_name": { "type": "text", "analyzer": "standard" },
        "description": { "type": "text" },
        "category": { "type": "keyword" },
        "price": { "type": "float" },
        "vendor_id": { "type": "keyword" },
        "vendor_name": { "type": "text" },
        "city": { "type": "keyword" },
        "state": { "type": "keyword" }
      }
    }
  }
}
```

### **Step 3: Run Initial Data Sync**

```bash
# Sync existing data from PostgreSQL to OpenSearch
node backend/lambda/src/jobs/opensearch-sync.js --full-sync

# This will:
# 1. Fetch all approved vendors from RDS
# 2. Fetch all published services from RDS
# 3. Bulk index into OpenSearch
# 4. Log sync progress
```

### **Step 4: Enable in Environment**

```bash
# Add to backend/lambda/.env
ENABLE_OPENSEARCH=true
OPENSEARCH_ENDPOINT=https://search-warmpawz-xxxxx.ap-south-1.es.amazonaws.com
OPENSEARCH_REGION=ap-south-1
```

### **Step 5: Set Up Continuous Sync**

**Option A: EventBridge Schedule (recommended)**
```typescript
// Run sync job every 5 minutes
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';

const syncRule = new events.Rule(this, 'OpenSearchSyncRule', {
  schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
});

syncRule.addTarget(new targets.LambdaFunction(syncLambda));
```

**Option B: DynamoDB Streams (real-time)**
```typescript
// Trigger sync on every vendor/service change
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

table.addGlobalSecondaryIndex({
  indexName: 'opensearch-sync-index',
  partitionKey: { name: 'sync_status', type: dynamodb.AttributeType.STRING },
});
```

---

## 🔄 OPTION 2: USE SQL FALLBACK ONLY (CURRENT DEFAULT)

**If you choose not to deploy OpenSearch immediately**, the system will automatically use PostgreSQL full-text search.

### **Performance Optimization for SQL Fallback**

```sql
-- Add full-text search indexes to PostgreSQL
CREATE INDEX idx_vendors_fulltext ON vendors 
USING gin(to_tsvector('english', business_name || ' ' || owner_name || ' ' || COALESCE(specialization, '')));

CREATE INDEX idx_services_fulltext ON vendor_services 
USING gin(to_tsvector('english', service_name || ' ' || COALESCE(description, '')));

-- Add trigram indexes for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_vendors_business_name_trgm ON vendors 
USING gin(business_name gin_trgm_ops);

CREATE INDEX idx_services_name_trgm ON vendor_services 
USING gin(service_name gin_trgm_ops);
```

### **Update Search Handler for Better SQL Performance**

The search handler will automatically use `ts_vector` and trigram indexes for better performance:

```typescript
// Already implemented in backend/lambda/src/endpoints/search.ts
// SQL fallback uses:
// 1. ILIKE for simple text matching
// 2. Full-text search (if indexes exist)
// 3. Trigram similarity for fuzzy matching
```

---

## 📊 MONITORING & HEALTH CHECKS

### **1. OpenSearch Health**

```bash
# Check cluster health
curl -XGET "https://your-opensearch-endpoint/_cluster/health?pretty"

# Check index stats
curl -XGET "https://your-opensearch-endpoint/_cat/indices?v"

# Monitor search performance
curl -XGET "https://your-opensearch-endpoint/_nodes/stats/indices/search?pretty"
```

### **2. Lambda Logs**

```bash
# Check which search method is being used
aws logs filter-log-events \
  --log-group-name /aws/lambda/warmpawz-search \
  --filter-pattern "Using OpenSearch" \
  --start-time $(date -u -d '1 hour ago' +%s)000

# Check for fallback events
aws logs filter-log-events \
  --log-group-name /aws/lambda/warmpawz-search \
  --filter-pattern "OpenSearch failed, falling back" \
  --start-time $(date -u -d '1 hour ago' +%s)000
```

### **3. CloudWatch Metrics**

Add custom metrics to track search performance:

```typescript
// In search handler
const cloudwatch = new AWS.CloudWatch();

await cloudwatch.putMetricData({
  Namespace: 'Warmpawz/Search',
  MetricData: [
    {
      MetricName: 'SearchMethod',
      Value: searchMethod === 'opensearch' ? 1 : 0,
      Unit: 'Count',
      Timestamp: new Date(),
    },
    {
      MetricName: 'SearchLatency',
      Value: latencyMs,
      Unit: 'Milliseconds',
      Timestamp: new Date(),
    },
  ],
}).promise();
```

---

## 🚨 TROUBLESHOOTING

### **Issue**: "OpenSearch failed, falling back to SQL"

**Possible Causes**:
1. OpenSearch endpoint not configured
2. Lambda IAM role lacks OpenSearch permissions
3. OpenSearch cluster is down or unhealthy
4. Network connectivity issues (VPC/security groups)

**Solution**:
```bash
# 1. Check endpoint configuration
echo $OPENSEARCH_ENDPOINT

# 2. Verify IAM permissions
aws iam get-role-policy --role-name WarmpawzLambdaRole --policy-name OpenSearchPolicy

# 3. Check cluster health
aws opensearch describe-domain --domain-name warmpawz-search

# 4. Test connectivity from Lambda
aws lambda invoke \
  --function-name warmpawz-search-test \
  --payload '{"test":"opensearch"}' \
  response.json
```

### **Issue**: Search results are slow (>500ms)

**Solutions**:
1. **If using OpenSearch**: Scale up to larger instance types
2. **If using SQL**: Add full-text search indexes (see above)
3. **Both**: Implement Redis caching for popular searches

```typescript
// Add caching layer
import { Redis } from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

// Cache search results for 5 minutes
const cacheKey = `search:${searchQuery}:${category}:${location}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

// ... perform search ...

await redis.setex(cacheKey, 300, JSON.stringify(results));
```

### **Issue**: Data not appearing in search results

**Check**:
1. Is OpenSearch sync running?
2. Are indexes created?
3. Is data approved/active in PostgreSQL?

```bash
# Force a full sync
node backend/lambda/src/jobs/opensearch-sync.js --full-sync --verbose

# Check if data exists in OpenSearch
curl -XGET "https://your-opensearch-endpoint/warmpawz-vendors/_search?q=business_name:test&pretty"
```

---

## 💰 COST ESTIMATION

### **OpenSearch Cluster Costs** (ap-south-1, Mumbai)

| Configuration | Monthly Cost (USD) | Use Case |
|--------------|-------------------|----------|
| t3.small.search (2 nodes, 20GB each) | **~$80** | Development/Staging |
| t3.medium.search (2 nodes, 40GB each) | **~$160** | Small production (<10K vendors) |
| m6g.large.search (3 nodes, 100GB each) | **~$600** | Medium production (<100K vendors) |
| r6g.xlarge.search (3 nodes, 200GB each) | **~$1,500** | Large production (>100K vendors) |

**SQL Fallback**: **$0** (already included in RDS costs)

---

## 🎯 RECOMMENDATION

### **Phase 1: Launch (Weeks 1-4)**
✅ **Use SQL fallback only**  
- Zero additional cost
- Adequate performance for initial scale (<5,000 vendors)
- Focus budget on core infrastructure

### **Phase 2: Growth (Months 2-6)**
✅ **Deploy t3.small OpenSearch**  
- ~$80/month
- Improved search latency (10x faster)
- Fuzzy search, autocomplete features
- Scale as needed

### **Phase 3: Scale (Month 7+)**
✅ **Upgrade to m6g.large or higher**  
- Based on actual usage metrics
- Add Read Replicas for high availability
- Implement Redis caching layer

---

## 📚 ADDITIONAL RESOURCES

- **AWS OpenSearch Documentation**: https://docs.aws.amazon.com/opensearch-service/
- **CDK OpenSearch Construct**: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_opensearchservice-readme.html
- **PostgreSQL Full-Text Search**: https://www.postgresql.org/docs/current/textsearch.html
- **Performance Tuning**: See `PERFORMANCE_OPTIMIZATION.md`

---

**Last Updated**: January 2, 2026  
**Status**: ✅ Fallback Ready | ⚠️  OpenSearch Optional

