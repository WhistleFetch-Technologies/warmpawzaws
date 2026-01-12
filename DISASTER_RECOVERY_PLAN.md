# 🚨 DISASTER RECOVERY PLAN
## Warmpawz Platform - Production Disaster Recovery Procedures

**Date:** January 2, 2026  
**Version:** 1.0  
**Status:** DRAFT - Requires Review and Testing

---

## 📋 TABLE OF CONTENTS

1. [Overview](#overview)
2. [Recovery Objectives](#recovery-objectives)
3. [Disaster Scenarios](#disaster-scenarios)
4. [Recovery Procedures](#recovery-procedures)
5. [Communication Plan](#communication-plan)
6. [Testing & Validation](#testing--validation)

---

## 1️⃣ OVERVIEW

### Purpose

This document outlines the disaster recovery procedures for the Warmpawz platform. It provides step-by-step instructions for recovering from various disaster scenarios.

### Scope

This plan covers:
- **Infrastructure:** AWS Lambda, API Gateway, RDS, S3, CloudFront, Cognito
- **Applications:** Admin Web, Vendor Web, Customer Web, Mobile Apps
- **Data:** PostgreSQL database, S3 files
- **External Services:** Razorpay, Shiprocket, Google Maps, AWS Bedrock

### Assumptions

- AWS infrastructure is the primary deployment platform
- Database backups are automated and tested
- Infrastructure as Code (Terraform/CDK) is maintained
- Team has AWS console access
- External service credentials are stored in AWS Secrets Manager

---

## 2️⃣ RECOVERY OBJECTIVES

### Recovery Time Objectives (RTO)

| Component | RTO | Priority |
|-----------|-----|----------|
| **API Gateway** | 15 minutes | Critical |
| **Lambda Functions** | 15 minutes | Critical |
| **Database** | 1 hour | Critical |
| **Frontend Apps** | 30 minutes | High |
| **S3 Storage** | 2 hours | Medium |
| **External Integrations** | 4 hours | Medium |

### Recovery Point Objectives (RPO)

| Component | RPO | Notes |
|-----------|-----|-------|
| **Database** | 5 minutes | Automated backups every 5 minutes |
| **S3 Files** | 1 hour | Versioning enabled |
| **Configuration** | 0 minutes | Infrastructure as Code |

---

## 3️⃣ DISASTER SCENARIOS

### Scenario 1: Database Failure

**Symptoms:**
- API returns 500 errors
- Database connection errors in logs
- RDS instance shows as "failed" or "deleted"

**Impact:** CRITICAL - Complete system outage

**Recovery Procedure:** See [Section 4.1](#41-database-recovery)

---

### Scenario 2: Lambda Function Failure

**Symptoms:**
- Specific API endpoints return 500 errors
- Lambda function shows as "failed" in CloudWatch
- No function logs appearing

**Impact:** HIGH - Partial system outage

**Recovery Procedure:** See [Section 4.2](#42-lambda-recovery)

---

### Scenario 3: API Gateway Failure

**Symptoms:**
- All API calls fail
- API Gateway shows errors in console
- CloudWatch metrics show 0 requests

**Impact:** CRITICAL - Complete API outage

**Recovery Procedure:** See [Section 4.3](#43-api-gateway-recovery)

---

### Scenario 4: Region-Wide AWS Outage

**Symptoms:**
- All AWS services unavailable in ap-south-1
- Cannot access AWS Console
- All services down

**Impact:** CRITICAL - Complete platform outage

**Recovery Procedure:** See [Section 4.4](#44-region-wide-outage-recovery)

---

### Scenario 5: S3 Storage Failure

**Symptoms:**
- File uploads fail
- Images/files not loading
- S3 bucket shows errors

**Impact:** MEDIUM - Feature degradation

**Recovery Procedure:** See [Section 4.5](#45-s3-recovery)

---

### Scenario 6: Security Breach

**Symptoms:**
- Unusual API activity
- Unauthorized access detected
- Credentials compromised

**Impact:** CRITICAL - Security risk

**Recovery Procedure:** See [Section 4.6](#46-security-breach-recovery)

---

## 4️⃣ RECOVERY PROCEDURES

### 4.1 Database Recovery

#### **Procedure: Restore from Automated Backup**

**Prerequisites:**
- AWS Console access
- RDS backup available
- Team on-call contact

**Steps:**

1. **Assess the Situation**
   ```bash
   # Check RDS instance status
   aws rds describe-db-instances \
     --db-instance-identifier warmpawz-prod-cluster \
     --region ap-south-1
   ```

2. **Identify Latest Backup**
   ```bash
   # List available backups
   aws rds describe-db-snapshots \
     --db-instance-identifier warmpawz-prod-cluster \
     --region ap-south-1 \
     --query 'DBSnapshots[*].[DBSnapshotIdentifier,SnapshotCreateTime]' \
     --output table
   ```

3. **Restore from Snapshot**
   ```bash
   # Restore from latest snapshot
   aws rds restore-db-instance-from-db-snapshot \
     --db-instance-identifier warmpawz-prod-cluster-restored \
     --db-snapshot-identifier <snapshot-identifier> \
     --region ap-south-1
   ```

4. **Update Lambda Environment Variables**
   - Update `DATABASE_URL` in Lambda environment variables
   - Use AWS Secrets Manager ARN for new instance

5. **Verify Database Connectivity**
   ```bash
   # Test connection
   psql $DATABASE_URL -c "SELECT version();"
   ```

6. **Update DNS/Endpoints**
   - Update application configuration if needed
   - Verify Lambda can connect to new database

**Estimated Recovery Time:** 30-60 minutes

**Rollback:** If restoration fails, use point-in-time recovery (if enabled)

---

### 4.2 Lambda Recovery

#### **Procedure: Redeploy Lambda Functions**

**Prerequisites:**
- GitHub Actions access or AWS Console access
- Lambda deployment package available

**Steps:**

1. **Identify Failed Function**
   ```bash
   # Check Lambda function status
   aws lambda get-function \
     --function-name warmpawz-prod-api-handler \
     --region ap-south-1
   ```

2. **Redeploy Function**
   ```bash
   # Option 1: Trigger GitHub Actions deployment
   gh workflow run "🚀 Deploy to Production" --ref main
   
   # Option 2: Manual deployment
   cd backend/lambda
   npm run build
   aws lambda update-function-code \
     --function-name warmpawz-prod-api-handler \
     --zip-file fileb://api-handler.zip \
     --region ap-south-1
   ```

3. **Verify Function Health**
   ```bash
   # Test function
   aws lambda invoke \
     --function-name warmpawz-prod-api-handler \
     --payload '{"path":"/health","httpMethod":"GET"}' \
     response.json
   ```

**Estimated Recovery Time:** 5-15 minutes

---

### 4.3 API Gateway Recovery

#### **Procedure: Verify and Redeploy API Gateway**

**Steps:**

1. **Check API Gateway Status**
   ```bash
   # List APIs
   aws apigatewayv2 get-apis --region ap-south-1
   ```

2. **Check Stage Configuration**
   ```bash
   # Get stage details
   aws apigatewayv2 get-stage \
     --api-id <api-id> \
     --stage-name $default \
     --region ap-south-1
   ```

3. **Redeploy API Gateway (if needed)**
   ```bash
   # Redeploy via CDK/Terraform
   cd infrastructure/cdk
   npm run cdk deploy ApiGatewayStack -- --context environment=prod
   ```

4. **Verify API Endpoints**
   ```bash
   # Test health endpoint
   curl https://api.warmpawz.com/health
   ```

**Estimated Recovery Time:** 10-20 minutes

---

### 4.4 Region-Wide Outage Recovery

#### **Procedure: Failover to Secondary Region (Future Enhancement)**

**Current Status:** ⚠️ **NOT CONFIGURED**

**Required Actions:**
1. Set up multi-region infrastructure
2. Configure database replication
3. Set up CloudFront multi-region origins
4. Configure Route 53 health checks

**Temporary Workaround:**
- Wait for AWS to restore services
- Monitor AWS status page
- Communicate with users about downtime

**Estimated Recovery Time:** 2-4 hours (until AWS restores)

---

### 4.5 S3 Recovery

#### **Procedure: Restore from Versioning**

**Steps:**

1. **Check Bucket Status**
   ```bash
   # List bucket contents
   aws s3 ls s3://warmpawz-prod-storage --recursive
   ```

2. **Restore from Versioning (if enabled)**
   ```bash
   # List object versions
   aws s3api list-object-versions \
     --bucket warmpawz-prod-storage \
     --prefix <object-path>
   
   # Restore previous version
   aws s3api restore-object \
     --bucket warmpawz-prod-storage \
     --key <object-path> \
     --version-id <version-id>
   ```

3. **Verify File Access**
   ```bash
   # Test file access
   curl https://storage.warmpawz.com/<file-path>
   ```

**Estimated Recovery Time:** 30-60 minutes

---

### 4.6 Security Breach Recovery

#### **Procedure: Immediate Security Response**

**Steps:**

1. **Immediate Actions (First 5 minutes)**
   - Rotate all AWS access keys
   - Rotate database passwords
   - Rotate external service credentials (Razorpay, etc.)
   - Revoke compromised Cognito tokens (if applicable)

2. **Assess the Breach**
   - Review CloudWatch logs for suspicious activity
   - Check API Gateway access logs
   - Review database audit logs (if enabled)
   - Identify scope of compromise

3. **Contain the Breach**
   - Disable affected Lambda functions (if needed)
   - Restrict API Gateway access (rate limiting)
   - Block suspicious IP addresses (WAF rules)
   - Isolate affected resources

4. **Restore Services**
   - Deploy clean Lambda functions
   - Verify database integrity
   - Reset user passwords (if user data compromised)
   - Re-enable services gradually

5. **Post-Incident Review**
   - Document the incident
   - Identify root cause
   - Implement preventive measures
   - Update security procedures

**Estimated Recovery Time:** 2-4 hours

---

## 5️⃣ COMMUNICATION PLAN

### Internal Communication

**On-Call Escalation:**
1. **Level 1:** DevOps Engineer (First 15 minutes)
2. **Level 2:** Senior Engineer (After 30 minutes)
3. **Level 3:** Engineering Lead (After 1 hour)
4. **Level 4:** CTO (After 2 hours)

**Communication Channels:**
- **Primary:** Slack #incidents channel
- **Secondary:** Phone/SMS for critical issues
- **Status Page:** Update status.warmpawz.com

### External Communication

**User Communication:**
- **Status Page:** Update status page with incident details
- **Email:** Send notification to affected users (if user data impacted)
- **Social Media:** Post updates on Twitter/LinkedIn

**Template for Status Update:**
```
We're currently experiencing [issue description] affecting [affected services].
Our team is working on resolving this issue. Estimated resolution time: [time].
We'll provide updates every [frequency]. Thank you for your patience.
```

---

## 6️⃣ TESTING & VALIDATION

### Recovery Testing Schedule

| Test Type | Frequency | Next Test Date |
|-----------|-----------|----------------|
| **Database Restore Test** | Quarterly | TBD |
| **Lambda Redeployment Test** | Monthly | TBD |
| **Full Disaster Recovery Drill** | Annually | TBD |

### Testing Procedures

1. **Database Restore Test**
   - Create test snapshot
   - Restore to test instance
   - Verify data integrity
   - Test application connectivity

2. **Lambda Redeployment Test**
   - Deploy to test environment
   - Verify all endpoints work
   - Test error handling
   - Verify logs and metrics

3. **Full DR Drill**
   - Simulate disaster scenario
   - Execute recovery procedures
   - Measure recovery time
   - Document lessons learned

### Validation Checklist

After recovery, verify:
- [ ] All API endpoints responding
- [ ] Database connectivity working
- [ ] File uploads/downloads working
- [ ] Authentication working
- [ ] External integrations working (payments, etc.)
- [ ] Monitoring and alerts working
- [ ] Logs being generated correctly

---

## 7️⃣ APPENDIX

### A. Contact Information

**On-Call Rotation:**
- See internal on-call schedule

**AWS Support:**
- Business Support: [contact-info]
- Technical Account Manager: [contact-info]

**External Service Support:**
- Razorpay Support: support@razorpay.com
- Shiprocket Support: support@shiprocket.in

### B. Useful Commands

**Database:**
```bash
# Check database status
aws rds describe-db-instances --db-instance-identifier warmpawz-prod-cluster

# List backups
aws rds describe-db-snapshots --db-instance-identifier warmpawz-prod-cluster
```

**Lambda:**
```bash
# Check function status
aws lambda get-function --function-name warmpawz-prod-api-handler

# View recent logs
aws logs tail /aws/lambda/warmpawz-prod-api-handler --follow
```

**API Gateway:**
```bash
# List APIs
aws apigatewayv2 get-apis

# Check stage
aws apigatewayv2 get-stage --api-id <api-id> --stage-name $default
```

### C. Backup Locations

**Database Backups:**
- Location: AWS RDS automated backups
- Retention: 7 days
- Point-in-time recovery: Enabled (if configured)

**S3 Backups:**
- Location: Same region (ap-south-1)
- Versioning: Enabled
- Cross-region replication: Not configured (future enhancement)

**Infrastructure:**
- Location: GitHub repository
- Backup: Git history + Infrastructure as Code
- Recovery: Redeploy via Terraform/CDK

---

## ✅ REVIEW & MAINTENANCE

**Last Reviewed:** January 2, 2026  
**Next Review:** April 2, 2026  
**Reviewer:** [To be assigned]

**Change Log:**
- 2026-01-02: Initial draft created

---

**IMPORTANT:** This plan should be reviewed and tested regularly. Update contact information, procedures, and test results as needed.
