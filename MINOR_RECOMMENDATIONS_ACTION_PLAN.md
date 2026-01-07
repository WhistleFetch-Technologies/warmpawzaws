# 📋 MINOR RECOMMENDATIONS ACTION PLAN
## Production Enhancement Guide

**Date:** January 2026  
**Status:** Action Items for Production Optimization  
**Priority:** Medium (Non-blocking, but recommended)

---

## 🎯 EXECUTIVE SUMMARY

This document addresses the 3 minor recommendations identified in the comprehensive codebase analysis:

1. **Runtime Verification of Video Calling** - Code complete, needs AWS Chime SDK integration
2. **Optional OpenSearch Deployment** - SQL fallback works, but OpenSearch improves performance
3. **Load Testing Before Production** - Test scripts exist, need execution

**Impact:** All items are non-blocking but will improve production readiness and performance.

---

## 1️⃣ VIDEO CALLING RUNTIME VERIFICATION

### Current Status
- ✅ Backend endpoints complete (`backend/lambda/src/endpoints/video-call.ts`)
- ✅ AWS Chime SDK integrated in backend
- ⚠️ Frontend needs AWS Chime SDK initialization
- ⚠️ Web UI has TODO comments for Chime SDK integration

### Issues Identified

#### Issue 1: Web App Video Call Component
**File:** `apps/customer-web/components/customer/booking/VideoCallView.tsx`

**Problems:**
- Line 54: `// TODO: Initialize AWS Chime SDK here`
- Line 70: `// TODO: Implement actual mute/unmute with Chime SDK`
- Line 75: `// TODO: Implement actual video toggle with Chime SDK`
- Currently simulates connection with `setTimeout`

**Fix Required:**
1. Install AWS Chime SDK for JavaScript
2. Initialize Chime SDK with meeting credentials
3. Implement audio/video controls
4. Handle connection states

#### Issue 2: Mobile App Video Call
**File:** `apps/WarmpawzCustomer/src/screens/consultation/VideoConsultationScreen.tsx`

**Status:** Uses CallApi but needs WebRTC integration verification

### Action Plan

#### Step 1: Install AWS Chime SDK Dependencies

```bash
# Web apps
cd apps/customer-web
npm install amazon-chime-sdk-js

cd apps/vendor-web
npm install amazon-chime-sdk-js

# Mobile apps (React Native)
cd apps/WarmpawzCustomer
npm install react-native-webrtc amazon-chime-sdk-js

cd apps/WarmpawzVendor
npm install react-native-webrtc amazon-chime-sdk-js
```

#### Step 2: Create Chime SDK Wrapper

**File:** `apps/customer-web/lib/chime-sdk.ts`

```typescript
import {
  DefaultMeetingSession,
  MeetingSessionConfiguration,
  AudioVideoFacade,
  DefaultDeviceController,
  DefaultMeetingSession,
} from 'amazon-chime-sdk-js';

export interface ChimeMeetingInfo {
  meetingId: string;
  attendeeId: string;
  joinToken: string;
  mediaRegion: string;
}

export class ChimeSDKManager {
  private meetingSession: DefaultMeetingSession | null = null;
  private audioVideo: AudioVideoFacade | null = null;

  async initialize(meetingInfo: ChimeMeetingInfo): Promise<void> {
    const configuration = new MeetingSessionConfiguration(
      {
        MeetingId: meetingInfo.meetingId,
        MediaRegion: meetingInfo.mediaRegion,
        ExternalMeetingId: meetingInfo.meetingId,
      },
      {
        AttendeeId: meetingInfo.attendeeId,
        JoinToken: meetingInfo.joinToken,
        ExternalUserId: meetingInfo.attendeeId,
      }
    );

    const deviceController = new DefaultDeviceController(
      new DefaultDeviceController(logger)
    );

    this.meetingSession = new DefaultMeetingSession(
      configuration,
      logger,
      deviceController
    );

    this.audioVideo = this.meetingSession.audioVideo;
  }

  async startLocalVideo(videoElement: HTMLVideoElement): Promise<void> {
    if (!this.audioVideo) throw new Error('Not initialized');
    
    await this.audioVideo.startLocalVideoTile();
    this.audioVideo.bindVideoElement(0, videoElement);
  }

  async startRemoteVideo(videoElement: HTMLVideoElement): Promise<void> {
    if (!this.audioVideo) throw new Error('Not initialized');
    
    this.audioVideo.observeVideoTiles((tile: VideoTile) => {
      if (tile.boundVideoElement) {
        videoElement.srcObject = tile.boundVideoElement.srcObject;
      }
    });
  }

  async toggleMute(): Promise<boolean> {
    if (!this.audioVideo) throw new Error('Not initialized');
    
    const isMuted = !this.audioVideo.realtimeIsLocalAudioMuted();
    this.audioVideo.realtimeMuteLocalAudio(isMuted);
    return isMuted;
  }

  async toggleVideo(): Promise<boolean> {
    if (!this.audioVideo) throw new Error('Not initialized');
    
    const isVideoEnabled = this.audioVideo.hasStartedLocalVideoTile();
    if (isVideoEnabled) {
      this.audioVideo.stopLocalVideoTile();
    } else {
      await this.audioVideo.startLocalVideoTile();
    }
    return !isVideoEnabled;
  }

  async endCall(): Promise<void> {
    if (this.audioVideo) {
      this.audioVideo.stop();
    }
    this.meetingSession = null;
    this.audioVideo = null;
  }
}
```

#### Step 3: Update VideoCallView Component

**File:** `apps/customer-web/components/customer/booking/VideoCallView.tsx`

**Replace TODO sections:**

```typescript
import { ChimeSDKManager } from '@/lib/chime-sdk';
import { apiClient } from '@/lib/api-client';

// Add state
const [chimeManager, setChimeManager] = useState<ChimeSDKManager | null>(null);
const localVideoRef = useRef<HTMLVideoElement>(null);
const remoteVideoRef = useRef<HTMLVideoElement>(null);

// Update initializeCall
const initializeCall = async () => {
  try {
    setLoading(true);
    const response = await apiClient.get<{
      meeting_id: string;
      attendee_info: any;
    }>(`/video-call/${bookingId}/meeting-info`);

    if (response.meeting_id) {
      setMeetingInfo(response);
      
      // Initialize Chime SDK
      const manager = new ChimeSDKManager();
      await manager.initialize({
        meetingId: response.meeting_id,
        attendeeId: response.attendee_info.attendee_id,
        joinToken: response.attendee_info.join_token,
        mediaRegion: response.attendee_info.media_region || 'ap-south-1',
      });
      
      setChimeManager(manager);
      
      // Start video
      if (localVideoRef.current) {
        await manager.startLocalVideo(localVideoRef.current);
      }
      if (remoteVideoRef.current) {
        await manager.startRemoteVideo(remoteVideoRef.current);
      }
      
      setIsConnected(true);
      setLoading(false);
    }
  } catch (err: any) {
    console.error('Error initializing video call:', err);
    setError(err.message || 'Failed to initialize video call');
    setLoading(false);
  }
};

// Update toggleMute
const toggleMute = async () => {
  if (chimeManager) {
    const newMuted = await chimeManager.toggleMute();
    setIsMuted(newMuted);
  }
};

// Update toggleVideo
const toggleVideo = async () => {
  if (chimeManager) {
    const newVideoOff = await chimeManager.toggleVideo();
    setIsVideoOff(newVideoOff);
  }
};

// Update endCall
const endCall = async () => {
  try {
    if (chimeManager) {
      await chimeManager.endCall();
    }
    await apiClient.post(`/video-call/${bookingId}/end`, {});
    setIsConnected(false);
    onEndCall?.();
  } catch (err) {
    console.error('Error ending call:', err);
  }
};
```

#### Step 4: Testing Checklist

- [ ] Create test booking with tele consultation service
- [ ] Initiate video call from customer app
- [ ] Verify meeting creation in backend
- [ ] Verify video streams (local and remote)
- [ ] Test mute/unmute functionality
- [ ] Test video on/off functionality
- [ ] Test call end functionality
- [ ] Verify meeting cleanup in database
- [ ] Test error handling (network failures)
- [ ] Test on different browsers (Chrome, Safari, Firefox)

### Estimated Time: 4-6 hours

---

## 2️⃣ OPENSEARCH DEPLOYMENT (OPTIONAL)

### Current Status
- ✅ OpenSearch client implemented with fallback
- ✅ SQL fallback works perfectly
- ⚠️ OpenSearch not deployed (optional enhancement)

### Benefits of Deploying OpenSearch
- **Performance:** 10-50ms search latency vs 50-200ms SQL
- **Features:** Fuzzy search, autocomplete, faceted search
- **Scalability:** Better performance at scale

### Action Plan

#### Step 1: Deploy OpenSearch Cluster

**Option A: Using Terraform**

**File:** `infra/modules/opensearch/main.tf` (already exists)

```bash
cd infra/envs/dev
terraform init
terraform plan -target=module.opensearch
terraform apply -target=module.opensearch
```

**Option B: Using AWS CDK**

**File:** `infrastructure/cdk/lib/opensearch-stack.ts` (create if needed)

```typescript
import * as opensearch from 'aws-cdk-lib/aws-opensearchservice';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export class OpenSearchStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const domain = new opensearch.Domain(this, 'WarmpawzSearch', {
      version: opensearch.EngineVersion.OPENSEARCH_2_11,
      capacity: {
        dataNodes: 2,
        dataNodeInstanceType: 't3.small.search',
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
      accessPolicies: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          principals: [props.lambdaRole],
          actions: ['es:*'],
          resources: ['*'],
        }),
      ],
    });

    new cdk.CfnOutput(this, 'OpenSearchEndpoint', {
      value: domain.domainEndpoint,
    });
  }
}
```

#### Step 2: Create Indexes

**File:** `backend/lambda/scripts/create-opensearch-indexes.ts`

```typescript
import { getOpenSearchClient, INDEXES } from '../src/utils/opensearch-client';

async function createIndexes() {
  const client = getOpenSearchClient();
  
  // Create services index
  await client.indices.create({
    index: INDEXES.SERVICES,
    body: {
      mappings: {
        properties: {
          id: { type: 'keyword' },
          name: { type: 'text', analyzer: 'standard' },
          description: { type: 'text', analyzer: 'standard' },
          category: { type: 'keyword' },
          service_style: { type: 'keyword' },
          vendor_id: { type: 'keyword' },
          vendor_name: { type: 'text' },
          price: { type: 'float' },
          location: { type: 'geo_point' },
          is_active: { type: 'boolean' },
        },
      },
    },
  });
  
  // Create vendors index
  await client.indices.create({
    index: INDEXES.VENDORS,
    body: {
      mappings: {
        properties: {
          id: { type: 'keyword' },
          business_name: { type: 'text', analyzer: 'standard' },
          description: { type: 'text', analyzer: 'standard' },
          location: { type: 'geo_point' },
          rating: { type: 'float' },
          is_active: { type: 'boolean' },
        },
      },
    },
  });
  
  console.log('✅ OpenSearch indexes created');
}

createIndexes().catch(console.error);
```

#### Step 3: Sync Data from RDS to OpenSearch

**File:** `backend/lambda/jobs/opensearch-sync.ts` (already exists)

Run initial sync:

```bash
cd backend/lambda
npm run sync-opensearch
```

#### Step 4: Update Environment Variables

```bash
# Add to Lambda environment variables
OPENSEARCH_ENDPOINT=https://search-warmpawz-xxxxx.ap-south-1.es.amazonaws.com
ENABLE_OPENSEARCH=true
```

#### Step 5: Testing Checklist

- [ ] Verify OpenSearch cluster is accessible
- [ ] Create indexes successfully
- [ ] Sync initial data from RDS
- [ ] Test search endpoint with OpenSearch
- [ ] Verify fallback to SQL if OpenSearch fails
- [ ] Monitor OpenSearch performance
- [ ] Set up CloudWatch alarms for OpenSearch

### Estimated Time: 2-3 hours

### Cost Consideration
- **t3.small.search:** ~$0.036/hour = ~$26/month per node
- **2 nodes:** ~$52/month
- **Storage:** ~$0.10/GB/month
- **Total:** ~$60-80/month for dev environment

**Recommendation:** Deploy to staging first, then production if performance benefits are proven.

---

## 3️⃣ LOAD TESTING BEFORE PRODUCTION

### Current Status
- ✅ Load test scripts exist (`tests/load-testing/`)
- ✅ K6 and Artillery configurations ready
- ⚠️ Tests not yet executed

### Action Plan

#### Step 1: Install Load Testing Tools

```bash
# Install K6 (recommended)
brew install k6  # macOS
# or
sudo apt install k6  # Linux

# Install Artillery (alternative)
npm install -g artillery
```

#### Step 2: Configure Test Environment

**File:** `tests/load-testing/.env.example`

```bash
API_BASE_URL=https://staging-api.warmpawz.com
API_KEY=your-api-key-here
TEST_DURATION=5m
VUS=100
```

#### Step 3: Run Load Tests

**Basic Test:**
```bash
cd tests/load-testing
k6 run k6-load-test.js
```

**Custom Load:**
```bash
# 100 virtual users for 5 minutes
k6 run --vus 100 --duration 5m k6-load-test.js

# Spike test: 0→500→0 users
k6 run --vus 0 --duration 1m k6-spike-test.js
k6 run --vus 500 --duration 2m k6-spike-test.js
k6 run --vus 0 --duration 1m k6-spike-test.js
```

**Generate Report:**
```bash
k6 run --out json=results.json k6-load-test.js
k6 run --out influxdb=http://localhost:8086/k6 k6-load-test.js
```

#### Step 4: Performance Targets

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| P50 Latency | < 100ms | < 200ms |
| P95 Latency | < 300ms | < 500ms |
| P99 Latency | < 800ms | < 1000ms |
| Error Rate | < 0.1% | < 1% |
| Throughput | > 200 req/s | > 100 req/s |

#### Step 5: Test Scenarios

**Scenario 1: Normal Load**
- 100 concurrent users
- 5-minute duration
- Realistic user behavior (40% discovery, 30% vendor, 20% location, 5% payment, 5% admin)

**Scenario 2: Peak Load**
- 500 concurrent users
- 10-minute duration
- Simulate lunch/evening peak hours

**Scenario 3: Spike Test**
- 0→1000→0 users
- Test auto-scaling capabilities

**Scenario 4: Stress Test**
- Gradually increase to 2000 users
- Find breaking point

#### Step 6: Monitor During Tests

```bash
# Terminal 1: Run load test
k6 run k6-load-test.js

# Terminal 2: Monitor CloudWatch
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=warmpawz-api \
  --start-time 2026-01-01T00:00:00Z \
  --end-time 2026-01-01T01:00:00Z \
  --period 60 \
  --statistics Average,Maximum

# Terminal 3: Monitor RDS
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name CPUUtilization \
  --dimensions Name=DBInstanceIdentifier,Value=warmpawz-db \
  --start-time 2026-01-01T00:00:00Z \
  --end-time 2026-01-01T01:00:00Z \
  --period 60 \
  --statistics Average,Maximum
```

#### Step 7: Analyze Results

**Key Metrics to Review:**
1. **Response Times:**
   - P50, P95, P99 latencies
   - Identify slow endpoints

2. **Error Rates:**
   - 4xx errors (client errors)
   - 5xx errors (server errors)
   - Timeout errors

3. **Throughput:**
   - Requests per second
   - Successful vs failed requests

4. **Resource Utilization:**
   - Lambda duration and memory
   - RDS CPU and connections
   - API Gateway latency

#### Step 8: Optimization Based on Results

**If P95 latency > 300ms:**
- Optimize slow database queries
- Add caching (Redis/ElastiCache)
- Optimize Lambda cold starts

**If error rate > 0.1%:**
- Fix error-causing endpoints
- Add retry logic
- Increase Lambda timeout/memory

**If throughput < 200 req/s:**
- Scale Lambda concurrency
- Scale RDS instance
- Add read replicas

#### Step 9: Testing Checklist

- [ ] Install K6 or Artillery
- [ ] Configure test environment
- [ ] Run normal load test
- [ ] Run peak load test
- [ ] Run spike test
- [ ] Run stress test
- [ ] Analyze results
- [ ] Document findings
- [ ] Create optimization plan
- [ ] Re-test after optimizations

### Estimated Time: 4-6 hours

---

## 📊 PRIORITY MATRIX

| Recommendation | Priority | Impact | Effort | Status |
|----------------|----------|--------|--------|--------|
| Video Calling | Medium | High | 4-6h | ⚠️ Pending |
| OpenSearch | Low | Medium | 2-3h | ⚠️ Optional |
| Load Testing | High | High | 4-6h | ⚠️ Pending |

**Recommended Order:**
1. **Load Testing** (High priority, validates production readiness)
2. **Video Calling** (Medium priority, improves user experience)
3. **OpenSearch** (Low priority, optional performance enhancement)

---

## ✅ COMPLETION CRITERIA

### Video Calling
- [ ] AWS Chime SDK integrated in web apps
- [ ] Video streams working (local and remote)
- [ ] Audio controls working (mute/unmute)
- [ ] Video controls working (on/off)
- [ ] Tested on multiple browsers
- [ ] Error handling verified

### OpenSearch
- [ ] Cluster deployed
- [ ] Indexes created
- [ ] Data synced from RDS
- [ ] Search endpoint using OpenSearch
- [ ] Fallback to SQL verified
- [ ] Performance improvement measured

### Load Testing
- [ ] All test scenarios executed
- [ ] Performance targets met
- [ ] Issues identified and documented
- [ ] Optimizations implemented
- [ ] Re-testing completed
- [ ] Results documented

---

## 🚀 QUICK START

### For Video Calling:
```bash
cd apps/customer-web
npm install amazon-chime-sdk-js
# Follow Step 2-3 in section 1
```

### For OpenSearch:
```bash
cd infra/envs/dev
terraform apply -target=module.opensearch
cd ../../..
cd backend/lambda
npm run sync-opensearch
```

### For Load Testing:
```bash
brew install k6
cd tests/load-testing
k6 run k6-load-test.js
```

---

## 📝 NOTES

- All recommendations are **non-blocking** for production deployment
- SQL fallback ensures system works without OpenSearch
- Video calling can be deployed incrementally
- Load testing should be done before production launch

**Estimated Total Time:** 10-15 hours for all three recommendations

---

**Last Updated:** January 2026  
**Next Review:** After staging deployment

