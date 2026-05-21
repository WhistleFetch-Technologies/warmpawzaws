# Apply customer-service ECS stack + API Gateway Java routes in dev.
# Loads required Terraform variables from existing AWS secrets (no prompt).
# Prereq: customer-stack.auto.tfvars with enable_customer_stack + customer_service_image.
# Also requires booking-stack.auto.tfvars (or TF_VAR_*) so booking ECS is not destroyed on apply.

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

if (-not (Test-Path "customer-stack.auto.tfvars")) {
    throw "Missing customer-stack.auto.tfvars - copy customer-stack.auto.tfvars.example and set customer_service_image"
}

Write-Host "terraform init..."
& $tf init -input=false | Out-Host

$customerTargets = @(
    "-target=module.customer_service_ecs",
    "-target=aws_security_group.apigw_customer_vpc_link",
    "-target=aws_security_group_rule.rds_postgres_from_customer_ecs"
)

Write-Host "terraform apply (customer ECS stack)..."
& $tf apply -input=false -auto-approve @customerTargets
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "terraform apply (API Gateway customer Java routes)..."
& $tf apply -input=false -auto-approve `
    "-target=module.api_gateway.aws_apigatewayv2_vpc_link.customer_java" `
    "-target=module.api_gateway.aws_apigatewayv2_integration.customer_java" `
    "-target=module.api_gateway.aws_apigatewayv2_route.customer_java"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Done. Run scripts/route-customer-to-java.ps1 if legacy routes still point at Lambda."
