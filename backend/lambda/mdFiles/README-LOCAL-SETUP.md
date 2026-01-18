# 🚀 Local Backend Setup Guide

## Quick Start

### Windows (PowerShell)
```powershell
cd D:\WFTPL\warmpawzApp\warmpawzaws\backend\lambda
.\setup-local.ps1
npm run start:local
```

### Manual Setup

1. **Install Dependencies**
   ```bash
   # Note: Use --legacy-peer-deps due to serverless version conflict
   npm install --legacy-peer-deps
   ```
   
   **Why `--legacy-peer-deps`?**
   - `serverless-offline@14.4.0` requires `serverless@^4.0.0`
   - Project uses `serverless@3.40.0`
   - Using `--legacy-peer-deps` allows installation despite peer dependency conflict
   - This is safe as serverless-offline v14 works fine with serverless v3 in practice

2. **Build the Handler** (if not already built)
   ```bash
   npm run build:bundle
   ```

3. **Configure Environment**
   - The `.env.local` file has been created with default values
   - Update database credentials if needed
   - For remote RDS, update `DB_HOST` in `.env.local`

4. **Start Local Server**
   ```bash
   npm run start:local
   ```

## Configuration Files

- **`serverless.local.yml`** - Serverless Offline configuration
- **`.env.local`** - Local environment variables (create manually)
- **`DATABASE-SETUP.md`** - Database setup guide (see if DB connection fails)

## Server Details

- **URL:** http://localhost:3000
- **Port:** 3000 (configurable in `serverless.local.yml`)

## Testing the API

### Health Check
```bash
curl http://localhost:3000/health
```

### Send OTP (Auth)
```bash
curl -X POST http://localhost:3000/auth/send-otp `
  -H "Content-Type: application/json" `
  -d '{\"phone\": \"+919876543210\"}'
```

### Verify OTP (UAT Mode - OTP is always "123456")
```bash
curl -X POST http://localhost:3000/auth/verify-otp `
  -H "Content-Type: application/json" `
  -d '{\"phone\": \"+919876543210\", \"otp\": \"123456\"}'
```

## Environment Variables

Default values in `.env.local`:
- `DB_HOST=localhost` - PostgreSQL host
- `DB_PORT=5432` - PostgreSQL port
- `DB_NAME=warmpawz` - Database name
- `DB_USER=postgres` - Database user
- `DB_PASSWORD=postgres` - Database password
- `UAT_MODE=true` - Enables test mode (OTP: 123456)

## Troubleshooting

### Port Already in Use
Edit `serverless.local.yml` and change `httpPort`:
```yaml
custom:
  serverless-offline:
    httpPort: 3001  # Change port
```

### Database Connection Error
- **Server is running but database is not connected** - This is expected if PostgreSQL is not set up
- See `DATABASE-SETUP.md` for complete setup instructions
- Quick options:
  - Use remote RDS: Update `DB_HOST` in `.env.local` to your RDS endpoint
  - Install local PostgreSQL: See `DATABASE-SETUP.md` for installation steps
  - Use Docker: `docker run -d -p 5432:5432 -e POSTGRES_DB=warmpawz -e POSTGRES_PASSWORD=postgres postgres:15`
- Verify database exists: `createdb warmpawz`
- Check PostgreSQL is running: `Get-Service -Name postgresql*` (Windows)

### Module Not Found
Rebuild the handler:
```bash
npm run build:bundle
```

### Dependency Installation Error (Peer Dependency Conflict)
If you see errors about `serverless-offline` and `serverless` version conflicts:
```bash
# Use --legacy-peer-deps flag
npm install --legacy-peer-deps
```
This is expected due to serverless version mismatch but doesn't affect functionality.

## Available Scripts

- `npm run start:local` - Start serverless-offline
- `npm run build:bundle` - Build handler
- `npm run build` - Full build (clean + bundle + package)
- `npm run test:local` - Run local tests

For more details, see `LOCAL_TESTING_GUIDE.md`
