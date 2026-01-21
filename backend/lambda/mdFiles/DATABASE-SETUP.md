# Database Setup for Local Development

## Current Status

✅ **Server is running on http://localhost:3000**
⚠️ **Database connection is failing** - This is expected if PostgreSQL is not set up

## Options

### Option 1: Use Remote RDS Database (Recommended for Quick Start)

Update your `.env.local` file (or set environment variables):

```bash
DB_HOST=your-rds-endpoint.region.rds.amazonaws.com
DB_PORT=5432
DB_NAME=warmpawz
DB_USER=your_db_user
DB_PASSWORD=your_db_password
```

Then restart the server:
```powershell
npm run start:local
```

### Option 2: Install Local PostgreSQL

#### Windows

1. **Download PostgreSQL**
   - Visit: https://www.postgresql.org/download/windows/
   - Download installer from EnterpriseDB or use Chocolatey

2. **Install with Chocolatey (if you have it)**
   ```powershell
   choco install postgresql
   ```

3. **Or Download and Install Manually**
   - Run installer
   - Set password for `postgres` user (remember this!)
   - Default port: 5432

4. **Create Database**
   ```powershell
   # After installation, open psql or pgAdmin
   createdb warmpawz
   
   # Or using psql:
   psql -U postgres
   CREATE DATABASE warmpawz;
   \q
   ```

5. **Update Connection**
   ```bash
   # Create/update .env.local
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=warmpawz
   DB_USER=postgres
   DB_PASSWORD=your_postgres_password
   ```

6. **Restart Server**
   ```powershell
   npm run start:local
   ```

#### Docker (Alternative)

```powershell
# Run PostgreSQL in Docker
docker run --name warmpawz-postgres `
  -e POSTGRES_DB=warmpawz `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -p 5432:5432 `
  -d postgres:15

# Update .env.local
DB_HOST=localhost
DB_PORT=5432
DB_NAME=warmpawz
DB_USER=postgres
DB_PASSWORD=postgres
```

### Option 3: Skip Database for Now

You can still test endpoints that don't require database:
- `/health` - Health check (works without DB)
- `/auth/send-otp` - OTP sending (may cache in memory)
- Some other endpoints may work with mocked data

**Note:** Most endpoints require database, so this is limited.

## Verify Database Connection

After setup, test with:

```powershell
# Health check
curl http://localhost:3000/health

# Database health check
curl http://localhost:3000/health/database
```

Expected response when connected:
```json
{
  "status": "healthy",
  "database": {
    "connected": true
  }
}
```

## Troubleshooting

### Connection Refused
- Check if PostgreSQL is running:
  ```powershell
  # Windows
  Get-Service -Name postgresql*
  
  # Or check if port is listening
  netstat -an | findstr 5432
  ```

### Authentication Failed
- Verify credentials in `.env.local`
- Check PostgreSQL `pg_hba.conf` allows local connections

### Database Does Not Exist
```powershell
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE warmpawz;

# Exit
\q
```

### Permission Denied
- Ensure user has access to database
- Grant privileges if needed:
  ```sql
  GRANT ALL PRIVILEGES ON DATABASE warmpawz TO postgres;
  ```

## Next Steps After Database Setup

1. **Run Migrations** (if available)
   ```powershell
   # Check for migration scripts
   ls migrations/
   ```

2. **Seed Data** (if needed)
   ```powershell
   # Check for seed scripts
   ls scripts/
   ```

3. **Test Full API**
   ```powershell
   # All endpoints should now work
   curl http://localhost:3000/health
   ```

## Environment Variables Reference

Create `.env.local` in `backend/lambda/`:

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=warmpawz
DB_USER=postgres
DB_PASSWORD=postgres

# Other settings
UAT_MODE=true
```

**Note:** `.env.local` is git-ignored, so create it manually.
