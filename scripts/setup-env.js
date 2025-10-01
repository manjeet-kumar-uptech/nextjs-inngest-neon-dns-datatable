#!/usr/bin/env node

/**
 * Setup script to help configure environment variables
 * Run with: node scripts/setup-env.js
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Vercel Blob Storage Setup Helper\n');

// Check if .env.local exists
const envPath = path.join(process.cwd(), '.env.local');
const envExists = fs.existsSync(envPath);

if (envExists) {
  console.log('✅ .env.local file already exists');
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  if (envContent.includes('BLOB_READ_WRITE_TOKEN')) {
    console.log('✅ BLOB_READ_WRITE_TOKEN is configured');
  } else {
    console.log('❌ BLOB_READ_WRITE_TOKEN is missing');
  }
} else {
  console.log('❌ .env.local file not found');
  console.log('\n📝 Create a .env.local file with the following content:');
  console.log(`
# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token_here

# Inngest Configuration (optional)
INNGEST_EVENT_KEY=your_inngest_event_key_here
INNGEST_SIGNING_KEY=your_inngest_signing_key_here
  `);
}

console.log('\n🔧 Setup Steps:');
console.log('1. Go to https://vercel.com/dashboard');
console.log('2. Select your project');
console.log('3. Go to Storage tab');
console.log('4. Create a new Blob store');
console.log('5. Copy the BLOB_READ_WRITE_TOKEN to your .env.local file');
console.log('6. Run: npm run dev');

console.log('\n📚 For more details, see SETUP.md');
