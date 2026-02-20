#!/usr/bin/env node
/**
 * Test Admin Login for Production
 * Tests the admin login endpoint with production credentials
 * 
 * Usage: node scripts/test-admin-login-prod.js
 */

const https = require('https');

const PROD_API_URL = 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com';
const LOGIN_ENDPOINT = '/admin/auth/login';

const credentials = {
  email: 'admin@warmpawz.com',
  password: 'Admin123!'
};

function makeRequest(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': JSON.stringify(data).length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: parsed
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(JSON.stringify(data));
    req.end();
  });
}

async function testAdminLogin() {
  console.log('🧪 Testing Admin Login for Production');
  console.log('=====================================');
  console.log('');
  console.log('📡 API Endpoint:', PROD_API_URL + LOGIN_ENDPOINT);
  console.log('📧 Email:', credentials.email);
  console.log('🔐 Password:', credentials.password.replace(/./g, '*'));
  console.log('');
  
  try {
    console.log('⏳ Sending login request...');
    const response = await makeRequest(PROD_API_URL + LOGIN_ENDPOINT, credentials);
    
    console.log('');
    console.log('📊 Response:');
    console.log('   Status Code:', response.statusCode);
    console.log('');
    
    if (response.statusCode === 200) {
      console.log('✅ Login Successful!');
      console.log('');
      if (response.body.success) {
        console.log('📋 Response Data:');
        console.log('   Success:', response.body.success);
        if (response.body.token) {
          console.log('   Token Type:', response.body.token.token_type);
          console.log('   Has Access Token:', !!response.body.token.access_token);
          console.log('   Has ID Token:', !!response.body.token.id_token);
          console.log('   Expires In:', response.body.token.expires_in, 'seconds');
        }
        if (response.body.admin) {
          console.log('   Admin ID:', response.body.admin.id);
          console.log('   Admin Email:', response.body.admin.email);
          console.log('   Admin Name:', response.body.admin.name);
          console.log('   Admin Role:', response.body.admin.role);
        }
      } else {
        console.log('⚠️  Response indicates failure:');
        console.log(JSON.stringify(response.body, null, 2));
      }
    } else {
      console.log('❌ Login Failed!');
      console.log('');
      console.log('📋 Error Response:');
      console.log(JSON.stringify(response.body, null, 2));
      
      if (response.body.error) {
        console.log('');
        console.log('💡 Error Message:', response.body.error);
        
        if (response.body.error.includes('Email and password are required')) {
          console.log('');
          console.log('🔧 Possible Issues:');
          console.log('   1. Request body not being parsed correctly');
          console.log('   2. Lambda code needs to be redeployed with body parsing fix');
        } else if (response.body.error.includes('Invalid credentials')) {
          console.log('');
          console.log('🔧 Possible Issues:');
          console.log('   1. Admin account does not exist in database');
          console.log('   2. Password hash does not match');
          console.log('   3. Run: node scripts/setup-admin-account.js --env=prod');
        }
      }
    }
    
    console.log('');
    console.log('=====================================');
    
  } catch (error) {
    console.error('❌ Request Failed:', error.message);
    console.error('');
    console.error('💡 Possible Issues:');
    console.error('   1. Network connectivity problem');
    console.error('   2. API Gateway endpoint is incorrect');
    console.error('   3. CORS or security group blocking request');
    console.error('');
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testAdminLogin();
