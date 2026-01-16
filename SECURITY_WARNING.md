# ⚠️ CRITICAL SECURITY WARNING ⚠️

## Exposed Credentials - Immediate Action Required

The following credentials have been exposed in plain text and **MUST be rotated immediately**:

### 1. AWS Credentials (ROTATE IMMEDIATELY)
```
Access Key ID: AKIAQK4TGNEFLQJLXMMI
Secret Access Key: GKH8wP5OSapqiUyfCbFtwPhYuzm0YUADOEZTEl6V
Region: ap-south-1
```

**Action Required:**
1. Go to AWS Console → IAM → Users → Your User
2. Security credentials → Access keys
3. **Deactivate** the exposed key: `AKIAQK4TGNEFLQJLXMMI`
4. Create a new access key
5. Update the new key in all locations

### 2. Razorpay Credentials (ROTATE IMMEDIATELY)
```
Test API Key: rzp_test_Rnp57suJH3wzUl
Test Key Secret: rplcWAxtmVfvXI9uydFt7YkH
```

**Action Required:**
1. Go to https://dashboard.razorpay.com/app/keys
2. Regenerate test API keys
3. Update in all locations

### 3. Google Maps API Key (RESTRICT IMMEDIATELY)
```
API Key: AIzaSyC6iwRfS_r1zRtjiGyLjgueZ_rDV_l7yo0
```

**Action Required:**
1. Go to https://console.cloud.google.com/apis/credentials
2. Add API restrictions (Maps JavaScript API, Places API, etc.)
3. Add Application restrictions (HTTP referrers for web, IP addresses for backend)
4. Monitor usage for suspicious activity

### 4. Shiprocket Password (CHANGE IMMEDIATELY)
```
Email: ketanh@warmpawz.com
Password: znoMnd9FkntmRuXCq$d@eKfQj1M8oXGj.
```

**Action Required:**
1. Go to https://app.shiprocket.in/
2. Change password immediately
3. Update in all locations

---

## How These Credentials Were Exposed

These credentials were shared in:
1. ✅ This conversation (you should treat this as compromised)
2. ✅ Scripts created in this repository (if committed to git, they are public)

---

## Immediate Steps (Do NOW)

### Step 1: Rotate AWS Credentials
```bash
# Deactivate old key
aws iam update-access-key \
  --access-key-id AKIAQK4TGNEFLQJLXMMI \
  --status Inactive \
  --user-name YOUR_USERNAME

# Create new key
aws iam create-access-key --user-name YOUR_USERNAME

# Update in GitHub
gh secret set AWS_ACCESS_KEY_ID -b"NEW_ACCESS_KEY_ID"
gh secret set AWS_SECRET_ACCESS_KEY -b"NEW_SECRET_KEY"
```

### Step 2: Rotate Razorpay Keys
1. Login to Razorpay Dashboard
2. Go to Settings → API Keys → Regenerate Test Key
3. Save new keys securely
4. Update everywhere

### Step 3: Restrict Google Maps Key
1. Login to Google Cloud Console
2. APIs & Services → Credentials
3. Click on the API key
4. Add restrictions:
   - **API restrictions**: Maps JavaScript API, Places API, Geocoding API
   - **Application restrictions**: Your domains only
5. Save

### Step 4: Change Shiprocket Password
1. Login to Shiprocket
2. Settings → Change Password
3. Use a strong password (20+ characters)
4. Update in secrets

---

## Prevention for Future

### 1. Never Share Credentials in Plain Text
- ✅ Use environment variables
- ✅ Use secure password managers (1Password, LastPass)
- ✅ Use AWS Secrets Manager
- ✅ Use encrypted communication

### 2. Use Short-Lived Credentials
- ✅ AWS: Use IAM roles instead of access keys where possible
- ✅ Enable MFA on all accounts
- ✅ Set up credential rotation (every 90 days)

### 3. Monitor for Unauthorized Access
- ✅ Enable CloudTrail in AWS
- ✅ Set up billing alerts
- ✅ Monitor API usage in all services

### 4. Git Security
```bash
# Add to .gitignore immediately
cat >> .gitignore << EOF

# Secrets and credentials
*.env
*.env.*
!.env.example
scripts/setup-github-secrets.sh
scripts/setup-aws-secrets.sh
**/credentials.json
**/secrets.json
**/.aws/
SECURITY_WARNING.md
EOF
```

---

## Setup Files Created

I've created these files for you:

1. ✅ `scripts/setup-github-secrets.sh` - Sets up GitHub secrets
2. ✅ `scripts/setup-aws-secrets.sh` - Sets up AWS Secrets Manager
3. ✅ `GITHUB_SECRETS_COMPLETE_LIST.md` - Complete reference

**⚠️ IMPORTANT**: 
- These files contain your credentials
- Add them to `.gitignore` immediately
- Run them to set up secrets
- **DELETE or move to secure location after use**
- Never commit them to git

---

## After Rotation Checklist

- [ ] AWS access key rotated and updated
- [ ] Razorpay keys regenerated and updated
- [ ] Google Maps key restricted
- [ ] Shiprocket password changed
- [ ] All secrets updated in GitHub
- [ ] All secrets updated in AWS Secrets Manager
- [ ] CloudTrail enabled for monitoring
- [ ] Billing alerts configured
- [ ] Scripts added to .gitignore
- [ ] Scripts deleted or moved to secure location
- [ ] This warning file deleted or secured

---

## Support

If you need help with credential rotation:
1. AWS: https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html
2. Razorpay: https://razorpay.com/docs/api/
3. Google Cloud: https://cloud.google.com/docs/authentication/api-keys

**Remember**: When in doubt, rotate the credential!

---

## Auto-Generated Warning

This file was auto-generated because sensitive credentials were detected.
Date: $(date)

