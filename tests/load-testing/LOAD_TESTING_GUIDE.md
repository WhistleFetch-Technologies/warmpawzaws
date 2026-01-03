# 📈 LOAD TESTING GUIDE

Comprehensive guide for load testing the Warmpawz platform.

---

## 🎯 OBJECTIVES

1. **Validate Performance**: Ensure system meets SLA requirements
2. **Identify Bottlenecks**: Find performance issues before production
3. **Capacity Planning**: Determine infrastructure scaling needs
4. **Stability Testing**: Verify system stability under sustained load

---

## 📊 PERFORMANCE TARGETS (SLAs)

| Metric | Target | Critical Threshold |
|--------|--------|--------------------|
| **P50 Latency** | < 100ms | < 200ms |
| **P95 Latency** | < 300ms | < 500ms |
| **P99 Latency** | < 800ms | < 1000ms |
| **Error Rate** | < 0.1% | < 1% |
| **Throughput** | > 200 req/s | > 100 req/s |
| **Availability** | > 99.9% | > 99% |

---

## 🛠️ TOOL SELECTION

### **Option 1: K6 (Recommended)**

**Pros**:
- ✅ Modern, open-source, developer-friendly
- ✅ JavaScript-based (familiar to frontend devs)
- ✅ Excellent metrics and reporting
- ✅ Cloud integration (k6 Cloud)
- ✅ Real-time dashboard

**Installation**:
```bash
# macOS
brew install k6

# Linux
sudo apt install k6

# Windows
choco install k6
```

**Usage**:
```bash
# Run basic test
k6 run k6-load-test.js

# Custom VUs and duration
k6 run --vus 100 --duration 5m k6-load-test.js

# Save results to JSON
k6 run --out json=results.json k6-load-test.js

# Real-time dashboard
k6 run --out influxdb=http://localhost:8086/k6 k6-load-test.js

# Use environment variable for API URL
API_BASE_URL=https://staging-api.warmpawz.com k6 run k6-load-test.js
```

### **Option 2: Artillery**

**Pros**:
- ✅ Easy to configure with YAML
- ✅ Good for scenario-based testing
- ✅ Built-in reporting

**Installation**:
```bash
npm install -g artillery
```

**Usage**:
```bash
# Run test
artillery run artillery-config.yml

# Generate HTML report
artillery run --output report.json artillery-config.yml
artillery report report.json

# Custom target
API_BASE_URL=https://staging-api.warmpawz.com artillery run artillery-config.yml
```

---

## 🚀 QUICK START

### **1. Setup Environment**

```bash
# Clone repo
cd /Users/ketan/Documents/warmpawzecodev/tests/load-testing

# Install k6 (recommended)
brew install k6

# Set API URL (if testing non-production)
export API_BASE_URL=https://staging-api.warmpawz.com
```

### **2. Run Test**

```bash
# Start with small load
k6 run --vus 10 --duration 2m k6-load-test.js

# Gradually increase
k6 run --vus 50 --duration 5m k6-load-test.js

# Full production test
k6 run k6-load-test.js
```

### **3. Analyze Results**

```bash
# Example output:
✓ errors..............: 0.12%  ✓ 14   ✗ 11486
✓ http_req_duration...: avg=185ms  min=12ms  med=120ms  max=2.1s   p(90)=350ms p(95)=480ms
✓ http_req_failed.....: 0.12%  ✓ 14   ✗ 11486
✓ http_reqs...........: 11500  191.666/s
✓ api_calls...........: 11500  counter=11500
```

---

## 📋 TEST SCENARIOS

### **1. Customer Discovery Flow** (40% traffic)
- Search for services
- View vendor profile
- Check available slots
- Create booking
- Verify booking status

### **2. Vendor Dashboard Flow** (30% traffic)
- Load vendor dashboard
- View today's bookings
- Check services & staff
- View earnings

### **3. Location-Based Discovery** (20% traffic)
- Get service categories
- Find vendors near location
- Browse problem grid

### **4. Payment Flow** (5% traffic)
- Create payment order
- Verify payment

### **5. Admin Operations** (5% traffic)
- View pending vendors
- Check platform stats
- Manage roles

---

## 🎛️ TEST CONFIGURATIONS

### **Development Environment**

```bash
# Light load for development testing
k6 run --vus 5 --duration 1m k6-load-test.js
```

### **Staging Environment**

```bash
# Moderate load for pre-production
k6 run --vus 50 --duration 10m k6-load-test.js
```

### **Production (Pre-Launch)**

```bash
# Full production simulation
k6 run k6-load-test.js

# This runs:
# - 2 min warm-up (10 VUs)
# - 3 min ramp up (10→50 VUs)
# - 5 min sustained (50 VUs)
# - 2 min peak (100 VUs)
# - 1 min spike (200 VUs)
# - 1 min cool down (0 VUs)
# Total: ~14 minutes
```

### **Stress Testing**

```bash
# Test system limits
k6 run --vus 500 --duration 5m k6-load-test.js
```

### **Soak Testing** (24-hour stability test)

```bash
# Long-duration test to find memory leaks
k6 run --vus 50 --duration 24h k6-load-test.js
```

---

## 📊 MONITORING DURING TESTS

### **1. AWS CloudWatch**

Monitor these metrics in real-time:
- Lambda invocations & errors
- API Gateway 4xx/5xx responses
- RDS CPU & connections
- ELB request count & latency

**Dashboard**: `https://console.aws.amazon.com/cloudwatch/home?region=ap-south-1#dashboards:name=Warmpawz-Production`

### **2. Application Logs**

```bash
# Watch Lambda logs
aws logs tail /aws/lambda/warmpawz-api --follow

# Filter errors
aws logs tail /aws/lambda/warmpawz-api --follow --filter-pattern "ERROR"
```

### **3. Database Monitoring**

```bash
# Check RDS performance
aws rds describe-db-instances --db-instance-identifier warmpawz-prod

# Monitor connections
psql -h warmpawz-prod.xxxxx.ap-south-1.rds.amazonaws.com \
  -U admin -d warmpawz_prod \
  -c "SELECT count(*) FROM pg_stat_activity;"
```

---

## 🚨 TROUBLESHOOTING

### **Issue**: High error rate (> 1%)

**Possible Causes**:
1. Database connection pool exhausted
2. Lambda cold starts
3. API rate limiting
4. Network timeouts

**Solutions**:
```bash
# Check specific error types
k6 run --out json=results.json k6-load-test.js
jq '.metrics.http_req_failed.values' results.json

# Analyze CloudWatch logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/warmpawz-api \
  --filter-pattern "ERROR" \
  --start-time $(date -u -d '1 hour ago' +%s)000
```

### **Issue**: P95 latency > 500ms

**Solutions**:
1. Add RDS read replicas
2. Implement Redis caching
3. Optimize SQL queries (add indexes)
4. Increase Lambda memory (improves CPU)

```bash
# Check slow queries in RDS
psql -c "SELECT query, calls, mean_exec_time 
         FROM pg_stat_statements 
         ORDER BY mean_exec_time DESC 
         LIMIT 10;"
```

### **Issue**: Throughput < 100 req/s

**Solutions**:
1. Scale Lambda concurrency
2. Increase API Gateway throttle limits
3. Add CloudFront CDN
4. Optimize cold start times

---

## 📈 INTERPRETING RESULTS

### **Good Results** ✅

```
http_req_duration..: avg=150ms  p(95)=280ms  p(99)=450ms
http_req_failed....: 0.05%
http_reqs..........: 15000  250/s
```

**Action**: System is ready for production 🚀

### **Acceptable Results** ⚠️

```
http_req_duration..: avg=250ms  p(95)=480ms  p(99)=800ms
http_req_failed....: 0.8%
http_reqs..........: 12000  200/s
```

**Action**: Monitor closely, optimize if possible

### **Poor Results** ❌

```
http_req_duration..: avg=600ms  p(95)=1.2s  p(99)=3s
http_req_failed....: 5%
http_reqs..........: 6000  100/s
```

**Action**: DO NOT deploy. Investigate and fix issues.

---

## 🎯 RECOMMENDED TEST SCHEDULE

### **Pre-Launch** (Week before launch)
- Day -7: Initial load test (50 VUs)
- Day -5: Stress test (200 VUs)
- Day -3: Soak test (24 hours)
- Day -1: Final validation (100 VUs)

### **Post-Launch** (Monthly)
- Week 1: Baseline load test
- Week 3: Stress test (validate scaling)

### **Before Major Releases**
- Run full test suite on staging
- Compare results with previous baseline
- Ensure no performance regressions

---

## 📚 ADDITIONAL RESOURCES

- **K6 Documentation**: https://k6.io/docs/
- **Artillery Documentation**: https://www.artillery.io/docs
- **AWS Performance Best Practices**: https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/
- **Load Testing Best Practices**: https://martinfowler.com/articles/practical-test-pyramid.html

---

**Last Updated**: January 2, 2026  
**Next Test**: Before production launch

