# Prod Terraform recovery (NAT + "different networks")

If `terraform apply` fails with:

- **"The subnet ID 'subnet-xxx' does not exist"** (NAT creation), or  
- **"You have specified two resources that belong to different networks"** (RDS security group),

do the following.

## 1. Use the VPC where Lambda lives

RDS and Lambda must be in the **same VPC**. Get that VPC ID (e.g. from Lambda in AWS Console → Configuration → VPC, or):

```bash
aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=*lambda*" "Name=tag:Environment,Values=prod" \
  --query 'SecurityGroups[0].VpcId' --output text --region ap-south-1
```

Or by tag:

```bash
aws ec2 describe-vpcs \
  --filters Name=tag:Name,Values=warmpawz-prod-vpc Name=tag:Environment,Values=prod \
  --query 'Vpcs[0].VpcId' --output text --region ap-south-1
```

Set this as `existing_vpc_id` so Terraform uses this VPC for both Lambda and RDS (fixes "different networks").

## 2. Create NAT gateway via CLI (optional)

If Terraform should not create the NAT (e.g. subnets were destroyed or you want to create it once manually):

```bash
./scripts/create-prod-nat-gateway.sh <vpc-id>
```

The script prints `existing_vpc_id` and `existing_nat_gateway_id`. Add them to `infra/envs/prod/terraform.tfvars` or pass as `-var`.

## 3. Pass the values into Terraform

In `infra/envs/prod/terraform.tfvars` (or via `-var`):

```hcl
# Use the VPC that contains Lambda (fixes RDS "different networks")
existing_vpc_id = "vpc-XXXXXXXX"

# Use NAT created by scripts/create-prod-nat-gateway.sh (Terraform will not create NAT)
existing_nat_gateway_id = "nat-XXXXXXXX"
```

Then:

```bash
cd infra/envs/prod
terraform init -backend-config=backend.hcl
terraform plan -var="opensearch_master_password=..." -out=tfplan
terraform apply -auto-approve tfplan
```

In CI, set `TF_VAR_existing_vpc_id` and `TF_VAR_existing_nat_gateway_id` (or use a tfvars file that is not committed).
