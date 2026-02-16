const { CloudWatchLogsClient, FilterLogEventsCommand } = require('@aws-sdk/client-cloudwatch-logs');

const LOG_GROUP = '/aws/lambda/warmpawz-dev-api-handler';
const PHONE = '5767543675';
const REFERRAL_CODE = 'VREFCA45O7N4';

async function checkCloudWatchLogs() {
  const client = new CloudWatchLogsClient({ region: 'ap-south-1' });

  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  CHECKING CLOUDWATCH LOGS FOR OTP VERIFICATION');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Get logs from last 2 hours
    const startTime = Date.now() - (2 * 60 * 60 * 1000);
    
    const command = new FilterLogEventsCommand({
      logGroupName: LOG_GROUP,
      startTime: startTime,
      filterPattern: `"${PHONE}" OR "${REFERRAL_CODE}" OR "referralCode" OR "AUTH" OR "Processing referral"`,
      limit: 100,
    });

    const response = await client.send(command);
    
    console.log(`Found ${response.events?.length || 0} log events:\n`);
    
    if (response.events && response.events.length > 0) {
      response.events.forEach((event, i) => {
        const timestamp = new Date(event.timestamp).toLocaleString();
        console.log(`[${timestamp}] ${event.message}`);
      });
    } else {
      console.log('No matching log events found');
    }

  } catch (error) {
    console.error('Error checking CloudWatch logs:', error);
  }
}

checkCloudWatchLogs();
