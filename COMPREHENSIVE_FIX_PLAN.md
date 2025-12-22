# Comprehensive Fix Plan - Service Management & CRM Issues

## Issues Identified

1. **Service Management Persistence**
   - Services saved to KV store, not SQL
   - Changes don't persist properly
   - No "live" status indicator

2. **Service Publishing Workflow**
   - No approval workflow for custom services
   - Standard services should auto-publish
   - Missing "live" green flag indicator

3. **Staff Service Enablement**
   - Center services not available for staff to enable
   - Staff can't see/enable center-level services

4. **Service Discovery**
   - Universal service discovery vs booking flow dispatcher confusion
   - Services not appearing on customer app

5. **CRM & Analytics**
   - Complete CRM with analytics not visible
   - Missing actions and wireframe

6. **Pet Information System**
   - Not visible on UI

7. **AI Chat Integration**
   - Missing on customer app for support

## Fix Strategy

### Phase 1: SQL Database Schema
- Create proper service tables
- Add status/publishing fields
- Add approval workflow fields

### Phase 2: Service Management Migration
- Migrate service CRUD to SQL
- Add live status tracking
- Implement approval workflow

### Phase 3: Staff Service Enablement
- Allow staff to enable center services
- Exclude custom services and packages

### Phase 4: Service Discovery Fix
- Ensure services appear in customer app
- Fix universal service discovery

### Phase 5: UI Updates
- Add live status indicators
- Fix CRM visibility
- Fix Pet Information visibility

