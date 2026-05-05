#!/usr/bin/env bash
# Build and push delivery-service to ECR, then force ECS to pull the new image.
# Prereq: Terraform applied with enable_delivery_stack=true and delivery_service_image
#         set to the same ECR URI (default repo name produced by infra/modules/delivery-service-ecs).
#
# Usage (from repo root, AWS CLI configured for ap-south-1):
#   ./scripts/deploy-delivery-service.sh
# Optional:
#   ECS_CLUSTER='warmpawz-dev-delivery-cluster' ECS_SERVICE='warmpawz-dev-delivery-svc' ./scripts/deploy-delivery-service.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGION="${AWS_REGION:-ap-south-1}"
SERVICE_DIR="${ROOT}/services/delivery-service"
REPO_NAME="${DELIVERY_ECR_REPO:-warmpawz-dev-delivery-svc}"
TAG="${DELIVERY_IMAGE_TAG:-latest}"

ACCOUNT="$(aws sts get-caller-identity --query Account --output text --region "$REGION")"
IMAGE_URI="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com/${REPO_NAME}:${TAG}"

echo "🔨 Building Docker image..."
docker build -t "${REPO_NAME}:${TAG}" "$SERVICE_DIR"

echo "🔑 ECR login..."
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com"

echo "📤 Push ${IMAGE_URI}"
docker tag "${REPO_NAME}:${TAG}" "$IMAGE_URI"
docker push "$IMAGE_URI"

CLUSTER="${ECS_CLUSTER:-}"
SERV="${ECS_SERVICE:-}"
if [[ -n "${CLUSTER}" && -n "${SERV}" ]]; then
  echo "🔄 ecs update-service ..."
  aws ecs update-service --region "$REGION" --cluster "$CLUSTER" --service "$SERV" --force-new-deployment >/dev/null
  echo "✅ Rolled ECS service ${SERV}"
else
  echo "ECS rollout skipped. After first terraform apply with the stack enabled, export:"
  echo '  ECS_CLUSTER=$(terraform output -raw delivery_ecs_cluster_name 2>/dev/null)'
  echo "  ECS_SERVICE=<task family service name — see ECS console>"
  echo "and re-run, or redeploy tasks from AWS Console → ECS → Update service → Force redeploy."
fi
