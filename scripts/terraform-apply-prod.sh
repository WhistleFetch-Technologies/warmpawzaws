#!/usr/bin/env bash
# Run Terraform plan + apply for prod from repo root.
# Usage: ./scripts/terraform-apply-prod.sh
#
# If you see "timeout while waiting for plugin to start", run this script from
# your local terminal (not Cursor's integrated terminal) — the AWS provider
# needs more resources than some environments allow.
# On state lock error, run: cd infra/envs/prod && terraform force-unlock -force <LOCK_ID>

set -e
cd "$(dirname "$0")/../infra/envs/prod"

echo "==> Terraform init..."
terraform init -backend-config=backend.hcl -input=false

echo "==> Terraform plan..."
TF_LOG=ERROR terraform plan \
  -parallelism=1 \
  -var-file=terraform.tfvars \
  -var="opensearch_master_password=Warmpawz2025" \
  -input=false \
  -out=tfplan || {
  echo ""
  echo "If the error was 'state lock', run: cd infra/envs/prod && terraform force-unlock -force <LOCK_ID>"
  echo "If the error was 'timeout while waiting for plugin to start', run this script from your local terminal."
  exit 1
}

echo "==> Terraform apply..."
TF_LOG=ERROR terraform apply -parallelism=1 -auto-approve tfplan

echo "==> Done."
