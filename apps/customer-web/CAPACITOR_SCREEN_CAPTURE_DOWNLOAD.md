# Capacitor screen-capture PDF download (no APK/IPA rebuild)

Prescription PDF export uses `html2canvas` + `jsPDF` to capture the on-screen layout. In a full browser, `pdf.save()` / anchor download works. In Capacitor **WebView / WKWebView**, those calls often **fail silently**.

This patch adds a **web-only** native save path deployed with `customer-web` and `vendor-web` (remote URL shells). **No store rebuild required** for the primary fix.

---

## What changed

| Layer | Files |
|-------|--------|
| Shared helper | [`lib/capacitor-pdf-save.ts`](lib/capacitor-pdf-save.ts) (customer + vendor copies) |
| Chat attachments | [`lib/chat-attachment-save.ts`](lib/chat-attachment-save.ts), [`components/shared/ChatAttachmentActions.tsx`](components/shared/ChatAttachmentActions.tsx) (customer + vendor copies) |
| Screen capture UI | [`components/customer/PrescriptionDocument.tsx`](components/customer/PrescriptionDocument.tsx), vendor [`PrescriptionDocument.tsx`](../vendor-web/components/vendor/PrescriptionDocument.tsx) |
| Chat UI entry points | Customer [`ChimeVideoCall.tsx`](components/teleCommunication/ChimeVideoCall.tsx), [`CommunicationHub.tsx`](components/communication/CommunicationHub.tsx); vendor [`ChimeVideoCall.tsx`](../vendor-web/components/vendor/teleCommunication/ChimeVideoCall.tsx), [`VendorChatModal.tsx`](../vendor-web/components/vendor/VendorChatModal.tsx) |

### Save flow (native Capacitor only)

1. Optional: `@capacitor/filesystem` + `@capacitor/share` if plugins exist in the installed app (`isPluginAvailable`).
2. **Web Share API** with PDF `File` (primary no-rebuild fix — system share sheet on iOS and Android).
3. Caller falls back to **Print** if result is `failed`.

**Android note:** `<a download>` with a blob URL does **not** write to the user’s Downloads folder inside Capacitor WebView. The old anchor fallback reported success with no visible file. Android now relies on Web Share (with `canShare` bypass — WebView often returns false even when share works). If share still fails on a device, Print opens instead of a fake “downloaded” toast.

### Browser (unchanged)

Desktop and mobile **Safari/Chrome** still use a normal anchor download (no share sheet hijack).

---

## Deploy (no native rebuild)

```bash
# Customer
cd apps/customer-web
npm run build
# deploy to customer.warmpawz.com (S3 + CloudFront invalidation)

# Vendor
cd apps/vendor-web
npm run build:prod
# deploy to vendor.warmpawz.com
```

On device: force-close the app or wait for cache refresh so `_next/static` picks up the new chunk.

---

## Verify on device

1. Open an existing prescription (customer or vendor app).
2. Tap **Download** (not only Print).
3. **Pass:** Android/iOS **share sheet** appears with a PDF (Save to Files, Drive, WhatsApp, etc.).
4. **Pass:** Desktop browser still downloads a `.pdf` file directly.

### Chat document attachments (PDF, Word, etc.)

1. In booking chat or video-call chat, share a `.pdf` or `.docx` file.
2. Tap **Save or share** on the attachment (mobile) or **Download** (desktop).
3. **Pass:** Android/iOS share sheet appears with the file (Save to Files, Drive, WhatsApp, etc.).
4. **Pass:** Older messages with only `file_id` still save via `/chat/file/` redirect.

Safari Web Inspector (iOS): Develop → [device] → app → console may show `[Native Save] Started` / `Success`.

---

## Logging

```
[Native Save] Started
[Native Save] Success
[Native Save] Failed
```

---

## Optional future native enhancement (requires rebuild)

If Web Share is insufficient on some OEM devices, add plugins and sync:

```bash
npm install @capacitor/filesystem @capacitor/share
npx cap sync android
npx cap sync ios
```

`saveGeneratedPdfBlob` already calls them when `Capacitor.isPluginAvailable('Filesystem')` and `Share` are true. Use app-scoped cache + share sheet; avoid broad storage permissions.

---

## Out of scope (other call sites)

- CSV / JSON / invoice anchor downloads not yet migrated to `downloadFromUrl`.
- Chat **image** attachments (inline preview only; save/share for images can reuse `ChatAttachmentActions` later).

Extend [`lib/download-file.ts`](lib/download-file.ts) and [`lib/chat-attachment-save.ts`](lib/chat-attachment-save.ts) for additional flows as needed.

---

## Related docs

- [`ANDROID_UPI_FIX.md`](./ANDROID_UPI_FIX.md)
- [`IOS_RAZORPAY_UPI_FIX.md`](./IOS_RAZORPAY_UPI_FIX.md)
