# Restore prod CloudFront custom domains + ACM cert (*.warmpawz.com) after accidental Terraform drift.
# Usage: powershell -File scripts/fix-prod-cloudfront-custom-domains.ps1

$ErrorActionPreference = "Stop"
$CertArn = "arn:aws:acm:us-east-1:057442119249:certificate/02b216e5-4696-409a-b595-a4d0f5b6b04b"

$Targets = @(
    @{ Id = "E3JDHOY1XIFOWE"; Alias = "vendor.warmpawz.com"; Name = "vendor" },
    @{ Id = "E2F29N49KVOOBP"; Alias = "customer.warmpawz.com"; Name = "customer" },
    @{ Id = "E2NHO6UUI5UIHW"; Alias = "admin.warmpawz.com"; Name = "admin" }
)

function Wait-CloudFrontReady($Id, $Name) {
    for ($i = 0; $i -lt 60; $i++) {
        $st = aws cloudfront get-distribution --id $Id --query "Distribution.Status" --output text
        if ($st -eq "Deployed") { return }
        Write-Host "  $($Name): waiting for Deployed (now $st)..."
        Start-Sleep -Seconds 15
    }
    throw "Timed out waiting for $Name distribution $Id"
}

foreach ($t in $Targets) {
    Write-Host "Fixing $($t.Name) ($($t.Id)) -> $($t.Alias) ..."
    Wait-CloudFrontReady $t.Id $t.Name
    $raw = aws cloudfront get-distribution-config --id $t.Id --output json | ConvertFrom-Json
    $cfg = $raw.DistributionConfig
    $cfg.Aliases = @{ Quantity = 1; Items = @($t.Alias) }
    $cfg.ViewerCertificate = @{
        CloudFrontDefaultCertificate = $false
        ACMCertificateArn            = $CertArn
        SSLSupportMethod             = "sni-only"
        MinimumProtocolVersion       = "TLSv1.2_2021"
        CertificateSource            = "acm"
    }
    $path = Join-Path $env:TEMP "cf-$($t.Name)-config.json"
    $json = $cfg | ConvertTo-Json -Depth 20 -Compress
    [System.IO.File]::WriteAllText($path, $json, [System.Text.UTF8Encoding]::new($false))
    $out = aws cloudfront update-distribution --id $t.Id --if-match $raw.ETag --distribution-config "file://$path" --query "Distribution.{Status:Status,Aliases:DistributionConfig.Aliases.Items}" --output json
    Write-Host $out
}

Write-Host ""
Write-Host "Done. Deploy takes ~5-15 min. Until then use:"
Write-Host "  https://d1y5ywletev82x.cloudfront.net (vendor)"
Write-Host "  https://dg69gqp2frh39.cloudfront.net (customer)"
