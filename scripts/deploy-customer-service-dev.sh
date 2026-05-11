#!/usr/bin/env bash
# Deploy customer-service to the existing dev ECS service.
#
# Defaults are for warmpawz dev and can be overridden via env vars:
#   AWS_ACCOUNT_ID, AWS_REGION, ECR_REPOSITORY, ECS_CLUSTER, ECS_SERVICE,
#   ECS_TASK_FAMILY, ECS_CONTAINER_NAME, IMAGE_TAG
#
# This script does not create infrastructure and does not use CDK.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVICE_DIR="$PROJECT_ROOT/services/customer-service"

AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-057442119249}"
AWS_REGION="${AWS_REGION:-ap-south-1}"
ECR_REPOSITORY="${ECR_REPOSITORY:-warmpawz-dev-customer-service}"
# Discovered in AWS ap-south-1 / 057442119249 (override if your env differs).
ECS_CLUSTER="${ECS_CLUSTER:-warmpawz-dev-delivery-cluster}"
ECS_SERVICE="${ECS_SERVICE:-warmpawz-dev-customer-service-v3}"
ECS_TASK_FAMILY="${ECS_TASK_FAMILY:-warmpawz-dev-customer-service-task}"
ECS_CONTAINER_NAME="${ECS_CONTAINER_NAME:-customer-service}"
IMAGE_TAG="${IMAGE_TAG:-$(date +%Y%m%d%H%M%S)}"
MAVEN_WRAPPER="${MAVEN_WRAPPER:-./mvnw}"
JIB_GOAL="${JIB_GOAL:-com.google.cloud.tools:jib-maven-plugin:3.4.5:build}"

IMAGE_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG"
TMP_DIR="$PROJECT_ROOT/.deploy-customer-service-tmp-$$-$RANDOM"
ECS_REGISTER_JSON_COPY=""
mkdir -p "$TMP_DIR"
trap 'rm -f "${ECS_REGISTER_JSON_COPY:-}"; rm -rf "$TMP_DIR"' EXIT

# Windows aws.exe does not load JSON from repo paths that contain spaces, and it does
# not honor Git Bash's /dev/stdin. Copy to a writable directory without spaces in the
# path, then pass file:///C:/... (built via cygpath). EXIT trap removes ECS_REGISTER_JSON_COPY.
prepare_ecs_register_json_copy() {
  local src="$1"
  local safe_dir=""
  if [[ -d "/c/WINDOWS/Temp" && -w "/c/WINDOWS/Temp" ]]; then
    safe_dir="/c/WINDOWS/Temp"
  elif [[ -n "${WINDIR:-}" && -d "${WINDIR}/Temp" && -w "${WINDIR}/Temp" ]]; then
    safe_dir="$(cygpath -u "$WINDIR/Temp")"
  elif [[ -d /tmp && -w /tmp ]]; then
    safe_dir="/tmp"
  else
    safe_dir="$TMP_DIR"
  fi
  ECS_REGISTER_JSON_COPY="$safe_dir/warmpawz-ecs-register-$$-$RANDOM.json"
  cp "$src" "$ECS_REGISTER_JSON_COPY"

  if command -v cygpath >/dev/null 2>&1; then
    local win
    win="$(cygpath -w "$ECS_REGISTER_JSON_COPY")"
    win="${win//\\//}"
    # Windows aws.exe rejects file:///C:/... (Errno 22); use file://C:/... (two slashes).
    ECS_REGISTER_JSON_URI="file://$win"
  else
    ECS_REGISTER_JSON_URI="file://$ECS_REGISTER_JSON_COPY"
  fi
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_command aws

require_command node

echo "Deploying customer-service to dev ECS"
echo "  Region:     $AWS_REGION"
echo "  Account:    $AWS_ACCOUNT_ID"
echo "  ECR image:  $IMAGE_URI"
echo "  ECS:        $ECS_CLUSTER / $ECS_SERVICE"
echo ""

echo "Checking ECR repository..."
aws ecr describe-repositories \
  --repository-names "$ECR_REPOSITORY" \
  --region "$AWS_REGION" >/dev/null

echo "Packaging customer-service..."
cd "$SERVICE_DIR"
"$MAVEN_WRAPPER" -DskipTests package

echo "Building and pushing image with Jib (no local Docker daemon required)..."
ECR_PASSWORD="$(aws ecr get-login-password --region "$AWS_REGION")"
"$MAVEN_WRAPPER" -DskipTests compile "$JIB_GOAL" \
  -Djib.to.image="$IMAGE_URI" \
  -Djib.to.auth.username=AWS \
  -Djib.to.auth.password="$ECR_PASSWORD"

echo "Resolving current ECS task definition..."
CURRENT_TASK_DEFINITION="$(
  aws ecs describe-services \
    --cluster "$ECS_CLUSTER" \
    --services "$ECS_SERVICE" \
    --region "$AWS_REGION" \
    --query 'services[0].taskDefinition' \
    --output text
)"

if [[ -z "$CURRENT_TASK_DEFINITION" || "$CURRENT_TASK_DEFINITION" == "None" ]]; then
  echo "Could not resolve current task definition for $ECS_SERVICE in $ECS_CLUSTER" >&2
  exit 1
fi

aws ecs describe-task-definition \
  --task-definition "$CURRENT_TASK_DEFINITION" \
  --region "$AWS_REGION" \
  --query taskDefinition \
  > "$TMP_DIR/current-task-definition.json"

TASK_JSON="$TMP_DIR/register-task-definition.json"
export TASK_SOURCE="$TMP_DIR/current-task-definition.json"
export TASK_TARGET="$TASK_JSON"
export ECS_TASK_FAMILY ECS_CONTAINER_NAME IMAGE_URI
node <<'NODE'
const fs = require('fs');
const task = JSON.parse(fs.readFileSync(process.env.TASK_SOURCE, 'utf8'));
for (const key of [
  'taskDefinitionArn',
  'revision',
  'status',
  'requiresAttributes',
  'compatibilities',
  'registeredAt',
  'registeredBy',
]) {
  delete task[key];
}
task.family = process.env.ECS_TASK_FAMILY;
const containers = task.containerDefinitions || [];
const want = process.env.ECS_CONTAINER_NAME;
let target = containers.find((c) => c.name === want);
if (!target) {
  if (!containers.length) {
    console.error('task definition has no containerDefinitions');
    process.exit(1);
  }
  target = containers[0];
  console.error(`Container ${want} not found; updating first container ${target.name}`);
}
target.image = process.env.IMAGE_URI;
fs.writeFileSync(process.env.TASK_TARGET, JSON.stringify(task, null, 2));
NODE

echo "Registering new task definition revision..."
prepare_ecs_register_json_copy "$TASK_JSON"
NEW_TASK_DEFINITION="$(
  aws ecs register-task-definition \
    --cli-input-json "$ECS_REGISTER_JSON_URI" \
    --region "$AWS_REGION" \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text
)"
rm -f "$ECS_REGISTER_JSON_COPY"

echo "Updating ECS service..."
aws ecs update-service \
  --cluster "$ECS_CLUSTER" \
  --service "$ECS_SERVICE" \
  --task-definition "$NEW_TASK_DEFINITION" \
  --force-new-deployment \
  --region "$AWS_REGION" >/dev/null

echo "Deployment started."
echo "  Task definition: $NEW_TASK_DEFINITION"
echo "  Image:           $IMAGE_URI"
