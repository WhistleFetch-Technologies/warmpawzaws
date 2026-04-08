# Run db/migrations/625_hsn_codes_allow_duplicate_hsn_code.sql against dev RDS.
# Requires: AWS CLI, Node.js, backend/lambda/node_modules (pg), network path to RDS
# (VPN, bastion, or office network). Public internet usually cannot reach private RDS.

$ErrorActionPreference = "Stop"
$Region = "ap-south-1"
$SecretId = "warmpawz-dev-rds-master-20260106164510791100000002"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$SqlFile = Join-Path $RepoRoot "db\migrations\625_hsn_codes_allow_duplicate_hsn_code.sql"
$LambdaDir = Join-Path $RepoRoot "backend\lambda"

if (-not (Test-Path $SqlFile)) {
    Write-Error "Migration file not found: $SqlFile"
}

Write-Host "Fetching RDS secret: $SecretId" -ForegroundColor Cyan
$secretRaw = aws secretsmanager get-secret-value --secret-id $SecretId --region $Region --query SecretString --output text
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$env:RDS_SECRET = $secretRaw
$env:MIGRATION_SQL_FILE = $SqlFile
Set-Location $LambdaDir

node -e "const {Client}=require('pg');const fs=require('fs');const cfg=JSON.parse(process.env.RDS_SECRET);const sql=fs.readFileSync(process.env.MIGRATION_SQL_FILE,'utf8');(async()=>{const c=new Client({host:cfg.host,port:cfg.port,database:cfg.dbname,user:cfg.username,password:cfg.password,ssl:{rejectUnauthorized:false}});await c.connect();await c.query(sql);await c.end();console.log('Migration 625 applied successfully.');})().catch(e=>{console.error(e);process.exit(1);});"

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Done." -ForegroundColor Green
