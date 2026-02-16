const https = require('https');

const API_BASE_URL = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const testPhone = '9876549999';
const referralCode = 'CREF189BO3CX';

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({ statusCode: res.statusCode, response });
        } catch (e) {
          resolve({ statusCode: res.statusCode, response: data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      const bodyStr = JSON.stringify(options.body);
      console.log('Request body:', bodyStr);
      req.write(bodyStr);
    }

    req.end();
  });
}

async function testReferralCodeRequest() {
  console.log('Testing OTP verification with referral code...');
  console.log(`Phone: ${testPhone}`);
  console.log(`Referral Code: ${referralCode}\n`);

  const requestBody = {
    phone: testPhone,
    otp: '123456',
    role: 'customer',
    referralCode: referralCode,
  };

  console.log('Request body:', JSON.stringify(requestBody, null, 2));
  console.log('');

  try {
    const result = await makeRequest(
      `${API_BASE_URL}/auth/verify-otp`,
      {
        method: 'POST',
        body: requestBody,
      }
    );

    console.log('Response status:', result.statusCode);
    console.log('Response:', JSON.stringify(result.response, null, 2).substring(0, 1000));
  } catch (error) {
    console.error('Error:', error);
  }
}

testReferralCodeRequest();
