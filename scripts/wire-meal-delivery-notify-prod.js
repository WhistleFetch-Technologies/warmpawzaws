#!/usr/bin/env node
/**
 * Wire MEAL_DELIVERY_NOTIFY_SECRET on prod Lambda + ECS delivery-service.
 * Usage: node scripts/wire-meal-delivery-notify-prod.js
 * Optional: MEAL_DELIVERY_NOTIFY_SECRET env or --secret=... (default generated prod value)
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const LAMBDA = 'warmpawz-prod-api-handler';
const TASK_FAMILY = 'warmpawz-prod-delivery-task';
const CLUSTER = 'warmpawz-prod-delivery-cluster';
const SERVICE = 'warmpawz-prod-delivery-svc';
const SSM_NAME = '/warmpawz/prod/features/mealDeliveryNotifySecret';

const secret =
  process.env.MEAL_DELIVERY_NOTIFY_SECRET ||
  process.argv.find((a) => a.startsWith('--secret='))?.split('=')[1] ||
  'warmpawz-prod-meal-delivery-notify-2026';

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

function runJson(cmd) {
  return JSON.parse(run(cmd));
}

console.log('Using MEAL_DELIVERY_NOTIFY_SECRET (length):', secret.length);

try {
  run(
    `aws ssm put-parameter --name "${SSM_NAME}" --value "${secret}" --type SecureString --overwrite --region ${REGION}`,
  );
  console.log('SSM parameter upserted:', SSM_NAME);
} catch (e) {
  console.warn('SSM put-parameter:', e.stderr || e.message);
}

const cfg = runJson(
  `aws lambda get-function-configuration --function-name ${LAMBDA} --region ${REGION} --output json`,
);
const vars = { ...(cfg.Environment?.Variables || {}), MEAL_DELIVERY_NOTIFY_SECRET: secret };
const envFile = path.join(__dirname, '.tmp-lambda-env-prod.json');
fs.writeFileSync(envFile, JSON.stringify({ Variables: vars }));
run(
  `aws lambda update-function-configuration --function-name ${LAMBDA} --region ${REGION} --environment file://${envFile.replace(/\\/g, '/')}`,
);
fs.unlinkSync(envFile);
run(`aws lambda wait function-updated --function-name ${LAMBDA} --region ${REGION}`);
console.log('Lambda updated:', LAMBDA);

const td = runJson(
  `aws ecs describe-task-definition --task-definition ${TASK_FAMILY} --region ${REGION} --query taskDefinition --output json`,
);
for (const key of [
  'taskDefinitionArn',
  'revision',
  'status',
  'requiresAttributes',
  'compatibilities',
  'registeredAt',
  'registeredBy',
]) {
  delete td[key];
}
const container = td.containerDefinitions[0];
const env = container.environment || [];
const filtered = env.filter((e) => e.name !== 'MEAL_DELIVERY_NOTIFY_SECRET');
filtered.push({ name: 'MEAL_DELIVERY_NOTIFY_SECRET', value: secret });
container.environment = filtered;

const tdFile = path.join(__dirname, '.tmp-ecs-task-prod.json');
fs.writeFileSync(tdFile, JSON.stringify(td));
const reg = runJson(
  `aws ecs register-task-definition --region ${REGION} --cli-input-json file://${tdFile.replace(/\\/g, '/')} --output json`,
);
fs.unlinkSync(tdFile);
const newArn = reg.taskDefinition?.taskDefinitionArn;
console.log('Registered task definition:', newArn);

run(
  `aws ecs update-service --cluster ${CLUSTER} --service ${SERVICE} --region ${REGION} --task-definition ${newArn} --force-new-deployment --output json`,
);
console.log('ECS service update started:', SERVICE);
console.log('Done. Run CodeBuild after git push for latest delivery-service image.');
