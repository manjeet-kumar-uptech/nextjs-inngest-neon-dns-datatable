#!/usr/bin/env node

/**
 * Simple test script to verify Inngest integration
 * Run with: node test-inngest.js
 */

const http = require('http');

async function testInngest() {
  console.log('🧪 Testing Inngest Integration...\n');

  // Test 1: Send a test event to trigger the test function
  try {
    console.log('1️⃣ Sending test event...');

    const testData = {
      test: true,
      timestamp: new Date().toISOString(),
      message: 'Testing Inngest integration from Node.js script'
    };

    const postData = JSON.stringify(testData);

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/inngest',
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      console.log(`Status: ${res.statusCode}`);
      console.log(`Headers:`, res.headers);

      res.setEncoding('utf8');
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        console.log('Response body:', body);
      });
    });

    req.on('error', (e) => {
      console.error(`❌ Request failed: ${e.message}`);
    });

    req.write(postData);
    req.end();

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  // Test 2: Check if Inngest dev server is running
  console.log('\n2️⃣ Checking Inngest dev server...');

  const checkServer = () => {
    http.get('http://localhost:8288', (res) => {
      console.log('✅ Inngest dev server is running');
      console.log(`Status: ${res.statusCode}`);
    }).on('error', () => {
      console.log('❌ Inngest dev server is not running');
      console.log('💡 Start it with: npx inngest-cli dev --port 8288');
    });
  };

  setTimeout(checkServer, 2000);
}

testInngest();
