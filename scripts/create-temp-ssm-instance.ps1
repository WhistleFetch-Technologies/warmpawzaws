# Create temporary EC2 instance with SSM for migration
$Region = "ap-south-1"
$VpcId = "vpc-02a4893e5e582c4d8"
$SubnetId = "subnet-0b667c6835342a6b8"
$AmiId = "ami-0234cb7932459cd54" # Amazon Linux 2023
$InstanceType = "t3.micro"

Write-Host "Creating temporary EC2 instance with SSM..." -ForegroundColor Cyan

# Create security group allowing outbound to RDS
$SgName = "temp-migration-instance-sg-$(Get-Date -Format 'yyyyMMddHHmmss')"
$SgId = aws ec2 create-security-group `
    --group-name $SgName `
    --description "Temporary security group for migration instance" `
    --vpc-id $VpcId `
    --region $Region `
    --query 'GroupId' `
    --output text

Write-Host "Security Group: $SgId" -ForegroundColor Green

# Allow outbound to RDS (port 5432)
aws ec2 authorize-security-group-egress `
    --group-id $SgId `
    --protocol tcp `
    --port 5432 `
    --source-group sg-0bd51c91891ee040b `
    --region $Region | Out-Null

# Launch instance with SSM role
$UserData = @"
#!/bin/bash
yum update -y
yum install -y postgresql15
"@

$UserDataBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($UserData))

$InstanceId = aws ec2 run-instances `
    --image-id $AmiId `
    --instance-type $InstanceType `
    --subnet-id $SubnetId `
    --security-group-ids $SgId `
    --iam-instance-profile Name=AmazonSSMManagedInstanceCore `
    --user-data $UserDataBase64 `
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=temp-migration-instance},{Key=Purpose,Value=DatabaseMigration},{Key=AutoTerminate,Value=true}]" `
    --region $Region `
    --query 'Instances[0].InstanceId' `
    --output text

Write-Host "Instance ID: $InstanceId" -ForegroundColor Green
Write-Host "Waiting for instance to be ready..." -ForegroundColor Yellow

# Wait for instance to be running
aws ec2 wait instance-running --instance-ids $InstanceId --region $Region

# Wait for SSM to be ready
Write-Host "Waiting for SSM agent to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

$SsmReady = $false
$Attempts = 0
while (-not $SsmReady -and $Attempts -lt 20) {
    Start-Sleep -Seconds 10
    $SsmInfo = aws ssm describe-instance-information --filters "Key=InstanceIds,Values=$InstanceId" --region $Region --query 'InstanceInformationList[0].PingStatus' --output text 2>$null
    if ($SsmInfo -eq "Online") {
        $SsmReady = $true
        Write-Host "SSM is ready!" -ForegroundColor Green
    } else {
        Write-Host "." -NoNewline
        $Attempts++
    }
}

Write-Host ""
Write-Host "Instance is ready: $InstanceId" -ForegroundColor Green
Write-Host "Security Group: $SgId" -ForegroundColor Green
Write-Host ""
Write-Host "You can now run the migration with:" -ForegroundColor Cyan
Write-Host "  .\scripts\run-migration-prod-simple.ps1 -MigrationFile 559_add_vendors_specializations_column.sql -InstanceId $InstanceId" -ForegroundColor Yellow
Write-Host ""
Write-Host "To terminate the instance after migration:" -ForegroundColor Cyan
Write-Host "  aws ec2 terminate-instances --instance-ids $InstanceId --region $Region" -ForegroundColor Yellow
