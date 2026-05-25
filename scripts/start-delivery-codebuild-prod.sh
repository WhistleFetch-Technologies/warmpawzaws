#!/usr/bin/env bash
# Start prod delivery-service CodeBuild (build → ECR warmpawz-prod-delivery-svc → ECS rollout).
#
# Prerequisite: terraform apply with delivery_codebuild_github_url set
#   (see infra/envs/prod/delivery.auto.tfvars).
#
# Usage:
#   ./scripts/start-delivery-codebuild-prod.sh

set -euo pipefail

REGION="${AWS_REGION:-ap-south-1}"
PROJECT="${CODEBUILD_PROJECT:-warmpawz-prod-delivery-image}"

echo "Starting CodeBuild project: $PROJECT (region $REGION)"
BUILD_ID=$(aws codebuild start-build --region "$REGION" --project-name "$PROJECT" --query "build.id" --output text)
echo "Build ID: $BUILD_ID"
echo "Logs: aws codebuild batch-get-builds --ids $BUILD_ID --region $REGION --query 'builds[0].buildStatus'"
