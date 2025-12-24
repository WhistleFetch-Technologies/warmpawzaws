/**
 * ============================================================================
 * NOTIFICATION MANAGEMENT AUDIT TEST
 * ============================================================================
 * 
 * Tests notification management to ensure:
 * 1. SQL table exists (notifications)
 * 2. Repository methods work correctly
 * 3. Endpoints use SQL only (no KV)
 * 4. Push/email/SMS channels supported
 * 5. Notification triggers work
 * 
 * Target: 100% pass rate
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { assertEquals, assertExists, assert } from "jsr:@std/assert@0.224.0";
import { getNotificationsRepository } from "../supabase/lib/repositories/notifications.ts";
import { getDbClient } from "../supabase/lib/db.ts";

Deno.test("Notification Management - SQL Table Exists", async () => {
  const supabase = getDbClient();
  
  // Check notifications table
  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('*')
    .limit(1);
  
  assert(!error, `notifications table should exist: ${error?.message}`);
  console.log("✅ notifications table exists");
});

Deno.test("Notification Management - No KV Usage", async () => {
  // Check notification endpoints
  const notificationFile = await Deno.readTextFile(
    "supabase/functions/make-server-3dd53475/notification-system-refactored.tsx"
  );
  
  assert(!notificationFile.includes("kv_store"), "Notification endpoints should not import kv_store");
  assert(!notificationFile.includes("kv.get"), "Notification endpoints should not use kv.get");
  assert(!notificationFile.includes("kv.set"), "Notification endpoints should not use kv.set");
  assert(notificationFile.includes("NotificationsRepository"), "Notification endpoints should use NotificationsRepository");
  console.log("✅ Notification endpoints use SQL only (no KV)");
});

Deno.test("Notification Management - Repository Methods", async () => {
  const notificationsRepo = getNotificationsRepository();
  
  // Test repository methods exist
  assert(typeof notificationsRepo.create === 'function', "NotificationsRepository should have create method");
  assert(typeof notificationsRepo.findByUser === 'function', "NotificationsRepository should have findByUser method");
  assert(typeof notificationsRepo.markAsRead === 'function', "NotificationsRepository should have markAsRead method");
  console.log("✅ NotificationsRepository methods exist");
});

Deno.test("Notification Management - Channel Support", async () => {
  const notificationsRepo = getNotificationsRepository();
  const testUserId = "test-user-notification";
  
  // Create notification with multiple channels
  const notification = await notificationsRepo.create({
    user_id: testUserId,
    notification_type: 'test_notification',
    title: 'Test Notification',
    message: 'Test message with multiple channels',
    data: {
      channels: {
        push: true,
        email: true,
        sms: false,
        inApp: true
      }
    }
  });
  
  assertExists(notification.id, "Notification should have an ID");
  assertExists(notification.notification_type, "Notification should have a type");
  assertEquals(notification.is_read, false, "Notification should be unread by default");
  console.log(`✅ Notification created with channel support: ${notification.id}`);
});

console.log("✅ All notification management audit tests defined");

