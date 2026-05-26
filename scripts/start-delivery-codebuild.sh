#!/usr/bin/env bash
# Start the dev delivery-service image build in CodeBuild (Docker + Maven inside Dockerfile).
#
# Prerequisite: Terraform applied with delivery_codebuild_github_url set,
#               CodeStar connection "warmpawz-dev-delivery-github" status = Available
#               (complete GitHub in AWS Console → Developer Tools → Settings → Connections).
#
# Usage:
#   ./scripts/start-delivery-codebuild.sh
# Optional overrides:
#   AWS_REGION=ap-south-1 CODEBUILD_PROJECT=warmpawz-dev-delivery-image ./scripts/start-delivery-codebuild.sh

set -euo pipefail

REGION="${AWS_REGION:-ap-south-1}"
PROJECT="${CODEBUILD_PROJECT:-warmpawz-dev-delivery-image}"

exec aws codebuild start-build --region "$REGION" --project-name "$PROJECT"
