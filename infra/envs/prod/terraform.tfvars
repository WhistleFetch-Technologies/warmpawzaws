# Production Environment Variables
aws_region   = "ap-south-1"
alert_emails = ["prod-alerts@warmpawz.com", "sre@warmpawz.com", "cto@warmpawz.com"]

# OpenSearch password - MUST be stored in AWS Secrets Manager
opensearch_master_password = "d37c_ZoBayjm4Yfb+?gDOQEPS%!*vLJ0"

# Custom domain (optional)
# custom_domain_name = "api.warmpawz.com"
# certificate_arn    = "arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERT_ID"
# route53_zone_id    = "Z1234567890ABC"

# ============================================
# External Integrations
# ============================================

# Razorpay Configuration
# ============================================
# OPTION 1: Use Separate Production LIVE Keys (Recommended for Real Payments)
# ============================================
razorpay_key_id     = ""  # ← Replace with your production LIVE key (rzp_live_...)
razorpay_key_secret = ""  # ← Replace with your production LIVE secret
razorpay_x_account_number = ""  # ← Optional: RazorpayX account number for payouts

# ============================================
# OPTION 2: Use Same Dev TEST Keys (For Testing/Staging Only)
# ============================================
# ⚠️ WARNING: TEST keys (rzp_test_...) will NOT process real payments
# ⚠️ Only use this if you're still in testing phase
# ⚠️ Uncomment below and comment out OPTION 1 if using dev keys:
# razorpay_key_id     = "rzp_test_XXXXX"  # ← Dev test key (from dev environment)
# razorpay_key_secret = "your_test_secret"  # ← Dev test secret (from dev environment)
# razorpay_x_account_number = ""

# Google Maps API Key
google_maps_api_key = "AIzaSyC6iwRfS_r1zRtjiGyLjgueZ_rDV_l7yo0"  # ← Creates prod secret
# Shiprocket Configuration (Optional)
shiprocket_email    = ""  # ← Optional: Shiprocket account email
shiprocket_password = ""  # ← Optional: Shiprocket account password
