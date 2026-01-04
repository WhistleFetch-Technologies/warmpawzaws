#!/bin/bash
# ============================================================================
# FULL AWS ACCOUNT CLEANUP SCRIPT
# ============================================================================
# Account: 023394150666
# WARNING: This script DELETES ALL resources in the AWS account!
# Run with extreme caution - this is IRREVERSIBLE!
# ============================================================================

set -e

ACCOUNT_ID="023394150666"
DRY_RUN="${DRY_RUN:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_delete() { echo -e "${RED}[DELETE]${NC} $1"; }

# Verify account
verify_account() {
    CURRENT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    if [ "$CURRENT_ACCOUNT" != "$ACCOUNT_ID" ]; then
        log_error "Wrong account! Expected $ACCOUNT_ID but got $CURRENT_ACCOUNT"
        exit 1
    fi
    log_success "Verified account: $CURRENT_ACCOUNT"
}

# Get all regions
ALL_REGIONS=$(aws ec2 describe-regions --query 'Regions[].RegionName' --output text)

echo "============================================================================"
echo -e "${RED}⚠️  FULL AWS ACCOUNT CLEANUP - DESTRUCTIVE OPERATION ⚠️${NC}"
echo "============================================================================"
echo "Account ID: $ACCOUNT_ID"
echo "DRY_RUN: $DRY_RUN (set DRY_RUN=true to preview without deleting)"
echo ""
echo "This script will DELETE ALL resources including:"
echo "  - S3 Buckets (and all objects)"
echo "  - CloudFront Distributions"
echo "  - Lambda Functions"
echo "  - API Gateways"
echo "  - RDS Clusters & Instances"
echo "  - DynamoDB Tables"
echo "  - Cognito User Pools & Identity Pools"
echo "  - SQS Queues"
echo "  - SNS Topics"
echo "  - Secrets Manager Secrets"
echo "  - VPCs (and all networking)"
echo "  - CloudWatch Log Groups"
echo "  - ACM Certificates"
echo "  - Route53 Records"
echo "  - IAM Roles & Policies"
echo "  - And more..."
echo ""
echo "============================================================================"

if [ "$DRY_RUN" != "true" ]; then
    echo -e "${RED}THIS IS NOT A DRY RUN - RESOURCES WILL BE PERMANENTLY DELETED!${NC}"
    echo ""
    read -p "Type 'DELETE ALL' to confirm: " CONFIRM
    if [ "$CONFIRM" != "DELETE ALL" ]; then
        echo "Aborted."
        exit 1
    fi
fi

verify_account

# ============================================================================
# GLOBAL RESOURCES (not region-specific)
# ============================================================================

cleanup_s3_buckets() {
    log_info "Cleaning up S3 buckets (global)..."
    
    BUCKETS=$(aws s3api list-buckets --query 'Buckets[].Name' --output text 2>/dev/null || echo "")
    
    for bucket in $BUCKETS; do
        if [[ "$bucket" == *"warmpawz"* ]] || [[ "$bucket" == *"terraform"* ]]; then
            log_delete "S3 Bucket: $bucket"
            if [ "$DRY_RUN" != "true" ]; then
                # Delete all objects and versions
                aws s3 rm "s3://${bucket}" --recursive 2>/dev/null || true
                # Delete all versions (for versioned buckets)
                aws s3api list-object-versions --bucket "$bucket" --query 'Versions[].{Key:Key,VersionId:VersionId}' --output text 2>/dev/null | \
                while read key version; do
                    [ -n "$key" ] && aws s3api delete-object --bucket "$bucket" --key "$key" --version-id "$version" 2>/dev/null || true
                done
                # Delete delete markers
                aws s3api list-object-versions --bucket "$bucket" --query 'DeleteMarkers[].{Key:Key,VersionId:VersionId}' --output text 2>/dev/null | \
                while read key version; do
                    [ -n "$key" ] && aws s3api delete-object --bucket "$bucket" --key "$key" --version-id "$version" 2>/dev/null || true
                done
                # Delete bucket
                aws s3api delete-bucket --bucket "$bucket" 2>/dev/null || log_warn "Could not delete bucket $bucket"
            fi
        fi
    done
    log_success "S3 buckets cleaned"
}

cleanup_cloudfront() {
    log_info "Cleaning up CloudFront distributions (global)..."
    
    DISTRIBUTIONS=$(aws cloudfront list-distributions --query 'DistributionList.Items[].Id' --output text 2>/dev/null || echo "")
    
    for dist_id in $DISTRIBUTIONS; do
        log_delete "CloudFront Distribution: $dist_id"
        if [ "$DRY_RUN" != "true" ]; then
            # Get the ETag
            ETAG=$(aws cloudfront get-distribution-config --id "$dist_id" --query 'ETag' --output text 2>/dev/null || echo "")
            if [ -n "$ETAG" ]; then
                # Disable first
                CONFIG=$(aws cloudfront get-distribution-config --id "$dist_id" --query 'DistributionConfig' --output json 2>/dev/null | jq '.Enabled = false')
                echo "$CONFIG" > /tmp/cf-config.json
                aws cloudfront update-distribution --id "$dist_id" --distribution-config "file:///tmp/cf-config.json" --if-match "$ETAG" 2>/dev/null || true
                sleep 5
                # Delete
                NEW_ETAG=$(aws cloudfront get-distribution-config --id "$dist_id" --query 'ETag' --output text 2>/dev/null || echo "")
                aws cloudfront delete-distribution --id "$dist_id" --if-match "$NEW_ETAG" 2>/dev/null || log_warn "Could not delete CloudFront $dist_id (may need to wait for disable)"
            fi
        fi
    done
    log_success "CloudFront cleaned"
}

cleanup_route53() {
    log_info "Cleaning up Route53 records..."
    
    # Get hosted zone for warmpawz.com
    ZONE_ID=$(aws route53 list-hosted-zones --query 'HostedZones[?Name==`warmpawz.com.`].Id' --output text 2>/dev/null | sed 's|/hostedzone/||' || echo "")
    
    if [ -n "$ZONE_ID" ] && [ "$ZONE_ID" != "None" ]; then
        log_info "Found hosted zone: $ZONE_ID"
        
        # List and delete non-essential records (keep NS and SOA)
        RECORDS=$(aws route53 list-resource-record-sets --hosted-zone-id "$ZONE_ID" \
            --query "ResourceRecordSets[?Type!='NS' && Type!='SOA']" --output json 2>/dev/null || echo "[]")
        
        RECORD_COUNT=$(echo "$RECORDS" | jq 'length')
        
        if [ "$RECORD_COUNT" -gt 0 ]; then
            for i in $(seq 0 $((RECORD_COUNT - 1))); do
                RECORD=$(echo "$RECORDS" | jq ".[$i]")
                NAME=$(echo "$RECORD" | jq -r '.Name')
                TYPE=$(echo "$RECORD" | jq -r '.Type')
                
                # Only delete dev/stage/prod subdomains
                if [[ "$NAME" == *"dev."* ]] || [[ "$NAME" == *"stage."* ]] || [[ "$NAME" == *"api."* ]]; then
                    log_delete "Route53 Record: $NAME ($TYPE)"
                    if [ "$DRY_RUN" != "true" ]; then
                        CHANGE_BATCH=$(cat <<EOF
{
  "Changes": [
    {
      "Action": "DELETE",
      "ResourceRecordSet": $RECORD
    }
  ]
}
EOF
)
                        aws route53 change-resource-record-sets --hosted-zone-id "$ZONE_ID" --change-batch "$CHANGE_BATCH" 2>/dev/null || true
                    fi
                fi
            done
        fi
    fi
    log_success "Route53 cleaned"
}

cleanup_acm_global() {
    log_info "Cleaning up ACM certificates in us-east-1 (for CloudFront)..."
    
    CERTS=$(aws acm list-certificates --region us-east-1 --query 'CertificateSummaryList[].CertificateArn' --output text 2>/dev/null || echo "")
    
    for cert in $CERTS; do
        if [[ "$cert" == *"warmpawz"* ]] || [ -n "$(aws acm describe-certificate --certificate-arn "$cert" --region us-east-1 --query 'Certificate.DomainName' --output text 2>/dev/null | grep warmpawz)" ]; then
            log_delete "ACM Certificate (us-east-1): $cert"
            if [ "$DRY_RUN" != "true" ]; then
                aws acm delete-certificate --certificate-arn "$cert" --region us-east-1 2>/dev/null || log_warn "Could not delete cert $cert"
            fi
        fi
    done
    log_success "ACM (us-east-1) cleaned"
}

# ============================================================================
# REGIONAL RESOURCES
# ============================================================================

cleanup_region() {
    local REGION=$1
    log_info "========== Cleaning region: $REGION =========="
    
    # Lambda Functions
    log_info "Cleaning Lambda functions in $REGION..."
    FUNCTIONS=$(aws lambda list-functions --region "$REGION" --query 'Functions[].FunctionName' --output text 2>/dev/null || echo "")
    for func in $FUNCTIONS; do
        if [[ "$func" == *"warmpawz"* ]]; then
            log_delete "Lambda: $func"
            [ "$DRY_RUN" != "true" ] && aws lambda delete-function --function-name "$func" --region "$REGION" 2>/dev/null || true
        fi
    done
    
    # API Gateway V2 (HTTP APIs)
    log_info "Cleaning API Gateway (HTTP) in $REGION..."
    APIS=$(aws apigatewayv2 get-apis --region "$REGION" --query 'Items[].ApiId' --output text 2>/dev/null || echo "")
    for api in $APIS; do
        API_NAME=$(aws apigatewayv2 get-api --api-id "$api" --region "$REGION" --query 'Name' --output text 2>/dev/null || echo "")
        if [[ "$API_NAME" == *"warmpawz"* ]]; then
            # Delete custom domain mappings first
            DOMAINS=$(aws apigatewayv2 get-domain-names --region "$REGION" --query 'Items[].DomainName' --output text 2>/dev/null || echo "")
            for domain in $DOMAINS; do
                if [[ "$domain" == *"warmpawz"* ]]; then
                    log_delete "API Gateway Domain: $domain"
                    [ "$DRY_RUN" != "true" ] && aws apigatewayv2 delete-domain-name --domain-name "$domain" --region "$REGION" 2>/dev/null || true
                fi
            done
            log_delete "API Gateway: $api ($API_NAME)"
            [ "$DRY_RUN" != "true" ] && aws apigatewayv2 delete-api --api-id "$api" --region "$REGION" 2>/dev/null || true
        fi
    done
    
    # API Gateway V1 (REST APIs)
    log_info "Cleaning API Gateway (REST) in $REGION..."
    REST_APIS=$(aws apigateway get-rest-apis --region "$REGION" --query 'items[].id' --output text 2>/dev/null || echo "")
    for api in $REST_APIS; do
        API_NAME=$(aws apigateway get-rest-api --rest-api-id "$api" --region "$REGION" --query 'name' --output text 2>/dev/null || echo "")
        if [[ "$API_NAME" == *"warmpawz"* ]]; then
            log_delete "REST API: $api ($API_NAME)"
            [ "$DRY_RUN" != "true" ] && aws apigateway delete-rest-api --rest-api-id "$api" --region "$REGION" 2>/dev/null || true
        fi
    done
    
    # RDS Clusters
    log_info "Cleaning RDS in $REGION..."
    CLUSTERS=$(aws rds describe-db-clusters --region "$REGION" --query 'DBClusters[].DBClusterIdentifier' --output text 2>/dev/null || echo "")
    for cluster in $CLUSTERS; do
        if [[ "$cluster" == *"warmpawz"* ]]; then
            # Delete instances first
            INSTANCES=$(aws rds describe-db-instances --region "$REGION" --query "DBInstances[?DBClusterIdentifier=='$cluster'].DBInstanceIdentifier" --output text 2>/dev/null || echo "")
            for instance in $INSTANCES; do
                log_delete "RDS Instance: $instance"
                [ "$DRY_RUN" != "true" ] && aws rds delete-db-instance --db-instance-identifier "$instance" --skip-final-snapshot --region "$REGION" 2>/dev/null || true
            done
            log_delete "RDS Cluster: $cluster"
            [ "$DRY_RUN" != "true" ] && aws rds delete-db-cluster --db-cluster-identifier "$cluster" --skip-final-snapshot --region "$REGION" 2>/dev/null || true
        fi
    done
    
    # Standalone RDS Instances
    STANDALONE_INSTANCES=$(aws rds describe-db-instances --region "$REGION" --query 'DBInstances[?!DBClusterIdentifier].DBInstanceIdentifier' --output text 2>/dev/null || echo "")
    for instance in $STANDALONE_INSTANCES; do
        if [[ "$instance" == *"warmpawz"* ]]; then
            log_delete "RDS Instance: $instance"
            [ "$DRY_RUN" != "true" ] && aws rds delete-db-instance --db-instance-identifier "$instance" --skip-final-snapshot --region "$REGION" 2>/dev/null || true
        fi
    done
    
    # RDS Subnet Groups
    SUBNET_GROUPS=$(aws rds describe-db-subnet-groups --region "$REGION" --query 'DBSubnetGroups[].DBSubnetGroupName' --output text 2>/dev/null || echo "")
    for sg in $SUBNET_GROUPS; do
        if [[ "$sg" == *"warmpawz"* ]]; then
            log_delete "RDS Subnet Group: $sg"
            [ "$DRY_RUN" != "true" ] && aws rds delete-db-subnet-group --db-subnet-group-name "$sg" --region "$REGION" 2>/dev/null || true
        fi
    done
    
    # RDS Parameter Groups
    PARAM_GROUPS=$(aws rds describe-db-parameter-groups --region "$REGION" --query "DBParameterGroups[?!starts_with(DBParameterGroupName, 'default.')].DBParameterGroupName" --output text 2>/dev/null || echo "")
    for pg in $PARAM_GROUPS; do
        if [[ "$pg" == *"warmpawz"* ]]; then
            log_delete "RDS Parameter Group: $pg"
            [ "$DRY_RUN" != "true" ] && aws rds delete-db-parameter-group --db-parameter-group-name "$pg" --region "$REGION" 2>/dev/null || true
        fi
    done
    
    # RDS Cluster Parameter Groups
    CLUSTER_PARAM_GROUPS=$(aws rds describe-db-cluster-parameter-groups --region "$REGION" --query "DBClusterParameterGroups[?!starts_with(DBClusterParameterGroupName, 'default.')].DBClusterParameterGroupName" --output text 2>/dev/null || echo "")
    for cpg in $CLUSTER_PARAM_GROUPS; do
        if [[ "$cpg" == *"warmpawz"* ]]; then
            log_delete "RDS Cluster Parameter Group: $cpg"
            [ "$DRY_RUN" != "true" ] && aws rds delete-db-cluster-parameter-group --db-cluster-parameter-group-name "$cpg" --region "$REGION" 2>/dev/null || true
        fi
    done
    
    # DynamoDB Tables
    log_info "Cleaning DynamoDB in $REGION..."
    TABLES=$(aws dynamodb list-tables --region "$REGION" --query 'TableNames' --output text 2>/dev/null || echo "")
    for table in $TABLES; do
        if [[ "$table" == *"warmpawz"* ]]; then
            log_delete "DynamoDB Table: $table"
            [ "$DRY_RUN" != "true" ] && aws dynamodb delete-table --table-name "$table" --region "$REGION" 2>/dev/null || true
        fi
    done
    
    # Cognito User Pools
    log_info "Cleaning Cognito User Pools in $REGION..."
    POOLS=$(aws cognito-idp list-user-pools --max-results 60 --region "$REGION" --query 'UserPools[].Id' --output text 2>/dev/null || echo "")
    for pool in $POOLS; do
        POOL_NAME=$(aws cognito-idp describe-user-pool --user-pool-id "$pool" --region "$REGION" --query 'UserPool.Name' --output text 2>/dev/null || echo "")
        if [[ "$POOL_NAME" == *"warmpawz"* ]]; then
            # Delete domain first
            DOMAIN=$(aws cognito-idp describe-user-pool --user-pool-id "$pool" --region "$REGION" --query 'UserPool.Domain' --output text 2>/dev/null || echo "")
            if [ -n "$DOMAIN" ] && [ "$DOMAIN" != "None" ]; then
                log_delete "Cognito Domain: $DOMAIN"
                [ "$DRY_RUN" != "true" ] && aws cognito-idp delete-user-pool-domain --domain "$DOMAIN" --user-pool-id "$pool" --region "$REGION" 2>/dev/null || true
            fi
            log_delete "Cognito User Pool: $pool ($POOL_NAME)"
            [ "$DRY_RUN" != "true" ] && aws cognito-idp delete-user-pool --user-pool-id "$pool" --region "$REGION" 2>/dev/null || true
        fi
    done
    
    # Cognito Identity Pools
    log_info "Cleaning Cognito Identity Pools in $REGION..."
    IDENTITY_POOLS=$(aws cognito-identity list-identity-pools --max-results 60 --region "$REGION" --query 'IdentityPools[].IdentityPoolId' --output text 2>/dev/null || echo "")
    for pool in $IDENTITY_POOLS; do
        POOL_NAME=$(aws cognito-identity describe-identity-pool --identity-pool-id "$pool" --region "$REGION" --query 'IdentityPoolName' --output text 2>/dev/null || echo "")
        if [[ "$POOL_NAME" == *"warmpawz"* ]]; then
            log_delete "Cognito Identity Pool: $pool ($POOL_NAME)"
            [ "$DRY_RUN" != "true" ] && aws cognito-identity delete-identity-pool --identity-pool-id "$pool" --region "$REGION" 2>/dev/null || true
        fi
    done
    
    # SQS Queues
    log_info "Cleaning SQS queues in $REGION..."
    QUEUES=$(aws sqs list-queues --region "$REGION" --query 'QueueUrls' --output text 2>/dev/null || echo "")
    for queue in $QUEUES; do
        if [[ "$queue" == *"warmpawz"* ]]; then
            log_delete "SQS Queue: $queue"
            [ "$DRY_RUN" != "true" ] && aws sqs delete-queue --queue-url "$queue" --region "$REGION" 2>/dev/null || true
        fi
    done
    
    # SNS Topics
    log_info "Cleaning SNS topics in $REGION..."
    TOPICS=$(aws sns list-topics --region "$REGION" --query 'Topics[].TopicArn' --output text 2>/dev/null || echo "")
    for topic in $TOPICS; do
        if [[ "$topic" == *"warmpawz"* ]]; then
            log_delete "SNS Topic: $topic"
            [ "$DRY_RUN" != "true" ] && aws sns delete-topic --topic-arn "$topic" --region "$REGION" 2>/dev/null || true
        fi
    done
    
    # Secrets Manager
    log_info "Cleaning Secrets Manager in $REGION..."
    SECRETS=$(aws secretsmanager list-secrets --region "$REGION" --query 'SecretList[].Name' --output text 2>/dev/null || echo "")
    for secret in $SECRETS; do
        if [[ "$secret" == *"warmpawz"* ]]; then
            log_delete "Secret: $secret"
            [ "$DRY_RUN" != "true" ] && aws secretsmanager delete-secret --secret-id "$secret" --force-delete-without-recovery --region "$REGION" 2>/dev/null || true
        fi
    done
    
    # ACM Certificates
    log_info "Cleaning ACM in $REGION..."
    CERTS=$(aws acm list-certificates --region "$REGION" --query 'CertificateSummaryList[].CertificateArn' --output text 2>/dev/null || echo "")
    for cert in $CERTS; do
        DOMAIN=$(aws acm describe-certificate --certificate-arn "$cert" --region "$REGION" --query 'Certificate.DomainName' --output text 2>/dev/null || echo "")
        if [[ "$DOMAIN" == *"warmpawz"* ]]; then
            log_delete "ACM Certificate: $cert ($DOMAIN)"
            [ "$DRY_RUN" != "true" ] && aws acm delete-certificate --certificate-arn "$cert" --region "$REGION" 2>/dev/null || true
        fi
    done
    
    # CloudWatch Log Groups
    log_info "Cleaning CloudWatch Log Groups in $REGION..."
    LOG_GROUPS=$(aws logs describe-log-groups --region "$REGION" --query 'logGroups[].logGroupName' --output text 2>/dev/null || echo "")
    for lg in $LOG_GROUPS; do
        if [[ "$lg" == *"warmpawz"* ]] || [[ "$lg" == *"/aws/lambda/warmpawz"* ]] || [[ "$lg" == *"/aws/apigateway/warmpawz"* ]]; then
            log_delete "Log Group: $lg"
            [ "$DRY_RUN" != "true" ] && aws logs delete-log-group --log-group-name "$lg" --region "$REGION" 2>/dev/null || true
        fi
    done
    
    # CloudWatch Alarms
    log_info "Cleaning CloudWatch Alarms in $REGION..."
    ALARMS=$(aws cloudwatch describe-alarms --region "$REGION" --query 'MetricAlarms[].AlarmName' --output text 2>/dev/null || echo "")
    for alarm in $ALARMS; do
        if [[ "$alarm" == *"warmpawz"* ]]; then
            log_delete "CloudWatch Alarm: $alarm"
            [ "$DRY_RUN" != "true" ] && aws cloudwatch delete-alarms --alarm-names "$alarm" --region "$REGION" 2>/dev/null || true
        fi
    done
    
    # EC2 Instances (if any)
    log_info "Cleaning EC2 instances in $REGION..."
    INSTANCES=$(aws ec2 describe-instances --region "$REGION" --filters "Name=tag:Name,Values=*warmpawz*" --query 'Reservations[].Instances[].InstanceId' --output text 2>/dev/null || echo "")
    for instance in $INSTANCES; do
        log_delete "EC2 Instance: $instance"
        [ "$DRY_RUN" != "true" ] && aws ec2 terminate-instances --instance-ids "$instance" --region "$REGION" 2>/dev/null || true
    done
    
    # Wait for instances to terminate
    [ -n "$INSTANCES" ] && [ "$DRY_RUN" != "true" ] && sleep 30
    
    # NAT Gateways
    log_info "Cleaning NAT Gateways in $REGION..."
    NAT_GWS=$(aws ec2 describe-nat-gateways --region "$REGION" --filter "Name=tag:Name,Values=*warmpawz*" --query 'NatGateways[?State!=`deleted`].NatGatewayId' --output text 2>/dev/null || echo "")
    for nat in $NAT_GWS; do
        log_delete "NAT Gateway: $nat"
        [ "$DRY_RUN" != "true" ] && aws ec2 delete-nat-gateway --nat-gateway-id "$nat" --region "$REGION" 2>/dev/null || true
    done
    
    # Wait for NAT gateways to delete
    [ -n "$NAT_GWS" ] && [ "$DRY_RUN" != "true" ] && sleep 60
    
    # Elastic IPs
    log_info "Cleaning Elastic IPs in $REGION..."
    EIPS=$(aws ec2 describe-addresses --region "$REGION" --filters "Name=tag:Name,Values=*warmpawz*" --query 'Addresses[].AllocationId' --output text 2>/dev/null || echo "")
    for eip in $EIPS; do
        log_delete "Elastic IP: $eip"
        [ "$DRY_RUN" != "true" ] && aws ec2 release-address --allocation-id "$eip" --region "$REGION" 2>/dev/null || true
    done
    
    # Internet Gateways
    log_info "Cleaning Internet Gateways in $REGION..."
    IGWS=$(aws ec2 describe-internet-gateways --region "$REGION" --filters "Name=tag:Name,Values=*warmpawz*" --query 'InternetGateways[].InternetGatewayId' --output text 2>/dev/null || echo "")
    for igw in $IGWS; do
        # Detach first
        VPC_ID=$(aws ec2 describe-internet-gateways --internet-gateway-ids "$igw" --region "$REGION" --query 'InternetGateways[0].Attachments[0].VpcId' --output text 2>/dev/null || echo "")
        if [ -n "$VPC_ID" ] && [ "$VPC_ID" != "None" ]; then
            log_info "Detaching IGW $igw from VPC $VPC_ID"
            [ "$DRY_RUN" != "true" ] && aws ec2 detach-internet-gateway --internet-gateway-id "$igw" --vpc-id "$VPC_ID" --region "$REGION" 2>/dev/null || true
        fi
        log_delete "Internet Gateway: $igw"
        [ "$DRY_RUN" != "true" ] && aws ec2 delete-internet-gateway --internet-gateway-id "$igw" --region "$REGION" 2>/dev/null || true
    done
    
    # VPC Endpoints
    log_info "Cleaning VPC Endpoints in $REGION..."
    ENDPOINTS=$(aws ec2 describe-vpc-endpoints --region "$REGION" --filters "Name=tag:Name,Values=*warmpawz*" --query 'VpcEndpoints[].VpcEndpointId' --output text 2>/dev/null || echo "")
    for ep in $ENDPOINTS; do
        log_delete "VPC Endpoint: $ep"
        [ "$DRY_RUN" != "true" ] && aws ec2 delete-vpc-endpoints --vpc-endpoint-ids "$ep" --region "$REGION" 2>/dev/null || true
    done
    
    # Security Groups (non-default)
    log_info "Cleaning Security Groups in $REGION..."
    SGS=$(aws ec2 describe-security-groups --region "$REGION" --filters "Name=tag:Name,Values=*warmpawz*" --query 'SecurityGroups[?GroupName!=`default`].GroupId' --output text 2>/dev/null || echo "")
    for sg in $SGS; do
        log_delete "Security Group: $sg"
        [ "$DRY_RUN" != "true" ] && aws ec2 delete-security-group --group-id "$sg" --region "$REGION" 2>/dev/null || true
    done
    
    # Subnets
    log_info "Cleaning Subnets in $REGION..."
    SUBNETS=$(aws ec2 describe-subnets --region "$REGION" --filters "Name=tag:Name,Values=*warmpawz*" --query 'Subnets[].SubnetId' --output text 2>/dev/null || echo "")
    for subnet in $SUBNETS; do
        log_delete "Subnet: $subnet"
        [ "$DRY_RUN" != "true" ] && aws ec2 delete-subnet --subnet-id "$subnet" --region "$REGION" 2>/dev/null || true
    done
    
    # Route Tables (non-main)
    log_info "Cleaning Route Tables in $REGION..."
    RTS=$(aws ec2 describe-route-tables --region "$REGION" --filters "Name=tag:Name,Values=*warmpawz*" --query 'RouteTables[].RouteTableId' --output text 2>/dev/null || echo "")
    for rt in $RTS; do
        # Disassociate first
        ASSOCS=$(aws ec2 describe-route-tables --route-table-ids "$rt" --region "$REGION" --query 'RouteTables[0].Associations[?!Main].RouteTableAssociationId' --output text 2>/dev/null || echo "")
        for assoc in $ASSOCS; do
            [ "$DRY_RUN" != "true" ] && aws ec2 disassociate-route-table --association-id "$assoc" --region "$REGION" 2>/dev/null || true
        done
        log_delete "Route Table: $rt"
        [ "$DRY_RUN" != "true" ] && aws ec2 delete-route-table --route-table-id "$rt" --region "$REGION" 2>/dev/null || true
    done
    
    # VPCs
    log_info "Cleaning VPCs in $REGION..."
    VPCS=$(aws ec2 describe-vpcs --region "$REGION" --filters "Name=tag:Name,Values=*warmpawz*" --query 'Vpcs[].VpcId' --output text 2>/dev/null || echo "")
    for vpc in $VPCS; do
        log_delete "VPC: $vpc"
        [ "$DRY_RUN" != "true" ] && aws ec2 delete-vpc --vpc-id "$vpc" --region "$REGION" 2>/dev/null || log_warn "Could not delete VPC $vpc - may have dependent resources"
    done
    
    log_success "Region $REGION cleaned"
}

# ============================================================================
# IAM RESOURCES (global, but last because other resources depend on them)
# ============================================================================

cleanup_iam() {
    log_info "Cleaning IAM resources..."
    
    # IAM Roles
    ROLES=$(aws iam list-roles --query 'Roles[].RoleName' --output text 2>/dev/null || echo "")
    for role in $ROLES; do
        if [[ "$role" == *"warmpawz"* ]]; then
            # Detach managed policies
            POLICIES=$(aws iam list-attached-role-policies --role-name "$role" --query 'AttachedPolicies[].PolicyArn' --output text 2>/dev/null || echo "")
            for policy in $POLICIES; do
                [ "$DRY_RUN" != "true" ] && aws iam detach-role-policy --role-name "$role" --policy-arn "$policy" 2>/dev/null || true
            done
            # Delete inline policies
            INLINE_POLICIES=$(aws iam list-role-policies --role-name "$role" --query 'PolicyNames' --output text 2>/dev/null || echo "")
            for policy in $INLINE_POLICIES; do
                [ "$DRY_RUN" != "true" ] && aws iam delete-role-policy --role-name "$role" --policy-name "$policy" 2>/dev/null || true
            done
            # Delete instance profiles
            INSTANCE_PROFILES=$(aws iam list-instance-profiles-for-role --role-name "$role" --query 'InstanceProfiles[].InstanceProfileName' --output text 2>/dev/null || echo "")
            for profile in $INSTANCE_PROFILES; do
                [ "$DRY_RUN" != "true" ] && aws iam remove-role-from-instance-profile --instance-profile-name "$profile" --role-name "$role" 2>/dev/null || true
            done
            log_delete "IAM Role: $role"
            [ "$DRY_RUN" != "true" ] && aws iam delete-role --role-name "$role" 2>/dev/null || true
        fi
    done
    
    # IAM Policies
    POLICIES=$(aws iam list-policies --scope Local --query 'Policies[].Arn' --output text 2>/dev/null || echo "")
    for policy in $POLICIES; do
        POLICY_NAME=$(echo "$policy" | awk -F/ '{print $NF}')
        if [[ "$POLICY_NAME" == *"warmpawz"* ]]; then
            # Delete policy versions first (except default)
            VERSIONS=$(aws iam list-policy-versions --policy-arn "$policy" --query 'Versions[?!IsDefaultVersion].VersionId' --output text 2>/dev/null || echo "")
            for version in $VERSIONS; do
                [ "$DRY_RUN" != "true" ] && aws iam delete-policy-version --policy-arn "$policy" --version-id "$version" 2>/dev/null || true
            done
            log_delete "IAM Policy: $policy"
            [ "$DRY_RUN" != "true" ] && aws iam delete-policy --policy-arn "$policy" 2>/dev/null || true
        fi
    done
    
    log_success "IAM resources cleaned"
}

# ============================================================================
# TERRAFORM STATE
# ============================================================================

cleanup_terraform_state() {
    log_info "Cleaning Terraform state resources..."
    
    # DynamoDB table for state locking
    for REGION in $ALL_REGIONS; do
        TABLES=$(aws dynamodb list-tables --region "$REGION" --query 'TableNames' --output text 2>/dev/null || echo "")
        for table in $TABLES; do
            if [[ "$table" == *"terraform"* ]]; then
                log_delete "Terraform Lock Table: $table ($REGION)"
                [ "$DRY_RUN" != "true" ] && aws dynamodb delete-table --table-name "$table" --region "$REGION" 2>/dev/null || true
            fi
        done
    done
    
    # S3 bucket for state (delete last as it's global)
    BUCKETS=$(aws s3api list-buckets --query 'Buckets[].Name' --output text 2>/dev/null || echo "")
    for bucket in $BUCKETS; do
        if [[ "$bucket" == *"terraform-state"* ]]; then
            log_delete "Terraform State Bucket: $bucket"
            if [ "$DRY_RUN" != "true" ]; then
                aws s3 rm "s3://${bucket}" --recursive 2>/dev/null || true
                aws s3api list-object-versions --bucket "$bucket" --query 'Versions[].{Key:Key,VersionId:VersionId}' --output text 2>/dev/null | \
                while read key version; do
                    [ -n "$key" ] && aws s3api delete-object --bucket "$bucket" --key "$key" --version-id "$version" 2>/dev/null || true
                done
                aws s3api list-object-versions --bucket "$bucket" --query 'DeleteMarkers[].{Key:Key,VersionId:VersionId}' --output text 2>/dev/null | \
                while read key version; do
                    [ -n "$key" ] && aws s3api delete-object --bucket "$bucket" --key "$key" --version-id "$version" 2>/dev/null || true
                done
                aws s3api delete-bucket --bucket "$bucket" 2>/dev/null || true
            fi
        fi
    done
    
    log_success "Terraform state cleaned"
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

echo ""
log_info "Starting full account cleanup..."
echo ""

# Global resources first
cleanup_cloudfront
cleanup_route53
cleanup_acm_global
cleanup_s3_buckets

# Regional resources
for REGION in $ALL_REGIONS; do
    cleanup_region "$REGION"
done

# IAM last (dependencies)
cleanup_iam

# Terraform state last (need to be able to run terraform after this)
cleanup_terraform_state

echo ""
echo "============================================================================"
echo -e "${GREEN}✅ FULL ACCOUNT CLEANUP COMPLETE${NC}"
echo "============================================================================"
echo ""
echo "Account $ACCOUNT_ID has been cleaned of all warmpawz resources."
echo ""
if [ "$DRY_RUN" == "true" ]; then
    echo -e "${YELLOW}This was a DRY RUN - no resources were actually deleted.${NC}"
    echo "Run without DRY_RUN=true to actually delete resources."
fi
echo ""

