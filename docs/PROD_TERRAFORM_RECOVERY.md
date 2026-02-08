# Prod Terraform recovery (NAT + "different networks")

If `terraform apply` fails with:

- **"The subnet ID 'subnet-xxx' does not exist"** (NAT creation), or  
- **"You have specified two resources that belong to different networks"** (RDS security group), or  
- **"DB subnet group doesn't meet Availability Zone (AZ) coverage requirement"** (no database-tagged subnets in existing VPC), or  
- **"The new Subnets are not in the same Vpc as the existing subnet group"** (RDS DB subnet group),

do the following. The VPC module now falls back to **private subnets** for RDS when the existing VPC has no (or &lt; 2) database-tagged subnets, so re-run plan/apply after pulling latest.

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

In CI, the prod workflow uses `-var-file=terraform.tfvars` so the same values are applied. Ensure `terraform.tfvars` has `existing_vpc_id` and `existing_nat_gateway_id` (or set `TF_VAR_*` if you prefer not to commit them).

## 4. "Not in the same Vpc as the existing subnet group"

If the **existing** prod DB subnet group lives in a different VPC than the one in `existing_vpc_id` (e.g. subnet group in `vpc-0b72e8dad5d61bf21`, NAT/VPC in `vpc-02a4893e5e582c4d8`), Terraform must not change the subnet group’s subnets.

- The RDS module now uses **lifecycle { ignore_changes = [subnet_ids] }** on the DB subnet group so it is never updated after create.
- When `use_existing_subnet_group_vpc = true` (prod), the RDS security group and cluster use the **subnet group’s VPC** (`vpc_id_for_rds`) so they stay in the same VPC as the subnet group.
- Run apply again; no further change to the subnet group will be attempted.
