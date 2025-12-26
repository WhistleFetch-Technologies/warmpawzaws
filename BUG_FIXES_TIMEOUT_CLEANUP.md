# Bug Fixes - Timeout Cleanup & State Management

## Issues Fixed

### Bug 1: Hardcoded 500ms Delay
**Problem**: Fixed 500ms delay assumes database write completes within that time, but on slower connections or high-load systems, the refetch might execute before the database transaction is fully committed, causing stale data.

**Fix**: 
- Use backend verification status (`data.verified`) to determine if immediate fetch is safe
- If verified: Fetch immediately (no delay)
- If not verified: Use exponential backoff retry (200ms → 500ms → 1000ms) instead of fixed delay
- This adapts to actual database write completion time

### Bug 2: State Update on Unmounted Component
**Problem**: The `setTimeout` callback captures `formConfig.roleId` and calls `fetchFormConfig()`, which may internally call `setState`. If the component unmounts before the timeout completes, this will attempt to set state on an unmounted component.

**Fix**:
- Added `isMountedRef` to track component mount state
- Check `isMountedRef.current` before all state updates
- Set `isMountedRef.current = false` in cleanup function
- All async operations check mount state before setting state

### Bug 3: Timeout Not Cleaned Up
**Problem**: The `setTimeout` scheduled is not cleaned up when the component unmounts. If the component unmounts before the timeout completes, the callback will still execute and may attempt to set state, causing React warnings.

**Fix**:
- Store timeout ID in `refetchTimeoutRef`
- Clear timeout in `useEffect` cleanup function
- Clear timeout before scheduling new one (prevents multiple timeouts)
- Check mount state before executing timeout callback

## Implementation Details

### 1. Added Refs for State Management
```typescript
const isMountedRef = useRef(true);
const refetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

### 2. Cleanup on Unmount
```typescript
useEffect(() => {
  fetchRoles();
  
  return () => {
    isMountedRef.current = false;
    if (refetchTimeoutRef.current) {
      clearTimeout(refetchTimeoutRef.current);
      refetchTimeoutRef.current = null;
    }
  };
}, []);
```

### 3. Smart Refetch Logic
```typescript
if (isVerified) {
  // Backend verified - fetch immediately
  refetchForm();
} else {
  // Use exponential backoff retry
  // 200ms → 500ms → 1000ms
}
```

### 4. Mount State Checks
All state updates are guarded:
```typescript
if (isMountedRef.current) {
  setFormConfig(config);
  setUnsavedChanges(false);
}
```

## Benefits

1. **No Stale Data**: Uses verification status to determine safe fetch time
2. **No Memory Leaks**: Timeouts are properly cleaned up
3. **No React Warnings**: State updates only happen on mounted components
4. **Adaptive**: Exponential backoff adapts to database write time
5. **Robust**: Handles component unmounting gracefully

## Testing

The fixes ensure:
- ✅ No state updates on unmounted components
- ✅ No memory leaks from uncleaned timeouts
- ✅ No stale data from premature fetches
- ✅ Proper cleanup on component unmount
- ✅ Adaptive retry mechanism for unverified saves

