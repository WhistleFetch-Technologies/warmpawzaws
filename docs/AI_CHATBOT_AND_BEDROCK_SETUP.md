# AI Chatbot & AWS Bedrock Setup

## Overview

- **Customer chatbox**: AI Assistant with three modes — **Chat**, **Symptoms**, **Bookings**. Powered by AWS Bedrock when configured.
- **Vendor chatbox**: Warmpawz Assistant for vendors; messages go to `/ai-chatbot/chat` and are connected to **Admin Support CRM** (tickets created on error or when vendor clicks "Contact support").
- **Bedrock config**: Prefer **AWS Secrets Manager**; fallback to platform_settings (DB).

## 1. AWS Bedrock in Secrets Manager (ap-south-1)

Lambda reads Bedrock config in this order:

1. **AWS Secrets Manager** — Secret ID: `warmpawz/{stage}/bedrock`  
   - **IAM role (recommended):** `{ "region": "ap-south-1", "modelId": "amazon.nova-lite-v1:0", "enabled": true }` — Lambda uses its execution role; no keys stored.
   - **With credentials:** `{ "accessKeyId", "secretAccessKey", "region?", "modelId?", "enabled?": true }`
2. **Platform settings** — `platform_settings.setting_key = 'aws_config'` (existing Admin UI AWS integration).

Default region is **ap-south-1** (Mumbai); Bedrock and models such as `amazon.nova-lite-v1:0`, `anthropic.claude-3-haiku-20240307-v1:0` are available there.

### Create/update secret via AWS CLI

**Using Lambda IAM role (no keys in secret):**

```bash
./scripts/setup-bedrock-secret.sh --iam dev
./scripts/setup-bedrock-secret.sh --iam prod
```

**With explicit credentials:**

```bash
./scripts/setup-bedrock-secret.sh YOUR_ACCESS_KEY YOUR_SECRET_KEY ap-south-1 dev
./scripts/setup-bedrock-secret.sh YOUR_ACCESS_KEY YOUR_SECRET_KEY ap-south-1 anthropic.claude-3-haiku-20240307-v1:0 prod
```

Lambda’s execution role must have `bedrock:InvokeModel` (and optionally `bedrock:InvokeModelWithResponseStream`) in **ap-south-1**.

## 2. Vendor chat → Admin Support CRM

- Vendor chat calls **POST /ai-chatbot/chat** with `vendorId` and `userType: 'vendor'`.
- If the AI call fails, the widget creates a **vendor support ticket** via **POST /vendor/support/tickets** so admin sees it in Support CRM.
- **"Contact support (admin)"** in the widget calls **POST /ai-chatbot/escalate-to-agent** with `vendorId`, creating a ticket with source `vendor_ai_chatbot` visible in Admin → Support.

## 3. Customer chat — Symptoms & Bookings

- **Chat**: **POST /ai-chatbot/chat** (general AI + intent).
- **Symptoms**: **POST /ai-chatbot/symptoms-checker** — suggests care and can suggest vet booking.
- **Bookings**: **POST /ai-chatbot/booking-assist** — answers booking steps or helps book a vendor-service.

All three use the same Bedrock config (Secrets Manager or platform_settings). If Bedrock is not configured, the backend uses rule-based fallbacks.
