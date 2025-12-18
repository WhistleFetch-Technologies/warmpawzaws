# Monitoring Setup Guide

## 📊 Payment Flow Monitoring

### 1. Supabase Logs

Monitor Edge Function logs for payment-related events:

```bash
# View real-time logs
supabase functions logs make-server-3dd53475 --follow

# Filter for payment events
supabase functions logs make-server-3dd53475 | grep -i payment
supabase functions logs make-server-3dd53475 | grep -i webhook
```

### 2. Key Metrics to Track

#### Payment Metrics
- Payment success rate
- Payment failure rate
- Average payment processing time
- Refund processing time
- Webhook delivery success rate

#### Booking Metrics
- Booking creation success rate
- Booking cancellation rate
- Average booking value
- Booking completion rate

#### Error Metrics
- Payment API errors
- Webhook verification failures
- Booking creation failures
- Refund processing errors

### 3. Alert Thresholds

Set up alerts for:
- Payment failure rate > 5%
- Webhook delivery failures
- Refund processing time > 24 hours
- Booking creation failures > 1%

### 4. Dashboard Queries

#### Payment Success Rate
```sql
-- Count successful payments (if using database)
SELECT 
  DATE(created_at) as date,
  COUNT(*) FILTER (WHERE status = 'completed') as successful,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed') / COUNT(*), 2) as success_rate
FROM payments
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

#### Daily Revenue
```sql
SELECT 
  DATE(created_at) as date,
  SUM(amount) FILTER (WHERE status = 'completed') as revenue,
  COUNT(*) FILTER (WHERE status = 'completed') as bookings
FROM payments
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### 5. Razorpay Dashboard

Monitor directly in Razorpay:
- Go to Razorpay Dashboard → Payments
- View payment analytics
- Check webhook delivery status
- Monitor refund status

### 6. Error Tracking

#### Set up Error Logging

Create error tracking in your Supabase function:

```typescript
// In your error handlers
try {
  // ... code
} catch (error: any) {
  // Log to Supabase logs
  console.error('Payment error:', {
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    bookingId,
    amount,
  });

  // Optionally send to external service (Sentry, etc.)
  // await sendToErrorTracking(error);
}
```

### 7. Webhook Monitoring

Monitor webhook delivery:
1. Razorpay Dashboard → Settings → Webhooks
2. Check delivery logs
3. Monitor response times
4. Check for failures

### 8. Health Check Endpoint

Create a health check endpoint:

```typescript
app.get('/make-server-3dd53475/health', async (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      razorpay: 'connected', // Check Razorpay connectivity
      database: 'connected', // Check KV store connectivity
    },
  });
});
```

### 9. Monitoring Tools

Recommended tools:
- **Supabase Dashboard**: Built-in logs and metrics
- **Razorpay Dashboard**: Payment analytics
- **Sentry**: Error tracking (optional)
- **Datadog/New Relic**: APM (optional)

### 10. Daily Monitoring Checklist

- [ ] Check payment success rate
- [ ] Review error logs
- [ ] Verify webhook deliveries
- [ ] Check refund processing status
- [ ] Monitor API response times
- [ ] Review failed bookings

---

## 📈 Key Performance Indicators (KPIs)

### Payment KPIs
- Payment success rate: Target > 95%
- Payment processing time: Target < 5 seconds
- Refund processing time: Target < 24 hours
- Webhook delivery success: Target > 99%

### Booking KPIs
- Booking creation success: Target > 99%
- Booking completion rate: Target > 80%
- Average booking value: Track trend
- Cancellation rate: Target < 10%

---

## 🚨 Alert Configuration

### Critical Alerts (Immediate Action Required)
- Payment processing down
- Webhook verification failures
- Refund processing errors
- Database connectivity issues

### Warning Alerts (Review Required)
- Payment success rate < 90%
- High error rate (> 5%)
- Slow API responses (> 5s)

---

## 📝 Monitoring Best Practices

1. **Set up alerts early**: Configure before launch
2. **Monitor continuously**: Check logs daily
3. **Track trends**: Watch for gradual degradation
4. **Review weekly**: Weekly review of metrics
5. **Act on alerts**: Respond to issues promptly

---

**Last Updated**: Current Session

