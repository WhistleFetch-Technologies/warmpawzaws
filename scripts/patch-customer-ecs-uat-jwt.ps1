# Enable UAT JWT on dev customer-service ECS (matches Lambda default UAT_JWT_SECRET).
$ErrorActionPreference = "Stop"
$Region = "ap-south-1"
$Family = "warmpawz-dev-customer-task"
$Cluster = "warmpawz-dev-customer-cluster"
$Service = "warmpawz-dev-customer-svc"
$UatSecret = "uat-secret-key-change-in-production"

$tmp = Join-Path $env:TEMP "ecs-customer-patch"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$taskFile = Join-Path $tmp "task.json"
$registerFile = Join-Path $tmp "register.json"

[System.IO.File]::WriteAllText(
  $taskFile,
  (aws ecs describe-task-definition --task-definition $Family --region $Region --query taskDefinition --output json)
)

$patchScript = @"
const fs = require('fs');
const t = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
for (const k of ['taskDefinitionArn','revision','status','requiresAttributes','compatibilities','registeredAt','registeredBy']) {
  delete t[k];
}
const c = t.containerDefinitions.find(x => x.name === 'customer-service') || t.containerDefinitions[0];
c.environment = c.environment || [];
const upsert = (n, v) => {
  const e = c.environment.find(x => x.name === n);
  if (e) e.value = v;
  else c.environment.push({ name: n, value: v });
};
upsert('APP_SECURITY_ENABLED', 'false');
upsert('APP_SECURITY_UAT_JWT_ENABLED', 'true');
upsert('UAT_JWT_SECRET', process.argv[2]);
upsert('SPRING_JPA_HIBERNATE_DDL_AUTO', 'none');
fs.writeFileSync(process.argv[3], JSON.stringify(t));
"@

node -e $patchScript $taskFile $UatSecret $registerFile

$arn = aws ecs register-task-definition --cli-input-json "file://$registerFile" --region $Region --query "taskDefinition.taskDefinitionArn" --output text
aws ecs update-service --cluster $Cluster --service $Service --task-definition $arn --force-new-deployment --region $Region | Out-Null
Write-Host "Updated $Service -> $arn"
