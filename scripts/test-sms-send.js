#!/usr/bin/env node
/**
 * Ad-hoc SMS test – sends one Login OTP SMS via SNS.
 * Use this to verify SMS delivery works before production.
 *
 * Usage:
 *   SMS_AWS_ACCESS_KEY_ID=xxx SMS_AWS_SECRET_ACCESS_KEY=yyy node scripts/test-sms-send.js
 *   SMS_AWS_ACCESS_KEY_ID=xxx SMS_AWS_SECRET_ACCESS_KEY=yyy node scripts/test-sms-send.js 9611377119
 */

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const ACCESS_KEY = process.env.SMS_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const SECRET_KEY = process.env.SMS_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
const PHONE = process.argv[2] || '9611377119';

const normalizedPhone = PHONE.startsWith('+') ? PHONE : `+91${PHONE.replace(/\D/g, '')}`;
const testOtp = '123456';
const message = `Warmpawz: Your OTP for logging in is ${testOtp}. Do not share this OTP with anyone.`;

async function run() {
  console.log('Sending test SMS via SNS...');
  console.log('  Phone:', normalizedPhone);
  console.log('  Region:', REGION);
  console.log('  Sender ID: WARMPZ');
  console.log('  Entity ID:', process.env.SMS_ENTITY_ID || '1201176605406673276');
  console.log('  Template ID:', process.env.SMS_TEMPLATE_ID || '1207177028377787269');
  console.log('');

  const clientConfig = { region: REGION };
  if (ACCESS_KEY && SECRET_KEY) {
    clientConfig.credentials = { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY };
  }
  const client = new SNSClient(clientConfig);

  // India DLT: Entity ID (PE) and Template ID from Jio True Connect registration
  const ENTITY_ID = process.env.SMS_ENTITY_ID || '1201176605406673276';
  const TEMPLATE_ID = process.env.SMS_TEMPLATE_ID || '1207177028377787269';

  // India DLT: EntityId/TemplateId must use AWS.MM.SMS.* (matches Lambda sms-service.ts)
  const attrs = {
    'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
    'AWS.SNS.SMS.SenderID': { DataType: 'String', StringValue: 'WARMPZ' },
    'AWS.MM.SMS.EntityId': { DataType: 'String', StringValue: ENTITY_ID },
    'AWS.MM.SMS.TemplateId': { DataType: 'String', StringValue: TEMPLATE_ID },
  };

  try {
    await client.send(new PublishCommand({
      PhoneNumber: normalizedPhone,
      Message: message,
      MessageAttributes: attrs,
    }));
    console.log('SMS sent successfully. Check your phone for the Warmpawz OTP message.');
  } catch (err) {
    console.error('SMS send failed:', err.message);
    process.exit(1);
  }
}

run();
