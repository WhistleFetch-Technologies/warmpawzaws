# Apply booking-service ECS stack + API Gateway routes in dev.
# Loads required Terraform variables from existing AWS secrets (no prompt).
# Prereq: booking-stack.auto.tfvars in infra/envs/dev with enable_booking_stack = true

$ErrorActionPreference = "Stop"
$Region = if ($env:AWS_REGION) { $env:AWS_REGION } else { "ap-south-1" }
$DevDir = Join-Path $PSScriptRoot "..\infra\envs\dev" | Resolve-Path

function Get-SsmPlain([string]$Name) {
    aws ssm get-parameter --name $Name --region $Region --query "Parameter.Value" --output text
}

function Get-SecretJson([string]$SecretId) {
    $raw = aws secretsmanager get-secret-value --secret-id $SecretId --region $Region --query "SecretString" --output text
    $raw | ConvertFrom-Json
}

Write-Host "Loading Terraform variables from AWS ($Region)..."
$razorpayKeyId = Get-SsmPlain "/warmpawz/dev/razorpay/keyId"
$razorpayKeySecret = aws ssm get-parameter --name "/warmpawz/dev/razorpay/keySecret" --region $Region --with-decryption --query "Parameter.Value" --output text
$googleMaps = Get-SecretJson "warmpawz/dev/google-maps"
$shiprocket = Get-SecretJson "warmpawz/dev/shiprocket"

$googleKey = $googleMaps.apiKey
if (-not $googleKey) { $googleKey = $googleMaps.api_key }
if (-not $googleKey) { throw "google-maps secret missing apiKey" }

$env:TF_VAR_razorpay_key_id = $razorpayKeyId
$env:TF_VAR_razorpay_key_secret = $razorpayKeySecret
$env:TF_VAR_google_maps_api_key = $googleKey
$env:TF_VAR_shiprocket_email = $shiprocket.email
$env:TF_VAR_shiprocket_password = $shiprocket.password

$tf = Get-Command terraform -ErrorAction Stop
Set-Location $DevDir

if (-not (Test-Path "booking-stack.auto.tfvars")) {
    throw "Missing booking-stack.auto.tfvars - copy booking-stack.auto.tfvars.example and set booking_service_image"
}

Write-Host "terraform init..."
& $tf init -input=false | Out-Host

$bookingTargets = @(
    "-target=module.booking_service_ecs",
    "-target=aws_security_group.apigw_booking_vpc_link",
    "-target=aws_security_group_rule.rds_postgres_from_booking_ecs"
)

Write-Host "terraform apply (booking ECS stack)..."
& $tf apply -input=false -auto-approve @bookingTargets
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "terraform apply (API Gateway booking Java routes only)..."
& $tf apply -input=false -auto-approve `
    "-target=module.api_gateway.aws_apigatewayv2_vpc_link.booking_java" `
    "-target=module.api_gateway.aws_apigatewayv2_integration.booking_java" `
    "-target=module.api_gateway.aws_apigatewayv2_route.booking_java"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Done."
