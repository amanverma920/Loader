// Test script for NexPanel API Connect endpoint
// This script demonstrates the complete process for authenticating with the API

const crypto = require('crypto');

// Configuration
const API_BASE_URL = 'http://localhost:3000';
const API_KEY = 'f7d9c0a3-8f91-4cdb-b1be-30c041ac59c3-bbd6ab87-6fa7-4f1f-8f9e-e8653ab87189-20c9b5f2-b1d1-48ea-8cba-1f8d10c5be32'; // Default API key from the code
const SECRET_KEY = 'd4e9a8f6b3c1d5g2h7k9z8l0'; // Get from environment variable

// Function to encrypt data (matches the server's decryption)
function encryptAES(data, key) {
  const keyBuffer = Buffer.from(key, 'utf8');
  const dataBuffer = Buffer.from(data, 'utf8');
  
  let encrypted = Buffer.alloc(dataBuffer.length);
  for (let i = 0; i < dataBuffer.length; i++) {
    encrypted[i] = dataBuffer[i] ^ keyBuffer[i % keyBuffer.length];
  }
  
  return encrypted.toString('base64');
}



// Test function
async function testConnectAPI() {
  try {
    // Step 1: Generate a test key (you should use a real key from your database)
    const testKey = 'X4OBEXJ20BNJUEA0'; // Replace with a real key from your database
    const uuid = 'dawd3443rt';
    
    console.log('🔑 Test Configuration:');
    console.log(`   Key: ${testKey}`);
    console.log(`   UUID: ${uuid}`);
    console.log(`   API Key: ${API_KEY}`);
    console.log(`   Secret Key: ${SECRET_KEY}`);
    console.log('');
    
    // Step 2: Create key_UUID string
    const keyUUID = `${testKey}_${uuid}`;
    console.log('📝 Step 1: Creating key_UUID string');
    console.log(`   key_UUID: ${keyUUID}`);
    console.log('');
    
    // Step 3: Convert to base64
    const base64Data = Buffer.from(keyUUID, 'utf8').toString('base64');
    console.log('🔢 Step 2: Converting to base64');
    console.log(`   Base64: ${base64Data}`);
    console.log('');
    
    // Step 4: Encrypt with AES
    const encryptedData = encryptAES(base64Data, SECRET_KEY);
    console.log('🔐 Step 3: Encrypting with AES');
    console.log(`   Encrypted: ${encryptedData}`);
    console.log('');
    
    // Step 5: Prepare the request
    const requestBody = {
      encryptedData: encryptedData
    };
    
    console.log('📤 Step 4: Sending request to /api/connect');
    console.log(`   URL: ${API_BASE_URL}/api/connect`);
    console.log(`   Method: POST`);
    console.log(`   Headers: X-API-Key: ${API_KEY}`);
    console.log(`   Body: ${JSON.stringify(requestBody, null, 2)}`);
    console.log('');
    
    // Step 6: Make the request
    const response = await fetch(`${API_BASE_URL}/api/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify(requestBody)
    });
    
    const result = await response.json();
    
    console.log('📥 Step 5: Response received');
    console.log(`   Status: ${response.status}`);
    console.log(`   Response: ${JSON.stringify(result, null, 2)}`);
    
    if (result.status) {
      console.log('✅ Success! Authentication successful');
    } else {
      console.log('❌ Failed! Authentication failed');
      console.log(`   Reason: ${result.reason}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the test
testConnectAPI();
