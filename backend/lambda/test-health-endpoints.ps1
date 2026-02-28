# ============================================================================
# HEALTH ENDPOINTS TEST SCRIPT
# ============================================================================
# Tests all available health check endpoints
# ============================================================================

$baseUrl = "http://localhost:3000"

Write-Host "=== Testing Health Endpoints ===" -ForegroundColor Cyan
Write-Host "Base URL: $baseUrl" -ForegroundColor Gray
Write-Host ""

# Test 1: Basic Health Check (from handler/index.ts)
Write-Host "[TEST 1] GET /health (Main endpoint)" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/health" -Method GET -ErrorAction Stop
    $content = $response.Content | ConvertFrom-Json
    Write-Host "[OK] Health check successful" -ForegroundColor Green
    Write-Host "  Status: $($content.status)" -ForegroundColor Gray
    Write-Host "  Timestamp: $($content.timestamp)" -ForegroundColor Gray
    if ($content.database) {
        Write-Host "  Database Connected: $($content.database.connected)" -ForegroundColor $(if ($content.database.connected) { "Green" } else { "Red" })
        if ($content.database.error) {
            Write-Host "  Database Error: $($content.database.error)" -ForegroundColor Red
        }
    }
    if ($content.environment) {
        Write-Host "  Environment Valid: $($content.environment.valid)" -ForegroundColor Gray
    }
    Write-Host "  Status Code: $($response.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "[ERROR] Health check failed: $_" -ForegroundColor Red
    Write-Host "  Make sure the server is running: npm run start:local" -ForegroundColor Yellow
    exit 1
}

# Test 2: Full Health Check
Write-Host ""
Write-Host "[TEST 2] GET /health/full (Complete system check)" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/health/full" -Method GET -ErrorAction Stop
    $content = $response.Content | ConvertFrom-Json
    Write-Host "[OK] Full health check successful" -ForegroundColor Green
    Write-Host "  Overall Status: $($content.status)" -ForegroundColor Gray
    Write-Host "  Total Response Time: $($content.totalResponseTime)ms" -ForegroundColor Gray
    if ($content.summary) {
        Write-Host "  Summary:" -ForegroundColor Gray
        Write-Host "    Operational: $($content.summary.operational)" -ForegroundColor Green
        Write-Host "    Degraded: $($content.summary.degraded)" -ForegroundColor Yellow
        Write-Host "    Down: $($content.summary.down)" -ForegroundColor Red
    }
    if ($content.checks) {
        Write-Host "  Checks:" -ForegroundColor Gray
        foreach ($check in $content.checks) {
            $statusColor = switch ($check.status) {
                "operational" { "Green" }
                "degraded" { "Yellow" }
                "down" { "Red" }
                default { "Gray" }
            }
            Write-Host "    $($check.name): $($check.status) ($($check.responseTime)ms)" -ForegroundColor $statusColor
            if ($check.details) {
                Write-Host "      Details: $($check.details)" -ForegroundColor Gray
            }
            if ($check.error) {
                Write-Host "      Error: $($check.error)" -ForegroundColor Red
            }
        }
    }
} catch {
    Write-Host "[ERROR] Full health check failed: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "  Response: $responseBody" -ForegroundColor Gray
    }
}

# Test 3: Database Health Check
Write-Host ""
Write-Host "[TEST 3] GET /health/database (Database-specific check)" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/health/database" -Method GET -ErrorAction Stop
    $content = $response.Content | ConvertFrom-Json
    Write-Host "[OK] Database health check successful" -ForegroundColor Green
    Write-Host "  Status: $($content.status)" -ForegroundColor Gray
    Write-Host "  Response Time: $($content.responseTime)ms" -ForegroundColor Gray
    if ($content.database) {
        Write-Host "  Database:" -ForegroundColor Gray
        Write-Host "    Connected: $($content.database.connected)" -ForegroundColor $(if ($content.database.connected) { "Green" } else { "Red" })
        if ($content.database.currentTime) {
            Write-Host "    Current Time: $($content.database.currentTime)" -ForegroundColor Gray
        }
        if ($content.database.version) {
            Write-Host "    Version: $($content.database.version)" -ForegroundColor Gray
        }
    }
    if ($content.stats) {
        Write-Host "  Stats:" -ForegroundColor Gray
        foreach ($stat in $content.stats.PSObject.Properties) {
            Write-Host "    $($stat.Name): $($stat.Value)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "[ERROR] Database health check failed: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "  Response: $responseBody" -ForegroundColor Gray
    }
}

# Test 4: System Health (if available)
Write-Host ""
Write-Host "[TEST 4] GET /system/health (System health alias)" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/system/health" -Method GET -ErrorAction Stop
    $content = $response.Content | ConvertFrom-Json
    Write-Host "[OK] System health check successful" -ForegroundColor Green
    Write-Host "  Status: $($content.status)" -ForegroundColor Gray
    Write-Host "  Database: $($content.database)" -ForegroundColor Gray
    if ($content.system) {
        Write-Host "  System: $($content.system)" -ForegroundColor Gray
    }
} catch {
    Write-Host "[WARN] System health endpoint not available or failed: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Test Complete ===" -ForegroundColor Cyan
Write-Host "All health endpoints tested!" -ForegroundColor Green
