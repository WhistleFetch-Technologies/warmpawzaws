#!/usr/bin/env bash
#
# allow-rds-access.sh — Add or revoke temporary inbound TCP/5432 from this machine's public IP
# to the first VPC security group attached to an RDS instance.
#
# Usage:
#   ./allow-rds-access.sh <DB_INSTANCE_ID>
#   ./allow-rds-access.sh --revoke <DB_INSTANCE_ID>
#
# Note: --revoke removes the rule for your *current* public IP only. If your IP changed
# since you ran without --revoke, add a temporary rule for the old CIDR in the console or
# revoke by matching SecurityGroupRuleId from aws ec2 describe-security-group-rules.
#
# Prerequisites: aws CLI, curl. Set AWS_REGION or AWS_DEFAULT_REGION (or pass --region).
#
# Safety: Only the detected public IPv4 /32 is allowed — never 0.0.0.0/0.

set -euo pipefail

readonly SCRIPT_NAME="$(basename "$0")"
readonly PROTOCOL="tcp"
readonly PORT="5432"

usage() {
  cat <<EOF
Usage:
  $SCRIPT_NAME [--region REGION] <DB_INSTANCE_ID>
  $SCRIPT_NAME [--region REGION] --revoke <DB_INSTANCE_ID>

Fetches the RDS instance's first VPC security group, detects this host's public IPv4
(via https://ifconfig.me), and adds or removes an inbound rule for TCP port $PORT.

Environment:
  AWS_REGION or AWS_DEFAULT_REGION — required unless --region is passed.

Examples:
  $SCRIPT_NAME warmpawz-dev-instance-1
  AWS_REGION=ap-south-1 $SCRIPT_NAME --revoke warmpawz-dev-instance-1
EOF
}

log_info()  { printf '%s\n' "$*"; }
log_err()   { printf '%s\n' "$*" >&2; }

require_cmd() {
  local c="$1"
  if ! command -v "$c" >/dev/null 2>&1; then
    log_err "Error: '$c' is not installed or not on PATH."
    exit 1
  fi
}

validate_aws_auth() {
  if ! aws sts get-caller-identity >/dev/null 2>&1; then
    log_err "Error: AWS CLI is not authenticated. Run 'aws configure' or set credentials / SSO."
    exit 1
  fi
}

# Reject unsafe or invalid CIDR targets (never open to the world).
validate_ipv4_cidr() {
  local cidr="$1"
  if [[ -z "$cidr" || "$cidr" == "0.0.0.0/0" ]]; then
    log_err "Error: Refusing to use empty or 0.0.0.0/0 — only a single public IP /32 is allowed."
    exit 1
  fi
  if [[ ! "$cidr" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}/32$ ]]; then
    log_err "Error: Invalid or non-/32 IPv4 CIDR: '$cidr'"
    exit 1
  fi
}

fetch_public_ip_cidr() {
  local ip
  ip="$(curl -sS --max-time 15 'https://ifconfig.me' | tr -d '[:space:]')"
  if [[ -z "$ip" ]]; then
    log_err "Error: Could not determine public IP (empty response from ifconfig.me)."
    exit 1
  fi
  # Basic IPv4 shape check
  if [[ ! "$ip" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; then
    log_err "Error: Public IP does not look like IPv4: '$ip'"
    exit 1
  fi
  echo "${ip}/32"
}

get_rds_first_sg_id() {
  local db_id="$1"
  local region="$2"
  local sg_id out ec
  set +e
  out="$(aws rds describe-db-instances \
    --db-instance-identifier "$db_id" \
    --region "$region" \
    --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' \
    --output text 2>&1)"
  ec=$?
  set -e
  if [[ "$ec" -ne 0 ]]; then
    log_err "Error: describe-db-instances failed for '$db_id':"
    log_err "$out"
    exit 1
  fi
  sg_id="$(echo "$out" | tr -d '[:space:]')"
  if [[ -z "$sg_id" || "$sg_id" == "None" ]]; then
    log_err "Error: Could not read VpcSecurityGroups[0] for RDS instance '$db_id'. Is the instance in a VPC with security groups?"
    exit 1
  fi
  echo "$sg_id"
}

authorize_ingress() {
  local sg_id="$1" cidr="$2" region="$3"
  local out ec
  set +e
  out="$(aws ec2 authorize-security-group-ingress \
    --group-id "$sg_id" \
    --protocol "$PROTOCOL" \
    --port "$PORT" \
    --cidr "$cidr" \
    --region "$region" \
    2>&1)"
  ec=$?
  set -e

  if [[ "$ec" -eq 0 ]]; then
    log_info "Success: Inbound rule added (TCP $PORT from $cidr)."
    return 0
  fi
  if echo "$out" | grep -q 'InvalidPermission\.Duplicate'; then
    log_info "Rule already exists (TCP $PORT from $cidr)."
    return 0
  fi
  log_err "Failure: authorize-security-group-ingress failed:"
  log_err "$out"
  return 1
}

revoke_ingress() {
  local sg_id="$1" cidr="$2" region="$3"
  local out ec
  set +e
  out="$(aws ec2 revoke-security-group-ingress \
    --group-id "$sg_id" \
    --protocol "$PROTOCOL" \
    --port "$PORT" \
    --cidr "$cidr" \
    --region "$region" \
    2>&1)"
  ec=$?
  set -e

  if [[ "$ec" -eq 0 ]]; then
    log_info "Success: Inbound rule removed (TCP $PORT from $cidr)."
    return 0
  fi
  if echo "$out" | grep -qi 'InvalidPermission\.NotFound'; then
    log_info "No matching rule found (already revoked or never added)."
    return 0
  fi
  log_err "Failure: revoke-security-group-ingress failed:"
  log_err "$out"
  return 1
}

main() {
  local revoke=false
  local region="${AWS_REGION:-${AWS_DEFAULT_REGION:-}}"
  local db_id=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      -h|--help)
        usage
        exit 0
        ;;
      --revoke)
        revoke=true
        shift
        ;;
      --region)
        [[ $# -ge 2 ]] || { log_err "Error: --region requires a value."; exit 1; }
        region="$2"
        shift 2
        ;;
      *)
        if [[ -n "$db_id" ]]; then
          log_err "Error: Unexpected argument: $1"
          usage >&2
          exit 1
        fi
        db_id="$1"
        shift
        ;;
    esac
  done

  if [[ -z "$db_id" ]]; then
    log_err "Error: DB instance identifier is required."
    usage >&2
    exit 1
  fi

  if [[ -z "$region" ]]; then
    log_err "Error: Set AWS_REGION or AWS_DEFAULT_REGION, or pass --region."
    exit 1
  fi

  require_cmd aws
  require_cmd curl
  validate_aws_auth

  log_info "AWS identity: $(aws sts get-caller-identity --query Arn --output text 2>/dev/null || echo unknown)"

  local cidr
  cidr="$(fetch_public_ip_cidr)"
  validate_ipv4_cidr "$cidr"

  local sg_id
  sg_id="$(get_rds_first_sg_id "$db_id" "$region")"

  log_info "Security Group ID: $sg_id"
  log_info "Detected IP (CIDR): $cidr"
  log_info "RDS instance:       $db_id"
  log_info "Region:             $region"

  if [[ "$revoke" == true ]]; then
    revoke_ingress "$sg_id" "$cidr" "$region"
  else
    authorize_ingress "$sg_id" "$cidr" "$region"
  fi
}

main "$@"
